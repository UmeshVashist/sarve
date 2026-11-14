import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertCircle, Tag, Check } from 'lucide-react';
import { SURVEY_QUESTIONS } from '../data/questions';
import { API_BASE_URL } from '../config';

export default function EditSurveyModal({ isOpen, onClose, survey, caseTypes = [], onSurveyUpdated }) {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (survey) {
      setFormData({
        ...survey,
        case_type: survey.case_type ? survey.case_type.split(', ').filter(Boolean) : []
      });
      setError('');
    }
  }, [survey]);

  if (!isOpen || !survey) return null;

  const handleChange = (key, val) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
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
      const payload = {
        ...formData,
        case_type: Array.isArray(formData.case_type) ? formData.case_type.join(', ') : (formData.case_type || '')
      };

      const res = await fetch(`${API_BASE_URL}/api/survey/${survey.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        onSurveyUpdated(data.data);
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
            {SURVEY_QUESTIONS.map((q, idx) => {
              const val = formData[q.key] ?? '';
              return (
                <div key={q.id} className="form-group" style={{ background: '#F8FAFC', padding: '14px 18px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '13.5px', color: '#1E293B' }}>
                    {q.label}
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
                  ) : (q.key === 'advocate_payment_advance' || q.key === 'complete_fees_total_initially') ? (
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
                    </div>
                  )}

                  {q.note && (
                    <div style={{ fontSize: '11.5px', color: '#B45309', marginTop: '4px', fontWeight: 600 }}>
                      {q.note}
                    </div>
                  )}
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

