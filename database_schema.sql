-- ==============================================================================
-- COMPLETE DATABASE SCHEMA FOR SURVEY PORTAL (Cloudflare D1 & SQLite)
-- Run this in Cloudflare Dashboard -> Workers & D1 -> D1 -> sarve_d1_database -> Console
-- ==============================================================================

-- 1. USERS TABLE (Authentication)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'Administrator',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Admin User ('meet' / 'New@1020')
INSERT OR IGNORE INTO users (username, password, role) VALUES 
  ('meet', 'New@1020', 'Administrator');

UPDATE users SET username = 'meet' WHERE LOWER(username) = 'sarve';


-- 2. CASE TYPES TABLE (Dropdown options for Prisoner Question 3)
CREATE TABLE IF NOT EXISTS case_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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


-- 3. COURT TYPES TABLE (For Advocate Court Type Selection)
CREATE TABLE IF NOT EXISTS court_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO court_types (name) VALUES 
  ('District Court'),
  ('Sessions Court'),
  ('High Court'),
  ('Supreme Court'),
  ('Special / NDPS Court'),
  ('Magistrate Court (CMM / ACMM)'),
  ('Other');


-- 4. ADVOCATE TYPES TABLE (For Advocate Types Selection)
CREATE TABLE IF NOT EXISTS advocate_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO advocate_types (name) VALUES 
  ('Private Advocate'),
  ('Legal Aid / DLSA Advocate'),
  ('Panel Advocate'),
  ('Senior Advocate'),
  ('Amicus Curiae'),
  ('Government Pleader / Public Prosecutor'),
  ('Remand Advocate'),
  ('Jail Visiting Advocate'),
  ('Other');


-- 5. PRISONER SURVEY QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_num INTEGER NOT NULL,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  placeholder TEXT,
  type TEXT DEFAULT 'text',
  options TEXT,
  required INTEGER DEFAULT 0,
  note TEXT,
  has_remark INTEGER DEFAULT 0,
  is_custom INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- 6. PRISONER SURVEYS TABLE
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
  advocates_details TEXT DEFAULT '[]',
  custom_answers TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- 7. ADVOCATE QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS advocate_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_num INTEGER NOT NULL,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  placeholder TEXT,
  type TEXT DEFAULT 'text',
  options TEXT,
  required INTEGER DEFAULT 0,
  note TEXT,
  has_remark INTEGER DEFAULT 0,
  is_custom INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- 8. ADVOCATE SURVEYS TABLE
CREATE TABLE IF NOT EXISTS advocate_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  advocate_reg_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact_number TEXT,
  office_address TEXT,
  primary_court TEXT,
  practice_experience_years INTEGER DEFAULT 0,
  case_specialization TEXT,
  regularly_handles_undertrial_cases TEXT,
  provides_legal_aid_dlsa TEXT,
  transparent_fee_structure TEXT,
  average_case_duration TEXT,
  parivi_assistance_knowledge TEXT,
  remarks TEXT,
  custom_answers TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- 9. PERFORMANCE INDEXES (Prevents lags and speeds up queries)
CREATE INDEX IF NOT EXISTS idx_prisoner_utct ON prisoner_surveys(utct_no);
CREATE INDEX IF NOT EXISTS idx_prisoner_name ON prisoner_surveys(name);
CREATE INDEX IF NOT EXISTS idx_advocate_reg ON advocate_surveys(advocate_reg_no);
CREATE INDEX IF NOT EXISTS idx_advocate_name ON advocate_surveys(name);
CREATE INDEX IF NOT EXISTS idx_questions_order ON questions(order_num);
CREATE INDEX IF NOT EXISTS idx_adv_questions_order ON advocate_questions(order_num);


-- 10. WEB REVIEW MODULE TABLES
CREATE TABLE IF NOT EXISTS web_review_urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS web_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_id INTEGER,
  website_name TEXT NOT NULL,
  url TEXT NOT NULL,
  reviews TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_web_review_name ON web_reviews(website_name);


-- 11. RAASTA FUNCTION MODULE TABLES
CREATE TABLE IF NOT EXISTS raasta_portals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS raasta_functions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portal_name TEXT NOT NULL,
  function_name TEXT NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_raasta_portal ON raasta_functions(portal_name);


-- 12. WORK ROLE MODULE TABLES
CREATE TABLE IF NOT EXISTS work_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_role_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_name TEXT NOT NULL,
  work_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_role_name ON work_role_entries(role_name);


-- 13. NEW PRISONER SURVEYS TABLE (New Prisoner Module)
CREATE TABLE IF NOT EXISTS new_prisoner_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  utct_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  case_type TEXT,
  total_cases INTEGER DEFAULT 0,
  case_duration TEXT,
  total_advocates_hired INTEGER DEFAULT 0,
  times_in_jail INTEGER DEFAULT 0,
  advocate_name_number TEXT,
  advocates_details TEXT DEFAULT '[]',
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
  custom_answers TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_new_prisoner_utct ON new_prisoner_surveys(utct_no);
CREATE INDEX IF NOT EXISTS idx_new_prisoner_name ON new_prisoner_surveys(name);


-- 14. NEW PRISONER QUESTIONS TABLE (Independent questions for New Prisoner module)
CREATE TABLE IF NOT EXISTS new_prisoner_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_num INTEGER NOT NULL,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  placeholder TEXT,
  type TEXT DEFAULT 'text',
  options TEXT,
  required INTEGER DEFAULT 0,
  note TEXT,
  has_remark INTEGER DEFAULT 0,
  is_custom INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_new_questions_order ON new_prisoner_questions(order_num);

INSERT OR IGNORE INTO new_prisoner_questions (order_num, key, label, placeholder, type, options, required, note, has_remark, is_custom)
SELECT order_num, key, label, placeholder, type, options, required, note, has_remark, is_custom FROM questions;



