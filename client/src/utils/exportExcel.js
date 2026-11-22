import * as XLSX from 'xlsx';
import { getQuestionLabel, SURVEY_QUESTIONS } from '../data/questions';
import { resolveAnswerForRecord, resolveQuestionRemark, formatAnswerWithRemark } from './resolveSurveyAnswer';

export function formatSingleAdvocate(a, index) {
  if (!a) return '';
  if (a.raw) {
    if (/^\[\d+\]/.test(a.raw)) return a.raw;
    return `[${index + 1}] ${a.raw}`;
  }
  const parts = [];
  if (a.name) parts.push(`Name: ${String(a.name).trim()}`);
  if (a.fee) parts.push(`Fee: ₹${a.fee}`);
  if (a.experience) parts.push(`Exp: ${a.experience}`);
  if (a.known) parts.push(`Known: ${a.known}`);
  if (a.court_type) parts.push(`Court: ${a.court_type}`);
  return `[${index + 1}] ${parts.join(' | ')}`;
}

export function extractAdvocateList(r) {
  let list = [];

  // 1. Direct advocates_details array or JSON string
  if (r.advocates_details) {
    try {
      list = typeof r.advocates_details === 'string' ? JSON.parse(r.advocates_details) : r.advocates_details;
    } catch (e) {}
  }

  // 2. Fallback to custom_answers.advocates_details
  if ((!Array.isArray(list) || list.length === 0) && r.custom_answers) {
    try {
      const ca = typeof r.custom_answers === 'string' ? JSON.parse(r.custom_answers) : r.custom_answers;
      if (ca?.advocates_details) {
        list = typeof ca.advocates_details === 'string' ? JSON.parse(ca.advocates_details) : ca.advocates_details;
      }
    } catch (e) {}
  }

  // 3. Fallback: Check if advocate_name_number itself is a JSON array string
  if ((!Array.isArray(list) || list.length === 0) && typeof r.advocate_name_number === 'string') {
    const trimmed = r.advocate_name_number.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
          list = parsed;
        }
      } catch (e) {}
    }
  }

  // 4. Fallback: Parse formatted multi-advocate text: e.g. "[1] Name: ... | Fee: ... ; [2] Name: ... | Fee: ..."
  if ((!Array.isArray(list) || list.length === 0) && typeof r.advocate_name_number === 'string') {
    const text = r.advocate_name_number;
    if (text.includes('[1]') && text.includes('[2]')) {
      const chunks = text
        .split(/(?=\[\d+\])/g)
        .map((s) => s.trim().replace(/^;\s*/, ''))
        .filter(Boolean);
      if (chunks.length > 1) {
        list = chunks.map((c) => ({ raw: c }));
      }
    }
  }

  if (!Array.isArray(list)) list = [];
  return list.filter((a) => a && (a.raw || a.name || a.fee || a.experience || a.known || a.court_type));
}

export function downloadSurveyExcel(
  records,
  filename = 'Prisoner_Survey_Report.xlsx',
  customQuestions = null,
  options = { mode: 'multi-row' }
) {
  if (!records || records.length === 0) {
    alert('No survey records to export!');
    return;
  }

  const exportMode = (typeof options === 'string' ? options : options?.mode) || 'multi-row';

  // 1. Resolve questions list
  const qList = (Array.isArray(customQuestions) && customQuestions.length > 0)
    ? customQuestions
    : SURVEY_QUESTIONS;

  const sortedQuestions = [...qList].sort(
    (a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0)
  );

  const excelRows = [];

  records.forEach((r, recordIndex) => {
    const advocateList = extractAdvocateList(r);

    let utctVal = r.utct_no || '';
    let nameVal = r.name || '';

    // ==========================================
    // MODE A: SINGLE LINE (1 Row per Prisoner)
    // ==========================================
    if (exportMode === 'single-line') {
      const singleRow = { 'S.No': recordIndex + 1 };
      sortedQuestions.forEach((q, idx) => {
        const header = getQuestionLabel(q, idx);
        if (q.key === 'utct_no') {
          const val = resolveAnswerForRecord(r, q, sortedQuestions);
          singleRow[header] = val || utctVal;
        } else if (q.key === 'name') {
          const val = resolveAnswerForRecord(r, q, sortedQuestions);
          singleRow[header] = val || nameVal;
        } else if (q.key === 'advocate_name_number') {
          if (advocateList.length > 0) {
            singleRow[header] = advocateList.map((a, i) => formatSingleAdvocate(a, i)).join(' ; \n');
          } else {
            singleRow[header] = resolveAnswerForRecord(r, q, sortedQuestions) || '';
          }
        } else {
          const rawVal = resolveAnswerForRecord(r, q, sortedQuestions);
          const remark = resolveQuestionRemark(r, q);
          const val = formatAnswerWithRemark(rawVal, remark);
          singleRow[header] = val || '';
        }
      });
      singleRow['Survey Date & Time'] = r.created_at || '';
      excelRows.push(singleRow);
      return; // done for this record
    }

    // ==========================================
    // MODE B: MULTI-ROW (Repeat UT/CT No & Name)
    // ==========================================
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
          const rawVal = resolveAnswerForRecord(r, q, sortedQuestions) || '';
          const remark = resolveQuestionRemark(r, q);
          firstRow[header] = formatAnswerWithRemark(rawVal, remark);
        }
      } else {
        const rawVal = resolveAnswerForRecord(r, q, sortedQuestions);
        const remark = resolveQuestionRemark(r, q);
        const val = formatAnswerWithRemark(rawVal, remark);
        firstRow[header] = val || '';
      }
    });

    firstRow['Survey Date & Time'] = r.created_at || '';
    excelRows.push(firstRow);

    // Multi-advocate expansion: Rows 2..N for this prisoner
    if (advocateList.length > 1) {
      for (let k = 1; k < advocateList.length; k++) {
        const subRow = { 'S.No': '' }; // Blank S.No
        sortedQuestions.forEach((q, idx) => {
          const header = getQuestionLabel(q, idx);
          if (q.key === 'utct_no') {
            subRow[header] = utctVal; // Repeated UT/CT No
          } else if (q.key === 'name') {
            subRow[header] = nameVal; // Repeated Name
          } else if (q.key === 'advocate_name_number') {
            subRow[header] = formatSingleAdvocate(advocateList[k], k); // [2] Name: ...
          } else {
            subRow[header] = ''; // Blank for all other questions
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
