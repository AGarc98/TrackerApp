import { useState, useEffect, useCallback } from 'react';
import { DB } from '../database/db';
import { MuscleGroup } from '../types/database';

const DEBOUNCE_MS = 300;

export interface AnalyticsDataPoint {
  weekStart: string; // ISO date string (Monday)
  volume: number;
  frequency: number;
  intensity: number; // Average weight
  distance: number;
  time_ms: number;
}

export interface ComparisonData {
  volumeChange: number; // Percentage
  intensityChange: number; // Percentage
  frequencyChange: number; // Percentage
  distanceChange: number; // Percentage
  timeChange: number; // Percentage
}

export const useAnalytics = (muscleGroup: MuscleGroup, weeks: number = 4) => {
  const [data, setData] = useState<AnalyticsDataPoint[]>([]);
  const [comparison, setComparison] = useState<ComparisonData>({ 
    volumeChange: 0, 
    intensityChange: 0, 
    frequencyChange: 0,
    distanceChange: 0,
    timeChange: 0 
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalyticsData = useCallback(() => {
    setIsLoading(true);
    try {
      // Calculate the start of the current week (Monday)
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

      const sql = `
        SELECT 
          s.id as session_id,
          s.start_time,
          ls.weight,
          ls.reps,
          ls.distance,
          ls.time_ms
        FROM Logged_Sets ls
        JOIN Exercise_Muscle_Groups emg ON ls.exercise_id = emg.exercise_id
        JOIN Logged_Sessions s ON ls.session_id = s.id
        WHERE emg.muscle_group = ?
          AND s.start_time >= ?
          AND s.start_time < ?
          AND ls.is_skipped = 0
      `;

      const allSets = DB.getAll<any>(sql, [muscleGroup, minStartTime.getTime(), maxEndTime.getTime()]);

      // Optimization: Group sets by week index in a single pass
      const weekBuckets: any[] = Array.from({ length: totalWeeksToFetch }, () => ({
        sets: [],
        startTime: 0,
        weekStartStr: ''
      }));

      for (let i = 0; i < totalWeeksToFetch; i++) {
        const weekStart = new Date(startOfCurrentWeek);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        weekBuckets[i].startTime = weekStart.getTime();
        weekBuckets[i].weekStartStr = weekStart.toISOString().split('T')[0];
      }

      const weekMs = 7 * 24 * 60 * 60 * 1000;
      allSets.forEach(s => {
        const time = s.start_time;
        const diffMs = (startOfCurrentWeek.getTime() + weekMs - 1) - time;
        const weekIndex = Math.floor(diffMs / weekMs);
        if (weekIndex >= 0 && weekIndex < totalWeeksToFetch) {
          weekBuckets[weekIndex].sets.push(s);
        }
      });

      const processPeriod = (numWeeks: number, offsetWeeks: number) => {
        const periodData: AnalyticsDataPoint[] = [];
        let totalVolume = 0;
        let totalFrequency = 0;
        let intensitySum = 0;
        let intensityCount = 0;
        let totalDistance = 0;
        let totalTime = 0;

        for (let i = numWeeks - 1; i >= 0; i--) {
          const bucket = weekBuckets[i + offsetWeeks];
          const weekSets = bucket.sets;
          
          const uniqueSessions = new Set(weekSets.map((s: any) => s.session_id));
          const frequency = uniqueSessions.size;
          
          let weekVolume = 0;
          let weekIntensitySum = 0;
          let weekIntensityCount = 0;
          let weekDistance = 0;
          let weekTime = 0;

          weekSets.forEach((s: any) => {
            weekVolume += (s.weight || 0) * (s.reps || 0);
            weekDistance += (s.distance || 0);
            weekTime += (s.time_ms || 0);
            if ((s.weight || 0) > 0) {
              weekIntensitySum += s.weight;
              weekIntensityCount++;
            }
          });

          const avgIntensity = weekIntensityCount > 0 ? weekIntensitySum / weekIntensityCount : 0;

          periodData.push({
            weekStart: bucket.weekStartStr,
            volume: weekVolume,
            frequency,
            intensity: avgIntensity,
            distance: weekDistance,
            time_ms: weekTime,
          });

          totalVolume += weekVolume;
          totalFrequency += frequency;
          totalDistance += weekDistance;
          totalTime += weekTime;
          if (avgIntensity > 0) {
            intensitySum += avgIntensity;
            intensityCount++;
          }
        }

        return {
          data: periodData,
          totals: {
            volume: totalVolume,
            frequency: totalFrequency,
            avgIntensity: intensityCount > 0 ? intensitySum / intensityCount : 0,
            distance: totalDistance,
            time: totalTime
          }
        };
      };

      const currentPeriod = processPeriod(weeks, 0);
      const previousPeriod = processPeriod(weeks, weeks);

      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      setData(currentPeriod.data);
      setComparison({
        volumeChange: calculateChange(currentPeriod.totals.volume, previousPeriod.totals.volume),
        intensityChange: calculateChange(currentPeriod.totals.avgIntensity, previousPeriod.totals.avgIntensity),
        frequencyChange: calculateChange(currentPeriod.totals.frequency, previousPeriod.totals.frequency),
        distanceChange: calculateChange(currentPeriod.totals.distance, previousPeriod.totals.distance),
        timeChange: calculateChange(currentPeriod.totals.time, previousPeriod.totals.time),
      });

    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [muscleGroup, weeks]);

  useEffect(() => {
    const timer = setTimeout(fetchAnalyticsData, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [fetchAnalyticsData]);

  return { data, comparison, isLoading, refresh: fetchAnalyticsData };
};
