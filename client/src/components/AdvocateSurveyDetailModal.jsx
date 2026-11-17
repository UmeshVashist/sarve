import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Scale, Calendar, Printer, FileText } from 'lucide-react';
import { ADVOCATE_SURVEY_QUESTIONS, getAdvocateQuestionLabel } from '../data/advocateQuestions';
import { resolveAdvocateAnswer } from '../utils/exportAdvocateExcel';
import { resolveQuestionRemark } from '../utils/resolveSurveyAnswer';

export default function AdvocateSurveyDetailModal({ isOpen, onClose, survey, questions = ADVOCATE_SURVEY_QUESTIONS }) {
  if (!isOpen || !survey) return null;

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

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="review-summary-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="review-summary-header" style={{ background: '#EA580C' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#C2410C', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scale size={22} />
            </div>
            <div>
              <div className="review-summary-title">Advocate Survey Record Details</div>
              <div className="review-summary-subtitle">
                Advocate: <strong style={{ color: '#fff' }}>{survey.name}</strong> {survey.advocate_reg_no ? `| Reg: ${survey.advocate_reg_no}` : ''}
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
            const val = resolveAdvocateAnswer(survey, q, activeQuestions);
            return (
              <div key={q.id || idx} className="review-item-card">
                <div>
                  <div className="review-item-qnum">Question #{q.order_num ?? idx + 1}</div>
                  <div className="review-item-question">{getAdvocateQuestionLabel(q, idx)}</div>
                  <div>
                    {val !== undefined && val !== null && String(val).trim() !== '' ? (
                      <div>
                        <span className="review-item-answer">{String(val)}</span>
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
