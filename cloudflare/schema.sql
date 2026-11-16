-- ==============================================================================
-- COMPLETE DATABASE SCHEMA FOR SURVEY PORTAL (Cloudflare D1 & SQLite Compatible)
-- Execute in Cloudflare D1 Console or using:
-- npx wrangler d1 execute sarve_d1_database --file=./cloudflare/schema.sql
-- ==============================================================================

-- 1. USERS TABLE
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


-- 2. CASE TYPES TABLE
CREATE TABLE IF NOT EXISTS case_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Legal Case Types
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

-- Seed Default Court Types
INSERT OR IGNORE INTO court_types (name) VALUES 
  ('District Court'),
  ('Sessions Court'),
  ('High Court'),
  ('Supreme Court'),
  ('Special / NDPS Court'),
  ('Magistrate Court (CMM / ACMM)'),
  ('Other');


-- 4. PRISONER SURVEY QUESTIONS TABLE
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
  is_custom INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default 24 Prisoner Survey Questions
INSERT OR IGNORE INTO questions (order_num, key, label, placeholder, type, options, required, note, is_custom) VALUES
  (1, 'utct_no', '1) UT/CT No.', 'e.g. UT/2026/104 or CT/2026/89', 'text', NULL, 1, 'Note:- Unique ID. System will verify against database before proceeding.', 0),
  (2, 'name', '2) Name', 'Enter prisoner full name', 'text', NULL, 1, 'Note:- Please enter prisoner full name.', 0),
  (3, 'case_type', '3) Case type / how you type of advocate to hire', 'Select one or more case types', 'multi-select', NULL, 1, 'Note:- You can select multiple case types from the dropdown managed on the home page.', 0),
  (4, 'total_cases', '4) Total number of cases', 'e.g. 1, 2, 3', 'number', NULL, 1, 'Note:- Input only Numbers', 0),
  (5, 'case_duration', '5) How long these cases are running', 'e.g. 6 Months, 2 Years, 1 Year 4 Months', 'text', NULL, 1, 'Note:- Specify duration (months / years).', 0),
  (6, 'total_advocates_hired', '6) Total advocate hired till date', 'e.g. 0, 1, 2', 'number', NULL, 1, 'Note:- Input only Numbers', 0),
  (7, 'times_in_jail', '7) How many time come to jail', 'e.g. 1, 2, 3', 'number', NULL, 1, 'Note:- Input only Numbers', 0),
  (8, 'advocate_name_number', '8) Advocate name and number', 'e.g. Adv. R.K. Gupta (+91 9876543210)', 'text', NULL, 0, 'Note:- Enter current or previous advocate name and phone number.', 0),
  (9, 'known_unknown_advocate', '9) Known / unknown Advocate', 'Known or Unknown', 'yesno_or_choice', '["Known","Unknown","Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (10, 'high_court_advocate', '10) High court advocate', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (11, 'advocate_payment_advance', '11) Advocate payment advance', 'Type ''Yes'' or ''No''', 'yesno_advance', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (12, 'first_advocate_by_io', '12) First Advocate hired by IO', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (13, 'know_case_process', '13) Do you know process, when case started, first and next step', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (14, 'lawyer_collects_details_evidence', '14) Does your lawyer ask, all details about your case, and collect evidence', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (15, 'know_fees_reasonable', '15) How do you know, lawyer jo fees le raha hai, vo sahi hai', 'Yes or No / Details', 'yesno_text', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (16, 'complete_fees_total_initially', '16) Does it give, complete fees total, initially', 'Type ''Yes'' or ''No''', 'yesno_advance', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No (If Yes, specify complete fees amount)', 0),
  (17, 'work_transparency_tracking', '17) Work transparency and tracking of lawyer work', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (18, 'know_legal_step_correct', '18) Kya apko pata hai, jo legal step lawyer process kar raha hai, vo sab sahi hai, kuch miss toh nahi kar raha', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (19, 'case_prolonged_expensive', '19) Because of some extra unwanted step, kya lawyer ki wajah se, case lamba chala aur expensive ho gaya', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (20, 'pairvi_knowledge_reason', '20) Parivi karwane ko knowledge hai ya nahi, aur kyun parivi karta hai', 'Yes or No / Details', 'yesno_text', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (21, 'court_docs_fees_timing', '21) Court ke doc kyun nikalte hai, and uski fees pata hai, aur kya vo aapko time pe miljate hai', 'Yes or No / Details', 'yesno_text', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (22, 'know_trustworthy_platform', '22) Do you know any platform, jo aapko pairvi karne wala de, and jo guarantee de ki, jo adv provide karega, jo trustworthy hoga', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0),
  (23, 'priority_money_vs_release', '23) Your priority, ki paise bachana hai ya jail se bahar jaldi jana hai', 'Select priority', 'choice_text', '["Jail se bahar jaldi jana","Paise bachana"]', 0, 'Note:- Please select only one of the 2 options: Jail se bahar jaldi jana OR Paise bachana', 0),
  (24, 'prisoner_psychologic_survey', '24) Prisoner psychologic according Survey', 'Select Yes or No, and add remarks (optional)...', 'psychologic_yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No (Remarks optional)', 0);


-- 5. PRISONER SURVEYS TABLE
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


-- 6. ADVOCATE QUESTIONS TABLE
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
  is_custom INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default 12 Advocate Questions
INSERT OR IGNORE INTO advocate_questions (order_num, key, label, placeholder, type, options, required, note, is_custom) VALUES
  (1, 'advocate_reg_no', '1) Bar Council / Enrollment No.', 'e.g. D/1234/2015', 'text', NULL, 1, 'Note:- Unique advocate enrollment / bar registration number.', 0),
  (2, 'name', '2) Advocate Full Name', 'e.g. Adv. Rajesh Sharma', 'text', NULL, 1, 'Note:- Enter full name of the advocate.', 0),
  (3, 'contact_number', '3) Contact / WhatsApp Number', 'e.g. +91 9876543210', 'text', NULL, 1, 'Note:- 10-digit mobile number.', 0),
  (4, 'primary_court', '4) Primary Court of Practice', 'Select primary court', 'choice_text', '["District Court","Sessions Court","High Court","Supreme Court","Magistrate Court (CMM / ACMM)","Special / NDPS Court","Other"]', 1, 'Note:- Main court where advocate practices regularly.', 0),
  (5, 'practice_experience_years', '5) Years of Legal Practice', 'e.g. 5, 10, 15', 'number', NULL, 1, 'Note:- Input numeric years of experience.', 0),
  (6, 'case_specialization', '6) Legal Specialization', 'Select legal specialization', 'multi-select', '["Criminal Defense","Bail Applications","NDPS Act (Narcotics)","POCSO & Women Safety","Cheating & Fraud (IPC 420)","Murder / Attempt (IPC 302/307)","Cyber Crime","Civil & Property","Constitutional / High Court Writs","Other"]', 1, 'Note:- Select one or more legal fields.', 0),
  (7, 'regularly_handles_undertrial_cases', '7) Regularly handles Jail / Undertrial Prisoner Cases?', 'Yes or No', 'yesno', '["Yes","No"]', 1, 'Note:- Pls select Yes or No.', 0),
  (8, 'provides_legal_aid_dlsa', '8) Empanelled with DLSA / Legal Aid?', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No.', 0),
  (9, 'transparent_fee_structure', '9) Provides transparent upfront fee agreement to clients?', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No.', 0),
  (10, 'average_case_duration', '10) Average duration to secure Bail / Trial relief', 'e.g. 1 Month, 3 Months, 6 Months', 'text', NULL, 0, 'Note:- Approximate timeline.', 0),
  (11, 'parivi_assistance_knowledge', '11) Knowledge of Prison Parivi & Document tracking process?', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No.', 0),
  (12, 'remarks', '12) Remarks / Suggestions for Jail Legal System', 'Enter observations, suggestions, feedback...', 'textarea', NULL, 0, 'Note:- General observations.', 0);


-- 7. ADVOCATE SURVEYS TABLE
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
