import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight, ArrowLeft, Check, AlertCircle, Edit3, Send, CheckCircle2, ChevronDown, ChevronUp, Search, Plus, RefreshCw, Trash2, Scale, UserPlus, Settings } from 'lucide-react';
import { SURVEY_QUESTIONS, getQuestionLabel, STANDARD_KEYS } from '../data/questions';
import { API_BASE_URL } from '../config';
import CourtTypesModal from './CourtTypesModal';

const DEFAULT_FALLBACK_COURT_TYPES = [
  { id: 1, name: 'District Court' },
  { id: 2, name: 'Sessions Court' },
  { id: 3, name: 'High Court' },
  { id: 4, name: 'Supreme Court' },
  { id: 5, name: 'Magistrate Court (CMM / ACMM)' },
  { id: 6, name: 'Special / NDPS Court' },
  { id: 7, name: 'Family Court' },
  { id: 8, name: 'Other' }
];

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

const matchOptionByChar = (optionsList, keyChar) => {
  if (!keyChar || typeof keyChar !== 'string' || !Array.isArray(optionsList) || optionsList.length === 0) return null;
  const k = keyChar.trim().toLowerCase();
  if (!k) return null;

  // 1. Exact first letter of option
  for (const item of optionsList) {
    const str = typeof item === 'object' && item !== null ? (item.name || '') : String(item);
    const trimmed = str.trim();
    if (trimmed.toLowerCase().startsWith(k)) {
      return trimmed;
    }
  }

  // 2. First letter of any individual word in option (e.g. 'C' -> 'Family Court')
  for (const item of optionsList) {
    const str = typeof item === 'object' && item !== null ? (item.name || '') : String(item);
    const words = str.trim().split(/\s+/);
    if (words.some((w) => w.toLowerCase().startsWith(k))) {
      return str.trim();
    }
  }

  return null;
};

export default function SurveyWizard({
  isOpen,
  onClose,
  caseTypes = [],
  courtTypes = [],
  questions = SURVEY_QUESTIONS,
  onCaseTypeAdded,
  onCourtTypeAdded,
  onCourtTypeEdited,
  onCourtTypeDeleted,
  onSurveySaved,
  apiEndpoint = '/api/survey'
}) {
  const [currentStep, setCurrentStep] = useState(0); // 0 to N-1 for questions, N for Review Summary
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [checkingUtct, setCheckingUtct] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jumpBackToReview, setJumpBackToReview] = useState(false);

  // Dynamic Case Types state for Q3
  const [extraCaseTypes, setExtraCaseTypes] = useState([]);

  // Question 8: Multi-Advocates Builder & Court Types
  const [advocatesList, setAdvocatesList] = useState([
    { name: '', fee: '', experience: 'Good', known: 'Known', court_type: 'District Court' }
  ]);
  const [localCourtTypes, setLocalCourtTypes] = useState(
    Array.isArray(courtTypes) && courtTypes.length > 0 ? courtTypes : DEFAULT_FALLBACK_COURT_TYPES
  );
  const [isCourtTypesModalOpen, setIsCourtTypesModalOpen] = useState(false);

  // Question 11: Advance Payment Amount
  const [advanceAmount, setAdvanceAmount] = useState('');
  const amountInputRef = useRef(null);

  // Question 16: Complete Fees Amount
  const [feesAmount, setFeesAmount] = useState('');
  const feesAmountInputRef = useRef(null);

  // Question 3: Case Type High-speed entry
  const [caseTypeSearch, setCaseTypeSearch] = useState('');
  const [showCaseTypeDropdown, setShowCaseTypeDropdown] = useState(true);

  const inputRef = useRef(null);

  // Always sort questions by order_num so changes in Manage Questions instantly reorder "+ Add Data"
  const activeQuestions = useMemo(() => {
    const list = (Array.isArray(questions) && questions.length > 0) ? questions : SURVEY_QUESTIONS;

    return [...list]
      .filter((q) => q && q.key !== '__remarks_map__' && q.type !== 'remarks_store')
      .sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0))
      .map((q) => {
        const hasRemark = Boolean(q?.has_remark);
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

  const isCaseTypeQ =
    currentQ?.key === 'case_type' ||
    currentQ?.type === 'case_type' ||
    (currentQ?.type === 'multi-select' && (!currentQ?.options || currentQ.options.length === 0));

  const isCourtTypeQ =
    currentQ?.type === 'court_type' ||
    (currentQ?.key === 'high_court_advocate' && currentQ?.type === 'court_type');

  const isCustomChoiceQ =
    (currentQ?.type === 'custom_choice' || currentQ?.type === 'choice_text' || currentQ?.type === 'yesno_or_choice') &&
    Array.isArray(currentQ?.options) &&
    currentQ.options.length > 0;

  const isQ3 = isCaseTypeQ;
  const isQ8 = currentQ?.key === 'advocate_name_number';
  const isQ9 = currentQ?.key === 'known_unknown_advocate';
  const isQ11 = currentQ?.key === 'advocate_payment_advance';
  const isQ16 = currentQ?.key === 'complete_fees_total_initially';
  const isQ23 = currentQ?.key === 'priority_money_vs_release';

  // Synchronize court types list
  useEffect(() => {
    if (Array.isArray(courtTypes) && courtTypes.length > 0) {
      setLocalCourtTypes(courtTypes);
    } else {
      fetch(`${API_BASE_URL}/api/court-types`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.data) && d.data.length > 0) {
            setLocalCourtTypes(d.data);
          }
        })
        .catch(() => {});
    }
  }, [courtTypes, isOpen]);

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
      setAdvocatesList([
        { name: '', fee: '', experience: '', known: '', court_type: localCourtTypes[0]?.name || 'District Court' }
      ]);
    }
  }, [isOpen]);

  // Synchronize Question 8 (Advocates list)
  useEffect(() => {
    if (isQ8) {
      if (Array.isArray(formData.advocates_details) && formData.advocates_details.length > 0) {
        setAdvocatesList(formData.advocates_details);
      } else if (formData.advocate_name_number && typeof formData.advocate_name_number === 'string') {
        setAdvocatesList([
          { name: formData.advocate_name_number, fee: '', experience: '', known: '', court_type: localCourtTypes[0]?.name || 'District Court' }
        ]);
      }
    }
  }, [currentStep, isQ8]);

  const handleAdvocateFieldChange = (index, field, value) => {
    setError('');
    const updated = [...advocatesList];
    updated[index] = { ...updated[index], [field]: value };
    setAdvocatesList(updated);

    const summary = updated
      .filter((a) => (a.name || '').trim())
      .map((a, i) => {
        const parts = [];
        if (a.name) parts.push(`Name: ${a.name.trim()}`);
        if (a.fee) parts.push(`Fee: ₹${a.fee}`);
        if (a.experience) parts.push(`Exp: ${a.experience}`);
        if (a.known) parts.push(`Known: ${a.known}`);
        if (a.court_type) parts.push(`Court: ${a.court_type}`);
        return `[${i + 1}] ${parts.join(' | ')}`;
      })
      .join(' ; \n');

    setFormData((prev) => ({
      ...prev,
      advocates_details: updated,
      advocate_name_number: summary || updated[0]?.name || ''
    }));
  };

  const handleAddAdvocateCard = () => {
    setError('');
    const defaultCourt = localCourtTypes[0]?.name || 'District Court';
    const updated = [
      ...advocatesList,
      { name: '', fee: '', experience: '', known: '', court_type: defaultCourt }
    ];
    setAdvocatesList(updated);
    setFormData((prev) => ({
      ...prev,
      advocates_details: updated
    }));
  };

  const handleRemoveAdvocateCard = (index) => {
    if (advocatesList.length <= 1) return;
    setError('');
    const updated = advocatesList.filter((_, i) => i !== index);
    setAdvocatesList(updated);
    const summary = updated
      .filter((a) => (a.name || '').trim())
      .map((a, i) => {
        const parts = [];
        if (a.name) parts.push(`Name: ${a.name.trim()}`);
        if (a.fee) parts.push(`Fee: ₹${a.fee}`);
        if (a.experience) parts.push(`Exp: ${a.experience}`);
        if (a.known) parts.push(`Known: ${a.known}`);
        if (a.court_type) parts.push(`Court: ${a.court_type}`);
        return `[${i + 1}] ${parts.join(' | ')}`;
      })
      .join(' ; \n');

    setFormData((prev) => ({
      ...prev,
      advocates_details: updated,
      advocate_name_number: summary || updated[0]?.name || ''
    }));
  };

  const handleLocalAddCourtType = async (name) => {
    if (onCourtTypeAdded) {
      const res = await onCourtTypeAdded(name);
      if (res && res.success) {
        setLocalCourtTypes((prev) => [...prev, res.data || { id: Date.now(), name }]);
        return res;
      }
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/court-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        setLocalCourtTypes((prev) => [...prev, data.data || { id: Date.now(), name }]);
      }
      return data;
    } catch (e) {
      const fallbackObj = { id: Date.now(), name };
      setLocalCourtTypes((prev) => [...prev, fallbackObj]);
      return { success: true, data: fallbackObj };
    }
  };

  const handleLocalEditCourtType = async (id, name) => {
    if (onCourtTypeEdited) {
      await onCourtTypeEdited(id, name);
    } else {
      try {
        await fetch(`${API_BASE_URL}/api/court-types/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
      } catch (e) {}
    }
    setLocalCourtTypes((prev) =>
      prev.map((c) => ((c.id === id || c.name === id) ? { ...c, name } : c))
    );
    return { success: true };
  };

  const handleLocalDeleteCourtType = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete court type "${name}"?`)) return;
    if (onCourtTypeDeleted) {
      await onCourtTypeDeleted(id, name);
    } else {
      try {
        await fetch(`${API_BASE_URL}/api/court-types/${id}`, { method: 'DELETE' });
      } catch (e) {}
    }
    setLocalCourtTypes((prev) => prev.filter((c) => c.id !== id && c.name !== name));
  };

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
      let amt = '';
      if (raw.toLowerCase().startsWith('yes')) {
        const parts = raw.split('/');
        if (parts.length > 1) {
          amt = parts.slice(1).join('/').trim();
        }
      }
      setFeesAmount(amt);
    }
  }, [currentStep, isQ16]);

  // Focus input automatically on wizard open and on every step change
  useEffect(() => {
    if (isOpen && !isReviewMode) {
      const focusTarget = () => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      };
      // Immediate and staged timeouts to guarantee focus transfer in Portals
      focusTarget();
      const t1 = setTimeout(focusTarget, 30);
      const t2 = setTimeout(focusTarget, 100);
      const t3 = setTimeout(focusTarget, 250);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [isOpen, currentStep, isReviewMode]);

  const reviewEnteredTimeRef = useRef(0);
  const keysReleasedRef = useRef(true);

  // Track keyup to ensure Ctrl and Enter keys are released before allowing submit on review
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

  // Global Ctrl + Enter Shortcut listener
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKey = (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (checkingUtct || isSubmitting) return;

        if (isReviewMode) {
          const timeInReview = Date.now() - reviewEnteredTimeRef.current;
          // Must have been on review screen for at least 700ms AND keys released after transition
          if (timeInReview < 700 || !keysReleasedRef.current) {
            return;
          }
          handleSubmitSurvey();
        } else {
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey, true);
    return () => window.removeEventListener('keydown', handleGlobalKey, true);
  }, [isOpen, isReviewMode, checkingUtct, isSubmitting, totalQuestions, currentStep, currentQ, formData]);

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

  const buildQ16Value = (choice, amt) => {
    const cleanAmt = amt ? String(amt).trim() : '';
    if (choice === 'Yes') {
      return cleanAmt ? `Yes / ${cleanAmt}` : 'Yes';
    }
    return 'No';
  };

  const handleSelectQ16Yes = () => {
    setError('');
    const formatted = buildQ16Value('Yes', feesAmount);
    setFormData((prev) => ({ ...prev, complete_fees_total_initially: formatted }));
    setTimeout(() => {
      feesAmountInputRef.current?.focus();
    }, 100);
  };

  const handleSelectQ16No = () => {
    setError('');
    setFeesAmount('');
    const formatted = buildQ16Value('No', '');
    setFormData((prev) => ({ ...prev, complete_fees_total_initially: formatted }));
  };

  const handleFeesAmountChange = (val) => {
    setError('');
    const clean = val.replace(/[^0-9]/g, '');
    setFeesAmount(clean);
    const formatted = buildQ16Value('Yes', clean);
    setFormData((prev) => ({
      ...prev,
      complete_fees_total_initially: formatted
    }));
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
        const res = await fetch(`${API_BASE_URL}${apiEndpoint}/check-utct?no=${encodeURIComponent(utctTrimmed)}`);
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

    // Special handling for Question 8 (Multi-advocate details)
    if (isQ8) {
      const summary = advocatesList
        .filter((a) => (a.name || '').trim())
        .map((a, i) => {
          const parts = [];
          if (a.name) parts.push(`Name: ${a.name.trim()}`);
          if (a.fee) parts.push(`Fee: ₹${a.fee}`);
          if (a.experience) parts.push(`Exp: ${a.experience}`);
          if (a.known) parts.push(`Known: ${a.known}`);
          if (a.court_type) parts.push(`Court: ${a.court_type}`);
          return `[${i + 1}] ${parts.join(' | ')}`;
        })
        .join(' ; \n');

      setFormData((prev) => ({
        ...prev,
        advocates_details: advocatesList,
        advocate_name_number: summary || advocatesList[0]?.name || ''
      }));
    }

    // Special validation for Question 11 (Advocate payment advance)
    if (isQ11) {
      const valStr = String(formData.advocate_payment_advance || currentVal || '').trim();
      const lower = valStr.toLowerCase();

      if (!lower) {
        setError("Please enter or select complete 'Yes' or 'No' before proceeding.");
        return;
      }

      if (lower === 'y' || lower.startsWith('yes')) {
        if (!advanceAmount.trim()) {
          setError('Please enter the advance payment amount for Question 11!');
          setTimeout(() => amountInputRef.current?.focus(), 50);
          return;
        }
        setFormData((prev) => ({
          ...prev,
          advocate_payment_advance: `Yes / ${advanceAmount.trim()}`
        }));
      } else if (lower === 'n' || lower.startsWith('no')) {
        setFormData((prev) => ({
          ...prev,
          advocate_payment_advance: 'No'
        }));
      } else {
        setError("Please enter or select complete 'Yes' or 'No' only.");
        return;
      }
    }

    // Special validation for Question 16 (Complete fees total initially)
    if (isQ16) {
      const valStr = String(formData.complete_fees_total_initially || currentVal || '').trim();
      const lower = valStr.toLowerCase();

      if (!lower) {
        setError("Please enter or select complete 'Yes' or 'No' before proceeding.");
        return;
      }

      if (lower === 'y' || lower.startsWith('yes')) {
        if (!feesAmount.trim()) {
          setError('Please enter the complete fees amount for Question 16!');
          setTimeout(() => feesAmountInputRef.current?.focus(), 50);
          return;
        }
        setFormData((prev) => ({
          ...prev,
          complete_fees_total_initially: buildQ16Value('Yes', feesAmount)
        }));
      } else if (lower === 'n' || lower.startsWith('no')) {
        setFormData((prev) => ({
          ...prev,
          complete_fees_total_initially: buildQ16Value('No', '')
        }));
      } else {
        setError("Please enter or select complete 'Yes' or 'No' only.");
        return;
      }
    }

    // Special validation for Question 23 (Priority money vs release)
    if (isQ23) {
      const valStr = String(formData.priority_money_vs_release || currentVal || '').trim();
      const lower = valStr.toLowerCase();

      if (!lower) {
        setError('Please select or type your priority (Jail se bahar jaldi jana OR Paise bachana)');
        return;
      }

      if (lower.startsWith('j') || lower.includes('jail') || lower === '1') {
        setFormData((prev) => ({
          ...prev,
          priority_money_vs_release: 'Jail se bahar jaldi jana'
        }));
      } else if (lower.startsWith('p') || lower.includes('paise') || lower === '2') {
        setFormData((prev) => ({
          ...prev,
          priority_money_vs_release: 'Paise bachana'
        }));
      } else {
        setError('Please enter or select only one of: Jail se bahar jaldi jana OR Paise bachana');
        return;
      }
    }

    // Special strict validation for currentQ.type === 'yesno'
    if (currentQ.type === 'yesno') {
      const valStr = String(formData[currentQ.key] ?? currentVal ?? '').trim();
      const lower = valStr.toLowerCase();

      if (!lower) {
        setError("Please enter or select complete 'Yes' or 'No' before proceeding.");
        return;
      }

      if (lower === 'y' || lower === 'yes') {
        setFormData((prev) => ({ ...prev, [currentQ.key]: 'Yes' }));
      } else if (lower === 'n' || lower === 'no') {
        setFormData((prev) => ({ ...prev, [currentQ.key]: 'No' }));
      } else {
        setError("Please enter or select complete 'Yes' or 'No' only.");
        return;
      }
    }

    // Special strict validation for currentQ.type === 'yesno_text' (Q15, Q20, Q21)
    if (currentQ.type === 'yesno_text') {
      const valStr = String(formData[currentQ.key] ?? currentVal ?? '').trim();
      const lower = valStr.toLowerCase();

      if (!lower) {
        setError("Please enter or select complete 'Yes' or 'No' before proceeding.");
        return;
      }

      if (lower === 'y' || lower === 'yes') {
        setFormData((prev) => ({ ...prev, [currentQ.key]: 'Yes' }));
      } else if (lower === 'n' || lower === 'no') {
        setFormData((prev) => ({ ...prev, [currentQ.key]: 'No' }));
      } else if (lower.startsWith('yes') || lower.startsWith('no')) {
        // Valid yes/no response with details
      } else {
        setError("Please start with complete 'Yes' or 'No' before proceeding.");
        return;
      }
    }

    // Special strict validation for Q9 or custom questions with Yes/No in options
    if (isQ9 || (!isQ11 && !isQ16 && !isQ23 && !isQ24 && currentQ.type !== 'yesno' && currentQ.type !== 'yesno_text' && Array.isArray(currentQ.options) && currentQ.options.includes('Yes') && currentQ.options.includes('No') && currentQ.type !== 'multi-select')) {
      const valStr = String(formData[currentQ.key] ?? currentVal ?? '').trim();
      const lower = valStr.toLowerCase();

      if (!lower) {
        setError("Please enter or select complete 'Yes' or 'No' (or valid option) before proceeding.");
        return;
      }

      if (lower === 'y' || lower === 'yes') {
        setFormData((prev) => ({ ...prev, [currentQ.key]: 'Yes' }));
      } else if (lower === 'n' || lower === 'no') {
        setFormData((prev) => ({ ...prev, [currentQ.key]: 'No' }));
      } else if (lower === 'known' || lower === 'k') {
        setFormData((prev) => ({ ...prev, [currentQ.key]: 'Known' }));
      } else if (lower === 'unknown' || lower === 'u') {
        setFormData((prev) => ({ ...prev, [currentQ.key]: 'Unknown' }));
      } else if (currentQ.options && currentQ.options.some((o) => o.toLowerCase() === lower)) {
        // matches one of the options
      } else {
        setError("Please enter or select a valid complete option ('Yes' or 'No').");
        return;
      }
    }

    // If user clicked Edit from the review screen, jump right back to review
    if (jumpBackToReview) {
      setJumpBackToReview(false);
      reviewEnteredTimeRef.current = Date.now();
      keysReleasedRef.current = false;
      setCurrentStep(totalQuestions);
      return;
    }

    // Proceed to next step
    if (currentStep < totalQuestions) {
      if (currentStep === totalQuestions - 1) {
        // Entering review mode: lock Ctrl+Enter submit until keys are released and cooldown passes
        reviewEnteredTimeRef.current = Date.now();
        keysReleasedRef.current = false;
      }
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
      return;
    }
    // Only handle plain Enter for regular inputs (Ctrl+Enter is handled cleanly by window listener)
    if (e.key === 'Enter' && !e.ctrlKey && currentQ?.type !== 'textarea' && !isQ3 && !isQ8) {
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
      // Gather all custom question answers into a dedicated object
      const customObj = {};
      Object.keys(formData).forEach((k) => {
        if (!STANDARD_KEYS.includes(k) && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(k)) {
          if (formData[k] !== undefined && formData[k] !== null && formData[k] !== '') {
            customObj[k] = Array.isArray(formData[k]) ? formData[k].join(', ') : formData[k];
          }
        }
      });

      // Auto-detect utct_no and name from questions if custom keys were used
      const q1Key = activeQuestions[0]?.key;
      const q2Key = activeQuestions[1]?.key;
      const utctVal = (formData.utct_no || (q1Key ? formData[q1Key] : '') || '').trim();
      const nameVal = (formData.name || (q2Key ? formData[q2Key] : '') || 'Prisoner').trim();

      const payload = {
        ...formData,
        utct_no: utctVal || (formData[Object.keys(formData)[0]] ? String(formData[Object.keys(formData)[0]]).trim() : ''),
        name: nameVal,
        case_type: Array.isArray(formData.case_type) ? formData.case_type.join(', ') : (formData.case_type || ''),
        custom_answers: JSON.stringify(customObj)
      };

      const res = await fetch(`${API_BASE_URL}${apiEndpoint}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        const savedRecord = { ...payload, ...(data.data || {}), ...customObj };
        onSurveySaved(savedRecord);
        onClose();
      } else {
        setError(data.message || data.error || 'Failed to save survey. Check duplicate UT/CT no.');
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
              <div className="review-summary-title">Review All {totalQuestions} Questions & Answers</div>
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
            {activeQuestions.map((q, idx) => {
              const val = formData[q.key];
              const displayVal = Array.isArray(val) ? val.join(', ') : val;
              return (
                <div key={q.id || idx} className="review-item-card">
                  <div style={{ flex: 1 }}>
                    <div className="review-item-qnum">Question #{q.order_num ?? idx + 1}</div>
                    <div className="review-item-question">{getQuestionLabel(q, idx)}</div>
                    <div>
                      {q.key === 'advocate_name_number' && Array.isArray(formData.advocates_details) && formData.advocates_details.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                          {formData.advocates_details.map((adv, aIdx) => (
                            <div key={aIdx} style={{ background: '#F1F5F9', padding: '6px 10px', borderRadius: '8px', fontSize: '12.5px', color: '#1E293B', border: '1px solid #E2E8F0' }}>
                              <strong>#{aIdx + 1} {adv.name || 'Advocate'}</strong> — Fee: ₹{adv.fee || 0} | Exp: {adv.experience} | Known: {adv.known} | Court: {adv.court_type}
                            </div>
                          ))}
                        </div>
                      ) : displayVal ? (
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
              <span>Back to Previous Question</span>
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
              Question #{currentQ?.order_num ?? (currentStep + 1)} ({currentStep + 1} of {totalQuestions})
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
          <div className="wizard-question-label">{getQuestionLabel(currentQ, currentStep)}</div>

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
          ) : isQ8 ? (
            /* QUESTION 8: ADVOCATE DETAILS BUILDER (MULTI-ADVOCATE AS PER IMAGE 2) */
            <div className="advocates-builder-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                  Advocate Records: <strong>{advocatesList.length} Added</strong>
                </span>
                <button
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
                    color: '#EA580C',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  onClick={() => setIsCourtTypesModalOpen(true)}
                  title="Manage court type options"
                >
                  <Scale size={14} />
                  <span>Manage Court Types</span>
                </button>
              </div>

              {advocatesList.map((adv, aIdx) => (
                <div
                  key={aIdx}
                  style={{
                    background: '#F8FAFC',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '14px',
                    padding: '16px 18px',
                    marginBottom: '16px',
                    position: 'relative',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          background: '#EE9576',
                          color: '#fff',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 800
                        }}
                      >
                        {aIdx + 1}
                      </span>
                      <strong style={{ fontSize: '14px', color: '#1E293B' }}>
                        Advocate #{aIdx + 1}
                      </strong>
                    </div>

                    {advocatesList.length > 1 && (
                      <button
                        type="button"
                        style={{
                          background: '#FEE2E2',
                          color: '#DC2626',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onClick={() => handleRemoveAdvocateCard(aIdx)}
                        title="Remove this advocate"
                      >
                        <Trash2 size={14} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {/* 5 Input Boxes / Columns per Image 2 */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px'
                    }}
                  >
                    {/* 1. Advocate Name */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                        Advocate Name:
                      </label>
                      <input
                        type="text"
                        className="wizard-input-box"
                        style={{ height: '42px', fontSize: '13.5px', padding: '8px 12px' }}
                        placeholder="e.g. Adv. R.K. Gupta (+91 9876543210)"
                        value={adv.name || ''}
                        onChange={(e) => handleAdvocateFieldChange(aIdx, 'name', e.target.value)}
                        autoFocus={aIdx === 0}
                      />
                    </div>

                    {/* 2. Fee */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                        Fee (₹):
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: '10px', fontWeight: 700, color: '#64748B' }}>₹</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="wizard-input-box"
                          style={{ height: '42px', fontSize: '13.5px', paddingLeft: '26px' }}
                          placeholder="e.g. 50000"
                          value={adv.fee || ''}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/[^0-9]/g, '');
                            handleAdvocateFieldChange(aIdx, 'fee', clean);
                          }}
                        />
                      </div>
                    </div>

                    {/* 3. Good / Bad (Auto-fill on 'G' or 'B' only) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                        Good / Bad:
                      </label>
                      <input
                        type="text"
                        className="wizard-input-box"
                        style={{
                          height: '42px',
                          fontSize: '13.5px',
                          padding: '8px 12px',
                          fontWeight: adv.experience ? 700 : 400,
                          color: adv.experience === 'Good' ? '#16A34A' : adv.experience === 'Bad' ? '#DC2626' : '#1E293B',
                          background: adv.experience === 'Good' ? '#F0FDF4' : adv.experience === 'Bad' ? '#FEF2F2' : '#FFFFFF',
                          borderColor: adv.experience === 'Good' ? '#86EFAC' : adv.experience === 'Bad' ? '#FECACA' : '#CBD5E1'
                        }}
                        placeholder="Type 'G' or 'B'"
                        value={adv.experience || ''}
                        onKeyDown={(e) => {
                          if (['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
                          if (e.key === 'Backspace' || e.key === 'Delete') {
                            e.preventDefault();
                            handleAdvocateFieldChange(aIdx, 'experience', '');
                            return;
                          }
                          const key = e.key.toLowerCase();
                          if (key === 'g') {
                            e.preventDefault();
                            handleAdvocateFieldChange(aIdx, 'experience', 'Good');
                          } else if (key === 'b') {
                            e.preventDefault();
                            handleAdvocateFieldChange(aIdx, 'experience', 'Bad');
                          } else {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase();
                          if (val.includes('g')) handleAdvocateFieldChange(aIdx, 'experience', 'Good');
                          else if (val.includes('b')) handleAdvocateFieldChange(aIdx, 'experience', 'Bad');
                          else if (val === '') handleAdvocateFieldChange(aIdx, 'experience', '');
                        }}
                      />
                    </div>

                    {/* 4. Known Yes/No (Auto-fill on 'K' or 'U' only) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                        Known Yes / No:
                      </label>
                      <input
                        type="text"
                        className="wizard-input-box"
                        style={{
                          height: '42px',
                          fontSize: '13.5px',
                          padding: '8px 12px',
                          fontWeight: adv.known ? 700 : 400,
                          color: (adv.known === 'Known' || adv.known === 'Yes') ? '#2563EB' : (adv.known === 'Unknown' || adv.known === 'No') ? '#D97706' : '#1E293B',
                          background: (adv.known === 'Known' || adv.known === 'Yes') ? '#EFF6FF' : (adv.known === 'Unknown' || adv.known === 'No') ? '#FFFBEB' : '#FFFFFF',
                          borderColor: (adv.known === 'Known' || adv.known === 'Yes') ? '#BFDBFE' : (adv.known === 'Unknown' || adv.known === 'No') ? '#FDE68A' : '#CBD5E1'
                        }}
                        placeholder="Type 'K' or 'U'"
                        value={adv.known || ''}
                        onKeyDown={(e) => {
                          if (['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
                          if (e.key === 'Backspace' || e.key === 'Delete') {
                            e.preventDefault();
                            handleAdvocateFieldChange(aIdx, 'known', '');
                            return;
                          }
                          const key = e.key.toLowerCase();
                          if (key === 'k') {
                            e.preventDefault();
                            handleAdvocateFieldChange(aIdx, 'known', 'Known');
                          } else if (key === 'u') {
                            e.preventDefault();
                            handleAdvocateFieldChange(aIdx, 'known', 'Unknown');
                          } else {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase();
                          if (val.includes('k')) handleAdvocateFieldChange(aIdx, 'known', 'Known');
                          else if (val.includes('u')) handleAdvocateFieldChange(aIdx, 'known', 'Unknown');
                          else if (val === '') handleAdvocateFieldChange(aIdx, 'known', '');
                        }}
                      />
                    </div>

                    {/* 5. Court Type Dropdown (Single Select) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                        Court Type (Single Select):
                      </label>
                      <select
                        className="wizard-input-box"
                        value={adv.court_type || (localCourtTypes[0]?.name || 'District Court')}
                        onChange={(e) => handleAdvocateFieldChange(aIdx, 'court_type', e.target.value)}
                        style={{ height: '42px', fontSize: '13px', cursor: 'pointer', padding: '6px 10px', background: '#FFFFFF' }}
                      >
                        {localCourtTypes.map((c) => (
                          <option key={c.id || c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {/* + Only Icon Button to Add Another Advocate */}
              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '46px',
                  background: '#FFF7ED',
                  border: '2px dashed #FDBA74',
                  borderRadius: '12px',
                  color: '#EA580C',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginTop: '8px'
                }}
                onClick={handleAddAdvocateCard}
                title="Add Another Advocate"
                aria-label="Add Another Advocate"
              >
                <Plus size={26} strokeWidth={3} />
              </button>
            </div>
          ) : isQ11 ? (
            /* QUESTION 11: ADVOCATE PAYMENT ADVANCE (YES -> AMOUNT, NO -> NEXT) */
            <div>
              <input
                ref={inputRef}
                type="text"
                className="wizard-input-box"
                placeholder="Type 'Y' for Yes or 'N' for No..."
                value={q11DisplayVal}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'y' || e.key === 'Y') {
                    e.preventDefault();
                    handleSelectQ11Yes();
                  } else if (e.key === 'n' || e.key === 'N') {
                    e.preventDefault();
                    handleSelectQ11No();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  const lower = val.toLowerCase().trim();
                  if (lower === 'y' || lower.startsWith('ye')) {
                    handleSelectQ11Yes();
                  } else if (lower === 'n' || lower.startsWith('no')) {
                    handleSelectQ11No();
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
                  <span>Yes (Y)</span>
                </button>
                <button
                  type="button"
                  className={`btn-no-choice ${q11DisplayVal.toLowerCase() === 'no' ? 'selected' : ''}`}
                  onClick={handleSelectQ11No}
                >
                  <X size={18} />
                  <span>No (N)</span>
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
                placeholder="Type 'Y' for Yes or 'N' for No..."
                value={q16DisplayVal}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'y' || e.key === 'Y') {
                    e.preventDefault();
                    handleSelectQ16Yes();
                  } else if (e.key === 'n' || e.key === 'N') {
                    e.preventDefault();
                    handleSelectQ16No();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  const lower = val.toLowerCase().trim();
                  if (lower === 'y' || lower.startsWith('ye')) {
                    handleSelectQ16Yes();
                  } else if (lower === 'n' || lower.startsWith('no')) {
                    handleSelectQ16No();
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
                  <span>Yes (Y)</span>
                </button>
                <button
                  type="button"
                  className={`btn-no-choice ${q16DisplayVal.toLowerCase() === 'no' ? 'selected' : ''}`}
                  onClick={handleSelectQ16No}
                >
                  <X size={18} />
                  <span>No (N)</span>
                </button>
              </div>

              {/* Amount input for Q16 (when Yes) */}
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
                </div>
              )}
            </div>
          ) : isQ23 ? (
            /* QUESTION 23: PRIORITY - TYPE OR CLICK 2 OPTIONS (JAIL SE BAHAR / PAISE BACHANA) */
            <div>
              <input
                ref={inputRef}
                type="text"
                className="wizard-input-box"
                placeholder="Type 'J' (Jail se bahar...) or 'P' (Paise bachana)..."
                value={currentVal}
                onChange={(e) => {
                  const val = e.target.value;
                  const lower = val.trim().toLowerCase();
                  if (lower.startsWith('j') || lower === '1') {
                    handleInputChange('Jail se bahar jaldi jana');
                  } else if (lower.startsWith('p') || lower === '2') {
                    handleInputChange('Paise bachana');
                  } else {
                    handleInputChange(val);
                  }
                }}
                autoFocus
              />
              <div className="yes-no-options-grid" style={{ gap: '14px', marginTop: '14px' }}>
                <button
                  type="button"
                  className={`btn-pill-choice ${currentVal === 'Jail se bahar jaldi jana' ? 'selected' : ''}`}
                  onClick={() => {
                    setError('');
                    handleInputChange('Jail se bahar jaldi jana');
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  style={{ padding: '14px', fontSize: '14.5px', fontWeight: 800, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <CheckCircle2 size={18} style={{ display: currentVal === 'Jail se bahar jaldi jana' ? 'inline' : 'none' }} />
                  <span>Jail se bahar jaldi jana (J)</span>
                </button>
                <button
                  type="button"
                  className={`btn-pill-choice ${currentVal === 'Paise bachana' ? 'selected' : ''}`}
                  onClick={() => {
                    setError('');
                    handleInputChange('Paise bachana');
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  style={{ padding: '14px', fontSize: '14.5px', fontWeight: 800, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <CheckCircle2 size={18} style={{ display: currentVal === 'Paise bachana' ? 'inline' : 'none' }} />
                  <span>Paise bachana (P)</span>
                </button>
              </div>
            </div>
          ) : currentQ.type === 'textarea' ? (
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
          ) : (currentQ.type === 'court_type' || isCourtTypeQ) ? (
            /* MANAGE COURT TYPES: SINGLE CHOICE DROPDOWN / PILLS WITH FIRST-LETTER AUTO-FILL */
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  className="wizard-input-box"
                  placeholder="Type first letter (e.g. 'D' for District Court, 'H' for High Court) or click below..."
                  value={currentVal}
                  onKeyDown={(e) => {
                    if (['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Delete'].includes(e.key)) return;
                    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                      const matched = matchOptionByChar(localCourtTypes, e.key);
                      if (matched) {
                        e.preventDefault();
                        handleInputChange(matched);
                      }
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    const matched = matchOptionByChar(localCourtTypes, val);
                    if (matched && val.length === 1) {
                      handleInputChange(matched);
                    } else {
                      handleInputChange(val);
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsCourtTypesModalOpen(true)}
                  style={{
                    background: '#F1F5F9',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '12px',
                    padding: '0 14px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Manage Court Types"
                >
                  <Settings size={15} />
                  <span>Manage</span>
                </button>
              </div>

              <div className="yes-no-options-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                {localCourtTypes.map((c) => {
                  const name = c.name || c;
                  const isSel = String(currentVal).toLowerCase() === String(name).toLowerCase();
                  return (
                    <button
                      key={c.id || name}
                      type="button"
                      className={`btn-pill-choice ${isSel ? 'selected' : ''}`}
                      onClick={() => handleInputChange(name)}
                      style={{ padding: '12px 14px', borderRadius: '10px', fontSize: '13.5px', fontWeight: isSel ? 800 : 600 }}
                    >
                      <span>{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (currentQ.type === 'custom_multiselect' || (currentQ.type === 'multi-select' && !isQ3 && Array.isArray(currentQ.options) && currentQ.options.length > 0)) ? (
            /* CUSTOM OPTIONS / DROPDOWN MULTI-SELECT */
            <div>
              <div style={{ marginBottom: '10px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  className="wizard-input-box"
                  placeholder="Type first letter to toggle option, or click options below..."
                  onKeyDown={(e) => {
                    if (['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Delete'].includes(e.key)) return;
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

              {/* Selected Badges */}
              {selectedTypes.length > 0 && (
                <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedTypes.map((opt) => (
                    <span
                      key={opt}
                      className="tag-case-type"
                      style={{ background: '#1E293B', color: '#FFFFFF', padding: '5px 12px', fontSize: '12.5px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span>{opt}</span>
                      <button
                        type="button"
                        onClick={() => handleMultiSelectToggle(opt)}
                        style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
                        title="Remove"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="multi-select-container" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {(currentQ.options || []).map((opt) => {
                  const arr = Array.isArray(formData[currentQ.key])
                    ? formData[currentQ.key]
                    : (formData[currentQ.key] || '').split(', ').filter(Boolean);
                  const isSel = arr.includes(opt);
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
          ) : (currentQ.type === 'custom_choice' || isCustomChoiceQ || (Array.isArray(currentQ.options) && currentQ.options.length > 0 && currentQ.type !== 'yesno' && currentQ.type !== 'custom_multiselect')) ? (
            /* CUSTOM OPTIONS / SINGLE CHOICE (OPTIONS ADD) WITH FIRST-LETTER AUTO-FILL */
            <div>
              <input
                ref={inputRef}
                type="text"
                className="wizard-input-box"
                placeholder={currentQ.placeholder || "Type first letter to auto-fill or click option..."}
                value={currentVal}
                onKeyDown={(e) => {
                  if (['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Delete'].includes(e.key)) return;
                  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    const matched = matchOptionByChar(currentQ.options, e.key);
                    if (matched) {
                      e.preventDefault();
                      handleInputChange(matched);
                    }
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  const matched = matchOptionByChar(currentQ.options, val);
                  if (matched && val.length === 1) {
                    handleInputChange(matched);
                  } else {
                    handleInputChange(val);
                  }
                }}
                autoFocus
              />
              <div className="yes-no-options-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginTop: '12px' }}>
                {(currentQ.options || []).map((opt) => {
                  const isSel = String(currentVal).toLowerCase() === String(opt).toLowerCase();
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`btn-pill-choice ${isSel ? 'selected' : ''}`}
                      onClick={() => handleInputChange(opt)}
                      style={{ padding: '12px 14px', borderRadius: '10px', fontSize: '13.5px', fontWeight: isSel ? 800 : 600 }}
                    >
                      <span>{opt}</span>
                    </button>
                  );
                })}
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
                autoFocus
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
                    <span>Yes (Y)</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-no-choice ${currentVal.toLowerCase().startsWith('no') ? 'selected' : ''}`}
                    onClick={() => handleInputChange('No')}
                  >
                    <X size={18} />
                    <span>No (N)</span>
                  </button>
                </div>
              )}
            </div>
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

          {/* User Requested Note */}
          {(() => {
            const clean = (currentQ?.note || '').replace(/\s*\[REMARK\]/g, '').trim();
            return clean ? (
              <div className="wizard-note-banner">
                <span>{clean}</span>
              </div>
            ) : null;
          })()}

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

      <CourtTypesModal
        isOpen={isCourtTypesModalOpen}
        onClose={() => setIsCourtTypesModalOpen(false)}
        courtTypes={localCourtTypes}
        onAddCourtType={handleLocalAddCourtType}
        onEditCourtType={handleLocalEditCourtType}
        onDeleteCourtType={handleLocalDeleteCourtType}
      />
    </div>,
    document.body
  );
}
