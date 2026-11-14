-- ==============================================================================
-- DATABASE SCHEMA FOR SURVEY PORTAL (Cloudflare D1 Compatible)
-- Execute using: npx wrangler d1 execute <DATABASE_NAME> --file=./schema.sql
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


-- 3. QUESTIONS MANAGEMENT TABLE
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

-- Seed Default 24 Survey Questions
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


-- 4. PRISONER SURVEYS TABLE
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
  custom_answers TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
