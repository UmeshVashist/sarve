import * as XLSX from 'xlsx';
import { getQuestionLabel, SURVEY_QUESTIONS } from '../data/questions';
import { resolveAnswerForRecord } from './resolveSurveyAnswer';

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

  // 2. Format each record into an Excel row using multi-layer answer resolver
  const excelRows = records.map((r, index) => {
    const row = { 'S.No': index + 1 };

    sortedQuestions.forEach((q, idx) => {
      const header = getQuestionLabel(q, idx);
      const val = resolveAnswerForRecord(r, q, sortedQuestions);
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
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Prisoner Survey Data');
  XLSX.writeFile(workbook, filename);
}
