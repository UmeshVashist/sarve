import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Compass, Plus } from 'lucide-react';

export default function AddRaastaFunctionModal({
  isOpen,
  onClose,
  portals = [],
  onOpenManagePortals,
  onSaveFunction,
  initialData = null
}) {
  const [portalName, setPortalName] = useState('');
  const [functionName, setFunctionName] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSubmitting(false);
      if (initialData) {
        setPortalName(initialData.portal_name || '');
        setFunctionName(initialData.function_name || '');
        setDetails(initialData.details || '');
      } else {
        setPortalName(portals[0]?.name || '');
        setFunctionName('');
        setDetails('');
      }
    }
  }, [isOpen, initialData, portals]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!portalName.trim()) {
      setError('Please select a Portal Name');
      return;
    }
    if (!functionName.trim()) {
      setError('Please enter a Function name');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const payload = {
        portal_name: portalName.trim(),
        function_name: functionName.trim(),
        details: details.trim()
      };
      const res = await onSaveFunction(payload, initialData?.id);
      if (res && res.success === false) {
        setError(res.message || 'Failed to save function');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Error saving function');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={20} color="#7E22CE" />
            <span>{initialData ? 'Edit Raasta Function' : 'Add Raasta Function Data'}</span>
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

            {/* Field 1: Portal Name (Single Select) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
                  Portal Name (Single Select) <span style={{ color: '#EF4444' }}>*</span>
                </label>
                {onOpenManagePortals && (
                  <button
                    type="button"
                    onClick={onOpenManagePortals}
                    style={{ background: 'none', border: 'none', color: '#7E22CE', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={13} /> Manage / Add Portals
                  </button>
                )}
              </div>

              {portals.length === 0 ? (
                <div style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#64748B' }}>
                  No portals configured yet. Click "+ Manage / Add Portals" above to add one.
                </div>
              ) : (
                <select
                  className="form-control"
                  value={portalName}
                  onChange={(e) => setPortalName(e.target.value)}
                  style={{ width: '100%', fontSize: '13.5px' }}
                  required
                >
                  <option value="" disabled>Select Portal Name</option>
                  {portals.map((p) => (
                    <option key={p.id || p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Field 2: Function Name */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                Function Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Bail Application Tracking, Case Status Lookup, Notice Download..."
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                required
              />
            </div>

            {/* Field 3: Details */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                Details / Description
              </label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Enter step-by-step function details, process workflow, requirements or observations..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                style={{ resize: 'vertical', minHeight: '90px' }}
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
              disabled={submitting || !portalName || !functionName.trim()}
              style={{ background: '#7E22CE', color: '#fff' }}
            >
              {submitting ? 'Saving...' : (initialData ? 'Update Function' : 'Save Function Data')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
