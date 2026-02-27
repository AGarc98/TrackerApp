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
  last_modified: number; // Timestamp
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  target_reps: number;
  last_modified: number; // Timestamp
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
  last_modified: number; // Timestamp
}

export interface RoutineWorkout {
  id: string;
  routine_id: string;
  workout_id: string;
  order_index: number;
  last_modified: number; // Timestamp
}

export interface LoggedSession {
  id: string;
  workout_id: string;
  timestamp: number;
  is_swapped: boolean;
  last_modified: number; // Timestamp
}

export interface LoggedSet {
  id: string;
  session_id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  time_ms: number;
  is_skipped: boolean;
  last_modified: number; // Timestamp
}

export interface UserBiometrics {
  id: string;
  timestamp: number;
  body_weight: number;
  body_fat_pct?: number;
  photo_path?: string;
  last_modified: number; // Timestamp
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
  default_rest_duration: number;
  calendar_sync_enabled: boolean;
  sync_history_limit_months: number;
  last_sync_timestamp: number | null;
  vault_connection_token: string | null;
  last_modified: number; // Timestamp
}

export interface ActiveSession {
  id: string;
  workout_id: string;
  timestamp: number;
  is_swapped: boolean;
  draft_data?: string; // JSON blob for crash recovery/volatile swapping state
  last_modified: number; // Timestamp
}

export interface DraftSet {
  id: string;
  session_id: string;
  exercise_id: string;
  input_data: string; // JSON string of SetData[]
}
