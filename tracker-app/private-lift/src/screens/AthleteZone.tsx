import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useWorkout } from '../store/WorkoutContext';
import { query } from '../database/db';
import { Exercise, Workout, SetData, Routine, RoutineMode } from '../types/database';
import { SettingsZone } from './SettingsZone';
import { RoutineSelector } from '../components/RoutineSelector';
import { BiometricsLogger } from '../components/BiometricsLogger';
import { useRestTimer } from '../hooks/useRestTimer';
import { WorkoutSelector } from '../components/WorkoutSelector';
import { ExerciseSelector } from '../components/ExerciseSelector';

const ExerciseItem = memo(({ 
  exerciseId, 
  exercise, 
  sets, 
  onUpdateSet, 
  onSwap, 
  unit 
}: { 
  exerciseId: string, 
  exercise?: Exercise, 
  sets: SetData[], 
  onUpdateSet: (exerciseId: string, index: number, updates: Partial<SetData>) => void,
  onSwap: (exerciseId: string) => void,
  unit: string
}) => (
  <View className="bg-white rounded-[40px] p-8 mb-6 shadow-sm border border-slate-100">
    <View className="flex-row justify-between items-start mb-8">
      <View className="flex-1 mr-4">
        <Text className="text-2xl font-black text-slate-900 leading-tight mb-2 tracking-tighter">{exercise?.name || 'Unknown Movement'}</Text>
        <View className="bg-slate-50 self-start px-2 py-1 rounded-lg border border-slate-100">
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{exercise?.muscle_group || 'General'}</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onSwap(exerciseId)}
        className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100"
      >
        <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Swap</Text>
      </TouchableOpacity>
    </View>
    
    {sets.map((set, index) => (
      <View key={set.id} className="flex-row items-center mb-4">
        <View className={`w-12 h-12 rounded-[20px] justify-center items-center mr-4 shadow-sm ${
          set.is_completed ? 'bg-green-500' : 'bg-slate-50 border border-slate-100'
        }`}>
          <Text className={`font-black text-base ${set.is_completed ? 'text-white' : 'text-slate-300'}`}>
            {index + 1}
          </Text>
        </View>
        
        <View className="flex-1 flex-row space-x-3">
          <View className="flex-1">
            <TextInput
              className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center font-black text-slate-900 text-lg"
              placeholder={unit}
              keyboardType="numeric"
              value={set.weight?.toString()}
              onChangeText={(v) => onUpdateSet(exerciseId, index, { weight: parseFloat(v) || undefined })}
            />
          </View>
          
          <View className="flex-1">
            <TextInput
              className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center font-black text-slate-900 text-lg"
              placeholder="REPS"
              keyboardType="numeric"
              value={set.reps?.toString()}
              onChangeText={(v) => onUpdateSet(exerciseId, index, { reps: parseInt(v) || undefined })}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={() => onUpdateSet(exerciseId, index, { is_completed: !set.is_completed })}
          activeOpacity={0.7}
          className={`w-14 h-14 rounded-2xl justify-center items-center ml-4 shadow-md ${
            set.is_completed ? 'bg-green-600 shadow-green-200' : 'bg-white border border-slate-200'
          }`}
        >
          <Text className="text-white text-2xl font-black">{set.is_completed ? '✓' : ''}</Text>
        </TouchableOpacity>
      </View>
    ))}
  </View>
));

export const AthleteZone = () => {
  const { activeSession, activeRoutineId, draftSets, logSet, startWorkout, finishWorkout, discardWorkout, swapExercise, settings, resumeWorkout } = useWorkout();
  const [availableWorkouts, setAvailableWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
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
    const wResult = query('SELECT * FROM Workouts;') as any;
    setAvailableWorkouts(wResult.rows?._array || []);
    
    const eResult = query('SELECT * FROM Exercises;')as any;
    setExercises(eResult.rows?._array || []);

    if (activeRoutineId) {
      const rResult = query('SELECT * FROM Routines WHERE id = ?;', [activeRoutineId]) as any;
      const routine = rResult.rows?._array[0] || null;
      setActiveRoutine(routine);

      if (routine) {
        const countRes = query('SELECT COUNT(*) as count FROM Routine_Workouts WHERE routine_id = ?;', [routine.id]) as any;
        const total = countRes.rows?._array[0]?.count || 0;
        const loggedRes = query('SELECT COUNT(*) as count FROM Logged_Sessions WHERE routine_id = ?;', [routine.id]) as any;
        const completed = loggedRes.rows?._array[0]?.count || 0;
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
    let workoutExercises: { exercise: Exercise; target_sets: number; target_reps: number }[] = [];

    if (activeRoutineId) {
      const mappingsResult = query('SELECT * FROM Routine_Workouts WHERE routine_id = ? ORDER BY order_index ASC;', [activeRoutineId]) as any;
      const mappings = mappingsResult.rows?._array || [];
      
      if (mappings.length > 0) {
        const nextIndex = routineProgress.completed % mappings.length;
        const nextMapping = mappings[nextIndex];
        const workoutResult = query('SELECT * FROM Workouts WHERE id = ?;', [nextMapping.workout_id]) as any;
        targetWorkout = workoutResult.rows?._array[0] || null;

        if (targetWorkout) {
          const exResult = query('SELECT we.*, e.name, e.description, e.type, e.muscle_group, e.is_base_content, e.last_modified FROM Workout_Exercises we JOIN Exercises e ON we.exercise_id = e.id WHERE we.workout_id = ? ORDER BY we.order_index ASC;', [targetWorkout.id]) as any;
          workoutExercises = (exResult.rows?._array || []).map((we: any) => ({
            exercise: {
              id: we.exercise_id,
              name: we.name,
              description: we.description,
              type: we.type,
              muscle_group: we.muscle_group,
              is_base_content: !!we.is_base_content,
              last_modified: we.last_modified
            } as Exercise,
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
      const exResult = query('SELECT we.*, e.name, e.description, e.type, e.muscle_group, e.is_base_content, e.last_modified FROM Workout_Exercises we JOIN Exercises e ON we.exercise_id = e.id WHERE we.workout_id = ? ORDER BY we.order_index ASC;', [targetWorkout.id]) as any;
      workoutExercises = (exResult.rows?._array || []).map((we: any) => ({
        exercise: {
          id: we.exercise_id,
          name: we.name,
          description: we.description,
          type: we.type,
          muscle_group: we.muscle_group,
          is_base_content: !!we.is_base_content,
          last_modified: we.last_modified
        } as Exercise,
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
    
    if (!wasCompleted && newSets[setIndex].is_completed && settings?.rest_timer_enabled) {
      startTimer();
    }
    
    logSet(exerciseId, newSets);
  }, [draftSets, logSet, settings?.rest_timer_enabled, startTimer]);

  const handleSwapTrigger = useCallback((exerciseId: string) => {
    setExerciseToSwap(exerciseId);
    setExerciseSelectorVisible(true);
  }, []);

  const Header = ({ showActivePill }: { showActivePill?: boolean }) => (
    <View className="px-6 pt-6 pb-4 bg-slate-50">
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center space-x-3">
          <View className="w-8 h-8 bg-blue-600 rounded-xl items-center justify-center rotate-6 shadow-md shadow-blue-200">
            <Text className="text-white text-base font-black italic">L</Text>
          </View>
          <Text className="text-2xl font-black text-slate-900 tracking-tighter">Private Lift</Text>
        </View>
        
        <View className="flex-row items-center space-x-3">
          {showActivePill && (
            <View className="bg-green-100 px-3 py-1.5 rounded-full border border-green-200">
              <Text className="text-green-700 text-[10px] font-black uppercase tracking-widest">Training</Text>
            </View>
          )}
          <TouchableOpacity 
            onPress={() => setSettingsVisible(true)}
            activeOpacity={0.7}
            className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100"
          >
            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Vault</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (!activeSession || (!hasCheckedResume && Platform.OS !== 'web')) {
    return (
      <View className="flex-1 bg-slate-50">
        <Header />
        <ScrollView 
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-white p-10 rounded-[50px] shadow-2xl shadow-slate-200 items-center border border-slate-100 w-full mb-8">
            <Text className="text-3xl font-black text-slate-900 mb-2 tracking-tighter text-center">Athlete Zone</Text>
            <Text className="text-slate-400 font-medium text-center mb-10 leading-5">
              Vault initialized. Prepared to execute next performance directive.
            </Text>
            
            {activeRoutine ? (
              <View className="items-center mb-10 bg-slate-50/50 w-full py-8 rounded-[40px] border border-slate-50">
                <Text className="text-blue-600 font-black uppercase tracking-widest text-[10px] mb-2">Primary Blueprint</Text>
                <Text className="text-slate-900 font-black text-2xl mb-1">{activeRoutine.name}</Text>
                <Text className="text-slate-400 font-bold text-xs uppercase tracking-widest">Sequence: {activeRoutine.cycle_count} Cycles Complete</Text>
                
                <View className="flex-row space-x-3 mt-8">
                  <TouchableOpacity 
                    onPress={() => setRoutineSelectorVisible(true)}
                    className="bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm"
                  >
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjust Plan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setWorkoutSelectorVisible(true)}
                    className="bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm"
                  >
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Swap Next</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="items-center mb-10">
                <TouchableOpacity 
                  onPress={() => setRoutineSelectorVisible(true)}
                  className="bg-blue-600 px-10 py-5 rounded-[28px] shadow-xl shadow-blue-200"
                >
                  <Text className="text-white font-black uppercase tracking-[3px] text-xs text-center">Load Training Blueprint</Text>
                </TouchableOpacity>
              </View>
            )}

            {isRestDaySuggested && (
              <View className="bg-amber-50 p-5 rounded-[32px] border border-amber-100 mb-8 w-full flex-row items-center">
                <View className="w-10 h-10 bg-amber-100 rounded-2xl items-center justify-center mr-4">
                  <Text className="text-lg">🔋</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-amber-800 font-black uppercase tracking-widest text-[10px] mb-0.5">Recovery Protocol</Text>
                  <Text className="text-amber-900 font-bold text-xs">Rest day suggested before next cycle.</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleStartDefault}
              activeOpacity={0.8}
              className="bg-slate-900 w-full py-6 rounded-[32px] shadow-2xl shadow-slate-300"
            >
              <Text className="text-white text-lg font-black text-center uppercase tracking-[4px]">
                {activeRoutine ? 'Initiate Session' : 'Quick Start'}
              </Text>
            </TouchableOpacity>
          </View>

          <BiometricsLogger />
        </ScrollView>

        <Modal visible={settingsVisible} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-slate-50 pt-4">
            <View className="flex-row justify-end px-6">
              <TouchableOpacity onPress={() => setSettingsVisible(false)} className="bg-slate-200/50 px-4 py-2 rounded-full">
                <Text className="text-xs font-black text-slate-500 uppercase tracking-widest">Close Vault</Text>
              </TouchableOpacity>
            </View>
            <SettingsZone />
          </View>
        </Modal>

        <Modal visible={routineSelectorVisible} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-slate-50 pt-4">
            <View className="flex-row justify-end px-6">
              <TouchableOpacity onPress={() => setRoutineSelectorVisible(false)} className="bg-slate-200/50 px-4 py-2 rounded-full">
                <Text className="text-xs font-black text-slate-500 uppercase tracking-widest">Cancel</Text>
              </TouchableOpacity>
            </View>
            <RoutineSelector onClose={() => setRoutineSelectorVisible(false)} />
          </View>
        </Modal>

        <Modal visible={workoutSelectorVisible} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-slate-50 pt-4">
            <View className="flex-row justify-end px-6">
              <TouchableOpacity onPress={() => setWorkoutSelectorVisible(false)} className="bg-slate-200/50 px-4 py-2 rounded-full">
                <Text className="text-xs font-black text-slate-500 uppercase tracking-widest">Cancel</Text>
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
    <View className="flex-1 bg-slate-50">
      <Header showActivePill />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 p-4 pt-4" showsVerticalScrollIndicator={false}>
          <Text className="text-xs font-black text-slate-400 uppercase tracking-[4px] ml-4 mb-4">Training Directive</Text>
          {Object.entries(draftSets).map(([exerciseId, sets]) => (
            <ExerciseItem 
              key={exerciseId}
              exerciseId={exerciseId}
              exercise={exercises.find(e => e.id === exerciseId)}
              sets={sets}
              onUpdateSet={updateSet}
              onSwap={handleSwapTrigger}
              unit={settings?.unit_system || 'KG'}
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
          className="absolute bottom-40 self-center bg-blue-600 px-10 py-5 rounded-full shadow-2xl shadow-blue-300 flex-row items-center space-x-4 border-4 border-white"
        >
          <View className="w-2.5 h-2.5 bg-white rounded-full" style={{ opacity: 0.8 }} />
          <Text className="text-white font-black text-xl tabular-nums tracking-widest">REST: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</Text>
          <Text className="text-blue-200 font-black text-[10px] uppercase tracking-widest ml-4">Dismiss</Text>
        </TouchableOpacity>
      )}

      <View className="px-8 py-8 bg-white/80 border-t border-slate-100 flex-row space-x-5 backdrop-blur-md">
        <TouchableOpacity
          onPress={discardWorkout}
          activeOpacity={0.7}
          className="flex-1 bg-slate-50 py-6 rounded-[28px] items-center border border-slate-100"
        >
          <Text className="text-slate-400 font-black uppercase tracking-[2px] text-xs">Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={finishWorkout}
          activeOpacity={0.8}
          className="flex-[2] bg-slate-900 py-6 rounded-[28px] items-center shadow-2xl shadow-slate-400"
        >
          <Text className="text-white font-black uppercase tracking-[4px] text-xs">Commit Session</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={settingsVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-slate-50 pt-4">
          <View className="flex-row justify-end px-6">
            <TouchableOpacity onPress={() => setSettingsVisible(false)} className="bg-slate-200/50 px-4 py-2 rounded-full">
              <Text className="text-xs font-black text-slate-500 uppercase tracking-widest">Close Vault</Text>
            </TouchableOpacity>
          </View>
          <SettingsZone />
        </View>
      </Modal>

      <Modal visible={exerciseSelectorVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-slate-50 pt-4">
          <View className="flex-row justify-end px-6">
            <TouchableOpacity 
              onPress={() => {
                setExerciseSelectorVisible(false);
                setExerciseToSwap(null);
              }} 
              className="bg-slate-200/50 px-4 py-2 rounded-full"
            >
              <Text className="text-xs font-black text-slate-500 uppercase tracking-widest">Cancel</Text>
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
