// Cloudflare Worker API for Survey Portal using Cloudflare D1
const STANDARD_KEYS = [
  'utct_no', 'name', 'case_type', 'total_cases', 'case_duration',
  'total_advocates_hired', 'times_in_jail', 'advocate_name_number',
  'known_unknown_advocate', 'high_court_advocate', 'advocate_payment_advance',
  'first_advocate_by_io', 'know_case_process', 'lawyer_collects_details_evidence',
  'know_fees_reasonable', 'complete_fees_total_initially',
  'work_transparency_tracking', 'know_legal_step_correct',
  'case_prolonged_expensive', 'pairvi_knowledge_reason',
  'court_docs_fees_timing', 'know_trustworthy_platform',
  'priority_money_vs_release', 'prisoner_psychologic_survey',
  'advocates_details'
];

const ADVOCATE_STANDARD_KEYS = [
  'advocate_reg_no', 'name', 'contact_number', 'office_address',
  'primary_court', 'practice_experience_years', 'case_specialization',
  'regularly_handles_undertrial_cases', 'provides_legal_aid_dlsa',
  'transparent_fee_structure', 'average_case_duration',
  'parivi_assistance_knowledge', 'remarks'
];

function extractAdvocateCustomAnswers(data, existingCustom = {}) {
  let custom = { ...existingCustom };
  if (data?.custom_answers) {
    if (typeof data.custom_answers === 'string') {
      try { custom = { ...custom, ...JSON.parse(data.custom_answers) }; } catch (e) {}
    } else if (typeof data.custom_answers === 'object') {
      custom = { ...custom, ...data.custom_answers };
    }
  }
  for (const [k, v] of Object.entries(data || {})) {
    if (!ADVOCATE_STANDARD_KEYS.includes(k) && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(k)) {
      custom[k] = v;
    }
  }
  return JSON.stringify(custom);
}

function extractCustomAnswers(data, existingCustom = {}) {
  let custom = { ...existingCustom };
  if (data?.custom_answers) {
    if (typeof data.custom_answers === 'string') {
      try { custom = { ...custom, ...JSON.parse(data.custom_answers) }; } catch (e) {}
    } else if (typeof data.custom_answers === 'object') {
      custom = { ...custom, ...data.custom_answers };
    }
  }
  for (const [k, v] of Object.entries(data || {})) {
    if (!STANDARD_KEYS.includes(k) && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(k)) {
      custom[k] = v;
    }
  }
  return JSON.stringify(custom);
}

let isD1Initialized = false;

async function ensureD1Database(db) {
  if (isD1Initialized) return;
  try {
    // Ultra-fast cold-start check: If tables exist, bypass all 80 creation queries
    const tableCheck = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='prisoner_surveys'").first();
    if (tableCheck) {
      const chatTableCheck = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_groups'").first();
      if (!chatTableCheck) {
        await ensureChatTables(db);
      }
      isD1Initialized = true;
      return;
    }

    // 1. Users table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'Administrator',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();
    await db.prepare(`
      INSERT OR IGNORE INTO users (username, password, role) VALUES ('meet', 'New@1020', 'Administrator');
    `).run();

    // 2. Case types table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS case_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();
    const caseTypeCount = (await db.prepare('SELECT COUNT(*) as c FROM case_types').first())?.c || 0;
    if (caseTypeCount === 0) {
      const defaultCaseTypes = [
        'Murder (IPC 302)', 'Theft & Burglary (IPC 379/380)', 'Robbery / Dacoity (IPC 392/395)',
        'Bail Application', 'NDPS Act (Narcotics)', 'Cheating & Fraud (IPC 420)',
        'Cyber Crime', 'Assault / Attempt to Murder (IPC 307)', 'Matrimonial / Dowry (IPC 498A)',
        'Arms Act', 'Economic Offence', 'Other'
      ];
      for (const ct of defaultCaseTypes) {
        await db.prepare('INSERT OR IGNORE INTO case_types (name) VALUES (?)').bind(ct).run();
      }
    }

    // 3. Court types table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS court_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();
    const courtCount = (await db.prepare('SELECT COUNT(*) as c FROM court_types').first())?.c || 0;
    if (courtCount === 0) {
      const defaultCourts = [
        'District Court',
        'Sessions Court',
        'High Court',
        'Supreme Court',
        'Special / NDPS Court',
        'Magistrate Court (CMM / ACMM)',
        'Other'
      ];
      for (const courtName of defaultCourts) {
        await db.prepare('INSERT OR IGNORE INTO court_types (name) VALUES (?)').bind(courtName).run();
      }
    }

    // 3b. Advocate types table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS advocate_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();
    const advTypeCount = (await db.prepare('SELECT COUNT(*) as c FROM advocate_types').first())?.c || 0;
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
      for (const t of defaultAdvTypes) {
        await db.prepare('INSERT OR IGNORE INTO advocate_types (name) VALUES (?)').bind(t).run();
      }
    }

    // 4. Questions table (Prisoner Survey Questions)
    await db.prepare(`
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
    `).run();

    const qCount = (await db.prepare('SELECT COUNT(*) as c FROM questions').first())?.c || 0;
    if (qCount === 0) {
      const defaultQuestions = [
        [1, 'utct_no', '1) UT/CT No.', 'e.g. UT/2026/104 or CT/2026/89', 'text', null, 1, 'Note:- Unique ID. System will verify against database before proceeding.', 0],
        [2, 'name', '2) Name', 'Enter prisoner full name', 'text', null, 1, 'Note:- Please enter prisoner full name.', 0],
        [3, 'case_type', '3) Case type / how you type of advocate to hire', 'Select one or more case types', 'multi-select', null, 1, 'Note:- You can select multiple case types from the dropdown managed on the home page.', 0],
        [4, 'total_cases', '4) Total number of cases', 'e.g. 1, 2, 3', 'number', null, 1, 'Note:- Input only Numbers', 0],
        [5, 'case_duration', '5) How long these cases are running', 'e.g. 6 Months, 2 Years, 1 Year 4 Months', 'text', null, 1, 'Note:- Specify duration (months / years).', 0],
        [6, 'total_advocates_hired', '6) Total advocate hired till date', 'e.g. 0, 1, 2', 'number', null, 1, 'Note:- Input only Numbers', 0],
        [7, 'times_in_jail', '7) How many time come to jail', 'e.g. 1, 2, 3', 'number', null, 1, 'Note:- Input only Numbers', 0],
        [8, 'advocate_name_number', '8) Advocate name and number', 'e.g. Adv. R.K. Gupta (+91 9876543210)', 'text', null, 0, 'Note:- Enter current or previous advocate name and phone number.', 0],
        [9, 'known_unknown_advocate', '9) Known / unknown Advocate', 'Known or Unknown', 'yesno_or_choice', '["Known","Unknown","Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [10, 'high_court_advocate', '10) High court advocate', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [11, 'advocate_payment_advance', '11) Advocate payment advance', 'Type \'Yes\' or \'No\'', 'yesno_advance', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [12, 'first_advocate_by_io', '12) First Advocate hired by IO', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [13, 'know_case_process', '13) Do you know process, when case started, first and next step', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [14, 'lawyer_collects_details_evidence', '14) Does your lawyer ask, all details about your case, and collect evidence', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [15, 'know_fees_reasonable', '15) How do you know, lawyer jo fees le raha hai, vo sahi hai', 'Yes or No / Details', 'yesno_text', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [16, 'complete_fees_total_initially', '16) Does it give, complete fees total, initially', 'Type \'Yes\' or \'No\'', 'yesno_advance', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No (If Yes, specify complete fees amount)', 0],
        [17, 'work_transparency_tracking', '17) Work transparency and tracking of lawyer work', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [18, 'know_legal_step_correct', '18) Kya apko pata hai, jo legal step lawyer process kar raha hai, vo sab sahi hai, kuch miss toh nahi kar raha', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [19, 'case_prolonged_expensive', '19) Because of some extra unwanted step, kya lawyer ki wajah se, case lamba chala aur expensive ho gaya', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [20, 'pairvi_knowledge_reason', '20) Parivi karwane ko knowledge hai ya nahi, aur kyun parivi karta hai', 'Yes or No / Details', 'yesno_text', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [21, 'court_docs_fees_timing', '21) Court ke doc kyun nikalte hai, and uski fees pata hai, aur kya vo aapko time pe miljate hai', 'Yes or No / Details', 'yesno_text', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [22, 'know_trustworthy_platform', '22) Do you know any platform, jo aapko pairvi karne wala de, and jo guarantee de ki, jo adv provide karega, jo trustworthy hoga', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
        [23, 'priority_money_vs_release', '23) Your priority, ki paise bachana hai ya jail se bahar jaldi jana hai', 'Select priority', 'choice_text', '["Jail se bahar jaldi jana","Paise bachana"]', 0, 'Note:- Please select only one of the 2 options: Jail se bahar jaldi jana OR Paise bachana', 0],
        [24, 'prisoner_psychologic_survey', '24) Prisoner psychologic according Survey', 'Select Yes or No, and add remarks (optional)...', 'psychologic_yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No (Remarks optional)', 0]
      ];
      for (const q of defaultQuestions) {
        await db.prepare(`
          INSERT OR IGNORE INTO questions (order_num, key, label, placeholder, type, options, required, note, is_custom)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(...q).run();
      }
    }

    // 5. Advocate Questions table
    await db.prepare(`
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
    `).run();
    const advQCount = (await db.prepare('SELECT COUNT(*) as c FROM advocate_questions').first())?.c || 0;
    if (advQCount === 0) {
      const defaultAdvQuestions = [
        [1, 'advocate_reg_no', '1) Bar Council / Enrollment No.', 'e.g. D/1234/2015', 'text', null, 1, 'Note:- Unique advocate enrollment / bar registration number.', 0],
        [2, 'name', '2) Advocate Full Name', 'e.g. Adv. Rajesh Sharma', 'text', null, 1, 'Note:- Enter full name of the advocate.', 0],
        [3, 'contact_number', '3) Contact / WhatsApp Number', 'e.g. +91 9876543210', 'text', null, 1, 'Note:- 10-digit mobile number.', 0],
        [4, 'primary_court', '4) Primary Court of Practice', 'Select primary court', 'choice_text', '["District Court","Sessions Court","High Court","Supreme Court","Magistrate Court (CMM / ACMM)","Special / NDPS Court","Other"]', 1, 'Note:- Main court where advocate practices regularly.', 0],
        [5, 'practice_experience_years', '5) Years of Legal Practice', 'e.g. 5, 10, 15', 'number', null, 1, 'Note:- Input numeric years of experience.', 0],
        [6, 'case_specialization', '6) Legal Specialization', 'Select legal specialization', 'multi-select', '["Criminal Defense","Bail Applications","NDPS Act (Narcotics)","POCSO & Women Safety","Cheating & Fraud (IPC 420)","Murder / Attempt (IPC 302/307)","Cyber Crime","Civil & Property","Constitutional / High Court Writs","Other"]', 1, 'Note:- Select one or more legal fields.', 0],
        [7, 'regularly_handles_undertrial_cases', '7) Regularly handles Jail / Undertrial Prisoner Cases?', 'Yes or No', 'yesno', '["Yes","No"]', 1, 'Note:- Pls select Yes or No.', 0],
        [8, 'provides_legal_aid_dlsa', '8) Empanelled with DLSA / Legal Aid?', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No.', 0],
        [9, 'transparent_fee_structure', '9) Provides transparent upfront fee agreement to clients?', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No.', 0],
        [10, 'average_case_duration', '10) Average duration to secure Bail / Trial relief', 'e.g. 1 Month, 3 Months, 6 Months', 'text', null, 0, 'Note:- Approximate timeline.', 0],
        [11, 'parivi_assistance_knowledge', '11) Knowledge of Prison Parivi & Document tracking process?', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No.', 0],
        [12, 'remarks', '12) Remarks / Suggestions for Jail Legal System', 'Enter observations, suggestions, feedback...', 'textarea', null, 0, 'Note:- General observations.', 0]
      ];
      for (const q of defaultAdvQuestions) {
        await db.prepare(`
          INSERT OR IGNORE INTO advocate_questions (order_num, key, label, placeholder, type, options, required, note, is_custom)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(...q).run();
      }
    }

    // 6. Advocate Surveys table
    await db.prepare(`
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
    `).run();

    // 7. Prisoner Surveys table
    await db.prepare(`
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
    `).run();

    // 8. Ensure prisoner_surveys columns: advocates_details and custom_answers
    try {
      await db.prepare("ALTER TABLE prisoner_surveys ADD COLUMN advocates_details TEXT DEFAULT '[]'").run();
    } catch (e) {}
    try {
      await db.prepare("ALTER TABLE prisoner_surveys ADD COLUMN custom_answers TEXT DEFAULT '{}'").run();
    } catch (e) {}
    try {
      await db.prepare("ALTER TABLE advocate_surveys ADD COLUMN custom_answers TEXT DEFAULT '{}'").run();
    } catch (e) {}
    try {
      await db.prepare("ALTER TABLE questions ADD COLUMN has_remark INTEGER DEFAULT 0").run();
    } catch (e) {}
    try {
      await db.prepare("ALTER TABLE advocate_questions ADD COLUMN has_remark INTEGER DEFAULT 0").run();
    } catch (e) {}

    // 9. Web Review URLs
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS web_review_urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();

    // 10. Web Reviews
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS web_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url_id INTEGER,
        website_name TEXT NOT NULL,
        url TEXT NOT NULL,
        reviews TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();

    // 11. Raasta Portals
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS raasta_portals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();

    // 12. Raasta Functions
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS raasta_functions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        portal_name TEXT NOT NULL,
        function_name TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();

    // 13. Work Roles
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS work_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();

    // 14. Work Role Entries
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS work_role_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_name TEXT NOT NULL,
        work_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();

    // 15. New Prisoner Surveys Table
    await db.prepare(`
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
    `).run();

    // 16. New Prisoner Questions Table (Separate questions for New Prisoner module)
    await db.prepare(`
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
    `).run();

    const newQCount = (await db.prepare('SELECT COUNT(*) as c FROM new_prisoner_questions').first())?.c || 0;
    if (newQCount === 0) {
      try {
        await db.prepare(`
          INSERT OR IGNORE INTO new_prisoner_questions (order_num, key, label, placeholder, type, options, required, note, has_remark, is_custom)
          SELECT order_num, key, label, placeholder, type, options, required, note, has_remark, is_custom FROM questions
        `).run();
      } catch (seedErr) {
        console.warn('Seeding new_prisoner_questions failed:', seedErr);
      }
    }

    // 17. Doc Store Files Table (Cloudflare R2 Object Metadata)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS doc_store_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        file_key TEXT UNIQUE NOT NULL,
        folder_path TEXT DEFAULT '/',
        file_size INTEGER DEFAULT 0,
        content_type TEXT,
        storage_type TEXT DEFAULT 'R2',
        uploaded_by TEXT DEFAULT 'Admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();

    // 18. Pass MS Table (Password Management System)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS pass_ms_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();

    // 19. 1 to 1 Chat Tables
    await ensureChatTables(db);

    isD1Initialized = true;
  } catch (err) {
    console.error('ensureD1Database error:', err);
  }
}

async function ensureChatTables(db) {
  try {
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS chat_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          avatar_color TEXT DEFAULT '#2563EB',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS chat_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          logo_url TEXT DEFAULT '💬',
          created_by TEXT DEFAULT 'meet',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS chat_group_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          member_id INTEGER NOT NULL,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(group_id, member_id)
        );
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          sender_name TEXT NOT NULL,
          sender_id INTEGER DEFAULT 0,
          message TEXT NOT NULL,
          mentions TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_chat_msg_group ON chat_messages(group_id, id);"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_chat_group_m_gid ON chat_group_members(group_id);"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_chat_group_m_mid ON chat_group_members(member_id);")
    ]);

    // Check if seed members exist
    const memberCount = (await db.prepare('SELECT COUNT(*) as c FROM chat_members').first())?.c || 0;
    if (memberCount === 0) {
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO chat_members (name, avatar_color) VALUES ('meet (Admin)', '#7C3AED')"),
        db.prepare("INSERT OR IGNORE INTO chat_members (name, avatar_color) VALUES ('Adv. Rajesh Sharma', '#2563EB')"),
        db.prepare("INSERT OR IGNORE INTO chat_members (name, avatar_color) VALUES ('Sunita Legal Aid', '#059669')"),
        db.prepare("INSERT OR IGNORE INTO chat_members (name, avatar_color) VALUES ('Amit Parivi Incharge', '#D97706')"),
        db.prepare("INSERT OR IGNORE INTO chat_members (name, avatar_color) VALUES ('Kavita Clerk', '#DC2626')")
      ]);

      // Seed a default group
      const grpRes = await db.prepare("INSERT INTO chat_groups (name, description, logo_url, created_by) VALUES ('Legal Survey Coordination', 'Official Jail Legal Aid & Advocate Coordination Group', '⚖️', 'meet')").run();
      const newGid = grpRes?.meta?.last_row_id || 1;
      
      const allM = await db.prepare('SELECT id FROM chat_members').all();
      const memberStmts = (allM.results || []).map(m => 
        db.prepare("INSERT OR IGNORE INTO chat_group_members (group_id, member_id) VALUES (?, ?)").bind(newGid, m.id)
      );
      if (memberStmts.length > 0) {
        await db.batch(memberStmts);
      }

      // Initial welcome message
      await db.prepare("INSERT INTO chat_messages (group_id, sender_name, message, mentions) VALUES (?, 'meet (Admin)', 'Welcome to the 1 to 1 Group Chat app! You can add/edit members, create custom groups, and type @ to mention any group member.', '[]')").bind(newGid).run();
    }
  } catch (err) {
    console.warn('ensureChatTables notice:', err);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (env.DB) {
        await ensureD1Database(env.DB);
      }

      // 0. Root Health Check & API Status
      if ((path === '/' || path === '/api' || path === '/api/health') && method === 'GET') {
        return new Response(
          JSON.stringify({
            status: 'online',
            success: true,
            message: 'Survey Portal API is Live & Healthy!',
            version: '2.0.0',
            database: 'Cloudflare D1 Connected'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 1. Auth Login (Authenticated via Database)
      if (path === '/api/auth/login' && method === 'POST') {
        const { username, password } = await request.json();
        const cleanUsername = (username || '').trim().toLowerCase();

        if (cleanUsername === 'sarve') {
          return new Response(
            JSON.stringify({ success: false, message: 'Invalid Username or Password! Please use correct credentials.' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 1. Check users table in D1 Database
        let user = null;
        try {
          user = await env.DB.prepare(
            'SELECT id, username, role FROM users WHERE LOWER(TRIM(username)) = ? AND password = ?'
          ).bind(cleanUsername, password).first();
        } catch (dbErr) {
          console.warn('Users table query failed or not created yet:', dbErr);
        }

        if (user) {
          return new Response(
            JSON.stringify({
              success: true,
              token: 'survey-auth-d1-token-' + user.id,
              user: { id: user.id, username: user.username, role: user.role || 'Administrator', displayName: 'Survey Admin' }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fallback for default credential if table is pending (supports any case like meet, Meet, MEET)
        if (cleanUsername === 'meet' && password === 'New@1020') {
          return new Response(
            JSON.stringify({
              success: true,
              token: 'survey-auth-cloudflare-d1-token',
              user: { username: 'meet', role: 'Administrator', displayName: 'Survey Admin' }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: false, message: 'Invalid Username or Password!' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Check UT/CT uniqueness
      if (path.startsWith('/api/survey/check-utct') && method === 'GET') {
        const utctNo = (url.searchParams.get('no') || url.searchParams.get('utctNo') || decodeURIComponent(path.split('/')[4] || '')).trim();
        const existing = await env.DB.prepare(
          'SELECT id, utct_no, name FROM prisoner_surveys WHERE LOWER(TRIM(utct_no)) = LOWER(TRIM(?))'
        ).bind(utctNo).first();

        return new Response(
          JSON.stringify({
            exists: !!existing,
            message: existing ? `UT/CT No. "${utctNo}" already exists!` : 'Available',
            survey: existing || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 3. List Surveys
      if (path === '/api/survey/list' && method === 'GET') {
        const q = url.searchParams.get('q') || '';
        let result;
        if (q) {
          const searchPattern = `%${q}%`;
          result = await env.DB.prepare(
            `SELECT * FROM prisoner_surveys WHERE utct_no LIKE ? OR name LIKE ? OR case_type LIKE ? ORDER BY id DESC`
          ).bind(searchPattern, searchPattern, searchPattern).all();
        } else {
          result = await env.DB.prepare('SELECT * FROM prisoner_surveys ORDER BY id DESC').all();
        }

        const data = (result.results || []).map((r) => {
          let custom = {};
          if (r.custom_answers) {
            try { custom = JSON.parse(r.custom_answers); } catch (e) {}
          }
          let advocates_details = [];
          if (r.advocates_details) {
            try {
              advocates_details = typeof r.advocates_details === 'string' ? JSON.parse(r.advocates_details) : r.advocates_details;
            } catch (e) {
              advocates_details = [];
            }
          }
          if ((!Array.isArray(advocates_details) || advocates_details.length === 0) && custom.advocates_details) {
            try {
              advocates_details = typeof custom.advocates_details === 'string' ? JSON.parse(custom.advocates_details) : custom.advocates_details;
            } catch (e) {}
          }
          delete custom.advocates_details;
          return { ...r, ...custom, advocates_details: Array.isArray(advocates_details) ? advocates_details : [] };
        });

        return new Response(
          JSON.stringify({ success: true, count: data.length, data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
        );
      }

      // 4. Get single survey by ID
      if (path.startsWith('/api/survey/') && method === 'GET' && !path.includes('check-utct') && !path.includes('list') && !path.includes('export')) {
        const id = path.split('/')[3];
        const survey = await env.DB.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').bind(id).first();
        if (!survey) {
          return new Response(JSON.stringify({ success: false, message: 'Survey not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        let custom = {};
        if (survey.custom_answers) {
          try { custom = JSON.parse(survey.custom_answers); } catch (e) {}
        }
        let advocates_details = [];
        if (survey.advocates_details) {
          try {
            advocates_details = typeof survey.advocates_details === 'string' ? JSON.parse(survey.advocates_details) : survey.advocates_details;
          } catch (e) {
            advocates_details = [];
          }
        }
        if ((!Array.isArray(advocates_details) || advocates_details.length === 0) && custom.advocates_details) {
          try {
            advocates_details = typeof custom.advocates_details === 'string' ? JSON.parse(custom.advocates_details) : custom.advocates_details;
          } catch (e) {}
        }
        delete custom.advocates_details;
        return new Response(JSON.stringify({ success: true, data: { ...survey, ...custom, advocates_details: Array.isArray(advocates_details) ? advocates_details : [] } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 5. Add Survey
      if (path === '/api/survey/add' && method === 'POST') {
        const d = await request.json();
        const existing = await env.DB.prepare(
          'SELECT id FROM prisoner_surveys WHERE LOWER(TRIM(utct_no)) = LOWER(TRIM(?))'
        ).bind(d.utct_no).first();

        if (existing) {
          return new Response(
            JSON.stringify({ success: false, message: `UT/CT No. "${d.utct_no}" already exists!` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const customJson = extractCustomAnswers(d);
        const advDetailsJson = typeof d.advocates_details === 'string' ? d.advocates_details : JSON.stringify(d.advocates_details || []);

        try {
          await env.DB.prepare(`
            INSERT INTO prisoner_surveys (
              utct_no, name, case_type, total_cases, case_duration,
              total_advocates_hired, times_in_jail, advocate_name_number,
              advocates_details,
              known_unknown_advocate, high_court_advocate, advocate_payment_advance,
              first_advocate_by_io, know_case_process, lawyer_collects_details_evidence,
              know_fees_reasonable, complete_fees_total_initially,
              work_transparency_tracking, know_legal_step_correct,
              case_prolonged_expensive, pairvi_knowledge_reason,
              court_docs_fees_timing, know_trustworthy_platform,
              priority_money_vs_release, prisoner_psychologic_survey,
              custom_answers
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            d.utct_no, d.name, Array.isArray(d.case_type) ? d.case_type.join(', ') : (d.case_type || ''),
            Number(d.total_cases) || 0, d.case_duration || '', Number(d.total_advocates_hired) || 0,
            Number(d.times_in_jail) || 0, d.advocate_name_number || '', advDetailsJson,
            d.known_unknown_advocate || '', d.high_court_advocate || '', d.advocate_payment_advance || '',
            d.first_advocate_by_io || '', d.know_case_process || '', d.lawyer_collects_details_evidence || '',
            d.know_fees_reasonable || '', d.complete_fees_total_initially || '', d.work_transparency_tracking || '',
            d.know_legal_step_correct || '', d.case_prolonged_expensive || '', d.pairvi_knowledge_reason || '',
            d.court_docs_fees_timing || '', d.know_trustworthy_platform || '', d.priority_money_vs_release || '',
            d.prisoner_psychologic_survey || '', customJson
          ).run();
        } catch (insertErr) {
          try {
            await env.DB.prepare("ALTER TABLE prisoner_surveys ADD COLUMN advocates_details TEXT DEFAULT '[]'").run();
          } catch (e) {}
          try {
            await env.DB.prepare("ALTER TABLE prisoner_surveys ADD COLUMN custom_answers TEXT DEFAULT '{}'").run();
          } catch (e) {}
          await env.DB.prepare(`
            INSERT INTO prisoner_surveys (
              utct_no, name, case_type, total_cases, case_duration,
              total_advocates_hired, times_in_jail, advocate_name_number,
              advocates_details,
              known_unknown_advocate, high_court_advocate, advocate_payment_advance,
              first_advocate_by_io, know_case_process, lawyer_collects_details_evidence,
              know_fees_reasonable, complete_fees_total_initially,
              work_transparency_tracking, know_legal_step_correct,
              case_prolonged_expensive, pairvi_knowledge_reason,
              court_docs_fees_timing, know_trustworthy_platform,
              priority_money_vs_release, prisoner_psychologic_survey,
              custom_answers
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            d.utct_no, d.name, Array.isArray(d.case_type) ? d.case_type.join(', ') : (d.case_type || ''),
            Number(d.total_cases) || 0, d.case_duration || '', Number(d.total_advocates_hired) || 0,
            Number(d.times_in_jail) || 0, d.advocate_name_number || '', advDetailsJson,
            d.known_unknown_advocate || '', d.high_court_advocate || '', d.advocate_payment_advance || '',
            d.first_advocate_by_io || '', d.know_case_process || '', d.lawyer_collects_details_evidence || '',
            d.know_fees_reasonable || '', d.complete_fees_total_initially || '', d.work_transparency_tracking || '',
            d.know_legal_step_correct || '', d.case_prolonged_expensive || '', d.pairvi_knowledge_reason || '',
            d.court_docs_fees_timing || '', d.know_trustworthy_platform || '', d.priority_money_vs_release || '',
            d.prisoner_psychologic_survey || '', customJson
          ).run();
        }

        const newId = Date.now();
        let savedCustom = {};
        try { savedCustom = JSON.parse(customJson || '{}'); } catch (e) {}
        let savedAdvDetails = [];
        try { savedAdvDetails = Array.isArray(d.advocates_details) ? d.advocates_details : JSON.parse(d.advocates_details || '[]'); } catch (e) {}

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Saved successfully',
            data: { ...d, id: newId, advocates_details: savedAdvDetails, ...savedCustom, created_at: new Date().toISOString() }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 6. Update Survey
      if (path.startsWith('/api/survey/') && method === 'PUT') {
        const id = path.split('/')[3];
        const d = await request.json();

        const existing = await env.DB.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').bind(id).first();
        let existingCustom = {};
        if (existing?.custom_answers) {
          try { existingCustom = JSON.parse(existing.custom_answers); } catch (e) {}
        }
        const customJson = extractCustomAnswers(d, existingCustom);
        const advDetailsJson = typeof d.advocates_details === 'string' ? d.advocates_details : JSON.stringify(d.advocates_details || []);

        try {
          await env.DB.prepare(`
            UPDATE prisoner_surveys SET
              utct_no = ?, name = ?, case_type = ?, total_cases = ?, case_duration = ?,
              total_advocates_hired = ?, times_in_jail = ?, advocate_name_number = ?,
              advocates_details = ?,
              known_unknown_advocate = ?, high_court_advocate = ?, advocate_payment_advance = ?,
              first_advocate_by_io = ?, know_case_process = ?, lawyer_collects_details_evidence = ?,
              know_fees_reasonable = ?, complete_fees_total_initially = ?,
              work_transparency_tracking = ?, know_legal_step_correct = ?,
              case_prolonged_expensive = ?, pairvi_knowledge_reason = ?,
              court_docs_fees_timing = ?, know_trustworthy_platform = ?,
              priority_money_vs_release = ?, prisoner_psychologic_survey = ?,
              custom_answers = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(
            d.utct_no, d.name, Array.isArray(d.case_type) ? d.case_type.join(', ') : (d.case_type || ''),
            Number(d.total_cases) || 0, d.case_duration || '', Number(d.total_advocates_hired) || 0,
            Number(d.times_in_jail) || 0, d.advocate_name_number || '', advDetailsJson,
            d.known_unknown_advocate || '', d.high_court_advocate || '', d.advocate_payment_advance || '',
            d.first_advocate_by_io || '', d.know_case_process || '', d.lawyer_collects_details_evidence || '',
            d.know_fees_reasonable || '', d.complete_fees_total_initially || '', d.work_transparency_tracking || '',
            d.know_legal_step_correct || '', d.case_prolonged_expensive || '', d.pairvi_knowledge_reason || '',
            d.court_docs_fees_timing || '', d.know_trustworthy_platform || '', d.priority_money_vs_release || '',
            d.prisoner_psychologic_survey || '', customJson,
            id
          ).run();
        } catch (e) {
          console.error('Update error in worker:', e);
        }

        const numId = Number(id) || id;
        let updatedAdvDetails = [];
        try { updatedAdvDetails = Array.isArray(d.advocates_details) ? d.advocates_details : JSON.parse(d.advocates_details || '[]'); } catch (e) {}
        let updatedCustom = {};
        try { updatedCustom = JSON.parse(customJson || '{}'); } catch (e) {}

        const finalData = {
          ...(existing || {}),
          ...d,
          advocates_details: updatedAdvDetails,
          ...updatedCustom,
          id: numId,
          updated_at: new Date().toISOString()
        };
        return new Response(JSON.stringify({ success: true, message: 'Updated successfully', data: finalData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 7. Delete Survey
      if (path.startsWith('/api/survey/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM prisoner_surveys WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 8. Questions List
      if (path === '/api/questions' && method === 'GET') {
        try {
          const list = await env.DB.prepare('SELECT * FROM questions ORDER BY order_num ASC, id ASC').all();
          const data = (list.results || []).map((q) => {
            let options = null;
            if (q.options) {
              try { options = JSON.parse(q.options); } catch (e) { options = q.options.split(','); }
            }
            return {
              ...q,
              required: Boolean(q.required),
              is_custom: Boolean(q.is_custom),
              has_remark: Boolean(q.has_remark),
              options
            };
          });
          return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, message: e.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 9. Add Question
      if (path === '/api/questions' && method === 'POST') {
        const body = await request.json();
        if (!body.label || !body.label.trim()) {
          return new Response(JSON.stringify({ success: false, message: 'Question label is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const maxOrder = (await env.DB.prepare('SELECT MAX(order_num) as m FROM questions').first())?.m || 0;
        const orderNum = (body.order_num !== undefined && !isNaN(body.order_num)) ? Number(body.order_num) : (maxOrder + 1);
        const key = body.key || `custom_${Date.now()}`;
        let optionsStr = null;
        if (body.options) {
          optionsStr = Array.isArray(body.options) ? JSON.stringify(body.options) : JSON.stringify(String(body.options).split(',').map((s) => s.trim()).filter(Boolean));
        }

        const hasRemark = body.has_remark ? 1 : 0;
        await env.DB.prepare(`
          INSERT INTO questions (order_num, key, label, placeholder, type, options, required, note, is_custom, has_remark)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).bind(orderNum, key, body.label.trim(), body.placeholder || '', body.type || 'text', optionsStr, body.required ? 1 : 0, body.note || '', hasRemark).run();

        const created = await env.DB.prepare('SELECT * FROM questions WHERE key = ?').bind(key).first();
        let options = null;
        if (created?.options) {
          try { options = JSON.parse(created.options); } catch (e) { options = created.options.split(','); }
        }
        return new Response(JSON.stringify({
          success: true,
          message: 'Question added successfully',
          data: {
            ...created,
            required: Boolean(created?.required),
            is_custom: true,
            has_remark: Boolean(created?.has_remark),
            options
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 9b. Update Question & Numbering
      if (path.startsWith('/api/questions/') && method === 'PUT') {
        const id = path.split('/')[3];
        const body = await request.json();
        const existing = await env.DB.prepare('SELECT * FROM questions WHERE id = ?').bind(id).first();
        if (!existing) {
          return new Response(JSON.stringify({ success: false, message: 'Question not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const newOrderNum = (body.order_num !== undefined && !isNaN(body.order_num)) ? Number(body.order_num) : existing.order_num;
        const newLabel = body.label !== undefined ? body.label.trim() : existing.label;
        const newPlaceholder = body.placeholder !== undefined ? body.placeholder.trim() : existing.placeholder;
        const newType = body.type || existing.type;
        const newRequired = body.required !== undefined ? (body.required ? 1 : 0) : existing.required;
        const newNote = body.note !== undefined ? body.note.trim() : existing.note;
        const newHasRemark = body.has_remark !== undefined ? (body.has_remark ? 1 : 0) : (existing.has_remark ? 1 : 0);
        let optionsStr = existing.options;
        if (body.options !== undefined) {
          optionsStr = Array.isArray(body.options) ? JSON.stringify(body.options) : (typeof body.options === 'string' ? JSON.stringify(body.options.split(',').map((s) => s.trim()).filter(Boolean)) : null);
        }

        await env.DB.prepare(`
          UPDATE questions SET
            order_num = ?, label = ?, placeholder = ?, type = ?, options = ?, required = ?, note = ?, has_remark = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(newOrderNum, newLabel, newPlaceholder, newType, optionsStr, newRequired, newNote, newHasRemark, id).run();

        const updated = await env.DB.prepare('SELECT * FROM questions WHERE id = ?').bind(id).first();
        return new Response(JSON.stringify({
          success: true,
          message: 'Question updated successfully',
          data: { ...updated, has_remark: Boolean(updated?.has_remark), required: Boolean(updated?.required) }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 9c. Delete Question
      if (path.startsWith('/api/questions/') && method === 'DELETE') {
        const id = path.split('/')[3];
        const qRecord = await env.DB.prepare('SELECT order_num, key FROM questions WHERE id = ?').bind(id).first();
        if (qRecord && (Number(qRecord.order_num) <= 3 || ['utct_no', 'name', 'case_type'].includes(qRecord.key))) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Question #1 (UT/CT No), #2 (Name), and #3 (Case Type) are permanent core questions and cannot be deleted.'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        await env.DB.prepare('DELETE FROM questions WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Question deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 9d. Batch Reorder Questions
      if (path === '/api/questions/reorder' && method === 'POST') {
        const { items } = await request.json();
        if (Array.isArray(items)) {
          for (const item of items) {
            const num = Number(item.order_num);
            if (item.label) {
              await env.DB.prepare('UPDATE questions SET order_num = ?, label = ? WHERE id = ? OR key = ?').bind(num, item.label, item.id, item.key || item.id).run();
            } else {
              await env.DB.prepare('UPDATE questions SET order_num = ? WHERE id = ? OR key = ?').bind(num, item.id, item.key || item.id).run();
            }
          }
        }
        const updatedList = await env.DB.prepare('SELECT * FROM questions ORDER BY order_num ASC, id ASC').all();
        const data = (updatedList.results || []).map((q) => {
          let options = null;
          if (q.options) {
            try { options = JSON.parse(q.options); } catch (e) { options = q.options.split(','); }
          }
          return { ...q, required: Boolean(q.required), is_custom: Boolean(q.is_custom), options };
        });
        return new Response(JSON.stringify({ success: true, message: 'Reordered successfully', data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 9e. Reset Questions to Default 24
      if (path === '/api/questions/reset' && method === 'POST') {
        await env.DB.prepare('DELETE FROM questions').run();
        const defaultQueries = [
          [1, 'utct_no', '1) UT/CT No.', 'e.g. UT/2026/104 or CT/2026/89', 'text', null, 1, 'Note:- Unique ID. System will verify against database before proceeding.', 0],
          [2, 'name', '2) Name', 'Enter prisoner full name', 'text', null, 1, 'Note:- Please enter prisoner full name.', 0],
          [3, 'case_type', '3) Case type / how you type of advocate to hire', 'Select one or more case types', 'multi-select', null, 1, 'Note:- You can select multiple case types from the dropdown managed on the home page.', 0],
          [4, 'total_cases', '4) Total number of cases', 'e.g. 1, 2, 3', 'number', null, 1, 'Note:- Input only Numbers', 0],
          [5, 'case_duration', '5) How long these cases are running', 'e.g. 6 Months, 2 Years, 1 Year 4 Months', 'text', null, 1, 'Note:- Specify duration (months / years).', 0],
          [6, 'total_advocates_hired', '6) Total advocate hired till date', 'e.g. 0, 1, 2', 'number', null, 1, 'Note:- Input only Numbers', 0],
          [7, 'times_in_jail', '7) How many time come to jail', 'e.g. 1, 2, 3', 'number', null, 1, 'Note:- Input only Numbers', 0],
          [8, 'advocate_name_number', '8) Advocate name and number', 'e.g. Adv. R.K. Gupta (+91 9876543210)', 'text', null, 0, 'Note:- Enter current or previous advocate name and phone number.', 0],
          [9, 'known_unknown_advocate', '9) Known / unknown Advocate', 'Known or Unknown', 'yesno_or_choice', '["Known","Unknown","Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [10, 'high_court_advocate', '10) High court advocate', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [11, 'advocate_payment_advance', '11) Advocate payment advance', 'Type \'Yes\' or \'No\'', 'yesno_advance', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [12, 'first_advocate_by_io', '12) First Advocate hired by IO', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [13, 'know_case_process', '13) Do you know process, when case started, first and next step', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [14, 'lawyer_collects_details_evidence', '14) Does your lawyer ask, all details about your case, and collect evidence', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [15, 'know_fees_reasonable', '15) How do you know, lawyer jo fees le raha hai, vo sahi hai', 'Yes or No / Details', 'yesno_text', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [16, 'complete_fees_total_initially', '16) Does it give, complete fees total, initially', 'Type \'Yes\' or \'No\'', 'yesno_advance', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No (If Yes, specify complete fees amount)', 0],
          [17, 'work_transparency_tracking', '17) Work transparency and tracking of lawyer work', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [18, 'know_legal_step_correct', '18) Kya apko pata hai, jo legal step lawyer process kar raha hai, vo sab sahi hai, kuch miss toh nahi kar raha', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [19, 'case_prolonged_expensive', '19) Because of some extra unwanted step, kya lawyer ki wajah se, case lamba chala aur expensive ho gaya', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [20, 'pairvi_knowledge_reason', '20) Parivi karwane ko knowledge hai ya nahi, aur kyun parivi karta hai', 'Yes or No / Details', 'yesno_text', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [21, 'court_docs_fees_timing', '21) Court ke doc kyun nikalte hai, and uski fees pata hai, aur kya vo aapko time pe miljate hai', 'Yes or No / Details', 'yesno_text', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [22, 'know_trustworthy_platform', '22) Do you know any platform, jo aapko pairvi karne wala de, and jo guarantee de ki, jo adv provide karega, jo trustworthy hoga', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls enter Only Yes or No', 0],
          [23, 'priority_money_vs_release', '23) Your priority, ki paise bachana hai ya jail se bahar jaldi jana hai', 'Select priority', 'choice_text', '["Jail se bahar jaldi jana","Paise bachana"]', 0, 'Note:- Please select only one of the 2 options: Jail se bahar jaldi jana OR Paise bachana', 0],
          [24, 'prisoner_psychologic_survey', '24) Prisoner psychologic according Survey', 'Select Yes or No, and add remarks (optional)...', 'psychologic_yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No (Remarks optional)', 0]
        ];
        for (const q of defaultQueries) {
          await env.DB.prepare(`
            INSERT INTO questions (order_num, key, label, placeholder, type, options, required, note, is_custom)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(...q).run();
        }
        const resetList = await env.DB.prepare('SELECT * FROM questions ORDER BY order_num ASC, id ASC').all();
        return new Response(JSON.stringify({ success: true, message: 'Reset to default 24 questions', data: resetList.results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 10. Case Types List
      if (path === '/api/case-types' && method === 'GET') {
        const list = await env.DB.prepare('SELECT * FROM case_types ORDER BY name ASC').all();
        return new Response(
          JSON.stringify({ success: true, data: list.results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 11. Add Case Type
      if (path === '/api/case-types' && method === 'POST') {
        const { name } = await request.json();
        await env.DB.prepare('INSERT OR IGNORE INTO case_types (name) VALUES (?)').bind(name.trim()).run();
        return new Response(JSON.stringify({ success: true, message: 'Case type added' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 12. Delete Case Type
      if (path.startsWith('/api/case-types/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM case_types WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Case type deleted' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================
      // 13. Court Types CRUD
      // ==========================================
      if (path === '/api/court-types' && method === 'GET') {
        const list = await env.DB.prepare('SELECT * FROM court_types ORDER BY id ASC').all();
        return new Response(JSON.stringify({ success: true, count: (list.results || []).length, data: list.results || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      }

      if (path === '/api/court-types' && method === 'POST') {
        const { name } = await request.json();
        const cleanName = (name || '').trim();
        if (!cleanName) {
          return new Response(JSON.stringify({ success: false, message: 'Court type name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        await env.DB.prepare('INSERT OR IGNORE INTO court_types (name) VALUES (?)').bind(cleanName).run();
        const created = await env.DB.prepare('SELECT * FROM court_types WHERE name = ?').bind(cleanName).first();
        return new Response(JSON.stringify({ success: true, message: 'Court type added successfully', data: created }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/court-types/') && method === 'PUT') {
        const id = path.split('/')[3];
        const { name } = await request.json();
        const cleanName = (name || '').trim();
        await env.DB.prepare('UPDATE court_types SET name = ? WHERE id = ?').bind(cleanName, id).run();
        return new Response(JSON.stringify({ success: true, message: 'Court type updated successfully', data: { id: Number(id), name: cleanName } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/court-types/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM court_types WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Court type removed successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================
      // 13b. Advocate Types CRUD (Dropdown Options)
      // ==========================================
      if (path === '/api/advocate-types' && method === 'GET') {
        const list = await env.DB.prepare('SELECT * FROM advocate_types ORDER BY id ASC').all();
        return new Response(JSON.stringify({ success: true, count: (list.results || []).length, data: list.results || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      }

      if (path === '/api/advocate-types' && method === 'POST') {
        const { name } = await request.json();
        const cleanName = (name || '').trim();
        if (!cleanName) {
          return new Response(JSON.stringify({ success: false, message: 'Advocate type name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        await env.DB.prepare('INSERT OR IGNORE INTO advocate_types (name) VALUES (?)').bind(cleanName).run();
        const created = await env.DB.prepare('SELECT * FROM advocate_types WHERE name = ?').bind(cleanName).first();
        return new Response(JSON.stringify({ success: true, message: 'Advocate type added successfully', data: created }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/advocate-types/') && method === 'PUT') {
        const id = path.split('/')[3];
        const { name } = await request.json();
        const cleanName = (name || '').trim();
        await env.DB.prepare('UPDATE advocate_types SET name = ? WHERE id = ?').bind(cleanName, id).run();
        return new Response(JSON.stringify({ success: true, message: 'Advocate type updated successfully', data: { id: Number(id), name: cleanName } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/advocate-types/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM advocate_types WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Advocate type removed successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================
      // 14. Advocate Questions CRUD & Management
      // ==========================================
      if (path === '/api/advocate-questions' && method === 'GET') {
        const list = await env.DB.prepare('SELECT * FROM advocate_questions ORDER BY order_num ASC, id ASC').all();
        const data = (list.results || []).map((q) => {
          let options = null;
          if (q.options) {
            try { options = JSON.parse(q.options); } catch (e) { options = q.options.split(','); }
          }
          return {
            ...q,
            required: Boolean(q.required),
            is_custom: Boolean(q.is_custom),
            has_remark: Boolean(q.has_remark),
            options
          };
        });
        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      }

      if (path === '/api/advocate-questions' && method === 'POST') {
        const body = await request.json();
        const maxOrder = (await env.DB.prepare('SELECT MAX(order_num) as m FROM advocate_questions').first())?.m || 0;
        const orderNum = body.order_num ? Number(body.order_num) : (maxOrder + 1);
        const key = body.key || `adv_custom_${Date.now()}`;
        const optionsStr = body.options ? (typeof body.options === 'string' ? body.options : JSON.stringify(body.options)) : null;
        const cleanLabel = (body.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
        const numberedLabel = `${orderNum}) ${cleanLabel}`;
        const hasRemark = body.has_remark ? 1 : 0;

        await env.DB.prepare(`
          INSERT INTO advocate_questions (order_num, key, label, placeholder, type, options, required, note, is_custom, has_remark)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).bind(orderNum, key, numberedLabel, body.placeholder || '', body.type || 'text', optionsStr, body.required ? 1 : 0, body.note || '', hasRemark).run();

        const created = await env.DB.prepare('SELECT * FROM advocate_questions WHERE key = ?').bind(key).first();
        return new Response(JSON.stringify({
          success: true,
          data: {
            ...created,
            required: Boolean(created?.required),
            is_custom: true,
            has_remark: Boolean(created?.has_remark)
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/advocate-questions/') && method === 'PUT') {
        const id = path.split('/')[3];
        const body = await request.json();
        const existing = await env.DB.prepare('SELECT * FROM advocate_questions WHERE id = ?').bind(id).first();
        if (!existing) {
          return new Response(JSON.stringify({ success: false, message: 'Question not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const newOrderNum = (body.order_num !== undefined && !isNaN(body.order_num)) ? Number(body.order_num) : existing.order_num;
        let newLabel = body.label !== undefined ? body.label.trim() : existing.label;
        if (body.label) {
          const clean = body.label.replace(/^\d+[\)\.\-]\s*/, '').trim();
          newLabel = `${newOrderNum}) ${clean}`;
        }
        const newPlaceholder = body.placeholder !== undefined ? body.placeholder.trim() : existing.placeholder;
        const newType = body.type || existing.type;
        const newRequired = body.required !== undefined ? (body.required ? 1 : 0) : existing.required;
        const newNote = body.note !== undefined ? body.note.trim() : existing.note;
        const newHasRemark = body.has_remark !== undefined ? (body.has_remark ? 1 : 0) : (existing.has_remark ? 1 : 0);
        let optionsStr = existing.options;
        if (body.options !== undefined) {
          optionsStr = Array.isArray(body.options) ? JSON.stringify(body.options) : (typeof body.options === 'string' ? JSON.stringify(body.options.split(',').map((s) => s.trim()).filter(Boolean)) : null);
        }

        await env.DB.prepare(`
          UPDATE advocate_questions SET
            order_num = ?, label = ?, placeholder = ?, type = ?, options = ?, required = ?, note = ?, has_remark = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(newOrderNum, newLabel, newPlaceholder, newType, optionsStr, newRequired, newNote, newHasRemark, id).run();

        const updated = await env.DB.prepare('SELECT * FROM advocate_questions WHERE id = ?').bind(id).first();
        return new Response(JSON.stringify({
          success: true,
          message: 'Advocate question updated successfully',
          data: { ...updated, has_remark: Boolean(updated?.has_remark), required: Boolean(updated?.required) }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/advocate-questions/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM advocate_questions WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Advocate question deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path === '/api/advocate-questions/reorder' && method === 'POST') {
        const { items } = await request.json();
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.label) {
              await env.DB.prepare('UPDATE advocate_questions SET order_num = ?, label = ? WHERE id = ?').bind(Number(item.order_num), item.label, item.id).run();
            } else {
              await env.DB.prepare('UPDATE advocate_questions SET order_num = ? WHERE id = ?').bind(Number(item.order_num), item.id).run();
            }
          }
        }
        const updatedList = await env.DB.prepare('SELECT * FROM advocate_questions ORDER BY order_num ASC, id ASC').all();
        return new Response(JSON.stringify({ success: true, message: 'Reordered successfully', data: updatedList.results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path === '/api/advocate-questions/reset' && method === 'POST') {
        await env.DB.prepare('DELETE FROM advocate_questions').run();
        const defaultAdvQueries = [
          [1, 'advocate_reg_no', '1) Bar Council / Enrollment No.', 'e.g. D/1234/2015', 'text', null, 1, 'Note:- Unique advocate enrollment / bar registration number.', 0],
          [2, 'name', '2) Advocate Full Name', 'e.g. Adv. Rajesh Sharma', 'text', null, 1, 'Note:- Enter full name of the advocate.', 0],
          [3, 'contact_number', '3) Contact / WhatsApp Number', 'e.g. +91 9876543210', 'text', null, 1, 'Note:- 10-digit mobile number.', 0],
          [4, 'primary_court', '4) Primary Court of Practice', 'Select primary court', 'choice_text', '["District Court","Sessions Court","High Court","Supreme Court","Magistrate Court (CMM / ACMM)","Special / NDPS Court","Other"]', 1, 'Note:- Main court where advocate practices regularly.', 0],
          [5, 'practice_experience_years', '5) Years of Legal Practice', 'e.g. 5, 10, 15', 'number', null, 1, 'Note:- Input numeric years of experience.', 0],
          [6, 'case_specialization', '6) Legal Specialization', 'Select legal specialization', 'multi-select', '["Criminal Defense","Bail Applications","NDPS Act (Narcotics)","POCSO & Women Safety","Cheating & Fraud (IPC 420)","Murder / Attempt (IPC 302/307)","Cyber Crime","Civil & Property","Constitutional / High Court Writs","Other"]', 1, 'Note:- Select one or more legal fields.', 0],
          [7, 'regularly_handles_undertrial_cases', '7) Regularly handles Jail / Undertrial Prisoner Cases?', 'Yes or No', 'yesno', '["Yes","No"]', 1, 'Note:- Pls select Yes or No.', 0],
          [8, 'provides_legal_aid_dlsa', '8) Empanelled with DLSA / Legal Aid?', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No.', 0],
          [9, 'transparent_fee_structure', '9) Provides transparent upfront fee agreement to clients?', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No.', 0],
          [10, 'average_case_duration', '10) Average duration to secure Bail / Trial relief', 'e.g. 1 Month, 3 Months, 6 Months', 'text', null, 0, 'Note:- Approximate timeline.', 0],
          [11, 'parivi_assistance_knowledge', '11) Knowledge of Prison Parivi & Document tracking process?', 'Yes or No', 'yesno', '["Yes","No"]', 0, 'Note:- Pls select Yes or No.', 0],
          [12, 'remarks', '12) Remarks / Suggestions for Jail Legal System', 'Enter observations, suggestions, feedback...', 'textarea', null, 0, 'Note:- General observations.', 0]
        ];
        for (const q of defaultAdvQueries) {
          await env.DB.prepare(`
            INSERT INTO advocate_questions (order_num, key, label, placeholder, type, options, required, note, is_custom)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(...q).run();
        }
        const resetList = await env.DB.prepare('SELECT * FROM advocate_questions ORDER BY order_num ASC, id ASC').all();
        return new Response(JSON.stringify({ success: true, message: 'Reset to default advocate questions', data: resetList.results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================
      // 15. Advocate Surveys CRUD
      // ==========================================
      if (path.startsWith('/api/advocate-survey/check-reg') && method === 'GET') {
        const regNo = (url.searchParams.get('no') || url.searchParams.get('regNo') || '').trim();
        const existing = await env.DB.prepare(
          'SELECT id, advocate_reg_no, name FROM advocate_surveys WHERE LOWER(TRIM(advocate_reg_no)) = LOWER(TRIM(?))'
        ).bind(regNo).first();

        return new Response(
          JSON.stringify({
            exists: !!existing,
            message: existing ? `Advocate Reg No. "${regNo}" already exists!` : 'Available',
            survey: existing || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (path === '/api/advocate-survey/list' && method === 'GET') {
        const q = url.searchParams.get('q') || '';
        let result;
        if (q) {
          const searchPattern = `%${q}%`;
          result = await env.DB.prepare(
            `SELECT * FROM advocate_surveys WHERE advocate_reg_no LIKE ? OR name LIKE ? OR contact_number LIKE ? OR primary_court LIKE ? ORDER BY id DESC`
          ).bind(searchPattern, searchPattern, searchPattern, searchPattern).all();
        } else {
          result = await env.DB.prepare('SELECT * FROM advocate_surveys ORDER BY id DESC').all();
        }

        const data = (result.results || []).map((r) => {
          let custom = {};
          if (r.custom_answers) {
            try { custom = JSON.parse(r.custom_answers); } catch (e) {}
          }
          return { ...r, ...custom };
        });

        return new Response(
          JSON.stringify({ success: true, count: data.length, data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
        );
      }

      if (path.startsWith('/api/advocate-survey/') && method === 'GET' && !path.includes('check-reg') && !path.includes('list')) {
        const id = path.split('/')[3];
        const survey = await env.DB.prepare('SELECT * FROM advocate_surveys WHERE id = ?').bind(id).first();
        if (!survey) {
          return new Response(JSON.stringify({ success: false, message: 'Advocate survey not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        let custom = {};
        if (survey.custom_answers) {
          try { custom = JSON.parse(survey.custom_answers); } catch (e) {}
        }
        return new Response(JSON.stringify({ success: true, data: { ...survey, ...custom } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path === '/api/advocate-survey/add' && method === 'POST') {
        const d = await request.json();
        if (d.advocate_reg_no && d.advocate_reg_no.trim()) {
          const existing = await env.DB.prepare(
            'SELECT id FROM advocate_surveys WHERE LOWER(TRIM(advocate_reg_no)) = LOWER(TRIM(?))'
          ).bind(d.advocate_reg_no.trim()).first();

          if (existing) {
            return new Response(
              JSON.stringify({ success: false, message: `Advocate Reg No. "${d.advocate_reg_no}" already exists!` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const customJson = extractAdvocateCustomAnswers(d);

        try {
          await env.DB.prepare(`
            INSERT INTO advocate_surveys (
              advocate_reg_no, name, contact_number, office_address,
              primary_court, practice_experience_years, case_specialization,
              regularly_handles_undertrial_cases, provides_legal_aid_dlsa,
              transparent_fee_structure, average_case_duration,
              parivi_assistance_knowledge, remarks, custom_answers
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            d.advocate_reg_no || '', d.name || '', d.contact_number || '', d.office_address || '',
            d.primary_court || '', Number(d.practice_experience_years) || 0,
            Array.isArray(d.case_specialization) ? d.case_specialization.join(', ') : (d.case_specialization || ''),
            d.regularly_handles_undertrial_cases || '', d.provides_legal_aid_dlsa || '',
            d.transparent_fee_structure || '', d.average_case_duration || '',
            d.parivi_assistance_knowledge || '', d.remarks || '', customJson
          ).run();
        } catch (insertErr) {
          console.error('Insert error in worker for advocate_surveys:', insertErr);
        }

        const newId = Date.now();
        let savedCustom = {};
        try { savedCustom = JSON.parse(customJson || '{}'); } catch (e) {}

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Advocate survey saved successfully',
            data: { ...d, id: newId, ...savedCustom, created_at: new Date().toISOString() }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (path.startsWith('/api/advocate-survey/') && method === 'PUT') {
        const id = path.split('/')[3];
        const d = await request.json();

        const existing = await env.DB.prepare('SELECT * FROM advocate_surveys WHERE id = ?').bind(id).first();
        let existingCustom = {};
        if (existing?.custom_answers) {
          try { existingCustom = JSON.parse(existing.custom_answers); } catch (e) {}
        }
        const customJson = extractAdvocateCustomAnswers(d, existingCustom);

        try {
          await env.DB.prepare(`
            UPDATE advocate_surveys SET
              advocate_reg_no = ?, name = ?, contact_number = ?, office_address = ?,
              primary_court = ?, practice_experience_years = ?, case_specialization = ?,
              regularly_handles_undertrial_cases = ?, provides_legal_aid_dlsa = ?,
              transparent_fee_structure = ?, average_case_duration = ?,
              parivi_assistance_knowledge = ?, remarks = ?, custom_answers = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(
            d.advocate_reg_no || '', d.name || '', d.contact_number || '', d.office_address || '',
            d.primary_court || '', Number(d.practice_experience_years) || 0,
            Array.isArray(d.case_specialization) ? d.case_specialization.join(', ') : (d.case_specialization || ''),
            d.regularly_handles_undertrial_cases || '', d.provides_legal_aid_dlsa || '',
            d.transparent_fee_structure || '', d.average_case_duration || '',
            d.parivi_assistance_knowledge || '', d.remarks || '', customJson,
            id
          ).run();
        } catch (e) {
          console.error('Update error in worker for advocate_surveys:', e);
        }

        const numId = Number(id) || id;
        let updatedCustom = {};
        try { updatedCustom = JSON.parse(customJson || '{}'); } catch (e) {}

        const finalData = {
          ...(existing || {}),
          ...d,
          ...updatedCustom,
          id: numId,
          updated_at: new Date().toISOString()
        };
        return new Response(JSON.stringify({ success: true, message: 'Advocate survey updated successfully', data: finalData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/advocate-survey/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM advocate_surveys WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Advocate survey deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================
      // 16. Web Review Module APIs
      // ==========================================
      if (path === '/api/web-review/urls' && method === 'GET') {
        const list = await env.DB.prepare('SELECT * FROM web_review_urls ORDER BY id DESC').all();
        return new Response(JSON.stringify({ success: true, data: list.results || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      }

      if (path === '/api/web-review/urls' && method === 'POST') {
        const { name, url: websiteUrl } = await request.json();
        const cleanName = String(name || '').trim();
        const cleanUrl = String(websiteUrl || '').trim();
        if (!cleanName || !cleanUrl) {
          return new Response(JSON.stringify({ success: false, message: 'Website name and URL are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        await env.DB.prepare('INSERT INTO web_review_urls (name, url) VALUES (?, ?)').bind(cleanName, cleanUrl).run();
        const created = await env.DB.prepare('SELECT * FROM web_review_urls WHERE name = ? AND url = ? ORDER BY id DESC').bind(cleanName, cleanUrl).first();
        return new Response(JSON.stringify({ success: true, message: 'URL added successfully', data: created }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/web-review/urls/') && method === 'PUT') {
        const id = path.split('/')[4];
        const { name, url: websiteUrl } = await request.json();
        const cleanName = String(name || '').trim();
        const cleanUrl = String(websiteUrl || '').trim();
        await env.DB.prepare('UPDATE web_review_urls SET name = ?, url = ? WHERE id = ?').bind(cleanName, cleanUrl, id).run();
        return new Response(JSON.stringify({ success: true, message: 'URL updated successfully', data: { id: Number(id), name: cleanName, url: cleanUrl } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/web-review/urls/') && method === 'DELETE') {
        const id = path.split('/')[4];
        await env.DB.prepare('DELETE FROM web_review_urls WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'URL deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path === '/api/web-review/list' && method === 'GET') {
        const q = url.searchParams.get('q');
        let query = 'SELECT * FROM web_reviews ORDER BY id DESC';
        let list;
        if (q && q.trim()) {
          const term = `%${q.trim()}%`;
          list = await env.DB.prepare(
            'SELECT * FROM web_reviews WHERE website_name LIKE ? OR url LIKE ? OR reviews LIKE ? ORDER BY id DESC'
          ).bind(term, term, term).all();
        } else {
          list = await env.DB.prepare(query).all();
        }
        const records = (list.results || []).map((r) => {
          let parsedReviews = [];
          try {
            parsedReviews = typeof r.reviews === 'string' ? JSON.parse(r.reviews) : (r.reviews || []);
          } catch (e) {
            parsedReviews = r.reviews ? [r.reviews] : [];
          }
          return { ...r, reviews: parsedReviews };
        });
        return new Response(JSON.stringify({ success: true, count: records.length, data: records }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      }

      if (path === '/api/web-review/add' && method === 'POST') {
        const body = await request.json();
        const website_name = String(body.website_name || '').trim();
        const website_url = String(body.url || '').trim();
        const rawReviews = body.reviews;
        let reviewsArray = Array.isArray(rawReviews) ? rawReviews : [rawReviews];
        reviewsArray = reviewsArray.map((r) => String(r || '').trim()).filter(Boolean);

        if (!website_name) {
          return new Response(JSON.stringify({ success: false, message: 'Website name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (reviewsArray.length === 0) {
          return new Response(JSON.stringify({ success: false, message: 'At least one review input is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const reviewsJson = JSON.stringify(reviewsArray);
        await env.DB.prepare(
          'INSERT INTO web_reviews (url_id, website_name, url, reviews) VALUES (?, ?, ?, ?)'
        ).bind(body.url_id || null, website_name, website_url, reviewsJson).run();

        const created = await env.DB.prepare('SELECT * FROM web_reviews ORDER BY id DESC LIMIT 1').first();
        return new Response(JSON.stringify({
          success: true,
          message: 'Web Review recorded successfully',
          data: { ...created, reviews: reviewsArray }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/web-review/') && method === 'PUT') {
        const id = path.split('/')[3];
        const body = await request.json();
        const website_name = String(body.website_name || '').trim();
        const website_url = String(body.url || '').trim();
        let reviewsArray = Array.isArray(body.reviews) ? body.reviews : [body.reviews];
        reviewsArray = reviewsArray.map((r) => String(r || '').trim()).filter(Boolean);

        await env.DB.prepare(
          'UPDATE web_reviews SET website_name = ?, url = ?, reviews = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(website_name, website_url, JSON.stringify(reviewsArray), id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Review updated successfully',
          data: { id: Number(id), website_name, url: website_url, reviews: reviewsArray }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/web-review/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM web_reviews WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Review deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================
      // 17. Raasta Function Module APIs
      // ==========================================
      if (path === '/api/raasta/portals' && method === 'GET') {
        const list = await env.DB.prepare('SELECT * FROM raasta_portals ORDER BY name ASC').all();
        return new Response(JSON.stringify({ success: true, data: list.results || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      }

      if (path === '/api/raasta/portals' && method === 'POST') {
        const { name } = await request.json();
        const cleanName = String(name || '').trim();
        if (!cleanName) {
          return new Response(JSON.stringify({ success: false, message: 'Portal name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        await env.DB.prepare('INSERT OR IGNORE INTO raasta_portals (name) VALUES (?)').bind(cleanName).run();
        const created = await env.DB.prepare('SELECT * FROM raasta_portals WHERE name = ?').bind(cleanName).first();
        return new Response(JSON.stringify({ success: true, message: 'Portal added successfully', data: created }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/raasta/portals/') && method === 'PUT') {
        const id = path.split('/')[4];
        const { name } = await request.json();
        const cleanName = String(name || '').trim();
        await env.DB.prepare('UPDATE raasta_portals SET name = ? WHERE id = ?').bind(cleanName, id).run();
        return new Response(JSON.stringify({ success: true, message: 'Portal updated successfully', data: { id: Number(id), name: cleanName } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/raasta/portals/') && method === 'DELETE') {
        const id = path.split('/')[4];
        await env.DB.prepare('DELETE FROM raasta_portals WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Portal deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path === '/api/raasta/list' && method === 'GET') {
        const q = url.searchParams.get('q');
        const portal = url.searchParams.get('portal');
        let query = 'SELECT * FROM raasta_functions WHERE 1=1';
        const params = [];
        if (portal && portal.trim()) {
          query += ' AND portal_name = ?';
          params.push(portal.trim());
        }
        if (q && q.trim()) {
          query += ' AND (portal_name LIKE ? OR function_name LIKE ? OR details LIKE ?)';
          const term = `%${q.trim()}%`;
          params.push(term, term, term);
        }
        query += ' ORDER BY id DESC';
        const stmt = params.length > 0 ? env.DB.prepare(query).bind(...params) : env.DB.prepare(query);
        const list = await stmt.all();
        return new Response(JSON.stringify({ success: true, count: (list.results || []).length, data: list.results || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      }

      if (path === '/api/raasta/add' && method === 'POST') {
        const { portal_name, function_name, details } = await request.json();
        const cleanPortal = String(portal_name || '').trim();
        const cleanFunc = String(function_name || '').trim();
        const cleanDetails = String(details || '').trim();

        if (!cleanPortal || !cleanFunc) {
          return new Response(JSON.stringify({ success: false, message: 'Portal name and Function name are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.DB.prepare(
          'INSERT INTO raasta_functions (portal_name, function_name, details) VALUES (?, ?, ?)'
        ).bind(cleanPortal, cleanFunc, cleanDetails).run();

        const created = await env.DB.prepare('SELECT * FROM raasta_functions ORDER BY id DESC LIMIT 1').first();
        return new Response(JSON.stringify({ success: true, message: 'Function added successfully', data: created }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/raasta/') && method === 'PUT') {
        const id = path.split('/')[3];
        const { portal_name, function_name, details } = await request.json();
        const cleanPortal = String(portal_name || '').trim();
        const cleanFunc = String(function_name || '').trim();
        const cleanDetails = String(details || '').trim();

        await env.DB.prepare(
          'UPDATE raasta_functions SET portal_name = ?, function_name = ?, details = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(cleanPortal, cleanFunc, cleanDetails, id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Function updated successfully',
          data: { id: Number(id), portal_name: cleanPortal, function_name: cleanFunc, details: cleanDetails }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/raasta/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM raasta_functions WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Function deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================
      // 18. Work Role Module APIs
      // ==========================================
      if (path === '/api/work-roles/roles' && method === 'GET') {
        const list = await env.DB.prepare('SELECT * FROM work_roles ORDER BY name ASC').all();
        return new Response(JSON.stringify({ success: true, data: list.results || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      }

      if (path === '/api/work-roles/roles' && method === 'POST') {
        const { name } = await request.json();
        const cleanName = String(name || '').trim();
        if (!cleanName) {
          return new Response(JSON.stringify({ success: false, message: 'Role name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        await env.DB.prepare('INSERT OR IGNORE INTO work_roles (name) VALUES (?)').bind(cleanName).run();
        const created = await env.DB.prepare('SELECT * FROM work_roles WHERE name = ?').bind(cleanName).first();
        return new Response(JSON.stringify({ success: true, message: 'Role added successfully', data: created }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/work-roles/roles/') && method === 'PUT') {
        const id = path.split('/')[4];
        const { name } = await request.json();
        const cleanName = String(name || '').trim();
        await env.DB.prepare('UPDATE work_roles SET name = ? WHERE id = ?').bind(cleanName, id).run();
        return new Response(JSON.stringify({ success: true, message: 'Role updated successfully', data: { id: Number(id), name: cleanName } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/work-roles/roles/') && method === 'DELETE') {
        const id = path.split('/')[4];
        await env.DB.prepare('DELETE FROM work_roles WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Role deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path === '/api/work-roles/list' && method === 'GET') {
        const q = url.searchParams.get('q');
        const role = url.searchParams.get('role');
        let query = 'SELECT * FROM work_role_entries WHERE 1=1';
        const params = [];
        if (role && role.trim()) {
          query += ' AND role_name = ?';
          params.push(role.trim());
        }
        if (q && q.trim()) {
          query += ' AND (role_name LIKE ? OR work_name LIKE ?)';
          const term = `%${q.trim()}%`;
          params.push(term, term);
        }
        query += ' ORDER BY id DESC';
        const stmt = params.length > 0 ? env.DB.prepare(query).bind(...params) : env.DB.prepare(query);
        const list = await stmt.all();
        return new Response(JSON.stringify({ success: true, count: (list.results || []).length, data: list.results || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      }

      if (path === '/api/work-roles/add' && method === 'POST') {
        const { role_name, work_name } = await request.json();
        const cleanRole = String(role_name || '').trim();
        const cleanWork = String(work_name || '').trim();

        if (!cleanRole || !cleanWork) {
          return new Response(JSON.stringify({ success: false, message: 'Role name and Work name are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.DB.prepare(
          'INSERT INTO work_role_entries (role_name, work_name) VALUES (?, ?)'
        ).bind(cleanRole, cleanWork).run();

        const created = await env.DB.prepare('SELECT * FROM work_role_entries ORDER BY id DESC LIMIT 1').first();
        return new Response(JSON.stringify({ success: true, message: 'Work entry added successfully', data: created }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/work-roles/') && method === 'PUT') {
        const id = path.split('/')[3];
        const { role_name, work_name } = await request.json();
        const cleanRole = String(role_name || '').trim();
        const cleanWork = String(work_name || '').trim();

        await env.DB.prepare(
          'UPDATE work_role_entries SET role_name = ?, work_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(cleanRole, cleanWork, id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Work entry updated successfully',
          data: { id: Number(id), role_name: cleanRole, work_name: cleanWork }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/api/work-roles/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM work_role_entries WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Work entry deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================================
      // NEW PRISONER SURVEY MODULE ENDPOINTS (/api/new-survey / /api/new-prisoner)
      // ==========================================================

      // Check UT/CT uniqueness in new_prisoner_surveys
      if ((path.startsWith('/api/new-survey/check-utct') || path.startsWith('/api/new-prisoner/check-utct')) && method === 'GET') {
        const utctNo = (url.searchParams.get('no') || url.searchParams.get('utctNo') || decodeURIComponent(path.split('/')[4] || '')).trim();
        try {
          await env.DB.prepare(`
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
          `).run();
        } catch (e) {}

        const existing = await env.DB.prepare(
          'SELECT id, utct_no, name FROM new_prisoner_surveys WHERE LOWER(TRIM(utct_no)) = LOWER(TRIM(?))'
        ).bind(utctNo).first();

        return new Response(
          JSON.stringify({
            exists: !!existing,
            message: existing ? `UT/CT No. "${utctNo}" already exists in New Prisoner records!` : 'Available',
            survey: existing || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // List New Prisoner Surveys
      if ((path === '/api/new-survey/list' || path === '/api/new-prisoner/list') && method === 'GET') {
        const q = url.searchParams.get('q') || '';
        try {
          await env.DB.prepare(`
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
          `).run();
        } catch (e) {}

        let result;
        if (q) {
          const searchPattern = `%${q}%`;
          result = await env.DB.prepare(
            `SELECT * FROM new_prisoner_surveys WHERE utct_no LIKE ? OR name LIKE ? OR case_type LIKE ? ORDER BY id DESC`
          ).bind(searchPattern, searchPattern, searchPattern).all();
        } else {
          result = await env.DB.prepare('SELECT * FROM new_prisoner_surveys ORDER BY id DESC').all();
        }

        const data = (result.results || []).map((r) => {
          let custom = {};
          if (r.custom_answers) {
            try { custom = JSON.parse(r.custom_answers); } catch (e) {}
          }
          let advocates_details = [];
          if (r.advocates_details) {
            try {
              advocates_details = typeof r.advocates_details === 'string' ? JSON.parse(r.advocates_details) : r.advocates_details;
            } catch (e) {
              advocates_details = [];
            }
          }
          if ((!Array.isArray(advocates_details) || advocates_details.length === 0) && custom.advocates_details) {
            try {
              advocates_details = typeof custom.advocates_details === 'string' ? JSON.parse(custom.advocates_details) : custom.advocates_details;
            } catch (e) {}
          }
          delete custom.advocates_details;
          return { ...r, ...custom, advocates_details: Array.isArray(advocates_details) ? advocates_details : [] };
        });

        return new Response(
          JSON.stringify({ success: true, count: data.length, data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
        );
      }

      // Get single New Prisoner Survey by ID
      if ((path.startsWith('/api/new-survey/') || path.startsWith('/api/new-prisoner/')) && method === 'GET' && !path.includes('check-utct') && !path.includes('list')) {
        const id = path.split('/')[3];
        const survey = await env.DB.prepare('SELECT * FROM new_prisoner_surveys WHERE id = ?').bind(id).first();
        if (!survey) {
          return new Response(JSON.stringify({ success: false, message: 'Survey record not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        let custom = {};
        if (survey.custom_answers) {
          try { custom = JSON.parse(survey.custom_answers); } catch (e) {}
        }
        let advocates_details = [];
        if (survey.advocates_details) {
          try {
            advocates_details = typeof survey.advocates_details === 'string' ? JSON.parse(survey.advocates_details) : survey.advocates_details;
          } catch (e) {
            advocates_details = [];
          }
        }
        delete custom.advocates_details;
        return new Response(JSON.stringify({ success: true, data: { ...survey, ...custom, advocates_details: Array.isArray(advocates_details) ? advocates_details : [] } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Add New Prisoner Survey
      if ((path === '/api/new-survey/add' || path === '/api/new-prisoner/add') && method === 'POST') {
        const d = await request.json();

        // 1. Ensure table exists in case D1 migration was pending
        try {
          await env.DB.prepare(`
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
          `).run();
        } catch (tblErr) {}

        let utctNo = String(d.utct_no || '').trim();
        let prisonerName = String(d.name || '').trim();

        // Fallback: If utct_no was not provided under 'utct_no', find first non-empty field
        if (!utctNo && d && typeof d === 'object') {
          for (const [k, v] of Object.entries(d)) {
            if (v && typeof v === 'string' && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(k)) {
              utctNo = v.trim();
              break;
            }
          }
        }

        // Fallback: If name was not provided under 'name', find second non-empty field
        if (!prisonerName && d && typeof d === 'object') {
          let foundUtct = false;
          for (const [k, v] of Object.entries(d)) {
            if (v && typeof v === 'string' && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(k)) {
              if (!foundUtct && v.trim() === utctNo) {
                foundUtct = true;
                continue;
              }
              prisonerName = v.trim();
              break;
            }
          }
        }

        if (!utctNo) {
          return new Response(
            JSON.stringify({ success: false, message: 'UT/CT Number is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (!prisonerName) {
          prisonerName = 'Prisoner';
        }

        const existing = await env.DB.prepare(
          'SELECT id FROM new_prisoner_surveys WHERE LOWER(TRIM(utct_no)) = LOWER(TRIM(?))'
        ).bind(utctNo).first();

        if (existing) {
          return new Response(
            JSON.stringify({ success: false, message: `UT/CT No. "${utctNo}" already exists in New Prisoner records!` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const customJson = extractCustomAnswers(d);
        const advDetailsJson = typeof d.advocates_details === 'string' ? d.advocates_details : JSON.stringify(d.advocates_details || []);

        try {
          await env.DB.prepare(`
            INSERT INTO new_prisoner_surveys (
              utct_no, name, case_type, total_cases, case_duration,
              total_advocates_hired, times_in_jail, advocate_name_number,
              advocates_details,
              known_unknown_advocate, high_court_advocate, advocate_payment_advance,
              first_advocate_by_io, know_case_process, lawyer_collects_details_evidence,
              know_fees_reasonable, complete_fees_total_initially,
              work_transparency_tracking, know_legal_step_correct,
              case_prolonged_expensive, pairvi_knowledge_reason,
              court_docs_fees_timing, know_trustworthy_platform,
              priority_money_vs_release, prisoner_psychologic_survey,
              custom_answers
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            utctNo, prisonerName, Array.isArray(d.case_type) ? d.case_type.join(', ') : (d.case_type || ''),
            Number(d.total_cases) || 0, d.case_duration || '', Number(d.total_advocates_hired) || 0,
            Number(d.times_in_jail) || 0, d.advocate_name_number || '', advDetailsJson,
            d.known_unknown_advocate || '', d.high_court_advocate || '', d.advocate_payment_advance || '',
            d.first_advocate_by_io || '', d.know_case_process || '', d.lawyer_collects_details_evidence || '',
            d.know_fees_reasonable || '', d.complete_fees_total_initially || '', d.work_transparency_tracking || '',
            d.know_legal_step_correct || '', d.case_prolonged_expensive || '', d.pairvi_knowledge_reason || '',
            d.court_docs_fees_timing || '', d.know_trustworthy_platform || '', d.priority_money_vs_release || '',
            d.prisoner_psychologic_survey || '', customJson
          ).run();
        } catch (insertErr) {
          console.error('Insert new_prisoner_surveys error:', insertErr);
          return new Response(
            JSON.stringify({ success: false, message: `Database insert failed: ${insertErr.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const newId = Date.now();
        let savedCustom = {};
        try { savedCustom = JSON.parse(customJson || '{}'); } catch (e) {}
        let savedAdvDetails = [];
        try { savedAdvDetails = Array.isArray(d.advocates_details) ? d.advocates_details : JSON.parse(d.advocates_details || '[]'); } catch (e) {}

        return new Response(
          JSON.stringify({
            success: true,
            message: 'New Prisoner record saved successfully',
            data: { ...d, id: newId, utct_no: utctNo, name: prisonerName, advocates_details: savedAdvDetails, ...savedCustom, created_at: new Date().toISOString() }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update New Prisoner Survey
      if ((path.startsWith('/api/new-survey/') || path.startsWith('/api/new-prisoner/')) && method === 'PUT') {
        const id = path.split('/')[3];
        const d = await request.json();

        const existing = await env.DB.prepare('SELECT * FROM new_prisoner_surveys WHERE id = ?').bind(id).first();
        let existingCustom = {};
        if (existing?.custom_answers) {
          try { existingCustom = JSON.parse(existing.custom_answers); } catch (e) {}
        }
        const customJson = extractCustomAnswers(d, existingCustom);
        const advDetailsJson = typeof d.advocates_details === 'string' ? d.advocates_details : JSON.stringify(d.advocates_details || []);

        await env.DB.prepare(`
          UPDATE new_prisoner_surveys SET
            utct_no = ?, name = ?, case_type = ?, total_cases = ?, case_duration = ?,
            total_advocates_hired = ?, times_in_jail = ?, advocate_name_number = ?,
            advocates_details = ?,
            known_unknown_advocate = ?, high_court_advocate = ?, advocate_payment_advance = ?,
            first_advocate_by_io = ?, know_case_process = ?, lawyer_collects_details_evidence = ?,
            know_fees_reasonable = ?, complete_fees_total_initially = ?,
            work_transparency_tracking = ?, know_legal_step_correct = ?,
            case_prolonged_expensive = ?, pairvi_knowledge_reason = ?,
            court_docs_fees_timing = ?, know_trustworthy_platform = ?,
            priority_money_vs_release = ?, prisoner_psychologic_survey = ?,
            custom_answers = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(
          d.utct_no, d.name, Array.isArray(d.case_type) ? d.case_type.join(', ') : (d.case_type || ''),
          Number(d.total_cases) || 0, d.case_duration || '', Number(d.total_advocates_hired) || 0,
          Number(d.times_in_jail) || 0, d.advocate_name_number || '', advDetailsJson,
          d.known_unknown_advocate || '', d.high_court_advocate || '', d.advocate_payment_advance || '',
          d.first_advocate_by_io || '', d.know_case_process || '', d.lawyer_collects_details_evidence || '',
          d.know_fees_reasonable || '', d.complete_fees_total_initially || '', d.work_transparency_tracking || '',
          d.know_legal_step_correct || '', d.case_prolonged_expensive || '', d.pairvi_knowledge_reason || '',
          d.court_docs_fees_timing || '', d.know_trustworthy_platform || '', d.priority_money_vs_release || '',
          d.prisoner_psychologic_survey || '', customJson,
          id
        ).run();

        const numId = Number(id) || id;
        let updatedAdvDetails = [];
        try { updatedAdvDetails = Array.isArray(d.advocates_details) ? d.advocates_details : JSON.parse(d.advocates_details || '[]'); } catch (e) {}
        let updatedCustom = {};
        try { updatedCustom = JSON.parse(customJson || '{}'); } catch (e) {}

        const finalData = {
          ...(existing || {}),
          ...d,
          advocates_details: updatedAdvDetails,
          ...updatedCustom,
          id: numId,
          updated_at: new Date().toISOString()
        };
        return new Response(JSON.stringify({ success: true, message: 'Updated successfully', data: finalData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Delete New Prisoner Survey
      if ((path.startsWith('/api/new-survey/') || path.startsWith('/api/new-prisoner/')) && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM new_prisoner_surveys WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================================
      // NEW PRISONER QUESTIONS ENDPOINTS (/api/new-prisoner-questions / /api/new-questions)
      // ==========================================================
      if ((path === '/api/new-prisoner-questions' || path === '/api/new-questions') && method === 'GET') {
        try {
          const list = await env.DB.prepare('SELECT * FROM new_prisoner_questions ORDER BY order_num ASC, id ASC').all();
          const data = (list.results || []).map((q) => {
            let options = null;
            if (q.options) {
              try { options = JSON.parse(q.options); } catch (e) { options = q.options.split(','); }
            }
            return {
              ...q,
              required: Boolean(q.required),
              is_custom: Boolean(q.is_custom),
              has_remark: Boolean(q.has_remark),
              options
            };
          });
          return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, message: e.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      if ((path === '/api/new-prisoner-questions' || path === '/api/new-questions') && method === 'POST') {
        const body = await request.json();
        if (!body.label || !body.label.trim()) {
          return new Response(JSON.stringify({ success: false, message: 'Question label is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const maxOrder = (await env.DB.prepare('SELECT MAX(order_num) as m FROM new_prisoner_questions').first())?.m || 0;
        const orderNum = (body.order_num !== undefined && !isNaN(body.order_num)) ? Number(body.order_num) : (maxOrder + 1);
        const key = body.key || `custom_${Date.now()}`;
        let optionsStr = null;
        if (body.options) {
          optionsStr = Array.isArray(body.options) ? JSON.stringify(body.options) : JSON.stringify(String(body.options).split(',').map((s) => s.trim()).filter(Boolean));
        }

        const hasRemark = body.has_remark ? 1 : 0;
        await env.DB.prepare(`
          INSERT INTO new_prisoner_questions (order_num, key, label, placeholder, type, options, required, note, is_custom, has_remark)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).bind(orderNum, key, body.label.trim(), body.placeholder || '', body.type || 'text', optionsStr, body.required ? 1 : 0, body.note || '', hasRemark).run();

        const created = await env.DB.prepare('SELECT * FROM new_prisoner_questions WHERE key = ?').bind(key).first();
        let options = null;
        if (created?.options) {
          try { options = JSON.parse(created.options); } catch (e) { options = created.options.split(','); }
        }
        return new Response(JSON.stringify({
          success: true,
          message: 'Question added successfully',
          data: {
            ...created,
            required: Boolean(created?.required),
            is_custom: true,
            has_remark: Boolean(created?.has_remark),
            options
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if ((path.startsWith('/api/new-prisoner-questions/') || path.startsWith('/api/new-questions/')) && method === 'PUT') {
        const id = path.split('/')[3];
        const body = await request.json();
        const existing = await env.DB.prepare('SELECT * FROM new_prisoner_questions WHERE id = ?').bind(id).first();
        if (!existing) {
          return new Response(JSON.stringify({ success: false, message: 'Question not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let optionsStr = existing.options;
        if (body.options !== undefined) {
          optionsStr = Array.isArray(body.options) ? JSON.stringify(body.options) : JSON.stringify(String(body.options).split(',').map((s) => s.trim()).filter(Boolean));
        }

        const orderNum = (body.order_num !== undefined && !isNaN(body.order_num)) ? Number(body.order_num) : existing.order_num;
        const label = body.label !== undefined ? body.label.trim() : existing.label;
        const placeholder = body.placeholder !== undefined ? body.placeholder : existing.placeholder;
        const type = body.type !== undefined ? body.type : existing.type;
        const required = body.required !== undefined ? (body.required ? 1 : 0) : existing.required;
        const note = body.note !== undefined ? body.note : existing.note;
        const hasRemark = body.has_remark !== undefined ? (body.has_remark ? 1 : 0) : existing.has_remark;

        await env.DB.prepare(`
          UPDATE new_prisoner_questions SET
            order_num = ?, label = ?, placeholder = ?, type = ?, options = ?,
            required = ?, note = ?, has_remark = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(orderNum, label, placeholder, type, optionsStr, required, note, hasRemark, id).run();

        const updated = await env.DB.prepare('SELECT * FROM new_prisoner_questions WHERE id = ?').bind(id).first();
        let options = null;
        if (updated?.options) {
          try { options = JSON.parse(updated.options); } catch (e) { options = updated.options.split(','); }
        }
        return new Response(JSON.stringify({
          success: true,
          message: 'Question updated successfully',
          data: {
            ...updated,
            required: Boolean(updated?.required),
            is_custom: Boolean(updated?.is_custom),
            has_remark: Boolean(updated?.has_remark),
            options
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if ((path.startsWith('/api/new-prisoner-questions/') || path.startsWith('/api/new-questions/')) && method === 'DELETE') {
        const id = path.split('/')[3];
        const qRecord = await env.DB.prepare('SELECT order_num, key FROM new_prisoner_questions WHERE id = ?').bind(id).first();
        if (qRecord && (Number(qRecord.order_num) <= 3 || ['utct_no', 'name', 'case_type'].includes(qRecord.key))) {
          return new Response(JSON.stringify({
            success: false,
            message: 'Question #1 (UT/CT No), #2 (Name), and #3 (Case Type) are permanent core questions and cannot be deleted.'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        await env.DB.prepare('DELETE FROM new_prisoner_questions WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Question deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if ((path === '/api/new-prisoner-questions/reorder' || path === '/api/new-questions/reorder') && method === 'POST') {
        const { items } = await request.json();
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.id && item.order_num !== undefined) {
              const cleanLabel = (item.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
              const formattedLabel = `${item.order_num}) ${cleanLabel}`;
              await env.DB.prepare(
                'UPDATE new_prisoner_questions SET order_num = ?, label = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
              ).bind(Number(item.order_num), formattedLabel, item.id).run();
            }
          }
        }
        return new Response(JSON.stringify({ success: true, message: 'Questions reordered successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if ((path === '/api/new-prisoner-questions/reset' || path === '/api/new-questions/reset') && method === 'POST') {
        await env.DB.prepare('DELETE FROM new_prisoner_questions').run();
        await env.DB.prepare(`
          INSERT INTO new_prisoner_questions (order_num, key, label, placeholder, type, options, required, note, has_remark, is_custom)
          SELECT order_num, key, label, placeholder, type, options, required, note, has_remark, is_custom FROM questions
        `).run();
        return new Response(JSON.stringify({ success: true, message: 'New Prisoner questions reset to default' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================================
      // DOC STORE MODULE ENDPOINTS (Cloudflare R2 Object Storage)
      // ==========================================================

      // Status check / R2 info
      if (path === '/api/docs/status' && method === 'GET') {
        const hasR2 = Boolean(env.DOCS_BUCKET);
        return new Response(JSON.stringify({
          success: true,
          r2_connected: hasR2,
          storage_mode: hasR2 ? 'Cloudflare R2 Object Storage' : 'Pending R2 Binding',
          bucket_name: 'survey-doc-store'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // List Files and Folders
      if (path === '/api/docs/list' && method === 'GET') {
        const folder = url.searchParams.get('folder') || '/';
        const q = url.searchParams.get('q') || '';
        const cleanFolder = folder.startsWith('/') ? (folder.endsWith('/') ? folder : `${folder}/`) : `/${folder}/`;

        // Auto-heal legacy records where file_name mistakenly had directory path
        try {
          const badFiles = await env.DB.prepare("SELECT id, file_name, folder_path FROM doc_store_files WHERE file_name LIKE '%/%'").all();
          if (badFiles && badFiles.results && badFiles.results.length > 0) {
            for (const bad of badFiles.results) {
              const lastSlash = bad.file_name.lastIndexOf('/');
              const subDir = bad.file_name.slice(0, lastSlash + 1);
              const cleanName = bad.file_name.slice(lastSlash + 1);
              const newFolder = bad.folder_path === '/' ? `/${subDir}` : `${bad.folder_path}${subDir}`;
              const keepKey = `${newFolder.replace(/^\/|\/$/g, '')}/.keep`;
              await env.DB.prepare("UPDATE doc_store_files SET file_name = ?, folder_path = ? WHERE id = ?").bind(cleanName, newFolder, bad.id).run();
              await env.DB.prepare("INSERT OR IGNORE INTO doc_store_files (file_name, file_key, folder_path, file_size, content_type, storage_type, uploaded_by) VALUES ('.keep', ?, ?, 0, 'application/x-directory', 'R2', 'meet')").bind(keepKey, newFolder).run();
            }
          }
        } catch (healErr) {
          console.warn('Auto-heal error:', healErr);
        }

        let filesQuery = 'SELECT * FROM doc_store_files WHERE 1=1';
        const params = [];

        if (q && q.trim()) {
          filesQuery += ' AND (file_name LIKE ? OR folder_path LIKE ?)';
          const term = `%${q.trim()}%`;
          params.push(term, term);
        } else {
          filesQuery += ' AND folder_path = ?';
          params.push(cleanFolder);
        }
        filesQuery += ' ORDER BY id DESC';

        const stmt = params.length > 0 ? env.DB.prepare(filesQuery).bind(...params) : env.DB.prepare(filesQuery);
        const filesResult = await stmt.all();
        const files = (filesResult.results || []).filter(f => f.file_name !== '.keep');

        // Get distinct subfolders inside cleanFolder
        const allPaths = await env.DB.prepare('SELECT DISTINCT folder_path FROM doc_store_files WHERE folder_path != ?').bind(cleanFolder).all();
        const subfoldersSet = new Set();
        for (const row of allPaths.results || []) {
          const p = row.folder_path || '/';
          if (p.startsWith(cleanFolder) && p !== cleanFolder) {
            const remainder = p.slice(cleanFolder.length);
            const sub = remainder.split('/')[0];
            if (sub) {
              subfoldersSet.add(`${cleanFolder}${sub}/`);
            }
          }
        }

        // Aggregate statistics
        const statsRow = await env.DB.prepare("SELECT COUNT(*) as total_files, COALESCE(SUM(file_size), 0) as total_size FROM doc_store_files WHERE file_name != '.keep'").first();
        const folderCountRow = await env.DB.prepare('SELECT COUNT(DISTINCT folder_path) as total_folders FROM doc_store_files').first();

        return new Response(JSON.stringify({
          success: true,
          current_folder: cleanFolder,
          folders: Array.from(subfoldersSet),
          files,
          stats: {
            total_files: statsRow?.total_files || 0,
            total_size_bytes: statsRow?.total_size || 0,
            total_folders: folderCountRow?.total_folders || 1,
            r2_active: Boolean(env.DOCS_BUCKET)
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      }

      // Upload File or Folder files
      if (path === '/api/docs/upload' && method === 'POST') {
        const contentType = request.headers.get('content-type') || '';
        let uploadedList = [];

        if (contentType.includes('multipart/form-data')) {
          const formData = await request.formData();
          const targetFolder = (formData.get('folder_path') || '/').toString().trim();
          const cleanFolder = targetFolder.startsWith('/') ? (targetFolder.endsWith('/') ? targetFolder : `${targetFolder}/`) : `/${targetFolder}/`;
          
          const files = formData.getAll('files').concat(formData.getAll('file')).filter(Boolean);
          const relPathsForm = formData.getAll('rel_paths');
          let relPathsJson = [];
          try {
            const rawJson = formData.get('relative_paths');
            if (rawJson) relPathsJson = JSON.parse(rawJson);
          } catch (e) {}

          for (let i = 0; i < files.length; i++) {
            const item = files[i];
            if (typeof item === 'object' && item.name) {
              const rawRel = (relPathsForm[i] || relPathsJson[i] || item.name || '').toString().trim();
              
              let cleanFileName = item.name;
              let targetSubDir = '';

              if (rawRel && rawRel.includes('/')) {
                const lastSlash = rawRel.lastIndexOf('/');
                targetSubDir = rawRel.slice(0, lastSlash + 1);
                cleanFileName = rawRel.slice(lastSlash + 1);
              } else if (cleanFileName.includes('/')) {
                const lastSlash = cleanFileName.lastIndexOf('/');
                targetSubDir = cleanFileName.slice(0, lastSlash + 1);
                cleanFileName = cleanFileName.slice(lastSlash + 1);
              }

              let finalFolder = cleanFolder;
              if (targetSubDir) {
                const normSub = targetSubDir.replace(/^\/+/, '').replace(/\/+$/, '') + '/';
                finalFolder = cleanFolder === '/' ? `/${normSub}` : `${cleanFolder}${normSub}`;
              }

              const safeFolderPrefix = finalFolder.replace(/^\/|\/$/g, '');
              const fileKey = safeFolderPrefix ? `${safeFolderPrefix}/${Date.now()}_${cleanFileName}` : `root/${Date.now()}_${cleanFileName}`;
              const fileSize = item.size || 0;
              const fileType = item.type || 'application/octet-stream';

              // 1. Upload directly to Cloudflare R2
              if (env.DOCS_BUCKET) {
                try {
                  await env.DOCS_BUCKET.put(fileKey, item.stream(), {
                    httpMetadata: { contentType: fileType }
                  });
                } catch (r2Err) {
                  console.error('R2 put error:', r2Err);
                }
              }

              // 2. Save file metadata in D1
              await env.DB.prepare(`
                INSERT INTO doc_store_files (file_name, file_key, folder_path, file_size, content_type, storage_type, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?, 'meet')
              `).bind(cleanFileName, fileKey, finalFolder, fileSize, fileType, env.DOCS_BUCKET ? 'R2' : 'Pending_R2').run();

              // 3. Ensure folder placeholder exists so folder structure is visible and navigable
              if (finalFolder !== '/') {
                const folderKeepKey = `${finalFolder.replace(/^\/|\/$/g, '')}/.keep`;
                await env.DB.prepare(`
                  INSERT OR IGNORE INTO doc_store_files (file_name, file_key, folder_path, file_size, content_type, storage_type, uploaded_by)
                  VALUES ('.keep', ?, ?, 0, 'application/x-directory', 'R2', 'meet')
                `).bind(folderKeepKey, finalFolder).run();
              }

              uploadedList.push({ file_name: cleanFileName, file_key: fileKey, folder_path: finalFolder, file_size: fileSize });
            }
          }
        } else {
          // JSON base64 upload
          const body = await request.json();
          const { file_name, file_data_base64, folder_path, content_type } = body;
          const targetFolder = (folder_path || '/').trim();
          const cleanFolder = targetFolder.startsWith('/') ? (targetFolder.endsWith('/') ? targetFolder : `${targetFolder}/`) : `/${targetFolder}/`;
          const safeFolderPrefix = cleanFolder.replace(/^\/|\/$/g, '');
          const fileKey = safeFolderPrefix ? `${safeFolderPrefix}/${Date.now()}_${file_name}` : `root/${Date.now()}_${file_name}`;

          if (env.DOCS_BUCKET && file_data_base64) {
            const buffer = Uint8Array.from(atob(file_data_base64), c => c.charCodeAt(0));
            await env.DOCS_BUCKET.put(fileKey, buffer, {
              httpMetadata: { contentType: content_type || 'application/octet-stream' }
            });
          }

          const fileSize = file_data_base64 ? Math.round((file_data_base64.length * 3) / 4) : 0;
          await env.DB.prepare(`
            INSERT INTO doc_store_files (file_name, file_key, folder_path, file_size, content_type, storage_type, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?, 'meet')
          `).bind(file_name, fileKey, cleanFolder, fileSize, content_type || 'application/octet-stream', env.DOCS_BUCKET ? 'R2' : 'Pending_R2').run();

          uploadedList.push({ file_name, file_key: fileKey, folder_path: cleanFolder, file_size: fileSize });
        }

        return new Response(JSON.stringify({
          success: true,
          message: `${uploadedList.length} file(s) uploaded successfully to Doc Store R2`,
          uploaded: uploadedList
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Download / Preview File from R2
      if (path.startsWith('/api/docs/file/') && method === 'GET') {
        const rawKey = path.replace('/api/docs/file/', '');
        const fileKey = decodeURIComponent(rawKey);

        const record = await env.DB.prepare('SELECT * FROM doc_store_files WHERE file_key = ? OR id = ?').bind(fileKey, fileKey).first();

        if (env.DOCS_BUCKET) {
          const targetKey = record?.file_key || fileKey;
          const r2Object = await env.DOCS_BUCKET.get(targetKey);
          if (r2Object) {
            const headers = new Headers();
            r2Object.writeHttpMetadata(headers);
            headers.set('etag', r2Object.httpEtag);
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
            headers.set('Content-Disposition', `inline; filename="${record?.file_name || 'download'}"`);
            return new Response(r2Object.body, { headers });
          }
        }

        if (!record) {
          return new Response(JSON.stringify({ success: false, message: 'File not found in Doc Store' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'File metadata retrieved. To enable binary download, ensure R2 bucket is bound in Cloudflare.',
          data: record
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Delete File
      if (path.startsWith('/api/docs/file/') && method === 'DELETE') {
        const rawKey = path.replace('/api/docs/file/', '');
        const fileKey = decodeURIComponent(rawKey);

        const record = await env.DB.prepare('SELECT * FROM doc_store_files WHERE file_key = ? OR id = ?').bind(fileKey, fileKey).first();
        if (record) {
          if (env.DOCS_BUCKET) {
            try { await env.DOCS_BUCKET.delete(record.file_key); } catch (e) {}
          }
          await env.DB.prepare('DELETE FROM doc_store_files WHERE id = ?').bind(record.id).run();
        }

        return new Response(JSON.stringify({ success: true, message: 'File deleted successfully from Doc Store' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Delete entire folder and all its contents
      if (path === '/api/docs/folder' && method === 'DELETE') {
        const { folder_path } = await request.json();
        const cleanFolder = folder_path ? (folder_path.endsWith('/') ? folder_path : `${folder_path}/`) : '';
        if (!cleanFolder || cleanFolder === '/') {
          return new Response(JSON.stringify({ success: false, message: 'Cannot delete root folder' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Find all files in this folder or any subfolders
        const filesInFolder = await env.DB.prepare(
          'SELECT file_key FROM doc_store_files WHERE folder_path = ? OR folder_path LIKE ?'
        ).bind(cleanFolder, `${cleanFolder}%`).all();

        if (env.DOCS_BUCKET) {
          for (const f of filesInFolder.results || []) {
            try { await env.DOCS_BUCKET.delete(f.file_key); } catch (e) {}
          }
        }

        await env.DB.prepare(
          'DELETE FROM doc_store_files WHERE folder_path = ? OR folder_path LIKE ?'
        ).bind(cleanFolder, `${cleanFolder}%`).run();

        return new Response(JSON.stringify({
          success: true,
          message: `Folder "${cleanFolder}" and all its files deleted successfully from Doc Store`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get all files inside a folder (for folder batch download)
      if (path === '/api/docs/folder/files' && method === 'GET') {
        const folder_path = url.searchParams.get('folder_path') || '';
        const cleanFolder = folder_path ? (folder_path.endsWith('/') ? folder_path : `${folder_path}/`) : '';
        const filesInFolder = await env.DB.prepare(
          "SELECT * FROM doc_store_files WHERE (folder_path = ? OR folder_path LIKE ?) AND file_name != '.keep'"
        ).bind(cleanFolder, `${cleanFolder}%`).all();

        return new Response(JSON.stringify({
          success: true,
          files: filesInFolder.results || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create empty folder
      if (path === '/api/docs/folder/create' && method === 'POST') {
        const { folder_name, parent_folder } = await request.json();
        const cleanParent = parent_folder ? (parent_folder.endsWith('/') ? parent_folder : `${parent_folder}/`) : '/';
        const cleanName = String(folder_name || '').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
        if (!cleanName) {
          return new Response(JSON.stringify({ success: false, message: 'Valid folder name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const newFolderPath = `${cleanParent}${cleanName}/`;

        const placeholderKey = `${newFolderPath.replace(/^\/|\/$/g, '')}/.keep`;
        await env.DB.prepare(`
          INSERT INTO doc_store_files (file_name, file_key, folder_path, file_size, content_type, storage_type, uploaded_by)
          VALUES ('.keep', ?, ?, 0, 'application/x-directory', 'R2', 'meet')
        `).bind(placeholderKey, newFolderPath).run();

        return new Response(JSON.stringify({
          success: true,
          message: `Folder "${cleanName}" created successfully`,
          folder_path: newFolderPath
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================================
      // PASS MS MODULE ENDPOINTS (Password Management System)
      // ==========================================================

      // List all Pass MS entries
      if (path === '/api/pass-ms/list' && method === 'GET') {
        const q = (url.searchParams.get('q') || '').trim();
        let query = 'SELECT * FROM pass_ms_entries WHERE 1=1';
        const params = [];
        if (q) {
          query += ' AND (title LIKE ? OR url LIKE ? OR username LIKE ?)';
          const term = `%${q}%`;
          params.push(term, term, term);
        }
        query += ' ORDER BY id DESC';

        const stmt = params.length > 0 ? env.DB.prepare(query).bind(...params) : env.DB.prepare(query);
        const result = await stmt.all();
        return new Response(JSON.stringify({
          success: true,
          data: result.results || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      }

      // Add new Pass MS entry
      if (path === '/api/pass-ms/entries' && method === 'POST') {
        const body = await request.json();
        const { title, url: siteUrl, username, password, notes } = body;
        if (!title || !username || !password) {
          return new Response(JSON.stringify({ success: false, message: 'Title, Username, and Password are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const res = await env.DB.prepare(`
          INSERT INTO pass_ms_entries (title, url, username, password, notes)
          VALUES (?, ?, ?, ?, ?)
        `).bind(title.trim(), (siteUrl || '').trim(), username.trim(), password.trim(), (notes || '').trim()).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Password entry saved successfully',
          id: res.meta?.last_row_id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update Pass MS entry
      if (path.startsWith('/api/pass-ms/entries/') && method === 'PUT') {
        const id = path.split('/')[4];
        const body = await request.json();
        const { title, url: siteUrl, username, password, notes } = body;
        if (!title || !username || !password) {
          return new Response(JSON.stringify({ success: false, message: 'Title, Username, and Password are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.DB.prepare(`
          UPDATE pass_ms_entries
          SET title = ?, url = ?, username = ?, password = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(title.trim(), (siteUrl || '').trim(), username.trim(), password.trim(), (notes || '').trim(), id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Password entry updated successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Delete Pass MS entry
      if (path.startsWith('/api/pass-ms/entries/') && method === 'DELETE') {
        const id = path.split('/')[4];
        await env.DB.prepare('DELETE FROM pass_ms_entries WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({
          success: true,
          message: 'Password entry deleted successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ==========================================================
      // 1 TO 1 MODULE (Real-Time Group Chat App like WhatsApp)
      // ==========================================================

      // 1. Members: List all members
      if (path === '/api/chat/members' && method === 'GET') {
        await ensureChatTables(env.DB);
        const q = (url.searchParams.get('q') || '').trim();
        let query = `
          SELECT cm.id, cm.name, cm.avatar_color, cm.created_at,
                 COUNT(cgm.group_id) as groups_count
          FROM chat_members cm
          LEFT JOIN chat_group_members cgm ON cm.id = cgm.member_id
        `;
        const params = [];
        if (q) {
          query += ' WHERE cm.name LIKE ?';
          params.push(`%${q}%`);
        }
        query += ' GROUP BY cm.id ORDER BY cm.name ASC';
        const stmt = params.length > 0 ? env.DB.prepare(query).bind(...params) : env.DB.prepare(query);
        const res = await stmt.all();
        return new Response(JSON.stringify({ success: true, members: res.results || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 2. Members: Add new member (Only Name required)
      if (path === '/api/chat/members' && method === 'POST') {
        await ensureChatTables(env.DB);
        const { name, avatar_color } = await request.json();
        const cleanName = String(name || '').trim();
        if (!cleanName) {
          return new Response(JSON.stringify({ success: false, message: 'Member name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const existing = await env.DB.prepare('SELECT id FROM chat_members WHERE LOWER(name) = LOWER(?)').bind(cleanName).first();
        if (existing) {
          return new Response(JSON.stringify({ success: false, message: `Member "${cleanName}" already exists!` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const colors = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#4F46E5', '#EA580C', '#0D9488'];
        const assignedColor = avatar_color || colors[Math.floor(Math.random() * colors.length)];

        const ins = await env.DB.prepare('INSERT INTO chat_members (name, avatar_color) VALUES (?, ?)').bind(cleanName, assignedColor).run();
        const newId = ins?.meta?.last_row_id || Date.now();

        return new Response(JSON.stringify({
          success: true,
          message: 'Member added successfully',
          member: { id: newId, name: cleanName, avatar_color: assignedColor, groups_count: 0 }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 3. Members: Update member name / avatar
      if (path.startsWith('/api/chat/members/') && method === 'PUT') {
        const id = path.split('/')[4];
        const { name, avatar_color } = await request.json();
        const cleanName = String(name || '').trim();
        if (!cleanName) {
          return new Response(JSON.stringify({ success: false, message: 'Member name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const existing = await env.DB.prepare('SELECT id FROM chat_members WHERE LOWER(name) = LOWER(?) AND id != ?').bind(cleanName, id).first();
        if (existing) {
          return new Response(JSON.stringify({ success: false, message: `Another member with name "${cleanName}" already exists!` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (avatar_color) {
          await env.DB.prepare('UPDATE chat_members SET name = ?, avatar_color = ? WHERE id = ?').bind(cleanName, avatar_color, id).run();
        } else {
          await env.DB.prepare('UPDATE chat_members SET name = ? WHERE id = ?').bind(cleanName, id).run();
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Member updated successfully',
          member: { id: Number(id), name: cleanName }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 4. Members: Delete member
      if (path.startsWith('/api/chat/members/') && method === 'DELETE') {
        const id = path.split('/')[4];
        await env.DB.batch([
          env.DB.prepare('DELETE FROM chat_members WHERE id = ?').bind(id),
          env.DB.prepare('DELETE FROM chat_group_members WHERE member_id = ?').bind(id)
        ]);
        return new Response(JSON.stringify({ success: true, message: 'Member deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 5. Groups: List all groups with member list and last message
      if (path === '/api/chat/groups' && method === 'GET') {
        await ensureChatTables(env.DB);
        const q = (url.searchParams.get('q') || '').trim();
        let query = 'SELECT * FROM chat_groups WHERE 1=1';
        const params = [];
        if (q) {
          query += ' AND (name LIKE ? OR description LIKE ?)';
          params.push(`%${q}%`, `%${q}%`);
        }
        query += ' ORDER BY updated_at DESC, id DESC';
        const stmt = params.length > 0 ? env.DB.prepare(query).bind(...params) : env.DB.prepare(query);
        const groupsRes = await stmt.all();
        const groups = groupsRes.results || [];

        const enriched = [];
        for (const g of groups) {
          const membersRes = await env.DB.prepare(`
            SELECT cm.id, cm.name, cm.avatar_color
            FROM chat_group_members cgm
            JOIN chat_members cm ON cgm.member_id = cm.id
            WHERE cgm.group_id = ?
            ORDER BY cm.name ASC
          `).bind(g.id).all();

          const lastMsg = await env.DB.prepare(`
            SELECT message, sender_name, created_at
            FROM chat_messages
            WHERE group_id = ?
            ORDER BY id DESC LIMIT 1
          `).bind(g.id).first();

          enriched.push({
            ...g,
            members: membersRes.results || [],
            member_count: (membersRes.results || []).length,
            last_message: lastMsg || null
          });
        }

        return new Response(JSON.stringify({ success: true, groups: enriched }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 6. Groups: Create new group (Logo, Name, Description, Multiple Members)
      if (path === '/api/chat/groups' && method === 'POST') {
        await ensureChatTables(env.DB);
        const { name, description, logo_url, member_ids } = await request.json();
        const cleanName = String(name || '').trim();
        if (!cleanName) {
          return new Response(JSON.stringify({ success: false, message: 'Group name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const ins = await env.DB.prepare(`
          INSERT INTO chat_groups (name, description, logo_url, created_by)
          VALUES (?, ?, ?, 'meet')
        `).bind(cleanName, String(description || '').trim(), String(logo_url || '💬').trim()).run();
        
        const newGid = ins?.meta?.last_row_id || Date.now();

        // Add multiple members in one go
        if (Array.isArray(member_ids) && member_ids.length > 0) {
          const memberStmts = member_ids.map(mid =>
            env.DB.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, member_id) VALUES (?, ?)').bind(newGid, mid)
          );
          await env.DB.batch(memberStmts);
        }

        // Welcome message
        await env.DB.prepare(`
          INSERT INTO chat_messages (group_id, sender_name, message, mentions)
          VALUES (?, 'System', 'Group created. Start your conversation!', '[]')
        `).bind(newGid).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Group created successfully',
          group_id: newGid
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 7. Groups: Update group (Name, Description, Logo, Members)
      if (path.startsWith('/api/chat/groups/') && !path.includes('/members') && method === 'PUT') {
        const id = path.split('/')[4];
        const { name, description, logo_url, member_ids } = await request.json();
        const cleanName = String(name || '').trim();
        if (!cleanName) {
          return new Response(JSON.stringify({ success: false, message: 'Group name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.DB.prepare(`
          UPDATE chat_groups
          SET name = ?, description = ?, logo_url = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(cleanName, String(description || '').trim(), String(logo_url || '💬').trim(), id).run();

        if (Array.isArray(member_ids)) {
          await env.DB.prepare('DELETE FROM chat_group_members WHERE group_id = ?').bind(id).run();
          if (member_ids.length > 0) {
            const stmts = member_ids.map(mid =>
              env.DB.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, member_id) VALUES (?, ?)').bind(id, mid)
            );
            await env.DB.batch(stmts);
          }
        }

        return new Response(JSON.stringify({ success: true, message: 'Group updated successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 8. Groups: Delete group and messages
      if (path.startsWith('/api/chat/groups/') && !path.includes('/members') && method === 'DELETE') {
        const id = path.split('/')[4];
        await env.DB.batch([
          env.DB.prepare('DELETE FROM chat_groups WHERE id = ?').bind(id),
          env.DB.prepare('DELETE FROM chat_group_members WHERE group_id = ?').bind(id),
          env.DB.prepare('DELETE FROM chat_messages WHERE group_id = ?').bind(id)
        ]);
        return new Response(JSON.stringify({ success: true, message: 'Group deleted successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 9. Group Members: Get members of specific group
      if (path.startsWith('/api/chat/groups/') && path.endsWith('/members') && method === 'GET') {
        const id = path.split('/')[4];
        const membersRes = await env.DB.prepare(`
          SELECT cm.id, cm.name, cm.avatar_color
          FROM chat_group_members cgm
          JOIN chat_members cm ON cgm.member_id = cm.id
          WHERE cgm.group_id = ?
          ORDER BY cm.name ASC
        `).bind(id).all();

        return new Response(JSON.stringify({ success: true, members: membersRes.results || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 10. Group Members: Add / Remove members from group anytime
      if (path.startsWith('/api/chat/groups/') && path.endsWith('/members') && method === 'POST') {
        const id = path.split('/')[4];
        const { member_ids } = await request.json();
        if (!Array.isArray(member_ids)) {
          return new Response(JSON.stringify({ success: false, message: 'member_ids array required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.DB.prepare('DELETE FROM chat_group_members WHERE group_id = ?').bind(id).run();
        if (member_ids.length > 0) {
          const stmts = member_ids.map(mid =>
            env.DB.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, member_id) VALUES (?, ?)').bind(id, mid)
          );
          await env.DB.batch(stmts);
        }

        return new Response(JSON.stringify({ success: true, message: 'Group members updated successfully' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 11. Messages: Real-Time messages fetch (Supports delta polling via ?since=)
      if (path === '/api/chat/messages' && method === 'GET') {
        const groupId = url.searchParams.get('group_id');
        const since = url.searchParams.get('since');
        if (!groupId) {
          return new Response(JSON.stringify({ success: false, message: 'group_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let q = 'SELECT * FROM chat_messages WHERE group_id = ?';
        const params = [groupId];
        if (since && Number(since)) {
          q += ' AND id > ?';
          params.push(Number(since));
        }
        q += ' ORDER BY id ASC LIMIT 300';

        const res = await env.DB.prepare(q).bind(...params).all();
        return new Response(JSON.stringify({ success: true, messages: res.results || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 12. Messages: Send message
      if (path === '/api/chat/messages' && method === 'POST') {
        const { group_id, sender_name, message, mentions } = await request.json();
        const cleanMsg = String(message || '').trim();
        if (!group_id || !cleanMsg) {
          return new Response(JSON.stringify({ success: false, message: 'group_id and message are required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const sender = String(sender_name || 'meet').trim();
        const mentionsJson = Array.isArray(mentions) ? JSON.stringify(mentions) : (typeof mentions === 'string' ? mentions : '[]');

        const ins = await env.DB.prepare(`
          INSERT INTO chat_messages (group_id, sender_name, message, mentions)
          VALUES (?, ?, ?, ?)
        `).bind(group_id, sender, cleanMsg, mentionsJson).run();

        const newId = ins?.meta?.last_row_id || Date.now();

        // Update group last active timestamp
        await env.DB.prepare('UPDATE chat_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(group_id).run();

        const msgObj = {
          id: newId,
          group_id: Number(group_id),
          sender_name: sender,
          message: cleanMsg,
          mentions: mentionsJson,
          created_at: new Date().toISOString()
        };

        return new Response(JSON.stringify({ success: true, message: msgObj }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 13. Messages: Delete message
      if (path.startsWith('/api/chat/messages/') && method === 'DELETE') {
        const id = path.split('/')[4];
        await env.DB.prepare('DELETE FROM chat_messages WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true, message: 'Message deleted' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ message: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
