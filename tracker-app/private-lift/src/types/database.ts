export enum MuscleGroup {
  CHEST = 'CHEST',
  BACK = 'BACK',
  SHOULDERS = 'SHOULDERS',
  BICEPS = 'BICEPS',
  TRICEPS = 'TRICEPS',
  LEGS_QUADS = 'LEGS_QUADS',
  LEGS_HAMS = 'LEGS_HAMS',
  CALVES = 'CALVES',
  CORE = 'CORE',
  CARDIO = 'CARDIO',
}

export enum ExerciseType {
  STRENGTH = 'STRENGTH',
  BODYWEIGHT = 'BODYWEIGHT',
  ENDURANCE = 'ENDURANCE',
  ISOMETRIC = 'ISOMETRIC',
  WEIGHTED_BW = 'WEIGHTED_BW',
}

export interface Exercise {
  id: string;
  name: string;
  description: string;
  type: ExerciseType;
  muscle_group: MuscleGroup;
  is_base_content: boolean;
  last_modified: number; // Timestamp
}

export interface Workout {
  id: string;
  name: string;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  order: number;
  target_sets: number;
  target_reps: number;
}

export enum RoutineMode {
  WEEKLY = 'WEEKLY',
  ASYNC = 'ASYNC',
}

export interface Routine {
  id: string;
  name: string;
  mode: RoutineMode;
  duration: number; // weeks/cycles
  cycle_count: number;
}

export interface RoutineWorkout {
  id: string;
  routine_id: string;
  workout_id: string;
  order_index: number;
}

export interface LoggedSession {
  id: string;
  workout_id: string;
  timestamp: number;
  is_swapped: boolean;
}

export interface LoggedSet {
  id: string;
  session_id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  time_ms: number;
  is_skipped: boolean;
}

export interface UserBiometrics {
  id: string;
  timestamp: number;
  body_weight: number;
  body_fat_pct?: number;
  photo_path?: string;
}

export interface SetData {
  id: string;
  weight?: number;
  reps?: number;
  time_ms?: number;
  is_skipped: boolean;
  is_completed: boolean;
}

export interface UserSettings {
  id: number;
  active_routine_id: string | null;
  unit_system: 'KG' | 'LBS';
  rest_timer_enabled: boolean;
  rest_timer_sound: boolean;
  calendar_sync_enabled: boolean;
  last_sync_timestamp: number | null;
  vault_connection_token: string | null;
}

export interface ActiveSession {
  id: string;
  workout_id: string;
  timestamp: number;
  is_swapped: boolean;
}

export interface DraftSet {
  id: string;
  session_id: string;
  exercise_id: string;
  input_data: string; // JSON string of SetData[]
}
