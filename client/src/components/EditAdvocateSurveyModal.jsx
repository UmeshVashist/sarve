import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertCircle, Check } from 'lucide-react';
import { ADVOCATE_SURVEY_QUESTIONS, getAdvocateQuestionLabel, ADVOCATE_STANDARD_KEYS } from '../data/advocateQuestions';
import { API_BASE_URL } from '../config';
import { resolveAdvocateAnswer } from '../utils/exportAdvocateExcel';

export default function EditAdvocateSurveyModal({
  isOpen,
  onClose,
  survey,
  courtTypes = [],
  questions = ADVOCATE_SURVEY_QUESTIONS,
  onSurveyUpdated
}) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const activeQuestions = useMemo(() => {
    let list = Array.isArray(questions) && questions.length > 0 ? questions : null;
    if (!list) {
      try {
        const saved = localStorage.getItem('advocate_questions_list');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
          }
        }
      } catch (e) {}
    }
    if (!list || list.length === 0) {
      list = ADVOCATE_SURVEY_QUESTIONS;
    }
    return [...list].sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0));
  }, [questions, isOpen]);

  useEffect(() => {
    if (survey) {
      let customAnswers = {};
      if (survey.custom_answers) {
        if (typeof survey.custom_answers === 'string') {
          try { customAnswers = JSON.parse(survey.custom_answers); } catch (e) {}
        } else if (typeof survey.custom_answers === 'object') {
          customAnswers = survey.custom_answers;
        }
      }

      let localCached = {};
      try {
        const regKey = String(survey.advocate_reg_no || survey.id || '').trim().toLowerCase();
        if (regKey) {
          const localMap = JSON.parse(localStorage.getItem('local_advocate_survey_answers_map') || '{}');
          if (localMap[regKey]) localCached = localMap[regKey];
        }
      } catch (e) {}

      const merged = { ...customAnswers, ...localCached, ...survey };

      // Ensure every question has a value
      activeQuestions.forEach((q) => {
        if (merged[q.key] === undefined || merged[q.key] === null || String(merged[q.key]).trim() === '') {
          const resolved = resolveAdvocateAnswer(survey, q, activeQuestions);
          if (resolved) merged[q.key] = resolved;
        }
      });

      merged.case_specialization = survey.case_specialization
        ? (Array.isArray(survey.case_specialization) ? survey.case_specialization : survey.case_specialization.split(', ').filter(Boolean))
        : [];

      setFormData(merged);
      setError('');
    }
  }, [survey]);

  if (!isOpen || !survey) return null;

  const handleChange = (key, val) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleSpecializationToggle = (spec) => {
    const list = Array.isArray(formData.case_specialization) ? formData.case_specialization : [];
    if (list.includes(spec)) {
      handleChange('case_specialization', list.filter((i) => i !== spec));
    } else {
      handleChange('case_specialization', [...list, spec]);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const customObj = {};
      Object.keys(formData).forEach((k) => {
        if (!ADVOCATE_STANDARD_KEYS.includes(k) && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(k)) {
          if (formData[k] !== undefined && formData[k] !== null && formData[k] !== '') {
            customObj[k] = formData[k];
          }
        }
      });

      const payload = {
        ...formData,
        case_specialization: Array.isArray(formData.case_specialization) ? formData.case_specialization.join(', ') : (formData.case_specialization || ''),
        custom_answers: JSON.stringify(customObj)
      };

      // Local storage cache
      try {
        const regKey = String(payload.advocate_reg_no || payload.id || '').trim().toLowerCase();
        if (regKey) {
          const localMap = JSON.parse(localStorage.getItem('local_advocate_survey_answers_map') || '{}');
          localMap[regKey] = { ...payload, ...customObj };
          localStorage.setItem('local_advocate_survey_answers_map', JSON.stringify(localMap));
        }
      } catch (storageErr) {}

      const res = await fetch(`${API_BASE_URL}/api/advocate-survey/${survey.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        const savedData = (data.data && data.data.id) ? { ...data.data, ...customObj } : { ...payload, ...customObj, id: survey.id };
        if (onSurveyUpdated) onSurveyUpdated(savedData);
        onClose();
      } else {
        setError(data.message || 'Failed to update advocate survey');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="review-summary-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px' }}>
        <div className="review-summary-header" style={{ background: '#EA580C' }}>
          <div>
            <div className="review-summary-title">Edit Advocate Survey: {survey.name}</div>
            <div className="review-summary-subtitle">Reg No: {survey.advocate_reg_no || 'N/A'}</div>
          </div>
          <button className="wizard-close-btn" style={{ color: '#fff' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="wizard-error-banner" style={{ margin: '14px 28px 0 28px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="review-summary-list" style={{ padding: '24px 28px' }}>
            {activeQuestions.map((q, idx) => {
              const val = formData[q.key] ?? '';
              return (
                <div key={q.id || idx} className="form-group" style={{ background: '#F8FAFC', padding: '14px 18px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '13.5px', color: '#1E293B' }}>
                    {getAdvocateQuestionLabel(q, idx)}
                  </label>

                  {q.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      className="form-control"
                      value={val}
                      onChange={(e) => handleChange(q.key, e.target.value)}
                    />
                  ) : q.type === 'multi-select' ? (
                    <div className="multi-select-container">
                      {(q.options || ['Criminal Defense', 'Bail Applications', 'NDPS Act (Narcotics)', 'Other']).map((opt) => {
                        const isSel = Array.isArray(formData.case_specialization) && formData.case_specialization.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            className={`selectable-tag ${isSel ? 'selected' : ''}`}
                            onClick={() => handleSpecializationToggle(opt)}
                          >
                            {isSel && <Check size={14} />}
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : q.type === 'yesno' ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className={`btn-action-icon ${String(val).toLowerCase() === 'yes' ? 'view' : ''}`}
                        style={{ width: 'auto', padding: '6px 18px', fontSize: '13px', fontWeight: 700 }}
                        onClick={() => handleChange(q.key, 'Yes')}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        className={`btn-action-icon ${String(val).toLowerCase() === 'no' ? 'delete' : ''}`}
                        style={{ width: 'auto', padding: '6px 18px', fontSize: '13px', fontWeight: 700 }}
                        onClick={() => handleChange(q.key, 'No')}
                      >
                        No
                      </button>
                    </div>
                  ) : q.type === 'choice_text' ? (
                    <div>
                      <input
                        type="text"
                        className="form-control"
                        value={val}
                        onChange={(e) => handleChange(q.key, e.target.value)}
                        placeholder={q.placeholder || 'Select or enter choice...'}
                        style={{ marginBottom: '8px' }}
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(q.key === 'primary_court' && Array.isArray(courtTypes) && courtTypes.length > 0
                          ? Array.from(new Set([...courtTypes.map((c) => (typeof c === 'string' ? c : c?.name)).filter(Boolean), ...(q.options || [])]))
                          : (q.options || [])
                        ).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className={`selectable-tag ${val === opt ? 'selected' : ''}`}
                            style={{ fontSize: '12px', padding: '4px 10px' }}
                            onClick={() => handleChange(q.key, opt)}
                          >
                            {val === opt && <Check size={12} />}
                            <span>{opt}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <input
                      type={q.type === 'number' ? 'number' : 'text'}
                      className="form-control"
                      value={val}
                      onChange={(e) => handleChange(q.key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="modal-footer" style={{ padding: '16px 28px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
            <button type="button" className="btn-wizard-prev" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ background: '#EA580C', borderColor: '#EA580C' }} disabled={saving}>
              <Save size={16} />
              <span>{saving ? 'Saving Changes...' : 'Save Survey Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
