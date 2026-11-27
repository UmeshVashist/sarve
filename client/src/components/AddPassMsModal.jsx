import React, { useState, useEffect, useRef } from 'react';
import { X, Key, Globe, User, Lock, Eye, EyeOff, Save, Check } from 'lucide-react';

export default function AddPassMsModal({ isOpen, onClose, onSave, editingEntry = null }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const titleInputRef = useRef(null);

  useEffect(() => {
    if (editingEntry) {
      setTitle(editingEntry.title || '');
      setUrl(editingEntry.url || '');
      setUsername(editingEntry.username || '');
      setPassword(editingEntry.password || '');
      setNotes(editingEntry.notes || '');
    } else {
      setTitle('');
      setUrl('');
      setUsername('');
      setPassword('');
      setNotes('');
    }
    setShowPassword(false);
    setError('');
  }, [editingEntry, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !username.trim() || !password.trim()) {
      setError('Title, Username aur Password sabhi required hain.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        url: url.trim(),
        username: username.trim(),
        password: password.trim(),
        notes: notes.trim()
      };
      const res = await onSave(payload, editingEntry ? editingEntry.id : null);
      if (res && res.success) {
        onClose();
      } else {
        setError(res?.message || 'Failed to save password entry');
      }
    } catch (err) {
      setError(err.message || 'Error saving entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#EDE9FE', color: '#7C3AED', padding: '8px', borderRadius: '10px' }}>
              <Key size={20} />
            </div>
            <div>
              <h3 className="modal-title">{editingEntry ? 'Edit Password Entry' : '+ Add Password Entry'}</h3>
              <p className="modal-subtitle">Pass MS Secure Credentials Vault</p>
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#B91C1C',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600
              }}>
                {error}
              </div>
            )}

            {/* 1. Title */}
            <div>
              <label className="form-label" style={{ fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block' }}>
                Title <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Key size={16} style={{ position: 'absolute', left: '12px', color: '#94A3B8' }} />
                <input
                  ref={titleInputRef}
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '38px' }}
                  placeholder="e.g. e-Courts Portal, Gmail Advocate, DLSA"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* 2. URL */}
            <div>
              <label className="form-label" style={{ fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block' }}>
                Website / Login URL
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Globe size={16} style={{ position: 'absolute', left: '12px', color: '#94A3B8' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '38px' }}
                  placeholder="e.g. https://services.ecourts.gov.in"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
            </div>

            {/* 3. Username */}
            <div>
              <label className="form-label" style={{ fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block' }}>
                Username / Email / ID <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', color: '#94A3B8' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '38px' }}
                  placeholder="e.g. advocate_office@gmail.com or adv_rajesh"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* 4. Password */}
            <div>
              <label className="form-label" style={{ fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block' }}>
                Password <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', color: '#94A3B8' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  style={{ paddingLeft: '38px', paddingRight: '40px' }}
                  placeholder="Enter secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'transparent',
                    border: 'none',
                    color: '#64748B',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  onClick={() => setShowPassword((p) => !p)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-coral"
              style={{ width: 'auto', padding: '10px 24px', background: '#7C3AED' }}
              disabled={saving}
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : editingEntry ? 'Update Password' : 'Save Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
