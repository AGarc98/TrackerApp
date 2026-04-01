import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { DB } from '../database/db';
import { MuscleGroup, ExerciseType, Routine, RoutineMode, Workout, ExerciseWithMuscle } from '../types/database';
import { useWorkout } from '../store/WorkoutContext';

// ─── Local UI Types ───────────────────────────────────────────────────────────

interface UIDayExercise {
  id: string;
  exercise_id: string;
  name: string;
  type: ExerciseType;
  target_sets: number;
  target_reps: number | null;
  target_weight: number | null;
  target_time_ms: number | null;
  target_distance: number | null;
  rest_period_override: number | null;
  superset_id: string | null;
}

interface UIDay {
  id: string;
  name: string;
  description: string | null;
  exercises: UIDayExercise[];
}

interface UIWorkout extends Workout {
  exercise_count: number;
}

interface UIRoutine extends Routine {
  workout_count: number;
}

type EditingRoutine = Partial<UIRoutine> & {
  workout_mappings: (string | null)[];
  week_numbers: (0 | 1)[];
  ab_weeks_enabled: boolean;
};

type ImportStrategy = 'replace' | 'duplicate';

interface ImportConflict {
  kind: 'routine' | 'workout' | 'exercise';
  name: string;
  detail?: string; // extra context, e.g. type mismatch
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const START_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Component ────────────────────────────────────────────────────────────────

export const ArchitectZone = () => {
  const { setActiveRoutine, activeRoutineId } = useWorkout();
  const [activeSubTab, setActiveSubTab] = useState<'routines' | 'workouts' | 'exercises'>('routines');
  const [exercises, setExercises] = useState<ExerciseWithMuscle[]>([]);
  const [days, setDays] = useState<UIWorkout[]>([]);
  const [routines, setRoutines] = useState<UIRoutine[]>([]);

  // Modals
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false);
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [routineModalVisible, setRoutineModalVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Editing state
  const [editingExercise, setEditingExercise] = useState<Partial<ExerciseWithMuscle> | null>(null);
  const [editingDay, setEditingDay] = useState<UIDay | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<EditingRoutine | null>(null);

  // Picker state
  const [pickerType, setPickerType] = useState<'exercise' | 'workout'>('exercise');
  const [currentPickerCallback, setCurrentPickerCallback] = useState<((id: string, name: string) => void) | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Search & filter state
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | null>(null);

  // Import / Export state
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importJSON, setImportJSON] = useState('');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportJSON, setExportJSON] = useState('');
  const [importBundle, setImportBundle] = useState<any | null>(null);
  const [importConflicts, setImportConflicts] = useState<ImportConflict[]>([]);
  const [importStrategyModalVisible, setImportStrategyModalVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeSubTab]);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadData = async () => {
    try {
      const eResult = DB.getAll<any>(`
        SELECT e.*,
               (SELECT muscle_group FROM Exercise_Muscle_Groups WHERE exercise_id = e.id AND is_primary = 1 LIMIT 1) as primary_muscle,
               (SELECT GROUP_CONCAT(muscle_group) FROM Exercise_Muscle_Groups WHERE exercise_id = e.id) as all_muscles
        FROM Exercises e
        ORDER BY e.name ASC;
      `);
      setExercises(eResult.map((ex: any) => ({
        ...ex,
        muscle_group: ex.primary_muscle || MuscleGroup.CHEST,
        muscle_groups: ex.all_muscles ? ex.all_muscles.split(',') : [],
      })));

      const dResult = DB.getAll<UIWorkout>(`
        SELECT w.*,
          (SELECT COUNT(*) FROM Workout_Exercises WHERE workout_id = w.id) as exercise_count
        FROM Workouts w ORDER BY w.name ASC;
      `);
      setDays(dResult);

      const rResult = DB.getAll<UIRoutine>(`
        SELECT r.*,
          (SELECT COUNT(DISTINCT workout_id) FROM Routine_Workouts WHERE routine_id = r.id) as workout_count
        FROM Routines r ORDER BY r.name ASC;
      `);
      setRoutines(rResult);
    } catch (e) {
      console.error('Failed to load Architect data:', e);
    }
  };

  // ─── Derived data ──────────────────────────────────────────────────────────

  const availableMuscleFilters = useMemo(() => {
    const seen = new Set<MuscleGroup>();
    exercises.forEach(ex => { if (ex.muscle_group) seen.add(ex.muscle_group); });
    return Array.from(seen).sort();
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      const matchesSearch = !exerciseSearch || ex.name.toLowerCase().includes(exerciseSearch.toLowerCase());
      const matchesMuscle = !muscleFilter || ex.muscle_group === muscleFilter;
      return matchesSearch && matchesMuscle;
    });
  }, [exercises, exerciseSearch, muscleFilter]);

  const pickerData = useMemo(() => {
    const source: any[] = pickerType === 'exercise' ? exercises : days;
    if (!pickerSearch) return source;
    return source.filter((item: any) => item.name.toLowerCase().includes(pickerSearch.toLowerCase()));
  }, [pickerType, exercises, days, pickerSearch]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleEditRoutine = (item: UIRoutine) => {
    const mappings = DB.getAll<any>('SELECT * FROM Routine_Workouts WHERE routine_id = ? ORDER BY order_index ASC;', [item.id]);
    const workout_mappings: (string | null)[] = item.mode === RoutineMode.WEEKLY ? Array(7).fill(null) : mappings.map((m: any) => m.workout_id);
    const week_numbers: (0 | 1)[] = item.mode === RoutineMode.ASYNC
      ? mappings.map((m: any) => (m.week_number === 1 ? 1 : 0) as 0 | 1)
      : [];
    const ab_weeks_enabled = week_numbers.some(w => w === 1);
    if (item.mode === RoutineMode.WEEKLY) {
      mappings.forEach((m: any) => { if (m.order_index < 7) workout_mappings[m.order_index] = m.workout_id; });
    }
    setEditingRoutine({ ...item, workout_mappings, week_numbers, ab_weeks_enabled });
    setRoutineModalVisible(true);
  };

  const handleEditItem = (item: any) => {
    if (activeSubTab === 'exercises') {
      setEditingExercise(item);
      setExerciseModalVisible(true);
    } else if (activeSubTab === 'workouts') {
      const exResult = DB.getAll<any>(
        `SELECT we.*, e.name, e.type FROM Workout_Exercises we
         JOIN Exercises e ON we.exercise_id = e.id
         WHERE we.workout_id = ? ORDER BY we.order_index ASC;`,
        [item.id]
      );
      setEditingDay({
        id: item.id,
        name: item.name,
        description: item.description || null,
        exercises: exResult.map((we: any) => ({
          id: we.id,
          exercise_id: we.exercise_id,
          name: we.name,
          type: we.type || ExerciseType.STRENGTH,
          target_sets: we.target_sets,
          target_reps: we.target_reps,
          target_weight: we.target_weight,
          target_time_ms: we.target_time_ms,
          target_distance: we.target_distance,
          rest_period_override: we.rest_period_override,
          superset_id: we.superset_id,
        })),
      });
      setDayModalVisible(true);
    }
  };

  const updateDayExercise = (idx: number, field: keyof UIDayExercise, value: any) => {
    const newExs = [...editingDay!.exercises];
    (newExs[idx] as any)[field] = value;
    setEditingDay({ ...editingDay!, exercises: newExs });
  };

  const toggleSuperset = (idx: number) => {
    if (!editingDay || idx === 0) return;
    const exs = [...editingDay.exercises];
    const ex = exs[idx];
    if (ex.superset_id) {
      exs[idx] = { ...ex, superset_id: null };
    } else {
      const prev = exs[idx - 1];
      const groupId = prev.superset_id || Math.random().toString(36).substring(2, 9);
      if (!prev.superset_id) exs[idx - 1] = { ...prev, superset_id: groupId };
      exs[idx] = { ...ex, superset_id: groupId };
    }
    setEditingDay({ ...editingDay, exercises: exs });
  };

  const handleSaveExercise = () => {
    if (!editingExercise?.name) { Alert.alert('Missing Name', 'Every exercise needs a name.'); return; }
    try {
      const lastModified = Date.now();
      const exerciseId = editingExercise.id || Math.random().toString(36).substring(2, 15);
      const selectedMuscles = editingExercise.muscle_groups || [editingExercise.muscle_group || MuscleGroup.CHEST];
      DB.transaction(() => {
        if (editingExercise.id) {
          DB.run('UPDATE Exercises SET name = ?, description = ?, type = ?, default_rest_duration = ?, last_modified = ? WHERE id = ?;',
            [editingExercise.name, editingExercise.description || null, editingExercise.type || ExerciseType.STRENGTH, editingExercise.default_rest_duration || 90, lastModified, editingExercise.id]);
          DB.run('DELETE FROM Exercise_Muscle_Groups WHERE exercise_id = ?;', [editingExercise.id]);
        } else {
          DB.run('INSERT INTO Exercises (id, name, description, type, default_rest_duration, last_modified) VALUES (?, ?, ?, ?, ?, ?);',
            [exerciseId, editingExercise.name, editingExercise.description || null, editingExercise.type || ExerciseType.STRENGTH, editingExercise.default_rest_duration || 90, lastModified]);
        }
        selectedMuscles.forEach((mg, index) => {
          DB.run('INSERT INTO Exercise_Muscle_Groups (id, exercise_id, muscle_group, is_primary, last_modified) VALUES (?, ?, ?, ?, ?);',
            [Math.random().toString(36).substring(2, 15), exerciseId, mg, index === 0 ? 1 : 0, lastModified]);
        });
      });
      setExerciseModalVisible(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteExercise = (id: string) => {
    Alert.alert('Delete Exercise', 'This will also remove it from any workouts using it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { DB.run('DELETE FROM Exercises WHERE id = ?;', [id]); loadData(); } },
    ]);
  };

  const handleSaveDay = () => {
    if (!editingDay?.name) { Alert.alert('Missing Name', 'Every workout needs a name.'); return; }
    try {
      const dayId = editingDay.id || Math.random().toString(36).substring(2, 15);
      const lastModified = Date.now();
      DB.transaction(() => {
        if (editingDay.id) {
          DB.run('UPDATE Workouts SET name = ?, description = ?, last_modified = ? WHERE id = ?;',
            [editingDay.name, editingDay.description || null, lastModified, editingDay.id]);
          DB.run('DELETE FROM Workout_Exercises WHERE workout_id = ?;', [editingDay.id]);
        } else {
          DB.run('INSERT INTO Workouts (id, name, description, last_modified) VALUES (?, ?, ?, ?);',
            [dayId, editingDay.name, editingDay.description || null, lastModified]);
        }
        editingDay.exercises.forEach((ex, idx) => {
          DB.run(
            'INSERT INTO Workout_Exercises (id, workout_id, exercise_id, order_index, target_sets, target_reps, target_weight, target_time_ms, target_distance, rest_period_override, superset_id, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
            [Math.random().toString(36).substring(2, 15), dayId, ex.exercise_id, idx, ex.target_sets, ex.target_reps, ex.target_weight, ex.target_time_ms, ex.target_distance, ex.rest_period_override, ex.superset_id, lastModified]
          );
        });
      });
      setDayModalVisible(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteDay = (id: string) => {
    Alert.alert('Delete Workout', 'It will be removed from any routines using it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { DB.run('DELETE FROM Workouts WHERE id = ?;', [id]); loadData(); } },
    ]);
  };

  const handleSaveRoutine = () => {
    if (!editingRoutine?.name) { Alert.alert('Missing Name', 'Every routine needs a name.'); return; }
    try {
      const rId = editingRoutine.id || Math.random().toString(36).substring(2, 15);
      const lastModified = Date.now();
      DB.transaction(() => {
        if (editingRoutine.id) {
          DB.run(
            'UPDATE Routines SET name = ?, description = ?, mode = ?, duration = ?, start_day_index = ?, last_modified = ? WHERE id = ?;',
            [editingRoutine.name!, editingRoutine.description || null, editingRoutine.mode!, editingRoutine.duration!, editingRoutine.start_day_index ?? 0, lastModified, editingRoutine.id]
          );
          DB.run('DELETE FROM Routine_Workouts WHERE routine_id = ?;', [editingRoutine.id]);
        } else {
          DB.run(
            'INSERT INTO Routines (id, name, description, mode, duration, start_day_index, cycle_count, last_modified) VALUES (?, ?, ?, ?, ?, ?, 0, ?);',
            [rId, editingRoutine.name!, editingRoutine.description || null, editingRoutine.mode!, editingRoutine.duration!, editingRoutine.start_day_index ?? 0, lastModified]
          );
        }
        editingRoutine.workout_mappings.forEach((wId, idx) => {
          if (wId) {
            const dayOfWeek = editingRoutine.mode === RoutineMode.WEEKLY ? idx : null;
            const weekNum = editingRoutine.mode === RoutineMode.ASYNC && editingRoutine.ab_weeks_enabled
              ? (editingRoutine.week_numbers[idx] ?? 0)
              : null;
            DB.run(
              'INSERT INTO Routine_Workouts (id, routine_id, workout_id, day_of_week, week_number, order_index, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?);',
              [Math.random().toString(36).substring(2, 15), rId, wId, dayOfWeek, weekNum, idx, lastModified]
            );
          }
        });
      });
      setRoutineModalVisible(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteRoutine = (id: string) => {
    Alert.alert('Delete Routine', 'Your progress for this routine will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (activeRoutineId === id) await setActiveRoutine(null);
        DB.run('DELETE FROM Routines WHERE id = ?;', [id]);
        loadData();
      }},
    ]);
  };

  // ─── Routine Import / Export ───────────────────────────────────────────────

  const handleExportRoutine = (item: UIRoutine) => {
    try {
      const routine = DB.getOne<any>('SELECT * FROM Routines WHERE id = ?;', [item.id]);
      const mappings = DB.getAll<any>('SELECT * FROM Routine_Workouts WHERE routine_id = ? ORDER BY order_index ASC;', [item.id]);

      // Resolve each workout and its exercises into the export bundle
      const workouts = mappings.reduce<any[]>((acc, m) => {
        if (!m.workout_id || acc.find((w: any) => w.workout.id === m.workout_id)) return acc;
        const workout = DB.getOne<any>('SELECT * FROM Workouts WHERE id = ?;', [m.workout_id]);
        if (!workout) return acc;
        const exercises = DB.getAll<any>(
          `SELECT we.*, e.name, e.description, e.type, e.default_rest_duration,
           (SELECT GROUP_CONCAT(muscle_group) FROM Exercise_Muscle_Groups WHERE exercise_id = e.id) as all_muscles
           FROM Workout_Exercises we JOIN Exercises e ON we.exercise_id = e.id
           WHERE we.workout_id = ? ORDER BY we.order_index ASC;`,
          [m.workout_id]
        );
        // Ensure all_muscles is never null so the importer can always split safely
        const normalizedExercises = exercises.map((ex: any) => ({ ...ex, all_muscles: ex.all_muscles ?? '' }));
        acc.push({ workout, exercises: normalizedExercises });
        return acc;
      }, []);

      // Self-containedness check: every routine_workout entry must have resolved to a workout in the bundle
      const bundledIds = new Set(workouts.map((w: any) => w.workout.id));
      const missing = mappings.filter(m => m.workout_id && !bundledIds.has(m.workout_id));
      if (missing.length > 0) {
        Alert.alert(
          'Export Incomplete',
          `${missing.length} workout(s) referenced by this routine could not be found. The export was cancelled to avoid producing a broken file.`
        );
        return;
      }

      const bundle = { bundle_version: 1, routine, routine_workouts: mappings, workouts, exported_at: Date.now() };
      const json = JSON.stringify(bundle, null, 2);
      setExportJSON(json);
      setExportModalVisible(true);
    } catch (e) {
      console.error('Export failed:', e);
      Alert.alert('Export Failed', 'Could not generate routine data.');
    }
  };

  // Validates that a parsed bundle is fully self-contained before any DB work begins.
  // Returns null on success or a human-readable error string describing exactly what is wrong.
  const validateBundle = (bundle: any): string | null => {
    if (!bundle || typeof bundle !== 'object') return 'Bundle is not a valid JSON object.';
    const { routine, routine_workouts, workouts } = bundle;

    if (!routine || typeof routine.name !== 'string' || !routine.name.trim())
      return 'The bundle is missing a valid "routine" with a name.';
    if (!Array.isArray(routine_workouts))
      return 'The bundle is missing the "routine_workouts" array.';
    if (!Array.isArray(workouts))
      return 'The bundle is missing the "workouts" array.';

    const bundledWorkoutIds = new Set<string>();
    for (let i = 0; i < workouts.length; i++) {
      const entry = workouts[i];
      if (!entry?.workout?.id)
        return `workouts[${i}] is missing workout.id.`;
      if (typeof entry.workout.name !== 'string' || !entry.workout.name.trim())
        return `workouts[${i}] is missing workout.name.`;
      if (!Array.isArray(entry.exercises))
        return `Workout "${entry.workout.name}" is missing its exercises array.`;
      bundledWorkoutIds.add(entry.workout.id);

      for (let j = 0; j < entry.exercises.length; j++) {
        const ex = entry.exercises[j];
        if (typeof ex.name !== 'string' || !ex.name.trim())
          return `Exercise ${j + 1} in workout "${entry.workout.name}" is missing a name.`;
        if (typeof ex.type !== 'string' || !ex.type.trim())
          return `Exercise "${ex.name}" in workout "${entry.workout.name}" is missing a type.`;
      }
    }

    // Referential integrity: every routine_workout must reference a workout present in the bundle
    for (let i = 0; i < routine_workouts.length; i++) {
      const rw = routine_workouts[i];
      if (rw.workout_id && !bundledWorkoutIds.has(rw.workout_id)) {
        return `The bundle references workout ID "${rw.workout_id}" which is not included in the workouts array. The file may be incomplete or edited by hand.`;
      }
    }

    return null;
  };

  // Step 1: parse JSON and collect conflicts — shows strategy modal if any found
  const handleImportRoutine = () => {
    if (!importJSON.trim()) {
      Alert.alert('Empty Input', 'Paste a routine JSON string first.');
      return;
    }
    try {
      const bundle = JSON.parse(importJSON);

      const validationError = validateBundle(bundle);
      if (validationError) {
        Alert.alert('Invalid Bundle', validationError);
        return;
      }

      const { routine, workouts } = bundle;

      // Detect conflicts
      const conflicts: ImportConflict[] = [];

      const existingRoutine = DB.getOne<any>('SELECT id FROM Routines WHERE name = ?;', [routine.name]);
      if (existingRoutine) {
        conflicts.push({ kind: 'routine', name: routine.name });
      }

      workouts.forEach(({ workout, exercises }: any) => {
        const existingWorkout = DB.getOne<any>('SELECT id FROM Workouts WHERE name = ?;', [workout.name]);
        if (existingWorkout) {
          conflicts.push({ kind: 'workout', name: workout.name });
        }
        exercises.forEach((ex: any) => {
          const existingEx = DB.getOne<any>('SELECT id, type FROM Exercises WHERE name = ?;', [ex.name]);
          if (existingEx && existingEx.type !== ex.type) {
            // Same name but different type — always flag this so the user is aware
            conflicts.push({ kind: 'exercise', name: ex.name, detail: `local: ${existingEx.type} · import: ${ex.type}` });
          }
          // Same name + same type → silent reuse, no conflict
        });
      });

      setImportBundle(bundle);
      setImportConflicts(conflicts);

      if (conflicts.length > 0) {
        // Close paste modal and show strategy modal
        setImportModalVisible(false);
        setImportStrategyModalVisible(true);
      } else {
        executeImport(bundle, 'duplicate');
      }
    } catch (e) {
      console.error('Import parse failed:', e);
      Alert.alert('Import Failed', 'The JSON could not be parsed. Make sure it was copied in full.');
    }
  };

  // Step 2: execute the import once strategy is chosen
  const executeImport = (bundle: any, strategy: ImportStrategy) => {
    const { routine, routine_workouts, workouts } = bundle;
    const lastModified = Date.now();

    try {
      DB.transaction(() => {
        const workoutIdMap: Record<string, string> = {};

        workouts.forEach(({ workout, exercises }: any) => {
          const existingWorkout = DB.getOne<any>('SELECT id FROM Workouts WHERE name = ?;', [workout.name]);
          let finalWorkoutId: string;

          if (existingWorkout && strategy === 'replace') {
            // Overwrite in-place, preserve existing ID so other routines still reference it
            finalWorkoutId = existingWorkout.id;
            DB.run('UPDATE Workouts SET name = ?, description = ?, last_modified = ? WHERE id = ?;',
              [workout.name, workout.description || null, lastModified, finalWorkoutId]);
            DB.run('DELETE FROM Workout_Exercises WHERE workout_id = ?;', [finalWorkoutId]);
          } else {
            finalWorkoutId = Math.random().toString(36).substring(2, 15);
            const finalName = existingWorkout ? `${workout.name} (Imported)` : workout.name;
            DB.run('INSERT INTO Workouts (id, name, description, last_modified) VALUES (?, ?, ?, ?);',
              [finalWorkoutId, finalName, workout.description || null, lastModified]);
          }

          workoutIdMap[workout.id] = finalWorkoutId;

          exercises.forEach((ex: any, idx: number) => {
            const existingEx = DB.getOne<any>('SELECT id, type FROM Exercises WHERE name = ?;', [ex.name]);
            let finalExId: string;

            if (existingEx) {
              if (strategy === 'replace') {
                // Update the existing exercise definition in-place
                finalExId = existingEx.id;
                DB.run('UPDATE Exercises SET description = ?, type = ?, default_rest_duration = ?, last_modified = ? WHERE id = ?;',
                  [ex.description || null, ex.type, ex.default_rest_duration || 90, lastModified, finalExId]);
                DB.run('DELETE FROM Exercise_Muscle_Groups WHERE exercise_id = ?;', [finalExId]);
              } else {
                if (existingEx.type === ex.type) {
                  // Same name + same type — reuse silently regardless of strategy
                  finalExId = existingEx.id;
                } else {
                  // Different type conflict — create a copy with suffixed name
                  finalExId = Math.random().toString(36).substring(2, 15);
                  DB.run('INSERT INTO Exercises (id, name, description, type, default_rest_duration, last_modified) VALUES (?, ?, ?, ?, ?, ?);',
                    [finalExId, `${ex.name} (Imported)`, ex.description || null, ex.type, ex.default_rest_duration || 90, lastModified]);
                }
              }
            } else {
              finalExId = Math.random().toString(36).substring(2, 15);
              DB.run('INSERT INTO Exercises (id, name, description, type, default_rest_duration, last_modified) VALUES (?, ?, ?, ?, ?, ?);',
                [finalExId, ex.name, ex.description || null, ex.type, ex.default_rest_duration || 90, lastModified]);
            }

            // Insert/re-insert muscle groups for new or replaced exercises
            const needsMuscles = !existingEx || strategy === 'replace';
            if (needsMuscles) {
              const muscles = ex.all_muscles ? ex.all_muscles.split(',') : [];
              muscles.forEach((mg: string, i: number) => {
                DB.run('INSERT INTO Exercise_Muscle_Groups (id, exercise_id, muscle_group, is_primary, last_modified) VALUES (?, ?, ?, ?, ?);',
                  [Math.random().toString(36).substring(2, 15), finalExId, mg.trim(), i === 0 ? 1 : 0, lastModified]);
              });
            }

            DB.run(
              'INSERT INTO Workout_Exercises (id, workout_id, exercise_id, order_index, target_sets, target_reps, target_weight, target_time_ms, target_distance, rest_period_override, superset_id, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
              [Math.random().toString(36).substring(2, 15), finalWorkoutId, finalExId, idx, ex.target_sets, ex.target_reps, ex.target_weight, ex.target_time_ms, ex.target_distance, ex.rest_period_override, ex.superset_id, lastModified]
            );
          });
        });

        const existingRoutine = DB.getOne<any>('SELECT id FROM Routines WHERE name = ?;', [routine.name]);
        let finalRoutineId: string;

        if (existingRoutine && strategy === 'replace') {
          finalRoutineId = existingRoutine.id;
          DB.run('UPDATE Routines SET name = ?, description = ?, mode = ?, duration = ?, start_day_index = ?, last_modified = ? WHERE id = ?;',
            [routine.name, routine.description || null, routine.mode, routine.duration, routine.start_day_index ?? 0, lastModified, finalRoutineId]);
          DB.run('DELETE FROM Routine_Workouts WHERE routine_id = ?;', [finalRoutineId]);
        } else {
          finalRoutineId = Math.random().toString(36).substring(2, 15);
          const finalName = existingRoutine ? `${routine.name} (Imported)` : routine.name;
          DB.run('INSERT INTO Routines (id, name, description, mode, duration, start_day_index, cycle_count, last_modified) VALUES (?, ?, ?, ?, ?, ?, 0, ?);',
            [finalRoutineId, finalName, routine.description || null, routine.mode, routine.duration, routine.start_day_index ?? 0, lastModified]);
        }

        routine_workouts.forEach((rw: any, idx: number) => {
          const finalWorkoutId = workoutIdMap[rw.workout_id];
          if (!finalWorkoutId) return;
          DB.run('INSERT INTO Routine_Workouts (id, routine_id, workout_id, day_of_week, week_number, order_index, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?);',
            [Math.random().toString(36).substring(2, 15), finalRoutineId, finalWorkoutId, rw.day_of_week, rw.week_number, idx, lastModified]);
        });
      });

      setImportStrategyModalVisible(false);
      setImportModalVisible(false);
      setImportJSON('');
      setImportBundle(null);
      setImportConflicts([]);
      loadData();
      const verb = strategy === 'replace' ? 'updated' : 'imported';
      Alert.alert('Done', `"${routine.name}" has been ${verb}.`);
    } catch (e) {
      console.error('Import execute failed:', e);
      Alert.alert('Import Failed', 'Something went wrong while saving. No changes were made.');
    }
  };

  // ─── Picker ────────────────────────────────────────────────────────────────

  const openExercisePicker = (callback: (id: string, name: string) => void) => {
    setPickerType('exercise');
    setCurrentPickerCallback(() => callback);
    setPickerSearch('');
    setPickerVisible(true);
  };

  const openWorkoutPicker = (callback: (id: string, name: string) => void) => {
    setPickerType('workout');
    setCurrentPickerCallback(() => callback);
    setPickerSearch('');
    setPickerVisible(true);
  };

  const renderPickerOverlay = () => {
    if (!pickerVisible) return null;
    const label = pickerType === 'exercise' ? 'exercise' : 'workout';
    return (
      <View className="absolute inset-0 bg-black/60 justify-center p-6 z-[9999]" style={{ elevation: 100 }}>
        <View className="bg-surface rounded-[40px] p-6 max-h-[85%] shadow-2xl">
          <Text className="text-xl font-black mb-4 text-center uppercase tracking-widest text-text-muted">
            Select {label}
          </Text>
          <TextInput
            className="bg-background border border-border rounded-2xl p-3 mb-3 text-text-main font-bold"
            placeholder={`Search ${label}s...`}
            placeholderTextColor="var(--color-text-muted)"
            value={pickerSearch}
            onChangeText={setPickerSearch}
          />
          <FlatList
            data={pickerData}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item }: any) => {
              const isExercise = pickerType === 'exercise';
              return (
                <TouchableOpacity
                  onPress={() => { if (currentPickerCallback) currentPickerCallback(item.id, item.name); setPickerVisible(false); }}
                  activeOpacity={0.7}
                  className="p-4 border-b border-border"
                >
                  <Text className="font-bold text-text-main text-base">{item.name}</Text>
                  {isExercise ? (
                    <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-0.5">
                      {(item.type as string)?.replace(/_/g, ' ')} · {(item.muscle_group as string)?.replace(/_/g, ' ')}
                    </Text>
                  ) : (
                    <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-0.5">
                      {item.exercise_count} exercise{item.exercise_count !== 1 ? 's' : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            }}
            showsVerticalScrollIndicator={false}
          />
          <TouchableOpacity onPress={() => setPickerVisible(false)} className="mt-6 bg-background p-4 rounded-2xl items-center">
            <Text className="font-black text-text-muted uppercase tracking-widest">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Routine list item ─────────────────────────────────────────────────────

  const renderRoutineItem = ({ item }: { item: UIRoutine }) => {
    const isActive = item.id === activeRoutineId;
    return (
      <View className={`bg-surface p-6 mb-4 rounded-[32px] shadow-sm border ${isActive ? 'border-primary' : 'border-border'}`}>
        {/* Top row: name/tags + activate */}
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 mr-4">
            <Text className="text-xl font-black text-text-main mb-1">{item.name}</Text>
            {!!item.description && (
              <Text className="text-text-muted text-xs mb-2" numberOfLines={2}>{item.description}</Text>
            )}
            <View className="flex-row flex-wrap gap-2">
              <View className="bg-primary-soft px-2 py-1 rounded-md">
                <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">{item.mode}</Text>
              </View>
              {item.mode === RoutineMode.WEEKLY && (
                <View className="bg-background px-2 py-1 rounded-md border border-border">
                  <Text className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Starts {START_DAY_LABELS[item.start_day_index ?? 0]}
                  </Text>
                </View>
              )}
              {isActive && (
                <View className="bg-success/10 px-2 py-1 rounded-md">
                  <Text className="text-[10px] font-bold text-success uppercase tracking-widest">Active</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={async () => { await setActiveRoutine(isActive ? null : item.id); }}
            className={`p-3 px-4 rounded-2xl shadow-sm ${isActive ? 'bg-accent-soft' : 'bg-primary'}`}
          >
            <Text className={`font-black text-[10px] uppercase tracking-widest ${isActive ? 'text-accent' : 'text-surface'}`}>
              {isActive ? 'Deactivate' : 'Activate'}
            </Text>
          </TouchableOpacity>
        </View>
        {/* Action buttons row */}
        <View className="flex-row gap-2 border-t border-border pt-3 mb-3">
          <TouchableOpacity onPress={() => handleEditRoutine(item)} className="flex-1 bg-background p-3 rounded-2xl border border-border shadow-sm items-center">
            <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest">Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleExportRoutine(item)} className="flex-1 bg-background p-3 rounded-2xl border border-border shadow-sm items-center">
            <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest">Export</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteRoutine(item.id)} className="flex-1 bg-background p-3 rounded-2xl border border-border shadow-sm items-center">
            <Text className="text-accent font-black text-[10px] uppercase tracking-widest">Delete</Text>
          </TouchableOpacity>
        </View>
        {/* Stats row */}
        <View className="flex-row gap-4">
          <Text className="text-text-muted text-[10px] font-black uppercase tracking-[2px]">
            {item.cycle_count} / {item.duration} cycles
          </Text>
          <Text className="text-text-muted text-[10px] font-black uppercase tracking-[2px]">
            {item.workout_count} workout{item.workout_count !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
    );
  };

  // ─── Empty state ──────────────────────────────────────────────────────────

  const renderEmptyState = (message: string, cta: string) => (
    <View className="flex-1 items-center justify-center py-20 px-8">
      <View className="bg-surface rounded-[40px] p-10 items-center border border-border w-full">
        <Text className="text-text-main font-black text-lg mb-2 text-center tracking-tighter">Nothing here yet</Text>
        <Text className="text-text-muted font-medium text-sm text-center leading-5 mb-6">{message}</Text>
        <View className="bg-background px-4 py-2 rounded-2xl border border-border">
          <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest">{cta}</Text>
        </View>
      </View>
    </View>
  );

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-background">

      {/* Header */}
      <View className="px-6 pt-2 pb-4 bg-background">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center space-x-3">
            <View className="w-8 h-8 bg-text-main rounded-xl items-center justify-center rotate-6 shadow-md shadow-text-main/20">
              <Text className="text-surface text-base font-black italic">A</Text>
            </View>
            <Text className="text-2xl font-black text-text-main tracking-tighter">Architect</Text>
          </View>
          <View className="flex-row items-center gap-2">
            {activeSubTab === 'routines' && (
              <TouchableOpacity
                onPress={() => { setImportJSON(''); setImportModalVisible(true); }}
                activeOpacity={0.8}
                className="bg-surface px-4 py-3 rounded-2xl border border-border shadow-sm"
              >
                <Text className="text-text-muted font-black text-xs uppercase tracking-widest">Import</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                if (activeSubTab === 'exercises') {
                  setEditingExercise({ name: '', muscle_group: MuscleGroup.CHEST, muscle_groups: [], type: ExerciseType.STRENGTH, description: '', default_rest_duration: 90 });
                  setExerciseModalVisible(true);
                } else if (activeSubTab === 'workouts') {
                  setEditingDay({ id: '', name: '', description: null, exercises: [] });
                  setDayModalVisible(true);
                } else {
                  setEditingRoutine({ name: '', description: null, mode: RoutineMode.ASYNC, duration: 12, start_day_index: 0, workout_mappings: [], week_numbers: [], ab_weeks_enabled: false });
                  setRoutineModalVisible(true);
                }
              }}
              activeOpacity={0.8}
              className="bg-primary px-5 py-3 rounded-2xl shadow-lg shadow-primary/20"
            >
              <Text className="text-surface font-black text-xs uppercase tracking-widest">+ New</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row mt-6 space-x-6">
          {(['routines', 'workouts', 'exercises'] as const).map((tab) => (
            <TouchableOpacity key={tab} onPress={() => setActiveSubTab(tab)} className="relative pb-2">
              <Text className={`text-[10px] font-black uppercase tracking-[2px] ${activeSubTab === tab ? 'text-primary' : 'text-text-muted'}`}>{tab}</Text>
              {activeSubTab === tab && <View className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Exercise search + muscle filter */}
      {activeSubTab === 'exercises' && (
        <View className="px-4 pb-2">
          <TextInput
            className="bg-surface border border-border rounded-2xl p-3 mb-2 text-text-main font-bold"
            placeholder="Search exercises..."
            placeholderTextColor="var(--color-text-muted)"
            value={exerciseSearch}
            onChangeText={setExerciseSearch}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => setMuscleFilter(null)}
              className={`px-3 py-1.5 mr-2 rounded-full border ${!muscleFilter ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
            >
              <Text className={`text-[10px] font-black uppercase tracking-widest ${!muscleFilter ? 'text-surface' : 'text-text-muted'}`}>All</Text>
            </TouchableOpacity>
            {availableMuscleFilters.map(mg => (
              <TouchableOpacity
                key={mg}
                onPress={() => setMuscleFilter(muscleFilter === mg ? null : mg)}
                className={`px-3 py-1.5 mr-2 rounded-full border ${muscleFilter === mg ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
              >
                <Text className={`text-[10px] font-black uppercase tracking-widest ${muscleFilter === mg ? 'text-surface' : 'text-text-muted'}`}>
                  {mg.replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main list */}
      <FlatList
        data={(activeSubTab === 'exercises' ? filteredExercises : activeSubTab === 'workouts' ? days : routines) as any[]}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        keyExtractor={(item: any) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          activeSubTab === 'exercises'
            ? renderEmptyState('No exercises yet.', 'Tap + New to add your first movement')
            : activeSubTab === 'workouts'
            ? renderEmptyState('No workouts yet.', 'Tap + New to build your first workout')
            : renderEmptyState('No routines yet.', 'Tap + New to create a training plan')
        }
        renderItem={activeSubTab === 'routines' ? renderRoutineItem : ({ item }: any) => (
          <View className="bg-surface p-6 mb-4 rounded-[32px] shadow-sm border border-border">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 mr-4">
                <Text className="text-lg font-black text-text-main mb-1 tracking-tight">{item.name}</Text>
                {activeSubTab === 'workouts' && !!item.description && (
                  <Text className="text-text-muted text-xs mb-2" numberOfLines={1}>{item.description}</Text>
                )}
                {activeSubTab === 'exercises' ? (
                  <View className="flex-row flex-wrap gap-2">
                    <View className="bg-background px-2 py-1 rounded-lg border border-border">
                      <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                        {(item.muscle_group as string)?.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <View className="bg-primary-soft px-2 py-1 rounded-lg border border-primary/10">
                      <Text className="text-[10px] font-black text-primary uppercase tracking-widest">
                        {(item.type as string)?.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View className="bg-background self-start px-2 py-1 rounded-lg border border-border">
                    <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                      {item.exercise_count} exercise{item.exercise_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-row">
                <TouchableOpacity onPress={() => handleEditItem(item)} className="bg-background p-3 rounded-2xl border border-border shadow-sm mr-2">
                  <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest">Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => activeSubTab === 'exercises' ? handleDeleteExercise(item.id) : handleDeleteDay(item.id)}
                  className="bg-background p-3 rounded-2xl border border-border shadow-sm"
                >
                  <Text className="text-accent font-black text-[10px] uppercase tracking-widest">Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      {/* ─── Exercise Modal ────────────────────────────────────────────────── */}
      <Modal visible={exerciseModalVisible} animationType="fade" transparent statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className="flex-1 justify-end bg-black/60">
            <View className="bg-surface rounded-t-[40px] p-8 pb-12 shadow-2xl h-[92%]">
              <View className="w-12 h-1.5 bg-border rounded-full self-center mb-6" />
              <Text className="text-2xl font-black text-text-main mb-6">
                {editingExercise?.id ? 'Edit Exercise' : 'New Exercise'}
              </Text>
              <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Name</Text>
                <TextInput
                  className="bg-background border border-border rounded-2xl p-4 mb-6 text-text-main font-bold"
                  placeholder="e.g. Barbell Back Squat"
                  placeholderTextColor="var(--color-text-muted)"
                  value={editingExercise?.name}
                  onChangeText={(t) => setEditingExercise({ ...editingExercise!, name: t })}
                />
                <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Description</Text>
                <TextInput
                  className="bg-background border border-border rounded-2xl p-4 mb-6 h-28 text-text-main font-medium"
                  multiline
                  placeholder="Cues, instructions, or notes..."
                  placeholderTextColor="var(--color-text-muted)"
                  value={editingExercise?.description || ''}
                  onChangeText={(t) => setEditingExercise({ ...editingExercise!, description: t })}
                />
                <View className="flex-row space-x-4 mb-6">
                  <View className="flex-1">
                    <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Default Rest (s)</Text>
                    <TextInput
                      className="bg-background border border-border rounded-2xl p-4 text-text-main font-bold"
                      keyboardType="numeric"
                      value={editingExercise?.default_rest_duration?.toString()}
                      onChangeText={(t) => setEditingExercise({ ...editingExercise!, default_rest_duration: parseInt(t) || 0 })}
                    />
                  </View>
                  <View className="flex-1" />
                </View>
                <Text className="text-xs font-black text-text-muted mb-3 uppercase tracking-widest px-1">Muscle Groups — tap to select, primary first</Text>
                <View className="flex-row flex-wrap mb-6">
                  {Object.values(MuscleGroup).map(mg => {
                    const selectedMuscles = editingExercise?.muscle_groups || (editingExercise?.muscle_group ? [editingExercise.muscle_group] : []);
                    const isSelected = selectedMuscles.includes(mg);
                    const primaryIndex = selectedMuscles.indexOf(mg);
                    return (
                      <TouchableOpacity
                        key={mg}
                        onPress={() => {
                          let nextMuscles = [...selectedMuscles];
                          if (isSelected) {
                            nextMuscles = nextMuscles.filter(m => m !== mg);
                          } else {
                            nextMuscles.push(mg);
                          }
                          setEditingExercise({ ...editingExercise!, muscle_groups: nextMuscles, muscle_group: nextMuscles[0] || MuscleGroup.CHEST });
                        }}
                        className={`px-3 py-1.5 m-1 rounded-lg border ${isSelected ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                      >
                        <View className="flex-row items-center">
                          <Text className={`text-[10px] font-bold ${isSelected ? 'text-surface' : 'text-text-muted'}`}>{mg.replace(/_/g, ' ')}</Text>
                          {isSelected && (
                            <View className={`ml-1.5 w-4 h-4 rounded-full items-center justify-center ${primaryIndex === 0 ? 'bg-surface' : 'bg-primary-soft'}`}>
                              <Text className={`text-[8px] font-black ${primaryIndex === 0 ? 'text-primary' : 'text-surface'}`}>{primaryIndex + 1}</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text className="text-xs font-black text-text-muted mb-3 uppercase tracking-widest px-1">Exercise Type</Text>
                <View className="flex-row flex-wrap mb-6">
                  {Object.values(ExerciseType).map(et => (
                    <TouchableOpacity
                      key={et}
                      onPress={() => setEditingExercise({ ...editingExercise!, type: et })}
                      className={`px-3 py-1.5 m-1 rounded-lg border ${editingExercise?.type === et ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                    >
                      <Text className={`text-[10px] font-bold ${editingExercise?.type === et ? 'text-surface' : 'text-text-muted'}`}>{et.replace('_', ' ')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View className="flex-row justify-between items-center mt-4">
                <TouchableOpacity onPress={() => setExerciseModalVisible(false)} className="flex-1 py-5 rounded-2xl mr-4">
                  <Text className="text-text-muted font-black text-center text-sm uppercase tracking-widest">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveExercise} className="flex-[2] bg-primary py-5 rounded-2xl">
                  <Text className="text-surface font-black text-center text-sm uppercase tracking-widest">Save Exercise</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Workout Modal ─────────────────────────────────────────────────── */}
      <Modal visible={dayModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View className="flex-1 justify-end bg-black/60">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
            <View className="bg-surface rounded-t-[40px] p-8 pb-12 shadow-2xl h-[92%]">
              <View className="w-12 h-1.5 bg-border rounded-full self-center mb-6" />
              <Text className="text-2xl font-black text-text-main mb-6">
                {editingDay?.id ? 'Edit Workout' : 'New Workout'}
              </Text>
              <ScrollView showsVerticalScrollIndicator={false} className="flex-1">

                <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Name</Text>
                <TextInput
                  className="bg-background border border-border rounded-2xl p-4 mb-4 text-text-main font-bold"
                  placeholder="e.g. Push Day"
                  placeholderTextColor="var(--color-text-muted)"
                  value={editingDay?.name}
                  onChangeText={(t) => setEditingDay({ ...editingDay!, name: t })}
                />

                <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Notes</Text>
                <TextInput
                  className="bg-background border border-border rounded-2xl p-4 mb-6 h-20 text-text-main font-medium"
                  multiline
                  placeholder="Optional notes about this workout..."
                  placeholderTextColor="var(--color-text-muted)"
                  value={editingDay?.description || ''}
                  onChangeText={(t) => setEditingDay({ ...editingDay!, description: t || null })}
                />

                <View className="flex-row justify-between items-center mb-4 px-1">
                  <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Exercises</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => openExercisePicker((id, name) => {
                      const ex = exercises.find(e => e.id === id);
                      setEditingDay(prev => prev ? {
                        ...prev,
                        exercises: [...prev.exercises, {
                          id: Math.random().toString(36).substring(2, 9),
                          exercise_id: id,
                          name,
                          type: ex?.type || ExerciseType.STRENGTH,
                          target_sets: 3,
                          target_reps: null,
                          target_weight: null,
                          target_time_ms: null,
                          target_distance: null,
                          rest_period_override: null,
                          superset_id: null,
                        }],
                      } : null);
                    })}
                    className="bg-primary-soft px-3 py-1.5 rounded-lg border border-primary/20"
                  >
                    <Text className="text-primary text-[10px] font-black uppercase tracking-widest">+ Add</Text>
                  </TouchableOpacity>
                </View>

                {editingDay?.exercises.map((ex, idx) => {
                  const isInSuperset = !!ex.superset_id;
                  const canSuperset = idx > 0;
                  const showReps = ex.type !== ExerciseType.ENDURANCE && ex.type !== ExerciseType.ISOMETRIC;
                  const showWeight = ex.type === ExerciseType.STRENGTH || ex.type === ExerciseType.WEIGHTED_BW;
                  const showTime = ex.type === ExerciseType.ENDURANCE || ex.type === ExerciseType.ISOMETRIC;
                  const showDistance = ex.type === ExerciseType.ENDURANCE;

                  return (
                    <View
                      key={idx}
                      className={`bg-background rounded-3xl p-5 mb-3 border ${isInSuperset ? 'border-primary/40' : 'border-border'}`}
                    >
                      <View className="flex-row justify-between items-center mb-3">
                        <View className="flex-row items-center flex-1 mr-2">
                          {isInSuperset && (
                            <View className="bg-primary-soft px-1.5 py-0.5 rounded mr-2">
                              <Text className="text-[8px] font-black text-primary uppercase">SS</Text>
                            </View>
                          )}
                          <Text className="text-sm font-black text-text-main flex-1">{ex.name}</Text>
                        </View>
                        <View className="flex-row items-center">
                          {canSuperset && (
                            <TouchableOpacity onPress={() => toggleSuperset(idx)} className="mr-3">
                              <Text className={`font-black text-[10px] uppercase ${isInSuperset ? 'text-primary' : 'text-text-muted'}`}>
                                {isInSuperset ? 'Ungroup' : 'Superset'}
                              </Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity onPress={() => {
                            const newExs = [...editingDay.exercises];
                            newExs.splice(idx, 1);
                            setEditingDay({ ...editingDay, exercises: newExs });
                          }}>
                            <Text className="text-accent font-black text-[10px] uppercase">Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View className="flex-row space-x-2 mb-3">
                        <View className="flex-1">
                          <Text className="text-[10px] font-black text-text-muted uppercase mb-1">Sets</Text>
                          <TextInput className="bg-surface border border-border rounded-xl p-3 text-center font-bold text-text-main" keyboardType="numeric" value={ex.target_sets.toString()} onChangeText={(v) => updateDayExercise(idx, 'target_sets', parseInt(v) || 0)} />
                        </View>
                        {showReps && (
                          <View className="flex-1">
                            <Text className="text-[10px] font-black text-text-muted uppercase mb-1">Reps</Text>
                            <TextInput className="bg-surface border border-border rounded-xl p-3 text-center font-bold text-text-main" keyboardType="numeric" value={ex.target_reps?.toString() || ''} onChangeText={(v) => updateDayExercise(idx, 'target_reps', parseInt(v) || null)} />
                          </View>
                        )}
                        {showWeight && (
                          <View className="flex-1">
                            <Text className="text-[10px] font-black text-text-muted uppercase mb-1">Weight</Text>
                            <TextInput className="bg-surface border border-border rounded-xl p-3 text-center font-bold text-text-main" keyboardType="numeric" value={ex.target_weight?.toString() || ''} onChangeText={(v) => updateDayExercise(idx, 'target_weight', parseFloat(v) || null)} />
                          </View>
                        )}
                        {showDistance && (
                          <View className="flex-1">
                            <Text className="text-[10px] font-black text-text-muted uppercase mb-1">Dist (km)</Text>
                            <TextInput className="bg-surface border border-border rounded-xl p-3 text-center font-bold text-text-main" keyboardType="numeric" value={ex.target_distance?.toString() || ''} onChangeText={(v) => updateDayExercise(idx, 'target_distance', parseFloat(v) || null)} />
                          </View>
                        )}
                        {showTime && (
                          <View className="flex-1">
                            <Text className="text-[10px] font-black text-text-muted uppercase mb-1">Time (s)</Text>
                            <TextInput
                              className="bg-surface border border-border rounded-xl p-3 text-center font-bold text-text-main"
                              keyboardType="numeric"
                              value={ex.target_time_ms ? Math.round(ex.target_time_ms / 1000).toString() : ''}
                              onChangeText={(v) => updateDayExercise(idx, 'target_time_ms', v ? (parseInt(v) || 0) * 1000 : null)}
                            />
                          </View>
                        )}
                      </View>

                      <View className="flex-row">
                        <View className="flex-1">
                          <Text className="text-[10px] font-black text-text-muted uppercase mb-1">Rest Override (s)</Text>
                          <TextInput className="bg-surface border border-border rounded-xl p-3 text-center font-bold text-text-main" keyboardType="numeric" value={ex.rest_period_override?.toString() || ''} onChangeText={(v) => updateDayExercise(idx, 'rest_period_override', parseInt(v) || null)} />
                        </View>
                        <View className="flex-[2]" />
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              <View className="flex-row justify-between items-center mt-6 pt-4 border-t border-border">
                <TouchableOpacity onPress={() => setDayModalVisible(false)} className="flex-1 py-5 rounded-2xl mr-4">
                  <Text className="text-text-muted font-black text-center text-sm uppercase tracking-widest">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveDay} className="flex-[2] bg-primary py-5 rounded-2xl">
                  <Text className="text-surface font-black text-center text-sm uppercase tracking-widest">Save Workout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
          {renderPickerOverlay()}
        </View>
      </Modal>

      {/* ─── Routine Modal ─────────────────────────────────────────────────── */}
      <Modal visible={routineModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View className="flex-1 justify-end bg-black/60">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
            <View className="bg-surface rounded-t-[40px] p-8 pb-12 shadow-2xl h-[92%]">
              <View className="w-12 h-1.5 bg-border rounded-full self-center mb-6" />
              <Text className="text-2xl font-black text-text-main mb-6">
                {editingRoutine?.id ? 'Edit Routine' : 'New Routine'}
              </Text>
              <ScrollView showsVerticalScrollIndicator={false} className="flex-1">

                <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Name</Text>
                <TextInput
                  className="bg-background border border-border rounded-2xl p-4 mb-4 text-text-main font-bold"
                  placeholder="e.g. Hypertrophy Plan"
                  placeholderTextColor="var(--color-text-muted)"
                  value={editingRoutine?.name}
                  onChangeText={(t) => setEditingRoutine({ ...editingRoutine!, name: t })}
                />

                <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Description</Text>
                <TextInput
                  className="bg-background border border-border rounded-2xl p-4 mb-6 h-20 text-text-main font-medium"
                  multiline
                  placeholder="Goals, focus, or notes..."
                  placeholderTextColor="var(--color-text-muted)"
                  value={editingRoutine?.description || ''}
                  onChangeText={(t) => setEditingRoutine({ ...editingRoutine!, description: t || null })}
                />

                <Text className="text-xs font-black text-text-muted mb-2 uppercase tracking-widest px-1">Duration (cycles)</Text>
                <TextInput
                  className="bg-background border border-border rounded-2xl p-4 mb-6 text-text-main font-bold"
                  placeholder="e.g. 12"
                  placeholderTextColor="var(--color-text-muted)"
                  keyboardType="numeric"
                  value={editingRoutine?.duration?.toString()}
                  onChangeText={(t) => setEditingRoutine({ ...editingRoutine!, duration: parseInt(t) || 0 })}
                />

                <Text className="text-xs font-black text-text-muted mb-3 uppercase tracking-widest px-1">Schedule Mode</Text>
                <View className="flex-row mb-6">
                  {Object.values(RoutineMode).map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setEditingRoutine({ ...editingRoutine!, mode: m, workout_mappings: m === RoutineMode.WEEKLY ? Array(7).fill(null) : [], week_numbers: [], ab_weeks_enabled: false })}
                      className={`flex-1 p-4 rounded-2xl mr-2 border ${editingRoutine?.mode === m ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                    >
                      <Text className={`text-center font-black text-[10px] uppercase tracking-widest ${editingRoutine?.mode === m ? 'text-surface' : 'text-text-muted'}`}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* WEEKLY: start day */}
                {editingRoutine?.mode === RoutineMode.WEEKLY && (
                  <>
                    <Text className="text-xs font-black text-text-muted mb-3 uppercase tracking-widest px-1">Week Starts On</Text>
                    <View className="flex-row mb-6">
                      {START_DAY_LABELS.map((label, idx) => (
                        <TouchableOpacity
                          key={label}
                          onPress={() => setEditingRoutine({ ...editingRoutine!, start_day_index: idx })}
                          className={`flex-1 p-3 rounded-xl mr-1 border items-center ${(editingRoutine.start_day_index ?? 0) === idx ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                        >
                          <Text className={`text-[9px] font-black uppercase ${(editingRoutine.start_day_index ?? 0) === idx ? 'text-surface' : 'text-text-muted'}`}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* WEEKLY: day mapping */}
                {editingRoutine?.mode === RoutineMode.WEEKLY ? (
                  <View>
                    {WEEK_DAYS.map((dayName, idx) => (
                      <View key={dayName} className="flex-row justify-between items-center mb-3 bg-background p-4 rounded-2xl border border-border">
                        <Text className="text-sm font-black text-text-main">{dayName}</Text>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => openWorkoutPicker((id) => {
                            setEditingRoutine(prev => {
                              if (!prev) return null;
                              const newMaps = [...prev.workout_mappings];
                              newMaps[idx] = id;
                              return { ...prev, workout_mappings: newMaps };
                            });
                          })}
                          className="bg-surface px-4 py-2 rounded-xl border border-border"
                        >
                          <Text className="text-[10px] font-black text-primary uppercase tracking-widest">
                            {editingRoutine.workout_mappings[idx]
                              ? days.find(d => d.id === editingRoutine.workout_mappings[idx])?.name || 'Assigned'
                              : 'Rest Day'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  /* ASYNC queue */
                  <View>
                    <View className="flex-row justify-between items-center mb-4 px-1">
                      <View>
                        <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Workout Order</Text>
                        <Text className="text-[10px] text-text-muted mt-0.5">
                          {editingRoutine?.ab_weeks_enabled ? 'A/B week mode' : 'Linear sequence'}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <TouchableOpacity
                          onPress={() => setEditingRoutine(prev => prev ? { ...prev, ab_weeks_enabled: !prev.ab_weeks_enabled } : null)}
                          className={`px-3 py-1.5 rounded-lg border mr-3 ${editingRoutine?.ab_weeks_enabled ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                        >
                          <Text className={`text-[10px] font-black uppercase tracking-widest ${editingRoutine?.ab_weeks_enabled ? 'text-surface' : 'text-text-muted'}`}>A/B Weeks</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => openWorkoutPicker((id) => {
                            setEditingRoutine(prev => {
                              if (!prev) return null;
                              return { ...prev, workout_mappings: [...prev.workout_mappings, id], week_numbers: [...prev.week_numbers, 0] };
                            });
                          })}
                          className="bg-primary-soft px-3 py-1.5 rounded-lg border border-primary/20"
                        >
                          <Text className="text-primary text-[10px] font-black uppercase tracking-widest">+ Add</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {editingRoutine?.workout_mappings.map((wId, idx) => (
                      <View key={idx} className="flex-row justify-between items-center mb-2 bg-background p-4 rounded-2xl border border-border">
                        <View className="flex-row items-center flex-1">
                          {editingRoutine.ab_weeks_enabled && (
                            <TouchableOpacity
                              onPress={() => setEditingRoutine(prev => {
                                if (!prev) return null;
                                const newWeeks = [...prev.week_numbers];
                                newWeeks[idx] = newWeeks[idx] === 1 ? 0 : 1;
                                return { ...prev, week_numbers: newWeeks };
                              })}
                              className={`w-7 h-7 rounded-lg items-center justify-center mr-3 border ${editingRoutine.week_numbers[idx] === 1 ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                            >
                              <Text className={`text-[10px] font-black ${editingRoutine.week_numbers[idx] === 1 ? 'text-surface' : 'text-text-muted'}`}>
                                {editingRoutine.week_numbers[idx] === 1 ? 'B' : 'A'}
                              </Text>
                            </TouchableOpacity>
                          )}
                          <Text className="text-sm font-black text-text-main">
                            {idx + 1}. {days.find(d => d.id === wId)?.name || 'Workout'}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => {
                          setEditingRoutine(prev => {
                            if (!prev) return null;
                            const newMaps = [...prev.workout_mappings];
                            const newWeeks = [...prev.week_numbers];
                            newMaps.splice(idx, 1);
                            newWeeks.splice(idx, 1);
                            return { ...prev, workout_mappings: newMaps, week_numbers: newWeeks };
                          });
                        }}>
                          <Text className="text-accent font-black text-[10px] uppercase">Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
              <View className="flex-row justify-between items-center mt-6 pt-4 border-t border-border">
                <TouchableOpacity onPress={() => setRoutineModalVisible(false)} className="flex-1 py-5 rounded-2xl mr-4">
                  <Text className="text-text-muted font-black text-center text-sm uppercase tracking-widest">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveRoutine} className="flex-[2] bg-primary py-5 rounded-2xl shadow-xl shadow-primary/20">
                  <Text className="text-surface font-black text-center text-sm uppercase tracking-widest">Save Routine</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
          {renderPickerOverlay()}
        </View>
      </Modal>

      {/* ─── Import Conflict Strategy Modal ───────────────────────────────── */}
      <Modal visible={importStrategyModalVisible} animationType="fade" transparent statusBarTranslucent>
        <View className="flex-1 justify-center bg-black/60 px-6">
          <View className="bg-surface rounded-[40px] p-8 shadow-2xl">
            <Text className="text-xl font-black text-text-main mb-1 tracking-tighter">Conflicts Found</Text>
            <Text className="text-text-muted text-xs font-medium mb-5 leading-5">
              Some items in this import already exist. How would you like to handle them?
            </Text>

            {/* Conflict list */}
            <View className="bg-background rounded-2xl p-4 mb-6 border border-border">
              {importConflicts.map((c, i) => (
                <View key={i} className={`flex-row items-start ${i < importConflicts.length - 1 ? 'mb-3' : ''}`}>
                  <View className={`px-1.5 py-0.5 rounded mr-2 mt-0.5 ${
                    c.kind === 'routine' ? 'bg-primary-soft' :
                    c.kind === 'workout' ? 'bg-background border border-border' :
                    'bg-accent/10'
                  }`}>
                    <Text className={`text-[8px] font-black uppercase tracking-widest ${
                      c.kind === 'routine' ? 'text-primary' :
                      c.kind === 'workout' ? 'text-text-muted' :
                      'text-accent'
                    }`}>{c.kind}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-text-main">{c.name}</Text>
                    {!!c.detail && (
                      <Text className="text-[10px] text-text-muted mt-0.5">{c.detail}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Strategy buttons */}
            <TouchableOpacity
              onPress={() => executeImport(importBundle, 'replace')}
              activeOpacity={0.8}
              className="bg-primary py-5 rounded-2xl mb-3"
            >
              <Text className="text-surface font-black text-center text-sm uppercase tracking-widest">Replace Existing</Text>
              <Text className="text-surface/60 font-medium text-center text-[10px] mt-1">Overwrites matching items in place</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => executeImport(importBundle, 'duplicate')}
              activeOpacity={0.8}
              className="bg-background border border-border py-5 rounded-2xl mb-3"
            >
              <Text className="text-text-main font-black text-center text-sm uppercase tracking-widest">Import as Copies</Text>
              <Text className="text-text-muted font-medium text-center text-[10px] mt-1">Adds with "(Imported)" suffix — nothing overwritten</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setImportStrategyModalVisible(false);
                setImportModalVisible(true);
              }}
              activeOpacity={0.7}
              className="py-4 items-center"
            >
              <Text className="text-text-muted font-black text-xs uppercase tracking-widest">Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Export Routine Modal ──────────────────────────────────────────── */}
      <Modal visible={exportModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View className="flex-1 justify-end bg-black/60">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
            <View className="bg-surface rounded-t-[40px] p-8 pb-12 shadow-2xl h-[85%]">
              <View className="w-12 h-1.5 bg-border rounded-full self-center mb-6" />
              <Text className="text-2xl font-black text-text-main mb-1">Export Routine</Text>
              <Text className="text-text-muted text-xs font-medium mb-6 leading-5">
                Copy the text below and share it. Anyone can import it into their Architect.
              </Text>
              <ScrollView className="flex-1 bg-background rounded-2xl p-4 border border-border mb-6">
                <Text selectable className="text-text-muted font-mono text-xs leading-5">{exportJSON}</Text>
              </ScrollView>
              <TouchableOpacity
                onPress={() => setExportModalVisible(false)}
                className="bg-primary py-5 rounded-2xl"
              >
                <Text className="text-surface font-black text-center text-sm uppercase tracking-widest">Done</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ─── Import Routine Modal ──────────────────────────────────────────── */}
      <Modal visible={importModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View className="flex-1 justify-end bg-black/60">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
            <View className="bg-surface rounded-t-[40px] p-8 pb-12 shadow-2xl h-[85%]">
              <View className="w-12 h-1.5 bg-border rounded-full self-center mb-6" />
              <Text className="text-2xl font-black text-text-main mb-1">Import Routine</Text>
              <Text className="text-text-muted text-xs font-medium mb-6 leading-5">
                Paste a routine export below. Exercises will be matched by name — duplicates won't be created.
              </Text>
              <TextInput
                className="flex-1 bg-background border border-border rounded-2xl p-4 text-text-muted font-mono text-xs mb-6"
                multiline
                textAlignVertical="top"
                placeholder="Paste JSON here..."
                placeholderTextColor="var(--color-text-muted)"
                value={importJSON}
                onChangeText={setImportJSON}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View className="flex-row">
                <TouchableOpacity
                  onPress={() => { setImportModalVisible(false); setImportJSON(''); }}
                  className="flex-1 py-5 rounded-2xl mr-4"
                >
                  <Text className="text-text-muted font-black text-center text-sm uppercase tracking-widest">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleImportRoutine}
                  className="flex-[2] bg-primary py-5 rounded-2xl"
                >
                  <Text className="text-surface font-black text-center text-sm uppercase tracking-widest">Import Routine</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </View>
  );
};
