import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useWorkout } from '../store/WorkoutContext';
import { query } from '../database/db';
import { Exercise, Workout, SetData } from '../types/database';
import { SettingsZone } from './SettingsZone';

export const AthleteZone = () => {
  const { activeSession, draftSets, logSet, startWorkout, finishWorkout, discardWorkout, swapExercise } = useWorkout();
  const [availableWorkouts, setAvailableWorkouts] = useState<Workout[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [settingsVisible, setSettingsVisible] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const wResult = query('SELECT * FROM Workouts;');
    setAvailableWorkouts(wResult.rows?._array || []);
    
    const eResult = query('SELECT * FROM Exercises;');
    setExercises(eResult.rows?._array || []);
  };

  const handleStartDefault = async () => {
    // Check for an active routine in settings
    const settings = query('SELECT active_routine_id FROM User_Settings WHERE id = 1;');
    const activeRoutineId = (settings.rows?._array[0] as any)?.active_routine_id;

    let targetWorkout = availableWorkouts[0];
    
    // Logic to pick the next workout in routine could go here
    // For now, keeping the simplified "Start" logic

    if (!targetWorkout) {
      const id = Math.random().toString(36).substring(2, 15);
      query('INSERT INTO Workouts (id, name) VALUES (?, ?);', [id, 'Hypertrophy Alpha']);
      targetWorkout = { id, name: 'Hypertrophy Alpha' };
    }

    const selectedExercises = exercises.slice(0, 4).map(ex => ({
      exercise: ex,
      target_sets: 3,
      target_reps: 10
    }));

    if (selectedExercises.length === 0) {
      Alert.alert('Vault Empty', 'Architect some exercises first.');
      return;
    }

    await startWorkout(targetWorkout, selectedExercises);
  };

  const updateSet = (exerciseId: string, setIndex: number, updates: Partial<SetData>) => {
    const currentSets = draftSets[exerciseId] || [];
    const newSets = [...currentSets];
    newSets[setIndex] = { ...newSets[setIndex], ...updates };
    logSet(exerciseId, newSets);
  };

  if (!activeSession) {
    return (
      <View className="flex-1 justify-center items-center p-8 bg-slate-50">
        <TouchableOpacity 
          onPress={() => setSettingsVisible(true)}
          className="absolute top-12 left-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100"
        >
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vault</Text>
        </TouchableOpacity>

        <View className="bg-white p-10 rounded-[50px] shadow-2xl shadow-slate-200 items-center border border-slate-100">
          <View className="w-20 h-20 bg-blue-600 rounded-3xl items-center justify-center mb-6 rotate-12 shadow-lg shadow-blue-300">
            <Text className="text-white text-4xl font-black">L</Text>
          </View>
          <Text className="text-3xl font-black text-slate-900 mb-2 tracking-tighter text-center">Athlete Zone</Text>
          <Text className="text-slate-400 font-medium text-center mb-10 leading-5">
            Your session vault is ready.{"\n"}Initiate training directive?
          </Text>
          <TouchableOpacity
            onPress={handleStartDefault}
            activeOpacity={0.8}
            className="bg-slate-900 w-full py-6 rounded-3xl shadow-xl shadow-slate-300"
          >
            <Text className="text-white text-lg font-black text-center uppercase tracking-widest">Start Session</Text>
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
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="bg-white px-6 pt-10 pb-6 shadow-sm border-b border-slate-100">
        <View className="flex-row justify-between items-center">
          <TouchableOpacity 
            onPress={() => setSettingsVisible(true)}
            className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100"
          >
            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vault</Text>
          </TouchableOpacity>
          <View className="bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
            <Text className="text-green-600 text-[10px] font-black uppercase tracking-widest">Active</Text>
          </View>
        </View>
        <Text className="text-3xl font-black text-slate-900 tracking-tighter mt-4">Training</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 p-4 pt-6" showsVerticalScrollIndicator={false}>
          {Object.entries(draftSets).map(([exerciseId, sets]) => {
            const exercise = exercises.find(e => e.id === exerciseId);
            return (
              <View key={exerciseId} className="bg-white rounded-[32px] p-6 mb-6 shadow-sm border border-slate-100">
                <View className="flex-row justify-between items-start mb-6">
                  <View className="flex-1 mr-4">
                    <Text className="text-xl font-black text-slate-900 leading-tight mb-1">{exercise?.name}</Text>
                    <Text className="text-xs font-bold text-slate-400 uppercase tracking-widest">{exercise?.muscle_group}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      const otherExercises = exercises.filter(e => !draftSets[e.id]);
                      if (otherExercises.length > 0) {
                        const random = otherExercises[Math.floor(Math.random() * otherExercises.length)];
                        Alert.alert('Volatile Swap', `Swap \${exercise?.name} for \${random.name}?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Swap', onPress: () => swapExercise(exerciseId, random.id) }
                        ]);
                      }
                    }}
                    className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100"
                  >
                    <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Swap</Text>
                  </TouchableOpacity>
                </View>
                
                {sets.map((set, index) => (
                  <View key={set.id} className="flex-row items-center mb-3">
                    <View className={`w-10 h-10 rounded-2xl justify-center items-center mr-3 \${
                      set.is_completed ? 'bg-green-100' : 'bg-slate-50'
                    }`}>
                      <Text className={`font-black \${set.is_completed ? 'text-green-600' : 'text-slate-300'}`}>
                        {index + 1}
                      </Text>
                    </View>
                    
                    <View className="flex-1 flex-row space-x-2">
                      <TextInput
                        className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center font-black text-slate-900"
                        placeholder="KG"
                        keyboardType="numeric"
                        value={set.weight?.toString()}
                        onChangeText={(v) => updateSet(exerciseId, index, { weight: parseFloat(v) || undefined })}
                      />
                      
                      <TextInput
                        className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center font-black text-slate-900"
                        placeholder="REPS"
                        keyboardType="numeric"
                        value={set.reps?.toString()}
                        onChangeText={(v) => updateSet(exerciseId, index, { reps: parseInt(v) || undefined })}
                      />
                    </View>

                    <TouchableOpacity
                      onPress={() => updateSet(exerciseId, index, { is_completed: !set.is_completed })}
                      activeOpacity={0.7}
                      className={`w-14 h-14 rounded-2xl justify-center items-center ml-3 shadow-sm \${
                        set.is_completed ? 'bg-green-500 shadow-green-200' : 'bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <Text className="text-white text-xl font-bold">{set.is_completed ? '✓' : ''}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })}
          <View className="h-24" />
        </ScrollView>
      </KeyboardAvoidingView>

      <View className="px-6 py-6 bg-white border-t border-slate-100 flex-row space-x-4">
        <TouchableOpacity
          onPress={discardWorkout}
          activeOpacity={0.7}
          className="flex-1 bg-slate-50 py-5 rounded-3xl items-center border border-slate-100"
        >
          <Text className="text-slate-400 font-black uppercase tracking-widest text-xs">Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={finishWorkout}
          activeOpacity={0.8}
          className="flex-[2] bg-slate-900 py-5 rounded-3xl items-center shadow-xl shadow-slate-300"
        >
          <Text className="text-white font-black uppercase tracking-[3px] text-xs">Finish Workout</Text>
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
    </View>
  );
};
