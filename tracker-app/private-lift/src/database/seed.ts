import { query } from './db';
import { MuscleGroup, ExerciseType } from '../types/database';

const BASE_EXERCISES = [
  { name: 'Bench Press', muscle_group: MuscleGroup.CHEST, type: ExerciseType.STRENGTH, description: 'Standard barbell bench press' },
  { name: 'Pull Ups', muscle_group: MuscleGroup.BACK, type: ExerciseType.BODYWEIGHT, description: 'Wide grip pull ups' },
  { name: 'Overhead Press', muscle_group: MuscleGroup.SHOULDERS, type: ExerciseType.STRENGTH, description: 'Standing barbell overhead press' },
  { name: 'Barbell Squat', muscle_group: MuscleGroup.LEGS_QUADS, type: ExerciseType.STRENGTH, description: 'Back squat with barbell' },
  { name: 'Deadlift', muscle_group: MuscleGroup.BACK, type: ExerciseType.STRENGTH, description: 'Conventional barbell deadlift' },
  { name: 'Bicep Curls', muscle_group: MuscleGroup.BICEPS, type: ExerciseType.STRENGTH, description: 'Dumbbell bicep curls' },
  { name: 'Tricep Extensions', muscle_group: MuscleGroup.TRICEPS, type: ExerciseType.STRENGTH, description: 'Overhead dumbbell tricep extension' },
  { name: 'Calf Raises', muscle_group: MuscleGroup.CALVES, type: ExerciseType.STRENGTH, description: 'Standing calf raises' },
  { name: 'Plank', muscle_group: MuscleGroup.CORE, type: ExerciseType.ISOMETRIC, description: 'Standard forearm plank' },
  { name: 'Running', muscle_group: MuscleGroup.CARDIO, type: ExerciseType.ENDURANCE, description: 'Jogging or running' },
];

export const seedDatabase = async () => {
  try {
    const result = query('SELECT COUNT(*) as count FROM Exercises WHERE is_base_content = 1;');
    // result.rows is an array of objects
    const count = (result.rows?._array[0] as any)?.count || 0;

    if (count === 0) {
      console.log('Seeding base exercises...');
      for (const ex of BASE_EXERCISES) {
        const id = Math.random().toString(36).substring(2, 15); // Simple ID generation
        query(
          'INSERT INTO Exercises (id, name, description, type, muscle_group, is_base_content, last_modified) VALUES (?, ?, ?, ?, ?, 1, ?);',
          [id, ex.name, ex.description, ex.type, ex.muscle_group, Date.now()]
        );
      }
      console.log('Seeding completed.');
    }
  } catch (error) {
    console.error('Failed to seed database:', error);
  }
};
