import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { DB } from '../database/db';
import { Workout, Exercise } from '../types/database';

interface WorkoutSelectorProps {
  routineId?: string | null;
  onSelect: (workout: Workout, exercises: { exercise: Exercise; target_sets: number; target_reps: number | null; target_weight?: number | null }[]) => void;
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
      const result = DB.getAll<Workout>('SELECT * FROM Workouts ORDER BY name ASC;');
      setWorkouts(result);
    } catch (error) {
      console.error('Failed to load all workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (workout: Workout) => {
    try {
      const exResult = DB.getAll<any>(
        `SELECT we.*, e.name, e.description, e.type, e.default_rest_duration, e.last_modified as exercise_last_modified, emg.muscle_group
         FROM Workout_Exercises we 
         JOIN Exercises e ON we.exercise_id = e.id 
         LEFT JOIN Exercise_Muscle_Groups emg ON e.id = emg.exercise_id AND emg.is_primary = 1
         WHERE we.workout_id = ? 
         ORDER BY we.order_index ASC;`,
        [workout.id]
      );
      
      const workoutExercises = exResult.map((we: any) => ({
        exercise: {
          id: we.exercise_id,
          name: we.name,
          description: we.description,
          type: we.type,
          muscle_group: we.muscle_group,
          last_modified: we.exercise_last_modified,
          default_rest_duration: we.default_rest_duration || 90
        } as any,
        target_sets: we.target_sets,
        target_reps: we.target_reps,
        target_weight: we.target_weight
      }));

      onSelect(workout, workoutExercises);
    } catch (error) {
      console.error('Failed to load exercises for workout:', error);
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
    <View className="flex-1 bg-background">
      <View className="p-6 pt-10">
        <Text className="text-2xl font-black text-text-main mb-2">Select Workout</Text>
        <Text className="text-text-muted font-medium mb-6">Choose a workout to start.</Text>

        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
              className="bg-surface p-6 mb-4 rounded-[32px] border border-border shadow-sm"
            >
              <Text className="text-xl font-black text-text-main mb-1">{item.name}</Text>
              <View className="bg-background self-start px-2 py-1 rounded-md">
                <Text className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Workout Blueprint</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
};
