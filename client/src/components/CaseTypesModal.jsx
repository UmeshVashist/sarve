import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Tag, Check } from 'lucide-react';

export default function CaseTypesModal({ isOpen, onClose, caseTypes, onAddCaseType, onDeleteCaseType }) {
  const [newTypeName, setNewTypeName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    setError('');
    setSubmitting(true);
    try {
      const res = await onAddCaseType(newTypeName.trim());
      if (res && res.success) {
        setNewTypeName('');
      } else if (res && res.message) {
        setError(res.message);
      }
    } catch (err) {
      setError(err.message || 'Failed to add case type');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={20} color="#2563EB" />
            <span>Manage Case Types (Question 3 Dropdown)</span>
          </div>
          <button className="wizard-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '13.5px', color: '#475569', marginBottom: '16px', lineHeight: 1.5 }}>
            Case types listed below will appear as selectable options in <strong>Question 3</strong> of the Prisoner Survey form. You can add new legal case types or remove existing ones.
          </p>

          {error && (
            <div className="wizard-error-banner" style={{ marginBottom: '14px' }}>
              <span>{error}</span>
            </div>
          )}

          {/* Add New Case Type Input */}
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '14px' }}
              placeholder="e.g. Cyber Fraud, Bail IPC 439, NDPS..."
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="btn-case-types"
              style={{ whiteSpace: 'nowrap', padding: '10px 18px' }}
              disabled={submitting || !newTypeName.trim()}
            >
              <Plus size={16} />
              <span>{submitting ? 'Adding...' : 'Add Type'}</span>
            </button>
          </form>

          {/* List of Case Types */}
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
            Available Case Types ({caseTypes.length}):
          </div>

          <div className="case-types-list">
            {caseTypes.map((t) => (
              <div key={t.id || t.name} className="case-type-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={15} color="#16A34A" />
                  <span className="case-type-name">{t.name}</span>
                </div>
                <button
                  type="button"
                  className="btn-delete-case-type"
                  onClick={() => onDeleteCaseType(t.id, t.name)}
                  title="Remove case type"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

