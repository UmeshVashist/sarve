import React, { useState, useEffect, useRef } from 'react';
import {
  Key, Plus, Search, RefreshCw, ArrowLeft, Download,
  Trash2, Edit3, Eye, EyeOff, Copy, ExternalLink, Globe,
  ShieldCheck, Check, X, Lock, CheckCircle2, AlertCircle
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import AddPassMsModal from '../components/AddPassMsModal';
import { downloadPassMsExcel } from '../utils/exportPassMsExcel';

export default function PassMsHome({ onBackToDashboard }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [revealedRows, setRevealedRows] = useState({});
  const [copyToast, setCopyToast] = useState('');
  const [statusBanner, setStatusBanner] = useState(null);

  const addDataBtnRef = useRef(null);

  // Fetch entries from Cloudflare D1 Database
  const fetchEntries = async (query = searchQuery) => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.append('q', query.trim());
      params.append('_t', Date.now());

      const res = await fetch(`${API_BASE_URL}/api/pass-ms/list?${params.toString()}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setEntries(data.data);
      } else {
        setEntries([]);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Pass MS fetch warning:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries(searchQuery);
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) {
      fetchEntries('');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEntries(searchQuery);
  };

  // Toggle View / Reveal password for a row
  const toggleReveal = (id) => {
    setRevealedRows((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Copy to clipboard with toast notification
  const handleCopy = (text, type = 'Text') => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopyToast(`${type} copied to clipboard!`);
      setTimeout(() => setCopyToast(''), 2500);
    } catch (e) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopyToast(`${type} copied to clipboard!`);
      setTimeout(() => setCopyToast(''), 2500);
    }
  };

  // Save or Update Entry
  const handleSaveEntry = async (payload, id = null) => {
    try {
      const endpoint = id
        ? `${API_BASE_URL}/api/pass-ms/entries/${id}`
        : `${API_BASE_URL}/api/pass-ms/entries`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner({
          type: 'success',
          message: id ? 'Password entry updated successfully!' : 'Password entry saved successfully!'
        });
        fetchEntries(searchQuery);
        setTimeout(() => setStatusBanner(null), 4000);
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (item) => {
    if (!window.confirm(`Are you sure you want to delete password entry for "${item.title}"?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/pass-ms/entries/${item.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setStatusBanner({ type: 'success', message: `"${item.title}" deleted successfully.` });
        fetchEntries(searchQuery);
        setTimeout(() => setStatusBanner(null), 4000);
      } else {
        setStatusBanner({ type: 'error', message: data.message || 'Failed to delete' });
      }
    } catch (err) {
      setStatusBanner({ type: 'error', message: err.message });
    }
  };

  const totalUrlsCount = entries.filter((e) => e.url && e.url.trim()).length;

  return (
    <div className="survey-page-container animate-fade-in">
      {/* 1. Top Navigation */}
      <div className="page-top-nav">
        <button className="btn-back-nav" onClick={onBackToDashboard}>
          <ArrowLeft size={16} />
          <span>Back to All Categories</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn-back-nav"
            onClick={() => fetchEntries(searchQuery)}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Copy Toast Alert */}
      {copyToast && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          background: '#0F172A',
          color: '#FFFFFF',
          padding: '12px 18px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13.5px',
          fontWeight: 600,
          border: '1px solid rgba(255,255,255,0.15)',
          animation: 'slideUp 0.2s ease-out'
        }}>
          <Check size={16} color="#10B981" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* Notification Banner */}
      {statusBanner && (
        <div className={`doc-status-banner ${statusBanner.type === 'error' ? 'error' : 'success'} animate-fade-in`}>
          {statusBanner.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{statusBanner.message}</span>
          <button className="banner-close-btn" onClick={() => setStatusBanner(null)}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* 2. KPI Quick Stats Banner */}
      <div className="stats-banner" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#EDE9FE', color: '#7C3AED' }}>
            <Key size={22} />
          </div>
          <div>
            <div className="stat-value">{entries.length}</div>
            <div className="stat-label">Total Saved Passwords</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Globe size={22} />
          </div>
          <div>
            <div className="stat-value">{totalUrlsCount}</div>
            <div className="stat-label">Websites & Portals</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '15px', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="status-dot-pulse"></span>
              Secure Database Vault
            </div>
            <div className="stat-label">Cloudflare D1 Database</div>
          </div>
        </div>
      </div>

      {/* 3. Action Bar */}
      <div className="survey-action-bar">
        <div className="action-buttons-group">
          {/* Add Password Button */}
          <button
            ref={addDataBtnRef}
            className="btn-add-data"
            style={{ background: '#7C3AED', borderColor: '#6D28D9', color: 'white' }}
            onClick={() => {
              setEditingEntry(null);
              setIsModalOpen(true);
            }}
            title="Save new password entry"
          >
            <Plus size={18} />
            <span>Add Password</span>
          </button>

          {/* Export Excel Button */}
          <button
            className="btn-download-excel"
            onClick={() => downloadPassMsExcel(entries)}
            title="Download credentials to Excel"
          >
            <Download size={18} />
            <span>Export Excel</span>
          </button>
        </div>

        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: '1 1 320px', justifyContent: 'flex-end' }}>
          <form onSubmit={handleSearchSubmit} className="search-container" style={{ margin: 0, minWidth: '220px', flex: '1 1 240px' }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by title, URL or username..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => {
                  setSearchQuery('');
                  fetchEntries('');
                }}
              >
                <X size={14} />
              </button>
            )}
          </form>
        </div>
      </div>

      {/* 4. Data Table */}
      <div className="table-wrapper" style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', overflow: 'hidden', marginTop: '16px' }}>
        {loading ? (
          <div className="table-empty-state">
            <RefreshCw size={36} className="animate-spin empty-icon" />
            <p className="empty-title">Loading Pass MS Vault...</p>
            <p className="empty-desc">Fetching encrypted credentials from Cloudflare Database.</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="table-empty-state">
            <Key size={48} className="empty-icon" color="#7C3AED" />
            <p className="empty-title">No Password Entries Found</p>
            <p className="empty-desc">
              {searchQuery
                ? `No credentials match "${searchQuery}". Try a different keyword.`
                : 'Click "+ Add Password" above to record your first login credentials.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'center' }}>
              <button
                className="btn-primary-coral"
                style={{ width: 'auto', padding: '10px 18px', background: '#7C3AED' }}
                onClick={() => {
                  setEditingEntry(null);
                  setIsModalOpen(true);
                }}
              >
                <Plus size={16} />
                <span>Add First Password</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', background: '#FFFFFF' }}>
            <table className="survey-table" style={{ width: '100%', borderCollapse: 'collapse', background: '#FFFFFF' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0' }}>
                  <th style={{ width: '45px' }}>#</th>
                  <th style={{ width: '180px' }}>Title</th>
                  <th>Website URL</th>
                  <th>Username / Email</th>
                  <th>Password</th>
                  <th>Date Added</th>
                  <th style={{ textAlign: 'center', width: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((item, idx) => {
                  const isRevealed = Boolean(revealedRows[item.id]);
                  return (
                    <tr key={item.id} style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ color: '#94A3B8', fontWeight: 600 }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          background: '#EDE9FE',
                          color: '#7C3AED',
                          padding: '6px',
                          borderRadius: '8px',
                          display: 'inline-flex'
                        }}>
                          <Key size={14} />
                        </span>
                        <strong style={{ color: '#0F172A', fontSize: '13.5px' }}>{item.title}</strong>
                      </div>
                    </td>
                    <td>
                      {item.url ? (
                        <a
                          href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: '#2563EB',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontSize: '13px'
                          }}
                          title={`Open ${item.url} in new tab`}
                        >
                          <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.url}
                          </span>
                          <ExternalLink size={13} />
                        </a>
                      ) : (
                        <span style={{ color: '#94A3B8', fontSize: '12.5px' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div
                        onClick={() => handleCopy(item.username, 'Username')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          transition: 'all 0.15s ease'
                        }}
                        className="copyable-badge"
                        title="Click to copy username"
                      >
                        <span style={{ fontWeight: 600, color: '#334155', fontSize: '13px' }}>
                          {item.username}
                        </span>
                        <Copy size={12} color="#94A3B8" />
                      </div>
                    </td>
                    <td>
                      <div
                        onClick={() => handleCopy(item.password, 'Password')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: isRevealed ? '#FEF3C7' : '#F1F5F9',
                          border: `1px solid ${isRevealed ? '#FDE68A' : '#E2E8F0'}`,
                          transition: 'all 0.15s ease'
                        }}
                        className="copyable-badge"
                        title="Click to copy password"
                      >
                        <span style={{
                          fontWeight: 700,
                          fontSize: isRevealed ? '13px' : '15px',
                          letterSpacing: isRevealed ? 'normal' : '2px',
                          color: isRevealed ? '#B45309' : '#475569',
                          fontFamily: isRevealed ? 'inherit' : 'monospace'
                        }}>
                          {isRevealed ? item.password : '••••••••'}
                        </span>
                        <Copy size={12} color="#94A3B8" />
                      </div>
                    </td>
                    <td style={{ color: '#64748B', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Today'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {/* 1. View / Unmask Button */}
                        <button
                          type="button"
                          className="btn-pass-action view"
                          onClick={() => toggleReveal(item.id)}
                          title={isRevealed ? 'Hide password' : 'View password'}
                          style={{ color: isRevealed ? '#7C3AED' : '#475569' }}
                        >
                          {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>

                        {/* 2. Edit Button */}
                        <button
                          type="button"
                          className="btn-pass-action edit"
                          onClick={() => {
                            setEditingEntry(item);
                            setIsModalOpen(true);
                          }}
                          title="Edit credentials"
                        >
                          <Edit3 size={15} />
                        </button>

                        {/* 3. Delete Button */}
                        <button
                          type="button"
                          className="btn-pass-action delete"
                          onClick={() => handleDeleteEntry(item)}
                          title="Delete credentials"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AddPassMsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEntry}
        editingEntry={editingEntry}
      />
    </div>
  );
}
