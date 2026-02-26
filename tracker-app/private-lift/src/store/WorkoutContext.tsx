import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import db, { query } from '../database/db';
import { ActiveSession, DraftSet, SetData, Exercise, Workout, UserSettings } from '../types/database';

interface WorkoutContextType {
  activeSession: ActiveSession | null;
  draftSets: Record<string, SetData[]>;
  isLoading: boolean;
  startWorkout: (workout: Workout, exercises: { exercise: Exercise; target_sets: number; target_reps: number }[]) => Promise<void>;
  logSet: (exerciseId: string, sets: SetData[]) => Promise<void>;
  swapExercise: (oldExerciseId: string, newExerciseId: string) => Promise<void>;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => Promise<void>;
  resumeWorkout: () => Promise<void>;
  setActiveRoutine: (routineId: string | null) => Promise<void>;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [draftSets, setDraftSets] = useState<Record<string, SetData[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadDrafts = useCallback(async () => {
    try {
      const sessionResult = query('SELECT * FROM Active_Session LIMIT 1;');
      const session = sessionResult.rows?._array[0] as ActiveSession | undefined;

      if (session) {
        setActiveSession(session);
        const draftsResult = query('SELECT * FROM Draft_Sets WHERE session_id = ?;', [session.id]);
        const drafts = draftsResult.rows?._array as DraftSet[];
        
        const setsMap: Record<string, SetData[]> = {};
        drafts.forEach(d => {
          setsMap[d.exercise_id] = JSON.parse(d.input_data);
        });
        setDraftSets(setsMap);
      } else {
        setActiveSession(null);
        setDraftSets({});
      }
    } catch (error) {
      console.error('Failed to load drafts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const setActiveRoutine = async (routineId: string | null) => {
    try {
      query('UPDATE User_Settings SET active_routine_id = ? WHERE id = 1;', [routineId]);
    } catch (error) {
      console.error('Failed to set active routine:', error);
    }
  };

  const startWorkout = async (workout: Workout, exercises: { exercise: Exercise; target_sets: number; target_reps: number }[]) => {
    try {
      const sessionId = Math.random().toString(36).substring(2, 15);
      const timestamp = Date.now();

      db.withTransactionSync(() => {
        db.runSync('DELETE FROM Active_Session;');
        db.runSync('DELETE FROM Draft_Sets;');

        db.runSync(
          'INSERT INTO Active_Session (id, workout_id, timestamp, is_swapped) VALUES (?, ?, ?, 0);',
          [sessionId, workout.id, timestamp]
        );

        const initialDrafts: Record<string, SetData[]> = {};
        exercises.forEach(ex => {
          const sets: SetData[] = Array.from({ length: ex.target_sets }, () => ({
            id: Math.random().toString(36).substring(2, 9),
            is_skipped: false,
            is_completed: false,
            reps: ex.target_reps // Pre-fill goal reps
          }));
          initialDrafts[ex.exercise.id] = sets;

          db.runSync(
            'INSERT INTO Draft_Sets (id, session_id, exercise_id, input_data) VALUES (?, ?, ?, ?);',
            [Math.random().toString(36).substring(2, 15), sessionId, ex.exercise.id, JSON.stringify(sets)]
          );
        });

        setActiveSession({ id: sessionId, workout_id: workout.id, timestamp, is_swapped: false });
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
      query(
        'UPDATE Draft_Sets SET input_data = ? WHERE session_id = ? AND exercise_id = ?;',
        [JSON.stringify(sets), activeSession.id, exerciseId]
      );
      setDraftSets(prev => ({ ...prev, [exerciseId]: sets }));
    } catch (error) {
      console.error('Failed to log set:', error);
    }
  };

  const swapExercise = async (oldExerciseId: string, newExerciseId: string) => {
    if (!activeSession) return;
    try {
      db.withTransactionSync(() => {
        const oldSets = draftSets[oldExerciseId] || [];
        const newSets: SetData[] = oldSets.map(s => ({
          ...s,
          is_completed: false,
        }));

        db.runSync('DELETE FROM Draft_Sets WHERE session_id = ? AND exercise_id = ?;', [activeSession.id, oldExerciseId]);
        db.runSync(
          'INSERT INTO Draft_Sets (id, session_id, exercise_id, input_data) VALUES (?, ?, ?, ?);',
          [Math.random().toString(36).substring(2, 15), activeSession.id, newExerciseId, JSON.stringify(newSets)]
        );
        db.runSync('UPDATE Active_Session SET is_swapped = 1 WHERE id = ?;', [activeSession.id]);

        setDraftSets(prev => {
          const next = { ...prev };
          delete next[oldExerciseId];
          next[newExerciseId] = newSets;
          return next;
        });
        setActiveSession(prev => prev ? { ...prev, is_swapped: true } : null);
      });
    } catch (error) {
      console.error('Failed to swap exercise:', error);
    }
  };

  const finishWorkout = async () => {
    if (!activeSession) return;

    try {
      db.withTransactionSync(() => {
        db.runSync(
          'INSERT INTO Logged_Sessions (id, workout_id, timestamp, is_swapped) VALUES (?, ?, ?, ?);',
          [activeSession.id, activeSession.workout_id, activeSession.timestamp, activeSession.is_swapped ? 1 : 0]
        );

        Object.entries(draftSets).forEach(([exerciseId, sets]) => {
          sets.forEach(set => {
            if (set.is_completed || set.is_skipped) {
              db.runSync(
                'INSERT INTO Logged_Sets (id, session_id, exercise_id, weight, reps, time_ms, is_skipped) VALUES (?, ?, ?, ?, ?, ?, ?);',
                [
                  Math.random().toString(36).substring(2, 15),
                  activeSession.id,
                  exerciseId,
                  set.weight || null,
                  set.reps || null,
                  set.time_ms || null,
                  set.is_skipped ? 1 : 0
                ]
              );
            }
          });
        });

        // Update progress if active routine is set
        const settingsRes = db.getAllSync('SELECT active_routine_id FROM User_Settings WHERE id = 1;');
        const activeRoutineId = (settingsRes[0] as any)?.active_routine_id;
        
        if (activeRoutineId) {
          // Increment cycle count logic (simplified for MVP)
          db.runSync('UPDATE Routines SET cycle_count = cycle_count + 1 WHERE id = ?;', [activeRoutineId]);
        }

        db.runSync('DELETE FROM Active_Session WHERE id = ?;', [activeSession.id]);
        db.runSync('DELETE FROM Draft_Sets WHERE session_id = ?;', [activeSession.id]);

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
              db.runSync('DELETE FROM Draft_Sets WHERE session_id = ?;', [activeSession.id]);
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
    await loadDrafts();
  };

  return (
    <WorkoutContext.Provider
      value={{
        activeSession,
        draftSets,
        isLoading,
        startWorkout,
        logSet,
        swapExercise,
        finishWorkout,
        discardWorkout,
        resumeWorkout,
        setActiveRoutine,
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
