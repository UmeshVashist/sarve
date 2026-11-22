import React, { useState, useEffect } from 'react';
import {
  Briefcase, Plus, Search, RefreshCw, ArrowLeft, Download,
  Trash2, Edit3, UserCheck, ListFilter, X
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import WorkRolesModal from '../components/WorkRolesModal';
import AddWorkRoleEntryModal from '../components/AddWorkRoleEntryModal';
import { downloadWorkRoleExcel } from '../utils/exportWorkRoleExcel';

export default function WorkRoleHome({ onBackToDashboard }) {
  const [roles, setRoles] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('');
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // Fetch Roles from Cloudflare Database
  const fetchRoles = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/work-roles/roles?_t=${Date.now()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRoles(data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch work roles:', err);
    }
  };

  // Fetch Entries from Cloudflare Database
  const fetchEntries = async (query = '', roleFilter = selectedRoleFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.append('q', query.trim());
      if (roleFilter.trim()) params.append('role', roleFilter.trim());
      params.append('_t', Date.now());

      const res = await fetch(`${API_BASE_URL}/api/work-roles/list?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setEntries(data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch work role entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchEntries();
  }, []);

  const handleAddRole = async (name) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/work-roles/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        fetchRoles();
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const handleEditRole = async (id, name) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/work-roles/roles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        fetchRoles();
        fetchEntries(searchQuery, selectedRoleFilter);
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const handleDeleteRole = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete work role "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/work-roles/roles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchRoles();
      }
    } catch (err) {
      alert('Failed to delete work role');
    }
  };

  const handleSaveEntry = async (payload, existingId) => {
    try {
      const endpoint = existingId
        ? `${API_BASE_URL}/api/work-roles/${existingId}`
        : `${API_BASE_URL}/api/work-roles/add`;
      const method = existingId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        fetchEntries(searchQuery, selectedRoleFilter);
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const handleDeleteEntry = async (item) => {
    if (!window.confirm(`Are you sure you want to delete task "${item.work_name}" under Role "${item.role_name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/work-roles/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setEntries((prev) => prev.filter((e) => e.id !== item.id));
      } else {
        alert(data.message || 'Failed to delete entry');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  };

  return (
    <div className="survey-page-container animate-fade-in">
      {/* Top Navigation */}
      <div className="page-top-nav">
        <button className="btn-back-nav" onClick={onBackToDashboard}>
          <ArrowLeft size={16} />
          <span>Back to All Categories</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn-back-nav"
            onClick={() => {
              fetchRoles();
              fetchEntries(searchQuery, selectedRoleFilter);
            }}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="stats-banner">
        <div className="stat-card">
          <div className="stat-icon orange">
            <Briefcase size={22} />
          </div>
          <div>
            <div className="stat-value">{entries.length}</div>
            <div className="stat-label">Total Assigned Work Entries</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <UserCheck size={22} />
          </div>
          <div>
            <div className="stat-value">{roles.length}</div>
            <div className="stat-label">Configured Roles</div>
          </div>
        </div>
      </div>

      {/* Actions and Search Bar */}
      <div className="survey-action-bar">
        {/* Buttons Group */}
        <div className="action-buttons-group">
          <button
            className="btn-add-data"
            onClick={() => {
              setEditingEntry(null);
              setIsAddEntryModalOpen(true);
            }}
          >
            <Plus size={18} />
            <span>Add Work Entry</span>
          </button>

          <button
            className="btn-download-excel"
            onClick={() => downloadWorkRoleExcel(entries)}
            title="Download Complete Excel Sheet"
          >
            <Download size={18} />
            <span>Export Excel</span>
          </button>

          <button
            className="btn-case-types"
            onClick={() => setIsRolesModalOpen(true)}
            title="Manage dynamic work roles"
          >
            <Briefcase size={17} />
            <span>Manage Roles ({roles.length})</span>
          </button>
        </div>

        {/* Search & Role Filter Container */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: '1 1 360px', justifyContent: 'flex-end' }}>
          <div className="search-container" style={{ margin: 0, minWidth: '220px', flex: '1 1 240px' }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by role name or work/task name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchEntries(e.target.value, selectedRoleFilter);
              }}
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  fetchEntries('', selectedRoleFilter);
                }}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ListFilter size={16} color="#64748B" />
            <select
              value={selectedRoleFilter}
              onChange={(e) => {
                setSelectedRoleFilter(e.target.value);
                fetchEntries(searchQuery, e.target.value);
              }}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                border: '1.5px solid #CBD5E1',
                background: '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: 600,
                color: '#1E293B',
                cursor: 'pointer'
              }}
            >
              <option value="">All Roles ({roles.length})</option>
              {roles.map((r) => (
                <option key={r.id || r.name} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Entries Table */}
      <div style={{ background: '#FFFFFF', borderRadius: '18px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
            <div>Loading work role entries from Cloudflare Database...</div>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
            <Briefcase size={40} color="#CBD5E1" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#475569' }}>No Work Role Entries Found</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Click "+ Add Work Entry" to record your first task assignment.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="survey-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', textAlign: 'left', fontSize: '12px', color: '#475569' }}>
                  <th style={{ padding: '14px 16px', width: '60px' }}>#</th>
                  <th style={{ padding: '14px 16px', width: '240px' }}>Role Name</th>
                  <th style={{ padding: '14px 16px' }}>Work Name / Task</th>
                  <th style={{ padding: '14px 16px', width: '150px' }}>Date</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((item, index) => (
                  <tr key={item.id || index} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#64748B' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        background: '#FEF3C7',
                        color: '#B45309',
                        border: '1px solid #FDE68A'
                      }}>
                        <Briefcase size={13} />
                        {item.role_name}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                      {item.work_name}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-action-icon"
                          style={{ background: '#F1F5F9', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#2563EB' }}
                          onClick={() => {
                            setEditingEntry(item);
                            setIsAddEntryModalOpen(true);
                          }}
                          title="Edit Entry"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-delete-case-type"
                          onClick={() => handleDeleteEntry(item)}
                          title="Delete Entry"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manage Roles Modal */}
      <WorkRolesModal
        isOpen={isRolesModalOpen}
        onClose={() => setIsRolesModalOpen(false)}
        roles={roles}
        onAddRole={handleAddRole}
        onEditRole={handleEditRole}
        onDeleteRole={handleDeleteRole}
      />

      {/* Add / Edit Work Role Entry Modal */}
      <AddWorkRoleEntryModal
        isOpen={isAddEntryModalOpen}
        onClose={() => {
          setIsAddEntryModalOpen(false);
          setEditingEntry(null);
        }}
        roles={roles}
        onOpenManageRoles={() => {
          setIsAddEntryModalOpen(false);
          setIsRolesModalOpen(true);
        }}
        onSaveEntry={handleSaveEntry}
        initialData={editingEntry}
      />
    </div>
  );
}
