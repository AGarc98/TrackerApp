import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import db, { DB } from '../database/db';
import { Exercise, MuscleGroup, ExerciseType, Routine, RoutineMode, Workout, WorkoutExercise, ExerciseWithMuscle } from '../types/database';
import { useWorkout } from '../store/WorkoutContext';

interface UIDayExercise {
  id: string;
  exercise_id: string;
  name: string;
  target_sets: number;
  target_reps: number | null;
}

interface UIDay {
  id: string;
  name: string;
  exercises: UIDayExercise[];
}

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const ArchitectZone = () => {
  const { setActiveRoutine, activeRoutineId } = useWorkout();
  const [activeSubTab, setActiveSubTab] = useState<'routines' | 'days' | 'exercises'>('routines');
  const [exercises, setExercises] = useState<ExerciseWithMuscle[]>([]);
  const [days, setDays] = useState<Workout[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  
  // Modals visibility
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Editing state
  const [editingExercise, setEditingExercise] = useState<Partial<ExerciseWithMuscle> | null>(null);
  const [editingDay, setEditingDay] = useState<UIDay | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Partial<Routine> & { workout_mappings: (string | null)[] } | null>(null);

  // Picker state
  const [pickerType, setPickerType] = useState<'exercise' | 'day'>('exercise');
  const [currentPickerCallback, setCurrentPickerCallback] = useState<((id: string, name: string) => void) | null>(null);

  useEffect(() => {
    loadData();
  }, [activeSubTab]);

  const loadData = async () => {
    try {
      const eResult = DB.getAll<ExerciseWithMuscle>(`
        SELECT e.*, emg.muscle_group 
        FROM Exercises e 
        LEFT JOIN Exercise_Muscle_Groups emg ON e.id = emg.exercise_id AND emg.is_primary = 1
        ORDER BY e.name ASC;
      `);
      setExercises(eResult);

      const dResult = DB.getAll<Workout>('SELECT * FROM Workouts ORDER BY name ASC;');
      setDays(dResult);

      const rResult = DB.getAll<Routine>('SELECT * FROM Routines ORDER BY name ASC;');
      setRoutines(rResult);
    } catch (e) {
      console.error('Failed to load Architect data:', e);
    }
  };

  const handleSaveExercise = async () => {
    if (!editingExercise?.name) { Alert.alert('Error', 'Name is required.'); return; }
    try {
      const lastModified = Date.now();
      const exerciseId = editingExercise.id || Math.random().toString(36).substring(2, 15);
      
      DB.transaction(() => {
        if (editingExercise.id) {
          DB.run('UPDATE Exercises SET name = ?, description = ?, type = ?, last_modified = ? WHERE id = ?;',
            [editingExercise.name, editingExercise.description || null, editingExercise.type || ExerciseType.STRENGTH, lastModified, editingExercise.id]);
          // Re-sync muscle groups (simplified for now: delete and re-insert primary)
          DB.run('DELETE FROM Exercise_Muscle_Groups WHERE exercise_id = ?;', [editingExercise.id]);
        } else {
          DB.run('INSERT INTO Exercises (id, name, description, type, last_modified) VALUES (?, ?, ?, ?, ?);',
            [exerciseId, editingExercise.name, editingExercise.description || null, editingExercise.type || ExerciseType.STRENGTH, lastModified]);
        }
        
        // Always insert the selected muscle group as primary
        DB.run('INSERT INTO Exercise_Muscle_Groups (id, exercise_id, muscle_group, is_primary, last_modified) VALUES (?, ?, ?, 1, ?);',
          [Math.random().toString(36).substring(2, 15), exerciseId, editingExercise.muscle_group || MuscleGroup.CHEST, lastModified]);
      });

      setExerciseModalVisible(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteExercise = (id: string) => {
    Alert.alert('Purge Exercise', 'This will remove the movement from all blueprints. Proceed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Purge', style: 'destructive', onPress: () => {
        DB.run('DELETE FROM Exercises WHERE id = ?;', [id]);
        loadData();
      }}
    ]);
  };

  const handleSaveDay = async () => {
    if (!editingDay?.name) { Alert.alert('Error', 'Name is required.'); return; }
    try {
      const dayId = editingDay.id || Math.random().toString(36).substring(2, 15);
      const lastModified = Date.now();
      DB.transaction(() => {
        if (editingDay.id) {
          DB.run('UPDATE Workouts SET name = ?, last_modified = ? WHERE id = ?;', [editingDay.name, lastModified, editingDay.id]);
          DB.run('DELETE FROM Workout_Exercises WHERE workout_id = ?;', [editingDay.id]);
        } else {
          DB.run('INSERT INTO Workouts (id, name, last_modified) VALUES (?, ?, ?);', [dayId, editingDay.name, lastModified]);
        }
        editingDay.exercises.forEach((ex, idx) => {
          DB.run('INSERT INTO Workout_Exercises (id, workout_id, exercise_id, order_index, target_sets, target_reps, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?);',
            [Math.random().toString(36).substring(2, 15), dayId, ex.exercise_id, idx, ex.target_sets, ex.target_reps, lastModified]);
        });
      });
      setDayModalVisible(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteDay = (id: string) => {
    Alert.alert('Purge Day', 'This blueprint will be erased from all routines. Proceed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Purge', style: 'destructive', onPress: () => {
        DB.run('DELETE FROM Workouts WHERE id = ?;', [id]);
        loadData();
      }}
    ]);
  };

  const handleSaveRoutine = async () => {
    if (!editingRoutine?.name) { Alert.alert('Error', 'Name is required.'); return; }
    try {
      const rId = editingRoutine.id || Math.random().toString(36).substring(2, 15);
      const lastModified = Date.now();
      DB.transaction(() => {
        if (editingRoutine.id) {
          DB.run('UPDATE Routines SET name = ?, mode = ?, duration = ?, last_modified = ? WHERE id = ?;', [editingRoutine.name!, editingRoutine.mode!, editingRoutine.duration!, lastModified, editingRoutine.id]);
          DB.run('DELETE FROM Routine_Workouts WHERE routine_id = ?;', [editingRoutine.id]);
        } else {
          DB.run('INSERT INTO Routines (id, name, mode, duration, cycle_count, last_modified) VALUES (?, ?, ?, ?, 0, ?);', [rId, editingRoutine.name!, editingRoutine.mode!, editingRoutine.duration!, lastModified]);
        }
        editingRoutine.workout_mappings.forEach((wId, idx) => {
          if (wId) {
            DB.run('INSERT INTO Routine_Workouts (id, routine_id, workout_id, order_index, last_modified) VALUES (?, ?, ?, ?, ?);', 
              [Math.random().toString(36).substring(2, 15), rId, wId, idx, lastModified]);
          }
        });
      });
      setRoutineModalVisible(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteRoutine = (id: string) => {
    Alert.alert('Purge Routine', 'This sequence will be removed from the vault. Proceed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Purge', style: 'destructive', onPress: async () => {
        if (activeRoutineId === id) await setActiveRoutine(null);
        DB.run('DELETE FROM Routines WHERE id = ?;', [id]);
        loadData();
      }}
    ]);
  };

  const openExercisePicker = (callback: (id: string, name: string) => void) => {
    const res = DB.getAll<ExerciseWithMuscle>(`
      SELECT e.*, emg.muscle_group 
      FROM Exercises e 
      LEFT JOIN Exercise_Muscle_Groups emg ON e.id = emg.exercise_id AND emg.is_primary = 1
      ORDER BY e.name ASC;
    `);
    setExercises(res);
    setPickerType('exercise');
    setCurrentPickerCallback(() => callback);
    setPickerVisible(true);
  };

  const openDayPicker = (callback: (id: string, name: string) => void) => {
    const res = DB.getAll<Workout>('SELECT * FROM Workouts ORDER BY name ASC;');
    setDays(res);
    setPickerType('day');
    setCurrentPickerCallback(() => callback);
    setPickerVisible(true);
  };

  const renderPickerOverlay = () => {
    if (!pickerVisible) return null;
    return (
      <View className="absolute inset-0 bg-text-main/90 justify-center p-6 z-[9999]" style={{ elevation: 100 }}>
        <View className="bg-surface rounded-[40px] p-6 max-h-[85%] shadow-2xl">
          <Text className="text-xl font-black mb-4 text-center uppercase tracking-widest text-text-muted">Select {pickerType}</Text>
          <FlatList<ExerciseWithMuscle | Workout>
            data={pickerType === 'exercise' ? exercises : days}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity 
                onPress={() => { if (currentPickerCallback) currentPickerCallback(item.id, item.name); setPickerVisible(false); }} 
                activeOpacity={0.7}
                className="p-4 border-b border-border active:bg-background"
              >
                <Text className="font-bold text-text-main text-lg">{item.name}</Text>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
          <TouchableOpacity onPress={() => setPickerVisible(false)} className="mt-6 bg-background p-4 rounded-2xl items-center">
            <Text className="font-black text-text-muted uppercase tracking-widest">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRoutineItem = ({ item }: { item: Routine }) => {
    const isActive = item.id === activeRoutineId;
    return (
      <View className={`bg-surface p-6 mb-4 rounded-[32px] shadow-sm border ${isActive ? 'border-primary' : 'border-border'}`}>
        <View className="flex-row justify-between items-start mb-4">
          <View className="flex-1 mr-4">
            <Text className="text-xl font-black text-text-main mb-1">{item.name}</Text>
            <View className="flex-row items-center">
              <View className="bg-primary-soft px-2 py-1 rounded-md mr-2">
                <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">{item.mode}</Text>
              </View>
              {isActive && <View className="bg-success/10 px-2 py-1 rounded-md"><Text className="text-[10px] font-bold text-success uppercase tracking-widest">Active</Text></View>}
            </View>
          </View>
          <View className="flex-row">
            <TouchableOpacity onPress={async () => {
              const mappings = DB.getAll<any>('SELECT * FROM Routine_Workouts WHERE routine_id = ? ORDER BY order_index ASC;', [item.id]);
              let workout_mappings: (string | null)[] = item.mode === RoutineMode.WEEKLY ? Array(7).fill(null) : mappings.map((m: any) => m.workout_id);
              if (item.mode === RoutineMode.WEEKLY) mappings.forEach((m: any) => { if (m.order_index < 7) workout_mappings[m.order_index] = m.workout_id; });
              setEditingRoutine({ ...item, workout_mappings });
              setRoutineModalVisible(true);
            }} className="bg-background p-3 rounded-2xl border border-border shadow-sm mr-2"><Text className="text-text-muted font-black text-[10px] uppercase tracking-widest">Edit</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteRoutine(item.id)} className="bg-background p-3 rounded-2xl border border-border shadow-sm mr-2"><Text className="text-accent font-black text-[10px] uppercase tracking-widest">Del</Text></TouchableOpacity>
            <TouchableOpacity onPress={async () => {
              const newId = isActive ? null : item.id;
              await setActiveRoutine(newId);
            }} className={`p-3 px-4 rounded-2xl shadow-sm ${isActive ? 'bg-accent-soft' : 'bg-primary'}`}><Text className={`font-black text-[10px] uppercase tracking-widest ${isActive ? 'text-accent' : 'text-surface'}`}>{isActive ? 'Stop' : 'Start'}</Text></TouchableOpacity>
          </View>
        </View>
        <Text className="text-text-muted text-[10px] font-black uppercase tracking-[2px]">Progress: {item.cycle_count} Completed</Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-6 pt-2 pb-4 bg-background">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center space-x-3">
            <View className="w-8 h-8 bg-text-main rounded-xl items-center justify-center rotate-6 shadow-md shadow-text-main/20">
              <Text className="text-surface text-base font-black italic">A</Text>
            </View>
            <Text className="text-2xl font-black text-text-main tracking-tighter">Architect</Text>
          </View>
          
          <TouchableOpacity 
            onPress={() => {
              if (activeSubTab === 'exercises') { setEditingExercise({ name: '', muscle_group: MuscleGroup.CHEST, type: ExerciseType.STRENGTH, description: '' }); setExerciseModalVisible(true); }
              else if (activeSubTab === 'days') { setEditingDay({ id: '', name: '', exercises: [] }); setDayModalVisible(true); }
              else { setEditingRoutine({ name: '', mode: RoutineMode.ASYNC, duration: 12, workout_mappings: [] }); setRoutineModalVisible(true); }
            }}
            activeOpacity={0.8}
            className="bg-primary px-5 py-3 rounded-2xl shadow-lg shadow-primary/20"
          >
            <Text className="text-surface font-black text-xs uppercase tracking-widest">+ New</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row mt-6 space-x-6">
          {['routines', 'days', 'exercises'].map((tab) => (
            <TouchableOpacity key={tab} onPress={() => setActiveSubTab(tab as any)} className="relative pb-2">
              <Text className={`text-[10px] font-black uppercase tracking-[2px] ${activeSubTab === tab ? 'text-primary' : 'text-text-muted'}`}>{tab}</Text>
              {activeSubTab === tab && <View className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={(activeSubTab === 'exercises' ? exercises : activeSubTab === 'days' ? days : routines) as any[]}
        contentContainerStyle={{ padding: 16 }}
        renderItem={activeSubTab === 'routines' ? renderRoutineItem : ({ item }: any) => (
          <View className="bg-surface p-6 mb-4 rounded-[32px] shadow-sm flex-row justify-between items-center border border-border">
            <View className="flex-1 mr-4">
              <Text className="text-lg font-black text-text-main mb-1 tracking-tight">{item.name}</Text>
              <View className="bg-background self-start px-2 py-1 rounded-lg border border-border">
                <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">{activeSubTab === 'exercises' ? item.muscle_group : 'Workout Blueprint'}</Text>
              </View>
            </View>
            <View className="flex-row">
                <TouchableOpacity onPress={async () => {
                if (activeSubTab === 'exercises') { setEditingExercise(item); setExerciseModalVisible(true); }
                else if (activeSubTab === 'days') {
                    const exResult = DB.getAll<any>('SELECT we.*, e.name FROM Workout_Exercises we JOIN Exercises e ON we.exercise_id = e.id WHERE we.workout_id = ? ORDER BY we.order_index ASC;', [item.id]);
                    setEditingDay({ id: item.id, name: item.name, exercises: exResult.map((we: any) => ({ id: we.id, exercise_id: we.exercise_id, name: we.name, target_sets: we.target_sets, target_reps: we.target_reps })) });
                    setDayModalVisible(true);
                }
                }} className="bg-background p-3 rounded-2xl border border-border shadow-sm mr-2"><Text className="text-text-muted font-black text-[10px] uppercase tracking-widest">Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => {
                    if (activeSubTab === 'exercises') handleDeleteExercise(item.id);
                    else if (activeSubTab === 'days') handleDeleteDay(item.id);
                }} className="bg-background p-3 rounded-2xl border border-border shadow-sm"><Text className="text-accent font-black text-[10px] uppercase tracking-widest">Del</Text></TouchableOpacity>
            </View>
          </View>
        )}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
      />

      {/* Exercise Detail Modal */}
      <Modal visible={exerciseModalVisible} animationType="fade" transparent statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className="flex-1 justify-end bg-text-main/60">
            <View className="bg-surface rounded-t-[40px] p-8 pb-12 shadow-2xl h-[92%]">
              <View className="w-12 h-1.5 bg-background rounded-full self-center mb-6" />
              <Text className="text-2xl font-black text-text-main mb-6">Exercise Detail</Text>
              <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Identity</Text>
                <TextInput className="bg-background border border-border rounded-2xl p-4 mb-6 text-text-main font-bold" placeholder="Exercise Name" placeholderTextColor="var(--color-text-muted)" value={editingExercise?.name} onChangeText={(t) => setEditingExercise({ ...editingExercise!, name: t })} />
                <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Vault Description</Text>
                <TextInput className="bg-background border border-border rounded-2xl p-4 mb-6 h-32 text-text-main font-medium" multiline placeholder="..." placeholderTextColor="var(--color-text-muted)" value={editingExercise?.description || ''} onChangeText={(t) => setEditingExercise({ ...editingExercise!, description: t })} />
                <Text className="text-xs font-black text-text-muted mb-3 uppercase tracking-widest px-1">Muscle Group</Text>
                <View className="flex-row flex-wrap mb-6">
                  {Object.values(MuscleGroup).map(mg => (
                    <TouchableOpacity key={mg} onPress={() => setEditingExercise({ ...editingExercise!, muscle_group: mg })} className={`px-3 py-1.5 m-1 rounded-lg border ${editingExercise?.muscle_group === mg ? 'bg-primary border-primary' : 'bg-surface border-border'}`}><Text className={`text-[10px] font-bold ${editingExercise?.muscle_group === mg ? 'text-surface' : 'text-text-muted'}`}>{mg}</Text></TouchableOpacity>
                  ))}
                </View>
                <Text className="text-xs font-black text-text-muted mb-3 uppercase tracking-widest px-1">Exercise Type</Text>
                <View className="flex-row flex-wrap mb-6">
                  {Object.values(ExerciseType).map(et => (
                    <TouchableOpacity key={et} onPress={() => setEditingExercise({ ...editingExercise!, type: et })} className={`px-3 py-1.5 m-1 rounded-lg border ${editingExercise?.type === et ? 'bg-primary border-primary' : 'bg-surface border-border'}`}><Text className={`text-[10px] font-bold ${editingExercise?.type === et ? 'text-surface' : 'text-text-muted'}`}>{et.replace('_', ' ')}</Text></TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View className="flex-row justify-between items-center mt-4">
                <TouchableOpacity onPress={() => setExerciseModalVisible(false)} className="flex-1 py-5 rounded-2xl mr-4"><Text className="text-text-muted font-black text-center text-sm uppercase tracking-widest">Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveExercise} className="flex-[2] bg-primary py-5 rounded-2xl"><Text className="text-surface font-black text-center text-sm uppercase tracking-widest">Commit Change</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Day Architect Modal */}
      <Modal visible={dayModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View className="flex-1 justify-end bg-text-main/60">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
            <View className="bg-surface rounded-t-[40px] p-8 pb-12 shadow-2xl h-[92%]">
              <View className="w-12 h-1.5 bg-background rounded-full self-center mb-6" />
              <Text className="text-2xl font-black text-text-main mb-6">Day Architect</Text>
              <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Label</Text>
                <TextInput className="bg-background border border-border rounded-2xl p-4 mb-6 text-text-main font-bold" placeholder="e.g. Push Day" placeholderTextColor="var(--color-text-muted)" value={editingDay?.name} onChangeText={(t) => setEditingDay({ ...editingDay!, name: t })} />
                <View className="flex-row justify-between items-center mb-4 px-1"><Text className="text-xs font-black text-text-muted uppercase tracking-widest">Exercises</Text>
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    onPress={() => openExercisePicker((id, name) => {
                      setEditingDay(prev => prev ? { ...prev, exercises: [...prev.exercises, { id: Math.random().toString(36).substring(2, 9), exercise_id: id, name, target_sets: 3, target_reps: 10 }] } : null);
                    })} 
                    className="bg-primary-soft px-3 py-1.5 rounded-lg border border-primary/20"
                  >
                    <Text className="text-primary text-[10px] font-black uppercase tracking-widest">+ Add</Text>
                  </TouchableOpacity>
                </View>
                {editingDay?.exercises.map((ex, idx) => (
                  <View key={idx} className="bg-background rounded-3xl p-5 mb-3 border border-border">
                    <View className="flex-row justify-between items-center mb-4"><Text className="text-sm font-black text-text-main flex-1">{ex.name}</Text>
                      <TouchableOpacity onPress={() => { const newExs = [...editingDay.exercises]; newExs.splice(idx, 1); setEditingDay({ ...editingDay, exercises: newExs }); }}><Text className="text-accent font-black text-[10px] uppercase">Remove</Text></TouchableOpacity>
                    </View>
                    <View className="flex-row space-x-2">
                      <View className="flex-1"><Text className="text-[10px] font-black text-text-muted uppercase mb-1">Sets</Text>
                        <TextInput className="bg-surface border border-border rounded-xl p-3 text-center font-bold text-text-main" keyboardType="numeric" value={ex.target_sets.toString()} onChangeText={(v) => { const newExs = [...editingDay.exercises]; newExs[idx].target_sets = parseInt(v) || 0; setEditingDay({ ...editingDay, exercises: newExs }); }} />
                      </View>
                      <View className="flex-1"><Text className="text-[10px] font-black text-text-muted uppercase mb-1">Reps</Text>
                        <TextInput className="bg-surface border border-border rounded-xl p-3 text-center font-bold text-text-main" keyboardType="numeric" value={ex.target_reps?.toString() || ''} onChangeText={(v) => { const newExs = [...editingDay.exercises]; newExs[idx].target_reps = parseInt(v) || null; setEditingDay({ ...editingDay, exercises: newExs }); }} />
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View className="flex-row justify-between items-center mt-6 pt-4 border-t border-border">
                <TouchableOpacity onPress={() => setDayModalVisible(false)} className="flex-1 py-5 rounded-2xl mr-4"><Text className="text-text-muted font-black text-center text-sm uppercase tracking-widest">Discard</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveDay} className="flex-[2] bg-primary py-5 rounded-2xl"><Text className="text-surface font-black text-center text-sm uppercase tracking-widest">Commit Day</Text></TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
          {renderPickerOverlay()}
        </View>
      </Modal>

      {/* Routine Blueprint Modal */}
      <Modal visible={routineModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View className="flex-1 justify-end bg-text-main/60">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
            <View className="bg-surface rounded-t-[40px] p-8 pb-12 shadow-2xl h-[92%]">
              <View className="w-12 h-1.5 bg-background rounded-full self-center mb-6" />
              <Text className="text-2xl font-black text-text-main mb-6">Routine Blueprint</Text>
              <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Identity</Text>
                <TextInput className="bg-background border border-border rounded-2xl p-4 mb-6 text-text-main font-bold" placeholder="e.g. Hypertrophy Plan" placeholderTextColor="var(--color-text-muted)" value={editingRoutine?.name} onChangeText={(t) => setEditingRoutine({ ...editingRoutine!, name: t })} />
                <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Duration (Cycles)</Text>
                <TextInput 
                  className="bg-background border border-border rounded-2xl p-4 mb-6 text-text-main font-bold" 
                  placeholder="e.g. 12" 
                  placeholderTextColor="var(--color-text-muted)"
                  keyboardType="numeric"
                  value={editingRoutine?.duration?.toString()} 
                  onChangeText={(t) => setEditingRoutine({ ...editingRoutine!, duration: parseInt(t) || 0 })} 
                />
                <Text className="text-xs font-black text-text-muted mb-3 uppercase tracking-widest px-1">Logic Mode</Text>
                <View className="flex-row mb-6">
                  {Object.values(RoutineMode).map((m) => (
                    <TouchableOpacity key={m} onPress={() => setEditingRoutine({ ...editingRoutine!, mode: m, workout_mappings: m === RoutineMode.WEEKLY ? Array(7).fill(null) : [] })} className={`flex-1 p-4 rounded-2xl mr-2 border ${editingRoutine?.mode === m ? 'bg-primary border-primary' : 'bg-surface border-border'}`}><Text className={`text-center font-black text-[10px] uppercase tracking-widest ${editingRoutine?.mode === m ? 'text-surface' : 'text-text-muted'}`}>{m}</Text></TouchableOpacity>
                  ))}
                </View>
                {editingRoutine?.mode === RoutineMode.WEEKLY ? (
                  <View>{WEEK_DAYS.map((dayName, idx) => (
                    <View key={dayName} className="flex-row justify-between items-center mb-3 bg-background p-4 rounded-2xl border border-border"><Text className="text-sm font-black text-text-main">{dayName}</Text>
                      <TouchableOpacity 
                        activeOpacity={0.7}
                        onPress={() => openDayPicker((id) => {
                          setEditingRoutine(prev => {
                            if (!prev) return null;
                            const newMaps = [...prev.workout_mappings];
                            newMaps[idx] = id;
                            return { ...prev, workout_mappings: newMaps };
                          });
                        })} 
                        className="bg-surface px-4 py-2 rounded-xl border border-border"
                      >
                        <Text className="text-[10px] font-black text-primary uppercase tracking-widest">{editingRoutine.workout_mappings[idx] ? days.find(d => d.id === editingRoutine.workout_mappings[idx])?.name || 'Assigned' : 'Rest Day'}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}</View>
                ) : (
                  <View><View className="flex-row justify-between items-center mb-4 px-1"><Text className="text-xs font-black text-text-muted uppercase tracking-widest">Queue Sequence</Text>
                    <TouchableOpacity 
                      activeOpacity={0.7}
                      onPress={() => openDayPicker((id) => {
                        setEditingRoutine(prev => {
                          if (!prev) return null;
                          return { ...prev, workout_mappings: [...prev.workout_mappings, id] };
                        });
                      })} 
                      className="bg-primary-soft px-3 py-1.5 rounded-lg border border-primary/20"
                    >
                      <Text className="text-primary text-[10px] font-black uppercase tracking-widest">+ Add</Text>
                    </TouchableOpacity>
                  </View>
                  {editingRoutine?.workout_mappings.map((wId, idx) => (
                    <View key={idx} className="flex-row justify-between items-center mb-2 bg-background p-4 rounded-2xl"><Text className="text-sm font-black text-text-main">{idx + 1}. {days.find(d => d.id === wId)?.name || 'Workout Day'}</Text>
                      <TouchableOpacity onPress={() => {
                        setEditingRoutine(prev => {
                          if (!prev) return null;
                          const newMaps = [...prev.workout_mappings];
                          newMaps.splice(idx, 1);
                          return { ...prev, workout_mappings: newMaps };
                        });
                      }}><Text className="text-accent font-black text-[10px] uppercase">Remove</Text></TouchableOpacity>
                    </View>
                  ))}</View>
                )}
              </ScrollView>
              <View className="flex-row justify-between items-center mt-6 pt-4 border-t border-border">
                <TouchableOpacity onPress={() => setRoutineModalVisible(false)} className="flex-1 py-5 rounded-2xl mr-4"><Text className="text-text-muted font-black text-center text-sm uppercase tracking-widest">Discard</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveRoutine} className="flex-[2] bg-primary py-5 rounded-2xl shadow-xl shadow-primary/20"><Text className="text-surface font-black text-center text-sm uppercase tracking-widest">Commit Blueprint</Text></TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
          {renderPickerOverlay()}
        </View>
      </Modal>
    </View>
  );
};
