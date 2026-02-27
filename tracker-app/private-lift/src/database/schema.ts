export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS Exercises (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- Enum: STRENGTH, BODYWEIGHT, ENDURANCE, ISOMETRIC, WEIGHTED_BW
  muscle_group TEXT NOT NULL, -- Enum: CHEST, BACK, etc.
  is_base_content INTEGER DEFAULT 0, -- Boolean
  last_modified INTEGER NOT NULL -- Timestamp
);

CREATE TABLE IF NOT EXISTS Workouts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  last_modified INTEGER NOT NULL -- Timestamp
);

CREATE TABLE IF NOT EXISTS Workout_Exercises (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  target_sets INTEGER NOT NULL,
  target_reps INTEGER NOT NULL,
  last_modified INTEGER NOT NULL, -- Timestamp
  FOREIGN KEY (workout_id) REFERENCES Workouts (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES Exercises (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Routines (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL, -- Enum: WEEKLY, ASYNC
  duration INTEGER NOT NULL,
  cycle_count INTEGER DEFAULT 0,
  last_modified INTEGER NOT NULL -- Timestamp
);

CREATE TABLE IF NOT EXISTS Routine_Workouts (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  last_modified INTEGER NOT NULL, -- Timestamp
  FOREIGN KEY (routine_id) REFERENCES Routines (id) ON DELETE CASCADE,
  FOREIGN KEY (workout_id) REFERENCES Workouts (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Logged_Sessions (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  is_swapped INTEGER DEFAULT 0,
  last_modified INTEGER NOT NULL, -- Timestamp
  FOREIGN KEY (workout_id) REFERENCES Workouts (id)
);

CREATE TABLE IF NOT EXISTS Logged_Sets (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  weight REAL,
  reps INTEGER,
  time_ms INTEGER,
  is_skipped INTEGER DEFAULT 0,
  last_modified INTEGER NOT NULL, -- Timestamp
  FOREIGN KEY (session_id) REFERENCES Logged_Sessions (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES Exercises (id)
);

CREATE TABLE IF NOT EXISTS User_Biometrics (
  id TEXT PRIMARY KEY NOT NULL,
  timestamp INTEGER NOT NULL,
  body_weight REAL,
  body_fat_pct REAL,
  photo_path TEXT,
  last_modified INTEGER NOT NULL -- Timestamp
);

CREATE TABLE IF NOT EXISTS Active_Session (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  is_swapped INTEGER DEFAULT 0,
  draft_data TEXT, -- JSON blob for crash recovery/volatile swapping state
  last_modified INTEGER NOT NULL, -- Timestamp
  FOREIGN KEY (workout_id) REFERENCES Workouts (id)
);

CREATE TABLE IF NOT EXISTS User_Settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_routine_id TEXT,
  unit_system TEXT DEFAULT 'KG', -- KG or LBS
  rest_timer_enabled INTEGER DEFAULT 1, -- Boolean
  rest_timer_sound INTEGER DEFAULT 1, -- Boolean
  default_rest_duration INTEGER DEFAULT 60, -- Seconds
  calendar_sync_enabled INTEGER DEFAULT 0, -- Boolean
  sync_history_limit_months INTEGER DEFAULT 6, -- Design Doc 1.0 subset preference
  last_sync_timestamp INTEGER,
  vault_connection_token TEXT,
  last_modified INTEGER NOT NULL, -- Timestamp
  FOREIGN KEY (active_routine_id) REFERENCES Routines (id)
);
`;
