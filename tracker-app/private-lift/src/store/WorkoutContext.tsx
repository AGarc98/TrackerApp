import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import db, { DB } from '../database/db';
import { ActiveSession, SetData, Exercise, Workout, UserSettings, SetType } from '../types/database';

interface WorkoutContextType {
  activeSession: ActiveSession | null;
  activeRoutineId: string | null;
  draftSets: Record<string, SetData[]>;
  isLoading: boolean;
  settings: UserSettings | null;
  startWorkout: (workout: Workout, exercises: { exercise: Exercise; target_sets: number; target_reps: number | null; target_weight?: number | null }[], routineId?: string | null) => Promise<void>;
  logSet: (exerciseId: string, sets: SetData[]) => Promise<void>;
  swapExercise: (oldExerciseId: string, newExerciseId: string) => Promise<void>;
  finishWorkout: (rpe?: number) => Promise<void>;
  discardWorkout: () => Promise<void>;
  resumeWorkout: () => Promise<void>;
  setActiveRoutine: (routineId: string | null, duration?: number, startDayIndex?: number) => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

// Robust ID generation for local environment
export const generateId = () => {
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
      const session = DB.getOne<ActiveSession>('SELECT * FROM Active_Session LIMIT 1;');
      const s = DB.getOne<UserSettings>('SELECT * FROM User_Settings WHERE id = 1;');

      if (s) {
        setSettings(s);
        setActiveRoutineId(s.active_routine_id);
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

  const setActiveRoutine = async (routineId: string | null, duration?: number, startDayIndex?: number) => {
    try {
      const lastModified = Date.now();
      DB.run('UPDATE User_Settings SET active_routine_id = ?, last_modified = ? WHERE id = 1;', [routineId, lastModified]);
      
      if (routineId) {
        if (duration !== undefined || startDayIndex !== undefined) {
          const updates: string[] = [];
          const params: any[] = [];
          
          if (duration !== undefined) {
            updates.push('duration = ?');
            params.push(duration);
          }
          if (startDayIndex !== undefined) {
            updates.push('start_day_index = ?');
            params.push(startDayIndex);
          }
          
          updates.push('last_modified = ?');
          params.push(lastModified);
          params.push(routineId);
          
          DB.run(`UPDATE Routines SET ${updates.join(', ')} WHERE id = ?;`, params);
        }
      }

      setActiveRoutineId(routineId);
      setSettings(prev => prev ? { ...prev, active_routine_id: routineId, last_modified: lastModified } : null);
    } catch (error) {
      console.error('Failed to set active routine:', error);
    }
  };

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    try {
      const lastModified = Date.now();
      const updates = { ...newSettings, last_modified: lastModified };
      
      const keys = Object.keys(updates).filter(k => k !== 'id');
      if (keys.length === 0) return;

      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const params = keys.map(k => (updates as any)[k]);

      DB.run(`UPDATE User_Settings SET ${setClause} WHERE id = 1;`, params);
      
      setSettings(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  }, []);

  const startWorkout = async (workout: Workout, exercises: { exercise: Exercise; target_sets: number; target_reps: number | null; target_weight?: number | null; target_time_ms?: number | null; target_distance?: number | null }[], routineId: string | null = null) => {
    try {
      const sessionId = generateId();
      const startTime = Date.now();
      const lastModified = startTime;

      // Load previous logged sets for this workout to pre-fill inputs
      const lastSession = DB.getOne<{ id: string }>(
        'SELECT id FROM Logged_Sessions WHERE workout_id = ? ORDER BY end_time DESC LIMIT 1;',
        [workout.id]
      );
      const lastSetsMap: Record<string, { weight: number | null; reps: number | null; time_ms: number | null; distance: number | null }[]> = {};
      if (lastSession) {
        const allLastSets = DB.getAll<{ exercise_id: string; weight: number | null; reps: number | null; time_ms: number | null; distance: number | null; order_index: number }>(
          'SELECT exercise_id, weight, reps, time_ms, distance, order_index FROM Logged_Sets WHERE session_id = ? ORDER BY exercise_id, order_index ASC;',
          [lastSession.id]
        );
        allLastSets.forEach(s => {
          if (!lastSetsMap[s.exercise_id]) lastSetsMap[s.exercise_id] = [];
          lastSetsMap[s.exercise_id].push(s);
        });
      }

      const initialDrafts: Record<string, SetData[]> = {};
      exercises.forEach(ex => {
        const prevSets = lastSetsMap[ex.exercise.id] || [];
        initialDrafts[ex.exercise.id] = Array.from({ length: ex.target_sets }, (_, i) => {
          const prev = prevSets[i] ?? prevSets[prevSets.length - 1];
          return {
            id: generateId().substring(0, 8),
            is_skipped: false,
            is_completed: false,
            reps: prev?.reps ?? ex.target_reps ?? undefined,
            weight: prev?.weight ?? ex.target_weight ?? undefined,
            time_ms: prev?.time_ms ?? ex.target_time_ms ?? undefined,
            distance: prev?.distance ?? ex.target_distance ?? undefined,
          };
        });
      });

      const draftData = JSON.stringify(initialDrafts);

      DB.transaction(() => {
        DB.run('DELETE FROM Active_Session;');

        DB.run(
          'INSERT INTO Active_Session (id, workout_id, routine_id, start_time, is_paused, is_swapped, draft_data, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
          [sessionId, workout.id, routineId, startTime, false, false, draftData, lastModified]
        );

        setActiveSession({ 
          id: sessionId, 
          workout_id: workout.id, 
          routine_id: routineId, 
          start_time: startTime, 
          is_paused: false,
          is_swapped: false, 
          draft_data: draftData, 
          last_modified: lastModified,
          current_exercise_id: null,
          current_set_index: null,
          timer_start_time: null
        });
        setDraftSets(initialDrafts);
      });
    } catch (error) {
      console.error('Failed to start workout:', error);
      Alert.alert('Error', 'Could not start the workout. Please try again.');
    }
  };

  const logSet = async (exerciseId: string, sets: SetData[]) => {
    if (!activeSession) return;
    try {
      const newDraftSets = { ...draftSets, [exerciseId]: sets };
      const draftData = JSON.stringify(newDraftSets);
      const lastModified = Date.now();

      DB.run(
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
        id: generateId().substring(0, 8), 
        is_completed: false, // Reset completion but keep weight/reps
      }));

      const newDraftSets: Record<string, SetData[]> = {};
      Object.entries(draftSets).forEach(([key, value]) => {
        newDraftSets[key === oldExerciseId ? newExerciseId : key] =
          key === oldExerciseId ? newSets : value;
      });
      const draftData = JSON.stringify(newDraftSets);

      DB.transaction(() => {
        DB.run(
          'UPDATE Active_Session SET draft_data = ?, is_swapped = ?, last_modified = ? WHERE id = ?;',
          [draftData, true, lastModified, activeSession.id]
        );
      });

      setDraftSets(newDraftSets);
      setActiveSession(prev => prev ? { ...prev, is_swapped: true, draft_data: draftData, last_modified: lastModified } : null);
    } catch (error) {
      console.error('Failed to swap exercise:', error);
    }
  };

  const finishWorkout = async (rpe?: number) => {
    if (!activeSession) return;

    try {
      const endTime = Date.now();
      const lastModified = endTime;
      DB.transaction(() => {
        DB.run(
          'INSERT INTO Logged_Sessions (id, workout_id, routine_id, start_time, end_time, rpe, is_swapped, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
          [activeSession.id, activeSession.workout_id, activeSession.routine_id, activeSession.start_time, endTime, rpe ?? null, activeSession.is_swapped, lastModified]
        );

        Object.entries(draftSets).forEach(([exerciseId, sets]) => {
          sets.forEach((set, index) => {
            if (set.is_completed || set.is_skipped) {
              DB.run(
                'INSERT INTO Logged_Sets (id, session_id, exercise_id, set_type, weight, reps, time_ms, distance, notes, is_skipped, order_index, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
                [
                  generateId(),
                  activeSession.id,
                  exerciseId,
                  SetType.WORKING, 
                  set.weight || null,
                  set.reps || null,
                  set.time_ms || null,
                  set.distance || null,
                  set.notes || null,
                  set.is_skipped ? 1 : 0,
                  index,
                  lastModified
                ]
              );
            }
          });
        });

        if (activeSession.routine_id) {
          const routineWorkoutCount = DB.getOne<{ count: number }>('SELECT COUNT(*) as count FROM Routine_Workouts WHERE routine_id = ?;', [activeSession.routine_id])?.count || 1;
          const sessionsLogged = DB.getOne<{ count: number }>('SELECT COUNT(*) as count FROM Logged_Sessions WHERE routine_id = ?;', [activeSession.routine_id])?.count || 0;

          if (sessionsLogged > 0 && sessionsLogged % routineWorkoutCount === 0) {
            DB.run('UPDATE Routines SET cycle_count = cycle_count + 1, last_modified = ? WHERE id = ?;', [lastModified, activeSession.routine_id]);
          }
        }

        DB.run('DELETE FROM Active_Session WHERE id = ?;', [activeSession.id]);
      });

      setActiveSession(null);
      setDraftSets({});
      Alert.alert('Saved!', 'Your session has been logged.');
    } catch (error) {
      console.error('Failed to finish workout:', error);
      Alert.alert('Error', 'Failed to save your workout. Please try again.');
    }
  };

  const discardWorkout = async () => {
    if (!activeSession) return;
    Alert.alert('Cancel Workout?', 'All progress will be lost.', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: () => {
          try {
            DB.transaction(() => {
              DB.run('DELETE FROM Active_Session WHERE id = ?;', [activeSession.id]);
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
