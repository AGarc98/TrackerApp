import * as SQLite from 'expo-sqlite';
import { SCHEMA_V1 } from './schema';

const db = SQLite.openDatabaseSync('privatelift.db');

export const initDatabase = async () => {
  try {
    // Enable foreign keys
    db.execSync('PRAGMA foreign_keys = ON;');
    
    // Split SCHEMA_V1 into individual statements to execute them one by one
    const statements = SCHEMA_V1.split(';').filter(s => s.trim() !== '');
    
    for (const statement of statements) {
      db.execSync(statement);
    }
    
    console.log('Database initialized successfully with expo-sqlite');
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
    console.error(`Query failed: \${sql}`, error);
    throw error;
  }
};

export const executeBatch = (statements: { sql: string; params: any[] }[]) => {
  // Use a transaction for batch
  db.withTransactionSync(() => {
    for (const s of statements) {
      db.runSync(s.sql, s.params);
    }
  });
};

export default db;
