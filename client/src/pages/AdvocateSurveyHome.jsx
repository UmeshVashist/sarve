import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Download,
  Search,
  ArrowLeft,
  FileSpreadsheet,
  Users,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  X,
  Scale,
  Briefcase,
  Award,
  HelpCircle
} from 'lucide-react';
import AdvocateSurveyWizard from '../components/AdvocateSurveyWizard';
import CourtTypesModal from '../components/CourtTypesModal';
import AdvocateSurveyDetailModal from '../components/AdvocateSurveyDetailModal';
import EditAdvocateSurveyModal from '../components/EditAdvocateSurveyModal';
import ManageAdvocateQuestionsModal from '../components/ManageAdvocateQuestionsModal';
import { ADVOCATE_SURVEY_QUESTIONS, getAdvocateQuestionLabel } from '../data/advocateQuestions';
import { API_BASE_URL } from '../config';
import { downloadAdvocateExcel, resolveAdvocateAnswer } from '../utils/exportAdvocateExcel';

import { DEFAULT_COURT_TYPES } from './PrisonerSurveyHome';

export default function AdvocateSurveyHome({ onBackToDashboard }) {
  const [surveys, setSurveys] = useState([]);
  const [courtTypes, setCourtTypes] = useState(DEFAULT_COURT_TYPES);
  const [questions, setQuestions] = useState(() => {
    try {
      const saved = localStorage.getItem('advocate_questions_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...parsed].sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0));
        }
      }
    } catch (e) {}
    return ADVOCATE_SURVEY_QUESTIONS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isCourtTypesOpen, setIsCourtTypesOpen] = useState(false);
  const [isQuestionsOpen, setIsQuestionsOpen] = useState(false);
  const [selectedSurveyForDetail, setSelectedSurveyForDetail] = useState(null);
  const [selectedSurveyForEdit, setSelectedSurveyForEdit] = useState(null);

  const handleQuestionsChange = (newQuestionsList) => {
    if (!Array.isArray(newQuestionsList)) return;
    const sorted = [...newQuestionsList].sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0));
    setQuestions(sorted);
    try {
      localStorage.setItem('advocate_questions_list', JSON.stringify(sorted));
    } catch (e) {}
  };

  useEffect(() => {
    fetchSurveys();
    fetchCourtTypes();
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/advocate-questions`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        handleQuestionsChange(data.data);
      }
    } catch (err) {
      console.warn('Failed to load advocate questions from server:', err);
    }
  };

  const fetchSurveys = async (query = '') => {
    setLoading(true);
    try {
      const url = query
        ? `${API_BASE_URL}/api/advocate-survey/list?q=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/api/advocate-survey/list`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        let localMap = {};
        try {
          localMap = JSON.parse(localStorage.getItem('local_advocate_survey_answers_map') || '{}');
        } catch (e) {}

        const merged = (data.data || []).filter(Boolean).map((s) => {
          const regKey = String(s.advocate_reg_no || s.id || '').trim().toLowerCase();
          const cached = localMap[regKey] || {};
          let serverCustom = {};
          if (s.custom_answers) {
            try {
              serverCustom = typeof s.custom_answers === 'string' ? JSON.parse(s.custom_answers) : s.custom_answers;
            } catch (e) {}
          }
          return {
            ...cached,
            ...s,
            ...serverCustom
          };
        });
        setSurveys(merged);
      }
    } catch (err) {
      console.error('Failed to load advocate surveys:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCourtTypes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/court-types`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setCourtTypes(data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch court types:', err);
    }
  };

  const handleAddCourtType = async (typeName) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/court-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: typeName })
      });
      const data = await res.json();
      if (data.success) {
        fetchCourtTypes();
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const handleEditCourtType = async (id, name) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/court-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        fetchCourtTypes();
      }
      return data;
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const handleDeleteCourtType = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete court type "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/court-types/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchCourtTypes();
      }
    } catch (err) {
      alert('Failed to delete court type');
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

  const handleDeleteSurvey = async (survey) => {
    if (!window.confirm(`Are you sure you want to delete survey record of Advocate: "${survey.name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/advocate-survey/${survey.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSurveys((prev) => prev.filter((s) => s.id !== survey.id));
      } else {
        alert(data.message || 'Failed to delete record');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  };

  const handleDownloadExcel = () => {
    if (!surveys || surveys.length === 0) {
      alert('Database me koi advocate survey record nahi hai! Add Data button se survey add kare.');
      return;
    }
    const filename = searchQuery
      ? `Advocate_Survey_Filtered_${searchQuery.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
      : 'Advocate_Survey_Report.xlsx';
    downloadAdvocateExcel(surveys, filename, questions);
  };

  // Quick stats
  const validSurveys = Array.isArray(surveys) ? surveys.filter((s) => s && typeof s === 'object') : [];
  const totalCount = validSurveys.length;
  const criminalSpecialistsCount = validSurveys.filter((s) => (s?.case_specialization || '').toLowerCase().includes('criminal')).length;
  const legalAidCount = validSurveys.filter((s) => (s?.provides_legal_aid_dlsa || '').toLowerCase() === 'yes').length;
  const highExpCount = validSurveys.filter((s) => Number(s?.practice_experience_years || 0) >= 10).length;

  return (
    <div className="survey-page-container animate-fade-in">
      {/* Top Navigation */}
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
              fetchCourtTypes();
              fetchQuestions();
            }}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stat Cards Banner */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#FFF7ED', color: '#EA580C' }}>
            <Users size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Total Advocates</span>
            <span className="stat-value">{totalCount}</span>
            <span className="stat-sub">Registered surveys</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#EFF6FF', color: '#2563EB' }}>
            <Briefcase size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Criminal Defense</span>
            <span className="stat-value">{criminalSpecialistsCount}</span>
            <span className="stat-sub">Specialized lawyers</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#F0FDF4', color: '#16A34A' }}>
            <Scale size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Legal Aid / DLSA</span>
            <span className="stat-value">{legalAidCount}</span>
            <span className="stat-sub">Empanelled advocates</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: '#FAF5FF', color: '#9333EA' }}>
            <Award size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">10+ Yrs Practice</span>
            <span className="stat-value">{highExpCount}</span>
            <span className="stat-sub">Senior practitioners</span>
          </div>
        </div>
      </div>

      {/* Actions and Search Bar */}
      <div className="survey-action-bar">
        <div className="action-buttons-group">
          <button
            className="btn-add-data"
            style={{ background: '#EA580C', borderColor: '#EA580C' }}
            onClick={() => setIsWizardOpen(true)}
          >
            <Plus size={18} />
            <span>Add Data</span>
          </button>

          <button
            className="btn-download-excel"
            onClick={handleDownloadExcel}
            title="Download Complete Excel Sheet with all dynamic questions & answers"
          >
            <Download size={18} />
            <span>Download</span>
          </button>

          <button
            className="btn-case-types"
            style={{ background: '#FFF7ED', borderColor: '#FDBA74', color: '#EA580C' }}
            onClick={() => setIsCourtTypesOpen(true)}
            title="Manage dynamic court types"
          >
            <Scale size={17} />
            <span>Manage Court Types ({courtTypes.length})</span>
          </button>

          <button
            className="btn-manage-questions"
            onClick={() => setIsQuestionsOpen(true)}
            title="Add, edit, delete, and set numbering for advocate survey questions"
          >
            <HelpCircle size={17} />
            <span>Manage Questions ({questions.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by Bar Reg No, Advocate Name, Court, Contact..."
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

      {/* Records Table with Scrollbar */}
      <div className="table-card">
        <div className="table-header-title">
          <div className="table-title">
            <FileSpreadsheet size={18} color="#EA580C" />
            <span>Advocate Survey Records</span>
            <span className="table-badge">{surveys.length} Records</span>
          </div>

          {searchQuery && (
            <div style={{ fontSize: '13px', color: '#475569' }}>
              Filtered by: <strong>"{searchQuery}"</strong>
            </div>
          )}
        </div>

        <div className="table-responsive" style={{ maxHeight: '520px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>#</th>
                <th>BAR / REG NO.</th>
                <th>ADVOCATE NAME</th>
                <th>CONTACT NO.</th>
                <th>PRIMARY COURT</th>
                <th>EXPERIENCE</th>
                <th>SPECIALIZATION</th>
                <th>SURVEY DATE</th>
                <th style={{ textAlign: 'center', width: '120px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#EA580C' }} />
                    <div style={{ color: '#64748B', fontSize: '14px' }}>Loading advocate survey records...</div>
                  </td>
                </tr>
              ) : surveys.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <Scale size={42} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#334155' }}>
                      {searchQuery ? `No advocate records match "${searchQuery}"` : 'No Advocate Survey Records Found'}
                    </div>
                    <div style={{ fontSize: '13.5px', color: '#64748B', marginTop: '6px' }}>
                      Click <strong>"+ Add Data"</strong> button to conduct your first advocate questionnaire.
                    </div>
                  </td>
                </tr>
              ) : (
                surveys.map((survey, index) => (
                  <tr key={survey.id || index}>
                    <td style={{ fontWeight: 600, color: '#64748B' }}>{index + 1}</td>
                    <td>
                      <span className="badge-utct" style={{ background: '#1E293B' }}>
                        {survey.advocate_reg_no || 'N/A'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#0F172A' }}>{survey.name}</td>
                    <td style={{ color: '#475569' }}>{survey.contact_number || '—'}</td>
                    <td>
                      <span className="badge-case-type" style={{ background: '#FFF7ED', color: '#EA580C', border: '1px solid #FFEDD5' }}>
                        {survey.primary_court || 'Not specified'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#334155' }}>
                      {survey.practice_experience_years ? `${survey.practice_experience_years} Years` : '—'}
                    </td>
                    <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {survey.case_specialization || '—'}
                    </td>
                    <td style={{ color: '#64748B', fontSize: '12.5px' }}>
                      {survey.created_at ? new Date(survey.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-action-icon view"
                          onClick={() => setSelectedSurveyForDetail(survey)}
                          title="View Full Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-action-icon edit"
                          onClick={() => setSelectedSurveyForEdit(survey)}
                          title="Edit Survey"
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advocate Survey Wizard */}
      <AdvocateSurveyWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        courtTypes={courtTypes}
        questions={questions}
        onSurveySaved={(newSurvey) => {
          if (newSurvey && typeof newSurvey === 'object' && newSurvey.id) {
            setSurveys((prev) => [newSurvey, ...(prev || []).filter((s) => s && s.id !== newSurvey.id)]);
          }
          fetchSurveys();
        }}
      />

      {/* Court Types Modal */}
      <CourtTypesModal
        isOpen={isCourtTypesOpen}
        onClose={() => setIsCourtTypesOpen(false)}
        courtTypes={courtTypes}
        onAddCourtType={handleAddCourtType}
        onEditCourtType={handleEditCourtType}
        onDeleteCourtType={handleDeleteCourtType}
      />

      {/* Manage Advocate Questions Modal */}
      <ManageAdvocateQuestionsModal
        isOpen={isQuestionsOpen}
        onClose={() => setIsQuestionsOpen(false)}
        questions={questions}
        onUpdateQuestions={handleQuestionsChange}
        onQuestionsUpdated={fetchQuestions}
      />

      {/* View Detail Modal */}
      <AdvocateSurveyDetailModal
        isOpen={!!selectedSurveyForDetail}
        onClose={() => setSelectedSurveyForDetail(null)}
        survey={selectedSurveyForDetail}
        questions={questions}
      />

      {/* Edit Advocate Survey Modal */}
      <EditAdvocateSurveyModal
        isOpen={!!selectedSurveyForEdit}
        onClose={() => setSelectedSurveyForEdit(null)}
        survey={selectedSurveyForEdit}
        courtTypes={courtTypes}
        questions={questions}
        onSurveyUpdated={(updated) => {
          if (updated && updated.id) {
            setSurveys((prev) => {
              if (!Array.isArray(prev)) return [updated];
              return prev.filter(Boolean).map((s) => (s && s.id === updated.id ? { ...s, ...updated } : s));
            });
          }
          fetchSurveys();
        }}
      />
    </div>
  );
}
