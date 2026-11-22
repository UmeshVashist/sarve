import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Edit3, Briefcase } from 'lucide-react';

export default function WorkRolesModal({
  isOpen,
  onClose,
  roles = [],
  onAddRole,
  onEditRole,
  onDeleteRole
}) {
  const [newRoleName, setNewRoleName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setNewRoleName('');
      setEditingId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      setError('Role name cannot be empty');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await onAddRole(newRoleName.trim());
      if (res && res.success === false) {
        setError(res.message || 'Failed to add role');
      } else {
        setNewRoleName('');
      }
    } catch (err) {
      setError(err.message || 'Error adding role');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingName(item.name || '');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEdit = async (item) => {
    if (!editingName.trim()) {
      setError('Role name cannot be empty');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await onEditRole(item.id, editingName.trim());
      if (res && res.success === false) {
        setError(res.message || 'Failed to update role');
      } else {
        cancelEdit();
      }
    } catch (err) {
      setError(err.message || 'Error updating role');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={20} color="#B45309" />
            <span>Manage Work Roles</span>
          </div>
          <button className="wizard-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '14px', lineHeight: 1.5 }}>
            Work roles listed below appear in the <strong>Role Name</strong> dropdown when assigning tasks. You can Add, Edit / Rename, or Delete roles.
          </p>

          {error && (
            <div className="wizard-error-banner" style={{ marginBottom: '14px' }}>
              <span>{error}</span>
            </div>
          )}

          {/* Add Role Input */}
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Field Officer, Survey Verifier, Legal Coordinator..."
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="btn-case-types"
              style={{ whiteSpace: 'nowrap', padding: '10px 18px', background: '#B45309', borderColor: '#B45309', color: '#fff' }}
              disabled={submitting || !newRoleName.trim()}
            >
              <Plus size={16} />
              <span>{submitting ? 'Adding...' : 'Add Role'}</span>
            </button>
          </form>

          {/* Roles List */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
              Available Roles ({roles.length}):
            </span>
            <span style={{ fontSize: '11.5px', color: '#64748B' }}>Used for task allocation</span>
          </div>

          <div className="case-types-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {roles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '13px' }}>
                No work roles added yet. Add your first role above.
              </div>
            ) : (
              roles.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <div key={item.id} className="case-type-item" style={{ padding: '10px 14px' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-control"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '13px', flex: 1 }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="btn-primary-admin"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => saveEdit(item)}
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
                        <span style={{ fontWeight: 600, fontSize: '13.5px', color: '#1E293B' }}>
                          {item.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-action-icon"
                            style={{ background: '#F1F5F9', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#2563EB' }}
                            onClick={() => startEdit(item)}
                            title="Edit / Rename Role"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-delete-case-type"
                            onClick={() => onDeleteRole(item.id, item.name)}
                            title="Remove Role"
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
