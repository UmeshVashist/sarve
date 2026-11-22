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
      custom_answers TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS court_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS advocate_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS advocate_surveys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      advocate_reg_no TEXT UNIQUE,
      name TEXT NOT NULL,
      contact_number TEXT,
      office_address TEXT,
      primary_court TEXT,
      practice_experience_years INTEGER,
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
  `);

  // Ensure custom_answers & advocates_details columns exist in prisoner_surveys
  try {
    const tableInfo = db.prepare("PRAGMA table_info(prisoner_surveys)").all();
    const hasCustomAnswers = tableInfo.some((col) => col.name === 'custom_answers');
    if (!hasCustomAnswers) {
      db.exec("ALTER TABLE prisoner_surveys ADD COLUMN custom_answers TEXT DEFAULT '{}'");
    }
    const hasAdvocatesDetails = tableInfo.some((col) => col.name === 'advocates_details');
    if (!hasAdvocatesDetails) {
      db.exec("ALTER TABLE prisoner_surveys ADD COLUMN advocates_details TEXT DEFAULT '[]'");
    }
  } catch (err) {
    console.error('Migration notice for prisoner_surveys columns:', err.message);
  }

  // Seed default court types if empty
  try {
    const courtCount = db.prepare('SELECT COUNT(*) as count FROM court_types').get().count;
    if (courtCount === 0) {
      const defaultCourts = [
        'District Court',
        'Sessions Court',
        'High Court',
        'Supreme Court',
        'Magistrate Court (CMM / ACMM)',
        'Special / NDPS Court',
        'Family Court',
        'Other'
      ];
      const insertCourt = db.prepare('INSERT OR IGNORE INTO court_types (name) VALUES (?)');
      const insertManyCourts = db.transaction((types) => {
        for (const t of types) insertCourt.run(t);
      });
      insertManyCourts(defaultCourts);
      console.log('Seeded default court types successfully.');
    }
  } catch (err) {
    console.error('Error seeding court types:', err.message);
  }

  // Seed default advocate types if empty
  try {
    const advTypeCount = db.prepare('SELECT COUNT(*) as count FROM advocate_types').get().count;
    if (advTypeCount === 0) {
      const defaultAdvTypes = [
        'Private Advocate',
        'DLSA / Legal Aid Advocate',
        'High Court Legal Services Committee (HCLSC) Advocate',
        'Remand Advocate',
        'Amicus Curiae',
        'Senior Advocate',
        'Government Pleader / Public Prosecutor',
        'Panel Advocate',
        'Other'
      ];
      const insertAdvType = db.prepare('INSERT OR IGNORE INTO advocate_types (name) VALUES (?)');
      const insertManyAdvTypes = db.transaction((types) => {
        for (const t of types) insertAdvType.run(t);
      });
      insertManyAdvTypes(defaultAdvTypes);
      console.log('Seeded default advocate types successfully.');
    }
  } catch (err) {
    console.error('Error seeding advocate types:', err.message);
  }

  // Ensure has_remark column in questions & advocate_questions
  try {
    const qInfo = db.prepare("PRAGMA table_info(questions)").all();
    if (!qInfo.some((c) => c.name === 'has_remark')) {
      db.exec("ALTER TABLE questions ADD COLUMN has_remark INTEGER DEFAULT 0");
    }
    const advQInfo = db.prepare("PRAGMA table_info(advocate_questions)").all();
    if (!advQInfo.some((c) => c.name === 'has_remark')) {
      db.exec("ALTER TABLE advocate_questions ADD COLUMN has_remark INTEGER DEFAULT 0");
    }
  } catch (err) {
    console.error('Error checking has_remark columns:', err.message);
  }

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

  // Seed / migrate user to 'meet'
  db.prepare("DELETE FROM users WHERE LOWER(TRIM(username)) = 'sarve'").run();
  db.prepare("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)").run('meet', 'New@1020', 'Administrator');

  // Seed default 24 questions if questions table is empty
  const qCount = db.prepare('SELECT COUNT(*) as count FROM questions').get().count;
  if (qCount === 0) {
    const defaultQuestions = [
      {
        order_num: 1,
        key: 'utct_no',
        label: '1) UT/CT No.',
        placeholder: 'e.g. UT/2026/104 or CT/2026/89',
        type: 'text',
        required: 1,
        options: null,
        note: 'Note:- Unique ID. System will verify against database before proceeding.',
        is_custom: 0
      },
      {
        order_num: 2,
        key: 'name',
        label: '2) Name',
        placeholder: 'Enter prisoner full name',
        type: 'text',
        required: 1,
        options: null,
        note: 'Note:- Please enter prisoner full name.',
        is_custom: 0
      },
      {
        order_num: 3,
        key: 'case_type',
        label: '3) Case type / how you type of advocate to hire',
        placeholder: 'Select one or more case types',
        type: 'multi-select',
        required: 1,
        options: null,
        note: 'Note:- You can select multiple case types from the dropdown managed on the home page.',
        is_custom: 0
      },
      {
        order_num: 4,
        key: 'total_cases',
        label: '4) Total number of cases',
        placeholder: 'e.g. 1, 2, 3',
        type: 'number',
        required: 1,
        options: null,
        note: 'Note:- Input only Numbers',
        is_custom: 0
      },
      {
        order_num: 5,
        key: 'case_duration',
        label: '5) How long these cases are running',
        placeholder: 'e.g. 6 Months, 2 Years, 1 Year 4 Months',
        type: 'text',
        required: 1,
        options: null,
        note: 'Note:- Specify duration (months / years).',
        is_custom: 0
      },
      {
        order_num: 6,
        key: 'total_advocates_hired',
        label: '6) Total advocate hired till date',
        placeholder: 'e.g. 0, 1, 2',
        type: 'number',
        required: 1,
        options: null,
        note: 'Note:- Input only Numbers',
        is_custom: 0
      },
      {
        order_num: 7,
        key: 'times_in_jail',
        label: '7) How many time come to jail',
        placeholder: 'e.g. 1, 2, 3',
        type: 'number',
        required: 1,
        options: null,
        note: 'Note:- Input only Numbers',
        is_custom: 0
      },
      {
        order_num: 8,
        key: 'advocate_name_number',
        label: '8) Advocate name and number',
        placeholder: 'e.g. Adv. R.K. Gupta (+91 9876543210)',
        type: 'text',
        required: 0,
        options: null,
        note: 'Note:- Enter current or previous advocate name and phone number.',
        is_custom: 0
      },
      {
        order_num: 9,
        key: 'known_unknown_advocate',
        label: '9) Known / unknown Advocate',
        placeholder: 'Known or Unknown',
        type: 'yesno_or_choice',
        required: 0,
        options: JSON.stringify(['Known', 'Unknown', 'Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 10,
        key: 'high_court_advocate',
        label: '10) High court advocate',
        placeholder: 'Yes or No',
        type: 'yesno',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 11,
        key: 'advocate_payment_advance',
        label: '11) Advocate payment advance',
        placeholder: "Type 'Yes' or 'No'",
        type: 'yesno_advance',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 12,
        key: 'first_advocate_by_io',
        label: '12) First Advocate hired by IO',
        placeholder: 'Yes or No',
        type: 'yesno',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 13,
        key: 'know_case_process',
        label: '13) Do you know process, when case started, first and next step',
        placeholder: 'Yes or No',
        type: 'yesno',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 14,
        key: 'lawyer_collects_details_evidence',
        label: '14) Does your lawyer ask, all details about your case, and collect evidence',
        placeholder: 'Yes or No',
        type: 'yesno',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 15,
        key: 'know_fees_reasonable',
        label: '15) How do you know, lawyer jo fees le raha hai, vo sahi hai',
        placeholder: 'Yes or No / Details',
        type: 'yesno_text',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 16,
        key: 'complete_fees_total_initially',
        label: '16) Does it give, complete fees total, initially',
        placeholder: "Type 'Yes' or 'No'",
        type: 'yesno_advance',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No (If Yes, specify complete fees amount)',
        is_custom: 0
      },
      {
        order_num: 17,
        key: 'work_transparency_tracking',
        label: '17) Work transparency and tracking of lawyer work',
        placeholder: 'Yes or No',
        type: 'yesno',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 18,
        key: 'know_legal_step_correct',
        label: '18) Kya apko pata hai, jo legal step lawyer process kar raha hai, vo sab sahi hai, kuch miss toh nahi kar raha',
        placeholder: 'Yes or No',
        type: 'yesno',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 19,
        key: 'case_prolonged_expensive',
        label: '19) Because of some extra unwanted step, kya lawyer ki wajah se, case lamba chala aur expensive ho gaya',
        placeholder: 'Yes or No',
        type: 'yesno',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 20,
        key: 'pairvi_knowledge_reason',
        label: '20) Parivi karwane ko knowledge hai ya nahi, aur kyun parivi karta hai',
        placeholder: 'Yes or No / Details',
        type: 'yesno_text',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 21,
        key: 'court_docs_fees_timing',
        label: '21) Court ke doc kyun nikalte hai, and uski fees pata hai, aur kya vo aapko time pe miljate hai',
        placeholder: 'Yes or No / Details',
        type: 'yesno_text',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 22,
        key: 'know_trustworthy_platform',
        label: '22) Do you know any platform, jo aapko pairvi karne wala de, and jo guarantee de ki, jo adv provide karega, jo trustworthy hoga',
        placeholder: 'Yes or No',
        type: 'yesno',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls enter Only Yes or No',
        is_custom: 0
      },
      {
        order_num: 23,
        key: 'priority_money_vs_release',
        label: '23) Your priority, ki paise bachana hai ya jail se bahar jaldi jana hai',
        placeholder: 'Select priority',
        type: 'choice_text',
        required: 0,
        options: JSON.stringify(['Jail se bahar jaldi jana', 'Paise bachana']),
        note: 'Note:- Please select only one of the 2 options: Jail se bahar jaldi jana OR Paise bachana',
        is_custom: 0
      },
      {
        order_num: 24,
        key: 'prisoner_psychologic_survey',
        label: '24) Prisoner psychologic according Survey',
        placeholder: 'Select Yes or No, and add remarks (optional)...',
        type: 'psychologic_yesno',
        required: 0,
        options: JSON.stringify(['Yes', 'No']),
        note: 'Note:- Pls select Yes or No (Remarks optional)',
        is_custom: 0
      }
    ];

    const insertQ = db.prepare(`
      INSERT INTO questions (order_num, key, label, placeholder, type, required, options, note, is_custom)
      VALUES (@order_num, @key, @label, @placeholder, @type, @required, @options, @note, @is_custom)
    `);

    const insertManyQ = db.transaction((qs) => {
      for (const q of qs) insertQ.run(q);
    });
    insertManyQ(defaultQuestions);
    console.log('Seeded default 24 questions successfully.');
  } else {
    // If questions exist, update Q24 label if it has "sarve"
    db.prepare("UPDATE questions SET label = '24) Prisoner psychologic according Survey' WHERE key = 'prisoner_psychologic_survey' AND label LIKE '%sarve%'").run();
  }

  // Seed default advocate questions if empty
  try {
    const advQCount = db.prepare('SELECT COUNT(*) as count FROM advocate_questions').get().count;
    if (advQCount === 0) {
      const defaultAdvQuestions = [
        { order_num: 1, key: 'advocate_reg_no', label: '1) Bar Council / Enrollment No.', placeholder: 'e.g. D/1234/2015', type: 'text', required: 1, options: null, note: 'Note:- Unique advocate enrollment / bar registration number.', is_custom: 0 },
        { order_num: 2, key: 'name', label: '2) Advocate Full Name', placeholder: 'e.g. Adv. Rajesh Sharma', type: 'text', required: 1, options: null, note: 'Note:- Enter full name of the advocate.', is_custom: 0 },
        { order_num: 3, key: 'contact_number', label: '3) Contact / WhatsApp Number', placeholder: 'e.g. +91 9876543210', type: 'text', required: 1, options: null, note: 'Note:- 10-digit mobile number.', is_custom: 0 },
        { order_num: 4, key: 'primary_court', label: '4) Primary Court of Practice', placeholder: 'Select primary court', type: 'choice_text', required: 1, options: JSON.stringify(['District Court', 'Sessions Court', 'High Court', 'Supreme Court', 'Magistrate Court (CMM / ACMM)', 'Special / NDPS Court', 'Other']), note: 'Note:- Main court where advocate practices regularly.', is_custom: 0 },
        { order_num: 5, key: 'practice_experience_years', label: '5) Years of Legal Practice', placeholder: 'e.g. 5, 10, 15', type: 'number', required: 1, options: null, note: 'Note:- Input numeric years of experience.', is_custom: 0 },
        { order_num: 6, key: 'case_specialization', label: '6) Legal Specialization', placeholder: 'Select legal specialization', type: 'multi-select', required: 1, options: JSON.stringify(['Criminal Defense', 'Bail Applications', 'NDPS Act (Narcotics)', 'POCSO & Women Safety', 'Cheating & Fraud (IPC 420)', 'Murder / Attempt (IPC 302/307)', 'Cyber Crime', 'Civil & Property', 'Constitutional / High Court Writs', 'Other']), note: 'Note:- Select one or more legal fields.', is_custom: 0 },
        { order_num: 7, key: 'regularly_handles_undertrial_cases', label: '7) Regularly handles Jail / Undertrial Prisoner Cases?', placeholder: 'Yes or No', type: 'yesno', required: 1, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls select Yes or No.', is_custom: 0 },
        { order_num: 8, key: 'provides_legal_aid_dlsa', label: '8) Empanelled with DLSA / Legal Aid?', placeholder: 'Yes or No', type: 'yesno', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls select Yes or No.', is_custom: 0 },
        { order_num: 9, key: 'transparent_fee_structure', label: '9) Provides transparent upfront fee agreement to clients?', placeholder: 'Yes or No', type: 'yesno', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls select Yes or No.', is_custom: 0 },
        { order_num: 10, key: 'average_case_duration', label: '10) Average duration to secure Bail / Trial relief', placeholder: 'e.g. 1 Month, 3 Months, 6 Months', type: 'text', required: 0, options: null, note: 'Note:- Approximate timeline.', is_custom: 0 },
        { order_num: 11, key: 'parivi_assistance_knowledge', label: '11) Knowledge of Prison Parivi & Document tracking process?', placeholder: 'Yes or No', type: 'yesno', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls select Yes or No.', is_custom: 0 },
        { order_num: 12, key: 'remarks', label: '12) Remarks / Suggestions for Jail Legal System', placeholder: 'Enter observations, suggestions, feedback...', type: 'textarea', required: 0, options: null, note: 'Note:- General observations.', is_custom: 0 }
      ];
      const insertAdvQ = db.prepare(`
        INSERT INTO advocate_questions (order_num, key, label, placeholder, type, required, options, note, is_custom)
        VALUES (@order_num, @key, @label, @placeholder, @type, @required, @options, @note, @is_custom)
      `);
      const insertManyAdvQ = db.transaction((qs) => {
        for (const q of qs) insertAdvQ.run(q);
      });
      insertManyAdvQ(defaultAdvQuestions);
      console.log('Seeded default advocate questions successfully.');
    }
  } catch (err) {
    console.error('Error seeding advocate questions:', err.message);
  }
}

initDB();

module.exports = db;
