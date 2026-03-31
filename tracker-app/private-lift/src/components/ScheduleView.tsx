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

    const mappings = DB.getAll<any>('SELECT * FROM Routine_Workouts WHERE routine_id = ? ORDER BY order_index ASC;', [activeRoutine.id]);
    const workouts = DB.getAll<Workout>('SELECT * FROM Workouts;');

    // ASYNC: check if a session was already logged today for this routine
    let todayAlreadyLogged = false;
    if (activeRoutine.mode === RoutineMode.ASYNC && mappings.length > 0) {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      todayAlreadyLogged = !!DB.getOne(
        'SELECT id FROM Logged_Sessions WHERE routine_id = ? AND start_time >= ? LIMIT 1;',
        [activeRoutine.id, todayStart.getTime()]
      );
    }

    // ASYNC: whether we're sitting on a cycle boundary (last cycle just finished)
    const isCycleBoundary = activeRoutine.mode === RoutineMode.ASYNC &&
      mappings.length > 0 &&
      completedSessionsCount > 0 &&
      completedSessionsCount % mappings.length === 0;

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(now);
      dayDate.setDate(now.getDate() + i);
      const dayIdx = (dayDate.getDay() + 6) % 7;

      let workoutName = 'Rest Day';
      let isRest = true;
      let isDone = false;

      if (activeRoutine.mode === RoutineMode.WEEKLY) {
        const shiftedDayIdx = (dayIdx - (activeRoutine.start_day_index || 0) + 7) % 7;
        const mapping = mappings.find((m: any) => m.day_of_week === shiftedDayIdx);
        if (mapping && mapping.workout_id) {
          const w = workouts.find(work => work.id === mapping.workout_id);
          workoutName = w?.name || 'Workout';
          isRest = false;
        }
      } else {
        // ASYNC projection
        // frontConsumed = how many days at the front are pre-occupied before the sequence projection starts:
        // +1 if today is already logged (occupied by the done workout card)
        // +1 if we're at a cycle boundary (occupied by the implied rest day)
        const frontConsumed = (todayAlreadyLogged ? 1 : 0) + (isCycleBoundary ? 1 : 0);

        if (i === 0 && todayAlreadyLogged) {
          // Today: show the workout that was completed
          const doneIdx = (completedSessionsCount - 1 + mappings.length) % mappings.length;
          const m = mappings[doneIdx];
          const w = workouts.find(wk => wk.id === m?.workout_id);
          workoutName = w?.name || 'Rest Day';
          isRest = !m?.workout_id;
          isDone = true;
        } else if (isCycleBoundary && i < frontConsumed) {
          // Cycle rest day: slot i=0 when not logged today, slot i=1 when logged today
          workoutName = 'Rest Day';
          isRest = true;
        } else {
          // Normal sequence projection, shifted past the consumed front slots
          const projOffset = i - frontConsumed;
          const seqIdx = (completedSessionsCount + projOffset) % mappings.length;
          const m = mappings[seqIdx];
          if (m && m.workout_id) {
            const w = workouts.find(wk => wk.id === m.workout_id);
            workoutName = w?.name || 'Workout';
            isRest = false;
          }
        }
      }

      days.push({
        label: i === 0 ? 'Today' : WEEK_DAYS_SHORT[dayIdx],
        workoutName,
        isRest,
        isDone,
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
              day.isDone
                ? 'bg-success border-success shadow-lg shadow-success/20'
                : day.isToday
                  ? 'bg-primary border-primary shadow-lg shadow-primary/20'
                  : 'bg-surface border-border'
            }`}
          >
            <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
              day.isDone || day.isToday ? 'text-surface/70' : 'text-text-muted'
            }`}>
              {day.label} {day.date}
            </Text>
            <Text
              numberOfLines={2}
              className={`text-sm font-black leading-tight ${
                day.isDone || day.isToday ? 'text-surface' : 'text-text-main'
              }`}
            >
              {day.workoutName}
            </Text>
            {day.isDone ? (
              <Text className="text-surface/70 font-black text-[10px] uppercase tracking-widest mt-2">Done ✓</Text>
            ) : !day.isRest ? (
              <View className={`mt-3 h-1 w-6 rounded-full ${
                day.isToday ? 'bg-surface/30' : 'bg-primary/20'
              }`} />
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};
