import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertCircle, Tag, Check, Plus, Trash2, Scale } from 'lucide-react';
import { SURVEY_QUESTIONS, getQuestionLabel, STANDARD_KEYS } from '../data/questions';
import { API_BASE_URL } from '../config';
import { resolveAnswerForRecord } from '../utils/resolveSurveyAnswer';

export default function EditSurveyModal({ isOpen, onClose, survey, caseTypes = [], courtTypes = [], questions = SURVEY_QUESTIONS, onSurveyUpdated }) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [localCourtTypes, setLocalCourtTypes] = useState(courtTypes);

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

  const activeQuestions = useMemo(() => {
    const list = (Array.isArray(questions) && questions.length > 0) ? questions : SURVEY_QUESTIONS;
    return [...list]
      .filter((q) => q && q.key !== '__remarks_map__' && q.type !== 'remarks_store')
      .sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0));
  }, [questions]);

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

      const merged = { ...customAnswers, ...survey };
      // Ensure custom answers aren't overwritten by undefined in survey
      Object.entries(customAnswers).forEach(([k, v]) => {
        if (v !== undefined && v !== null && (merged[k] === undefined || merged[k] === null || merged[k] === '')) {
          merged[k] = v;
        }
      });

      // Ensure every custom question gets resolved if not directly keyed
      activeQuestions.forEach((q) => {
        if (merged[q.key] === undefined || merged[q.key] === null || String(merged[q.key]).trim() === '') {
          const resolved = resolveAnswerForRecord(survey, q, activeQuestions);
          if (resolved) {
            merged[q.key] = resolved;
          }
        }
      });

      merged.case_type = survey.case_type
        ? (Array.isArray(survey.case_type)
            ? survey.case_type
            : (typeof survey.case_type === 'string'
                ? survey.case_type.split(', ').filter(Boolean)
                : [String(survey.case_type)]))
        : [];

      let advocatesDetails = [];
      if (survey.advocates_details) {
        try {
          advocatesDetails = typeof survey.advocates_details === 'string' ? JSON.parse(survey.advocates_details) : survey.advocates_details;
        } catch (e) {}
      }
      if (!Array.isArray(advocatesDetails) || advocatesDetails.length === 0) {
        if (survey.advocate_name_number) {
          advocatesDetails = [{ name: survey.advocate_name_number, fee: '', experience: 'Good', known: 'Known', court_type: 'District Court' }];
        } else {
          advocatesDetails = [{ name: '', fee: '', experience: 'Good', known: 'Known', court_type: 'District Court' }];
        }
      }
      merged.advocates_details = advocatesDetails;

      setFormData(merged);
      setError('');
    }
  }, [survey]);

  if (!isOpen || !survey) return null;

  const handleChange = (key, val) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleAdvocateEdit = (index, field, value) => {
    const list = Array.isArray(formData.advocates_details) ? [...formData.advocates_details] : [];
    if (!list[index]) list[index] = { name: '', fee: '', experience: '', known: '', court_type: 'District Court' };
    list[index] = { ...list[index], [field]: value };
    const summary = list
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
      advocates_details: list,
      advocate_name_number: summary || list[0]?.name || ''
    }));
  };

  const handleAddAdvocateToEdit = () => {
    const list = Array.isArray(formData.advocates_details) ? [...formData.advocates_details] : [];
    const defaultCourt = localCourtTypes[0]?.name || 'District Court';
    list.push({ name: '', fee: '', experience: '', known: '', court_type: defaultCourt });
    setFormData((prev) => ({
      ...prev,
      advocates_details: list
    }));
  };

  const handleRemoveAdvocateFromEdit = (index) => {
    const list = Array.isArray(formData.advocates_details) ? [...formData.advocates_details] : [];
    if (list.length <= 1) return;
    const updated = list.filter((_, i) => i !== index);
    const summary = updated
      .filter((a) => (a.name || '').trim())
      .map((a) => `${a.name.trim()} (Fee: ₹${a.fee || 0}, ${a.court_type || 'Court'})`)
      .join('; ');

    setFormData((prev) => ({
      ...prev,
      advocates_details: updated,
      advocate_name_number: summary || updated[0]?.name || ''
    }));
  };

  const handleCaseTypeToggle = (name) => {
    const list = Array.isArray(formData.case_type) ? formData.case_type : [];
    if (list.includes(name)) {
      handleChange('case_type', list.filter((i) => i !== name));
    } else {
      handleChange('case_type', [...list, name]);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const customObj = {};
      Object.keys(formData).forEach((k) => {
        if (!STANDARD_KEYS.includes(k) && !['id', 'created_at', 'updated_at', 'custom_answers'].includes(k)) {
          if (formData[k] !== undefined && formData[k] !== null && formData[k] !== '') {
            customObj[k] = formData[k];
          }
        }
      });

      const payload = {
        ...formData,
        case_type: Array.isArray(formData.case_type) ? formData.case_type.join(', ') : (formData.case_type || ''),
        custom_answers: JSON.stringify(customObj)
      };

      const res = await fetch(`${API_BASE_URL}/api/survey/${survey.id}`, {
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
        setError(data.message || 'Failed to update survey');
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
        <div className="review-summary-header">
          <div>
            <div className="review-summary-title">Edit Survey: {survey.utct_no}</div>
            <div className="review-summary-subtitle">Modify survey responses for {survey.name}</div>
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
                    {getQuestionLabel(q, idx)}
                  </label>

                  {q.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      className="form-control"
                      value={val}
                      onChange={(e) => handleChange(q.key, e.target.value)}
                    />
                  ) : q.type === 'multi-select' ? (
                    <div>
                      <div className="multi-select-container">
                        {caseTypes.map((t) => {
                          const isSel = Array.isArray(formData.case_type) && formData.case_type.includes(t.name);
                          return (
                            <button
                              key={t.id || t.name}
                              type="button"
                              className={`selectable-tag ${isSel ? 'selected' : ''}`}
                              onClick={() => handleCaseTypeToggle(t.name)}
                            >
                              {isSel && <Check size={14} />}
                              <span>{t.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : q.key === 'advocate_name_number' ? (
                    <div>
                      {(formData.advocates_details || []).map((adv, aIdx) => (
                        <div
                          key={aIdx}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            marginBottom: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '13px', color: '#1E293B' }}>Advocate #{aIdx + 1}</strong>
                            {(formData.advocates_details || []).length > 1 && (
                              <button
                                type="button"
                                style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => handleRemoveAdvocateFromEdit(aIdx)}
                              >
                                <Trash2 size={13} />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Name & Number:</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: '6px 10px', fontSize: '12.5px' }}
                                value={adv.name || ''}
                                onChange={(e) => handleAdvocateEdit(aIdx, 'name', e.target.value)}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Fee (₹):</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: '6px 10px', fontSize: '12.5px' }}
                                value={adv.fee || ''}
                                onChange={(e) => handleAdvocateEdit(aIdx, 'fee', e.target.value.replace(/[^0-9]/g, ''))}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Good / Bad:</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '12.5px',
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
                                    handleAdvocateEdit(aIdx, 'experience', '');
                                    return;
                                  }
                                  const key = e.key.toLowerCase();
                                  if (key === 'g') {
                                    e.preventDefault();
                                    handleAdvocateEdit(aIdx, 'experience', 'Good');
                                  } else if (key === 'b') {
                                    e.preventDefault();
                                    handleAdvocateEdit(aIdx, 'experience', 'Bad');
                                  } else {
                                    e.preventDefault();
                                  }
                                }}
                                onChange={(e) => {
                                  const val = e.target.value.toLowerCase();
                                  if (val.includes('g')) handleAdvocateEdit(aIdx, 'experience', 'Good');
                                  else if (val.includes('b')) handleAdvocateEdit(aIdx, 'experience', 'Bad');
                                  else if (val === '') handleAdvocateEdit(aIdx, 'experience', '');
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Known Yes / No:</label>
                              <input
                                type="text"
                                className="form-control"
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '12.5px',
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
                                    handleAdvocateEdit(aIdx, 'known', '');
                                    return;
                                  }
                                  const key = e.key.toLowerCase();
                                  if (key === 'k') {
                                    e.preventDefault();
                                    handleAdvocateEdit(aIdx, 'known', 'Known');
                                  } else if (key === 'u') {
                                    e.preventDefault();
                                    handleAdvocateEdit(aIdx, 'known', 'Unknown');
                                  } else {
                                    e.preventDefault();
                                  }
                                }}
                                onChange={(e) => {
                                  const val = e.target.value.toLowerCase();
                                  if (val.includes('k')) handleAdvocateEdit(aIdx, 'known', 'Known');
                                  else if (val.includes('u')) handleAdvocateEdit(aIdx, 'known', 'Unknown');
                                  else if (val === '') handleAdvocateEdit(aIdx, 'known', '');
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Court Type:</label>
                              <select
                                className="form-control"
                                style={{ padding: '6px 8px', fontSize: '12px' }}
                                value={adv.court_type || (localCourtTypes[0]?.name || 'District Court')}
                                onChange={(e) => handleAdvocateEdit(aIdx, 'court_type', e.target.value)}
                              >
                                {localCourtTypes.map((c) => (
                                  <option key={c.id || c.name} value={c.name}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '42px', background: '#FFF7ED', border: '1.5px dashed #FDBA74', borderRadius: '8px', color: '#EA580C', cursor: 'pointer', transition: 'all 0.2s ease' }}
                        onClick={handleAddAdvocateToEdit}
                        title="Add Another Advocate"
                        aria-label="Add Another Advocate"
                      >
                        <Plus size={22} strokeWidth={2.8} />
                      </button>
                    </div>
                  ) : q.key === 'complete_fees_total_initially' ? (
                    <div>
                      {(() => {
                        const strVal = String(val || '').trim();
                        const isYes = strVal.toLowerCase().startsWith('yes');
                        const isNo = strVal.toLowerCase() === 'no';
                        let currentAmount = '';
                        let currentRemark = '';
                        if (strVal.includes('Remark:')) {
                          const rParts = strVal.split(/Remark:\s*/i);
                          currentRemark = rParts[1]?.trim() || '';
                          const mainPart = rParts[0].replace(/\|\s*$/, '').trim();
                          const slashParts = mainPart.split('/');
                          if (slashParts.length > 1) {
                            currentAmount = slashParts.slice(1).join('/').trim();
                          }
                        } else {
                          const slashParts = strVal.split('/');
                          if (slashParts.length > 1) {
                            currentAmount = slashParts.slice(1).join('/').trim();
                          }
                        }

                        const updateQ16 = (choice, amt, rem) => {
                          let res = choice;
                          const cleanAmt = amt ? String(amt).trim() : '';
                          const cleanRem = rem ? String(rem).trim() : '';
                          if (choice === 'Yes') {
                            if (cleanAmt) res += ` / ${cleanAmt}`;
                            if (cleanRem) res += ` | Remark: ${cleanRem}`;
                          } else if (choice === 'No') {
                            if (cleanRem) res += ` | Remark: ${cleanRem}`;
                          } else if (cleanRem) {
                            res = cleanRem;
                          }
                          handleChange(q.key, res);
                        };

                        return (
                          <div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                              <button
                                type="button"
                                className={`btn-action-icon ${isYes ? 'view' : ''}`}
                                style={{ width: 'auto', padding: '6px 16px', fontSize: '13px', fontWeight: 700 }}
                                onClick={() => updateQ16('Yes', currentAmount, currentRemark)}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                className={`btn-action-icon ${isNo ? 'delete' : ''}`}
                                style={{ width: 'auto', padding: '6px 16px', fontSize: '13px', fontWeight: 700 }}
                                onClick={() => updateQ16('No', '', currentRemark)}
                              >
                                No
                              </button>
                            </div>

                            {isYes && (
                              <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #CBD5E1', marginTop: '8px' }}>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                                  Complete Total Fees Amount (₹):
                                </label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                  <span style={{ position: 'absolute', left: '10px', fontWeight: 700, color: '#64748B' }}>₹</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="form-control"
                                    style={{ paddingLeft: '26px' }}
                                    placeholder="Enter amount (e.g. 50000 or 100000)"
                                    value={currentAmount}
                                    onChange={(e) => {
                                      const clean = e.target.value.replace(/[^0-9]/g, '');
                                      updateQ16('Yes', clean, currentRemark);
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {(isYes || isNo) && (
                              <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #CBD5E1', marginTop: '8px' }}>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                                  Fees Remark (Optional):
                                </label>
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Enter any fee remark or note (optional)..."
                                  value={currentRemark}
                                  onChange={(e) => {
                                    updateQ16(isYes ? 'Yes' : 'No', currentAmount, e.target.value);
                                  }}
                                />
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                                  Saved in Excel as: <strong>{val || 'Not specified'}</strong>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : q.key === 'advocate_payment_advance' ? (
                    <div>
                      {(() => {
                        const strVal = String(val || '').trim();
                        const isYes = strVal.toLowerCase().startsWith('yes');
                        const isNo = strVal.toLowerCase() === 'no';
                        const parts = strVal.split('/');
                        const currentAmount = parts.length > 1 ? parts.slice(1).join('/').trim() : '';
                        const fieldLabel = q.key === 'advocate_payment_advance' ? 'Advance Amount' : 'Complete Total Fees Amount';

                        return (
                          <div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                              <button
                                type="button"
                                className={`btn-action-icon ${isYes ? 'view' : ''}`}
                                style={{ width: 'auto', padding: '6px 16px', fontSize: '13px', fontWeight: 700 }}
                                onClick={() => handleChange(q.key, currentAmount ? `Yes / ${currentAmount}` : 'Yes')}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                className={`btn-action-icon ${isNo ? 'delete' : ''}`}
                                style={{ width: 'auto', padding: '6px 16px', fontSize: '13px', fontWeight: 700 }}
                                onClick={() => handleChange(q.key, 'No')}
                              >
                                No
                              </button>
                            </div>

                            {isYes && (
                              <div style={{ background: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #CBD5E1', marginTop: '8px' }}>
                                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                                  {fieldLabel} (₹):
                                </label>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                  <span style={{ position: 'absolute', left: '10px', fontWeight: 700, color: '#64748B' }}>₹</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="form-control"
                                    style={{ paddingLeft: '26px' }}
                                    placeholder="Enter amount (e.g. 10000 or 50000)"
                                    value={currentAmount}
                                    onChange={(e) => {
                                      const clean = e.target.value.replace(/[^0-9]/g, '');
                                      handleChange(q.key, clean ? `Yes / ${clean}` : 'Yes');
                                    }}
                                  />
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                                  Saved in Excel as: <strong>{currentAmount ? `Yes / ${currentAmount}` : 'Yes'}</strong>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : q.key === 'priority_money_vs_release' ? (
                    <div>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Type 'J' (Jail se bahar jaldi jana) or 'P' (Paise bachana)..."
                        value={val}
                        onChange={(e) => {
                          const lower = e.target.value.trim().toLowerCase();
                          if (lower.startsWith('j') || lower === '1') {
                            handleChange(q.key, 'Jail se bahar jaldi jana');
                          } else if (lower.startsWith('p') || lower === '2') {
                            handleChange(q.key, 'Paise bachana');
                          } else {
                            handleChange(q.key, e.target.value);
                          }
                        }}
                        style={{ marginBottom: '8px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {['Jail se bahar jaldi jana', 'Paise bachana'].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className={`btn-action-icon ${val === opt ? 'view' : ''}`}
                            style={{ width: 'auto', padding: '8px 16px', fontSize: '13px', fontWeight: 700 }}
                            onClick={() => handleChange(q.key, opt)}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : q.key === 'prisoner_psychologic_survey' ? (
                    <div>
                      {(() => {
                        const strVal = String(val || '').trim();
                        const isYes = strVal.toLowerCase().startsWith('yes');
                        const isNo = strVal.toLowerCase().startsWith('no');
                        const remarks = isYes
                          ? strVal.replace(/^yes\s*[-:/]?\s*/i, '').trim()
                          : isNo
                          ? strVal.replace(/^no\s*[-:/]?\s*/i, '').trim()
                          : strVal;

                        return (
                          <div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                              <button
                                type="button"
                                className={`btn-action-icon ${isYes ? 'view' : ''}`}
                                style={{ width: 'auto', padding: '6px 16px', fontSize: '13px', fontWeight: 700 }}
                                onClick={() => handleChange(q.key, remarks ? `Yes - ${remarks}` : 'Yes')}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                className={`btn-action-icon ${isNo ? 'delete' : ''}`}
                                style={{ width: 'auto', padding: '6px 16px', fontSize: '13px', fontWeight: 700 }}
                                onClick={() => handleChange(q.key, remarks ? `No - ${remarks}` : 'No')}
                              >
                                No
                              </button>
                            </div>
                            <textarea
                              rows={2}
                              className="form-control"
                              placeholder="Remarks / Psychological notes..."
                              value={remarks}
                              onChange={(e) => {
                                const newR = e.target.value;
                                const prefix = isYes ? 'Yes - ' : isNo ? 'No - ' : '';
                                handleChange(q.key, prefix ? `${prefix}${newR}` : newR);
                              }}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div>
                      <input
                        type={q.type === 'number' ? 'number' : 'text'}
                        className="form-control"
                        value={val}
                        onChange={(e) => handleChange(q.key, e.target.value)}
                      />
                      {(q.type === 'yesno' || q.type === 'yesno_text') && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <button
                            type="button"
                            className={`btn-action-icon ${String(val).toLowerCase() === 'yes' ? 'view' : ''}`}
                            style={{ width: 'auto', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}
                            onClick={() => handleChange(q.key, 'Yes')}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            className={`btn-action-icon ${String(val).toLowerCase() === 'no' ? 'delete' : ''}`}
                            style={{ width: 'auto', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}
                            onClick={() => handleChange(q.key, 'No')}
                          >
                            No
                          </button>
                        </div>
                      )}

                      {Array.isArray(q.options) && q.options.length > 0 && q.type !== 'yesno' && q.type !== 'yesno_text' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {q.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              className={`btn-action-icon ${String(val).toLowerCase() === String(opt).toLowerCase() ? 'view' : ''}`}
                              style={{ width: 'auto', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}
                              onClick={() => handleChange(q.key, opt)}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {(Boolean(q.has_remark || (q.note && q.note.includes('[REMARK]')))) && (
                    <div style={{ marginTop: '8px', background: '#F0FDF4', padding: '8px 10px', borderRadius: '6px', border: '1px solid #BBF7D0' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#166534', display: 'block', marginBottom: '3px' }}>
                        Remark (Optional):
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter remark..."
                        value={formData[`${q.key}_remark`] || ''}
                        onChange={(e) => handleChange(`${q.key}_remark`, e.target.value)}
                        style={{ fontSize: '12.5px', padding: '5px 10px', background: '#FFFFFF' }}
                      />
                    </div>
                  )}

                  {(() => {
                    const clean = (q.note || '').replace(/\s*\[REMARK\]/g, '').trim();
                    return clean ? (
                      <div style={{ fontSize: '11.5px', color: '#B45309', marginTop: '4px', fontWeight: 600 }}>
                        {clean}
                      </div>
                    ) : null;
                  })()}
                </div>
              );
            })}
          </div>

          <div className="review-summary-footer">
            <button type="button" className="btn-wizard-prev" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit-final" disabled={saving}>
              <Save size={16} />
              <span>{saving ? 'Updating Record...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

