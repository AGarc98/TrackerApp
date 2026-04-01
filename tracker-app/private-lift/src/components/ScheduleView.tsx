import React, { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { DB } from '../database/db';
import { Routine, RoutineMode, Workout } from '../types/database';

interface ScheduleViewProps {
  activeRoutine: Routine;
  completedSessionsCount: number;
  refreshKey?: number;
}

const WEEK_DAYS_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Returns the Monday-epoch-ms cycle key for a given date (WEEKLY mode)
const getWeeklyCycleKey = (date: Date): string => {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - (date.getDay() + 6) % 7);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.getTime().toString();
};

// Returns the override workout id for a mapping in this cycle, or null
const getOverride = (
  overrides: { mapping_id: string; override_workout_id: string }[],
  mappingId: string
): string | null => overrides.find(o => o.mapping_id === mappingId)?.override_workout_id ?? null;

export const ScheduleView: React.FC<ScheduleViewProps> = ({ activeRoutine, completedSessionsCount, refreshKey }) => {
  const schedule = useMemo(() => {
    const days = [];
    const now = new Date();

    const mappings = DB.getAll<any>('SELECT * FROM Routine_Workouts WHERE routine_id = ? ORDER BY order_index ASC;', [activeRoutine.id]);
    const workouts = DB.getAll<Workout>('SELECT * FROM Workouts;');

    // Load current-cycle overrides
    let cycleKey: string;
    if (activeRoutine.mode === RoutineMode.WEEKLY) {
      cycleKey = getWeeklyCycleKey(now);
    } else {
      const cycleLength = mappings.length || 1;
      const cycleIndex = Math.floor(completedSessionsCount / cycleLength);
      cycleKey = cycleIndex.toString();
    }
    const overrides = DB.getAll<{ mapping_id: string; override_workout_id: string }>(
      'SELECT mapping_id, override_workout_id FROM Routine_Cycle_Overrides WHERE routine_id = ? AND cycle_key = ?;',
      [activeRoutine.id, cycleKey]
    );

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

    const resolveWorkoutId = (mapping: any): string | null =>
      getOverride(overrides, mapping.id) ?? mapping.workout_id ?? null;

    // Build a forward-looking slot sequence for ASYNC mode.
    // Inserts a rest-day slot whenever the cycle wraps, so projected rest days
    // appear throughout the 7-day window, not just at the current boundary.
    type AsyncSlot = { type: 'rest' } | { type: 'workout'; mapping: any };
    const buildAsyncSequence = (fromCount: number, needed: number): AsyncSlot[] => {
      const seq: AsyncSlot[] = [];
      let count = fromCount;
      // If we're already sitting at a cycle boundary, the first slot is a rest day
      if (count > 0 && count % mappings.length === 0) {
        seq.push({ type: 'rest' });
      }
      while (seq.length < needed) {
        seq.push({ type: 'workout', mapping: mappings[count % mappings.length] });
        count++;
        // After completing a full cycle, insert the implied rest day
        if (count % mappings.length === 0) {
          seq.push({ type: 'rest' });
        }
      }
      return seq;
    };

    // Pre-build enough slots to cover all 7 calendar days
    const asyncSeq = activeRoutine.mode === RoutineMode.ASYNC && mappings.length > 0
      ? buildAsyncSequence(completedSessionsCount, 9) // 9 gives headroom for rest day slots
      : [];

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
        if (mapping) {
          const workoutId = resolveWorkoutId(mapping);
          if (workoutId) {
            const w = workouts.find(work => work.id === workoutId);
            workoutName = w?.name || 'Workout';
            isRest = false;
          }
        }
        const dayStart = new Date(dayDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayDate);
        dayEnd.setHours(23, 59, 59, 999);
        isDone = !!DB.getOne(
          'SELECT id FROM Logged_Sessions WHERE routine_id = ? AND start_time >= ? AND start_time <= ? LIMIT 1;',
          [activeRoutine.id, dayStart.getTime(), dayEnd.getTime()]
        );
      } else {
        if (i === 0 && todayAlreadyLogged) {
          // Today: show the completed workout
          const doneIdx = (completedSessionsCount - 1 + mappings.length) % mappings.length;
          const m = mappings[doneIdx];
          const workoutId = m ? resolveWorkoutId(m) : null;
          const w = workouts.find(wk => wk.id === workoutId);
          workoutName = w?.name || 'Rest Day';
          isRest = !workoutId;
          isDone = true;
        } else {
          // For projected days: slot index accounts for today being consumed if logged
          const slotIdx = todayAlreadyLogged ? i - 1 : i;
          const slot = asyncSeq[slotIdx];
          if (slot?.type === 'workout') {
            const workoutId = resolveWorkoutId(slot.mapping);
            if (workoutId) {
              const w = workouts.find(wk => wk.id === workoutId);
              workoutName = w?.name || 'Workout';
              isRest = false;
            }
          }
          // slot.type === 'rest' or missing → defaults to Rest Day (already set above)
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
  }, [activeRoutine, completedSessionsCount, refreshKey]);

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
