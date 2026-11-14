import React, { useState, useEffect } from 'react';
import {
  Plus,
  Download,
  Search,
  Tag,
  ArrowLeft,
  FileSpreadsheet,
  Users,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  X,
  Scale,
  CreditCard,
  Clock
} from 'lucide-react';
import SurveyWizard from '../components/SurveyWizard';
import CaseTypesModal from '../components/CaseTypesModal';
import SurveyDetailModal from '../components/SurveyDetailModal';
import EditSurveyModal from '../components/EditSurveyModal';
import { API_BASE_URL } from '../config';
import { downloadSurveyExcel } from '../utils/exportExcel';

export const DEFAULT_CASE_TYPES = [
  { id: 1, name: 'Murder (IPC 302)' },
  { id: 2, name: 'Theft & Burglary (IPC 379/380)' },
  { id: 3, name: 'Robbery / Dacoity (IPC 392/395)' },
  { id: 4, name: 'Bail Application' },
  { id: 5, name: 'NDPS Act (Narcotics)' },
  { id: 6, name: 'Cheating & Fraud (IPC 420)' },
  { id: 7, name: 'Cyber Crime' },
  { id: 8, name: 'Assault / Attempt to Murder (IPC 307)' },
  { id: 9, name: 'Matrimonial / Dowry (IPC 498A)' },
  { id: 10, name: 'Arms Act' },
  { id: 11, name: 'Economic Offence' },
  { id: 12, name: 'Other' }
];

export default function PrisonerSurveyHome({ onBackToDashboard }) {
  const [surveys, setSurveys] = useState([]);
  const [caseTypes, setCaseTypes] = useState(DEFAULT_CASE_TYPES);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isCaseTypesOpen, setIsCaseTypesOpen] = useState(false);
  const [selectedSurveyForDetail, setSelectedSurveyForDetail] = useState(null);
  const [selectedSurveyForEdit, setSelectedSurveyForEdit] = useState(null);

  // Fetch surveys and case types on mount
  useEffect(() => {
    fetchSurveys();
    fetchCaseTypes();
  }, []);

  const fetchSurveys = async (query = '') => {
    setLoading(true);
    try {
      const url = query
        ? `${API_BASE_URL}/api/survey/list?q=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/api/survey/list`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setSurveys(data.data);
      }
    } catch (err) {
      console.error('Failed to load surveys:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCaseTypes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/case-types`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setCaseTypes(data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch case types from server:', err);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    fetchSurveys(val);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    fetchSurveys('');
  };

  const handleAddCaseType = async (typeName) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/case-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: typeName })
      });
      const data = await res.json();
      if (data.success) {
        fetchCaseTypes();
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const handleDeleteCaseType = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete case type "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/case-types/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchCaseTypes();
      }
    } catch (err) {
      alert('Failed to delete case type');
    }
  };

  const handleDeleteSurvey = async (survey) => {
    if (!window.confirm(`Delete survey record for UT/CT No: ${survey.utct_no} (${survey.name})?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/survey/${survey.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setSurveys((prev) => prev.filter((s) => s.id !== survey.id));
      } else {
        alert(data.message || 'Failed to delete survey');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  };

  const handleDownloadExcel = () => {
    if (!surveys || surveys.length === 0) {
      alert('Abhi database me koi survey record nahi hai! Add Data button se survey add kare.');
      return;
    }
    const filename = searchQuery
      ? `Prisoner_Survey_Filtered_${searchQuery.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
      : 'Prisoner_Survey_Report.xlsx';
    downloadSurveyExcel(surveys, filename);
  };

  // Quick stats calculations (Completely safe against null/undefined records)
  const validSurveys = Array.isArray(surveys) ? surveys.filter((s) => s && typeof s === 'object') : [];
  const totalCount = validSurveys.length;
  const highCourtCount = validSurveys.filter((s) => (s?.high_court_advocate || '').toLowerCase() === 'yes').length;
  const advancePaymentCount = validSurveys.filter((s) => (s?.advocate_payment_advance || '').toLowerCase().startsWith('yes')).length;
  const releasePriorityCount = validSurveys.filter((s) => (s?.priority_money_vs_release || '').toLowerCase().includes('jail')).length;

  return (
    <div className="survey-page-container animate-fade-in">
      {/* Top Nav */}
      <div className="page-top-nav">
        <button className="btn-back-nav" onClick={onBackToDashboard}>
          <ArrowLeft size={16} />
          <span>Back to All Survey Options</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn-back-nav"
            onClick={() => {
              setRefreshing(true);
              fetchSurveys(searchQuery);
              fetchCaseTypes();
            }}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Banner */}
      <div className="stats-banner">
        <div className="stat-card">
          <div className="stat-icon orange">
            <Users size={22} />
          </div>
          <div>
            <div className="stat-value">{totalCount}</div>
            <div className="stat-label">Total Prisoner Surveys</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Scale size={22} />
          </div>
          <div>
            <div className="stat-value">{highCourtCount}</div>
            <div className="stat-label">High Court Advocate Cases</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CreditCard size={22} />
          </div>
          <div>
            <div className="stat-value">{advancePaymentCount}</div>
            <div className="stat-label">Paid Advance Legal Fees</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Clock size={22} />
          </div>
          <div>
            <div className="stat-value">{releasePriorityCount}</div>
            <div className="stat-label">Priority: Quick Jail Release</div>
          </div>
        </div>
      </div>

      {/* Actions and Search Bar */}
      <div className="survey-action-bar">
        {/* Buttons Group */}
        <div className="action-buttons-group">
          <button className="btn-add-data" onClick={() => setIsWizardOpen(true)}>
            <Plus size={18} />
            <span>+ Add Data</span>
          </button>

          <button className="btn-download-excel" onClick={handleDownloadExcel} title="Download Complete Excel Sheet with Question Headers">
            <Download size={18} />
            <span>Download Excel</span>
          </button>

          <button
            className="btn-case-types"
            onClick={() => setIsCaseTypesOpen(true)}
            title="Manage dynamic case types for Question 3"
          >
            <Tag size={17} />
            <span>Manage Case Types ({caseTypes.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by UT/CT No, Prisoner Name, Case Type..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={handleClearSearch} title="Clear search">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="table-card">
        <div className="table-header-title">
          <div className="table-title">
            <FileSpreadsheet size={18} color="#EA580C" />
            <span>Prisoner Survey Records</span>
            <span className="table-badge">{surveys.length} Records</span>
          </div>

          {searchQuery && (
            <div style={{ fontSize: '13px', color: '#475569' }}>
              Filtered by: <strong>"{searchQuery}"</strong>
            </div>
          )}
        </div>

        <div className="table-responsive">
          <table className="sarve-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>UT/CT No.</th>
                <th>Prisoner Name</th>
                <th>Case Type</th>
                <th>Total Cases</th>
                <th>Advance Payment</th>
                <th>High Court Adv.</th>
                <th>Priority</th>
                <th>Survey Date</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#64748B' }}>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Loading prisoner surveys...</span>
                    </div>
                  </td>
                </tr>
              ) : surveys.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state-box">
                      <div className="empty-icon">
                        <Users size={32} />
                      </div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                        No Prisoner Surveys Found
                      </h3>
                      <p style={{ fontSize: '13.5px', color: '#64748B', marginBottom: '18px' }}>
                        {searchQuery
                          ? `No records match your search query "${searchQuery}".`
                          : 'Get started by clicking "+ Add Data" to launch the questionnaire wizard.'}
                      </p>
                      <button className="btn-add-data" style={{ margin: '0 auto' }} onClick={() => setIsWizardOpen(true)}>
                        <Plus size={16} />
                        <span>Add First Prisoner Survey</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                validSurveys.map((survey, index) => {
                  const caseTypeArr = survey?.case_type ? survey.case_type.split(', ') : [];
                  const advPaymentLower = (survey?.advocate_payment_advance || '').toLowerCase();
                  const highCourtLower = (survey?.high_court_advocate || '').toLowerCase();

                  return (
                    <tr key={survey?.id || index}>
                      <td style={{ fontWeight: 600, color: '#64748B' }}>{index + 1}</td>
                      <td>
                        <span className="badge-utct">{survey?.utct_no}</span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#0F172A' }}>{survey?.name}</td>
                      <td>
                        <div style={{ maxWidth: '280px', display: 'flex', flexWrap: 'wrap' }}>
                          {caseTypeArr.length > 0 ? (
                            caseTypeArr.slice(0, 2).map((ct, i) => (
                              <span key={i} className="tag-case-type">
                                {ct}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#94A3B8' }}>-</span>
                          )}
                          {caseTypeArr.length > 2 && (
                            <span className="tag-case-type" style={{ background: '#F1F5F9', color: '#475569' }}>
                              +{caseTypeArr.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{survey.total_cases ?? '-'}</td>
                      <td>
                        {advPaymentLower.startsWith('yes') ? (
                          <span className="pill-yes">{survey.advocate_payment_advance}</span>
                        ) : advPaymentLower === 'no' ? (
                          <span className="pill-no">No</span>
                        ) : (
                          <span>{survey.advocate_payment_advance || '-'}</span>
                        )}
                      </td>
                      <td>
                        {highCourtLower === 'yes' ? (
                          <span className="pill-yes">Yes</span>
                        ) : highCourtLower === 'no' ? (
                          <span className="pill-no">No</span>
                        ) : (
                          <span>{survey.high_court_advocate || '-'}</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '12.5px', color: '#334155' }}>
                          {survey.priority_money_vs_release || '-'}
                        </span>
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#64748B' }}>
                        {survey.created_at ? new Date(survey.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn-action-icon view"
                            onClick={() => setSelectedSurveyForDetail(survey)}
                            title="View Full 24 Question Survey"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-action-icon edit"
                            onClick={() => setSelectedSurveyForEdit(survey)}
                            title="Edit Survey Record"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-action-icon delete"
                            onClick={() => handleDeleteSurvey(survey)}
                            title="Delete Survey"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Step-by-Step Survey Wizard */}
      <SurveyWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        caseTypes={caseTypes}
        onCaseTypeAdded={fetchCaseTypes}
        onSurveySaved={(newSurvey) => {
          if (newSurvey && typeof newSurvey === 'object') {
            setSurveys((prev) => [newSurvey, ...(prev || []).filter(Boolean)]);
          }
          fetchSurveys();
        }}
      />

      {/* Manage Case Types Modal */}
      <CaseTypesModal
        isOpen={isCaseTypesOpen}
        onClose={() => setIsCaseTypesOpen(false)}
        caseTypes={caseTypes}
        onAddCaseType={handleAddCaseType}
        onDeleteCaseType={handleDeleteCaseType}
      />

      {/* View Survey Detail Modal */}
      <SurveyDetailModal
        isOpen={!!selectedSurveyForDetail}
        onClose={() => setSelectedSurveyForDetail(null)}
        survey={selectedSurveyForDetail}
      />

      {/* Edit Survey Modal */}
      <EditSurveyModal
        isOpen={!!selectedSurveyForEdit}
        onClose={() => setSelectedSurveyForEdit(null)}
        survey={selectedSurveyForEdit}
        caseTypes={caseTypes}
        onSurveyUpdated={(updated) => {
          setSurveys((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        }}
      />
    </div>
  );
}

