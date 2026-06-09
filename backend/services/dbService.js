import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

// Resolve database path (uses /tmp on Vercel to bypass read-only filesystem limitations)
const dbPath = process.env.VERCEL
  ? '/tmp/foodlog.db'
  : path.join(__dirname, '..', 'foodlog.db');

try {
  console.log(`[Database] Initializing SQLite database at: ${dbPath}`);
  db = new DatabaseSync(dbPath);

  // Check schema version or perform migrations
  let needsRecreate = false;
  try {
    const tableInfo = db.prepare("PRAGMA table_info(food_logs)").all();
    if (tableInfo.length > 0) {
      // Check if old columns exist
      const hasId = tableInfo.some(col => col.name === '_id');
      const hasRawInput = tableInfo.some(col => col.name === 'raw_input');
      if (!hasId || hasRawInput) {
        console.log('[Database] Old schema detected. Re-initializing table...');
        needsRecreate = true;
      }
    }
  } catch (err) {
    console.error('[Database] Error checking table info:', err.message);
  }

  if (needsRecreate) {
    db.exec(`DROP TABLE IF EXISTS food_logs`);
  }

  // Initialize logs table schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS food_logs (
      _id TEXT PRIMARY KEY,
      userId TEXT,
      foodText TEXT NOT NULL,
      parsedData TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('[Database] SQLite table schema successfully verified/initialized.');
} catch (error) {
  console.error('[Database] Failed to initialize SQLite database:', error.message);
}

/**
 * Saves a food log transaction to the SQLite database.
 * @param {string} foodText - User's query
 * @param {object} parsedData - Structured JSON response from Gemini
 * @param {string} [userId='default-user'] - User's identifier
 * @returns {object} The saved food log database object
 */
export function saveFoodLog(foodText, parsedData, userId = 'default-user') {
  if (!db) {
    console.warn('[Database] Database is not initialized. Skipping log save.');
    return null;
  }

  try {
    const _id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;
    const insertStmt = db.prepare(`
      INSERT INTO food_logs (_id, userId, foodText, parsedData, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(_id, userId, foodText, JSON.stringify(parsedData), createdAt, updatedAt);
    console.log('[Database] Successfully saved transaction log to SQLite.');
    return {
      _id,
      userId,
      foodText,
      parsedData,
      createdAt,
      updatedAt
    };
  } catch (error) {
    console.error('[Database] Failed to write log transaction to SQLite:', error.message);
    throw error;
  }
}

/**
 * Fetches all transaction logs from the SQLite database.
 * @returns {Array<object>} Saved logs
 */
export function getFoodLogs() {
  if (!db) {
    console.warn('[Database] Database is not initialized. Returning empty logs.');
    return [];
  }

  try {
    const query = db.prepare('SELECT _id, userId, foodText, parsedData, createdAt, updatedAt FROM food_logs ORDER BY createdAt DESC');
    const rows = query.all();
    return rows.map(row => ({
      _id: row._id,
      userId: row.userId,
      foodText: row.foodText,
      parsedData: JSON.parse(row.parsedData),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  } catch (error) {
    console.error('[Database] Failed to query logs from SQLite:', error.message);
    return [];
  }
}

/**
 * Updates an existing food log in the database.
 * @param {string} id - Database _id
 * @param {string} foodText - The updated food text
 * @param {object} parsedData - The updated parsed nutritional data from Gemini
 * @returns {object} The updated food log database object
 */
export function updateFoodLog(id, foodText, parsedData) {
  if (!db) {
    console.warn('[Database] Database is not initialized. Skipping update.');
    return null;
  }

  try {
    const updatedAt = new Date().toISOString();
    
    // Check if record exists
    const checkQuery = db.prepare('SELECT _id, userId, createdAt FROM food_logs WHERE _id = ?');
    const record = checkQuery.get(id);
    if (!record) {
      throw new Error(`Food log with ID ${id} not found.`);
    }

    const updateStmt = db.prepare(`
      UPDATE food_logs
      SET foodText = ?, parsedData = ?, updatedAt = ?
      WHERE _id = ?
    `);
    updateStmt.run(foodText, JSON.stringify(parsedData), updatedAt, id);
    console.log(`[Database] Successfully updated food log: ${id}`);
    
    return {
      _id: id,
      userId: record.userId,
      foodText,
      parsedData,
      createdAt: record.createdAt,
      updatedAt
    };
  } catch (error) {
    console.error(`[Database] Failed to update food log ${id}:`, error.message);
    throw error;
  }
}

/**
 * Deletes a food log from the SQLite database.
 * @param {string} id - Database _id
 * @returns {boolean} True if successfully deleted, false otherwise
 */
export function deleteFoodLog(id) {
  if (!db) {
    console.warn('[Database] Database is not initialized. Skipping delete.');
    return false;
  }

  try {
    const deleteStmt = db.prepare('DELETE FROM food_logs WHERE _id = ?');
    const result = deleteStmt.run(id);
    const success = result.changes > 0;
    if (success) {
      console.log(`[Database] Successfully deleted food log: ${id}`);
    } else {
      console.warn(`[Database] No food log found to delete with ID: ${id}`);
    }
    return success;
  } catch (error) {
    console.error(`[Database] Failed to delete food log ${id}:`, error.message);
    throw error;
  }
}

