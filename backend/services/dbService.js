import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

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

  // Initialize logs table schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS food_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_input TEXT NOT NULL,
      gemini_response TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('[Database] SQLite table schema successfully verified/initialized.');
} catch (error) {
  console.error('[Database] Failed to initialize SQLite database:', error.message);
}

/**
 * Saves a food log transaction to the SQLite database.
 * @param {string} rawInput - User's query
 * @param {object} geminiResponse - Structured JSON response from Gemini
 */
export function saveFoodLog(rawInput, geminiResponse) {
  if (!db) {
    console.warn('[Database] Database is not initialized. Skipping log save.');
    return;
  }

  try {
    const insertStmt = db.prepare('INSERT INTO food_logs (raw_input, gemini_response) VALUES (?, ?)');
    insertStmt.run(rawInput, JSON.stringify(geminiResponse));
    console.log('[Database] Successfully saved transaction log to SQLite.');
  } catch (error) {
    console.error('[Database] Failed to write log transaction to SQLite:', error.message);
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
    const query = db.prepare('SELECT id, raw_input, gemini_response, created_at FROM food_logs ORDER BY created_at DESC');
    const rows = query.all();
    return rows.map(row => ({
      id: row.id,
      rawInput: row.raw_input,
      geminiResponse: JSON.parse(row.gemini_response),
      createdAt: row.created_at
    }));
  } catch (error) {
    console.error('[Database] Failed to query logs from SQLite:', error.message);
    return [];
  }
}
