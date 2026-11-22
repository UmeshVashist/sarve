import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Plus, Search, RefreshCw, ArrowLeft, Download,
  Trash2, Edit3, ExternalLink, MessageSquare, CheckCircle, ListFilter, X, Eye
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import WebReviewUrlsModal from '../components/WebReviewUrlsModal';
import AddWebReviewModal from '../components/AddWebReviewModal';
import ViewWebReviewsModal from '../components/ViewWebReviewsModal';
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
  const [viewingReview, setViewingReview] = useState(null);
  const addDataBtnRef = useRef(null);

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
        // Automatically focus Add Data button after saving
        setTimeout(() => {
          addDataBtnRef.current?.focus();
        }, 120);
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
              fetchUrls();
              fetchReviews(searchQuery);
            }}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Quick Stats Banner */}
      <div className="stats-banner">
        <div className="stat-card">
          <div className="stat-icon green">
            <Globe size={22} />
          </div>
          <div>
            <div className="stat-value">{reviews.length}</div>
            <div className="stat-label">Total Web Reviews</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <ExternalLink size={22} />
          </div>
          <div>
            <div className="stat-value">{urls.length}</div>
            <div className="stat-label">Websites Monitored</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <MessageSquare size={22} />
          </div>
          <div>
            <div className="stat-value">{totalFeedbackCount}</div>
            <div className="stat-label">Total Review Inputs</div>
          </div>
        </div>
      </div>

      {/* Actions and Search Bar */}
      <div className="survey-action-bar">
        {/* Buttons Group */}
        <div className="action-buttons-group">
          <button
            ref={addDataBtnRef}
            className="btn-add-data"
            onClick={() => {
              setEditingReview(null);
              setIsAddReviewModalOpen(true);
            }}
          >
            <Plus size={18} />
            <span>Add Web Review</span>
          </button>

          <button
            className="btn-download-excel"
            onClick={() => downloadWebReviewExcel(displayedReviews)}
            title="Download Complete Excel Sheet"
          >
            <Download size={18} />
            <span>Export Excel</span>
          </button>

          <button
            className="btn-case-types"
            onClick={() => setIsUrlsModalOpen(true)}
            title="Manage dynamic website URLs"
          >
            <Globe size={17} />
            <span>Manage URLs ({urls.length})</span>
          </button>
        </div>

        {/* Search & Filter Container */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: '1 1 360px', justifyContent: 'flex-end' }}>
          <div className="search-container" style={{ margin: 0, minWidth: '220px', flex: '1 1 240px' }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by website, URL, or review..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchReviews(e.target.value);
              }}
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  fetchReviews('');
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
              value={selectedWebsiteFilter}
              onChange={(e) => setSelectedWebsiteFilter(e.target.value)}
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
              <option value="">All Websites ({urls.length})</option>
              {urls.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
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
                          {revList.slice(0, 3).map((rev, rIdx) => (
                            <div key={rIdx} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', fontSize: '12.5px' }}>
                              <span style={{ fontWeight: 800, color: '#15803D', fontSize: '11px', background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px', flexShrink: 0 }}>
                                #{rIdx + 1}
                              </span>
                              <span style={{ color: '#334155', wordBreak: 'break-word' }}>{rev}</span>
                            </div>
                          ))}
                          {revList.length > 3 && (
                            <button
                              type="button"
                              onClick={() => setViewingReview(r)}
                              style={{
                                alignSelf: 'flex-start',
                                marginTop: '2px',
                                background: '#F0FDF4',
                                border: '1px solid #86EFAC',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                color: '#15803D',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s'
                              }}
                              title="Click to view all reviews"
                            >
                              <Plus size={12} />
                              <span>{revList.length - 3} more</span>
                            </button>
                          )}
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
                            style={{ background: '#F1F5F9', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#15803D' }}
                            onClick={() => setViewingReview(r)}
                            title="View All Reviews"
                          >
                            <Eye size={15} />
                          </button>
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

      {/* View All Reviews Modal */}
      <ViewWebReviewsModal
        isOpen={Boolean(viewingReview)}
        onClose={() => setViewingReview(null)}
        reviewData={viewingReview}
        onEditReview={(r) => {
          setViewingReview(null);
          setEditingReview(r);
          setIsAddReviewModalOpen(true);
        }}
      />

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
