import React, { useState, useEffect } from 'react';
import {
  Compass, Plus, Search, RefreshCw, ArrowLeft, Download,
  Trash2, Edit3, Layers, ListFilter, X
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import RaastaPortalsModal from '../components/RaastaPortalsModal';
import AddRaastaFunctionModal from '../components/AddRaastaFunctionModal';
import { downloadRaastaExcel } from '../utils/exportRaastaExcel';

export default function RaastaFunctionHome({ onBackToDashboard }) {
  const [portals, setPortals] = useState([]);
  const [functions, setFunctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPortalFilter, setSelectedPortalFilter] = useState('');
  const [isPortalsModalOpen, setIsPortalsModalOpen] = useState(false);
  const [isAddFunctionModalOpen, setIsAddFunctionModalOpen] = useState(false);
  const [editingFunction, setEditingFunction] = useState(null);

  // Fetch Portals from Cloudflare Database
  const fetchPortals = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/raasta/portals?_t=${Date.now()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPortals(data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch Raasta portals:', err);
    }
  };

  // Fetch Functions from Cloudflare Database
  const fetchFunctions = async (query = '', portalFilter = selectedPortalFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.append('q', query.trim());
      if (portalFilter.trim()) params.append('portal', portalFilter.trim());
      params.append('_t', Date.now());

      const res = await fetch(`${API_BASE_URL}/api/raasta/list?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setFunctions(data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch Raasta functions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortals();
    fetchFunctions();
  }, []);

  const handleAddPortal = async (name) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/raasta/portals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        fetchPortals();
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const handleEditPortal = async (id, name) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/raasta/portals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        fetchPortals();
        fetchFunctions(searchQuery, selectedPortalFilter);
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const handleDeletePortal = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete portal "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/raasta/portals/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchPortals();
      }
    } catch (err) {
      alert('Failed to delete portal');
    }
  };

  const handleSaveFunction = async (payload, existingId) => {
    try {
      const endpoint = existingId
        ? `${API_BASE_URL}/api/raasta/${existingId}`
        : `${API_BASE_URL}/api/raasta/add`;
      const method = existingId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        fetchFunctions(searchQuery, selectedPortalFilter);
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const handleDeleteFunction = async (func) => {
    if (!window.confirm(`Are you sure you want to delete function "${func.function_name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/raasta/${func.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setFunctions((prev) => prev.filter((f) => f.id !== func.id));
      } else {
        alert(data.message || 'Failed to delete function');
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
              fetchPortals();
              fetchFunctions(searchQuery, selectedPortalFilter);
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
          <div className="stat-icon purple">
            <Compass size={22} />
          </div>
          <div>
            <div className="stat-value">{functions.length}</div>
            <div className="stat-label">Total Functions Defined</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Layers size={22} />
          </div>
          <div>
            <div className="stat-value">{portals.length}</div>
            <div className="stat-label">Available Portals</div>
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
              setEditingFunction(null);
              setIsAddFunctionModalOpen(true);
            }}
          >
            <Plus size={18} />
            <span>Add Raasta Function</span>
          </button>

          <button
            className="btn-download-excel"
            onClick={() => downloadRaastaExcel(functions)}
            title="Download Complete Excel Sheet"
          >
            <Download size={18} />
            <span>Export Excel</span>
          </button>

          <button
            className="btn-case-types"
            onClick={() => setIsPortalsModalOpen(true)}
            title="Manage dynamic portal names"
          >
            <Compass size={17} />
            <span>Manage Portals ({portals.length})</span>
          </button>
        </div>

        {/* Search & Filter Container */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: '1 1 360px', justifyContent: 'flex-end' }}>
          <div className="search-container" style={{ margin: 0, minWidth: '220px', flex: '1 1 240px' }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by portal name, function, or details..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchFunctions(e.target.value, selectedPortalFilter);
              }}
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  fetchFunctions('', selectedPortalFilter);
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
              value={selectedPortalFilter}
              onChange={(e) => {
                setSelectedPortalFilter(e.target.value);
                fetchFunctions(searchQuery, e.target.value);
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
              <option value="">All Portals ({portals.length})</option>
              {portals.map((p) => (
                <option key={p.id || p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Functions Table */}
      <div style={{ background: '#FFFFFF', borderRadius: '18px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
            <div>Loading Raasta functions from Cloudflare Database...</div>
          </div>
        ) : functions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
            <Compass size={40} color="#CBD5E1" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#475569' }}>No Raasta Functions Found</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Click "+ Add Raasta Function" to record your first portal function.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="survey-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', textAlign: 'left', fontSize: '12px', color: '#475569' }}>
                  <th style={{ padding: '14px 16px', width: '60px' }}>#</th>
                  <th style={{ padding: '14px 16px', width: '220px' }}>Portal Name</th>
                  <th style={{ padding: '14px 16px', width: '240px' }}>Function Name</th>
                  <th style={{ padding: '14px 16px' }}>Function Details</th>
                  <th style={{ padding: '14px 16px', width: '140px' }}>Date</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {functions.map((f, index) => (
                  <tr key={f.id || index} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#64748B' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: '#FAF5FF',
                        color: '#7E22CE',
                        border: '1px solid #E9D5FF'
                      }}>
                        <Compass size={13} />
                        {f.portal_name}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>
                      {f.function_name}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                      {f.details || <span style={{ color: '#94A3B8' }}>No details entered</span>}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>
                      {f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-action-icon"
                          style={{ background: '#F1F5F9', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#2563EB' }}
                          onClick={() => {
                            setEditingFunction(f);
                            setIsAddFunctionModalOpen(true);
                          }}
                          title="Edit Function"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-delete-case-type"
                          onClick={() => handleDeleteFunction(f)}
                          title="Delete Function"
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

      {/* Manage Portals Modal */}
      <RaastaPortalsModal
        isOpen={isPortalsModalOpen}
        onClose={() => setIsPortalsModalOpen(false)}
        portals={portals}
        onAddPortal={handleAddPortal}
        onEditPortal={handleEditPortal}
        onDeletePortal={handleDeletePortal}
      />

      {/* Add / Edit Raasta Function Modal */}
      <AddRaastaFunctionModal
        isOpen={isAddFunctionModalOpen}
        onClose={() => {
          setIsAddFunctionModalOpen(false);
          setEditingFunction(null);
        }}
        portals={portals}
        onOpenManagePortals={() => {
          setIsAddFunctionModalOpen(false);
          setIsPortalsModalOpen(true);
        }}
        onSaveFunction={handleSaveFunction}
        initialData={editingFunction}
      />
    </div>
  );
}
