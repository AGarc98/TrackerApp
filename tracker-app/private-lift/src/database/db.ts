import * as SQLite from 'expo-sqlite';
import { SCHEMA_V1 } from './schema';

const db = SQLite.openDatabaseSync('privatelift.db');

export const initDatabase = async () => {
  try {
    // Enable foreign keys
    db.execSync('PRAGMA foreign_keys = ON;');
    
    // FORCE RESET: Uncommented to ensure the new schema (including session_id) is applied.
    db.execSync('DROP TABLE IF EXISTS Draft_Sets; DROP TABLE IF EXISTS Active_Session; DROP TABLE IF EXISTS User_Settings; DROP TABLE IF EXISTS Logged_Sets; DROP TABLE IF EXISTS Logged_Sessions; DROP TABLE IF EXISTS Routine_Workouts; DROP TABLE IF EXISTS Workout_Exercises; DROP TABLE IF EXISTS Routines; DROP TABLE IF EXISTS Workouts; DROP TABLE IF EXISTS Exercises;');

    // Split SCHEMA_V1 into individual statements
    const statements = SCHEMA_V1.split(';').filter(s => s.trim() !== '');
    
    for (const statement of statements) {
      db.execSync(statement);
    }
    
    // Ensure User_Settings exists
    const check = db.getAllSync('SELECT COUNT(*) as count FROM User_Settings;');
    if ((check[0] as any).count === 0) {
      db.runSync('INSERT INTO User_Settings (id, unit_system) VALUES (1, "KG");');
    }

    console.log('Database initialized successfully with fresh schema');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};

export const query = (sql: string, params: any[] = []) => {
  try {
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      const results = db.getAllSync(sql, params);
      return { rows: { _array: results } };
    } else {
      const result = db.runSync(sql, params);
      return { rowsAffected: result.changes, insertId: result.lastInsertRowId };
    }
  } catch (error) {
    console.error('Query failed:', sql, error);
    throw error;
  }
};

export const executeBatch = (statements: { sql: string; params: any[] }[]) => {
  db.withTransactionSync(() => {
    for (const s of statements) {
      db.runSync(s.sql, s.params);
    }
  });
};

export default db;
