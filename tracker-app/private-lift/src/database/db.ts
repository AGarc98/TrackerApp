import { open } from 'react-native-quick-sqlite';
import { SCHEMA_V1 } from './schema';

const db = open({ name: 'privatelift.db' });
db.execute('PRAGMA foreign_keys = ON;');

export interface QueryResult {
  rowsAffected: number;
  insertId: number;
}

export const initDatabase = async () => {
  try {
    // 1. Temporarily disable foreign keys to allow dropping tables with relationships
    db.execute('PRAGMA foreign_keys = OFF;');

    // 2. Drop all existing tables for a "Hard Reset" (Development Mode)
    const tables = [
      'Exercises', 'Exercise_Muscle_Groups', 'Workouts', 'Workout_Exercises',
      'Routines', 'Routine_Workouts', 'Logged_Sessions', 'Logged_Sets',
      'User_Biometrics', 'Active_Session', 'User_Settings'
    ];

    for (const table of tables) {
      db.execute(`DROP TABLE IF EXISTS ${table};`);
    }

    // 3. Re-enable foreign keys
    db.execute('PRAGMA foreign_keys = ON;');

    // 4. Split SCHEMA_V1 into individual statements and execute
    const statements = SCHEMA_V1.split(';').filter(s => s.trim() !== '');
    for (const statement of statements) {
      db.execute(statement);
    }

    // 5. Initialize User Settings with default values
    db.execute(
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
    return db.execute(sql, params).rows._array as T[];
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
    const result = db.execute(sql, params);
    return {
      rowsAffected: result.rowsAffected,
      insertId: result.insertId ?? 0,
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
      if (
        key.startsWith('is_') ||
        key.startsWith('auto_start_') ||
        key.endsWith('_enabled') ||
        key.endsWith('_on') ||
        key.endsWith('_sound') ||
        key.endsWith('_vibrate') ||
        key.endsWith('_complete')
      ) {
        formatted[key] = !!formatted[key];
      }
    });
    return formatted as T;
  }

  static getAll<T>(sql: string, params: any[] = []): T[] {
    const results = select<any>(sql, this.prepareParams(params));
    return results.map(row => this.formatResult<T>(row));
  }

  static async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await db.executeAsync(sql, this.prepareParams(params));
      return (result.rows._array as any[]).map(row => this.formatResult<T>(row));
    } catch (error) {
      console.error('Async SELECT query failed:', sql, error);
      throw error;
    }
  }

  static getOne<T>(sql: string, params: any[] = []): T | null {
    const result = db.execute(sql, this.prepareParams(params)).rows._array[0];
    return result ? this.formatResult<T>(result) : null;
  }

  static run(sql: string, params: any[] = []): QueryResult {
    return execute(sql, this.prepareParams(params));
  }

  static transaction(callback: () => void) {
    db.execute('BEGIN;');
    try {
      callback();
      db.execute('COMMIT;');
    } catch (e) {
      db.execute('ROLLBACK;');
      throw e;
    }
  }
}

export default db;
