import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Exercise } from '../types/database';

interface ExerciseSelectorProps {
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
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
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ex.muscle_group.toLowerCase().includes(searchQuery.toLowerCase());
    const isNotExcluded = !excludeIds.includes(ex.id);
    return matchesSearch && isNotExcluded;
  });

  return (
    <View className="flex-1 bg-slate-50">
      <View className="p-6 pt-10">
        <Text className="text-2xl font-black text-slate-900 mb-2">Swap Exercise</Text>
        <Text className="text-slate-400 font-medium mb-6">Select an alternative to replace this movement.</Text>

        <TextInput
          className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 font-bold text-slate-900"
          placeholder="Search movements or muscle groups..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />

        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
              className="bg-white p-6 mb-4 rounded-[32px] border border-slate-100 shadow-sm"
            >
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-xl font-black text-slate-900 flex-1 mr-2">{item.name}</Text>
                <View className="bg-blue-50 px-2 py-1 rounded-lg">
                  <Text className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{item.muscle_group}</Text>
                </View>
              </View>
              {item.description && (
                <Text className="text-slate-400 text-xs font-medium leading-4" numberOfLines={2}>
                  {item.description}
                </Text>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="py-20 items-center">
              <Text className="text-slate-400 font-bold uppercase tracking-widest text-xs">No movements found</Text>
            </View>
          }
        />
      </View>
    </View>
  );
};
