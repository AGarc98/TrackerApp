import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import db, { query } from '../database/db';
import { ActiveSession, SetData, Exercise, Workout, UserSettings } from '../types/database';

interface WorkoutContextType {
  activeSession: ActiveSession | null;
  activeRoutineId: string | null;
  draftSets: Record<string, SetData[]>;
  isLoading: boolean;
  settings: UserSettings | null;
  startWorkout: (workout: Workout, exercises: { exercise: Exercise; target_sets: number; target_reps: number }[], routineId?: string | null) => Promise<void>;
  logSet: (exerciseId: string, sets: SetData[]) => Promise<void>;
  swapExercise: (oldExerciseId: string, newExerciseId: string) => Promise<void>;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => Promise<void>;
  resumeWorkout: () => Promise<void>;
  setActiveRoutine: (routineId: string | null, duration?: number) => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

// Robust ID generation for local environment
const generateId = () => {
  const S4 = () => (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  return `${S4()}${S4()}-${S4()}-${S4()}-${S4()}-${S4()}${S4()}${S4()}`;
};

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);
  const [draftSets, setDraftSets] = useState<Record<string, SetData[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const loadData = useCallback(async () => {
    try {
      const sessionResult = query('SELECT * FROM Active_Session LIMIT 1;');
      const session = sessionResult.rows?._array[0] as ActiveSession | undefined;

      const settingsResult = query('SELECT * FROM User_Settings WHERE id = 1;');
      const s = settingsResult.rows?._array[0] as any;
      if (s) {
        const formattedSettings: UserSettings = {
          ...s,
          rest_timer_enabled: !!s.rest_timer_enabled,
          rest_timer_sound: !!s.rest_timer_sound,
          calendar_sync_enabled: !!s.calendar_sync_enabled,
        };
        setSettings(formattedSettings);
        setActiveRoutineId(formattedSettings.active_routine_id);
      }

      if (session) {
        setActiveSession(session);
        if (session.draft_data) {
          try {
            setDraftSets(JSON.parse(session.draft_data));
          } catch (e) {
            console.error('Failed to parse draft_data:', e);
            setDraftSets({});
          }
        }
      } else {
        setActiveSession(null);
        setDraftSets({});
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setActiveRoutine = async (routineId: string | null, duration?: number) => {
    try {
      const lastModified = Date.now();
      query('UPDATE User_Settings SET active_routine_id = ?, last_modified = ? WHERE id = 1;', [routineId, lastModified]);
      
      if (routineId && duration !== undefined) {
        query('UPDATE Routines SET duration = ?, last_modified = ? WHERE id = ?;', [duration, lastModified, routineId]);
      }

      setActiveRoutineId(routineId);
      setSettings(prev => prev ? { ...prev, active_routine_id: routineId } : null);
    } catch (error) {
      console.error('Failed to set active routine:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      const lastModified = Date.now();
      const updates = { ...newSettings, last_modified: lastModified };
      
      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'id') return;
        const dbValue = typeof value === 'boolean' ? (value ? 1 : 0) : value;
        query(`UPDATE User_Settings SET ${key} = ? WHERE id = 1;`, [dbValue]);
      });

      setSettings(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const startWorkout = async (workout: Workout, exercises: { exercise: Exercise; target_sets: number; target_reps: number }[], routineId: string | null = null) => {
    try {
      const sessionId = generateId();
      const timestamp = Date.now();
      const lastModified = timestamp;

      const initialDrafts: Record<string, SetData[]> = {};
      exercises.forEach(ex => {
        initialDrafts[ex.exercise.id] = Array.from({ length: ex.target_sets }, () => ({
          id: generateId().substring(0, 8),
          is_skipped: false,
          is_completed: false,
          reps: ex.target_reps
        }));
      });

      const draftData = JSON.stringify(initialDrafts);

      db.withTransactionSync(() => {
        db.runSync('DELETE FROM Active_Session;');

        db.runSync(
          'INSERT INTO Active_Session (id, workout_id, routine_id, timestamp, is_swapped, draft_data, last_modified) VALUES (?, ?, ?, ?, 0, ?, ?);',
          [sessionId, workout.id, routineId, timestamp, draftData, lastModified]
        );

        setActiveSession({ id: sessionId, workout_id: workout.id, routine_id: routineId, timestamp, is_swapped: false, draft_data: draftData, last_modified: lastModified });
        setDraftSets(initialDrafts);
      });
    } catch (error) {
      console.error('Failed to start workout:', error);
      Alert.alert('Error', 'Failed to start workout.');
    }
  };

  const logSet = async (exerciseId: string, sets: SetData[]) => {
    if (!activeSession) return;
    try {
      const newDraftSets = { ...draftSets, [exerciseId]: sets };
      const draftData = JSON.stringify(newDraftSets);
      const lastModified = Date.now();

      query(
        'UPDATE Active_Session SET draft_data = ?, last_modified = ? WHERE id = ?;',
        [draftData, lastModified, activeSession.id]
      );
      setDraftSets(newDraftSets);
      setActiveSession(prev => prev ? { ...prev, draft_data: draftData, last_modified: lastModified } : null);
    } catch (error) {
      console.error('Failed to log set:', error);
    }
  };

  const swapExercise = async (oldExerciseId: string, newExerciseId: string) => {
    if (!activeSession) return;
    try {
      const lastModified = Date.now();
      const oldSets = draftSets[oldExerciseId] || [];
      const newSets: SetData[] = oldSets.map(s => ({
        ...s,
        id: generateId().substring(0, 8), // New IDs for swapped movement sets
        is_completed: false,
      }));

      const newDraftSets = { ...draftSets };
      delete newDraftSets[oldExerciseId];
      newDraftSets[newExerciseId] = newSets;
      const draftData = JSON.stringify(newDraftSets);

      db.withTransactionSync(() => {
        db.runSync(
          'UPDATE Active_Session SET draft_data = ?, is_swapped = 1, last_modified = ? WHERE id = ?;',
          [draftData, lastModified, activeSession.id]
        );

        setDraftSets(newDraftSets);
        setActiveSession(prev => prev ? { ...prev, is_swapped: true, draft_data: draftData, last_modified: lastModified } : null);
      });
    } catch (error) {
      console.error('Failed to swap exercise:', error);
    }
  };

  const finishWorkout = async () => {
    if (!activeSession) return;

    try {
      const lastModified = Date.now();
      db.withTransactionSync(() => {
        db.runSync(
          'INSERT INTO Logged_Sessions (id, workout_id, routine_id, timestamp, is_swapped, last_modified) VALUES (?, ?, ?, ?, ?, ?);',
          [activeSession.id, activeSession.workout_id, activeSession.routine_id, activeSession.timestamp, activeSession.is_swapped ? 1 : 0, lastModified]
        );

        Object.entries(draftSets).forEach(([exerciseId, sets]) => {
          sets.forEach(set => {
            if (set.is_completed || set.is_skipped) {
              db.runSync(
                'INSERT INTO Logged_Sets (id, session_id, exercise_id, weight, reps, time_ms, is_skipped, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
                [
                  generateId(),
                  activeSession.id,
                  exerciseId,
                  set.weight || null,
                  set.reps || null,
                  set.time_ms || null,
                  set.is_skipped ? 1 : 0,
                  lastModified
                ]
              );
            }
          });
        });

        // PROGRESS TRACKING LOGIC
        if (activeSession.routine_id) {
          // Count how many workouts in the routine
          const countRes = db.getAllSync('SELECT COUNT(*) as count FROM Routine_Workouts WHERE routine_id = ?;', [activeSession.routine_id]);
          const routineWorkoutCount = (countRes[0] as any)?.count || 1;

          // Count how many logged sessions for this routine
          const loggedRes = db.getAllSync('SELECT COUNT(*) as count FROM Logged_Sessions WHERE routine_id = ?;', [activeSession.routine_id]);
          const sessionsLogged = (loggedRes[0] as any)?.count || 0;

          // If we just finished the last workout of a cycle, increment cycle_count
          if (sessionsLogged > 0 && sessionsLogged % routineWorkoutCount === 0) {
            db.runSync('UPDATE Routines SET cycle_count = cycle_count + 1, last_modified = ? WHERE id = ?;', [lastModified, activeSession.routine_id]);
          }
        }

        db.runSync('DELETE FROM Active_Session WHERE id = ?;', [activeSession.id]);

        setActiveSession(null);
        setDraftSets({});
      });
      Alert.alert('Success', 'Workout vault updated.');
    } catch (error) {
      console.error('Failed to finish workout:', error);
      Alert.alert('Error', 'Atomic commit failed.');
    }
  };

  const discardWorkout = async () => {
    if (!activeSession) return;
    Alert.alert('Discard Session', 'This will purge all unsaved draft data. Proceed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          try {
            db.withTransactionSync(() => {
              db.runSync('DELETE FROM Active_Session WHERE id = ?;', [activeSession.id]);
              setActiveSession(null);
              setDraftSets({});
            });
          } catch (error) {
            console.error('Failed to discard workout:', error);
          }
        },
      },
    ]);
  };

  const resumeWorkout = async () => {
    setIsLoading(true);
    await loadData();
  };

  return (
    <WorkoutContext.Provider
      value={{
        activeSession,
        activeRoutineId,
        draftSets,
        isLoading,
        settings,
        startWorkout,
        logSet,
        swapExercise,
        finishWorkout,
        discardWorkout,
        resumeWorkout,
        setActiveRoutine,
        updateSettings,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
};

export const useWorkout = () => {
  const context = useContext(WorkoutContext);
  if (context === undefined) {
    throw new Error('useWorkout must be used within a WorkoutProvider');
  }
  return context;
};
