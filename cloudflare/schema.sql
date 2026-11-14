-- Cloudflare D1 Database Schema for Sarve Project
-- Execute using: wrangler d1 execute <DATABASE_NAME> --file=./schema.sql

-- 1. Users Auth Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'Administrator',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Admin User
INSERT OR IGNORE INTO users (username, password, role) VALUES 
  ('sarve', 'New@1020', 'Administrator');

-- 2. Case Types Table
CREATE TABLE IF NOT EXISTS case_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Case Types
INSERT OR IGNORE INTO case_types (name) VALUES 
  ('Murder (IPC 302)'),
  ('Theft & Burglary (IPC 379/380)'),
  ('Robbery / Dacoity (IPC 392/395)'),
  ('Bail Application'),
  ('NDPS Act (Narcotics)'),
  ('Cheating & Fraud (IPC 420)'),
  ('Cyber Crime'),
  ('Assault / Attempt to Murder (IPC 307)'),
  ('Matrimonial / Dowry (IPC 498A)'),
  ('Arms Act'),
  ('Economic Offence'),
  ('Other');

-- 3. Prisoner Surveys Table
CREATE TABLE IF NOT EXISTS prisoner_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utct_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  case_type TEXT,
  total_cases INTEGER DEFAULT 0,
  case_duration TEXT,
  total_advocates_hired INTEGER DEFAULT 0,
  times_in_jail INTEGER DEFAULT 0,
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
