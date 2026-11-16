import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Edit3, Check, Scale } from 'lucide-react';

export default function CourtTypesModal({
  isOpen,
  onClose,
  courtTypes = [],
  onAddCourtType,
  onEditCourtType,
  onDeleteCourtType
}) {
  const [newTypeName, setNewTypeName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    setError('');
    setSubmitting(true);
    try {
      const res = await onAddCourtType(newTypeName.trim());
      if (res && res.success) {
        setNewTypeName('');
      } else if (res && res.message) {
        setError(res.message);
      }
    } catch (err) {
      setError(err.message || 'Failed to add court type');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (t) => {
    setEditingId(t.id || t.name);
    setEditingName(t.name);
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEdit = async (t) => {
    if (!editingName.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      if (onEditCourtType) {
        const res = await onEditCourtType(t.id || t.name, editingName.trim());
        if (res && !res.success && res.message) {
          setError(res.message);
          return;
        }
      }
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      setError(err.message || 'Failed to update court type');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scale size={20} color="#EA580C" />
            <span>Manage Court Types (Dropdown Options)</span>
          </div>
          <button className="wizard-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '13.5px', color: '#475569', marginBottom: '16px', lineHeight: 1.5 }}>
            Court types listed below appear in the <strong>Court Type</strong> dropdown for each Advocate in Question 8 and the Advocate Survey. You can <strong>Add</strong>, <strong>Edit / Rename</strong>, or <strong>Delete</strong> court types.
          </p>

          {error && (
            <div className="wizard-error-banner" style={{ marginBottom: '14px' }}>
              <span>{error}</span>
            </div>
          )}

          {/* Add New Court Type Input */}
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '14px' }}
              placeholder="e.g. High Court, Sessions Court, District Court..."
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="btn-case-types"
              style={{ whiteSpace: 'nowrap', padding: '10px 18px', background: '#EA580C', borderColor: '#EA580C' }}
              disabled={submitting || !newTypeName.trim()}
            >
              <Plus size={16} />
              <span>{submitting ? 'Adding...' : 'Add Court'}</span>
            </button>
          </form>

          {/* List of Court Types */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
              Available Court Types ({courtTypes.length}):
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748B' }}>Single selection in survey</div>
          </div>

          <div className="case-types-list" style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {courtTypes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '13.5px' }}>
                No court types found. Add your first court type above.
              </div>
            ) : (
              courtTypes.map((t) => {
                const itemKey = t.id || t.name;
                const isEditing = editingId === itemKey;

                return (
                  <div key={itemKey} className="case-type-item" style={{ padding: '8px 12px' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-control"
                          style={{ padding: '6px 10px', fontSize: '13.5px' }}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveEdit(t);
                            } else if (e.key === 'Escape') {
                              cancelEdit();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => saveEdit(t)}
                          disabled={submitting || !editingName.trim()}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn-wizard-prev"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Check size={15} color="#EA580C" />
                          <span className="case-type-name" style={{ fontWeight: 600 }}>{t.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-action-icon"
                            style={{ background: '#F1F5F9', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#2563EB' }}
                            onClick={() => startEdit(t)}
                            title="Edit / Rename court type"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-delete-case-type"
                            onClick={() => onDeleteCourtType(t.id, t.name)}
                            title="Remove court type"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-modal-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
