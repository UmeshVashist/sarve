import { STANDARD_KEYS } from '../data/questions';

/**
 * Robust multi-layer answer resolver for any survey record and question (standard or custom).
 * Resolves across:
 * 1. Direct record property r[q.key]
 * 2. Server custom_answers JSON object
 * 3. Browser localStorage cached answers map
 * 4. Question ID property
 * 5. Fuzzy match by sanitized label/slug (e.g. 'remark')
 * 6. Positional index matching for custom questions
 */
export function resolveAnswerForRecord(r, q, allQuestions = []) {
  if (!r || !q) return '';

  // 1. Check direct key on record r
  if (r[q.key] !== undefined && r[q.key] !== null && String(r[q.key]).trim() !== '') {
    const val = r[q.key];
    return Array.isArray(val) ? val.join(', ') : String(val);
  }

  // 2. Parse custom_answers from server
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

  // 3. Check browser localStorage cache
  let localCached = {};
  try {
    const utctKey = String(r.utct_no || '').trim().toLowerCase();
    if (utctKey) {
      const localMap = JSON.parse(localStorage.getItem('local_survey_answers_map') || '{}');
      if (localMap[utctKey]) localCached = localMap[utctKey];
      if (!localCached || Object.keys(localCached).length === 0) {
        const direct = localStorage.getItem(`survey_answers_${utctKey}`);
        if (direct) localCached = JSON.parse(direct);
      }
    }
  } catch (e) {}

  if (localCached[q.key] !== undefined && localCached[q.key] !== null && String(localCached[q.key]).trim() !== '') {
    const val = localCached[q.key];
    return Array.isArray(val) ? val.join(', ') : String(val);
  }

  // 4. Check q.id if different from q.key
  if (q.id && q.id !== q.key) {
    const fromId = r[q.id] ?? customAnswers[q.id] ?? localCached[q.id];
    if (fromId !== undefined && fromId !== null && String(fromId).trim() !== '') {
      return Array.isArray(fromId) ? fromId.join(', ') : String(fromId);
    }
  }

  // Pool all available custom answers
  const allCustomPool = { ...localCached, ...customAnswers };
  Object.keys(r).forEach((k) => {
    if (!STANDARD_KEYS.includes(k) && !['id', 'created_at', 'updated_at', 'custom_answers', 'S.No'].includes(k)) {
      if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
        allCustomPool[k] = r[k];
      }
    }
  });

  // 5. Fuzzy match by sanitized label/slug (especially for 'Remark', 'notes', etc.)
  const cleanQLabel = (q.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanQLabel) {
    for (const [k, v] of Object.entries(allCustomPool)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        const cleanK = k.replace(/^custom_/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanK && (cleanK === cleanQLabel || cleanK.includes(cleanQLabel) || cleanQLabel.includes(cleanK))) {
          return Array.isArray(v) ? v.join(', ') : String(v);
        }
      }
    }
  }

  // 6. Positional index fallback for custom questions
  const customQuestions = (allQuestions || []).filter(
    (item) => item.is_custom || !STANDARD_KEYS.includes(item.key)
  );
  if (customQuestions.length > 0) {
    const qIdx = customQuestions.findIndex((item) => (item.id || item.key) === (q.id || q.key));
    if (qIdx !== -1) {
      const customKeys = Object.keys(allCustomPool).filter(
        (k) => !STANDARD_KEYS.includes(k) && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(k)
      );
      if (customKeys[qIdx] && allCustomPool[customKeys[qIdx]] !== undefined) {
        const val = allCustomPool[customKeys[qIdx]];
        return Array.isArray(val) ? val.join(', ') : String(val);
      } else if (customKeys.length === 1 && customQuestions.length === 1 && allCustomPool[customKeys[0]] !== undefined) {
        const val = allCustomPool[customKeys[0]];
        return Array.isArray(val) ? val.join(', ') : String(val);
      }
    }
  }

  return '';
}
