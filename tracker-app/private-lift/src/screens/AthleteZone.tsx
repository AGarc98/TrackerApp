import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useWorkout, generateId } from '../store/WorkoutContext';
import { DB } from '../database/db';
import { Workout, SetData, Routine, RoutineMode, ExerciseWithMuscle, ExerciseType } from '../types/database';
import { SettingsZone } from './SettingsZone';
import { RoutineSelector } from '../components/RoutineSelector';
import { BiometricsLogger } from '../components/BiometricsLogger';
import { useRestTimer } from '../hooks/useRestTimer';
import { WorkoutSelector } from '../components/WorkoutSelector';
import { ExerciseSelector } from '../components/ExerciseSelector';
import { ScheduleView } from '../components/ScheduleView';

const loadWorkoutExercises = (workoutId: string) => {
  const exResult = DB.getAll<any>(
    `SELECT we.*, e.name, e.description, e.type, e.default_rest_duration,
     e.last_modified as exercise_last_modified,
     (SELECT muscle_group FROM Exercise_Muscle_Groups WHERE exercise_id = e.id AND is_primary = 1 LIMIT 1) as muscle_group
     FROM Workout_Exercises we JOIN Exercises e ON we.exercise_id = e.id
     WHERE we.workout_id = ? ORDER BY we.order_index ASC;`,
    [workoutId]
  );
  return exResult.map((we: any) => ({
    exercise: {
      id: we.exercise_id,
      name: we.name,
      description: we.description,
      type: we.type,
      muscle_group: we.muscle_group,
      last_modified: we.exercise_last_modified,
      default_rest_duration: we.default_rest_duration || 90,
    } as ExerciseWithMuscle,
    target_sets: we.target_sets,
    target_reps: we.target_reps,
    target_weight: we.target_weight,
    target_time_ms: we.target_time_ms,
    target_distance: we.target_distance,
  }));
};

const Header = memo(({ showActivePill, onSettingsPress }: { showActivePill?: boolean; onSettingsPress: () => void }) => (
  <View className="px-6 pt-2 pb-4 bg-background">
    <View className="flex-row justify-between items-center">
      <View className="flex-row items-center space-x-3">
        <View className="w-8 h-8 bg-primary rounded-xl items-center justify-center rotate-6 shadow-md shadow-primary/20">
          <Text className="text-surface text-base font-black italic">L</Text>
        </View>
        <Text className="text-2xl font-black text-text-main tracking-tighter">Private Lift</Text>
      </View>
      <View className="flex-row items-center space-x-3">
        {showActivePill && (
          <View className="bg-success/10 px-3 py-1.5 rounded-full border border-success/20">
            <Text className="text-success text-[10px] font-black uppercase tracking-widest">Training</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={onSettingsPress}
          activeOpacity={0.7}
          className="bg-surface p-3 rounded-2xl shadow-sm border border-border"
        >
          <Text className="text-[10px] font-black text-text-muted uppercase tracking-[2px]">Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
));

const SetRow = memo(({
  set, 
  index, 
  unit, 
  exerciseType,
  onUpdate 
}: { 
  set: SetData, 
  index: number, 
  unit: string, 
  exerciseType?: ExerciseType,
  onUpdate: (updates: Partial<SetData>) => void 
}) => {
  const [localWeight, setLocalWeight] = useState(set.weight?.toString() || '');
  const [localReps, setLocalReps] = useState(set.reps?.toString() || '');
  const [localTime, setLocalTime] = useState(set.time_ms ? (set.time_ms / 1000).toString() : '');
  const [localDistance, setLocalDistance] = useState(set.distance?.toString() || '');

  useEffect(() => {
    setLocalWeight(set.weight?.toString() || '');
    setLocalReps(set.reps?.toString() || '');
    setLocalTime(set.time_ms ? (set.time_ms / 1000).toString() : '');
    setLocalDistance(set.distance?.toString() || '');
  }, [set.weight, set.reps, set.time_ms, set.distance]);

  const isEndurance = exerciseType === ExerciseType.ENDURANCE;

  return (
    <View className="mb-4">
      <View className="flex-row items-center">
        <View className={`w-12 h-12 rounded-[20px] justify-center items-center mr-4 shadow-sm ${
          set.is_completed ? 'bg-success' : 'bg-background border border-border'
        }`}>
          <Text className={`font-black text-base ${set.is_completed ? 'text-surface' : 'text-text-muted/30'}`}>
            {index + 1}
          </Text>
        </View>
        
        <View className="flex-1 flex-row space-x-3">
          {isEndurance ? (
            <>
              <View className="flex-1">
                <TextInput
                  className="bg-background border border-border rounded-2xl p-4 text-center font-black text-text-main text-lg"
                  placeholder="SEC"
                  placeholderTextColor="var(--color-text-muted)"
                  keyboardType="numeric"
                  value={localTime}
                  onChangeText={setLocalTime}
                  onBlur={() => onUpdate({ time_ms: (parseFloat(localTime) * 1000) || undefined })}
                />
              </View>
              <View className="flex-1">
                <TextInput
                  className="bg-background border border-border rounded-2xl p-4 text-center font-black text-text-main text-lg"
                  placeholder="DIST"
                  placeholderTextColor="var(--color-text-muted)"
                  keyboardType="numeric"
                  value={localDistance}
                  onChangeText={setLocalDistance}
                  onBlur={() => onUpdate({ distance: parseFloat(localDistance) || undefined })}
                />
              </View>
            </>
          ) : (
            <>
              <View className="flex-1">
                <TextInput
                  className="bg-background border border-border rounded-2xl p-4 text-center font-black text-text-main text-lg"
                  placeholder="REPS"
                  placeholderTextColor="var(--color-text-muted)"
                  keyboardType="numeric"
                  value={localReps}
                  onChangeText={setLocalReps}
                  onBlur={() => onUpdate({ reps: parseInt(localReps) || undefined })}
                />
              </View>
              <View className="flex-1">
                <View className="relative">
                  <TextInput
                    className="bg-background border border-border rounded-2xl p-4 text-center font-black text-text-main text-lg pr-10"
                    placeholder="0"
                    placeholderTextColor="var(--color-text-muted)"
                    keyboardType="numeric"
                    value={localWeight}
                    onChangeText={setLocalWeight}
                    onBlur={() => onUpdate({ weight: parseFloat(localWeight) || undefined })}
                  />
                  <View className="absolute right-3 top-0 bottom-0 justify-center pointer-events-none">
                    <Text className="text-[9px] font-black text-text-muted uppercase tracking-widest">{unit}</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity
          onPress={() => onUpdate({ is_completed: !set.is_completed })}
          activeOpacity={0.7}
          className={`w-14 h-14 rounded-2xl justify-center items-center ml-4 shadow-md ${
            set.is_completed ? 'bg-success shadow-success/20' : 'bg-surface border border-border'
          }`}
        >
          <Text className={`text-2xl font-black ${set.is_completed ? 'text-surface' : 'text-text-muted/25'}`}>✓</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const ExerciseItem = memo(({
  exerciseId,
  exercise,
  sets,
  onUpdateSet,
  onSwap,
  onAddSet,
  unit
}: {
  exerciseId: string,
  exercise?: ExerciseWithMuscle,
  sets: SetData[],
  onUpdateSet: (exerciseId: string, index: number, updates: Partial<SetData>) => void,
  onSwap: (exerciseId: string) => void,
  onAddSet: (exerciseId: string) => void,
  unit: string
}) => (
  <View className="bg-surface rounded-[40px] p-8 mb-6 shadow-sm border border-border">
    <View className="flex-row justify-between items-start mb-8">
      <View className="flex-1 mr-4">
        <Text className="text-2xl font-black text-text-main leading-tight mb-2 tracking-tighter">{exercise?.name || 'Unknown Movement'}</Text>
        <View className="flex-row flex-wrap gap-2">
          <View className="bg-background px-2 py-1 rounded-lg border border-border">
            <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">{exercise?.muscle_group || 'General'}</Text>
          </View>
          <View className="bg-primary-soft px-2 py-1 rounded-lg border border-primary/10">
            <Text className="text-[10px] font-black text-primary uppercase tracking-widest">{exercise?.type || 'Strength'}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onSwap(exerciseId)}
        className="bg-background px-4 py-3 rounded-2xl border border-border"
      >
        <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">Swap</Text>
      </TouchableOpacity>
    </View>

    {sets.map((set, index) => (
      <SetRow
        key={set.id}
        set={set}
        index={index}
        unit={unit}
        exerciseType={exercise?.type}
        onUpdate={(updates) => onUpdateSet(exerciseId, index, updates)}
      />
    ))}

    <TouchableOpacity
      onPress={() => onAddSet(exerciseId)}
      activeOpacity={0.6}
      className="mt-2 py-3 items-center"
    >
      <Text className="text-[10px] font-black text-text-muted/50 uppercase tracking-widest">+ Add Set</Text>
    </TouchableOpacity>
  </View>
));

export const AthleteZone = () => {
  const { activeSession, activeRoutineId, draftSets, logSet, startWorkout, finishWorkout, discardWorkout, swapExercise, settings, resumeWorkout, isLoading } = useWorkout();
  const [availableWorkouts, setAvailableWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<ExerciseWithMuscle[]>([]);
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [routineSelectorVisible, setRoutineSelectorVisible] = useState(false);
  const [workoutSelectorVisible, setWorkoutSelectorVisible] = useState(false);
  const [exerciseSelectorVisible, setExerciseSelectorVisible] = useState(false);
  const [exerciseToSwap, setExerciseToSwap] = useState<string | null>(null);
  const { timeLeft, isActive: isTimerActive, startTimer, stopTimer } = useRestTimer();
  const [routineProgress, setRoutineProgress] = useState({ completed: 0, total: 0 });
  const [rpeModalVisible, setRpeModalVisible] = useState(false);
  const [hasCheckedResume, setHasCheckedResume] = useState(false);
  const [workoutName, setWorkoutName] = useState('');

  useEffect(() => {
    loadInitialData();
  }, [activeRoutineId, activeSession]);

  useEffect(() => {
    if (isLoading || hasCheckedResume) return;
    setHasCheckedResume(true);
    if (activeSession) {
      Alert.alert(
        'Resume Workout?',
        'You have an unfinished session. What would you like to do?',
        [
          { text: 'Discard Session', style: 'destructive', onPress: () => discardWorkout() },
          { text: 'Resume', onPress: () => {} }
        ]
      );
    }
  }, [isLoading]);

  const exercisesById = useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises]);

  const loadInitialData = () => {
    const availableWorkouts = DB.getAll<Workout>('SELECT * FROM Workouts;');
    setAvailableWorkouts(availableWorkouts);
    
    const allExercises = DB.getAll<ExerciseWithMuscle>(`
      SELECT e.*, emg.muscle_group 
      FROM Exercises e 
      LEFT JOIN Exercise_Muscle_Groups emg ON e.id = emg.exercise_id AND emg.is_primary = 1;
    `);
    setExercises(allExercises);

    if (activeSession?.workout_id) {
      const w = DB.getOne<{ name: string }>('SELECT name FROM Workouts WHERE id = ?;', [activeSession.workout_id]);
      setWorkoutName(w?.name || '');
    } else {
      setWorkoutName('');
    }

    if (activeRoutineId) {
      const routine = DB.getOne<Routine>('SELECT * FROM Routines WHERE id = ?;', [activeRoutineId]);
      setActiveRoutine(routine);

      if (routine) {
        const total = DB.getOne<{ count: number }>('SELECT COUNT(*) as count FROM Routine_Workouts WHERE routine_id = ?;', [routine.id])?.count || 0;
        const completed = DB.getOne<{ count: number }>('SELECT COUNT(*) as count FROM Logged_Sessions WHERE routine_id = ?;', [routine.id])?.count || 0;
        setRoutineProgress({ completed, total });
      }
    } else {
      setActiveRoutine(null);
      setRoutineProgress({ completed: 0, total: 0 });
    }
  };

  const isRestDaySuggested = useMemo(() => {
    if (!activeRoutine || activeRoutine.mode !== RoutineMode.ASYNC) return false;
    return routineProgress.total > 0 && routineProgress.completed > 0 && routineProgress.completed % routineProgress.total === 0;
  }, [activeRoutine, routineProgress]);

  const handleStartDefault = async () => {
    let targetWorkout: Workout | null = null;
    let workoutExercises: { exercise: ExerciseWithMuscle; target_sets: number; target_reps: number | null }[] = [];

    if (activeRoutineId) {
      const routine = DB.getOne<Routine>('SELECT * FROM Routines WHERE id = ?;', [activeRoutineId]);
      
      if (routine?.mode === RoutineMode.WEEKLY) {
        const currentDayIndex = (new Date().getDay() + 6) % 7; // 0=Mon, 6=Sun
        const shiftedDayIndex = (currentDayIndex - (routine.start_day_index || 0) + 7) % 7;
        const mapping = DB.getOne<any>('SELECT * FROM Routine_Workouts WHERE routine_id = ? AND day_of_week = ?;', [activeRoutineId, shiftedDayIndex]);
        
        if (!mapping || !mapping.workout_id) {
          Alert.alert(
            'Rest Day',
            'Today is a rest day in your plan. Train anyway?',
            [
              { text: 'Rest', style: 'cancel' },
              { text: 'Train Anyway', onPress: () => setWorkoutSelectorVisible(true) }
            ]
          );
          return;
        }
        targetWorkout = DB.getOne<Workout>('SELECT * FROM Workouts WHERE id = ?;', [mapping.workout_id]);
      } else {
        // ASYNC or default fallback
        const mappings = DB.getAll<any>('SELECT * FROM Routine_Workouts WHERE routine_id = ? ORDER BY order_index ASC;', [activeRoutineId]);
        
        if (mappings.length > 0) {
          const nextIndex = routineProgress.completed % mappings.length;
          const nextMapping = mappings[nextIndex];

          if (!nextMapping.workout_id) {
            // Handle Rest Day in ASYNC (if any)
            Alert.alert(
              'Rest Day',
              'Next in your routine is a rest day. Skip it?',
              [
                { text: 'Rest', style: 'cancel' },
                { text: 'Skip It', onPress: () => setWorkoutSelectorVisible(true) }
              ]
            );
            return;
          }
          targetWorkout = DB.getOne<Workout>('SELECT * FROM Workouts WHERE id = ?;', [nextMapping.workout_id]);
        }
      }

      if (targetWorkout) {
        workoutExercises = loadWorkoutExercises(targetWorkout.id);
      }
    }

    if (!targetWorkout) {
      if (availableWorkouts.length === 0) {
        Alert.alert('Nothing Here', 'Add some workouts in the Vault first.');
        return;
      }
      setWorkoutSelectorVisible(true);
      return;
    }

    if (workoutExercises.length === 0) {
      Alert.alert('Empty Workout', 'Add exercises to this workout before starting.');
      return;
    }

    // For ASYNC routines, warn if a session was already logged today
    if (activeRoutineId && activeRoutine?.mode === RoutineMode.ASYNC) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCount = DB.getOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM Logged_Sessions WHERE routine_id = ? AND start_time >= ?;',
        [activeRoutineId, todayStart.getTime()]
      )?.count || 0;

      if (todayCount > 0) {
        Alert.alert(
          'Already Trained Today',
          "You've already logged a session today. Start another workout anyway?",
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Start Anyway', onPress: () => startWorkout(targetWorkout!, workoutExercises, activeRoutineId) }
          ]
        );
        return;
      }
    }

    await startWorkout(targetWorkout, workoutExercises, activeRoutineId);
  };

  const updateSet = useCallback((exerciseId: string, setIndex: number, updates: Partial<SetData>) => {
    const currentSets = draftSets[exerciseId] || [];
    const newSets = [...currentSets];
    const wasCompleted = newSets[setIndex].is_completed;
    newSets[setIndex] = { ...newSets[setIndex], ...updates };
    
    // Respect rest timer settings
    const autoStartEnabled = settings?.auto_start_rest_timer ?? true;
    const timerEnabled = settings?.rest_timer_enabled ?? true;

    if (!wasCompleted && newSets[setIndex].is_completed && timerEnabled && autoStartEnabled) {
      const exercise = exercisesById.get(exerciseId);
      startTimer(exercise?.default_rest_duration);
    }
    
    logSet(exerciseId, newSets);
  }, [draftSets, logSet, settings, startTimer, exercises]);

  const handleSwapTrigger = useCallback((exerciseId: string) => {
    setExerciseToSwap(exerciseId);
    setExerciseSelectorVisible(true);
  }, []);

  const handleAddSet = useCallback((exerciseId: string) => {
    const currentSets = draftSets[exerciseId] || [];
    const lastSet = currentSets[currentSets.length - 1];
    const newSet: SetData = {
      id: generateId().substring(0, 8),
      is_skipped: false,
      is_completed: false,
      reps: lastSet?.reps,
      weight: lastSet?.weight,
      time_ms: lastSet?.time_ms,
      distance: lastSet?.distance,
    };
    logSet(exerciseId, [...currentSets, newSet]);
  }, [draftSets, logSet]);

  if (!activeSession || (!hasCheckedResume && Platform.OS !== 'web')) {
    return (
      <View className="flex-1 bg-background">
        <Header onSettingsPress={() => setSettingsVisible(true)} />
        <ScrollView 
          contentContainerStyle={{ paddingVertical: 24, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {activeRoutine && (
            <ScheduleView 
              activeRoutine={activeRoutine} 
              completedSessionsCount={routineProgress.completed} 
            />
          )}

          <View className="mx-6 bg-surface p-10 rounded-[50px] shadow-2xl shadow-text-main/5 items-center border border-border">
            <Text className="text-3xl font-black text-text-main mb-2 tracking-tighter text-center">Athlete Zone</Text>
            <Text className="text-text-muted font-medium text-center mb-10 leading-5">
              Ready when you are. Start your routine or pick a workout below.
            </Text>
            
            {activeRoutine ? (
              <View className="items-center mb-10 bg-background/50 w-full py-8 rounded-[40px] border border-border">
                <Text className="text-primary font-black uppercase tracking-widest text-[10px] mb-2">Active Routine</Text>
                <Text className="text-text-main font-black text-2xl mb-1">{activeRoutine.name}</Text>
                <Text className="text-text-muted font-bold text-xs uppercase tracking-widest">{activeRoutine.cycle_count} cycles completed</Text>
                
                <View className="flex-row space-x-3 mt-8">
                  <TouchableOpacity 
                    onPress={() => setRoutineSelectorVisible(true)}
                    className="bg-surface px-5 py-3 rounded-2xl border border-border shadow-sm"
                  >
                    <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">Change Routine</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setWorkoutSelectorVisible(true)}
                    className="bg-surface px-5 py-3 rounded-2xl border border-border shadow-sm"
                  >
                    <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">Choose Workout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="items-center mb-10">
                <TouchableOpacity 
                  onPress={() => setRoutineSelectorVisible(true)}
                  className="bg-primary px-10 py-5 rounded-[28px] shadow-xl shadow-primary/20"
                >
                  <Text className="text-surface font-black uppercase tracking-[3px] text-xs text-center">Set Up a Routine</Text>
                </TouchableOpacity>
              </View>
            )}

            {isRestDaySuggested && (
              <View className="bg-accent-soft p-5 rounded-[32px] border border-accent/20 mb-8 w-full flex-row items-center">
                <View className="w-10 h-10 bg-accent/10 rounded-2xl items-center justify-center mr-4">
                  <Text className="text-lg">🔋</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-accent font-black uppercase tracking-widest text-[10px] mb-0.5">Rest Day</Text>
                  <Text className="text-text-main font-bold text-xs">You've finished a full cycle — consider a rest day.</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleStartDefault}
              activeOpacity={0.8}
              className="bg-text-main w-full py-6 rounded-[32px] shadow-2xl shadow-text-main/20"
            >
              <Text className="text-background text-lg font-black text-center uppercase tracking-[4px]">
                Start Workout
              </Text>
            </TouchableOpacity>
          </View>

          <BiometricsLogger />
        </ScrollView>

        <Modal visible={routineSelectorVisible} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-background pt-4">
            <View className="flex-row justify-end px-6">
              <TouchableOpacity onPress={() => setRoutineSelectorVisible(false)} className="bg-background border border-border px-4 py-2 rounded-full">
                <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Cancel</Text>
              </TouchableOpacity>
            </View>
            <RoutineSelector onClose={() => setRoutineSelectorVisible(false)} />
          </View>
        </Modal>

        <Modal visible={workoutSelectorVisible} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-background pt-4">
            <View className="flex-row justify-end px-6">
              <TouchableOpacity onPress={() => setWorkoutSelectorVisible(false)} className="bg-background border border-border px-4 py-2 rounded-full">
                <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Cancel</Text>
              </TouchableOpacity>
            </View>
            <WorkoutSelector
              routineId={activeRoutineId}
              onSelect={async (workout, exercises) => {
                setWorkoutSelectorVisible(false);
                await startWorkout(workout, exercises, activeRoutineId);
              }}
              onClose={() => setWorkoutSelectorVisible(false)}
            />
          </View>
        </Modal>

        <Modal visible={settingsVisible} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-background pt-4">
            <View className="flex-row justify-end px-6">
              <TouchableOpacity onPress={() => setSettingsVisible(false)} className="bg-background border border-border px-4 py-2 rounded-full">
                <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Close</Text>
              </TouchableOpacity>
            </View>
            <SettingsZone />
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Header showActivePill onSettingsPress={() => setSettingsVisible(true)} />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 p-4 pt-4" showsVerticalScrollIndicator={false}>
          <Text className="text-xs font-black text-text-muted uppercase tracking-[4px] ml-4 mb-1">Now Training</Text>
          {workoutName ? (
            <Text className="text-xl font-black text-text-main ml-4 mb-4 tracking-tighter">{workoutName}</Text>
          ) : <View className="mb-4" />}
          {Object.entries(draftSets).map(([exerciseId, sets]) => (
            <ExerciseItem
              key={exerciseId}
              exerciseId={exerciseId}
              exercise={exercises.find(e => e.id === exerciseId)}
              sets={sets}
              onUpdateSet={updateSet}
              onSwap={handleSwapTrigger}
              onAddSet={handleAddSet}
              unit={settings?.weight_unit || 'KG'}
            />
          ))}
          <View className="h-40" />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Timer Overlay */}
      {isTimerActive && (
        <TouchableOpacity 
          onPress={stopTimer}
          activeOpacity={0.9}
          className="absolute bottom-40 self-center bg-primary px-10 py-5 rounded-full shadow-2xl shadow-primary/30 flex-row items-center space-x-4 border-4 border-surface"
        >
          <View className="w-2.5 h-2.5 bg-surface rounded-full" style={{ opacity: 0.8 }} />
          <Text className="text-surface font-black text-xl tabular-nums tracking-widest">REST: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</Text>
          <Text className="text-surface/60 font-black text-[10px] uppercase tracking-widest ml-4">Dismiss</Text>
        </TouchableOpacity>
      )}

      <View className="px-8 py-8 bg-surface/80 border-t border-border flex-row space-x-5 backdrop-blur-md">
        <TouchableOpacity
          onPress={discardWorkout}
          activeOpacity={0.7}
          className="flex-1 bg-background py-6 rounded-[28px] items-center border border-border"
        >
          <Text className="text-text-muted font-black uppercase tracking-[2px] text-xs">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setRpeModalVisible(true)}
          activeOpacity={0.8}
          className="flex-[2] bg-text-main py-6 rounded-[28px] items-center shadow-2xl shadow-text-main/20"
        >
          <Text className="text-background font-black uppercase tracking-[4px] text-xs">Finish Workout</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={rpeModalVisible} animationType="fade" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-surface rounded-t-[40px] px-8 pt-8 pb-12">
            <Text className="text-2xl font-black text-text-main tracking-tighter text-center mb-1">How intense was that?</Text>
            <Text className="text-text-muted font-bold text-sm text-center mb-8">Rate the session  1 – 10</Text>
            {([1,2,3,4,5,6,7,8,9,10] as const).reduce<number[][]>((rows, n, i) => {
              if (i % 5 === 0) rows.push([]);
              rows[rows.length - 1].push(n);
              return rows;
            }, []).map((row, rowIndex) => (
              <View key={rowIndex} className="flex-row justify-center space-x-3 mb-3">
                {row.map((n) => {
                  const color = n <= 3 ? 'bg-success' : n <= 6 ? 'bg-accent' : n <= 9 ? 'bg-warning' : 'bg-error';
                  return (
                    <TouchableOpacity
                      key={n}
                      onPress={() => { finishWorkout(n); setRpeModalVisible(false); }}
                      activeOpacity={0.75}
                      className={`w-14 h-14 rounded-2xl items-center justify-center shadow-sm ${color}`}
                    >
                      <Text className="text-surface text-lg font-black">{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <TouchableOpacity
              onPress={() => { finishWorkout(undefined); setRpeModalVisible(false); }}
              activeOpacity={0.6}
              className="mt-6 py-3 items-center"
            >
              <Text className="text-text-muted font-black text-xs uppercase tracking-widest">Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={settingsVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background pt-4">
          <View className="flex-row justify-end px-6">
            <TouchableOpacity onPress={() => setSettingsVisible(false)} className="bg-background border border-border px-4 py-2 rounded-full">
              <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Close</Text>
            </TouchableOpacity>
          </View>
          <SettingsZone />
        </View>
      </Modal>

      <Modal visible={exerciseSelectorVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background pt-4">
          <View className="flex-row justify-end px-6">
            <TouchableOpacity 
              onPress={() => {
                setExerciseSelectorVisible(false);
                setExerciseToSwap(null);
              }} 
              className="bg-background border border-border px-4 py-2 rounded-full"
            >
              <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Cancel</Text>
            </TouchableOpacity>
          </View>
          <ExerciseSelector 
            exercises={exercises}
            excludeIds={Object.keys(draftSets)}
            onSelect={async (newExercise) => {
              if (exerciseToSwap) {
                await swapExercise(exerciseToSwap, newExercise.id);
                setExerciseSelectorVisible(false);
                setExerciseToSwap(null);
              }
            }}
            onClose={() => {
              setExerciseSelectorVisible(false);
              setExerciseToSwap(null);
            }}
          />
        </View>
      </Modal>
    </View>
  );
};
