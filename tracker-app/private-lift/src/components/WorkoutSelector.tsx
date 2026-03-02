import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { query } from '../database/db';
import { Workout, Exercise } from '../types/database';

interface WorkoutSelectorProps {
  routineId: string;
  onSelect: (workout: Workout, exercises: { exercise: Exercise; target_sets: number; target_reps: number }[]) => void;
  onClose: () => void;
}

export const WorkoutSelector: React.FC<WorkoutSelectorProps> = ({ routineId, onSelect, onClose }) => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkouts();
  }, [routineId]);

  const loadWorkouts = async () => {
    try {
      const result = query(
        `SELECT w.* FROM Workouts w 
         JOIN Routine_Workouts rw ON w.id = rw.workout_id 
         WHERE rw.routine_id = ? 
         ORDER BY rw.order_index ASC;`,
        [routineId]
      ) as any;
      setWorkouts(result.rows?._array || []);
    } catch (error) {
      console.error('Failed to load workouts for routine:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (workout: Workout) => {
    try {
      const exResult = query(
        `SELECT we.*, e.name, e.description, e.type, e.muscle_group, e.is_base_content, e.last_modified 
         FROM Workout_Exercises we 
         JOIN Exercises e ON we.exercise_id = e.id 
         WHERE we.workout_id = ? 
         ORDER BY we.order_index ASC;`,
        [workout.id]
      );
      
      const workoutExercises = (exResult.rows?._array || []).map((we: any) => ({
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

      onSelect(workout, workoutExercises);
    } catch (error) {
      console.error('Failed to load exercises for workout:', error);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <View className="p-6 pt-10">
        <Text className="text-2xl font-black text-slate-900 mb-2">Swap Workout</Text>
        <Text className="text-slate-400 font-medium mb-6">Select a different blueprint for this session.</Text>

        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
              className="bg-white p-6 mb-4 rounded-[32px] border border-slate-100 shadow-sm"
            >
              <Text className="text-xl font-black text-slate-900 mb-1">{item.name}</Text>
              <View className="bg-slate-100 self-start px-2 py-1 rounded-md">
                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Workout Blueprint</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
};
