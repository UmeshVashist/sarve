import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Briefcase, Plus } from 'lucide-react';

export default function AddWorkRoleEntryModal({
  isOpen,
  onClose,
  roles = [],
  onOpenManageRoles,
  onSaveEntry,
  initialData = null
}) {
  const [roleName, setRoleName] = useState('');
  const [workName, setWorkName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSubmitting(false);
      if (initialData) {
        setRoleName(initialData.role_name || '');
        setWorkName(initialData.work_name || '');
      } else {
        setRoleName(roles[0]?.name || '');
        setWorkName('');
      }
      // Auto-focus 1st option (role dropdown/input) on open
      setTimeout(() => {
        firstFieldRef.current?.focus();
      }, 60);
    }
  }, [isOpen, initialData, roles]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roleName.trim()) {
      setError('Please select a Role Name');
      return;
    }
    if (!workName.trim()) {
      setError('Please enter a Work Name / Task description');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const payload = {
        role_name: roleName.trim(),
        work_name: workName.trim()
      };
      const res = await onSaveEntry(payload, initialData?.id);
      if (res && res.success === false) {
        setError(res.message || 'Failed to save entry');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Error saving work entry');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={20} color="#B45309" />
            <span>{initialData ? 'Edit Work Role Entry' : 'Add Work Role Data'}</span>
          </div>
          <button className="wizard-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div className="wizard-error-banner">
                <span>{error}</span>
              </div>
            )}

            {/* Field 1: Role Name (Single Select) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
                  Role Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                {onOpenManageRoles && (
                  <button
                    type="button"
                    onClick={onOpenManageRoles}
                    style={{ background: 'none', border: 'none', color: '#B45309', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={13} /> Manage / Add Roles
                  </button>
                )}
              </div>

              {roles.length === 0 ? (
                <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#64748B' }}>
                  No work roles configured yet. Click "+ Manage / Add Roles" above to add one.
                </div>
              ) : (
                <select
                  ref={firstFieldRef}
                  className="form-control"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  style={{ width: '100%', fontSize: '13.5px' }}
                  required
                >
                  <option value="" disabled>Select Work Role</option>
                  {roles.map((r) => (
                    <option key={r.id || r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Field 2: Work Name */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                Work Name / Assigned Task <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Prisoner UT/CT Verification, DLSA Document Followup, Jail Visits..."
                value={workName}
                onChange={(e) => setWorkName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid #E2E8F0', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#F8FAFC' }}>
            <button
              type="button"
              className="btn-wizard-prev"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-modal-done"
              disabled={submitting || !roleName || !workName.trim()}
              style={{ background: '#B45309', color: '#fff' }}
            >
              {submitting ? 'Saving...' : (initialData ? 'Update Entry' : 'Save Work Entry')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
