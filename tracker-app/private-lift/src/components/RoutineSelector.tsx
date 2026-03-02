import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { query } from '../database/db';
import { Routine, RoutineMode } from '../types/database';
import { useWorkout } from '../store/WorkoutContext';

interface RoutineSelectorProps {
  onSelect?: (routineId: string) => void;
  onClose: () => void;
}

export const RoutineSelector: React.FC<RoutineSelectorProps> = ({ onSelect, onClose }) => {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customDuration, setCustomDuration] = useState<string>('');
  const { activeRoutineId, setActiveRoutine } = useWorkout();

  useEffect(() => {
    loadRoutines();
  }, []);

  const loadRoutines = async () => {
    try {
      const result = query('SELECT * FROM Routines ORDER BY name ASC;');
      setRoutines(result.rows?._array || []);
    } catch (error) {
      console.error('Failed to load routines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (id: string, duration?: number) => {
    await setActiveRoutine(id === activeRoutineId && !duration ? null : id, duration);
    if (onSelect) onSelect(id);
    onClose();
  };

  const toggleSelection = (routine: Routine) => {
    if (selectedId === routine.id) {
      setSelectedId(null);
      setCustomDuration('');
    } else {
      setSelectedId(routine.id);
      setCustomDuration(routine.duration.toString());
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      className="flex-1 bg-slate-50"
    >
      <View className="p-6 pt-10 flex-1">
        <Text className="text-2xl font-black text-slate-900 mb-2 tracking-tighter">Select Training Plan</Text>
        <Text className="text-slate-400 font-medium mb-6 leading-5">Choose a blueprint and calibrate its duration for your current objective.</Text>

        {routines.length === 0 ? (
          <View className="bg-white p-10 rounded-[40px] items-center border border-slate-100 shadow-sm">
            <View className="w-16 h-16 bg-slate-50 rounded-2xl items-center justify-center mb-6 border border-slate-100">
              <Text className="text-2xl">🏗️</Text>
            </View>
            <Text className="text-slate-900 font-black text-center mb-2">Vault Empty</Text>
            <Text className="text-slate-400 text-xs text-center leading-4">Head to the Architect Zone to forge your first training sequence.</Text>
          </View>
        ) : (
          <FlatList
            data={routines}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isActive = item.id === activeRoutineId;
              const isSelected = item.id === selectedId;
              
              return (
                <View className={`bg-white mb-4 rounded-[32px] border overflow-hidden shadow-sm ${
                  isActive ? 'border-blue-500' : isSelected ? 'border-slate-300' : 'border-slate-100'
                }`}>
                  <TouchableOpacity
                    onPress={() => toggleSelection(item)}
                    activeOpacity={0.8}
                    className="p-6"
                  >
                    <View className="flex-row justify-between items-start mb-4">
                      <View className="flex-1 mr-4">
                        <Text className="text-xl font-black text-slate-900 mb-1">{item.name}</Text>
                        <View className="flex-row items-center">
                          <View className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 mr-2">
                            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {item.mode}
                            </Text>
                          </View>
                          <Text className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                            {item.duration} Cycles
                          </Text>
                        </View>
                      </View>
                      {isActive && (
                        <View className="bg-green-50 px-3 py-1 rounded-full border border-green-100">
                          <Text className="text-green-600 text-[10px] font-black uppercase tracking-widest">Active</Text>
                        </View>
                      )}
                    </View>
                    
                    <View className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden mb-2">
                      <View 
                        className="h-full bg-blue-600 rounded-full" 
                        style={{ width: `${Math.min((item.cycle_count / (item.duration || 1)) * 100, 100)}%` }} 
                      />
                    </View>
                    <Text className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      Cycle {item.cycle_count} of {item.duration}
                    </Text>
                  </TouchableOpacity>

                  {isSelected && (
                    <View className="bg-slate-50 px-6 py-6 border-t border-slate-100">
                      <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Adjust Plan Duration</Text>
                      <View className="flex-row space-x-3">
                        <View className="flex-1 bg-white rounded-2xl border border-slate-200 px-4 py-3 flex-row items-center">
                          <TextInput
                            className="flex-1 text-slate-900 font-black text-lg p-0"
                            keyboardType="numeric"
                            value={customDuration}
                            onChangeText={setCustomDuration}
                            placeholder="0"
                          />
                          <Text className="text-[10px] font-black text-slate-300 uppercase ml-2">Cycles</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleSelect(item.id, parseInt(customDuration) || item.duration)}
                          className="bg-slate-900 px-6 rounded-2xl justify-center items-center shadow-lg shadow-slate-200"
                        >
                          <Text className="text-white font-black uppercase tracking-widest text-[10px]">
                            {isActive ? 'Update' : 'Activate'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {isActive && (
                        <TouchableOpacity 
                          onPress={() => handleSelect(item.id)}
                          className="mt-4 self-center"
                        >
                          <Text className="text-rose-500 font-black text-[10px] uppercase tracking-widest">Deactivate Blueprint</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            }}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
};
