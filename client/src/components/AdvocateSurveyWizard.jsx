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
  RefreshCw
} from 'lucide-react';
import { ADVOCATE_SURVEY_QUESTIONS, getAdvocateQuestionLabel, ADVOCATE_STANDARD_KEYS } from '../data/advocateQuestions';
import { API_BASE_URL } from '../config';

export default function AdvocateSurveyWizard({
  isOpen,
  onClose,
  courtTypes = [],
  questions = ADVOCATE_SURVEY_QUESTIONS,
  onSurveySaved
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [checkingReg, setCheckingReg] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jumpBackToReview, setJumpBackToReview] = useState(false);

  const inputRef = useRef(null);
  const reviewEnteredTimeRef = useRef(0);
  const keysReleasedRef = useRef(true);

  // Questions sorted by order_num
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

  const totalQuestions = activeQuestions.length;
  const isReviewMode = currentStep === totalQuestions;
  const currentQ = activeQuestions[currentStep];

  const choiceOptions = useMemo(() => {
    if (currentQ?.key === 'primary_court' && Array.isArray(courtTypes) && courtTypes.length > 0) {
      const dynamicNames = courtTypes.map((c) => (typeof c === 'string' ? c : c?.name)).filter(Boolean);
      return Array.from(new Set([...dynamicNames, ...(currentQ.options || [])]));
    }
    return currentQ?.options || [];
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
        const regKey = String(payload.advocate_reg_no || payload.name || Date.now()).trim().toLowerCase();
        const localMap = JSON.parse(localStorage.getItem('local_advocate_survey_answers_map') || '{}');
        localMap[regKey] = { ...payload, ...customObj };
        localStorage.setItem('local_advocate_survey_answers_map', JSON.stringify(localMap));
      } catch (e) {}

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
                        <span className="review-item-answer">{displayVal}</span>
                      ) : (
                        <span className="review-item-answer empty">Not specified</span>
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
        {/* Progress Header */}
        <div className="wizard-header">
          <div className="wizard-badge" style={{ background: '#FFF7ED', color: '#EA580C' }}>
            Question #{currentQ.order_num ?? currentStep + 1} ({currentStep + 1} of {totalQuestions})
          </div>
          <div className="wizard-percent">{progressPercent}% Completed</div>
          <button className="wizard-close-btn" onClick={onClose} title="Cancel">
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="wizard-progress-bar-track">
          <div
            className="wizard-progress-bar-fill"
            style={{ width: `${progressPercent}%`, background: '#EA580C' }}
          />
        </div>

        {/* Question Body */}
        <div className="wizard-body">
          <h2 className="wizard-question-text">{getAdvocateQuestionLabel(currentQ, currentStep)}</h2>

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
                placeholder="Type 'Yes' or 'No'"
                value={currentVal}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <div className="yes-no-options-grid">
                <button
                  type="button"
                  className={`btn-yes-choice ${String(currentVal).toLowerCase() === 'yes' ? 'selected' : ''}`}
                  onClick={() => handleInputChange('Yes')}
                >
                  <CheckCircle2 size={18} />
                  <span>Yes</span>
                </button>
                <button
                  type="button"
                  className={`btn-no-choice ${String(currentVal).toLowerCase() === 'no' ? 'selected' : ''}`}
                  onClick={() => handleInputChange('No')}
                >
                  <X size={18} />
                  <span>No</span>
                </button>
              </div>
            </div>
          ) : currentQ.type === 'multi-select' ? (
            <div>
              <div style={{ marginBottom: '10px', fontSize: '12.5px', color: '#64748B' }}>
                Selected: <strong>{Array.isArray(currentVal) ? currentVal.join(', ') : (currentVal || 'None')}</strong>
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
          ) : currentQ.type === 'choice_text' ? (
            <div>
              <input
                ref={inputRef}
                type="text"
                className="wizard-input-box"
                placeholder={currentQ.placeholder || 'Select or type choice...'}
                value={currentVal}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
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

          {/* Note */}
          {currentQ.note && (
            <div className="wizard-note-banner">
              <span>{currentQ.note}</span>
            </div>
          )}

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
            style={{ background: '#EA580C', borderColor: '#EA580C' }}
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
