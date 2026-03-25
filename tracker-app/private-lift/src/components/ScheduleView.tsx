import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { DB } from '../database/db';
import { Routine, RoutineMode, Workout } from '../types/database';

interface ScheduleViewProps {
  activeRoutine: Routine;
  completedSessionsCount: number;
}

const WEEK_DAYS_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const ScheduleView: React.FC<ScheduleViewProps> = ({ activeRoutine, completedSessionsCount }) => {
  const schedule = useMemo(() => {
    const days = [];
    const now = new Date();
    const currentDayIdx = (now.getDay() + 6) % 7; // 0=Mon

    // Get all mappings for this routine
    const mappings = DB.getAll<any>('SELECT * FROM Routine_Workouts WHERE routine_id = ? ORDER BY order_index ASC;', [activeRoutine.id]);
    const workouts = DB.getAll<Workout>('SELECT * FROM Workouts;');

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() + i);
      const dayIdx = (dayDate.getDay() + 6) % 7;
      
      let workoutName = 'Rest Day';
      let isRest = true;

      if (activeRoutine.mode === RoutineMode.WEEKLY) {
        const shiftedDayIdx = (dayIdx - (activeRoutine.start_day_index || 0) + 7) % 7;
        const mapping = mappings.find(m => m.day_of_week === shiftedDayIdx);
        if (mapping && mapping.workout_id) {
          const w = workouts.find(work => work.id === mapping.workout_id);
          workoutName = w?.name || 'Workout';
          isRest = false;
        }
      } else {
        // ASYNC logic: projected sequence
        // This is a simplified projection
        const seqIdx = (completedSessionsCount + i) % (mappings.length || 1);
        const mapping = mappings[seqIdx];
        if (mapping && mapping.workout_id) {
          const w = workouts.find(work => work.id === mapping.workout_id);
          workoutName = w?.name || 'Workout';
          isRest = false;
        }
      }

      days.push({
        label: i === 0 ? 'Today' : WEEK_DAYS_SHORT[dayIdx],
        workoutName,
        isRest,
        isToday: i === 0,
        date: dayDate.getDate()
      });
    }
    return days;
  }, [activeRoutine, completedSessionsCount]);

  return (
    <View className="mb-8">
      <Text className="text-xs font-black text-text-muted uppercase tracking-[4px] ml-6 mb-4">Deployment Schedule</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24 }}
      >
        {schedule.map((day, idx) => (
          <View 
            key={idx} 
            className={`mr-3 p-4 rounded-[28px] border w-32 ${
              day.isToday ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'bg-surface border-border'
            }`}
          >
            <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
              day.isToday ? 'text-surface/70' : 'text-text-muted'
            }`}>
              {day.label} {day.date}
            </Text>
            <Text 
              numberOfLines={2}
              className={`text-sm font-black leading-tight ${
                day.isToday ? 'text-surface' : 'text-text-main'
              }`}
            >
              {day.workoutName}
            </Text>
            {!day.isRest && (
              <View className={`mt-3 h-1 w-6 rounded-full ${
                day.isToday ? 'bg-surface/30' : 'bg-primary/20'
              }`} />
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};
