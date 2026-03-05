import * as SQLite from 'expo-sqlite';
import { SCHEMA_V1 } from './schema';

const db = SQLite.openDatabaseSync('privatelift.db');

export interface QueryResult {
  rowsAffected: number;
  insertId: number;
}

export const initDatabase = async () => {
  try {
    db.execSync('PRAGMA foreign_keys = ON;');
    
    // Split SCHEMA_V1 into individual statements
    const statements = SCHEMA_V1.split(';').filter(s => s.trim() !== '');
    
    for (const statement of statements) {
      db.execSync(statement);
    }

    // Basic migration check for last_modified column (added in recent update)
    const exerciseInfo = db.getAllSync("PRAGMA table_info(Exercises);");
    const hasLastModified = exerciseInfo.some((col: any) => col.name === 'last_modified');
    if (!hasLastModified) {
      db.execSync('ALTER TABLE Exercises ADD COLUMN last_modified INTEGER NOT NULL DEFAULT 0;');
      db.execSync('ALTER TABLE Workouts ADD COLUMN last_modified INTEGER NOT NULL DEFAULT 0;');
      db.execSync('ALTER TABLE Routines ADD COLUMN last_modified INTEGER NOT NULL DEFAULT 0;');
    }

    // Migration check for User_Biometrics (measured_at and last_modified columns)
    const biometricsInfo = db.getAllSync("PRAGMA table_info(User_Biometrics);");
    const hasMeasuredAt = biometricsInfo.some((col: any) => col.name === 'measured_at');
    const hasBiometricsLastModified = biometricsInfo.some((col: any) => col.name === 'last_modified');
    
    if (!hasMeasuredAt) {
      try {
        db.execSync('ALTER TABLE User_Biometrics ADD COLUMN measured_at INTEGER NOT NULL DEFAULT 0;');
      } catch (e) {
        console.warn('Could not add measured_at to User_Biometrics', e);
      }
    }
    if (!hasBiometricsLastModified) {
      try {
        db.execSync('ALTER TABLE User_Biometrics ADD COLUMN last_modified INTEGER NOT NULL DEFAULT 0;');
      } catch (e) {
        console.warn('Could not add last_modified to User_Biometrics', e);
      }
    }
    
    // Ensure User_Settings exists
    const check = db.getAllSync('SELECT COUNT(*) as count FROM User_Settings;');
    if ((check[0] as any).count === 0) {
      db.runSync('INSERT INTO User_Settings (id, weight_unit, last_modified) VALUES (1, "KG", ?);', [Date.now()]);
    }

    console.log('Database initialized successfully');
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
