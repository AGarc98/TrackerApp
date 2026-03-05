import { useState, useEffect, useCallback } from 'react';
import { DB } from '../database/db';
import { MuscleGroup } from '../types/database';

export interface AnalyticsDataPoint {
  weekStart: string; // ISO date string (Monday)
  volume: number;
  frequency: number;
  intensity: number; // Average weight
}

export interface ComparisonData {
  volumeChange: number; // Percentage
  intensityChange: number; // Percentage
  frequencyChange: number; // Percentage
}

export const useAnalytics = (muscleGroup: MuscleGroup, weeks: number = 4) => {
  const [data, setData] = useState<AnalyticsDataPoint[]>([]);
  const [comparison, setComparison] = useState<ComparisonData>({ volumeChange: 0, intensityChange: 0, frequencyChange: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalyticsData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate the start of the current week (Monday)
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - (day === 0 ? 6 : day - 1);
      const startOfCurrentWeek = new Date(now);
      startOfCurrentWeek.setDate(diff);
      startOfCurrentWeek.setHours(0, 0, 0, 0);

      const fetchDataForPeriod = async (numWeeks: number, offsetWeeks: number) => {
        const periodData: AnalyticsDataPoint[] = [];
        let totalVolume = 0;
        let totalFrequency = 0;
        let intensitySum = 0;
        let intensityCount = 0;

        for (let i = numWeeks - 1; i >= 0; i--) {
          const weekStart = new Date(startOfCurrentWeek);
          weekStart.setDate(weekStart.getDate() - ((i + offsetWeeks) * 7));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);

          const startTime = weekStart.getTime();
          const endTime = weekEnd.getTime();

          const sql = `
            SELECT 
              SUM(ls.weight * ls.reps) as total_volume,
              COUNT(DISTINCT s.id) as frequency,
              AVG(ls.weight) as avg_intensity
            FROM Logged_Sets ls
            JOIN Exercise_Muscle_Groups emg ON ls.exercise_id = emg.exercise_id
            JOIN Logged_Sessions s ON ls.session_id = s.id
            WHERE emg.muscle_group = ?
              AND emg.is_primary = 1
              AND s.start_time >= ?
              AND s.start_time < ?
              AND ls.is_skipped = 0
          `;

          const row = DB.getOne<any>(sql, [muscleGroup, startTime, endTime]);

          const volume = row?.total_volume || 0;
          const frequency = row?.frequency || 0;
          const intensity = row?.avg_intensity || 0;

          periodData.push({
            weekStart: weekStart.toISOString().split('T')[0],
            volume,
            frequency,
            intensity,
          });

          totalVolume += volume;
          totalFrequency += frequency;
          if (intensity > 0) {
            intensitySum += intensity;
            intensityCount++;
          }
        }
        return { 
            data: periodData, 
            totals: { 
                volume: totalVolume, 
                frequency: totalFrequency, 
                avgIntensity: intensityCount > 0 ? intensitySum / intensityCount : 0 
            } 
        };
      };

      const currentPeriod = await fetchDataForPeriod(weeks, 0);
      const previousPeriod = await fetchDataForPeriod(weeks, weeks);

      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      setData(currentPeriod.data);
      setComparison({
        volumeChange: calculateChange(currentPeriod.totals.volume, previousPeriod.totals.volume),
        intensityChange: calculateChange(currentPeriod.totals.avgIntensity, previousPeriod.totals.avgIntensity),
        frequencyChange: calculateChange(currentPeriod.totals.frequency, previousPeriod.totals.frequency),
      });

    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [muscleGroup, weeks]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  return { data, comparison, isLoading, refresh: fetchAnalyticsData };
};
