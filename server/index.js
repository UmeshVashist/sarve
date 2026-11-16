const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

function formatSurvey(r) {
  if (!r) return null;
  let custom = {};
  if (r.custom_answers) {
    try {
      custom = JSON.parse(r.custom_answers);
    } catch (e) {}
  }
  let advocates_details = [];
  if (r.advocates_details) {
    try {
      advocates_details = typeof r.advocates_details === 'string' ? JSON.parse(r.advocates_details) : r.advocates_details;
    } catch (e) {
      advocates_details = [];
    }
  }
  return { ...r, advocates_details, ...custom };
}

const ADVOCATE_STANDARD_KEYS = [
  'advocate_reg_no', 'name', 'contact_number', 'office_address',
  'primary_court', 'practice_experience_years', 'case_specialization',
  'regularly_handles_undertrial_cases', 'provides_legal_aid_dlsa',
  'transparent_fee_structure', 'average_case_duration',
  'parivi_assistance_knowledge', 'remarks'
];

function formatAdvocateSurvey(r) {
  if (!r) return null;
  let custom = {};
  if (r.custom_answers) {
    try {
      custom = JSON.parse(r.custom_answers);
    } catch (e) {}
  }
  return { ...r, ...custom };
}

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

// 1. Auth Endpoint (Authenticated via SQLite database - supports any case like meet, Meet, MEET)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const cleanUsername = (username || '').trim().toLowerCase();

  if (cleanUsername === 'sarve') {
    return res.status(401).json({
      success: false,
      message: 'Invalid Username or Password! Please use correct credentials.'
    });
  }

  const user = db.prepare('SELECT id, username, role FROM users WHERE LOWER(TRIM(username)) = ? AND password = ?').get(cleanUsername, password);
  if (user) {
    return res.json({
      success: true,
      token: 'survey-auth-session-token-' + user.id,
      user: {
        id: user.id,
        username: user.username,
        role: user.role || 'Administrator',
        displayName: 'Survey Admin'
      }
    });
  }

  // Fallback for default admin (case-insensitive meet)
  if (cleanUsername === 'meet' && password === 'New@1020') {
    return res.json({
      success: true,
      token: 'survey-auth-session-token-default',
      user: {
        username: 'meet',
        role: 'Administrator',
        displayName: 'Survey Admin'
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
      prisoner_psychologic_survey LIKE ? OR
      custom_answers LIKE ?
    `;
    const searchPattern = `%${search}%`;
    params = [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];
  }

  query += ' ORDER BY id DESC';

  const rows = db.prepare(query).all(...params);
  const surveys = rows.map(formatSurvey);
  res.json({ success: true, count: surveys.length, data: surveys });
});

// 4. Get single survey by id
app.get('/api/survey/:id', (req, res) => {
  const survey = db.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').get(req.params.id);
  if (!survey) {
    return res.status(404).json({ success: false, message: 'Survey not found' });
  }
  res.json({ success: true, data: formatSurvey(survey) });
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

    const customJson = extractCustomAnswers(data);

    const insert = db.prepare(`
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
      ) VALUES (
        @utct_no, @name, @case_type, @total_cases, @case_duration,
        @total_advocates_hired, @times_in_jail, @advocate_name_number,
        @advocates_details,
        @known_unknown_advocate, @high_court_advocate, @advocate_payment_advance,
        @first_advocate_by_io, @know_case_process, @lawyer_collects_details_evidence,
        @know_fees_reasonable, @complete_fees_total_initially,
        @work_transparency_tracking, @know_legal_step_correct,
        @case_prolonged_expensive, @pairvi_knowledge_reason,
        @court_docs_fees_timing, @know_trustworthy_platform,
        @priority_money_vs_release, @prisoner_psychologic_survey,
        @custom_answers
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
      advocates_details: typeof data.advocates_details === 'string' ? data.advocates_details : JSON.stringify(data.advocates_details || []),
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
      prisoner_psychologic_survey: data.prisoner_psychologic_survey || '',
      custom_answers: customJson
    });

    const newRecord = db.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, message: 'Prisoner survey saved successfully!', data: formatSurvey(newRecord) });
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

    const existing = db.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').get(id);
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

    let existingCustom = {};
    if (existing.custom_answers) {
      try { existingCustom = JSON.parse(existing.custom_answers); } catch (e) {}
    }
    const customJson = extractCustomAnswers(data, existingCustom);

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
        advocates_details = @advocates_details,
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
        custom_answers = @custom_answers,
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
      advocates_details: typeof data.advocates_details === 'string' ? data.advocates_details : JSON.stringify(data.advocates_details || []),
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
      prisoner_psychologic_survey: data.prisoner_psychologic_survey || '',
      custom_answers: customJson
    });

    const updatedRecord = db.prepare('SELECT * FROM prisoner_surveys WHERE id = ?').get(id);
    res.json({ success: true, message: 'Survey updated successfully!', data: formatSurvey(updatedRecord) });
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

// 8. Dynamic Download Excel with Question Headers
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

    const records = db.prepare(query).all(...params).map(formatSurvey);
    const questions = db.prepare('SELECT * FROM questions ORDER BY order_num ASC, id ASC').all();

    // Helper to format a single advocate card into readable string
    const formatAdv = (a, aIdx) => {
      if (!a) return '';
      const parts = [];
      if (a.name) parts.push(`Name: ${String(a.name).trim()}`);
      if (a.fee) parts.push(`Fee: ₹${a.fee}`);
      if (a.experience) parts.push(`Exp: ${a.experience}`);
      if (a.known) parts.push(`Known: ${a.known}`);
      if (a.court_type) parts.push(`Court: ${a.court_type}`);
      return `[${aIdx + 1}] ${parts.join(' | ')}`;
    };

    // Map records to rows dynamically based on questions configured (Multi-advocate row expansion)
    const excelRows = [];

    records.forEach((r, recordIndex) => {
      let advocateList = [];
      if (r.advocates_details) {
        try {
          advocateList = typeof r.advocates_details === 'string' ? JSON.parse(r.advocates_details) : r.advocates_details;
        } catch (e) {}
      }
      if (!Array.isArray(advocateList)) advocateList = [];
      advocateList = advocateList.filter((a) => a && (a.name || a.fee || a.experience || a.known || a.court_type));

      let utctVal = r.utct_no || '';
      let nameVal = r.name || '';

      const firstRow = { 'S.No': recordIndex + 1 };
      questions.forEach((q, idx) => {
        const cleanLabel = (q.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
        const header = `${q.order_num ?? idx + 1}) ${cleanLabel}`;
        let val = r[q.key];
        if (val === undefined || val === null || val === '') {
          if (r.custom_answers) {
            try {
              const ca = typeof r.custom_answers === 'string' ? JSON.parse(r.custom_answers) : r.custom_answers;
              if (ca[q.key] !== undefined && ca[q.key] !== null) val = ca[q.key];
            } catch (e) {}
          }
        }
        if (val === undefined || val === null) val = '';
        if (Array.isArray(val)) val = val.join(', ');

        if (q.key === 'utct_no') {
          utctVal = val || utctVal;
          firstRow[header] = utctVal;
        } else if (q.key === 'name') {
          nameVal = val || nameVal;
          firstRow[header] = nameVal;
        } else if (q.key === 'advocate_name_number') {
          if (advocateList.length > 0) {
            firstRow[header] = formatAdv(advocateList[0], 0);
          } else {
            firstRow[header] = val;
          }
        } else {
          firstRow[header] = val;
        }
      });

      firstRow['Survey Date & Time'] = r.created_at || '';
      excelRows.push(firstRow);

      if (advocateList.length > 1) {
        for (let k = 1; k < advocateList.length; k++) {
          const subRow = { 'S.No': '' };
          questions.forEach((q, idx) => {
            const cleanLabel = (q.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
            const header = `${q.order_num ?? idx + 1}) ${cleanLabel}`;
            if (q.key === 'utct_no') {
              subRow[header] = utctVal;
            } else if (q.key === 'name') {
              subRow[header] = nameVal;
            } else if (q.key === 'advocate_name_number') {
              subRow[header] = formatAdv(advocateList[k], k);
            } else {
              subRow[header] = '';
            }
          });
          subRow['Survey Date & Time'] = '';
          excelRows.push(subRow);
        }
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // Calculate dynamic column widths
    const colWidths = [{ wch: 6 }];
    questions.forEach((q, idx) => {
      const cleanLabel = (q.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
      const header = `${q.order_num ?? idx + 1}) ${cleanLabel}`;
      colWidths.push({ wch: Math.min(Math.max(header.length + 4, 18), 45) });
    });
    colWidths.push({ wch: 22 });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prisoner Survey Data');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Prisoner_Survey_Report_${Date.now()}.xlsx"`);
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

// 9b. Court Types CRUD (Add, Edit, Delete, List)
app.get('/api/court-types', (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM court_types ORDER BY id ASC').all();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/court-types', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Court type name is required' });
    }
    const cleanName = name.trim();
    const existing = db.prepare('SELECT id FROM court_types WHERE LOWER(name) = LOWER(?)').get(cleanName);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Court type already exists!' });
    }
    const result = db.prepare('INSERT INTO court_types (name) VALUES (?)').run(cleanName);
    const created = db.prepare('SELECT * FROM court_types WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, message: 'Court type added successfully', data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/court-types/:id', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Court type name is required' });
    }
    const cleanName = name.trim();
    const id = req.params.id;
    const existing = db.prepare('SELECT id FROM court_types WHERE LOWER(name) = LOWER(?) AND id != ?').get(cleanName, id);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Court type already exists with this name!' });
    }
    const result = db.prepare('UPDATE court_types SET name = ? WHERE id = ?').run(cleanName, id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Court type not found' });
    }
    res.json({ success: true, message: 'Court type updated successfully', data: { id: Number(id), name: cleanName } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/court-types/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM court_types WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Court type not found' });
    }
    res.json({ success: true, message: 'Court type removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 10. Questions CRUD & Numbering Management
app.get('/api/questions', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM questions ORDER BY order_num ASC, id ASC').all();
    const formatted = rows.map((q) => {
      let options = null;
      if (q.options) {
        try {
          options = JSON.parse(q.options);
        } catch (e) {
          options = q.options.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
      return {
        ...q,
        required: Boolean(q.required),
        is_custom: Boolean(q.is_custom),
        options
      };
    });
    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/questions', (req, res) => {
  try {
    let { order_num, label, placeholder, type, options, required, note, key } = req.body;
    if (!label || !label.trim()) {
      return res.status(400).json({ success: false, message: 'Question label / text is required' });
    }

    // Determine order_num
    if (!order_num || isNaN(order_num)) {
      const maxOrder = db.prepare('SELECT MAX(order_num) as max_o FROM questions').get().max_o;
      order_num = (maxOrder || 0) + 1;
    } else {
      order_num = Number(order_num);
    }

    // Format options as JSON string
    let optionsStr = null;
    if (Array.isArray(options)) {
      optionsStr = JSON.stringify(options);
    } else if (typeof options === 'string' && options.trim()) {
      optionsStr = JSON.stringify(options.split(',').map((s) => s.trim()).filter(Boolean));
    }

    // Generate unique key if not supplied
    if (!key || !key.trim()) {
      const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
      key = `custom_${slug}_${Date.now()}`;
    } else {
      key = key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
      const existingKey = db.prepare('SELECT id FROM questions WHERE key = ?').get(key);
      if (existingKey) {
        key = `${key}_${Date.now()}`;
      }
    }

    const insert = db.prepare(`
      INSERT INTO questions (order_num, key, label, placeholder, type, options, required, note, is_custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = insert.run(
      order_num,
      key,
      label.trim(),
      placeholder ? placeholder.trim() : '',
      type || 'text',
      optionsStr,
      required ? 1 : 0,
      note ? note.trim() : ''
    );

    const created = db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid);
    res.json({
      success: true,
      message: 'Question added successfully',
      data: {
        ...created,
        required: Boolean(created.required),
        options: optionsStr ? JSON.parse(optionsStr) : null
      }
    });
  } catch (err) {
    console.error('Error adding question:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/questions/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    let { order_num, label, placeholder, type, options, required, note } = req.body;

    const newOrderNum = (order_num !== undefined && !isNaN(order_num)) ? Number(order_num) : existing.order_num;
    const newLabel = label !== undefined ? label.trim() : existing.label;
    const newPlaceholder = placeholder !== undefined ? placeholder.trim() : existing.placeholder;
    const newType = type || existing.type;
    const newRequired = required !== undefined ? (required ? 1 : 0) : existing.required;
    const newNote = note !== undefined ? note.trim() : existing.note;

    let optionsStr = existing.options;
    if (options !== undefined) {
      if (Array.isArray(options)) {
        optionsStr = JSON.stringify(options);
      } else if (typeof options === 'string') {
        optionsStr = JSON.stringify(options.split(',').map((s) => s.trim()).filter(Boolean));
      } else {
        optionsStr = null;
      }
    }

    db.prepare(`
      UPDATE questions SET
        order_num = ?,
        label = ?,
        placeholder = ?,
        type = ?,
        options = ?,
        required = ?,
        note = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newOrderNum, newLabel, newPlaceholder, newType, optionsStr, newRequired, newNote, id);

    const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    res.json({
      success: true,
      message: 'Question updated successfully',
      data: {
        ...updated,
        required: Boolean(updated.required),
        options: optionsStr ? JSON.parse(optionsStr) : null
      }
    });
  } catch (err) {
    console.error('Error updating question:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/questions/:id', (req, res) => {
  try {
    const id = req.params.id;
    const result = db.prepare('DELETE FROM questions WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    res.json({ success: true, message: 'Question deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Batch reorder / set numbering
app.post('/api/questions/reorder', (req, res) => {
  try {
    const { items } = req.body; // array of { id, order_num, label? }
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array required' });
    }

    const updateStmt = db.prepare('UPDATE questions SET order_num = ?, label = COALESCE(?, label) WHERE id = ?');
    const updateMany = db.transaction((list) => {
      for (const item of list) {
        updateStmt.run(Number(item.order_num), item.label || null, item.id);
      }
    });
    updateMany(items);

    const updatedList = db.prepare('SELECT * FROM questions ORDER BY order_num ASC, id ASC').all();
    res.json({ success: true, message: 'Question numbering updated successfully', data: updatedList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reset questions to default 24
app.post('/api/questions/reset', (req, res) => {
  try {
    db.prepare('DELETE FROM questions').run();
    // Re-run db init seed
    const { initDB } = require('./db');
    // Note: initDB was already executed, we can re-insert defaults
    const defaultQuestions = [
      { order_num: 1, key: 'utct_no', label: '1) UT/CT No.', placeholder: 'e.g. UT/2026/104 or CT/2026/89', type: 'text', required: 1, options: null, note: 'Note:- Unique ID. System will verify against database before proceeding.', is_custom: 0 },
      { order_num: 2, key: 'name', label: '2) Name', placeholder: 'Enter prisoner full name', type: 'text', required: 1, options: null, note: 'Note:- Please enter prisoner full name.', is_custom: 0 },
      { order_num: 3, key: 'case_type', label: '3) Case type / how you type of advocate to hire', placeholder: 'Select one or more case types', type: 'multi-select', required: 1, options: null, note: 'Note:- You can select multiple case types from the dropdown managed on the home page.', is_custom: 0 },
      { order_num: 4, key: 'total_cases', label: '4) Total number of cases', placeholder: 'e.g. 1, 2, 3', type: 'number', required: 1, options: null, note: 'Note:- Input only Numbers', is_custom: 0 },
      { order_num: 5, key: 'case_duration', label: '5) How long these cases are running', placeholder: 'e.g. 6 Months, 2 Years, 1 Year 4 Months', type: 'text', required: 1, options: null, note: 'Note:- Specify duration (months / years).', is_custom: 0 },
      { order_num: 6, key: 'total_advocates_hired', label: '6) Total advocate hired till date', placeholder: 'e.g. 0, 1, 2', type: 'number', required: 1, options: null, note: 'Note:- Input only Numbers', is_custom: 0 },
      { order_num: 7, key: 'times_in_jail', label: '7) How many time come to jail', placeholder: 'e.g. 1, 2, 3', type: 'number', required: 1, options: null, note: 'Note:- Input only Numbers', is_custom: 0 },
      { order_num: 8, key: 'advocate_name_number', label: '8) Advocate name and number', placeholder: 'e.g. Adv. R.K. Gupta (+91 9876543210)', type: 'text', required: 0, options: null, note: 'Note:- Enter current or previous advocate name and phone number.', is_custom: 0 },
      { order_num: 9, key: 'known_unknown_advocate', label: '9) Known / unknown Advocate', placeholder: 'Known or Unknown', type: 'yesno_or_choice', required: 0, options: JSON.stringify(['Known', 'Unknown', 'Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 10, key: 'high_court_advocate', label: '10) High court advocate', placeholder: 'Yes or No', type: 'yesno', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 11, key: 'advocate_payment_advance', label: '11) Advocate payment advance', placeholder: "Type 'Yes' or 'No'", type: 'yesno_advance', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 12, key: 'first_advocate_by_io', label: '12) First Advocate hired by IO', placeholder: 'Yes or No', type: 'yesno', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 13, key: 'know_case_process', label: '13) Do you know process, when case started, first and next step', placeholder: 'Yes or No', type: 'yesno', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 14, key: 'lawyer_collects_details_evidence', label: '14) Does your lawyer ask, all details about your case, and collect evidence', placeholder: 'Yes or No', type: 'yesno', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 15, key: 'know_fees_reasonable', label: '15) How do you know, lawyer jo fees le raha hai, vo sahi hai', placeholder: 'Yes or No / Details', type: 'yesno_text', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 16, key: 'complete_fees_total_initially', label: '16) Does it give, complete fees total, initially', placeholder: "Type 'Yes' or 'No'", type: 'yesno_advance', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No (If Yes, specify complete fees amount)', is_custom: 0 },
      { order_num: 17, key: 'work_transparency_tracking', label: '17) Work transparency and tracking of lawyer work', placeholder: 'Yes or No', type: 'yesno', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 18, key: 'know_legal_step_correct', label: '18) Kya apko pata hai, jo legal step lawyer process kar raha hai, vo sab sahi hai, kuch miss toh nahi kar raha', placeholder: 'Yes or No', type: 'yesno', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 19, key: 'case_prolonged_expensive', label: '19) Because of some extra unwanted step, kya lawyer ki wajah se, case lamba chala aur expensive ho gaya', placeholder: 'Yes or No', type: 'yesno', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 20, key: 'pairvi_knowledge_reason', label: '20) Parivi karwane ko knowledge hai ya nahi, aur kyun parivi karta hai', placeholder: 'Yes or No / Details', type: 'yesno_text', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 21, key: 'court_docs_fees_timing', label: '21) Court ke doc kyun nikalte hai, and uski fees pata hai, aur kya vo aapko time pe miljate hai', placeholder: 'Yes or No / Details', type: 'yesno_text', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 22, key: 'know_trustworthy_platform', label: '22) Do you know any platform, jo aapko pairvi karne wala de, and jo guarantee de ki, jo adv provide karega, jo trustworthy hoga', placeholder: 'Yes or No', type: 'yesno', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls enter Only Yes or No', is_custom: 0 },
      { order_num: 23, key: 'priority_money_vs_release', label: '23) Your priority, ki paise bachana hai ya jail se bahar jaldi jana hai', placeholder: 'Select priority', type: 'choice_text', required: 0, options: JSON.stringify(['Jail se bahar jaldi jana', 'Paise bachana']), note: 'Note:- Please select only one of the 2 options: Jail se bahar jaldi jana OR Paise bachana', is_custom: 0 },
      { order_num: 24, key: 'prisoner_psychologic_survey', label: '24) Prisoner psychologic according Survey', placeholder: 'Select Yes or No, and add remarks (optional)...', type: 'psychologic_yesno', required: 0, options: JSON.stringify(['Yes', 'No']), note: 'Note:- Pls select Yes or No (Remarks optional)', is_custom: 0 }
    ];
    const insertQ = db.prepare(`
      INSERT INTO questions (order_num, key, label, placeholder, type, required, options, note, is_custom)
      VALUES (@order_num, @key, @label, @placeholder, @type, @required, @options, @note, @is_custom)
    `);
    const insertManyQ = db.transaction((qs) => {
      for (const q of qs) insertQ.run(q);
    });
    insertManyQ(defaultQuestions);
    res.json({ success: true, message: 'Questions reset to default 24 successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// ADVOCATE QUESTIONS CRUD & MANAGEMENT
// ==========================================
app.get('/api/advocate-questions', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM advocate_questions ORDER BY order_num ASC, id ASC').all();
    const formatted = rows.map((q) => {
      let options = null;
      if (q.options) {
        try {
          options = JSON.parse(q.options);
        } catch (e) {
          options = q.options.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
      return {
        ...q,
        required: Boolean(q.required),
        is_custom: Boolean(q.is_custom),
        options
      };
    });
    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/advocate-questions', (req, res) => {
  try {
    let { order_num, label, placeholder, type, options, required, note, key } = req.body;
    if (!label || !label.trim()) {
      return res.status(400).json({ success: false, message: 'Question label / text is required' });
    }

    if (!order_num || isNaN(order_num)) {
      const maxOrder = db.prepare('SELECT MAX(order_num) as max_o FROM advocate_questions').get().max_o;
      order_num = (maxOrder || 0) + 1;
    } else {
      order_num = Number(order_num);
    }

    let optionsStr = null;
    if (options) {
      if (typeof options === 'string') {
        try {
          optionsStr = JSON.stringify(JSON.parse(options));
        } catch (e) {
          optionsStr = JSON.stringify(options.split(',').map((s) => s.trim()).filter(Boolean));
        }
      } else if (Array.isArray(options)) {
        optionsStr = JSON.stringify(options);
      }
    }

    if (!key || !key.trim()) {
      key = 'adv_custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    } else {
      key = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const existingKey = db.prepare('SELECT id FROM advocate_questions WHERE key = ?').get(key);
      if (existingKey) {
        key = key + '_' + Date.now();
      }
    }

    const cleanLabel = (label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
    const numberedLabel = `${order_num}) ${cleanLabel}`;

    const insert = db.prepare(`
      INSERT INTO advocate_questions (order_num, key, label, placeholder, type, options, required, note, is_custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = insert.run(
      order_num,
      key,
      numberedLabel,
      placeholder ? placeholder.trim() : '',
      type || 'text',
      optionsStr,
      required ? 1 : 0,
      note ? note.trim() : ''
    );

    const created = db.prepare('SELECT * FROM advocate_questions WHERE id = ?').get(result.lastInsertRowid);
    res.json({
      success: true,
      message: 'Advocate question added successfully',
      data: {
        ...created,
        required: Boolean(created.required),
        is_custom: Boolean(created.is_custom),
        options: optionsStr ? JSON.parse(optionsStr) : null
      }
    });
  } catch (err) {
    console.error('Error adding advocate question:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/advocate-questions/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM advocate_questions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    let { order_num, label, placeholder, type, options, required, note } = req.body;
    order_num = order_num !== undefined && !isNaN(order_num) ? Number(order_num) : existing.order_num;
    let finalLabel = label ? label.trim() : existing.label;
    if (label) {
      const cleanLabel = label.replace(/^\d+[\)\.\-]\s*/, '').trim();
      finalLabel = `${order_num}) ${cleanLabel}`;
    }

    let optionsStr = existing.options;
    if (options !== undefined) {
      if (options === null) {
        optionsStr = null;
      } else if (typeof options === 'string') {
        try {
          optionsStr = JSON.stringify(JSON.parse(options));
        } catch (e) {
          optionsStr = JSON.stringify(options.split(',').map((s) => s.trim()).filter(Boolean));
        }
      } else if (Array.isArray(options)) {
        optionsStr = JSON.stringify(options);
      }
    }

    const update = db.prepare(`
      UPDATE advocate_questions SET
        order_num = ?,
        label = ?,
        placeholder = ?,
        type = ?,
        options = ?,
        required = ?,
        note = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    update.run(
      order_num,
      finalLabel,
      placeholder !== undefined ? placeholder : existing.placeholder,
      type !== undefined ? type : existing.type,
      optionsStr,
      required !== undefined ? (required ? 1 : 0) : existing.required,
      note !== undefined ? note : existing.note,
      id
    );

    const updated = db.prepare('SELECT * FROM advocate_questions WHERE id = ?').get(id);
    res.json({
      success: true,
      message: 'Advocate question updated successfully',
      data: {
        ...updated,
        required: Boolean(updated.required),
        is_custom: Boolean(updated.is_custom),
        options: optionsStr ? JSON.parse(optionsStr) : null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/advocate-questions/:id', (req, res) => {
  try {
    const id = req.params.id;
    const result = db.prepare('DELETE FROM advocate_questions WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    res.json({ success: true, message: 'Advocate question deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/advocate-questions/reorder', (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array required' });
    }

    const updateStmt = db.prepare('UPDATE advocate_questions SET order_num = ?, label = COALESCE(?, label) WHERE id = ?');
    const updateMany = db.transaction((list) => {
      for (const item of list) {
        updateStmt.run(Number(item.order_num), item.label || null, item.id);
      }
    });
    updateMany(items);

    const updatedList = db.prepare('SELECT * FROM advocate_questions ORDER BY order_num ASC, id ASC').all();
    res.json({ success: true, message: 'Advocate questions reordered successfully', data: updatedList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/advocate-questions/reset', (req, res) => {
  try {
    db.prepare('DELETE FROM advocate_questions').run();
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
    res.json({ success: true, message: 'Advocate questions reset to default successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// ADVOCATE SURVEY CRUD & EXPORT
// ==========================================

// Check Advocate Registration No. uniqueness
app.get('/api/advocate-survey/check-reg', (req, res) => {
  const regNo = (req.query.no || req.query.regNo || '').trim();
  const currentId = req.query.excludeId;

  if (!regNo) {
    return res.json({ exists: false, message: 'No Registration No provided' });
  }

  let query = 'SELECT id, advocate_reg_no, name FROM advocate_surveys WHERE LOWER(TRIM(advocate_reg_no)) = LOWER(TRIM(?))';
  let params = [regNo];

  if (currentId) {
    query += ' AND id != ?';
    params.push(currentId);
  }

  const existing = db.prepare(query).get(...params);
  if (existing) {
    return res.json({
      exists: true,
      message: `Advocate Reg No. "${regNo}" already exists in database (Advocate: ${existing.name})!`,
      survey: existing
    });
  }

  return res.json({ exists: false, message: 'Registration No. is available.' });
});

// List Advocate Surveys
app.get('/api/advocate-survey/list', (req, res) => {
  try {
    const search = (req.query.q || '').trim();
    let query = 'SELECT * FROM advocate_surveys';
    let params = [];

    if (search) {
      query += ` WHERE 
        advocate_reg_no LIKE ? OR 
        name LIKE ? OR 
        contact_number LIKE ? OR 
        primary_court LIKE ? OR
        case_specialization LIKE ? OR
        remarks LIKE ? OR
        custom_answers LIKE ?
      `;
      const p = `%${search}%`;
      params = [p, p, p, p, p, p, p];
    }

    query += ' ORDER BY id DESC';
    const rows = db.prepare(query).all(...params);
    const surveys = rows.map(formatAdvocateSurvey);
    res.json({ success: true, count: surveys.length, data: surveys });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Single Advocate Survey
app.get('/api/advocate-survey/:id', (req, res) => {
  try {
    const survey = db.prepare('SELECT * FROM advocate_surveys WHERE id = ?').get(req.params.id);
    if (!survey) {
      return res.status(404).json({ success: false, message: 'Advocate survey not found' });
    }
    res.json({ success: true, data: formatAdvocateSurvey(survey) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add Advocate Survey
app.post('/api/advocate-survey/add', (req, res) => {
  try {
    const data = req.body;
    if (!data.name || !data.name.trim()) {
      return res.status(400).json({ success: false, message: 'Advocate Name is required!' });
    }

    if (data.advocate_reg_no && data.advocate_reg_no.trim()) {
      const existing = db.prepare('SELECT id FROM advocate_surveys WHERE LOWER(TRIM(advocate_reg_no)) = LOWER(TRIM(?))').get(data.advocate_reg_no.trim());
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Advocate Reg No. "${data.advocate_reg_no}" already exists in the database!`
        });
      }
    }

    const customJson = extractAdvocateCustomAnswers(data);

    const insert = db.prepare(`
      INSERT INTO advocate_surveys (
        advocate_reg_no, name, contact_number, office_address,
        primary_court, practice_experience_years, case_specialization,
        regularly_handles_undertrial_cases, provides_legal_aid_dlsa,
        transparent_fee_structure, average_case_duration,
        parivi_assistance_knowledge, remarks, custom_answers
      ) VALUES (
        @advocate_reg_no, @name, @contact_number, @office_address,
        @primary_court, @practice_experience_years, @case_specialization,
        @regularly_handles_undertrial_cases, @provides_legal_aid_dlsa,
        @transparent_fee_structure, @average_case_duration,
        @parivi_assistance_knowledge, @remarks, @custom_answers
      )
    `);

    const result = insert.run({
      advocate_reg_no: (data.advocate_reg_no || '').trim(),
      name: (data.name || '').trim(),
      contact_number: (data.contact_number || '').trim(),
      office_address: (data.office_address || '').trim(),
      primary_court: data.primary_court || '',
      practice_experience_years: Number(data.practice_experience_years) || 0,
      case_specialization: Array.isArray(data.case_specialization) ? data.case_specialization.join(', ') : (data.case_specialization || ''),
      regularly_handles_undertrial_cases: data.regularly_handles_undertrial_cases || '',
      provides_legal_aid_dlsa: data.provides_legal_aid_dlsa || '',
      transparent_fee_structure: data.transparent_fee_structure || '',
      average_case_duration: data.average_case_duration || '',
      parivi_assistance_knowledge: data.parivi_assistance_knowledge || '',
      remarks: data.remarks || '',
      custom_answers: customJson
    });

    const newRecord = db.prepare('SELECT * FROM advocate_surveys WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, message: 'Advocate survey saved successfully!', data: formatAdvocateSurvey(newRecord) });
  } catch (err) {
    console.error('Error adding advocate survey:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// Update Advocate Survey
app.put('/api/advocate-survey/:id', (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;

    const existing = db.prepare('SELECT * FROM advocate_surveys WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Advocate survey not found' });
    }

    if (data.advocate_reg_no && data.advocate_reg_no.trim()) {
      const duplicate = db.prepare('SELECT id FROM advocate_surveys WHERE LOWER(TRIM(advocate_reg_no)) = LOWER(TRIM(?)) AND id != ?').get(data.advocate_reg_no.trim(), id);
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Advocate Reg No. "${data.advocate_reg_no}" already exists in another record!` });
      }
    }

    let existingCustom = {};
    if (existing.custom_answers) {
      try { existingCustom = JSON.parse(existing.custom_answers); } catch (e) {}
    }
    const customJson = extractAdvocateCustomAnswers(data, existingCustom);

    const update = db.prepare(`
      UPDATE advocate_surveys SET
        advocate_reg_no = @advocate_reg_no,
        name = @name,
        contact_number = @contact_number,
        office_address = @office_address,
        primary_court = @primary_court,
        practice_experience_years = @practice_experience_years,
        case_specialization = @case_specialization,
        regularly_handles_undertrial_cases = @regularly_handles_undertrial_cases,
        provides_legal_aid_dlsa = @provides_legal_aid_dlsa,
        transparent_fee_structure = @transparent_fee_structure,
        average_case_duration = @average_case_duration,
        parivi_assistance_knowledge = @parivi_assistance_knowledge,
        remarks = @remarks,
        custom_answers = @custom_answers,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);

    update.run({
      id,
      advocate_reg_no: (data.advocate_reg_no || '').trim(),
      name: (data.name || '').trim(),
      contact_number: (data.contact_number || '').trim(),
      office_address: (data.office_address || '').trim(),
      primary_court: data.primary_court || '',
      practice_experience_years: Number(data.practice_experience_years) || 0,
      case_specialization: Array.isArray(data.case_specialization) ? data.case_specialization.join(', ') : (data.case_specialization || ''),
      regularly_handles_undertrial_cases: data.regularly_handles_undertrial_cases || '',
      provides_legal_aid_dlsa: data.provides_legal_aid_dlsa || '',
      transparent_fee_structure: data.transparent_fee_structure || '',
      average_case_duration: data.average_case_duration || '',
      parivi_assistance_knowledge: data.parivi_assistance_knowledge || '',
      remarks: data.remarks || '',
      custom_answers: customJson
    });

    const updatedRecord = db.prepare('SELECT * FROM advocate_surveys WHERE id = ?').get(id);
    res.json({ success: true, message: 'Advocate survey updated successfully!', data: formatAdvocateSurvey(updatedRecord) });
  } catch (err) {
    console.error('Error updating advocate survey:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Advocate Survey
app.delete('/api/advocate-survey/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM advocate_surveys WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Advocate survey record not found' });
    }
    res.json({ success: true, message: 'Advocate survey record deleted successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Export Advocate Survey Excel
app.get('/api/advocate-survey/export/excel', (req, res) => {
  try {
    const search = (req.query.q || '').trim();
    let query = 'SELECT * FROM advocate_surveys';
    let params = [];

    if (search) {
      query += ` WHERE advocate_reg_no LIKE ? OR name LIKE ? OR contact_number LIKE ? OR primary_court LIKE ?`;
      const p = `%${search}%`;
      params = [p, p, p, p];
    }
    query += ' ORDER BY id ASC';

    const records = db.prepare(query).all(...params).map(formatAdvocateSurvey);
    const questions = db.prepare('SELECT * FROM advocate_questions ORDER BY order_num ASC, id ASC').all();

    const excelRows = records.map((r, index) => {
      const row = { 'S.No': index + 1 };
      questions.forEach((q, idx) => {
        const cleanLabel = (q.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
        const header = `${q.order_num ?? idx + 1}) ${cleanLabel}`;
        let val = r[q.key];
        if (val === undefined || val === null || val === '') {
          if (r.custom_answers) {
            try {
              const ca = JSON.parse(r.custom_answers);
              if (ca[q.key] !== undefined && ca[q.key] !== null) val = ca[q.key];
            } catch (e) {}
          }
        }
        if (val === undefined || val === null) val = '';
        if (Array.isArray(val)) val = val.join(', ');
        row[header] = val;
      });
      row['Survey Date & Time'] = r.created_at || '';
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    const colWidths = [{ wch: 6 }];
    questions.forEach((q, idx) => {
      const cleanLabel = (q.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
      const header = `${q.order_num ?? idx + 1}) ${cleanLabel}`;
      colWidths.push({ wch: Math.min(Math.max(header.length + 4, 18), 45) });
    });
    colWidths.push({ wch: 22 });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Advocate Survey Data');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Advocate_Survey_Report_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting advocate excel:', err);
    res.status(500).json({ success: false, message: 'Failed to export advocate survey report.' });
  }
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`   SURVEY PORTAL SERVER RUNNING ON PORT ${PORT} `);
  console.log(`   Login: meet / New@1020                      `);
  console.log(`===============================================`);
});
