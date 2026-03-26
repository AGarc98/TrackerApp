import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Exercise, MuscleGroup, ExerciseWithMuscle } from '../types/database';

interface ExerciseSelectorProps {
  exercises: ExerciseWithMuscle[];
  onSelect: (exercise: ExerciseWithMuscle) => void;
  onClose: () => void;
  excludeIds?: string[];
}

export const ExerciseSelector: React.FC<ExerciseSelectorProps> = ({ 
  exercises, 
  onSelect, 
  onClose, 
  excludeIds = [] 
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredExercises = exercises.filter(ex => {
    const searchLower = searchQuery.toLowerCase();
    const matchesName = (ex.name?.toLowerCase() || '').includes(searchLower);
    const matchesPrimary = (ex.muscle_group?.toLowerCase() || '').includes(searchLower);
    const matchesSecondary = ex.muscle_groups?.some(mg => mg.toLowerCase().includes(searchLower)) || false;
    
    const isNotExcluded = !excludeIds.includes(ex.id);
    return (matchesName || matchesPrimary || matchesSecondary) && isNotExcluded;
  });

  return (
    <View className="flex-1 bg-background">
      <View className="p-6 pt-10">
        <Text className="text-2xl font-black text-text-main mb-2 tracking-tighter">Swap Exercise</Text>
        <Text className="text-text-muted font-medium mb-6 leading-5">Select an alternative to replace this movement for the current session.</Text>

        <TextInput
          className="bg-surface border border-border rounded-2xl p-5 mb-6 font-bold text-text-main text-lg shadow-sm"
          placeholder="Search movements or muscle groups..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="var(--color-text-muted)"
        />

        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
              className="bg-surface p-6 mb-4 rounded-[32px] border border-border shadow-sm"
            >
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-black text-text-main flex-1 mr-4 tracking-tight leading-tight">{item.name}</Text>
                <View className="bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/10">
                  <Text className="text-[10px] font-black text-primary uppercase tracking-widest">{item.muscle_group}</Text>
                </View>
              </View>
              {item.description && (
                <Text className="text-text-muted text-xs font-medium leading-5" numberOfLines={3}>
                  {item.description}
                </Text>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="py-20 items-center">
              <View className="w-12 h-12 bg-background rounded-2xl items-center justify-center mb-4 border border-border">
                <Text className="text-lg">🔍</Text>
              </View>
              <Text className="text-text-muted font-black uppercase tracking-widest text-[10px]">No movements found in vault</Text>
            </View>
          }
        />
      </View>
    </View>
  );
};
