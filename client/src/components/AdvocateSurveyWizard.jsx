import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Edit3,
  Send,
  CheckCircle2,
  RefreshCw,
  Plus
} from 'lucide-react';
import { ADVOCATE_SURVEY_QUESTIONS, getAdvocateQuestionLabel, ADVOCATE_STANDARD_KEYS, DEFAULT_ADVOCATE_TYPES } from '../data/advocateQuestions';
import { API_BASE_URL } from '../config';

const matchOptionByChar = (optionsList, keyChar) => {
  if (!keyChar || typeof keyChar !== 'string' || !Array.isArray(optionsList) || optionsList.length === 0) return null;
  const k = keyChar.trim().toLowerCase();
  if (!k) return null;

  for (const item of optionsList) {
    const str = typeof item === 'object' && item !== null ? (item.name || '') : String(item);
    const trimmed = str.trim();
    if (trimmed.toLowerCase().startsWith(k)) {
      return trimmed;
    }
  }

  for (const item of optionsList) {
    const str = typeof item === 'object' && item !== null ? (item.name || '') : String(item);
    const words = str.trim().split(/\s+/);
    if (words.some((w) => w.toLowerCase().startsWith(k))) {
      return str.trim();
    }
  }

  return null;
};

export default function AdvocateSurveyWizard({
  isOpen,
  onClose,
  courtTypes = [],
  advocateTypes = [],
  onAddAdvocateType,
  questions = ADVOCATE_SURVEY_QUESTIONS,
  onSurveySaved
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [checkingReg, setCheckingReg] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jumpBackToReview, setJumpBackToReview] = useState(false);

  // Inline Quick Add for Advocate Types
  const [newTypeName, setNewTypeName] = useState('');
  const [showAddTypeInline, setShowAddTypeInline] = useState(false);
  const [isAddingType, setIsAddingType] = useState(false);

  const inputRef = useRef(null);
  const reviewEnteredTimeRef = useRef(0);
  const keysReleasedRef = useRef(true);

  // Questions sorted by order_num
  const activeQuestions = useMemo(() => {
    const list = (Array.isArray(questions) && questions.length > 0) ? questions : ADVOCATE_SURVEY_QUESTIONS;

    return [...list]
      .filter((q) => q &&
        q.key !== '__advocate_types__' &&
        q.type !== 'advocate_type_store' &&
        q.key !== '__advocate_remarks_map__' &&
        q.type !== 'remarks_store'
      )
      .sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0))
      .map((q) => {
        const hasRemark = Boolean(
          (typeof q?.note === 'string' && q.note.includes('[REMARK]')) ||
          q?.has_remark
        );
        const cleanNote = (q?.note || '').replace(/\s*\[REMARK\]/g, '').trim();
        return {
          ...q,
          note: cleanNote,
          has_remark: hasRemark
        };
      });
  }, [questions]);

  const totalQuestions = activeQuestions.length;
  const isReviewMode = currentStep === totalQuestions;
  const currentQ = activeQuestions[currentStep];

  const choiceOptions = useMemo(() => {
    const rawOpts = currentQ?.options;
    const qOpts = Array.isArray(rawOpts) ? rawOpts : (typeof rawOpts === 'string' && rawOpts ? rawOpts.split(',').map((s) => s.trim()) : []);
    if (currentQ?.key === 'primary_court' && Array.isArray(courtTypes) && courtTypes.length > 0) {
      const dynamicNames = courtTypes.map((c) => (typeof c === 'string' ? c : c?.name)).filter(Boolean);
      return Array.from(new Set([...dynamicNames, ...qOpts]));
    }
    return qOpts;
  }, [currentQ, courtTypes]);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setFormData({});
      setError('');
      setJumpBackToReview(false);
    }
  }, [isOpen]);

  // Focus input automatically
  useEffect(() => {
    if (isOpen && !isReviewMode) {
      const focusTarget = () => {
        if (inputRef.current) inputRef.current.focus();
      };
      focusTarget();
      const t1 = setTimeout(focusTarget, 30);
      const t2 = setTimeout(focusTarget, 100);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isOpen, currentStep, isReviewMode]);

  // Key tracking
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyUp = (e) => {
      if (e.key === 'Control' || e.key === 'Enter') {
        keysReleasedRef.current = true;
      }
    };
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, [isOpen]);

  // Global Ctrl + Enter listener
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKey = (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (checkingReg || isSubmitting) return;

        if (isReviewMode) {
          const timeInReview = Date.now() - reviewEnteredTimeRef.current;
          if (timeInReview < 700 || !keysReleasedRef.current) return;
          handleSubmitSurvey();
        } else {
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey, true);
    return () => window.removeEventListener('keydown', handleGlobalKey, true);
  }, [isOpen, isReviewMode, checkingReg, isSubmitting, totalQuestions, currentStep, currentQ, formData]);

  if (!isOpen) return null;

  const currentVal = currentQ ? (formData[currentQ.key] ?? '') : '';

  const handleInputChange = (val) => {
    setError('');
    if (currentQ?.type === 'yesno') {
      const lower = String(val).trim().toLowerCase();
      if (lower === 'y' || lower === 'ye' || lower === 'yes') {
        setFormData((prev) => ({ ...prev, [currentQ.key]: 'Yes' }));
        return;
      }
      if (lower === 'n' || lower === 'no') {
        setFormData((prev) => ({ ...prev, [currentQ.key]: 'No' }));
        return;
      }
    }
    setFormData((prev) => ({ ...prev, [currentQ.key]: val }));
  };

  const handleMultiSelectToggle = (option) => {
    setError('');
    const list = Array.isArray(currentVal)
      ? currentVal
      : (typeof currentVal === 'string' && currentVal.trim() ? currentVal.split(', ').filter(Boolean) : []);

    let updated;
    if (list.includes(option)) {
      updated = list.filter((i) => i !== option);
    } else {
      updated = [...list, option];
    }
    setFormData((prev) => ({ ...prev, [currentQ.key]: updated }));
  };

  const handleInlineAddAdvocateType = async (e) => {
    if (e) e.preventDefault();
    if (!newTypeName.trim() || !onAddAdvocateType) return;
    setIsAddingType(true);
    try {
      const res = await onAddAdvocateType(newTypeName.trim());
      const addedName = (res && res.data && res.data.name) ? res.data.name : newTypeName.trim();
      handleMultiSelectToggle(addedName);
      setNewTypeName('');
      setShowAddTypeInline(false);
    } catch (err) {
      console.error('Error adding advocate type inline:', err);
    } finally {
      setIsAddingType(false);
    }
  };

  const handleNext = async () => {
    if (checkingReg) return;
    setError('');

    // Required check
    if (currentQ.required && (!currentVal || (Array.isArray(currentVal) && currentVal.length === 0))) {
      setError(`Please provide an answer for "${currentQ.label}" before proceeding.`);
      return;
    }

    // Number validation
    if (currentQ.type === 'number' && currentVal !== '') {
      if (!/^\d+$/.test(String(currentVal).trim())) {
        setError('Please enter valid numeric digits only!');
        return;
      }
    }

    // Reg No Uniqueness Check on Question 1
    if (currentQ.isUniqueCheck && currentVal) {
      const regTrimmed = String(currentVal).trim();
      setCheckingReg(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/advocate-survey/check-reg?no=${encodeURIComponent(regTrimmed)}`);
        const data = await res.json();
        if (data.exists) {
          setError(`Advocate Registration No. "${regTrimmed}" already exists in the database!`);
          setCheckingReg(false);
          return;
        }
      } catch (err) {
        console.warn('Check Reg network issue:', err);
      } finally {
        setCheckingReg(false);
      }
    }

    // Yes/No normalization
    if (currentQ.type === 'yesno') {
      const lower = String(currentVal || '').trim().toLowerCase();
      if (!lower) {
        setError("Please select or type 'Yes' or 'No' before proceeding.");
        return;
      }
      if (lower === 'y' || lower === 'yes') {
        setFormData((prev) => ({ ...prev, [currentQ.key]: 'Yes' }));
      } else if (lower === 'n' || lower === 'no') {
        setFormData((prev) => ({ ...prev, [currentQ.key]: 'No' }));
      } else {
        setError("Please enter or select only 'Yes' or 'No'.");
        return;
      }
    }

    if (jumpBackToReview) {
      setJumpBackToReview(false);
      reviewEnteredTimeRef.current = Date.now();
      keysReleasedRef.current = false;
      setCurrentStep(totalQuestions);
      return;
    }

    if (currentStep < totalQuestions) {
      if (currentStep === totalQuestions - 1) {
        reviewEnteredTimeRef.current = Date.now();
        keysReleasedRef.current = false;
      }
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (checkingReg) return;
    setError('');
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && currentQ?.type !== 'textarea') {
      e.preventDefault();
      handleNext();
    }
  };

  const handleSubmitSurvey = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const customObj = {};
      Object.keys(formData).forEach((k) => {
        if (!ADVOCATE_STANDARD_KEYS.includes(k) && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(k)) {
          if (formData[k] !== undefined && formData[k] !== null && formData[k] !== '') {
            customObj[k] = Array.isArray(formData[k]) ? formData[k].join(', ') : formData[k];
          }
        }
      });

      const formattedData = {};
      Object.keys(formData).forEach((k) => {
        formattedData[k] = Array.isArray(formData[k]) ? formData[k].join(', ') : formData[k];
      });

      const payload = {
        ...formattedData,
        case_specialization: Array.isArray(formData.case_specialization) ? formData.case_specialization.join(', ') : (formData.case_specialization || ''),
        custom_answers: JSON.stringify(customObj)
      };

      const res = await fetch(`${API_BASE_URL}/api/advocate-survey/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        const savedRecord = { ...payload, ...(data.data || {}), ...customObj };
        if (onSurveySaved) onSurveySaved(savedRecord);
        onClose();
      } else {
        setError(data.message || 'Failed to save advocate survey.');
      }
    } catch (err) {
      setError('Connection to backend failed. Please ensure server is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Review Mode
  if (isReviewMode) {
    return createPortal(
      <div className="wizard-backdrop animate-fade-in">
        <div className="review-summary-card">
          <div className="review-summary-header" style={{ background: '#EA580C' }}>
            <div>
              <div className="review-summary-title">Review Advocate Survey ({totalQuestions} Questions)</div>
              <div className="review-summary-subtitle">
                Please verify all advocate details below. Press <strong>Ctrl + Enter</strong> or click Submit to save.
              </div>
            </div>
            <button className="wizard-close-btn" style={{ color: '#fff' }} onClick={onClose} title="Cancel">
              <X size={22} />
            </button>
          </div>

          {error && (
            <div className="wizard-error-banner" style={{ margin: '14px 28px 0 28px' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="review-summary-list">
            {activeQuestions.map((q, idx) => {
              const val = formData[q.key];
              const displayVal = Array.isArray(val) ? val.join(', ') : val;
              return (
                <div key={q.id || idx} className="review-item-card">
                  <div style={{ flex: 1 }}>
                    <div className="review-item-qnum">Question #{q.order_num ?? idx + 1}</div>
                    <div className="review-item-question">{getAdvocateQuestionLabel(q, idx)}</div>
                    <div>
                      {displayVal ? (
                        <div>
                          <span className="review-item-answer">{displayVal}</span>
                          {formData[`${q.key}_remark`] && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#047857', fontWeight: 600 }}>
                              Remark: {formData[`${q.key}_remark`]}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="review-item-answer empty">Not specified</span>
                          {formData[`${q.key}_remark`] && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#047857', fontWeight: 600 }}>
                              Remark: {formData[`${q.key}_remark`]}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-review-edit"
                    onClick={() => {
                      setJumpBackToReview(true);
                      setCurrentStep(idx);
                    }}
                    title={`Edit Question ${idx + 1}`}
                  >
                    <Edit3 size={14} />
                    <span>Edit</span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="review-summary-footer">
            <button
              type="button"
              className="btn-wizard-prev"
              onClick={() => setCurrentStep(totalQuestions - 1)}
            >
              <ArrowLeft size={16} />
              <span>Back to Previous</span>
            </button>

            <button
              type="button"
              className="btn-submit-final"
              style={{ background: '#EA580C', borderColor: '#EA580C' }}
              onClick={handleSubmitSurvey}
              disabled={isSubmitting}
            >
              <Send size={18} />
              <span>{isSubmitting ? 'Saving to Database...' : 'Submit & Save Advocate Survey (Ctrl + Enter ↵)'}</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Active Question Card
  const progressPercent = Math.round(((currentStep + 1) / totalQuestions) * 100);

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="wizard-card" onClick={(e) => e.stopPropagation()}>
        {/* Top Info Bar */}
        <div className="wizard-top-bar">
          <div className="wizard-progress-info">
            <span className="wizard-step-pill">
              Question #{currentQ?.order_num ?? (currentStep + 1)} ({currentStep + 1} of {totalQuestions})
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
              {progressPercent}% Completed
            </span>
          </div>
          <button className="wizard-close-btn" onClick={onClose} title="Close Questionnaire">
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="wizard-progress-track">
          <div
            className="wizard-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Question Body */}
        <div className="wizard-body">
          <div className="wizard-question-label">{getAdvocateQuestionLabel(currentQ, currentStep)}</div>

          {currentQ.type === 'textarea' ? (
            <textarea
              ref={inputRef}
              rows={4}
              className="wizard-input-box"
              placeholder={currentQ.placeholder}
              value={currentVal}
              onChange={(e) => handleInputChange(e.target.value)}
              autoFocus
            />
          ) : currentQ.type === 'yesno' ? (
            <div>
              <input
                ref={inputRef}
                type="text"
                className="wizard-input-box"
                placeholder="Type 'Y' for Yes or 'N' for No..."
                value={currentVal}
                onKeyDown={(e) => {
                  if (e.key === 'y' || e.key === 'Y') {
                    e.preventDefault();
                    handleInputChange('Yes');
                  } else if (e.key === 'n' || e.key === 'N') {
                    e.preventDefault();
                    handleInputChange('No');
                  } else {
                    handleKeyDown(e);
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().trim();
                  if (val === 'y' || val.startsWith('ye')) {
                    handleInputChange('Yes');
                  } else if (val === 'n' || val.startsWith('no')) {
                    handleInputChange('No');
                  } else {
                    handleInputChange(e.target.value);
                  }
                }}
                autoFocus
              />
              <div className="yes-no-options-grid">
                <button
                  type="button"
                  className={`btn-yes-choice ${String(currentVal).toLowerCase() === 'yes' ? 'selected' : ''}`}
                  onClick={() => handleInputChange('Yes')}
                >
                  <CheckCircle2 size={18} />
                  <span>Yes (Y)</span>
                </button>
                <button
                  type="button"
                  className={`btn-no-choice ${String(currentVal).toLowerCase() === 'no' ? 'selected' : ''}`}
                  onClick={() => handleInputChange('No')}
                >
                  <X size={18} />
                  <span>No (N)</span>
                </button>
              </div>
            </div>
          ) : currentQ.type === 'court_type' ? (
            /* MANAGE COURT TYPES: MULTI-SELECT */
            <div>
              <div style={{ marginBottom: '10px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  className="wizard-input-box"
                  placeholder="Type first letter to toggle court type or click below..."
                  onKeyDown={(e) => {
                    if (['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Delete'].includes(e.key)) {
                      handleKeyDown(e);
                      return;
                    }
                    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                      const matched = matchOptionByChar(courtTypes, e.key);
                      if (matched) {
                        e.preventDefault();
                        handleMultiSelectToggle(matched);
                      }
                    }
                  }}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '10px', fontSize: '12.5px', color: '#64748B' }}>
                Selected ({Array.isArray(currentVal) ? currentVal.length : (currentVal ? 1 : 0)}): <strong>{Array.isArray(currentVal) ? currentVal.join(', ') : (currentVal || 'None')}</strong>
              </div>

              <div className="multi-select-container" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {courtTypes.map((c) => {
                  const name = typeof c === 'object' && c !== null ? c.name : String(c);
                  const isSel = Array.isArray(currentVal) ? currentVal.includes(name) : false;
                  return (
                    <button
                      key={name}
                      type="button"
                      className={`selectable-tag ${isSel ? 'selected' : ''}`}
                      onClick={() => handleMultiSelectToggle(name)}
                    >
                      {isSel && <Check size={14} />}
                      <span>{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : currentQ.type === 'advocate_type' ? (
            /* ADVOCATE TYPES: MULTI-SELECT */
            <div>
              <div style={{ marginBottom: '10px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  className="wizard-input-box"
                  placeholder="Type first letter to toggle advocate type or click below..."
                  onKeyDown={(e) => {
                    if (['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Delete'].includes(e.key)) {
                      handleKeyDown(e);
                      return;
                    }
                    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                      const list = advocateTypes && advocateTypes.length > 0 ? advocateTypes : DEFAULT_ADVOCATE_TYPES;
                      const matched = matchOptionByChar(list, e.key);
                      if (matched) {
                        e.preventDefault();
                        handleMultiSelectToggle(matched);
                      }
                    }
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                  Selected ({Array.isArray(currentVal) ? currentVal.length : (currentVal ? 1 : 0)}): <strong>{Array.isArray(currentVal) ? currentVal.join(', ') : (currentVal || 'None')}</strong>
                </div>
                {!showAddTypeInline && onAddAdvocateType && (
                  <button
                    type="button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#F0FDF4',
                      color: '#16A34A',
                      border: '1px dashed #86EFAC',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    onClick={() => setShowAddTypeInline(true)}
                  >
                    <Plus size={13} />
                    <span>+ Add Type</span>
                  </button>
                )}
              </div>

              {/* Inline quick add input */}
              {showAddTypeInline && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', background: '#F8FAFC', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter new advocate type..."
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '13px' }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInlineAddAdvocateType();
                      } else if (e.key === 'Escape') {
                        setShowAddTypeInline(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: '12px', background: '#16A34A', whiteSpace: 'nowrap' }}
                    onClick={handleInlineAddAdvocateType}
                    disabled={isAddingType || !newTypeName.trim()}
                  >
                    {isAddingType ? 'Adding...' : 'Add'}
                  </button>
                  <button
                    type="button"
                    className="btn-wizard-prev"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                    onClick={() => setShowAddTypeInline(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="multi-select-container" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {(advocateTypes && advocateTypes.length > 0 ? advocateTypes.map(t => typeof t === 'string' ? t : t.name) : DEFAULT_ADVOCATE_TYPES.map(t => typeof t === 'string' ? t : t.name)).map((opt) => {
                  const isSel = Array.isArray(currentVal) ? currentVal.includes(opt) : false;
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`selectable-tag ${isSel ? 'selected' : ''}`}
                      onClick={() => handleMultiSelectToggle(opt)}
                    >
                      {isSel && <Check size={14} />}
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (currentQ.type === 'custom_multiselect' || currentQ.type === 'multi-select') ? (
            /* CUSTOM MULTI-SELECT DROPDOWN */
            <div>
              <div style={{ marginBottom: '10px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  className="wizard-input-box"
                  placeholder="Type first letter to toggle option, or click below..."
                  onKeyDown={(e) => {
                    if (['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Delete'].includes(e.key)) {
                      handleKeyDown(e);
                      return;
                    }
                    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                      const matched = matchOptionByChar(currentQ.options || [], e.key);
                      if (matched) {
                        e.preventDefault();
                        handleMultiSelectToggle(matched);
                      }
                    }
                  }}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '10px', fontSize: '12.5px', color: '#64748B' }}>
                Selected ({Array.isArray(currentVal) ? currentVal.length : (currentVal ? 1 : 0)}): <strong>{Array.isArray(currentVal) ? currentVal.join(', ') : (currentVal || 'None')}</strong>
              </div>

              <div className="multi-select-container" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {(currentQ.options || []).map((opt) => {
                  const isSel = Array.isArray(currentVal) ? currentVal.includes(opt) : false;
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`selectable-tag ${isSel ? 'selected' : ''}`}
                      onClick={() => handleMultiSelectToggle(opt)}
                    >
                      {isSel && <Check size={14} />}
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (currentQ.type === 'custom_choice' || currentQ.type === 'choice_text') ? (
            /* CUSTOM SINGLE CHOICE WITH FIRST-LETTER AUTO-FILL */
            <div>
              <input
                ref={inputRef}
                type="text"
                className="wizard-input-box"
                placeholder={currentQ.placeholder || 'Type first letter to auto-fill or click option...'}
                value={currentVal}
                onKeyDown={(e) => {
                  if (['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Delete'].includes(e.key)) {
                    handleKeyDown(e);
                    return;
                  }
                  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    const matched = matchOptionByChar(choiceOptions, e.key);
                    if (matched) {
                      e.preventDefault();
                      handleInputChange(matched);
                    }
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  const matched = matchOptionByChar(choiceOptions, val);
                  if (matched && val.length === 1) {
                    handleInputChange(matched);
                  } else {
                    handleInputChange(val);
                  }
                }}
                autoFocus
              />
              <div className="multi-select-container" style={{ marginTop: '12px' }}>
                {choiceOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`selectable-tag ${currentVal === opt ? 'selected' : ''}`}
                    onClick={() => handleInputChange(opt)}
                  >
                    {currentVal === opt && <Check size={14} />}
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <input
              ref={inputRef}
              type={currentQ.type === 'number' ? 'number' : 'text'}
              className="wizard-input-box"
              placeholder={currentQ.placeholder}
              value={currentVal}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          )}

          {/* Question Remark input if has_remark is active */}
          {Boolean(currentQ?.has_remark) && (
            <div className="wizard-remark-container" style={{ marginTop: '16px', background: '#F0FDF4', padding: '12px 14px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#166534', marginBottom: '6px' }}>
                Remark / Additional Notes <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#15803D' }}>(Optional)</span>:
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter remark or comments for this question..."
                value={formData[`${currentQ?.key}_remark`] || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, [`${currentQ?.key}_remark`]: e.target.value }))}
                style={{ background: '#FFFFFF', borderColor: '#86EFAC' }}
              />
            </div>
          )}

          {/* Note */}
          {(() => {
            const clean = (currentQ?.note || '').replace(/\s*\[REMARK\]/g, '').trim();
            return clean ? (
              <div className="wizard-note-banner">
                <span>{clean}</span>
              </div>
            ) : null;
          })()}

          {/* Error */}
          {error && (
            <div className="wizard-error-banner">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wizard-footer">
          <button
            type="button"
            className="btn-wizard-prev"
            onClick={handlePrev}
            disabled={currentStep === 0 || checkingReg}
          >
            <ArrowLeft size={16} />
            <span>Previous</span>
          </button>

          <button
            type="button"
            className="btn-wizard-next"
            onClick={handleNext}
            disabled={checkingReg}
          >
            {checkingReg ? (
              <>
                <RefreshCw size={16} className="spin-icon" />
                <span>Verifying Reg No...</span>
              </>
            ) : currentStep === totalQuestions - 1 ? (
              <>
                <span>Review Answers (Ctrl + Enter ↵)</span>
                <ArrowRight size={16} />
              </>
            ) : (
              <>
                <span>Next Question</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
