import db, { DB } from './db';
import seedData from './data/seed-data.json';

export const seedDatabase = async () => {
  try {
    console.log('Starting atomic database seeding...');
    const now = Date.now();

    DB.transaction(() => {
      // 1. Seed Exercises
      for (const ex of seedData.exercises) {
        DB.run(
          'INSERT OR IGNORE INTO Exercises (id, name, description, type, last_modified) VALUES (?, ?, ?, ?, ?);',
          [ex.id, ex.name, ex.description, ex.type, now]
        );

        // 2. Seed Muscle Groups for this specific exercise
        if (ex.muscle_groups && Array.isArray(ex.muscle_groups)) {
          ex.muscle_groups.forEach((mg, index) => {
            const mgId = `${ex.id}-mg-${index}`; 
            DB.run(
              'INSERT OR IGNORE INTO Exercise_Muscle_Groups (id, exercise_id, muscle_group, is_primary, last_modified) VALUES (?, ?, ?, ?, ?);',
              [
                mgId,
                ex.id,
                mg.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_'),
                index === 0 ? 1 : 0,
                now
              ]
            );
          });
        }
      }

      // 3. Seed Workouts
      for (const w of seedData.workouts) {
        DB.run(
          'INSERT OR IGNORE INTO Workouts (id, name, description, last_modified) VALUES (?, ?, ?, ?);', 
          [w.id, w.name, w.description || null, now]
        );
        
        // 4. Seed Workout Exercises for this workout
        if (w.exercises) {
          w.exercises.forEach((we: any, index) => {
            const weId = `${w.id}-we-${index}`;
            DB.run(
              'INSERT OR IGNORE INTO Workout_Exercises (id, workout_id, exercise_id, order_index, target_sets, target_reps, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?);',
              [
                weId, 
                w.id, 
                we.exercise_id, 
                we.order_index ?? index, 
                we.target_sets, 
                we.target_reps, 
                now
              ]
            );
          });
        }
      }

      // 5. Seed Routines
      for (const r of seedData.routines) {
        DB.run(
          'INSERT OR IGNORE INTO Routines (id, name, description, mode, duration, cycle_count, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?);',
          [r.id, r.name, r.description || null, r.mode, r.duration, 0, now]
        );
        
        // 6. Seed Routine Workouts for this routine
        if (r.workouts) {
          r.workouts.forEach((rw: any, index) => {
            const rwId = `${r.id}-rw-${index}`;
            const dayOfWeek = typeof rw.day_of_week === 'number' ? rw.day_of_week - 1 : null;
            DB.run(
              'INSERT OR IGNORE INTO Routine_Workouts (id, routine_id, workout_id, day_of_week, week_number, order_index, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?);',
              [
                rwId, 
                r.id, 
                rw.workout_id, 
                dayOfWeek,
                rw.week_number ?? 1,
                rw.order_index ?? index, 
                now
              ]
            );
          });
        }
      }

      // 7. Initialize User Settings if missing
      DB.run(
        'INSERT OR IGNORE INTO User_Settings (id, weight_unit, theme, last_modified) VALUES (1, "KG", "base", ?);',
        [now]
      );
    });

    console.log('Database seeding completed successfully.');
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw error; // Re-throw to handle in App.tsx
  }
};
