import * as XLSX from 'xlsx';
import { getAdvocateQuestionLabel, ADVOCATE_SURVEY_QUESTIONS, ADVOCATE_STANDARD_KEYS } from '../data/advocateQuestions';
import { resolveQuestionRemark, formatAnswerWithRemark } from './resolveSurveyAnswer';

export function resolveAdvocateAnswer(r, q, allQuestions = []) {
  if (!r || !q) return '';

  // 1. Direct record property
  if (r[q.key] !== undefined && r[q.key] !== null && String(r[q.key]).trim() !== '') {
    const val = r[q.key];
    return Array.isArray(val) ? val.join(', ') : String(val);
  }

  // 2. Parse custom_answers JSON from server
  let customAnswers = {};
  if (r.custom_answers) {
    if (typeof r.custom_answers === 'string') {
      try { customAnswers = JSON.parse(r.custom_answers); } catch (e) {}
    } else if (typeof r.custom_answers === 'object') {
      customAnswers = r.custom_answers;
    }
  }

  if (customAnswers[q.key] !== undefined && customAnswers[q.key] !== null && String(customAnswers[q.key]).trim() !== '') {
    const val = customAnswers[q.key];
    return Array.isArray(val) ? val.join(', ') : String(val);
  }

  // 3. LocalStorage cache check
  let localCached = {};
  try {
    const regKey = String(r.advocate_reg_no || r.id || '').trim().toLowerCase();
    if (regKey) {
      const localMap = JSON.parse(localStorage.getItem('local_advocate_survey_answers_map') || '{}');
      if (localMap[regKey]) localCached = localMap[regKey];
    }
  } catch (e) {}

  if (localCached[q.key] !== undefined && localCached[q.key] !== null && String(localCached[q.key]).trim() !== '') {
    const val = localCached[q.key];
    return Array.isArray(val) ? val.join(', ') : String(val);
  }

  // 4. Fuzzy match by sanitized label/slug
  const pool = { ...localCached, ...customAnswers, ...r };
  const cleanQLabel = (q.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanQLabel) {
    for (const [k, v] of Object.entries(pool)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        const cleanK = k.replace(/^adv_custom_/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanK && (cleanK === cleanQLabel || cleanK.includes(cleanQLabel) || cleanQLabel.includes(cleanK))) {
          return Array.isArray(v) ? v.join(', ') : String(v);
        }
      }
    }
  }

  return '';
}

export function downloadAdvocateExcel(records, filename = 'Advocate_Survey_Report.xlsx', customQuestions = null) {
  if (!records || records.length === 0) {
    alert('No advocate survey records to export!');
    return;
  }

  // 1. Resolve questions list: priority passed prop -> localStorage -> default ADVOCATE_SURVEY_QUESTIONS
  let qList = Array.isArray(customQuestions) && customQuestions.length > 0 ? customQuestions : null;
  if (!qList) {
    try {
      const saved = localStorage.getItem('advocate_questions_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          qList = parsed;
        }
      }
    } catch (e) {}
  }

  if (!qList || qList.length === 0) {
    qList = ADVOCATE_SURVEY_QUESTIONS;
  }

  const sortedQuestions = [...qList].sort(
    (a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0)
  );

  // 2. Format each record into an Excel row with dynamic question headers
  const excelRows = records.map((r, index) => {
    const row = { 'S.No': index + 1 };

    sortedQuestions.forEach((q, idx) => {
      const header = getAdvocateQuestionLabel(q, idx);
      const rawVal = resolveAdvocateAnswer(r, q, sortedQuestions);
      const remark = resolveQuestionRemark(r, q);
      const val = formatAnswerWithRemark(rawVal, remark);
      row[header] = val || '';
    });

    row['Survey Date & Time'] = r.created_at || '';
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);

  // Dynamic Column widths
  const keys = Object.keys(excelRows[0] || {});
  worksheet['!cols'] = keys.map((k) => ({
    wch: k === 'S.No' ? 6 : Math.min(Math.max(k.length + 4, 18), 45)
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Advocate Survey Data');
  XLSX.writeFile(workbook, filename);
}
