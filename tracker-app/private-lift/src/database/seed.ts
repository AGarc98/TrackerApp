import db, { query } from './db';
import seedData from './data/seed-data.json';

export const seedDatabase = async () => {
  try {
    // 1. Seed Exercises
    const exerciseCount = (query('SELECT COUNT(*) as count FROM Exercises WHERE is_base_content = 1;').rows?._array[0] as any)?.count || 0;

    if (exerciseCount === 0) {
      console.log('Seeding base exercises...');
      db.withTransactionSync(() => {
        for (const ex of seedData.exercises) {
          db.runSync(
            'INSERT INTO Exercises (id, name, description, type, muscle_group, is_base_content, last_modified) VALUES (?, ?, ?, ?, ?, 1, ?);',
            [ex.id, ex.name, ex.description, ex.type, ex.muscle_group, Date.now()]
          );
        }
      });
    }

    // 2. Seed Workouts and Workout_Exercises
    const workoutCount = (query('SELECT COUNT(*) as count FROM Workouts;').rows?._array[0] as any)?.count || 0;
    if (workoutCount === 0) {
      console.log('Seeding base workouts...');
      db.withTransactionSync(() => {
        for (const w of seedData.workouts) {
          db.runSync('INSERT INTO Workouts (id, name, last_modified) VALUES (?, ?, ?);', [w.id, w.name, Date.now()]);
          for (const we of w.exercises) {
            db.runSync(
              'INSERT INTO Workout_Exercises (id, workout_id, exercise_id, order_index, target_sets, target_reps, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?);',
              [Math.random().toString(36).substring(2, 15), w.id, we.exercise_id, we.order_index, we.target_sets, we.target_reps, Date.now()]
            );
          }
        }
      });
    }

    // 3. Seed Routines and Routine_Workouts
    const routineCount = (query('SELECT COUNT(*) as count FROM Routines;').rows?._array[0] as any)?.count || 0;
    if (routineCount === 0) {
      console.log('Seeding base routines...');
      db.withTransactionSync(() => {
        for (const r of seedData.routines) {
          db.runSync(
            'INSERT INTO Routines (id, name, mode, duration, cycle_count, last_modified) VALUES (?, ?, ?, ?, ?, ?);',
            [r.id, r.name, r.mode, r.duration, 0, Date.now()]
          );
          for (const rw of r.workouts) {
            db.runSync(
              'INSERT INTO Routine_Workouts (id, routine_id, workout_id, order_index, last_modified) VALUES (?, ?, ?, ?, ?);',
              [Math.random().toString(36).substring(2, 15), r.id, rw.workout_id, rw.order_index, Date.now()]
            );
          }
        }
      });
    }

    // 4. Initialize User Settings
    const settingsCount = (query('SELECT COUNT(*) as count FROM User_Settings;').rows?._array[0] as any)?.count || 0;
    if (settingsCount === 0) {
      console.log('Initializing user settings...');
      query(
        'INSERT INTO User_Settings (id, unit_system, rest_timer_enabled, rest_timer_sound, calendar_sync_enabled, last_modified) VALUES (1, "KG", 1, 1, 0, ?);',
        [Date.now()]
      );
    }
    
    console.log('Database seeding check completed.');
  } catch (error) {
    console.error('Failed to seed database:', error);
  }
};
