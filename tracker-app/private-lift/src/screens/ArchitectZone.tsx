import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import db, { query } from '../database/db';
import { Exercise, MuscleGroup, ExerciseType, Routine, RoutineMode, Workout, WorkoutExercise } from '../types/database';
import { useWorkout } from '../store/WorkoutContext';

interface UIDayExercise {
  id: string;
  exercise_id: string;
  name: string;
  target_sets: number;
  target_reps: number;
}

interface UIDay {
  id: string;
  name: string;
  exercises: UIDayExercise[];
}

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const ArchitectZone = () => {
  const { setActiveRoutine } = useWorkout();
  const [activeSubTab, setActiveSubTab] = useState<'routines' | 'days' | 'exercises'>('routines');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [days, setDays] = useState<Workout[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);
  
  // Modals visibility
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Editing state
  const [editingExercise, setEditingExercise] = useState<Partial<Exercise> | null>(null);
  const [editingDay, setEditingDay] = useState<UIDay | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Partial<Routine> & { workout_mappings: (string | null)[] } | null>(null);

  // Picker state
  const [pickerType, setPickerType] = useState<'exercise' | 'day'>('exercise');
  const [currentPickerCallback, setCurrentPickerCallback] = useState<((id: string, name: string) => void) | null>(null);

  useEffect(() => {
    loadData();
  }, [activeSubTab]);

  const loadData = async () => {
    const settings = query('SELECT active_routine_id FROM User_Settings WHERE id = 1;');
    setActiveRoutineId((settings.rows?._array[0] as any)?.active_routine_id || null);

    if (activeSubTab === 'exercises') {
      const result = query('SELECT * FROM Exercises ORDER BY name ASC;');
      setExercises(result.rows?._array || []);
    } else if (activeSubTab === 'days') {
      const result = query('SELECT * FROM Workouts ORDER BY name ASC;');
      setDays(result.rows?._array || []);
    } else {
      const result = query('SELECT * FROM Routines ORDER BY name ASC;');
      setRoutines(result.rows?._array || []);
    }
  };

  const handleSaveExercise = async () => {
    if (!editingExercise?.name) { Alert.alert('Error', 'Name is required.'); return; }
    try {
      const lastModified = Date.now();
      if (editingExercise.id) {
        query('UPDATE Exercises SET name = ?, description = ?, muscle_group = ?, type = ?, last_modified = ? WHERE id = ?;',
          [editingExercise.name, editingExercise.description || '', editingExercise.muscle_group || MuscleGroup.CHEST, editingExercise.type || ExerciseType.STRENGTH, lastModified, editingExercise.id]);
      } else {
        query('INSERT INTO Exercises (id, name, description, type, muscle_group, is_base_content, last_modified) VALUES (?, ?, ?, ?, ?, 0, ?);',
          [Math.random().toString(36).substring(2, 15), editingExercise.name, editingExercise.description || '', editingExercise.type || ExerciseType.STRENGTH, editingExercise.muscle_group || MuscleGroup.CHEST, lastModified]);
      }
      setExerciseModalVisible(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleSaveDay = async () => {
    if (!editingDay?.name) { Alert.alert('Error', 'Name is required.'); return; }
    try {
      const dayId = editingDay.id || Math.random().toString(36).substring(2, 15);
      db.withTransactionSync(() => {
        if (editingDay.id) {
          db.runSync('UPDATE Workouts SET name = ? WHERE id = ?;', [editingDay.name, editingDay.id]);
          db.runSync('DELETE FROM Workout_Exercises WHERE workout_id = ?;', [editingDay.id]);
        } else {
          db.runSync('INSERT INTO Workouts (id, name) VALUES (?, ?);', [dayId, editingDay.name]);
        }
        editingDay.exercises.forEach((ex, idx) => {
          db.runSync('INSERT INTO Workout_Exercises (id, workout_id, exercise_id, order_index, target_sets, target_reps) VALUES (?, ?, ?, ?, ?, ?);',
            [Math.random().toString(36).substring(2, 15), dayId, ex.exercise_id, idx, ex.target_sets, ex.target_reps]);
        });
      });
      setDayModalVisible(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleSaveRoutine = async () => {
    if (!editingRoutine?.name) { Alert.alert('Error', 'Name is required.'); return; }
    try {
      const rId = editingRoutine.id || Math.random().toString(36).substring(2, 15);
      db.withTransactionSync(() => {
        if (editingRoutine.id) {
          db.runSync('UPDATE Routines SET name = ?, mode = ?, duration = ? WHERE id = ?;', [editingRoutine.name, editingRoutine.mode, editingRoutine.duration, editingRoutine.id]);
          db.runSync('DELETE FROM Routine_Workouts WHERE routine_id = ?;', [editingRoutine.id]);
        } else {
          db.runSync('INSERT INTO Routines (id, name, mode, duration, cycle_count) VALUES (?, ?, ?, ?, 0);', [rId, editingRoutine.name, editingRoutine.mode, editingRoutine.duration]);
        }
        editingRoutine.workout_mappings.forEach((wId, idx) => {
          if (wId) db.runSync('INSERT INTO Routine_Workouts (id, routine_id, workout_id, order_index) VALUES (?, ?, ?, ?);', [Math.random().toString(36).substring(2, 15), rId, wId, idx]);
        });
      });
      setRoutineModalVisible(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const openExercisePicker = (callback: (id: string, name: string) => void) => {
    const res = query('SELECT * FROM Exercises ORDER BY name ASC;');
    setExercises(res.rows?._array || []);
    setPickerType('exercise');
    setCurrentPickerCallback(() => callback);
    setPickerVisible(true);
  };

  const openDayPicker = (callback: (id: string, name: string) => void) => {
    const res = query('SELECT * FROM Workouts ORDER BY name ASC;');
    setDays(res.rows?._array || []);
    setPickerType('day');
    setCurrentPickerCallback(() => callback);
    setPickerVisible(true);
  };

  const renderRoutineItem = ({ item }: { item: Routine }) => {
    const isActive = item.id === activeRoutineId;
    return (
      <View className={`bg-white p-6 mb-4 rounded-[32px] shadow-sm border \${isActive ? 'border-blue-500' : 'border-slate-100'}`}>
        <View className="flex-row justify-between items-start mb-4">
          <View className="flex-1 mr-4">
            <Text className="text-xl font-black text-slate-900 mb-1">{item.name}</Text>
            <View className="flex-row items-center">
              <View className="bg-blue-50 px-2 py-1 rounded-md mr-2">
                <Text className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{item.mode}</Text>
              </View>
              {isActive && <View className="bg-green-50 px-2 py-1 rounded-md"><Text className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Active</Text></View>}
            </View>
          </View>
          <View className="flex-row">
            <TouchableOpacity onPress={async () => {
              const mappingsResult = query('SELECT * FROM Routine_Workouts WHERE routine_id = ? ORDER BY order_index ASC;', [item.id]);
              const mappings = (mappingsResult.rows?._array || []);
              let workout_mappings: (string | null)[] = item.mode === RoutineMode.WEEKLY ? Array(7).fill(null) : mappings.map((m: any) => m.workout_id);
              if (item.mode === RoutineMode.WEEKLY) mappings.forEach((m: any) => { if (m.order_index < 7) workout_mappings[m.order_index] = m.workout_id; });
              setEditingRoutine({ ...item, workout_mappings });
              setRoutineModalVisible(true);
            }} className="bg-slate-100 p-3 rounded-2xl mr-2"><Text className="text-slate-600 font-bold text-xs">Edit</Text></TouchableOpacity>
            <TouchableOpacity onPress={async () => {
              const newId = isActive ? null : item.id;
              await setActiveRoutine(newId);
              setActiveRoutineId(newId);
            }} className={`p-3 rounded-2xl \${isActive ? 'bg-rose-50' : 'bg-blue-600'}`}><Text className={`font-bold text-xs \${isActive ? 'text-rose-500' : 'text-white'}`}>{isActive ? 'Stop' : 'Start'}</Text></TouchableOpacity>
          </View>
        </View>
        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px]">Progress: {item.cycle_count} Completed</Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-slate-50 p-4 pt-8">
      <View className="flex-row justify-between items-center mb-6 px-2">
        <View className="flex-1">
          <Text className="text-3xl font-black text-slate-900 tracking-tighter">Architect</Text>
          <View className="flex-row mt-2 space-x-4">
            {['routines', 'days', 'exercises'].map((tab) => (
              <TouchableOpacity key={tab} onPress={() => setActiveSubTab(tab as any)}>
                <Text className={`text-xs font-black uppercase tracking-widest \${activeSubTab === tab ? 'text-blue-600' : 'text-slate-300'}`}>{tab}</Text>
                {activeSubTab === tab && <View className="h-1 bg-blue-600 rounded-full mt-1 w-full" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity onPress={() => {
          if (activeSubTab === 'exercises') { setEditingExercise({ name: '', muscle_group: MuscleGroup.CHEST, type: ExerciseType.STRENGTH, description: '' }); setExerciseModalVisible(true); }
          else if (activeSubTab === 'days') { setEditingDay({ id: '', name: '', exercises: [] }); setDayModalVisible(true); }
          else { setEditingRoutine({ name: '', mode: RoutineMode.ASYNC, duration: 12, workout_mappings: [] }); setRoutineModalVisible(true); }
        }} className="bg-blue-600 px-5 py-4 rounded-3xl shadow-lg shadow-blue-200"><Text className="text-white font-black text-sm">+ Add</Text></TouchableOpacity>
      </View>

      <FlatList
        data={activeSubTab === 'exercises' ? exercises : activeSubTab === 'days' ? days : routines}
        renderItem={activeSubTab === 'routines' ? renderRoutineItem : ({ item }: any) => (
          <View className="bg-white p-5 mb-3 rounded-3xl shadow-sm flex-row justify-between items-center border border-slate-100">
            <View className="flex-1 mr-4">
              <Text className="text-lg font-bold text-slate-900 mb-1">{item.name}</Text>
              <View className="flex-row items-center"><View className="bg-slate-100 px-2 py-1 rounded-md mr-2"><Text className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{activeSubTab === 'exercises' ? item.muscle_group : 'Workout Blueprint'}</Text></View></View>
            </View>
            <TouchableOpacity onPress={async () => {
              if (activeSubTab === 'exercises') { setEditingExercise(item); setExerciseModalVisible(true); }
              else if (activeSubTab === 'days') {
                const exResult = query('SELECT we.*, e.name FROM Workout_Exercises we JOIN Exercises e ON we.exercise_id = e.id WHERE we.workout_id = ? ORDER BY we.order_index ASC;', [item.id]);
                setEditingDay({ id: item.id, name: item.name, exercises: (exResult.rows?._array || []).map((we: any) => ({ id: we.id, exercise_id: we.exercise_id, name: we.name, target_sets: we.target_sets, target_reps: we.target_reps })) });
                setDayModalVisible(true);
              }
            }} className="bg-slate-50 p-3 rounded-2xl border border-slate-100"><Text className="text-slate-600 font-semibold text-xs">Edit</Text></TouchableOpacity>
          </View>
        )}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
      />

      {/* Exercise Detail Modal */}
      <Modal visible={exerciseModalVisible} animationType="fade" transparent statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className="flex-1 justify-end bg-slate-900/60">
            <View className="bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl">
              <View className="w-12 h-1.5 bg-slate-100 rounded-full self-center mb-6" />
              <Text className="text-2xl font-black text-slate-900 mb-6">Exercise Detail</Text>
              <ScrollView showsVerticalScrollIndicator={false} className="max-h-[70%]">
                <Text className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest px-1">Identity</Text>
                <TextInput className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-slate-900 font-bold" placeholder="Exercise Name" value={editingExercise?.name} onChangeText={(t) => setEditingExercise({ ...editingExercise!, name: t })} />
                <Text className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest px-1">Vault Description</Text>
                <TextInput className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 h-32 text-slate-900 font-medium" multiline placeholder="..." value={editingExercise?.description} onChangeText={(t) => setEditingExercise({ ...editingExercise!, description: t })} />
                <Text className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest px-1">Muscle Group</Text>
                <View className="flex-row flex-wrap mb-6">
                  {Object.values(MuscleGroup).map(mg => (
                    <TouchableOpacity key={mg} onPress={() => setEditingExercise({ ...editingExercise!, muscle_group: mg })} className={`px-3 py-1.5 m-1 rounded-lg border \${editingExercise?.muscle_group === mg ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}><Text className={`text-[10px] font-bold \${editingExercise?.muscle_group === mg ? 'text-white' : 'text-slate-500'}`}>{mg}</Text></TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View className="flex-row justify-between items-center mt-4">
                <TouchableOpacity onPress={() => setExerciseModalVisible(false)} className="flex-1 py-5 rounded-2xl mr-4"><Text className="text-slate-400 font-black text-center text-sm uppercase tracking-widest">Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveExercise} className="flex-[2] bg-slate-900 py-5 rounded-2xl"><Text className="text-white font-black text-center text-sm uppercase tracking-widest">Commit Change</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Day Architect Modal */}
      <Modal visible={dayModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View className="flex-1 justify-end bg-slate-900/60">
          <View className="bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl h-[92%]">
            <View className="w-12 h-1.5 bg-slate-100 rounded-full self-center mb-6" />
            <Text className="text-2xl font-black text-slate-900 mb-6">Day Architect</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest px-1">Label</Text>
              <TextInput className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-slate-900 font-bold" placeholder="e.g. Push Day" value={editingDay?.name} onChangeText={(t) => setEditingDay({ ...editingDay!, name: t })} />
              <View className="flex-row justify-between items-center mb-4 px-1"><Text className="text-xs font-black text-slate-400 uppercase tracking-widest">Exercises</Text>
                <TouchableOpacity onPress={() => openExercisePicker((id, name) => {
                  setEditingDay(prev => prev ? { ...prev, exercises: [...prev.exercises, { id: Math.random().toString(36).substring(2, 9), exercise_id: id, name, target_sets: 3, target_reps: 10 }] } : null);
                })} className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"><Text className="text-blue-600 text-[10px] font-black uppercase tracking-widest">+ Add</Text></TouchableOpacity>
              </View>
              {editingDay?.exercises.map((ex, idx) => (
                <View key={idx} className="bg-slate-50 rounded-3xl p-5 mb-3 border border-slate-100">
                  <View className="flex-row justify-between items-center mb-4"><Text className="text-sm font-black text-slate-900 flex-1">{ex.name}</Text>
                    <TouchableOpacity onPress={() => { const newExs = [...editingDay.exercises]; newExs.splice(idx, 1); setEditingDay({ ...editingDay, exercises: newExs }); }}><Text className="text-rose-500 font-black text-[10px] uppercase">Remove</Text></TouchableOpacity>
                  </View>
                  <View className="flex-row space-x-2">
                    <View className="flex-1"><Text className="text-[10px] font-black text-slate-400 uppercase mb-1">Sets</Text>
                      <TextInput className="bg-white border border-slate-200 rounded-xl p-3 text-center font-bold" keyboardType="numeric" value={ex.target_sets.toString()} onChangeText={(v) => { const newExs = [...editingDay.exercises]; newExs[idx].target_sets = parseInt(v) || 0; setEditingDay({ ...editingDay, exercises: newExs }); }} />
                    </View>
                    <View className="flex-1"><Text className="text-[10px] font-black text-slate-400 uppercase mb-1">Reps</Text>
                      <TextInput className="bg-white border border-slate-200 rounded-xl p-3 text-center font-bold" keyboardType="numeric" value={ex.target_reps.toString()} onChangeText={(v) => { const newExs = [...editingDay.exercises]; newExs[idx].target_reps = parseInt(v) || 0; setEditingDay({ ...editingDay, exercises: newExs }); }} />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View className="flex-row justify-between items-center mt-6 pt-4 border-t border-slate-50">
              <TouchableOpacity onPress={() => setDayModalVisible(false)} className="flex-1 py-5 rounded-2xl mr-4"><Text className="text-slate-400 font-black text-center text-sm uppercase tracking-widest">Discard</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSaveDay} className="flex-[2] bg-slate-900 py-5 rounded-2xl"><Text className="text-white font-black text-center text-sm uppercase tracking-widest">Commit Day</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Routine Blueprint Modal */}
      <Modal visible={routineModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View className="flex-1 justify-end bg-slate-900/60">
          <View className="bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl h-[92%]">
            <View className="w-12 h-1.5 bg-slate-100 rounded-full self-center mb-6" />
            <Text className="text-2xl font-black text-slate-900 mb-6">Routine Blueprint</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest px-1">Identity</Text>
              <TextInput className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-slate-900 font-bold" placeholder="e.g. Hypertrophy Plan" value={editingRoutine?.name} onChangeText={(t) => setEditingRoutine({ ...editingRoutine!, name: t })} />
              <Text className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest px-1">Logic Mode</Text>
              <View className="flex-row mb-6">
                {Object.values(RoutineMode).map((m) => (
                  <TouchableOpacity key={m} onPress={() => setEditingRoutine({ ...editingRoutine!, mode: m, workout_mappings: m === RoutineMode.WEEKLY ? Array(7).fill(null) : [] })} className={`flex-1 p-4 rounded-2xl mr-2 border \${editingRoutine?.mode === m ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}><Text className={`text-center font-black text-[10px] uppercase tracking-widest \${editingRoutine?.mode === m ? 'text-white' : 'text-slate-400'}`}>{m}</Text></TouchableOpacity>
                ))}
              </View>
              {editingRoutine?.mode === RoutineMode.WEEKLY ? (
                <View>{WEEK_DAYS.map((dayName, idx) => (
                  <View key={dayName} className="flex-row justify-between items-center mb-3 bg-slate-50 p-4 rounded-2xl border border-slate-100"><Text className="text-sm font-black text-slate-900">{dayName}</Text>
                    <TouchableOpacity onPress={() => openDayPicker((id) => {
                      setEditingRoutine(prev => {
                        if (!prev) return null;
                        const newMaps = [...prev.workout_mappings];
                        newMaps[idx] = id;
                        return { ...prev, workout_mappings: newMaps };
                      });
                    })} className="bg-white px-4 py-2 rounded-xl border border-slate-200"><Text className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{editingRoutine.workout_mappings[idx] ? days.find(d => d.id === editingRoutine.workout_mappings[idx])?.name || 'Assigned' : 'Rest Day'}</Text></TouchableOpacity>
                  </View>
                ))}</View>
              ) : (
                <View><View className="flex-row justify-between items-center mb-4 px-1"><Text className="text-xs font-black text-slate-400 uppercase tracking-widest">Queue Sequence</Text>
                  <TouchableOpacity onPress={() => openDayPicker((id) => {
                    setEditingRoutine(prev => {
                      if (!prev) return null;
                      return { ...prev, workout_mappings: [...prev.workout_mappings, id] };
                    });
                  })} className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"><Text className="text-blue-600 text-[10px] font-black uppercase tracking-widest">+ Add</Text></TouchableOpacity>
                </View>
                {editingRoutine?.workout_mappings.map((wId, idx) => (
                  <View key={idx} className="flex-row justify-between items-center mb-2 bg-slate-50 p-4 rounded-2xl"><Text className="text-sm font-black text-slate-900">{idx + 1}. {days.find(d => d.id === wId)?.name || 'Workout Day'}</Text>
                    <TouchableOpacity onPress={() => {
                      setEditingRoutine(prev => {
                        if (!prev) return null;
                        const newMaps = [...prev.workout_mappings];
                        newMaps.splice(idx, 1);
                        return { ...prev, workout_mappings: newMaps };
                      });
                    }}><Text className="text-rose-500 font-black text-[10px] uppercase">Remove</Text></TouchableOpacity>
                  </View>
                ))}</View>
              )}
            </ScrollView>
            <View className="flex-row justify-between items-center mt-6 pt-4 border-t border-slate-50">
              <TouchableOpacity onPress={() => setRoutineModalVisible(false)} className="flex-1 py-5 rounded-2xl mr-4"><Text className="text-slate-400 font-black text-center text-sm uppercase tracking-widest">Discard</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSaveRoutine} className="flex-[2] bg-slate-900 py-5 rounded-2xl shadow-xl shadow-slate-200"><Text className="text-white font-black text-center text-sm uppercase tracking-widest">Commit Blueprint</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Shared Picker Modal */}
      <Modal visible={pickerVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center p-6">
          <View className="bg-white rounded-[40px] p-6 max-h-[80%]">
            <Text className="text-xl font-black mb-4 text-center uppercase tracking-widest text-slate-400">Select {pickerType}</Text>
            <FlatList
              data={pickerType === 'exercise' ? exercises : days}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => { if (currentPickerCallback) currentPickerCallback(item.id, item.name); setPickerVisible(false); }} className="p-4 border-b border-slate-50"><Text className="font-bold text-slate-900">{item.name}</Text></TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setPickerVisible(false)} className="mt-4 p-4 items-center"><Text className="font-black text-slate-400 uppercase tracking-widest">Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};
