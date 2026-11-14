import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, ArrowLeft, Check, AlertCircle, Edit3, Send, CheckCircle2, ChevronDown, ChevronUp, Search, Plus, RefreshCw } from 'lucide-react';
import { SURVEY_QUESTIONS } from '../data/questions';
import { API_BASE_URL } from '../config';

const DEFAULT_FALLBACK_CASE_TYPES = [
  { id: 'fb-1', name: 'Murder (IPC 302)' },
  { id: 'fb-2', name: 'Theft & Burglary (IPC 379/380)' },
  { id: 'fb-3', name: 'Robbery / Dacoity (IPC 392/395)' },
  { id: 'fb-4', name: 'Bail Application' },
  { id: 'fb-5', name: 'NDPS Act (Narcotics)' },
  { id: 'fb-6', name: 'Cheating & Fraud (IPC 420)' },
  { id: 'fb-7', name: 'Cyber Crime' },
  { id: 'fb-8', name: 'Assault / Attempt to Murder (IPC 307)' },
  { id: 'fb-9', name: 'Matrimonial / Dowry (IPC 498A)' },
  { id: 'fb-10', name: 'Arms Act' },
  { id: 'fb-11', name: 'Economic Offence' },
  { id: 'fb-12', name: 'Other' }
];

export default function SurveyWizard({ isOpen, onClose, caseTypes = [], onCaseTypeAdded, onSurveySaved }) {
  const [currentStep, setCurrentStep] = useState(0); // 0 to 23 for questions, 24 for Review Summary
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [checkingUtct, setCheckingUtct] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jumpBackToReview, setJumpBackToReview] = useState(false);

  // Dynamic Case Types state for Q3
  const [extraCaseTypes, setExtraCaseTypes] = useState([]);

  // Question 11: Advance Payment Amount
  const [advanceAmount, setAdvanceAmount] = useState('');
  const amountInputRef = useRef(null);

  // Question 16: Complete Fees Amount
  const [feesAmount, setFeesAmount] = useState('');
  const feesAmountInputRef = useRef(null);

  // Question 3: Case Type High-speed entry
  const [caseTypeSearch, setCaseTypeSearch] = useState('');
  const [showCaseTypeDropdown, setShowCaseTypeDropdown] = useState(true);

  // Question 24: Psychological survey
  const [q24Choice, setQ24Choice] = useState('');
  const [q24Remarks, setQ24Remarks] = useState('');

  const inputRef = useRef(null);

  const totalQuestions = SURVEY_QUESTIONS.length; // 24
  const isReviewMode = currentStep === totalQuestions;
  const currentQ = SURVEY_QUESTIONS[currentStep];

  const isQ3 = currentQ?.key === 'case_type';
  const isQ11 = currentQ?.key === 'advocate_payment_advance';
  const isQ16 = currentQ?.key === 'complete_fees_total_initially';
  const isQ23 = currentQ?.key === 'priority_money_vs_release';
  const isQ24 = currentQ?.key === 'prisoner_psychologic_survey';

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setFormData({});
      setError('');
      setJumpBackToReview(false);
      setAdvanceAmount('');
      setFeesAmount('');
      setCaseTypeSearch('');
      setShowCaseTypeDropdown(true);
      setQ24Choice('');
      setQ24Remarks('');
    }
  }, [isOpen]);

  // Synchronize Question 11 (Advance Amount)
  useEffect(() => {
    if (isQ11) {
      const raw = String(formData.advocate_payment_advance || '').trim();
      if (raw.toLowerCase().startsWith('yes')) {
        const parts = raw.split('/');
        if (parts.length > 1) {
          setAdvanceAmount(parts.slice(1).join('/').trim());
        } else {
          setAdvanceAmount('');
        }
      } else {
        setAdvanceAmount('');
      }
    }
  }, [currentStep, isQ11]);

  // Synchronize Question 16 (Complete Fees Total)
  useEffect(() => {
    if (isQ16) {
      const raw = String(formData.complete_fees_total_initially || '').trim();
      if (raw.toLowerCase().startsWith('yes')) {
        const parts = raw.split('/');
        if (parts.length > 1) {
          setFeesAmount(parts.slice(1).join('/').trim());
        } else {
          setFeesAmount('');
        }
      } else {
        setFeesAmount('');
      }
    }
  }, [currentStep, isQ16]);

  // Synchronize Question 24 (Psychological)
  useEffect(() => {
    if (isQ24) {
      const raw = String(formData.prisoner_psychologic_survey || '').trim();
      if (raw.toLowerCase().startsWith('yes')) {
        setQ24Choice('Yes');
        setQ24Remarks(raw.replace(/^yes\s*[-:/]?\s*/i, '').trim());
      } else if (raw.toLowerCase().startsWith('no')) {
        setQ24Choice('No');
        setQ24Remarks(raw.replace(/^no\s*[-:/]?\s*/i, '').trim());
      } else {
        setQ24Choice('');
        setQ24Remarks(raw);
      }
    }
  }, [currentStep, isQ24]);

  // Focus input on step change
  useEffect(() => {
    if (!isReviewMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentStep, isReviewMode]);

  // Global Ctrl + Enter Shortcut listener
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKey = (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (checkingUtct) return; // Prevent multiple requests while verifying
        if (isReviewMode) {
          handleSubmitSurvey();
        } else {
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  });

  if (!isOpen) return null;

  const currentVal = currentQ ? (formData[currentQ.key] ?? '') : '';

  // Display value for Q11
  let q11DisplayVal = currentVal;
  if (isQ11) {
    if (String(currentVal).toLowerCase().startsWith('yes')) {
      q11DisplayVal = 'Yes';
    } else if (String(currentVal).toLowerCase().startsWith('no')) {
      q11DisplayVal = 'No';
    }
  }
  const isQ11Yes = isQ11 && (
    String(currentVal).toLowerCase() === 'yes' || 
    String(currentVal).toLowerCase().startsWith('yes')
  );

  const handleSelectQ11Yes = () => {
    setError('');
    const formatted = advanceAmount.trim() ? `Yes / ${advanceAmount.trim()}` : 'Yes';
    setFormData((prev) => ({ ...prev, advocate_payment_advance: formatted }));
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 100);
  };

  const handleSelectQ11No = () => {
    setError('');
    setAdvanceAmount('');
    setFormData((prev) => ({ ...prev, advocate_payment_advance: 'No' }));
  };

  const handleAdvanceAmountChange = (val) => {
    setError('');
    const clean = val.replace(/[^0-9]/g, '');
    setAdvanceAmount(clean);
    setFormData((prev) => ({
      ...prev,
      advocate_payment_advance: clean ? `Yes / ${clean}` : 'Yes'
    }));
  };

  // Display value for Q16
  let q16DisplayVal = currentVal;
  if (isQ16) {
    if (String(currentVal).toLowerCase().startsWith('yes')) {
      q16DisplayVal = 'Yes';
    } else if (String(currentVal).toLowerCase().startsWith('no')) {
      q16DisplayVal = 'No';
    }
  }
  const isQ16Yes = isQ16 && (
    String(currentVal).toLowerCase() === 'yes' || 
    String(currentVal).toLowerCase().startsWith('yes')
  );

  const handleSelectQ16Yes = () => {
    setError('');
    const formatted = feesAmount.trim() ? `Yes / ${feesAmount.trim()}` : 'Yes';
    setFormData((prev) => ({ ...prev, complete_fees_total_initially: formatted }));
    setTimeout(() => {
      feesAmountInputRef.current?.focus();
    }, 100);
  };

  const handleSelectQ16No = () => {
    setError('');
    setFeesAmount('');
    setFormData((prev) => ({ ...prev, complete_fees_total_initially: 'No' }));
  };

  const handleFeesAmountChange = (val) => {
    setError('');
    const clean = val.replace(/[^0-9]/g, '');
    setFeesAmount(clean);
    setFormData((prev) => ({
      ...prev,
      complete_fees_total_initially: clean ? `Yes / ${clean}` : 'Yes'
    }));
  };

  // Question 24 Handlers
  const handleSelectQ24Choice = (choice) => {
    setError('');
    setQ24Choice(choice);
    const combined = q24Remarks.trim() ? `${choice} - ${q24Remarks.trim()}` : choice;
    setFormData((prev) => ({ ...prev, prisoner_psychologic_survey: combined }));
  };

  const handleQ24RemarksChange = (val) => {
    setQ24Remarks(val);
    const combined = q24Choice ? (val.trim() ? `${q24Choice} - ${val.trim()}` : q24Choice) : val;
    setFormData((prev) => ({ ...prev, prisoner_psychologic_survey: combined }));
  };

  const handleInputChange = (val) => {
    setError('');
    // Validation for numbers only for Q4, Q6, Q7
    if (currentQ && currentQ.type === 'number') {
      if (val !== '' && !/^\d+$/.test(val)) {
        setError('Input only Numbers allowed for this field!');
        return;
      }
    }
    setFormData((prev) => ({ ...prev, [currentQ.key]: val }));
  };

  const handleMultiSelectToggle = (typeName) => {
    setError('');
    const existing = formData[currentQ.key]
      ? (Array.isArray(formData[currentQ.key]) ? formData[currentQ.key] : formData[currentQ.key].split(', ').filter(Boolean))
      : [];

    let updated;
    if (existing.includes(typeName)) {
      updated = existing.filter((item) => item !== typeName);
    } else {
      updated = [...existing, typeName];
    }
    setFormData((prev) => ({ ...prev, [currentQ.key]: updated }));
  };

  // Direct Add New Case Type inside Questionnaire (without closing form)
  const handleAddNewCaseType = async (typeName) => {
    let name = (typeName || caseTypeSearch).trim();
    if (!name) {
      name = window.prompt('Naya Case Type ka naam enter karein (e.g. POCSO Act):');
      if (!name || !name.trim()) return;
      name = name.trim();
    }

    // 1. Add to local extraCaseTypes list
    setExtraCaseTypes((prev) => [...prev, { id: 'custom-' + Date.now(), name }]);

    // 2. Automatically select it for the current survey
    handleMultiSelectToggle(name);
    setCaseTypeSearch('');
    setShowCaseTypeDropdown(true);

    // 3. Persist to API / Database in background
    try {
      await fetch(`${API_BASE_URL}/api/case-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (onCaseTypeAdded) {
        onCaseTypeAdded(name);
      }
    } catch (err) {
      console.warn('Could not save case type to API:', err);
    }
  };

  // Question 3 High-speed entry key handler
  const handleCaseTypeInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = caseTypeSearch.trim().toLowerCase();
      if (q) {
        // Find match in all case types list
        const match = allUniqueCaseTypes.find((t) => t.name.toLowerCase().includes(q));
        if (match) {
          handleMultiSelectToggle(match.name);
          setCaseTypeSearch('');
          setShowCaseTypeDropdown(true);
        } else {
          // Add custom case type and select it directly!
          handleAddNewCaseType(caseTypeSearch.trim());
        }
      } else {
        // If input empty and Enter is pressed:
        const selected = formData[currentQ.key]
          ? (Array.isArray(formData[currentQ.key]) ? formData[currentQ.key] : formData[currentQ.key].split(', ').filter(Boolean))
          : [];
        if (selected.length > 0) {
          handleNext();
        } else {
          setShowCaseTypeDropdown((prev) => !prev);
        }
      }
    }
  };

  const handleNext = async () => {
    if (checkingUtct) return; // Prevent multiple requests while verifying
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

    // UT/CT No Uniqueness Check on Question 1
    if (currentQ.isUniqueCheck) {
      const utctTrimmed = String(currentVal).trim();
      setCheckingUtct(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/survey/check-utct?no=${encodeURIComponent(utctTrimmed)}`);
        const data = await res.json();
        if (data.exists) {
          setError(`❌ Error: UT/CT No. "${utctTrimmed}" already exists in the database! Please enter a unique number.`);
          setCheckingUtct(false);
          return;
        }
      } catch (err) {
        console.warn('Backend uniqueness check skipped or failed:', err);
      } finally {
        setCheckingUtct(false);
      }
    }

    // Special validation for Question 11 (Advocate payment advance)
    if (isQ11) {
      const valStr = String(formData.advocate_payment_advance || currentVal || '').trim();
      const lower = valStr.toLowerCase();

      if (!lower) {
        setError('Please enter or select Yes or No');
        return;
      }

      if (lower.startsWith('yes')) {
        if (!advanceAmount.trim()) {
          setError('Please enter the advance payment amount for Question 11!');
          setTimeout(() => amountInputRef.current?.focus(), 50);
          return;
        }
        setFormData((prev) => ({
          ...prev,
          advocate_payment_advance: `Yes / ${advanceAmount.trim()}`
        }));
      } else if (lower.startsWith('no')) {
        setFormData((prev) => ({
          ...prev,
          advocate_payment_advance: 'No'
        }));
      } else {
        setError('Please enter Only Yes or No');
        return;
      }
    }

    // Special validation for Question 16 (Complete fees total initially)
    if (isQ16) {
      const valStr = String(formData.complete_fees_total_initially || currentVal || '').trim();
      const lower = valStr.toLowerCase();

      if (!lower) {
        setError('Please enter or select Yes or No');
        return;
      }

      if (lower.startsWith('yes')) {
        if (!feesAmount.trim()) {
          setError('Please enter the complete fees amount for Question 16!');
          setTimeout(() => feesAmountInputRef.current?.focus(), 50);
          return;
        }
        setFormData((prev) => ({
          ...prev,
          complete_fees_total_initially: `Yes / ${feesAmount.trim()}`
        }));
      } else if (lower.startsWith('no')) {
        setFormData((prev) => ({
          ...prev,
          complete_fees_total_initially: 'No'
        }));
      } else {
        setError('Please enter Only Yes or No');
        return;
      }
    }

    // If user clicked Edit from the review screen, jump right back to review
    if (jumpBackToReview) {
      setJumpBackToReview(false);
      setCurrentStep(totalQuestions);
      return;
    }

    // Proceed to next step
    if (currentStep < totalQuestions) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (checkingUtct) return; // Block going back while verifying
    setError('');
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleKeyDown = (e) => {
    if (checkingUtct) {
      e.preventDefault();
      return; // Block repeated Enter while verifying
    }
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleNext();
      return;
    }
    if (e.key === 'Enter' && currentQ.type !== 'textarea' && !isQ3) {
      e.preventDefault();
      handleNext();
    }
  };

  const handleEditQuestionFromReview = (index) => {
    setJumpBackToReview(true);
    setCurrentStep(index);
  };

  const handleSubmitSurvey = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const payload = {
        ...formData,
        case_type: Array.isArray(formData.case_type) ? formData.case_type.join(', ') : (formData.case_type || '')
      };

      const res = await fetch(`${API_BASE_URL}/api/survey/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        onSurveySaved(data.data || payload);
        onClose();
      } else {
        setError(data.message || 'Failed to save survey. Check duplicate UT/CT no.');
      }
    } catch (err) {
      setError('Connection to backend failed. Please ensure Node.js server is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ================= 1. REVIEW & EDIT SUMMARY SCREEN =================
  if (isReviewMode) {
    return createPortal(
      <div className="wizard-backdrop animate-fade-in">
        <div className="review-summary-card">
          <div className="review-summary-header">
            <div>
              <div className="review-summary-title">Review All 24 Questions & Answers</div>
              <div className="review-summary-subtitle">
                Please verify the survey answers below. Press <strong>Ctrl + Enter</strong> or click Submit to save.
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
            {SURVEY_QUESTIONS.map((q, idx) => {
              const val = formData[q.key];
              const displayVal = Array.isArray(val) ? val.join(', ') : val;
              return (
                <div key={q.id} className="review-item-card">
                  <div style={{ flex: 1 }}>
                    <div className="review-item-qnum">Question {idx + 1}</div>
                    <div className="review-item-question">{q.label}</div>
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
                    onClick={() => handleEditQuestionFromReview(idx)}
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
              <span>Back to Q24</span>
            </button>

            <button
              type="button"
              className="btn-submit-final"
              onClick={handleSubmitSurvey}
              disabled={isSubmitting}
            >
              <Send size={18} />
              <span>{isSubmitting ? 'Saving to Database...' : 'Submit & Save Survey (Ctrl + Enter ↵)'}</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // ================= 2. QUESTION-BY-QUESTION WIZARD (1 QUESTION AT A TIME) =================
  const selectedTypes = formData[currentQ.key]
    ? (Array.isArray(formData[currentQ.key]) ? formData[currentQ.key] : formData[currentQ.key].split(', ').filter(Boolean))
    : [];

  const baseList = (caseTypes && caseTypes.length > 0) ? caseTypes : DEFAULT_FALLBACK_CASE_TYPES;
  const mergedList = [...baseList, ...extraCaseTypes];
  const allUniqueCaseTypes = [];
  const seenNames = new Set();
  for (const item of mergedList) {
    const trimmed = (item.name || '').trim();
    const lower = trimmed.toLowerCase();
    if (trimmed && !seenNames.has(lower)) {
      seenNames.add(lower);
      allUniqueCaseTypes.push({ id: item.id || trimmed, name: trimmed });
    }
  }

  const filteredCaseTypes = caseTypeSearch.trim()
    ? allUniqueCaseTypes.filter((t) => t.name.toLowerCase().includes(caseTypeSearch.trim().toLowerCase()))
    : allUniqueCaseTypes;

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onKeyDown={handleKeyDown}>
      <div className="wizard-card">
        {/* Top Info Bar */}
        <div className="wizard-top-bar">
          <div className="wizard-progress-info">
            <span className="wizard-step-pill">
              Question {currentStep + 1} of {totalQuestions}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
              {Math.round(((currentStep + 1) / totalQuestions) * 100)}% Completed
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
            style={{ width: `${((currentStep + 1) / totalQuestions) * 100}%` }}
          />
        </div>

        {/* Question Content */}
        <div className="wizard-body">
          <div className="wizard-question-label">{currentQ.label}</div>

          {/* QUESTION 3: CASE TYPE WITH HIGH-SPEED INPUT + DROPDOWN LIST */}
          {isQ3 ? (
            <div>
              {/* Selected Badges */}
              {selectedTypes.length > 0 && (
                <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedTypes.map((typeName) => (
                    <span
                      key={typeName}
                      className="tag-case-type"
                      style={{ background: '#1E293B', color: '#FFFFFF', padding: '5px 12px', fontSize: '12.5px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span>{typeName}</span>
                      <X
                        size={14}
                        style={{ cursor: 'pointer', opacity: 0.8 }}
                        onClick={() => handleMultiSelectToggle(typeName)}
                      />
                    </span>
                  ))}
                </div>
              )}

              {/* High Speed Input & Only "+" Icon Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                  <input
                    ref={inputRef}
                    type="text"
                    className="wizard-input-box"
                    style={{ paddingLeft: '40px', width: '100%', height: '48px', boxSizing: 'border-box' }}
                    placeholder="Search case type (or type new name & click +)..."
                    value={caseTypeSearch}
                    onChange={(e) => {
                      setCaseTypeSearch(e.target.value);
                      setShowCaseTypeDropdown(true);
                    }}
                    onKeyDown={handleCaseTypeInputKeyDown}
                    onFocus={() => setShowCaseTypeDropdown(true)}
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  style={{
                    width: '48px',
                    height: '48px',
                    minWidth: '48px',
                    maxWidth: '48px',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#EE9576',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(238, 149, 118, 0.35)',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onClick={() => handleAddNewCaseType(caseTypeSearch)}
                  title="Naya Case Type add aur select karein"
                  aria-label="Add Case Type"
                >
                  <Plus size={24} strokeWidth={2.6} />
                </button>
              </div>

              {/* Dropdown Toggle Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  padding: '6px 4px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: '#475569'
                }}
                onClick={() => setShowCaseTypeDropdown((prev) => !prev)}
              >
                <span>Available Case Types ({filteredCaseTypes.length})</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#2563EB' }}>
                  {showCaseTypeDropdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <span>{showCaseTypeDropdown ? 'Hide List' : 'Show Dropdown List (Enter)'}</span>
                </span>
              </div>

              {/* Case Types Dropdown List */}
              {showCaseTypeDropdown && (
                <div className="multi-select-container animate-fade-in" style={{ maxHeight: '180px', marginTop: '6px' }}>
                  {filteredCaseTypes.length > 0 ? (
                    filteredCaseTypes.map((t) => {
                      const isSelected = selectedTypes.includes(t.name);
                      return (
                        <button
                          key={t.id || t.name}
                          type="button"
                          className={`selectable-tag ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleMultiSelectToggle(t.name)}
                        >
                          {isSelected && <Check size={14} />}
                          <span>{t.name}</span>
                        </button>
                      );
                    })
                  ) : (
                    <div style={{ padding: '12px', fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span>No matching type for "{caseTypeSearch}".</span>
                      <button
                        type="button"
                        className="btn-primary-coral"
                        style={{ padding: '6px 12px', fontSize: '12.5px', borderRadius: '8px' }}
                        onClick={() => handleAddNewCaseType(caseTypeSearch)}
                      >
                        <Plus size={14} />
                        <span>Add "{caseTypeSearch.trim()}" & Select</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : isQ11 ? (
            /* QUESTION 11: ADVOCATE PAYMENT ADVANCE (YES -> AMOUNT, NO -> NEXT) */
            <div>
              <input
                ref={inputRef}
                type="text"
                className="wizard-input-box"
                placeholder="Type 'Yes' or 'No'"
                value={q11DisplayVal}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.toLowerCase().startsWith('no')) {
                    handleSelectQ11No();
                  } else if (val.toLowerCase().startsWith('yes')) {
                    handleSelectQ11Yes();
                  } else {
                    handleInputChange(val);
                  }
                }}
              />
              <div className="yes-no-options-grid">
                <button
                  type="button"
                  className={`btn-yes-choice ${isQ11Yes ? 'selected' : ''}`}
                  onClick={handleSelectQ11Yes}
                >
                  <CheckCircle2 size={18} />
                  <span>Yes</span>
                </button>
                <button
                  type="button"
                  className={`btn-no-choice ${q11DisplayVal.toLowerCase() === 'no' ? 'selected' : ''}`}
                  onClick={handleSelectQ11No}
                >
                  <X size={18} />
                  <span>No</span>
                </button>
              </div>

              {/* Amount input for Q11 */}
              {isQ11Yes && (
                <div
                  className="animate-fade-in"
                  style={{
                    marginTop: '16px',
                    background: '#F8FAFC',
                    padding: '16px 18px',
                    borderRadius: '14px',
                    border: '1.5px solid #CBD5E1',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                >
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                    Enter Advance Payment Amount (₹):
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '14px', fontWeight: 800, color: '#475569', fontSize: '16px' }}>₹</span>
                    <input
                      ref={amountInputRef}
                      type="text"
                      inputMode="numeric"
                      className="wizard-input-box"
                      style={{ paddingLeft: '32px' }}
                      placeholder="e.g. 10000 or 25000"
                      value={advanceAmount}
                      onChange={(e) => handleAdvanceAmountChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleNext();
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                    Excel report me ye ek hi column me <strong>Yes / {advanceAmount || '[amount]'}</strong> show hoga.
                  </div>
                </div>
              )}
            </div>
          ) : isQ16 ? (
            /* QUESTION 16: COMPLETE FEES TOTAL INITIALLY (YES -> AMOUNT, NO -> NEXT) */
            <div>
              <input
                ref={inputRef}
                type="text"
                className="wizard-input-box"
                placeholder="Type 'Yes' or 'No'"
                value={q16DisplayVal}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.toLowerCase().startsWith('no')) {
                    handleSelectQ16No();
                  } else if (val.toLowerCase().startsWith('yes')) {
                    handleSelectQ16Yes();
                  } else {
                    handleInputChange(val);
                  }
                }}
              />
              <div className="yes-no-options-grid">
                <button
                  type="button"
                  className={`btn-yes-choice ${isQ16Yes ? 'selected' : ''}`}
                  onClick={handleSelectQ16Yes}
                >
                  <CheckCircle2 size={18} />
                  <span>Yes</span>
                </button>
                <button
                  type="button"
                  className={`btn-no-choice ${q16DisplayVal.toLowerCase() === 'no' ? 'selected' : ''}`}
                  onClick={handleSelectQ16No}
                >
                  <X size={18} />
                  <span>No</span>
                </button>
              </div>

              {/* Amount input for Q16 */}
              {isQ16Yes && (
                <div
                  className="animate-fade-in"
                  style={{
                    marginTop: '16px',
                    background: '#F8FAFC',
                    padding: '16px 18px',
                    borderRadius: '14px',
                    border: '1.5px solid #CBD5E1',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                >
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                    Enter Complete Total Fees Amount (₹):
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '14px', fontWeight: 800, color: '#475569', fontSize: '16px' }}>₹</span>
                    <input
                      ref={feesAmountInputRef}
                      type="text"
                      inputMode="numeric"
                      className="wizard-input-box"
                      style={{ paddingLeft: '32px' }}
                      placeholder="e.g. 50000 or 100000"
                      value={feesAmount}
                      onChange={(e) => handleFeesAmountChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleNext();
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                    Excel report me ye ek hi column me <strong>Yes / {feesAmount || '[amount]'}</strong> show hoga.
                  </div>
                </div>
              )}
            </div>
          ) : isQ23 ? (
            /* QUESTION 23: PRIORITY - ONLY 2 OPTIONS (JAIL SE BAHAR / PAISE BACHANA) */
            <div>
              <div className="yes-no-options-grid" style={{ gap: '14px' }}>
                <button
                  type="button"
                  className={`btn-pill-choice ${currentVal === 'Jail se bahar jaldi jana' ? 'selected' : ''}`}
                  onClick={() => handleInputChange('Jail se bahar jaldi jana')}
                  style={{ padding: '16px 14px', fontSize: '15px', fontWeight: 800, borderRadius: '12px' }}
                >
                  Jail se bahar jaldi jana
                </button>
                <button
                  type="button"
                  className={`btn-pill-choice ${currentVal === 'Paise bachana' ? 'selected' : ''}`}
                  onClick={() => handleInputChange('Paise bachana')}
                  style={{ padding: '16px 14px', fontSize: '15px', fontWeight: 800, borderRadius: '12px' }}
                >
                  Paise bachana
                </button>
              </div>
            </div>
          ) : isQ24 ? (
            /* QUESTION 24: PRISONER PSYCHOLOGIC SURVEY (YES / NO OPTION + REMARKS) */
            <div>
              <div className="yes-no-options-grid" style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  className={`btn-yes-choice ${q24Choice === 'Yes' ? 'selected' : ''}`}
                  onClick={() => handleSelectQ24Choice('Yes')}
                >
                  <CheckCircle2 size={18} />
                  <span>Yes</span>
                </button>
                <button
                  type="button"
                  className={`btn-no-choice ${q24Choice === 'No' ? 'selected' : ''}`}
                  onClick={() => handleSelectQ24Choice('No')}
                >
                  <X size={18} />
                  <span>No</span>
                </button>
              </div>

              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Psychological State / Survey Remarks (Optional):
              </label>
              <textarea
                ref={inputRef}
                rows={3}
                className="wizard-input-box"
                placeholder="Enter psychological state, behavioral remarks..."
                value={q24Remarks}
                onChange={(e) => handleQ24RemarksChange(e.target.value)}
              />
            </div>
          ) : currentQ.type === 'textarea' ? (
            <textarea
              ref={inputRef}
              rows={4}
              className="wizard-input-box"
              placeholder={currentQ.placeholder}
              value={currentVal}
              onChange={(e) => handleInputChange(e.target.value)}
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
              />
              <div className="yes-no-options-grid">
                <button
                  type="button"
                  className={`btn-yes-choice ${currentVal.toLowerCase() === 'yes' ? 'selected' : ''}`}
                  onClick={() => handleInputChange('Yes')}
                >
                  <CheckCircle2 size={18} />
                  <span>Yes</span>
                </button>
                <button
                  type="button"
                  className={`btn-no-choice ${currentVal.toLowerCase() === 'no' ? 'selected' : ''}`}
                  onClick={() => handleInputChange('No')}
                >
                  <X size={18} />
                  <span>No</span>
                </button>
              </div>
            </div>
          ) : currentQ.type === 'yesno_or_choice' ? (
            <div>
              <input
                ref={inputRef}
                type="text"
                className="wizard-input-box"
                placeholder={currentQ.placeholder}
                value={currentVal}
                onChange={(e) => handleInputChange(e.target.value)}
              />
              <div className="yes-no-options-grid">
                {currentQ.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`btn-pill-choice ${currentVal.toLowerCase() === opt.toLowerCase() ? 'selected' : ''}`}
                    onClick={() => handleInputChange(opt)}
                  >
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <input
                ref={inputRef}
                type={currentQ.type === 'number' ? 'text' : 'text'}
                inputMode={currentQ.type === 'number' ? 'numeric' : 'text'}
                className="wizard-input-box"
                placeholder={currentQ.placeholder}
                value={currentVal}
                onChange={(e) => handleInputChange(e.target.value)}
                disabled={checkingUtct}
              />
              {checkingUtct && currentQ.isUniqueCheck && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 14px',
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  borderRadius: '10px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  border: '1px solid #BFDBFE'
                }}>
                  <RefreshCw size={15} className="spin-icon" />
                  <span>Checking database for duplicate UT/CT No, please wait...</span>
                </div>
              )}
              {currentQ.type === 'yesno_text' && (
                <div className="yes-no-options-grid">
                  <button
                    type="button"
                    className={`btn-yes-choice ${currentVal.toLowerCase().startsWith('yes') ? 'selected' : ''}`}
                    onClick={() => handleInputChange('Yes')}
                  >
                    <CheckCircle2 size={18} />
                    <span>Yes</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-no-choice ${currentVal.toLowerCase().startsWith('no') ? 'selected' : ''}`}
                    onClick={() => handleInputChange('No')}
                  >
                    <X size={18} />
                    <span>No</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* User Requested Note */}
          {currentQ.note && (
            <div className="wizard-note-banner">
              <span>{currentQ.note}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="wizard-error-banner">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="wizard-footer">
          <button
            type="button"
            className="btn-wizard-prev"
            onClick={handlePrev}
            disabled={currentStep === 0 || checkingUtct}
            style={{
              opacity: (currentStep === 0 || checkingUtct) ? 0.4 : 1,
              cursor: (currentStep === 0 || checkingUtct) ? 'not-allowed' : 'pointer'
            }}
          >
            <ArrowLeft size={16} />
            <span>Previous</span>
          </button>

          <button
            type="button"
            className="btn-wizard-next"
            onClick={handleNext}
            disabled={checkingUtct}
          >
            {checkingUtct ? (
              <>
                <RefreshCw size={16} className="spin-icon" />
                <span>Verifying UT/CT No...</span>
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
