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
 * Helper class for common database operations with full typing and safety features.
 */
export class DB {
  /**
   * Automatically converts boolean values to 0/1 for SQLite compatibility.
   */
  private static prepareParams(params: any[]): any[] {
    return params.map(p => typeof p === 'boolean' ? (p ? 1 : 0) : p);
  }

  /**
   * Converts 0/1 values back to booleans based on simple inference.
   * Note: Only applies to fields that seem like flags.
   */
  private static formatResult<T>(row: any): T {
    const formatted = { ...row };
    Object.keys(formatted).forEach(key => {
      if (key.startsWith('is_') || key.endsWith('_enabled') || key.endsWith('_on')) {
        formatted[key] = !!formatted[key];
      }
    });
    return formatted as T;
  }

  static getAll<T>(sql: string, params: any[] = []): T[] {
    const results = select<any>(sql, this.prepareParams(params));
    return results.map(row => this.formatResult<T>(row));
  }

  static getOne<T>(sql: string, params: any[] = []): T | null {
    const result = db.getFirstSync(sql, this.prepareParams(params));
    return result ? this.formatResult<T>(result) : null;
  }

  static run(sql: string, params: any[] = []): QueryResult {
    return execute(sql, this.prepareParams(params));
  }

  static transaction(callback: () => void) {
    db.withTransactionSync(callback);
  }
}

export default db;
