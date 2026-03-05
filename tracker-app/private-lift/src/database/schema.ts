export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS Exercises (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- Enum: STRENGTH, BODYWEIGHT, ENDURANCE, ISOMETRIC, WEIGHTED_BW
  default_rest_duration INTEGER DEFAULT 90, -- Sensible default for the "lay person"
  last_modified INTEGER NOT NULL -- Timestamp for Sync
);

CREATE TABLE IF NOT EXISTS Exercise_Muscle_Groups (
  id TEXT PRIMARY KEY NOT NULL,
  exercise_id TEXT NOT NULL,
  muscle_group TEXT NOT NULL, -- Enum: CHEST, BACK, etc.
  is_primary INTEGER DEFAULT 1, -- Useful for "Main Lift" vs "Assistance" analytics
  last_modified INTEGER NOT NULL,
  FOREIGN KEY (exercise_id) REFERENCES Exercises (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Workouts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  estimated_duration INTEGER, -- In minutes
  last_modified INTEGER NOT NULL -- Timestamp
);

CREATE TABLE IF NOT EXISTS Workout_Exercises (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  superset_id TEXT, -- To group exercises together
  order_index INTEGER NOT NULL,
  target_sets INTEGER NOT NULL,
  target_reps INTEGER,
  target_weight REAL,
  target_time_ms INTEGER,
  target_distance REAL,
  rest_period_override INTEGER, -- Overrides Exercise default
  last_modified INTEGER NOT NULL, -- Timestamp
  FOREIGN KEY (workout_id) REFERENCES Workouts (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES Exercises (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Routines (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT, -- High-level goal/notes
  mode TEXT NOT NULL, -- Enum: WEEKLY, ASYNC
  duration INTEGER NOT NULL,
  cycle_count INTEGER DEFAULT 0,
  last_modified INTEGER NOT NULL -- Timestamp
);

CREATE TABLE IF NOT EXISTS Routine_Workouts (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  day_of_week INTEGER, -- (0-6) For WEEKLY mode
  week_number INTEGER, -- Week A and Week B type routines
  order_index INTEGER NOT NULL, -- For ASYNC sequence
  last_modified INTEGER NOT NULL, -- Timestamp
  FOREIGN KEY (routine_id) REFERENCES Routines (id) ON DELETE CASCADE,
  FOREIGN KEY (workout_id) REFERENCES Workouts (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Logged_Sessions (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL,
  routine_id TEXT,
  start_time INTEGER NOT NULL, -- Renamed from timestamp
  end_time INTEGER, -- End time for duration tracking
  notes TEXT, -- Overall session feedback
  rpe REAL, -- Perceived exertion for the entire session
  is_swapped INTEGER DEFAULT 0,
  last_modified INTEGER NOT NULL, -- Timestamp
  FOREIGN KEY (workout_id) REFERENCES Workouts (id),
  FOREIGN KEY (routine_id) REFERENCES Routines (id)
);

CREATE TABLE IF NOT EXISTS Logged_Sets (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  set_type TEXT DEFAULT 'WORKING', -- Enum: WARMUP, WORKING, DROPSET, FAILURE
  weight REAL,
  reps INTEGER,
  time_ms INTEGER,
  distance REAL,
  notes TEXT, -- Set-specific feedback
  is_skipped INTEGER DEFAULT 0,
  order_index INTEGER NOT NULL, -- Order within the session
  last_modified INTEGER NOT NULL, -- Timestamp
  FOREIGN KEY (session_id) REFERENCES Logged_Sessions (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES Exercises (id)
);

CREATE TABLE IF NOT EXISTS User_Biometrics (
  id TEXT PRIMARY KEY NOT NULL,
  measured_at INTEGER NOT NULL,
  body_weight REAL,
  body_fat_pct REAL,
  notes TEXT,
  photo_path TEXT,
  last_modified INTEGER NOT NULL -- Timestamp
);

CREATE TABLE IF NOT EXISTS Active_Session (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL,
  routine_id TEXT,
  start_time INTEGER NOT NULL,
  current_exercise_id TEXT,
  current_set_index INTEGER,
  timer_start_time INTEGER,
  is_paused INTEGER DEFAULT 0,
  is_swapped INTEGER DEFAULT 0,
  draft_data TEXT, -- JSON blob for crash recovery/volatile swapping state
  last_modified INTEGER NOT NULL, -- Timestamp
  FOREIGN KEY (workout_id) REFERENCES Workouts (id),
  FOREIGN KEY (routine_id) REFERENCES Routines (id)
);

CREATE TABLE IF NOT EXISTS User_Settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_routine_id TEXT,
  user_name TEXT,
  weight_unit TEXT DEFAULT 'KG', -- KG or LBS
  distance_unit TEXT DEFAULT 'KM', -- KM or MILES
  theme TEXT DEFAULT 'base', -- light, base, dark
  rest_timer_enabled INTEGER DEFAULT 1, -- Boolean
  rest_timer_sound INTEGER DEFAULT 1, -- Boolean
  rest_timer_vibrate INTEGER DEFAULT 1, -- Boolean
  auto_start_rest_timer INTEGER DEFAULT 1, -- Boolean
  keep_screen_on INTEGER DEFAULT 1, -- Boolean
  default_rest_duration INTEGER DEFAULT 60, -- Seconds
  calendar_sync_enabled INTEGER DEFAULT 0, -- Boolean
  sync_history_limit_months INTEGER DEFAULT 6, -- Design Doc 1.0 subset preference
  last_sync_timestamp INTEGER,
  vault_connection_token TEXT,
  last_modified INTEGER NOT NULL, -- Timestamp
  FOREIGN KEY (active_routine_id) REFERENCES Routines (id)
);
`;
