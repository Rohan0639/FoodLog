import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

const dbPath = path.join(__dirname, '..', 'foodlog.db');

try {
  console.log(`[Database] Initializing SQLite database at: ${dbPath}`);
  db = new Database(dbPath);

  // Check schema version — detect old column layout
  let needsRecreate = false;
  try {
    const tableInfo = db.prepare("PRAGMA table_info(food_logs)").all();
    if (tableInfo.length > 0) {
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

  // Create food_entries table conforming to updated schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS food_entries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fats REAL NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrate existing data from food_logs to food_entries if food_entries is empty
  try {
    const entriesCount = db.prepare("SELECT COUNT(*) as count FROM food_entries").get().count;
    if (entriesCount === 0) {
      const logTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='food_logs'").get();
      if (logTableExists) {
        const logs = db.prepare("SELECT _id, parsedData, createdAt FROM food_logs").all();
        if (logs.length > 0) {
          console.log(`[Database Migration] Migrating ${logs.length} entries from food_logs to food_entries...`);
          
          const insertStmt = db.prepare(`
            INSERT INTO food_entries (id, name, quantity, unit, calories, protein, carbs, fats, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          let migratedCount = 0;
          
          // Helper to parse quantity and unit inside migration
          const parseQuantityAndUnit = (quantityStr) => {
            if (typeof quantityStr === 'number') {
              return { quantity: quantityStr, unit: 'piece' };
            }
            const str = String(quantityStr || '').trim();
            const match = str.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
            if (match) {
              return {
                quantity: parseFloat(match[1]),
                unit: match[2] ? match[2].trim() : 'piece'
              };
            }
            return {
              quantity: parseFloat(str) || 1,
              unit: str || 'piece'
            };
          };

          db.transaction(() => {
            for (const log of logs) {
              try {
                const parsed = JSON.parse(log.parsedData);
                const items = parsed.items || [];
                for (let i = 0; i < items.length; i++) {
                  const item = items[i];
                  const { quantity, unit } = parseQuantityAndUnit(item.quantity);
                  const entryId = crypto.randomUUID();
                  insertStmt.run(
                    entryId,
                    item.name || 'Unknown',
                    quantity,
                    unit,
                    item.calories || 0,
                    item.protein || 0,
                    item.carbs || 0,
                    item.fat || 0, // Old schema stored fat as "fat"
                    log.createdAt
                  );
                  migratedCount++;
                }
              } catch (err) {
                console.error(`[Database Migration] Failed to migrate log ${log._id}:`, err.message);
              }
            }
          })();
          console.log(`[Database Migration] Migration complete! Migrating ${migratedCount} food items.`);
        }
      }
    }
  } catch (migrationErr) {
    console.error('[Database Migration] Error during data migration:', migrationErr.message);
  }

  console.log('[Database] SQLite table schemas successfully verified/initialized.');
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

/**
 * Saves a single food entry to SQLite.
 * @param {object} entry - The entry fields (name, quantity, unit, calories, protein, carbs, fats, createdAt)
 * @returns {object} The saved entry
 */
export function saveFoodEntry(entry) {
  if (!db) {
    console.warn('[Database] Database is not initialized. Skipping save.');
    return null;
  }

  try {
    const id = entry.id || crypto.randomUUID();
    const createdAt = entry.createdAt || new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT INTO food_entries (id, name, quantity, unit, calories, protein, carbs, fats, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(
      id,
      entry.name,
      entry.quantity,
      entry.unit,
      entry.calories,
      entry.protein,
      entry.carbs,
      entry.fats,
      createdAt
    );
    console.log(`[Database] Saved food entry: ${id} (${entry.name})`);
    return {
      id,
      name: entry.name,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fats: entry.fats,
      createdAt
    };
  } catch (error) {
    console.error('[Database] Failed to write food entry to SQLite:', error.message);
    throw error;
  }
}

/**
 * Retrieves all food entries from the database.
 * @returns {Array<object>} All food entries
 */
export function getFoodEntries() {
  if (!db) {
    console.warn('[Database] Database is not initialized. Returning empty entries.');
    return [];
  }

  try {
    const query = db.prepare(`
      SELECT id, name, quantity, unit, calories, protein, carbs, fats, createdAt
      FROM food_entries
      ORDER BY createdAt DESC
    `);
    return query.all();
  } catch (error) {
    console.error('[Database] Failed to query food entries from SQLite:', error.message);
    return [];
  }
}

/**
 * Updates an existing food entry.
 * @param {string} id - Entry ID
 * @param {object} updatedData - Fields to update
 * @returns {object} Updated entry
 */
export function updateFoodEntry(id, updatedData) {
  if (!db) {
    console.warn('[Database] Database is not initialized. Skipping update.');
    return null;
  }

  try {
    const checkQuery = db.prepare('SELECT id, createdAt FROM food_entries WHERE id = ?');
    const record = checkQuery.get(id);
    if (!record) {
      throw new Error(`Food entry with ID ${id} not found.`);
    }

    const updateStmt = db.prepare(`
      UPDATE food_entries
      SET name = ?, quantity = ?, unit = ?, calories = ?, protein = ?, carbs = ?, fats = ?
      WHERE id = ?
    `);
    updateStmt.run(
      updatedData.name,
      updatedData.quantity,
      updatedData.unit,
      updatedData.calories,
      updatedData.protein,
      updatedData.carbs,
      updatedData.fats,
      id
    );
    console.log(`[Database] Successfully updated food entry: ${id}`);
    return {
      id,
      name: updatedData.name,
      quantity: updatedData.quantity,
      unit: updatedData.unit,
      calories: updatedData.calories,
      protein: updatedData.protein,
      carbs: updatedData.carbs,
      fats: updatedData.fats,
      createdAt: record.createdAt
    };
  } catch (error) {
    console.error(`[Database] Failed to update food entry ${id}:`, error.message);
    throw error;
  }
}

/**
 * Deletes a single food entry.
 * @param {string} id - Entry ID
 * @returns {boolean} True if successfully deleted, false otherwise
 */
export function deleteFoodEntry(id) {
  if (!db) {
    console.warn('[Database] Database is not initialized. Skipping delete.');
    return false;
  }

  try {
    const deleteStmt = db.prepare('DELETE FROM food_entries WHERE id = ?');
    const result = deleteStmt.run(id);
    const success = result.changes > 0;
    if (success) {
      console.log(`[Database] Successfully deleted food entry: ${id}`);
    }
    return success;
  } catch (error) {
    console.error(`[Database] Failed to delete food entry ${id}:`, error.message);
    throw error;
  }
}

/**
 * Deletes all food entries.
 * @returns {boolean} True if successful
 */
export function clearAllFoodEntries() {
  if (!db) {
    console.warn('[Database] Database is not initialized. Skipping clear.');
    return false;
  }

  try {
    db.prepare('DELETE FROM food_entries').run();
    console.log('[Database] Successfully cleared all food entries.');
    return true;
  } catch (error) {
    console.error('[Database] Failed to clear food entries:', error.message);
    throw error;
  }
}
