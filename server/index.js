const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 1. Auth Endpoint (Authenticated via SQLite database)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = db.prepare('SELECT id, username, role FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) AND password = ?').get(username, password);
  if (user) {
    return res.json({
      success: true,
      token: 'sarve-auth-session-token-' + user.id,
      user: {
        id: user.id,
        username: user.username,
        role: user.role || 'Administrator',
        displayName: 'Sarve Admin'
      }
    });
  }

  // Fallback for default admin
  if (username === 'sarve' && password === 'New@1020') {
    return res.json({
      success: true,
      token: 'sarve-auth-session-token-default',
      user: {
        username: 'sarve',
        role: 'Administrator',
        displayName: 'Sarve Admin'
      }
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid Username or Password! Please use correct credentials.'
  });
});

// 2. Check UT/CT No uniqueness (query param ?no=...)
app.get('/api/survey/check-utct', (req, res) => {
  const utctNo = (req.query.no || req.query.utctNo || '').trim();
  const currentId = req.query.excludeId;

  if (!utctNo) {
    return res.json({ exists: false, message: 'No UT/CT No provided' });
  }

  let query = 'SELECT id, utct_no, name FROM prisoner_surveys WHERE LOWER(TRIM(utct_no)) = LOWER(TRIM(?))';
  let params = [utctNo];

  if (currentId) {
    query += ' AND id != ?';
    params.push(currentId);
  }

  const existing = db.prepare(query).get(...params);
  if (existing) {
    return res.json({
      exists: true,
      message: `UT/CT No. "${utctNo}" already exists in database (Prisoner: ${existing.name})!`,
      survey: existing
    });
  }

  return res.json({ exists: false, message: 'UT/CT No. is available.' });
});

// 3. Get all Surveys with search filter
app.get('/api/survey/list', (req, res) => {
  const search = (req.query.q || '').trim();
  let query = 'SELECT * FROM prisoner_surveys';
  let params = [];

  if (search) {
    query += ` WHERE 
      utct_no LIKE ? OR 
      name LIKE ? OR 
      case_type LIKE ? OR 
      advocate_name_number LIKE ? OR
      prisoner_psychologic_survey LIKE ?
    `;
    const searchPattern = `%${search}%`;
    params = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
  }

  query += ' ORDER BY id DESC';

  const surveys = db.prepare(query).all(...params);
  res.json({ success: true, count: surveys.length, data: surveys });
});

// 4. Get single survey by id
app.get('/api/survey/:id', (req, res) => {
  const survey = db.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').get(req.params.id);
  if (!survey) {
    return res.status(404).json({ success: false, message: 'Survey not found' });
  }
  res.json({ success: true, data: survey });
});

// 5. Add new Survey
app.post('/api/survey/add', (req, res) => {
  try {
    const data = req.body;
    if (!data.utct_no || !data.utct_no.trim()) {
      return res.status(400).json({ success: false, message: 'UT/CT No. is required!' });
    }
    if (!data.name || !data.name.trim()) {
      return res.status(400).json({ success: false, message: 'Prisoner Name is required!' });
    }

    // Check duplicate UT/CT No
    const existing = db.prepare('SELECT id FROM prisoner_surveys WHERE LOWER(TRIM(utct_no)) = LOWER(TRIM(?))').get(data.utct_no);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `UT/CT No. "${data.utct_no}" already exists in the database! Duplicate entries are not allowed.`
      });
    }

    const insert = db.prepare(`
      INSERT INTO prisoner_surveys (
        utct_no, name, case_type, total_cases, case_duration,
        total_advocates_hired, times_in_jail, advocate_name_number,
        known_unknown_advocate, high_court_advocate, advocate_payment_advance,
        first_advocate_by_io, know_case_process, lawyer_collects_details_evidence,
        know_fees_reasonable, complete_fees_total_initially,
        work_transparency_tracking, know_legal_step_correct,
        case_prolonged_expensive, pairvi_knowledge_reason,
        court_docs_fees_timing, know_trustworthy_platform,
        priority_money_vs_release, prisoner_psychologic_survey
      ) VALUES (
        @utct_no, @name, @case_type, @total_cases, @case_duration,
        @total_advocates_hired, @times_in_jail, @advocate_name_number,
        @known_unknown_advocate, @high_court_advocate, @advocate_payment_advance,
        @first_advocate_by_io, @know_case_process, @lawyer_collects_details_evidence,
        @know_fees_reasonable, @complete_fees_total_initially,
        @work_transparency_tracking, @know_legal_step_correct,
        @case_prolonged_expensive, @pairvi_knowledge_reason,
        @court_docs_fees_timing, @know_trustworthy_platform,
        @priority_money_vs_release, @prisoner_psychologic_survey
      )
    `);

    const result = insert.run({
      utct_no: (data.utct_no || '').trim(),
      name: (data.name || '').trim(),
      case_type: Array.isArray(data.case_type) ? data.case_type.join(', ') : (data.case_type || ''),
      total_cases: Number(data.total_cases) || 0,
      case_duration: data.case_duration || '',
      total_advocates_hired: Number(data.total_advocates_hired) || 0,
      times_in_jail: Number(data.times_in_jail) || 0,
      advocate_name_number: data.advocate_name_number || '',
      known_unknown_advocate: data.known_unknown_advocate || '',
      high_court_advocate: data.high_court_advocate || '',
      advocate_payment_advance: data.advocate_payment_advance || '',
      first_advocate_by_io: data.first_advocate_by_io || '',
      know_case_process: data.know_case_process || '',
      lawyer_collects_details_evidence: data.lawyer_collects_details_evidence || '',
      know_fees_reasonable: data.know_fees_reasonable || '',
      complete_fees_total_initially: data.complete_fees_total_initially || '',
      work_transparency_tracking: data.work_transparency_tracking || '',
      know_legal_step_correct: data.know_legal_step_correct || '',
      case_prolonged_expensive: data.case_prolonged_expensive || '',
      pairvi_knowledge_reason: data.pairvi_knowledge_reason || '',
      court_docs_fees_timing: data.court_docs_fees_timing || '',
      know_trustworthy_platform: data.know_trustworthy_platform || '',
      priority_money_vs_release: data.priority_money_vs_release || '',
      prisoner_psychologic_survey: data.prisoner_psychologic_survey || ''
    });

    const newRecord = db.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, message: 'Prisoner survey saved successfully!', data: newRecord });
  } catch (err) {
    console.error('Error adding survey:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// 6. Update survey
app.put('/api/survey/:id', (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;

    const existing = db.prepare('SELECT id FROM prisoner_surveys WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Survey not found' });
    }

    // Check duplicate UT/CT No excluding current id
    if (data.utct_no) {
      const duplicate = db.prepare('SELECT id FROM prisoner_surveys WHERE LOWER(TRIM(utct_no)) = LOWER(TRIM(?)) AND id != ?').get(data.utct_no, id);
      if (duplicate) {
        return res.status(400).json({ success: false, message: `UT/CT No. "${data.utct_no}" already exists in another record!` });
      }
    }

    const update = db.prepare(`
      UPDATE prisoner_surveys SET
        utct_no = @utct_no,
        name = @name,
        case_type = @case_type,
        total_cases = @total_cases,
        case_duration = @case_duration,
        total_advocates_hired = @total_advocates_hired,
        times_in_jail = @times_in_jail,
        advocate_name_number = @advocate_name_number,
        known_unknown_advocate = @known_unknown_advocate,
        high_court_advocate = @high_court_advocate,
        advocate_payment_advance = @advocate_payment_advance,
        first_advocate_by_io = @first_advocate_by_io,
        know_case_process = @know_case_process,
        lawyer_collects_details_evidence = @lawyer_collects_details_evidence,
        know_fees_reasonable = @know_fees_reasonable,
        complete_fees_total_initially = @complete_fees_total_initially,
        work_transparency_tracking = @work_transparency_tracking,
        know_legal_step_correct = @know_legal_step_correct,
        case_prolonged_expensive = @case_prolonged_expensive,
        pairvi_knowledge_reason = @pairvi_knowledge_reason,
        court_docs_fees_timing = @court_docs_fees_timing,
        know_trustworthy_platform = @know_trustworthy_platform,
        priority_money_vs_release = @priority_money_vs_release,
        prisoner_psychologic_survey = @prisoner_psychologic_survey,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);

    update.run({
      id,
      utct_no: (data.utct_no || '').trim(),
      name: (data.name || '').trim(),
      case_type: Array.isArray(data.case_type) ? data.case_type.join(', ') : (data.case_type || ''),
      total_cases: Number(data.total_cases) || 0,
      case_duration: data.case_duration || '',
      total_advocates_hired: Number(data.total_advocates_hired) || 0,
      times_in_jail: Number(data.times_in_jail) || 0,
      advocate_name_number: data.advocate_name_number || '',
      known_unknown_advocate: data.known_unknown_advocate || '',
      high_court_advocate: data.high_court_advocate || '',
      advocate_payment_advance: data.advocate_payment_advance || '',
      first_advocate_by_io: data.first_advocate_by_io || '',
      know_case_process: data.know_case_process || '',
      lawyer_collects_details_evidence: data.lawyer_collects_details_evidence || '',
      know_fees_reasonable: data.know_fees_reasonable || '',
      complete_fees_total_initially: data.complete_fees_total_initially || '',
      work_transparency_tracking: data.work_transparency_tracking || '',
      know_legal_step_correct: data.know_legal_step_correct || '',
      case_prolonged_expensive: data.case_prolonged_expensive || '',
      pairvi_knowledge_reason: data.pairvi_knowledge_reason || '',
      court_docs_fees_timing: data.court_docs_fees_timing || '',
      know_trustworthy_platform: data.know_trustworthy_platform || '',
      priority_money_vs_release: data.priority_money_vs_release || '',
      prisoner_psychologic_survey: data.prisoner_psychologic_survey || ''
    });

    const updatedRecord = db.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').get(id);
    res.json({ success: true, message: 'Survey updated successfully!', data: updatedRecord });
  } catch (err) {
    console.error('Error updating survey:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Delete survey
app.delete('/api/survey/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM prisoner_surveys WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Survey record not found' });
    }
    res.json({ success: true, message: 'Survey record deleted successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Download Excel with Question Headers
app.get('/api/survey/export/excel', (req, res) => {
  try {
    const search = (req.query.q || '').trim();
    let query = 'SELECT * FROM prisoner_surveys';
    let params = [];

    if (search) {
      query += ` WHERE utct_no LIKE ? OR name LIKE ? OR case_type LIKE ? OR advocate_name_number LIKE ?`;
      const searchPattern = `%${search}%`;
      params = [searchPattern, searchPattern, searchPattern, searchPattern];
    }
    query += ' ORDER BY id ASC';

    const records = db.prepare(query).all(...params);

    // Map records to rows where keys are exact question texts
    const excelRows = records.map((r, index) => {
      return {
        'S.No': index + 1,
        '1) UT/CT No.': r.utct_no || '',
        '2) Name': r.name || '',
        '3) Case type / how you type of advocate to hire': r.case_type || '',
        '4) Total number of cases': r.total_cases ?? '',
        '5) How long these cases are running': r.case_duration || '',
        '6) Total advocate hired till date': r.total_advocates_hired ?? '',
        '7) How many time come to jail': r.times_in_jail ?? '',
        '8) Advocate name and number': r.advocate_name_number || '',
        '9) Known / unknown Advocate': r.known_unknown_advocate || '',
        '10) High court advocate': r.high_court_advocate || '',
        '11) Advocate payment advance': r.advocate_payment_advance || '',
        '12) First Advocate hired by IO': r.first_advocate_by_io || '',
        '13) Do you know process, when case started, first and next step': r.know_case_process || '',
        '14) Does your lawyer ask, all details about your case, and collect evidence': r.lawyer_collects_details_evidence || '',
        '15) How do you know, lawyer jo fees le raha hai, vo sahi hai': r.know_fees_reasonable || '',
        '16) Does it give, complete fees total, initially': r.complete_fees_total_initially || '',
        '17) Work transparency and tracking of lawyer work': r.work_transparency_tracking || '',
        '18) Kya apko pata hai, jo legal step lawyer process kar raha hai, vo sab sahi hai, kuch miss toh nahi kar raha': r.know_legal_step_correct || '',
        '19) Because of some extra unwanted step, kya lawyer ki wajah se, case lamba chala aur expensive ho gaya': r.case_prolonged_expensive || '',
        '20) Parivi karwane ko knowledge hai ya nahi, aur kyun parivi karta hai': r.pairvi_knowledge_reason || '',
        '21) Court ke doc kyun nikalte hai, and uski fees pata hai, aur kya vo aapko time pe miljate hai': r.court_docs_fees_timing || '',
        '22) Do you know any platform, jo aapko pairvi karne wala de, and jo guarantee de ki, jo adv provide karega, jo trustworthy hoga': r.know_trustworthy_platform || '',
        '23) Your priority, ki paise bachana hai ya jail se bahar jaldi jana hai': r.priority_money_vs_release || '',
        '24) Prisoner psychologic according sarve': r.prisoner_psychologic_survey || '',
        'Survey Date & Time': r.created_at || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // Auto calculate column widths
    const colWidths = [
      { wch: 6 },  // S.No
      { wch: 18 }, // UT/CT No
      { wch: 22 }, // Name
      { wch: 35 }, // Case Type
      { wch: 20 }, // Total cases
      { wch: 25 }, // How long
      { wch: 22 }, // Total advocates
      { wch: 22 }, // Times in jail
      { wch: 30 }, // Advocate name & no
      { wch: 22 }, // Known/unknown
      { wch: 20 }, // High court adv
      { wch: 28 }, // 11) Advocate payment advance
      { wch: 22 }, // First adv by IO
      { wch: 35 }, // Q13
      { wch: 35 }, // Q14
      { wch: 35 }, // Q15
      { wch: 30 }, // Q16
      { wch: 30 }, // Q17
      { wch: 40 }, // Q18
      { wch: 40 }, // Q19
      { wch: 35 }, // Q20
      { wch: 38 }, // Q21
      { wch: 40 }, // Q22
      { wch: 35 }, // Q23
      { wch: 40 }, // Q24
      { wch: 22 }  // Created At
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prisoner Sarve Data');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Prisoner_Sarve_Report_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting excel:', err);
    res.status(500).json({ success: false, message: 'Failed to export excel report.' });
  }
});

// 9. Case Types CRUD
app.get('/api/case-types', (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM case_types ORDER BY name ASC').all();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/case-types', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Case type name is required' });
    }
    const cleanName = name.trim();
    const existing = db.prepare('SELECT id FROM case_types WHERE LOWER(name) = LOWER(?)').get(cleanName);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Case type already exists!' });
    }
    const result = db.prepare('INSERT INTO case_types (name) VALUES (?)').run(cleanName);
    const created = db.prepare('SELECT * FROM case_types WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, message: 'Case type added successfully', data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/case-types/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM case_types WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Case type not found' });
    }
    res.json({ success: true, message: 'Case type removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`   SARVE PORTAL SERVER RUNNING ON PORT ${PORT} `);
  console.log(`   Login: sarve / New@1020                      `);
  console.log(`===============================================`);
});
