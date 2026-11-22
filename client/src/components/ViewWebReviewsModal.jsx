import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Globe, ExternalLink, Copy, Check, Edit3, MessageSquare } from 'lucide-react';

export default function ViewWebReviewsModal({
  isOpen,
  onClose,
  reviewData,
  onEditReview
}) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !reviewData) return null;

  const reviewsList = Array.isArray(reviewData.reviews) ? reviewData.reviews : [];

  const handleCopyAll = async () => {
    try {
      const text = reviewsList.map((r, i) => `#${i + 1}: ${r}`).join('\n');
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  };

  const handleCopySingle = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} color="#15803D" />
            <span>Website Reviews: {reviewData.website_name}</span>
          </div>
          <button className="wizard-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Website Info Header Card */}
          <div style={{
            background: '#F0FDF4',
            border: '1.5px solid #BBF7D0',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#14532D' }}>
                {reviewData.website_name}
              </div>
              {reviewData.url && (
                <a
                  href={reviewData.url.startsWith('http') ? reviewData.url : `https://${reviewData.url}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: '#2563EB',
                    fontSize: '12.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '2px',
                    textDecoration: 'none',
                    fontWeight: 600
                  }}
                >
                  <span>{reviewData.url}</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            <div style={{
              background: '#15803D',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: '9999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <MessageSquare size={13} />
              <span>{reviewsList.length} Review {reviewsList.length === 1 ? 'Input' : 'Inputs'}</span>
            </div>
          </div>

          {/* All Reviews List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                Complete Feedback & Review Inputs ({reviewsList.length}):
              </span>
              <button
                type="button"
                onClick={handleCopyAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: copiedAll ? '#15803D' : '#64748B',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {copiedAll ? <Check size={13} color="#15803D" /> : <Copy size={13} />}
                <span>{copiedAll ? 'Copied All!' : 'Copy All'}</span>
              </button>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '380px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {reviewsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '13px' }}>
                  No reviews recorded for this website.
                </div>
              ) : (
                reviewsList.map((rev, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '10px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flex: 1 }}>
                      <span style={{
                        background: '#DCFCE7',
                        color: '#15803D',
                        fontWeight: 800,
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        flexShrink: 0
                      }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: '13px', color: '#1E293B', lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {rev}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopySingle(rev, idx)}
                      style={{
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '6px',
                        padding: '4px 6px',
                        cursor: 'pointer',
                        color: copiedIdx === idx ? '#15803D' : '#94A3B8',
                        flexShrink: 0
                      }}
                      title="Copy this review"
                    >
                      {copiedIdx === idx ? <Check size={13} color="#15803D" /> : <Copy size={13} />}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid #E2E8F0', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
          <div>
            {onEditReview && (
              <button
                type="button"
                className="btn-case-types"
                style={{ padding: '8px 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  onClose();
                  onEditReview(reviewData);
                }}
              >
                <Edit3 size={14} />
                <span>Edit Reviews</span>
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn-wizard-prev"
            onClick={onClose}
            style={{ padding: '8px 20px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
