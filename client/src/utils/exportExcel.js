import * as XLSX from 'xlsx';
import { getQuestionLabel, SURVEY_QUESTIONS } from '../data/questions';

export function downloadSurveyExcel(records, filename = 'Prisoner_Survey_Report.xlsx', customQuestions = null) {
  if (!records || records.length === 0) {
    alert('No survey records to export!');
    return;
  }

  // 1. Resolve questions list: priority passed prop -> localStorage -> default SURVEY_QUESTIONS
  let qList = Array.isArray(customQuestions) && customQuestions.length > 0 ? customQuestions : null;
  if (!qList) {
    try {
      const saved = localStorage.getItem('survey_questions_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          qList = parsed;
        }
      }
    } catch (e) {}
  }

  if (!qList || qList.length === 0) {
    qList = SURVEY_QUESTIONS;
  }

  const sortedQuestions = [...qList].sort(
    (a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0)
  );

  // 2. Identify any extra custom keys in records not already present in questions
  const knownKeys = new Set(sortedQuestions.map((q) => q.key));
  const extraCustomKeys = new Set();

  records.forEach((r) => {
    let customObj = {};
    if (r.custom_answers) {
      if (typeof r.custom_answers === 'string') {
        try { customObj = JSON.parse(r.custom_answers); } catch (e) {}
      } else if (typeof r.custom_answers === 'object') {
        customObj = r.custom_answers;
      }
    }
    Object.keys(customObj).forEach((k) => {
      if (!knownKeys.has(k)) {
        extraCustomKeys.add(k);
      }
    });
    Object.keys(r).forEach((k) => {
      if (!knownKeys.has(k) && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(k)) {
        extraCustomKeys.add(k);
      }
    });
  });

  // 3. Format each record into an Excel row
  const excelRows = records.map((r, index) => {
    const row = { 'S.No': index + 1 };

    let customAnswers = {};
    if (r.custom_answers) {
      if (typeof r.custom_answers === 'string') {
        try { customAnswers = JSON.parse(r.custom_answers); } catch (e) {}
      } else if (typeof r.custom_answers === 'object') {
        customAnswers = r.custom_answers;
      }
    }

    // Add all sorted configured questions (standard + custom)
    sortedQuestions.forEach((q, idx) => {
      const header = getQuestionLabel(q, idx);
      let val = r[q.key];

      // Check customAnswers if directly undefined on r
      if (val === undefined || val === null || val === '') {
        if (customAnswers[q.key] !== undefined && customAnswers[q.key] !== null) {
          val = customAnswers[q.key];
        }
      }

      if (val === undefined || val === null) {
        val = '';
      } else if (Array.isArray(val)) {
        val = val.join(', ');
      }
      row[header] = val;
    });

    // Add any extra custom answers if present
    extraCustomKeys.forEach((key) => {
      let val = r[key];
      if (val === undefined || val === null || val === '') {
        if (customAnswers[key] !== undefined && customAnswers[key] !== null) {
          val = customAnswers[key];
        }
      }
      if (val === undefined || val === null) {
        val = '';
      } else if (Array.isArray(val)) {
        val = val.join(', ');
      }
      let label = key.replace(/^custom_/, '').replace(/_/g, ' ');
      label = label.charAt(0).toUpperCase() + label.slice(1);
      row[`Custom: ${label}`] = val;
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
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Prisoner Survey Data');
  XLSX.writeFile(workbook, filename);
}
