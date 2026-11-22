import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Globe, Search, ExternalLink } from 'lucide-react';

export default function AddWebReviewModal({
  isOpen,
  onClose,
  urls = [],
  onOpenManageUrls,
  onSaveReview,
  initialData = null
}) {
  const [selectedUrlId, setSelectedUrlId] = useState(null);
  const [websiteName, setWebsiteName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteSearch, setWebsiteSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [reviews, setReviews] = useState(['']);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const searchInputRef = useRef(null);
  const reviewInputsRef = useRef([]);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSubmitting(false);
      if (initialData) {
        setSelectedUrlId(initialData.url_id || null);
        setWebsiteName(initialData.website_name || '');
        setWebsiteUrl(initialData.url || '');
        setWebsiteSearch(initialData.website_name || '');
        const revs = Array.isArray(initialData.reviews) && initialData.reviews.length > 0 ? initialData.reviews : [''];
        setReviews(revs);
      } else {
        setSelectedUrlId(null);
        setWebsiteName('');
        setWebsiteUrl('');
        setWebsiteSearch('');
        setReviews(['']);
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const filteredUrls = (urls || []).filter((u) => {
    const q = websiteSearch.trim().toLowerCase();
    if (!q) return true;
    return (u.name || '').toLowerCase().includes(q) || (u.url || '').toLowerCase().includes(q);
  });

  const handleSelectWebsite = (u) => {
    setSelectedUrlId(u.id);
    setWebsiteName(u.name);
    setWebsiteUrl(u.url);
    setWebsiteSearch(u.name);
    setShowSearchDropdown(false);
    setError('');
    // Automatically focus first review input
    setTimeout(() => {
      reviewInputsRef.current[0]?.focus();
    }, 100);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredUrls.length > 0) {
        handleSelectWebsite(filteredUrls[0]);
      } else if (websiteSearch.trim()) {
        // Allow freeform name
        setWebsiteName(websiteSearch.trim());
        setShowSearchDropdown(false);
        setTimeout(() => {
          reviewInputsRef.current[0]?.focus();
        }, 100);
      }
    } else if (e.key === 'ArrowDown') {
      setShowSearchDropdown(true);
    }
  };

  const handleReviewChange = (index, val) => {
    setError('');
    setReviews((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleAddReviewInput = () => {
    setReviews((prev) => [...prev, '']);
    setTimeout(() => {
      const newIdx = reviews.length;
      reviewInputsRef.current[newIdx]?.focus();
    }, 60);
  };

  const handleRemoveReviewInput = (index) => {
    if (reviews.length <= 1) return;
    setReviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReviewKeyDown = (index, e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If pressing Enter on the last input, append a new review input!
      if (index === reviews.length - 1) {
        handleAddReviewInput();
      } else {
        // Move to the next input
        reviewInputsRef.current[index + 1]?.focus();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!websiteName.trim()) {
      setError('Please select or enter a Website Name');
      searchInputRef.current?.focus();
      return;
    }
    const validReviews = reviews.map((r) => r.trim()).filter(Boolean);
    if (validReviews.length === 0) {
      setError('Please enter at least one review');
      reviewInputsRef.current[0]?.focus();
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const payload = {
        url_id: selectedUrlId,
        website_name: websiteName.trim(),
        url: websiteUrl.trim(),
        reviews: validReviews
      };
      const res = await onSaveReview(payload, initialData?.id);
      if (res && res.success === false) {
        setError(res.message || 'Failed to save review');
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Error saving review');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={20} color="#15803D" />
            <span>{initialData ? 'Edit Web Review' : 'Add Web Review Data'}</span>
          </div>
          <button className="wizard-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div className="wizard-error-banner">
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Website Search & Selection */}
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
                  1) Search Website Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                {onOpenManageUrls && (
                  <button
                    type="button"
                    onClick={onOpenManageUrls}
                    style={{ background: 'none', border: 'none', color: '#15803D', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={13} /> Manage / Add URLs
                  </button>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '36px' }}
                  placeholder="Type to search website name (e.g. e-Courts, Google, High Court)..."
                  value={websiteSearch}
                  onChange={(e) => {
                    setWebsiteSearch(e.target.value);
                    setWebsiteName(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  onKeyDown={handleSearchKeyDown}
                />
                <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>

              {/* Suggestions Dropdown */}
              {showSearchDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  background: '#FFFFFF',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  border: '1px solid #CBD5E1',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  marginTop: '4px'
                }}>
                  {filteredUrls.length === 0 ? (
                    <div style={{ padding: '12px', fontSize: '12.5px', color: '#94A3B8', textAlign: 'center' }}>
                      No matching websites. Press Enter to use "{websiteSearch.trim()}".
                    </div>
                  ) : (
                    filteredUrls.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => handleSelectWebsite(u)}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#F0FDF4')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontWeight: 600, fontSize: '13px', color: '#0F172A' }}>{u.name}</span>
                        <span style={{ fontSize: '11.5px', color: '#64748B' }}>{u.url}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* URL Preview / Edit field */}
              {websiteName && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Website URL (e.g. https://example.com)"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    style={{ fontSize: '12.5px', padding: '6px 10px' }}
                  />
                  {websiteUrl && (
                    <a
                      href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#2563EB', padding: '6px', display: 'inline-flex', alignItems: 'center' }}
                      title="Open website URL"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Dynamic Review Inputs */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>
                  2) Review Inputs ({reviews.length})
                </label>
                <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                  Press <kbd style={{ background: '#E2E8F0', padding: '2px 5px', borderRadius: '4px' }}>Tab</kbd> then <kbd style={{ background: '#E2E8F0', padding: '2px 5px', borderRadius: '4px' }}>Enter</kbd> or click <strong>+</strong> on last input to add more
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                {reviews.map((rev, index) => {
                  const isLast = index === reviews.length - 1;
                  return (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#15803D', minWidth: '100px' }}>
                        Review Input {index + 1}:
                      </span>
                      <input
                        ref={(el) => (reviewInputsRef.current[index] = el)}
                        type="text"
                        className="form-control"
                        placeholder={`Enter review comment #${index + 1}...`}
                        value={rev}
                        onChange={(e) => handleReviewChange(index, e.target.value)}
                        onKeyDown={(e) => handleReviewKeyDown(index, e)}
                        style={{ flex: 1 }}
                      />

                      {/* Delete icon (if more than 1 input) */}
                      {reviews.length > 1 && (
                        <button
                          type="button"
                          className="btn-delete-case-type"
                          onClick={() => handleRemoveReviewInput(index)}
                          title={`Delete Review Input ${index + 1}`}
                          style={{ padding: '6px', flexShrink: 0 }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}

                      {/* Plus icon (ONLY on the very last input) */}
                      {isLast && (
                        <button
                          type="button"
                          onClick={handleAddReviewInput}
                          title="Add next review input (or press Tab then Enter)"
                          style={{
                            background: '#15803D',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 2px 4px rgba(21, 128, 61, 0.25)',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Plus size={18} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
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
              disabled={submitting || !websiteName.trim()}
              style={{ background: '#15803D', color: '#fff' }}
            >
              {submitting ? 'Saving...' : (initialData ? 'Update Review' : 'Save Review Data')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
