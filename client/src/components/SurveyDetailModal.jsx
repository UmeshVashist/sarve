import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, User, FileText, Calendar, Printer } from 'lucide-react';
import { SURVEY_QUESTIONS, getQuestionLabel } from '../data/questions';
import { resolveAnswerForRecord, resolveQuestionRemark } from '../utils/resolveSurveyAnswer';

export default function SurveyDetailModal({ isOpen, onClose, survey, questions = SURVEY_QUESTIONS }) {
  if (!isOpen || !survey) return null;

  const activeQuestions = useMemo(() => {
    let list = Array.isArray(questions) && questions.length > 0 ? questions : null;
    if (!list) {
      try {
        const saved = localStorage.getItem('survey_questions_list');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
          }
        }
      } catch (e) {}
    }
    if (!list || list.length === 0) {
      list = SURVEY_QUESTIONS;
    }
    return [...list].sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0));
  }, [questions, isOpen]);

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="review-summary-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="review-summary-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#3B82F6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={22} />
            </div>
            <div>
              <div className="review-summary-title">Prisoner Survey Record Details</div>
              <div className="review-summary-subtitle">
                UT/CT No: <strong style={{ color: '#fff' }}>{survey.utct_no}</strong> | Name: <strong style={{ color: '#fff' }}>{survey.name}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="wizard-close-btn" style={{ color: '#fff' }} onClick={handlePrint} title="Print Record">
              <Printer size={18} />
            </button>
            <button className="wizard-close-btn" style={{ color: '#fff' }} onClick={onClose} title="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="review-summary-list">
          {activeQuestions.map((q, idx) => {
            const val = resolveAnswerForRecord(survey, q, activeQuestions);
            return (
              <div key={q.id || idx} className="review-item-card">
                <div>
                  <div className="review-item-qnum">Question #{q.order_num ?? idx + 1}</div>
                  <div className="review-item-question">{getQuestionLabel(q, idx)}</div>
                  <div>
                    {q.key === 'advocate_name_number' && Array.isArray(survey.advocates_details) && survey.advocates_details.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                        {survey.advocates_details.map((adv, aIdx) => (
                          <div key={aIdx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
                            <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                              #{aIdx + 1} Advocate: {adv.name || 'N/A'}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', color: '#475569', fontSize: '12.5px' }}>
                              <span>Fee: <strong>₹{adv.fee || 0}</strong></span>
                              <span>Experience: <strong>{adv.experience || 'N/A'}</strong></span>
                              <span>Known: <strong>{adv.known || 'N/A'}</strong></span>
                              <span>Court: <strong>{adv.court_type || 'N/A'}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : val !== undefined && val !== null && String(val).trim() !== '' ? (
                      <div>
                        <span className="review-item-answer" style={{ whiteSpace: 'pre-line' }}>{String(val)}</span>
                        {(() => {
                          const remark = resolveQuestionRemark(survey, q);
                          if (remark) {
                            return (
                              <div style={{ marginTop: '4px', fontSize: '12px', color: '#047857', fontWeight: 600 }}>
                                Remark: {remark}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ) : (
                      <div>
                        <span className="review-item-answer empty">Not specified</span>
                        {(() => {
                          const remark = resolveQuestionRemark(survey, q);
                          if (remark) {
                            return (
                              <div style={{ marginTop: '4px', fontSize: '12px', color: '#047857', fontWeight: 600 }}>
                                Remark: {remark}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
            <Calendar size={14} />
            <span>Recorded on: {new Date(survey.created_at || Date.now()).toLocaleString()}</span>
          </div>
        </div>

        <div className="review-summary-footer">
          <button type="button" className="btn-wizard-prev" onClick={onClose}>
            <span>Close Details</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

