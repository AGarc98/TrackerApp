import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useWorkout } from '../store/WorkoutContext';
import { DB } from '../database/db';
import { Exercise, Workout, SetData, Routine, RoutineMode, MuscleGroup, ExerciseWithMuscle } from '../types/database';
import { SettingsZone } from './SettingsZone';
import { RoutineSelector } from '../components/RoutineSelector';
import { BiometricsLogger } from '../components/BiometricsLogger';
import { useRestTimer } from '../hooks/useRestTimer';
import { WorkoutSelector } from '../components/WorkoutSelector';
import { ExerciseSelector } from '../components/ExerciseSelector';

const SetRow = memo(({ 
  set, 
  index, 
  unit, 
  onUpdate 
}: { 
  set: SetData, 
  index: number, 
  unit: string, 
  onUpdate: (updates: Partial<SetData>) => void 
}) => {
  const [localWeight, setLocalWeight] = useState(set.weight?.toString() || '');
  const [localReps, setLocalReps] = useState(set.reps?.toString() || '');

  // Keep local state in sync with external changes (e.g. from DB)
  useEffect(() => {
    setLocalWeight(set.weight?.toString() || '');
    setLocalReps(set.reps?.toString() || '');
  }, [set.weight, set.reps]);

  return (
    <View className="flex-row items-center mb-4">
      <View className={`w-12 h-12 rounded-[20px] justify-center items-center mr-4 shadow-sm ${
        set.is_completed ? 'bg-success' : 'bg-background border border-border'
      }`}>
        <Text className={`font-black text-base ${set.is_completed ? 'text-surface' : 'text-text-muted/30'}`}>
          {index + 1}
        </Text>
      </View>
      
      <View className="flex-1 flex-row space-x-3">
        <View className="flex-1">
          <TextInput
            className="bg-background border border-border rounded-2xl p-4 text-center font-black text-text-main text-lg"
            placeholder={unit}
            placeholderTextColor="var(--color-text-muted)"
            keyboardType="numeric"
            value={localWeight}
            onChangeText={setLocalWeight}
            onBlur={() => onUpdate({ weight: parseFloat(localWeight) || undefined })}
          />
        </View>
        
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
      </View>

      <TouchableOpacity
        onPress={() => {
          const newCompleted = !set.is_completed;
          onUpdate({ is_completed: newCompleted });
        }}
        activeOpacity={0.7}
        className={`w-14 h-14 rounded-2xl justify-center items-center ml-4 shadow-md ${
          set.is_completed ? 'bg-success shadow-success/20' : 'bg-surface border border-border'
        }`}
      >
        <Text className="text-surface text-2xl font-black">{set.is_completed ? '✓' : ''}</Text>
      </TouchableOpacity>
    </View>
  );
});

const ExerciseItem = memo(({ 
  exerciseId, 
  exercise, 
  sets, 
  onUpdateSet, 
  onSwap, 
  unit 
}: { 
  exerciseId: string, 
  exercise?: ExerciseWithMuscle, 
  sets: SetData[], 
  onUpdateSet: (exerciseId: string, index: number, updates: Partial<SetData>) => void,
  onSwap: (exerciseId: string) => void,
  unit: string
}) => (
  <View className="bg-surface rounded-[40px] p-8 mb-6 shadow-sm border border-border">
    <View className="flex-row justify-between items-start mb-8">
      <View className="flex-1 mr-4">
        <Text className="text-2xl font-black text-text-main leading-tight mb-2 tracking-tighter">{exercise?.name || 'Unknown Movement'}</Text>
        <View className="bg-background self-start px-2 py-1 rounded-lg border border-border">
          <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">{exercise?.muscle_group || 'General'}</Text>
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
        onUpdate={(updates) => onUpdateSet(exerciseId, index, updates)} 
      />
    ))}
  </View>
));

export const AthleteZone = () => {
  const { activeSession, activeRoutineId, draftSets, logSet, startWorkout, finishWorkout, discardWorkout, swapExercise, settings, resumeWorkout } = useWorkout();
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
  const [hasCheckedResume, setHasCheckedResume] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [activeRoutineId, activeSession]);

  useEffect(() => {
    if (!hasCheckedResume && activeSession) {
      Alert.alert(
        'Incomplete Session',
        'An active session was found from your last deployment. Resume training?',
        [
          { text: 'Discard', style: 'destructive', onPress: () => discardWorkout() },
          { text: 'Resume', onPress: () => setHasCheckedResume(true) }
        ]
      );
      setHasCheckedResume(true);
    }
  }, [activeSession, hasCheckedResume]);

  const loadInitialData = async () => {
    const availableWorkouts = DB.getAll<Workout>('SELECT * FROM Workouts;');
    setAvailableWorkouts(availableWorkouts);
    
    const allExercises = DB.getAll<ExerciseWithMuscle>(`
      SELECT e.*, emg.muscle_group 
      FROM Exercises e 
      LEFT JOIN Exercise_Muscle_Groups emg ON e.id = emg.exercise_id AND emg.is_primary = 1;
    `);
    setExercises(allExercises);

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
      const mappings = DB.getAll<any>('SELECT * FROM Routine_Workouts WHERE routine_id = ? ORDER BY order_index ASC;', [activeRoutineId]);
      
      if (mappings.length > 0) {
        const nextIndex = routineProgress.completed % mappings.length;
        const nextMapping = mappings[nextIndex];
        targetWorkout = DB.getOne<Workout>('SELECT * FROM Workouts WHERE id = ?;', [nextMapping.workout_id]);

        if (targetWorkout) {
          const exResult = DB.getAll<any>('SELECT we.*, e.name, e.description, e.type, e.default_rest_duration, e.last_modified as exercise_last_modified, emg.muscle_group FROM Workout_Exercises we JOIN Exercises e ON we.exercise_id = e.id LEFT JOIN Exercise_Muscle_Groups emg ON e.id = emg.exercise_id AND emg.is_primary = 1 WHERE we.workout_id = ? ORDER BY we.order_index ASC;', [targetWorkout.id]);
          workoutExercises = exResult.map((we: any) => ({
            exercise: {
              id: we.exercise_id,
              name: we.name,
              description: we.description,
              type: we.type,
              muscle_group: we.muscle_group,
              last_modified: we.exercise_last_modified,
              default_rest_duration: we.default_rest_duration || 90
            } as ExerciseWithMuscle,
            target_sets: we.target_sets,
            target_reps: we.target_reps
          }));
        }
      }
    }

    if (!targetWorkout || workoutExercises.length === 0) {
      targetWorkout = availableWorkouts[0];
      if (!targetWorkout) {
        Alert.alert('Vault Empty', 'Architect some workouts and routines first.');
        return;
      }
      const exResult = DB.getAll<any>('SELECT we.*, e.name, e.description, e.type, e.default_rest_duration, e.last_modified as exercise_last_modified, emg.muscle_group FROM Workout_Exercises we JOIN Exercises e ON we.exercise_id = e.id LEFT JOIN Exercise_Muscle_Groups emg ON e.id = emg.exercise_id AND emg.is_primary = 1 WHERE we.workout_id = ? ORDER BY we.order_index ASC;', [targetWorkout.id]);
      workoutExercises = exResult.map((we: any) => ({
        exercise: {
          id: we.exercise_id,
          name: we.name,
          description: we.description,
          type: we.type,
          muscle_group: we.muscle_group,
          last_modified: we.exercise_last_modified,
          default_rest_duration: we.default_rest_duration || 90
        } as ExerciseWithMuscle,
        target_sets: we.target_sets,
        target_reps: we.target_reps
      }));
    }

    if (workoutExercises.length === 0) {
      Alert.alert('Empty Workout', 'This workout has no exercises assigned.');
      return;
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
      const exercise = exercises.find(e => e.id === exerciseId);
      startTimer(exercise?.default_rest_duration);
    }
    
    logSet(exerciseId, newSets);
  }, [draftSets, logSet, settings, startTimer, exercises]);

  const handleSwapTrigger = useCallback((exerciseId: string) => {
    setExerciseToSwap(exerciseId);
    setExerciseSelectorVisible(true);
  }, []);

  const Header = ({ showActivePill }: { showActivePill?: boolean }) => (
    <View className="px-6 pt-6 pb-4 bg-background">
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
            onPress={() => setSettingsVisible(true)}
            activeOpacity={0.7}
            className="bg-surface p-3 rounded-2xl shadow-sm border border-border"
          >
            <Text className="text-[10px] font-black text-text-muted uppercase tracking-[2px]">Vault</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (!activeSession || (!hasCheckedResume && Platform.OS !== 'web')) {
    return (
      <View className="flex-1 bg-background">
        <Header />
        <ScrollView 
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-surface p-10 rounded-[50px] shadow-2xl shadow-text-main/5 items-center border border-border w-full mb-8">
            <Text className="text-3xl font-black text-text-main mb-2 tracking-tighter text-center">Athlete Zone</Text>
            <Text className="text-text-muted font-medium text-center mb-10 leading-5">
              Vault initialized. Prepared to execute next performance directive.
            </Text>
            
            {activeRoutine ? (
              <View className="items-center mb-10 bg-background/50 w-full py-8 rounded-[40px] border border-border">
                <Text className="text-primary font-black uppercase tracking-widest text-[10px] mb-2">Primary Blueprint</Text>
                <Text className="text-text-main font-black text-2xl mb-1">{activeRoutine.name}</Text>
                <Text className="text-text-muted font-bold text-xs uppercase tracking-widest">Sequence: {activeRoutine.cycle_count} Cycles Complete</Text>
                
                <View className="flex-row space-x-3 mt-8">
                  <TouchableOpacity 
                    onPress={() => setRoutineSelectorVisible(true)}
                    className="bg-surface px-5 py-3 rounded-2xl border border-border shadow-sm"
                  >
                    <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">Adjust Plan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setWorkoutSelectorVisible(true)}
                    className="bg-surface px-5 py-3 rounded-2xl border border-border shadow-sm"
                  >
                    <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">Swap Next</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="items-center mb-10">
                <TouchableOpacity 
                  onPress={() => setRoutineSelectorVisible(true)}
                  className="bg-primary px-10 py-5 rounded-[28px] shadow-xl shadow-primary/20"
                >
                  <Text className="text-surface font-black uppercase tracking-[3px] text-xs text-center">Load Training Blueprint</Text>
                </TouchableOpacity>
              </View>
            )}

            {isRestDaySuggested && (
              <View className="bg-accent-soft p-5 rounded-[32px] border border-accent/20 mb-8 w-full flex-row items-center">
                <View className="w-10 h-10 bg-accent/10 rounded-2xl items-center justify-center mr-4">
                  <Text className="text-lg">🔋</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-accent font-black uppercase tracking-widest text-[10px] mb-0.5">Recovery Protocol</Text>
                  <Text className="text-text-main font-bold text-xs">Rest day suggested before next cycle.</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleStartDefault}
              activeOpacity={0.8}
              className="bg-text-main w-full py-6 rounded-[32px] shadow-2xl shadow-text-main/20"
            >
              <Text className="text-background text-lg font-black text-center uppercase tracking-[4px]">
                {activeRoutine ? 'Initiate Session' : 'Quick Start'}
              </Text>
            </TouchableOpacity>
          </View>

          <BiometricsLogger />
        </ScrollView>

        <Modal visible={settingsVisible} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-background pt-4">
            <View className="flex-row justify-end px-6">
              <TouchableOpacity onPress={() => setSettingsVisible(false)} className="bg-background border border-border px-4 py-2 rounded-full">
                <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Close Vault</Text>
              </TouchableOpacity>
            </View>
            <SettingsZone />
          </View>
        </Modal>

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
            {activeRoutineId && (
              <WorkoutSelector 
                routineId={activeRoutineId} 
                onSelect={async (workout, exercises) => {
                  setWorkoutSelectorVisible(false);
                  await startWorkout(workout, exercises, activeRoutineId);
                }} 
                onClose={() => setWorkoutSelectorVisible(false)} 
              />
            )}
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Header showActivePill />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 p-4 pt-4" showsVerticalScrollIndicator={false}>
          <Text className="text-xs font-black text-text-muted uppercase tracking-[4px] ml-4 mb-4">Training Directive</Text>
          {Object.entries(draftSets).map(([exerciseId, sets]) => (
            <ExerciseItem 
              key={exerciseId}
              exerciseId={exerciseId}
              exercise={exercises.find(e => e.id === exerciseId)}
              sets={sets}
              onUpdateSet={updateSet}
              onSwap={handleSwapTrigger}
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
          <Text className="text-text-muted font-black uppercase tracking-[2px] text-xs">Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={finishWorkout}
          activeOpacity={0.8}
          className="flex-[2] bg-text-main py-6 rounded-[28px] items-center shadow-2xl shadow-text-main/20"
        >
          <Text className="text-background font-black uppercase tracking-[4px] text-xs">Commit Session</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={settingsVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background pt-4">
          <View className="flex-row justify-end px-6">
            <TouchableOpacity onPress={() => setSettingsVisible(false)} className="bg-background border border-border px-4 py-2 rounded-full">
              <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Close Vault</Text>
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
