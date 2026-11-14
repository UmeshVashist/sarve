import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, User, FileText, Calendar, Printer } from 'lucide-react';
import { SURVEY_QUESTIONS, getQuestionLabel } from '../data/questions';

export default function SurveyDetailModal({ isOpen, onClose, survey, questions = SURVEY_QUESTIONS }) {
  if (!isOpen || !survey) return null;

  const activeQuestions = useMemo(() => {
    const list = Array.isArray(questions) && questions.length > 0 ? questions : SURVEY_QUESTIONS;
    return [...list].sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0));
  }, [questions]);

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
            const val = survey[q.key];
            return (
              <div key={q.id || idx} className="review-item-card">
                <div>
                  <div className="review-item-qnum">Question #{q.order_num ?? idx + 1}</div>
                  <div className="review-item-question">{getQuestionLabel(q, idx)}</div>
                  <div>
                    {val !== undefined && val !== null && String(val).trim() !== '' ? (
                      <span className="review-item-answer">{String(val)}</span>
                    ) : (
                      <span className="review-item-answer empty">Not specified</span>
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

