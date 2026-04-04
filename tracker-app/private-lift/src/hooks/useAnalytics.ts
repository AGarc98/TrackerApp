import { useState, useEffect, useCallback } from 'react';
import { DB } from '../database/db';
import { MuscleGroup } from '../types/database';

const DEBOUNCE_MS = 300;

/** Epley formula for estimated 1-Rep Max */
const epley = (weight: number, reps: number) =>
  reps === 1 ? weight : weight * (1 + reps / 30);

export interface AnalyticsDataPoint {
  weekStart: string;          // ISO date string (Monday)
  primarySets: number;        // Working sets where muscle is primary
  secondarySets: number;      // Working sets where muscle is secondary/assistance
  avgLoad: number;            // Average weight across working sets (strength only)
  peakE1RM: number;           // Best estimated 1RM for the week (strength only)
  avgRPE: number;             // Average session RPE for the week (0 = no data)
  distance: number;           // Total distance (endurance)
  time_ms: number;            // Total time in ms (endurance/isometric)
  frequency: number;          // Unique sessions
}

export interface ComparisonData {
  setsChange: number;         // % change in total sets (primary + secondary)
  primarySetsChange: number;  // % change in primary sets only
  loadChange: number;         // % change in avg load
  e1RMChange: number;         // % change in peak e1RM
  distanceChange: number;
  timeChange: number;
  frequencyChange: number;
  rpeChange: number;
}

export interface ExerciseOption {
  id: string;
  name: string;
}

export const useAnalytics = (
  muscleGroup: MuscleGroup,
  weeks: number = 8,
  exerciseId: string | null = null,
) => {
  const [data, setData] = useState<AnalyticsDataPoint[]>([]);
  const [comparison, setComparison] = useState<ComparisonData>({
    setsChange: 0,
    primarySetsChange: 0,
    loadChange: 0,
    e1RMChange: 0,
    distanceChange: 0,
    timeChange: 0,
    frequencyChange: 0,
    rpeChange: 0,
  });
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalyticsData = useCallback(() => {
    setIsLoading(true);
    try {
      // ── Date window ──────────────────────────────────────────────────────
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - (day === 0 ? 6 : day - 1);
      const startOfCurrentWeek = new Date(now);
      startOfCurrentWeek.setDate(diff);
      startOfCurrentWeek.setHours(0, 0, 0, 0);

      const totalWeeksToFetch = weeks * 2;
      const minStartTime = new Date(startOfCurrentWeek);
      minStartTime.setDate(minStartTime.getDate() - ((totalWeeksToFetch - 1) * 7));
      const maxEndTime = new Date(startOfCurrentWeek);
      maxEndTime.setDate(maxEndTime.getDate() + 7);

      // ── Exercise options for this muscle group ────────────────────────────
      const exerciseSql = `
        SELECT DISTINCT e.id, e.name
        FROM Exercises e
        JOIN Exercise_Muscle_Groups emg ON e.id = emg.exercise_id
        WHERE emg.muscle_group = ?
        ORDER BY e.name ASC
      `;
      const options = DB.getAll<ExerciseOption>(exerciseSql, [muscleGroup]);
      setExerciseOptions(options);

      // ── Main set query ────────────────────────────────────────────────────
      // Pull is_primary from emg so we can split primary vs secondary sets.
      // Exclude WARMUP sets — they don't count toward training volume.
      // Join sessions for RPE and start_time.
      const exerciseFilter = exerciseId ? 'AND ls.exercise_id = ?' : '';
      const params: any[] = exerciseId
        ? [muscleGroup, minStartTime.getTime(), maxEndTime.getTime(), exerciseId]
        : [muscleGroup, minStartTime.getTime(), maxEndTime.getTime()];

      const sql = `
        SELECT
          s.id       AS session_id,
          s.start_time,
          s.rpe      AS session_rpe,
          ls.weight,
          ls.reps,
          ls.distance,
          ls.time_ms,
          ls.set_type,
          emg.is_primary
        FROM Logged_Sets ls
        JOIN Exercise_Muscle_Groups emg
          ON ls.exercise_id = emg.exercise_id
          AND emg.muscle_group = ?
        JOIN Logged_Sessions s ON ls.session_id = s.id
        WHERE s.start_time >= ?
          AND s.start_time < ?
          AND ls.is_skipped = 0
          AND ls.set_type != 'WARMUP'
          ${exerciseFilter}
      `;

      const allSets = DB.getAll<any>(sql, params);

      // ── Week buckets ──────────────────────────────────────────────────────
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const weekBuckets: any[] = Array.from({ length: totalWeeksToFetch }, (_, i) => {
        const weekStart = new Date(startOfCurrentWeek);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        return {
          sets: [] as any[],
          startTime: weekStart.getTime(),
          weekStartStr: weekStart.toISOString().split('T')[0],
        };
      });

      allSets.forEach(s => {
        const diffMs = (startOfCurrentWeek.getTime() + weekMs - 1) - s.start_time;
        const weekIndex = Math.floor(diffMs / weekMs);
        if (weekIndex >= 0 && weekIndex < totalWeeksToFetch) {
          weekBuckets[weekIndex].sets.push(s);
        }
      });

      // ── Process a period of N weeks starting at offsetWeeks ──────────────
      const processPeriod = (numWeeks: number, offsetWeeks: number) => {
        const periodData: AnalyticsDataPoint[] = [];
        let totalPrimarySets = 0;
        let totalSecondarySets = 0;
        let totalLoadSum = 0;
        let totalLoadCount = 0;
        let bestE1RM = 0;
        let totalDistance = 0;
        let totalTime = 0;
        let totalFrequency = 0;
        let totalRPESum = 0;
        let totalRPECount = 0;

        for (let i = numWeeks - 1; i >= 0; i--) {
          const bucket = weekBuckets[i + offsetWeeks];
          const weekSets: any[] = bucket.sets;

          const uniqueSessions = new Set<string>(weekSets.map((s: any) => s.session_id));
          const frequency = uniqueSessions.size;

          let primarySets = 0;
          let secondarySets = 0;
          let loadSum = 0;
          let loadCount = 0;
          let weekBestE1RM = 0;
          let weekDistance = 0;
          let weekTime = 0;

          // RPE: average per session, then average those per week
          const sessionRPEMap = new Map<string, number>();
          weekSets.forEach((s: any) => {
            if (s.is_primary) {
              primarySets++;
            } else {
              secondarySets++;
            }
            weekDistance += s.distance || 0;
            weekTime += s.time_ms || 0;

            const w = s.weight || 0;
            const r = s.reps || 0;
            if (w > 0 && r > 0) {
              loadSum += w;
              loadCount++;
              const e1rm = epley(w, r);
              if (e1rm > weekBestE1RM) weekBestE1RM = e1rm;
              if (e1rm > bestE1RM) bestE1RM = e1rm;
            }

            if (s.session_rpe != null && !sessionRPEMap.has(s.session_id)) {
              sessionRPEMap.set(s.session_id, s.session_rpe);
            }
          });

          let avgRPE = 0;
          if (sessionRPEMap.size > 0) {
            const rpeSum = Array.from(sessionRPEMap.values()).reduce((a, b) => a + b, 0);
            avgRPE = rpeSum / sessionRPEMap.size;
            totalRPESum += avgRPE;
            totalRPECount++;
          }

          const avgLoad = loadCount > 0 ? loadSum / loadCount : 0;

          periodData.push({
            weekStart: bucket.weekStartStr,
            primarySets,
            secondarySets,
            avgLoad,
            peakE1RM: weekBestE1RM,
            avgRPE,
            distance: weekDistance,
            time_ms: weekTime,
            frequency,
          });

          totalPrimarySets += primarySets;
          totalSecondarySets += secondarySets;
          totalLoadSum += loadSum;
          totalLoadCount += loadCount;
          totalDistance += weekDistance;
          totalTime += weekTime;
          totalFrequency += frequency;
        }

        return {
          data: periodData,
          totals: {
            primarySets: totalPrimarySets,
            totalSets: totalPrimarySets + totalSecondarySets,
            avgLoad: totalLoadCount > 0 ? totalLoadSum / totalLoadCount : 0,
            bestE1RM,
            distance: totalDistance,
            time: totalTime,
            frequency: totalFrequency,
            avgRPE: totalRPECount > 0 ? totalRPESum / totalRPECount : 0,
          },
        };
      };

      const currentPeriod = processPeriod(weeks, 0);
      const previousPeriod = processPeriod(weeks, weeks);

      const pctChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      setData(currentPeriod.data);
      setComparison({
        setsChange: pctChange(currentPeriod.totals.totalSets, previousPeriod.totals.totalSets),
        primarySetsChange: pctChange(currentPeriod.totals.primarySets, previousPeriod.totals.primarySets),
        loadChange: pctChange(currentPeriod.totals.avgLoad, previousPeriod.totals.avgLoad),
        e1RMChange: pctChange(currentPeriod.totals.bestE1RM, previousPeriod.totals.bestE1RM),
        distanceChange: pctChange(currentPeriod.totals.distance, previousPeriod.totals.distance),
        timeChange: pctChange(currentPeriod.totals.time, previousPeriod.totals.time),
        frequencyChange: pctChange(currentPeriod.totals.frequency, previousPeriod.totals.frequency),
        rpeChange: pctChange(currentPeriod.totals.avgRPE, previousPeriod.totals.avgRPE),
      });
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [muscleGroup, weeks, exerciseId]);

  useEffect(() => {
    const timer = setTimeout(fetchAnalyticsData, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [fetchAnalyticsData]);

  return { data, comparison, exerciseOptions, isLoading, refresh: fetchAnalyticsData };
};
