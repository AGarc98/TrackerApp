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
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Workout_Exercises (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  target_sets INTEGER NOT NULL,
  FOREIGN KEY (workout_id) REFERENCES Workouts (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES Exercises (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Routines (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL, -- Enum: WEEKLY, ASYNC
  duration INTEGER NOT NULL,
  cycle_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS Routine_Workouts (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT NOT NULL,
  workout_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  FOREIGN KEY (routine_id) REFERENCES Routines (id) ON DELETE CASCADE,
  FOREIGN KEY (workout_id) REFERENCES Workouts (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Logged_Sessions (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  is_swapped INTEGER DEFAULT 0,
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
  FOREIGN KEY (session_id) REFERENCES Logged_Sessions (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES Exercises (id)
);

CREATE TABLE IF NOT EXISTS User_Biometrics (
  id TEXT PRIMARY KEY NOT NULL,
  timestamp INTEGER NOT NULL,
  body_weight REAL,
  body_fat_pct REAL,
  photo_path TEXT
);

CREATE TABLE IF NOT EXISTS Draft_Sets (
  id TEXT PRIMARY KEY NOT NULL,
  exercise_id TEXT NOT NULL,
  input_data TEXT NOT NULL, -- JSON string
  FOREIGN KEY (exercise_id) REFERENCES Exercises (id)
);
`;
