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

export enum RoutineMode {
  WEEKLY = 'WEEKLY',
  ASYNC = 'ASYNC',
}

export enum SetType {
  WARMUP = 'WARMUP',
  WORKING = 'WORKING',
  DROPSET = 'DROPSET',
  FAILURE = 'FAILURE',
}

export interface Exercise {
  id: string;
  name: string;
  description: string | null;
  type: ExerciseType;
  default_rest_duration: number; // Seconds
  last_modified: number;
}

export type ExerciseWithMuscle = Exercise & { muscle_group: MuscleGroup };

export interface ExerciseMuscleGroup {
  id: string;
  exercise_id: string;
  muscle_group: MuscleGroup;
  is_primary: boolean;
  last_modified: number;
}

export interface Workout {
  id: string;
  name: string;
  description: string | null;
  estimated_duration: number | null; // In minutes
  last_modified: number;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  superset_id: string | null;
  order_index: number;
  target_sets: number;
  target_reps: number | null;
  target_weight: number | null;
  target_time_ms: number | null;
  target_distance: number | null;
  rest_period_override: number | null;
  last_modified: number;
}

export interface Routine {
  id: string;
  name: string;
  description: string | null;
  mode: RoutineMode;
  duration: number; // Cycles or weeks
  start_day_index: number; // 0-6 Monday-indexed
  cycle_count: number;
  last_modified: number;
}

export interface RoutineWorkout {
  id: string;
  routine_id: string;
  workout_id: string;
  day_of_week: number | null; // 0-6
  week_number: number | null;
  order_index: number;
  last_modified: number;
}

export interface LoggedSession {
  id: string;
  workout_id: string;
  routine_id: string | null;
  start_time: number;
  end_time: number | null;
  notes: string | null;
  rpe: number | null;
  is_swapped: boolean;
  last_modified: number;
}

export interface LoggedSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_type: SetType;
  weight: number | null;
  reps: number | null;
  time_ms: number | null;
  distance: number | null;
  notes: string | null;
  is_skipped: boolean;
  order_index: number;
  last_modified: number;
}

export interface UserBiometrics {
  id: string;
  measured_at: number;
  body_weight: number | null;
  body_fat_pct: number | null;
  notes: string | null;
  photo_path: string | null;
  last_modified: number;
}

export interface ActiveSession {
  id: string;
  workout_id: string;
  routine_id: string | null;
  start_time: number;
  current_exercise_id: string | null;
  current_set_index: number | null;
  timer_start_time: number | null;
  is_paused: boolean;
  is_swapped: boolean;
  draft_data: string | null; // JSON blob
  last_modified: number;
}

export interface UserSettings {
  id: 1;
  active_routine_id: string | null;
  user_name: string | null;
  weight_unit: 'KG' | 'LBS';
  distance_unit: 'KM' | 'MILES';
  theme: 'light' | 'base' | 'dark';
  rest_timer_enabled: boolean;
  rest_timer_sound: boolean;
  rest_timer_vibrate: boolean;
  auto_start_rest_timer: boolean;
  keep_screen_on: boolean;
  default_rest_duration: number;
  calendar_sync_enabled: boolean;
  sync_history_limit_months: number;
  last_sync_timestamp: number | null;
  vault_connection_token: string | null;
  last_modified: number;
}

export interface SetData {
  id: string;
  weight?: number;
  reps?: number;
  time_ms?: number;
  distance?: number;
  is_completed: boolean;
  is_skipped: boolean;
  notes?: string;
}
