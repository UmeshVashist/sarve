import * as XLSX from 'xlsx';
import { getQuestionLabel, SURVEY_QUESTIONS } from '../data/questions';
import { resolveAnswerForRecord } from './resolveSurveyAnswer';

function formatSingleAdvocate(a, index) {
  if (!a) return '';
  const parts = [];
  if (a.name) parts.push(`Name: ${String(a.name).trim()}`);
  if (a.fee) parts.push(`Fee: ₹${a.fee}`);
  if (a.experience) parts.push(`Exp: ${a.experience}`);
  if (a.known) parts.push(`Known: ${a.known}`);
  if (a.court_type) parts.push(`Court: ${a.court_type}`);
  return `[${index + 1}] ${parts.join(' | ')}`;
}

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

  // 2. Format records into Excel rows
  // If a record has multiple advocates, expand across multiple rows per Image 3:
  // - Row 1 has S.No, UT/CT No, Name, Advocate 1 details in Column D, all other question answers filled, and Date & Time.
  // - Subsequent rows (Advocate 2, 3...) have BLANK S.No, REPEATED UT/CT No, REPEATED Name, Advocate k details, and BLANK for all other questions.
  const excelRows = [];

  records.forEach((r, recordIndex) => {
    // Parse advocates details
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

    // First row
    const firstRow = { 'S.No': recordIndex + 1 };

    sortedQuestions.forEach((q, idx) => {
      const header = getQuestionLabel(q, idx);
      if (q.key === 'utct_no') {
        const val = resolveAnswerForRecord(r, q, sortedQuestions);
        utctVal = val || utctVal;
        firstRow[header] = utctVal;
      } else if (q.key === 'name') {
        const val = resolveAnswerForRecord(r, q, sortedQuestions);
        nameVal = val || nameVal;
        firstRow[header] = nameVal;
      } else if (q.key === 'advocate_name_number') {
        if (advocateList.length > 0) {
          firstRow[header] = formatSingleAdvocate(advocateList[0], 0);
        } else {
          firstRow[header] = resolveAnswerForRecord(r, q, sortedQuestions) || '';
        }
      } else {
        const val = resolveAnswerForRecord(r, q, sortedQuestions);
        firstRow[header] = val || '';
      }
    });

    firstRow['Survey Date & Time'] = r.created_at || '';
    excelRows.push(firstRow);

    // Multi-advocate expansion: Rows 2..N for this prisoner
    if (advocateList.length > 1) {
      for (let k = 1; k < advocateList.length; k++) {
        const subRow = { 'S.No': '' }; // Blank S.No as in Image 3
        sortedQuestions.forEach((q, idx) => {
          const header = getQuestionLabel(q, idx);
          if (q.key === 'utct_no') {
            subRow[header] = utctVal; // Repeated UT/CT No
          } else if (q.key === 'name') {
            subRow[header] = nameVal; // Repeated Name
          } else if (q.key === 'advocate_name_number') {
            subRow[header] = formatSingleAdvocate(advocateList[k], k); // [2] Name: ...
          } else {
            subRow[header] = ''; // Blank for all other questions as in Image 3
          }
        });
        subRow['Survey Date & Time'] = '';
        excelRows.push(subRow);
      }
    }
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
