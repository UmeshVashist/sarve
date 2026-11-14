import * as XLSX from 'xlsx';
import { getQuestionLabel, SURVEY_QUESTIONS, STANDARD_KEYS } from '../data/questions';

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

  // Load localStorage answers map for fallback
  let localAnswersMap = {};
  try {
    localAnswersMap = JSON.parse(localStorage.getItem('local_survey_answers_map') || '{}');
  } catch (e) {}

  // 2. Format each record into an Excel row
  const excelRows = records.map((r, index) => {
    const row = { 'S.No': index + 1 };

    // Parse server custom answers
    let customAnswers = {};
    if (r.custom_answers) {
      if (typeof r.custom_answers === 'string') {
        try { customAnswers = JSON.parse(r.custom_answers); } catch (e) {}
      } else if (typeof r.custom_answers === 'object') {
        customAnswers = r.custom_answers;
      }
    }

    // Retrieve cached local answers for this record
    const utctKey = String(r.utct_no || '').trim().toLowerCase();
    let localCached = (utctKey && localAnswersMap[utctKey]) ? localAnswersMap[utctKey] : {};
    if (!localCached || Object.keys(localCached).length === 0) {
      try {
        const direct = localStorage.getItem(`survey_answers_${utctKey}`);
        if (direct) localCached = JSON.parse(direct);
      } catch (e) {}
    }

    // Combine all available custom entries in this record
    const allCustomPool = { ...localCached, ...customAnswers };
    Object.keys(r).forEach((k) => {
      if (!STANDARD_KEYS.includes(k) && !['id', 'created_at', 'updated_at', 'custom_answers', 'S.No'].includes(k)) {
        if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
          allCustomPool[k] = r[k];
        }
      }
    });

    // Track which custom keys have been consumed
    const matchedCustomKeys = new Set();

    // Custom questions subset
    const customQuestionsList = sortedQuestions.filter(
      (q) => q.is_custom || !STANDARD_KEYS.includes(q.key)
    );

    // Add all sorted configured questions (standard + custom)
    sortedQuestions.forEach((q, idx) => {
      const header = getQuestionLabel(q, idx);
      let val = undefined;

      // 1. Direct key lookup in r, customAnswers, localCached, allCustomPool
      if (r[q.key] !== undefined && r[q.key] !== null && String(r[q.key]).trim() !== '') {
        val = r[q.key];
        matchedCustomKeys.add(q.key);
      } else if (customAnswers[q.key] !== undefined && customAnswers[q.key] !== null && String(customAnswers[q.key]).trim() !== '') {
        val = customAnswers[q.key];
        matchedCustomKeys.add(q.key);
      } else if (localCached[q.key] !== undefined && localCached[q.key] !== null && String(localCached[q.key]).trim() !== '') {
        val = localCached[q.key];
        matchedCustomKeys.add(q.key);
      } else if (allCustomPool[q.key] !== undefined && allCustomPool[q.key] !== null && String(allCustomPool[q.key]).trim() !== '') {
        val = allCustomPool[q.key];
        matchedCustomKeys.add(q.key);
      }

      // 2. Direct ID lookup if q.id is a string and different
      if ((val === undefined || val === '') && q.id && q.id !== q.key) {
        if (allCustomPool[q.id] !== undefined && String(allCustomPool[q.id]).trim() !== '') {
          val = allCustomPool[q.id];
          matchedCustomKeys.add(q.id);
        }
      }

      // 3. For custom questions: Fuzzy match by sanitized label/slug
      const isCustomQ = q.is_custom || !STANDARD_KEYS.includes(q.key);
      if ((val === undefined || val === '') && isCustomQ) {
        const cleanQLabel = (q.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanQLabel) {
          for (const [k, v] of Object.entries(allCustomPool)) {
            if (v !== undefined && v !== null && String(v).trim() !== '') {
              const cleanK = k.replace(/^custom_/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
              if (cleanK && (cleanK === cleanQLabel || cleanK.includes(cleanQLabel) || cleanQLabel.includes(cleanK))) {
                val = v;
                matchedCustomKeys.add(k);
                break;
              }
            }
          }
        }
      }

      // 4. For custom questions: Positional index fallback
      if ((val === undefined || val === '') && isCustomQ) {
        const customQIndex = customQuestionsList.findIndex((item) => (item.id || item.key) === (q.id || q.key));
        if (customQIndex !== -1) {
          const availableCustomKeys = Object.keys(allCustomPool).filter(
            (k) => !matchedCustomKeys.has(k) && !STANDARD_KEYS.includes(k) && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(k)
          );
          if (availableCustomKeys[customQIndex]) {
            const fallbackKey = availableCustomKeys[customQIndex];
            val = allCustomPool[fallbackKey];
            matchedCustomKeys.add(fallbackKey);
          } else if (availableCustomKeys.length === 1 && customQuestionsList.length === 1) {
            val = allCustomPool[availableCustomKeys[0]];
            matchedCustomKeys.add(availableCustomKeys[0]);
          }
        }
      }

      if (val === undefined || val === null) {
        val = '';
      } else if (Array.isArray(val)) {
        val = val.join(', ');
      }
      row[header] = val;
    });

    // 5. Add any extra unmapped custom answers if present
    Object.keys(allCustomPool).forEach((key) => {
      if (!matchedCustomKeys.has(key) && !STANDARD_KEYS.includes(key) && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(key)) {
        let val = allCustomPool[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          if (Array.isArray(val)) val = val.join(', ');
          let label = key.replace(/^custom_/, '').replace(/_/g, ' ');
          label = label.charAt(0).toUpperCase() + label.slice(1);
          row[`Custom: ${label}`] = val;
        }
      }
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
