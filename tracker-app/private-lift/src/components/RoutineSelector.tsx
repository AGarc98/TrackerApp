import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { DB } from '../database/db';
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
      const result = DB.getAll<Routine>('SELECT * FROM Routines ORDER BY name ASC;');
      setRoutines(result);
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
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      className="flex-1 bg-background"
    >
      <View className="p-6 pt-10 flex-1">
        <Text className="text-2xl font-black text-text-main mb-2 tracking-tighter">Select Training Plan</Text>
        <Text className="text-text-muted font-medium mb-6 leading-5">Choose a blueprint and calibrate its duration for your current objective.</Text>

        {routines.length === 0 ? (
          <View className="bg-surface p-10 rounded-[40px] items-center border border-border shadow-sm">
            <View className="w-16 h-16 bg-background rounded-2xl items-center justify-center mb-6 border border-border">
              <Text className="text-2xl">🏗️</Text>
            </View>
            <Text className="text-text-main font-black text-center mb-2">Vault Empty</Text>
            <Text className="text-text-muted text-xs text-center leading-4">Head to the Architect Zone to forge your first training sequence.</Text>
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
                <View className={`bg-surface mb-4 rounded-[32px] border overflow-hidden shadow-sm ${
                  isActive ? 'border-primary' : isSelected ? 'border-text-muted' : 'border-border'
                }`}>
                  <TouchableOpacity
                    onPress={() => toggleSelection(item)}
                    activeOpacity={0.8}
                    className="p-6"
                  >
                    <View className="flex-row justify-between items-start mb-4">
                      <View className="flex-1 mr-4">
                        <Text className="text-xl font-black text-text-main mb-1">{item.name}</Text>
                        <View className="flex-row items-center">
                          <View className="bg-background px-2 py-1 rounded-lg border border-border mr-2">
                            <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                              {item.mode}
                            </Text>
                          </View>
                          <Text className="text-[10px] font-black text-primary uppercase tracking-widest">
                            {item.duration} Cycles
                          </Text>
                        </View>
                      </View>
                      {isActive && (
                        <View className="bg-success/10 px-3 py-1 rounded-full border border-success/20">
                          <Text className="text-success text-[10px] font-black uppercase tracking-widest">Active</Text>
                        </View>
                      )}
                    </View>
                    
                    <View className="w-full h-1.5 bg-background rounded-full overflow-hidden mb-2">
                      <View 
                        className="h-full bg-primary rounded-full" 
                        style={{ width: `${Math.min((item.cycle_count / (item.duration || 1)) * 100, 100)}%` }} 
                      />
                    </View>
                    <Text className="text-[10px] font-black text-text-muted/50 uppercase tracking-widest">
                      Cycle {item.cycle_count} of {item.duration}
                    </Text>
                  </TouchableOpacity>

                  {isSelected && (
                    <View className="bg-background px-6 py-6 border-t border-border">
                      <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-3">Adjust Plan Duration</Text>
                      <View className="flex-row space-x-3">
                        <View className="flex-1 bg-surface rounded-2xl border border-border px-4 py-3 flex-row items-center">
                          <TextInput
                            className="flex-1 text-text-main font-black text-lg p-0"
                            keyboardType="numeric"
                            value={customDuration}
                            onChangeText={setCustomDuration}
                            placeholder="0"
                            placeholderTextColor="var(--color-text-muted)"
                          />
                          <Text className="text-[10px] font-black text-text-muted/50 uppercase ml-2">Cycles</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleSelect(item.id, parseInt(customDuration) || item.duration)}
                          className="bg-primary px-6 rounded-2xl justify-center items-center shadow-lg shadow-primary/20"
                        >
                          <Text className="text-surface font-black uppercase tracking-widest text-[10px]">
                            {isActive ? 'Update' : 'Activate'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {isActive && (
                        <TouchableOpacity 
                          onPress={() => handleSelect(item.id)}
                          className="mt-4 self-center"
                        >
                          <Text className="text-accent font-black text-[10px] uppercase tracking-widest">Deactivate Blueprint</Text>
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
