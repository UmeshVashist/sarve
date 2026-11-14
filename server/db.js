const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'sarve.db');
const db = new Database(dbPath);

// Enable WAL mode for high performance
db.pragma('journal_mode = WAL');

// Initialize tables (exact schema compatible with Cloudflare D1)
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'Administrator',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS case_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prisoner_surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      utct_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      case_type TEXT,
      total_cases INTEGER,
      case_duration TEXT,
      total_advocates_hired INTEGER,
      times_in_jail INTEGER,
      advocate_name_number TEXT,
      known_unknown_advocate TEXT,
      high_court_advocate TEXT,
      advocate_payment_advance TEXT,
      first_advocate_by_io TEXT,
      know_case_process TEXT,
      lawyer_collects_details_evidence TEXT,
      know_fees_reasonable TEXT,
      complete_fees_total_initially TEXT,
      work_transparency_tracking TEXT,
      know_legal_step_correct TEXT,
      case_prolonged_expensive TEXT,
      pairvi_knowledge_reason TEXT,
      court_docs_fees_timing TEXT,
      know_trustworthy_platform TEXT,
      priority_money_vs_release TEXT,
      prisoner_psychologic_survey TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default case types if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM case_types').get().count;
  if (count === 0) {
    const defaultTypes = [
      'Murder (IPC 302)',
      'Theft & Burglary (IPC 379/380)',
      'Robbery / Dacoity (IPC 392/395)',
      'Bail Application',
      'NDPS Act (Narcotics)',
      'Cheating & Fraud (IPC 420)',
      'Cyber Crime',
      'Assault / Attempt to Murder (IPC 307)',
      'Matrimonial / Dowry (IPC 498A)',
      'Arms Act',
      'Economic Offence',
      'Other'
    ];
    const insert = db.prepare('INSERT OR IGNORE INTO case_types (name) VALUES (?)');
    const insertMany = db.transaction((types) => {
      for (const t of types) insert.run(t);
    });
    insertMany(defaultTypes);
    console.log('Seeded default case types successfully.');
  }

  // Seed default admin user if not exists
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    db.prepare('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)').run('sarve', 'New@1020', 'Administrator');
    console.log('Seeded default admin user in users table.');
  }

  // Clear any sample / dummy surveys so database starts completely clean
  // db.exec('DELETE FROM prisoner_surveys');
}

initDB();

module.exports = db;

