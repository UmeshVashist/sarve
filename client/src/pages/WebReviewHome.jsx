import React, { useState, useEffect } from 'react';
import {
  Globe, Plus, Search, RefreshCw, ArrowLeft, Download,
  Trash2, Edit3, ExternalLink, MessageSquare, CheckCircle, ListFilter
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import WebReviewUrlsModal from '../components/WebReviewUrlsModal';
import AddWebReviewModal from '../components/AddWebReviewModal';
import { downloadWebReviewExcel } from '../utils/exportWebReviewExcel';

export default function WebReviewHome({ onBackToDashboard }) {
  const [urls, setUrls] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWebsiteFilter, setSelectedWebsiteFilter] = useState('');
  const [isUrlsModalOpen, setIsUrlsModalOpen] = useState(false);
  const [isAddReviewModalOpen, setIsAddReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);

  // Fetch URLs from Cloudflare Database
  const fetchUrls = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/web-review/urls?_t=${Date.now()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setUrls(data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch web review URLs:', err);
    }
  };

  // Fetch Reviews from Cloudflare Database
  const fetchReviews = async (query = '') => {
    setLoading(true);
    try {
      const q = query.trim();
      const url = q
        ? `${API_BASE_URL}/api/web-review/list?q=${encodeURIComponent(q)}&_t=${Date.now()}`
        : `${API_BASE_URL}/api/web-review/list?_t=${Date.now()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setReviews(data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch web reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUrls();
    fetchReviews();
  }, []);

  const handleAddUrl = async (name, url) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/web-review/urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url })
      });
      const data = await res.json();
      if (data.success) {
        fetchUrls();
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const handleEditUrl = async (id, name, url) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/web-review/urls/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url })
      });
      const data = await res.json();
      if (data.success) {
        fetchUrls();
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const handleDeleteUrl = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete website "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/web-review/urls/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchUrls();
      }
    } catch (err) {
      alert('Failed to delete website URL');
    }
  };

  const handleSaveReview = async (payload, existingId) => {
    try {
      const endpoint = existingId
        ? `${API_BASE_URL}/api/web-review/${existingId}`
        : `${API_BASE_URL}/api/web-review/add`;
      const method = existingId ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        fetchReviews(searchQuery);
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const handleDeleteReview = async (rev) => {
    if (!window.confirm(`Are you sure you want to delete review for "${rev.website_name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/web-review/${rev.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setReviews((prev) => prev.filter((r) => r.id !== rev.id));
      } else {
        alert(data.message || 'Failed to delete review');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  };

  // Filtered reviews by dropdown selection
  const displayedReviews = reviews.filter((r) => {
    if (!selectedWebsiteFilter) return true;
    return (r.website_name || '').toLowerCase() === selectedWebsiteFilter.toLowerCase();
  });

  // Calculate total feedback points across all records
  const totalFeedbackCount = reviews.reduce((acc, r) => {
    const list = Array.isArray(r.reviews) ? r.reviews : [];
    return acc + list.length;
  }, 0);

  return (
    <div className="survey-home-container animate-fade-in" style={{ padding: '24px 32px' }}>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={onBackToDashboard}
          className="btn-wizard-prev"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#FFFFFF', border: '1px solid #CBD5E1' }}
        >
          <ArrowLeft size={16} />
          <span>Back to All Categories</span>
        </button>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setEditingReview(null);
              setIsAddReviewModalOpen(true);
            }}
            className="btn-primary-admin"
            style={{ background: '#15803D', borderColor: '#15803D', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>+ Add Web Review</span>
          </button>

          <button
            onClick={() => setIsUrlsModalOpen(true)}
            className="btn-case-types"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Globe size={15} color="#15803D" />
            <span>Manage URLs ({urls.length})</span>
          </button>

          <button
            onClick={() => downloadWebReviewExcel(displayedReviews)}
            className="btn-export-excel"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => {
              fetchUrls();
              fetchReviews(searchQuery);
            }}
            className="btn-refresh"
            style={{ padding: '9px 12px' }}
            title="Refresh from Cloudflare Database"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid #E2E8F0' }}>
          <div style={{ background: '#DCFCE7', color: '#15803D', padding: '12px', borderRadius: '12px' }}>
            <Globe size={22} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>{reviews.length}</div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Total Web Reviews</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid #E2E8F0' }}>
          <div style={{ background: '#EFF6FF', color: '#2563EB', padding: '12px', borderRadius: '12px' }}>
            <ExternalLink size={22} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>{urls.length}</div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Websites Monitored</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid #E2E8F0' }}>
          <div style={{ background: '#FAF5FF', color: '#7E22CE', padding: '12px', borderRadius: '12px' }}>
            <MessageSquare size={22} />
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>{totalFeedbackCount}</div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Total Review Inputs Given</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '450px' }}>
          <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '36px' }}
            placeholder="Search by website, URL, or review comment..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              fetchReviews(e.target.value);
            }}
          />
        </div>

        {/* Website Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ListFilter size={16} color="#64748B" />
          <select
            className="form-control"
            style={{ minWidth: '180px', fontSize: '13px' }}
            value={selectedWebsiteFilter}
            onChange={(e) => setSelectedWebsiteFilter(e.target.value)}
          >
            <option value="">All Websites ({reviews.length})</option>
            {urls.map((u) => (
              <option key={u.id} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reviews Table */}
      <div style={{ background: '#FFFFFF', borderRadius: '18px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
            <div>Loading web reviews from Cloudflare Database...</div>
          </div>
        ) : displayedReviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
            <Globe size={40} color="#CBD5E1" style={{ marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#475569' }}>No Web Reviews Found</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Click "+ Add Web Review" to record your first website review.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="survey-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', textAlign: 'left', fontSize: '12px', color: '#475569' }}>
                  <th style={{ padding: '14px 16px', width: '60px' }}>#</th>
                  <th style={{ padding: '14px 16px' }}>Website Name</th>
                  <th style={{ padding: '14px 16px' }}>URL</th>
                  <th style={{ padding: '14px 16px' }}>Review Inputs</th>
                  <th style={{ padding: '14px 16px', width: '160px' }}>Date</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center', width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedReviews.map((r, index) => {
                  const revList = Array.isArray(r.reviews) ? r.reviews : [];
                  return (
                    <tr key={r.id || index} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#64748B' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '13.5px' }}>
                          {r.website_name}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {r.url ? (
                          <a
                            href={r.url.startsWith('http') ? r.url : `https://${r.url}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#2563EB', fontSize: '12.5px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span>{r.url}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {revList.map((rev, rIdx) => (
                            <div key={rIdx} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', fontSize: '12.5px' }}>
                              <span style={{ fontWeight: 800, color: '#15803D', fontSize: '11px', background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px' }}>
                                #{rIdx + 1}
                              </span>
                              <span style={{ color: '#334155' }}>{rev}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748B' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-action-icon"
                            style={{ background: '#F1F5F9', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#2563EB' }}
                            onClick={() => {
                              setEditingReview(r);
                              setIsAddReviewModalOpen(true);
                            }}
                            title="Edit Review"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn-delete-case-type"
                            onClick={() => handleDeleteReview(r)}
                            title="Delete Review"
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

      {/* Manage URLs Modal */}
      <WebReviewUrlsModal
        isOpen={isUrlsModalOpen}
        onClose={() => setIsUrlsModalOpen(false)}
        urls={urls}
        onAddUrl={handleAddUrl}
        onEditUrl={handleEditUrl}
        onDeleteUrl={handleDeleteUrl}
      />

      {/* Add / Edit Web Review Modal */}
      <AddWebReviewModal
        isOpen={isAddReviewModalOpen}
        onClose={() => {
          setIsAddReviewModalOpen(false);
          setEditingReview(null);
        }}
        urls={urls}
        onOpenManageUrls={() => {
          setIsAddReviewModalOpen(false);
          setIsUrlsModalOpen(true);
        }}
        onSaveReview={handleSaveReview}
        initialData={editingReview}
      />
    </div>
  );
}
