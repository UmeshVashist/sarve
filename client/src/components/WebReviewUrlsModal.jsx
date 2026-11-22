import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Edit3, Globe, ExternalLink } from 'lucide-react';

export default function WebReviewUrlsModal({
  isOpen,
  onClose,
  urls = [],
  onAddUrl,
  onEditUrl,
  onDeleteUrl
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingUrl, setEditingUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setName('');
      setUrl('');
      setEditingId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      setError('Please enter both Website Name and Website URL');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await onAddUrl(name.trim(), url.trim());
      if (res && res.success === false) {
        setError(res.message || 'Failed to add URL');
      } else {
        setName('');
        setUrl('');
      }
    } catch (err) {
      setError(err.message || 'Error adding URL');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingName(item.name || '');
    setEditingUrl(item.url || '');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
    setEditingUrl('');
  };

  const saveEdit = async (item) => {
    if (!editingName.trim() || !editingUrl.trim()) {
      setError('Both Name and URL are required');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await onEditUrl(item.id, editingName.trim(), editingUrl.trim());
      if (res && res.success === false) {
        setError(res.message || 'Failed to update URL');
      } else {
        cancelEdit();
      }
    } catch (err) {
      setError(err.message || 'Error updating URL');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} color="#15803D" />
            <span>Manage Website URLs</span>
          </div>
          <button className="wizard-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '14px', lineHeight: 1.5 }}>
            Websites and URLs added here will be available for quick selection when adding Web Reviews. You can Add, Edit, or Delete websites.
          </p>

          {error && (
            <div className="wizard-error-banner" style={{ marginBottom: '14px' }}>
              <span>{error}</span>
            </div>
          )}

          {/* Add URL Form */}
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Website Name (e.g. e-Courts Portal)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ flex: '1 1 200px' }}
                autoFocus
              />
              <input
                type="text"
                className="form-control"
                placeholder="URL (e.g. https://ecourts.gov.in)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{ flex: '1 1 220px' }}
              />
            </div>
            <button
              type="submit"
              className="btn-case-types"
              style={{ alignSelf: 'flex-start', padding: '9px 18px', background: '#15803D', borderColor: '#15803D', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              disabled={submitting || !name.trim() || !url.trim()}
            >
              <Plus size={16} />
              <span>{submitting ? 'Adding...' : 'Add Website URL'}</span>
            </button>
          </form>

          {/* URLs List */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
              Available Websites ({urls.length}):
            </span>
          </div>

          <div className="case-types-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {urls.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '13px' }}>
                No websites added yet. Add your first website above.
              </div>
            ) : (
              urls.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <div key={item.id} className="case-type-item" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            className="form-control"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            placeholder="Website Name"
                            style={{ flex: 1, padding: '6px 10px', fontSize: '13px' }}
                          />
                          <input
                            type="text"
                            className="form-control"
                            value={editingUrl}
                            onChange={(e) => setEditingUrl(e.target.value)}
                            placeholder="Website URL"
                            style={{ flex: 1, padding: '6px 10px', fontSize: '13px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn-primary-admin"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => saveEdit(item)}
                            disabled={submitting}
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
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                          <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#0F172A' }}>
                            {item.name}
                          </span>
                          <a
                            href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '12px', color: '#2563EB', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span>{item.url}</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn-action-icon"
                            style={{ background: '#F1F5F9', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#2563EB' }}
                            onClick={() => startEdit(item)}
                            title="Edit Website URL"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-delete-case-type"
                            onClick={() => onDeleteUrl(item.id, item.name)}
                            title="Delete Website"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
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
