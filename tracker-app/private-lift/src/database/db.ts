import * as SQLite from 'expo-sqlite';
import { SCHEMA_V1 } from './schema';

const db = SQLite.openDatabaseSync('privatelift.db');

export interface QueryResult {
  rowsAffected: number;
  insertId: number;
}

export const initDatabase = async () => {
  try {
    // 1. Temporarily disable foreign keys to allow dropping tables with relationships
    db.execSync('PRAGMA foreign_keys = OFF;');
    
    // 2. Drop all existing tables for a "Hard Reset" (Development Mode)
    const tables = [
      'Exercises', 'Exercise_Muscle_Groups', 'Workouts', 'Workout_Exercises', 
      'Routines', 'Routine_Workouts', 'Logged_Sessions', 'Logged_Sets', 
      'User_Biometrics', 'Active_Session', 'User_Settings'
    ];

    for (const table of tables) {
      db.execSync(`DROP TABLE IF EXISTS ${table};`);
    }

    // 3. Re-enable foreign keys
    db.execSync('PRAGMA foreign_keys = ON;');
    
    // 4. Split SCHEMA_V1 into individual statements and execute
    const statements = SCHEMA_V1.split(';').filter(s => s.trim() !== '');
    for (const statement of statements) {
      db.execSync(statement);
    }

    // 5. Initialize User Settings with default values
    db.runSync(
      'INSERT INTO User_Settings (id, weight_unit, theme, last_modified) VALUES (1, "KG", "base", ?);', 
      [Date.now()]
    );

    console.log('Database hard-reset and initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};

/**
 * Executes a SELECT query and returns an array of typed results.
 */
export const select = <T>(sql: string, params: any[] = []): T[] => {
  try {
    return db.getAllSync(sql, params) as T[];
  } catch (error) {
    console.error('SELECT query failed:', sql, error);
    throw error;
  }
};

/**
 * Executes an INSERT, UPDATE, or DELETE query and returns metadata.
 */
export const execute = (sql: string, params: any[] = []): QueryResult => {
  try {
    const result = db.runSync(sql, params);
    return { 
      rowsAffected: result.changes, 
      insertId: result.lastInsertRowId 
    };
  } catch (error) {
    console.error('Execute query failed:', sql, error);
    throw error;
  }
};

/**
 * Legacy support for the 'query' function, but now with better typing.
 */
export const query = (sql: string, params: any[] = []) => {
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    const results = select(sql, params);
    return { rows: { _array: results } };
  } else {
    const result = execute(sql, params);
    return result;
  }
};

/**
 * Helper class for common database operations with full typing.
 */
export class DB {
  static getAll<T>(sql: string, params: any[] = []): T[] {
    return select<T>(sql, params);
  }

  static getOne<T>(sql: string, params: any[] = []): T | null {
    const results = select<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  static run(sql: string, params: any[] = []): QueryResult {
    return execute(sql, params);
  }

  static transaction(callback: () => void) {
    db.withTransactionSync(callback);
  }
}

export default db;
