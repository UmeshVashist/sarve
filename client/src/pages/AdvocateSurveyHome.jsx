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
import AdvocateTypesModal from '../components/AdvocateTypesModal';
import AdvocateSurveyDetailModal from '../components/AdvocateSurveyDetailModal';
import EditAdvocateSurveyModal from '../components/EditAdvocateSurveyModal';
import ManageAdvocateQuestionsModal from '../components/ManageAdvocateQuestionsModal';
import { ADVOCATE_SURVEY_QUESTIONS, getAdvocateQuestionLabel, DEFAULT_ADVOCATE_TYPES } from '../data/advocateQuestions';
import { API_BASE_URL } from '../config';
import { downloadAdvocateExcel, resolveAdvocateAnswer } from '../utils/exportAdvocateExcel';

import { DEFAULT_COURT_TYPES } from '../data/courtTypes';

export default function AdvocateSurveyHome({ onBackToDashboard }) {
  const [surveys, setSurveys] = useState([]);
  const [courtTypes, setCourtTypes] = useState(DEFAULT_COURT_TYPES);
  const [advocateTypes, setAdvocateTypes] = useState(() => {
    try {
      const saved = localStorage.getItem('advocate_types_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_ADVOCATE_TYPES;
  });
  const [questions, setQuestions] = useState(() => {
    let remarkMap = {};
    try {
      const parsed = JSON.parse(localStorage.getItem('advocate_questions_remarks_map') || '{}');
      if (parsed && typeof parsed === 'object') remarkMap = parsed;
    } catch (e) {}

    let initial = ADVOCATE_SURVEY_QUESTIONS;
    try {
      const saved = localStorage.getItem('advocate_questions_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initial = parsed;
        }
      }
    } catch (e) {}

    const safeList = Array.isArray(initial) ? initial.filter(Boolean) : ADVOCATE_SURVEY_QUESTIONS;
    return [...safeList]
      .sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0))
      .map((q) => {
        const qKey = q?.key || `custom_${q?.id}`;
        const hasRemark = remarkMap[qKey] !== undefined
          ? Boolean(remarkMap[qKey])
          : (remarkMap[q?.id] !== undefined ? Boolean(remarkMap[q?.id]) : Boolean(q?.has_remark));
        return {
          ...q,
          has_remark: hasRemark
        };
      });
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isCourtTypesOpen, setIsCourtTypesOpen] = useState(false);
  const [isAdvocateTypesOpen, setIsAdvocateTypesOpen] = useState(false);
  const [isQuestionsOpen, setIsQuestionsOpen] = useState(false);
  const [selectedSurveyForDetail, setSelectedSurveyForDetail] = useState(null);
  const [selectedSurveyForEdit, setSelectedSurveyForEdit] = useState(null);

  const handleQuestionsChange = (newQuestionsList) => {
    if (!Array.isArray(newQuestionsList)) return;
    let remarkMap = {};
    try {
      const parsed = JSON.parse(localStorage.getItem('advocate_questions_remarks_map') || '{}');
      if (parsed && typeof parsed === 'object') remarkMap = parsed;
    } catch (e) {}

    const safeList = newQuestionsList.filter(Boolean);
    const sorted = [...safeList]
      .sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0))
      .map((q) => {
        const qKey = q?.key || `custom_${q?.id}`;
        const hasRemark = remarkMap[qKey] !== undefined
          ? Boolean(remarkMap[qKey])
          : (remarkMap[q?.id] !== undefined ? Boolean(remarkMap[q?.id]) : Boolean(q?.has_remark));
        return {
          ...q,
          has_remark: hasRemark
        };
      });

    setQuestions(sorted);
    try {
      localStorage.setItem('advocate_questions_list', JSON.stringify(sorted));
    } catch (e) {}
  };

  useEffect(() => {
    fetchSurveys();
    fetchCourtTypes();
    fetchAdvocateTypes();
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
      if (data.success && Array.isArray(data.data)) {
        const serverNames = new Set(data.data.map((c) => (typeof c === 'string' ? c : c?.name).trim().toLowerCase()));
        const missingDefaults = DEFAULT_COURT_TYPES.filter(
          (def) => !serverNames.has(def.name.trim().toLowerCase())
        );
        setCourtTypes([...data.data, ...missingDefaults]);
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

  const fetchAdvocateTypes = async () => {
    let localList = [];
    try {
      const saved = localStorage.getItem('advocate_types_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localList = parsed;
        }
      }
    } catch (e) {}

    try {
      const res = await fetch(`${API_BASE_URL}/api/advocate-types`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const serverNames = new Set(data.data.map((t) => (typeof t === 'string' ? t : t?.name).trim().toLowerCase()));
          const missingDefaults = DEFAULT_ADVOCATE_TYPES.filter(
            (def) => !serverNames.has(def.name.trim().toLowerCase())
          );
          const combined = [...data.data, ...missingDefaults];
          setAdvocateTypes(combined);
          try {
            localStorage.setItem('advocate_types_list', JSON.stringify(combined));
          } catch (e) {}
          return;
        }
      }
    } catch (err) {
      console.warn('Backend advocate-types API not reached:', err);
    }

    if (localList.length > 0) {
      setAdvocateTypes(localList);
    } else {
      setAdvocateTypes(DEFAULT_ADVOCATE_TYPES);
    }
  };

  const handleAddAdvocateType = async (typeName) => {
    const cleanName = String(typeName || '').trim();
    if (!cleanName) return { success: false, message: 'Type name cannot be empty' };

    const exists = advocateTypes.some((t) => {
      const name = typeof t === 'string' ? t : (t?.name || '');
      return name.trim().toLowerCase() === cleanName.toLowerCase();
    });
    if (exists) {
      return { success: false, message: `Advocate Type "${cleanName}" already exists!` };
    }

    const newId = 'at_' + Date.now();
    const newItem = { id: newId, name: cleanName };

    // 1. Immediately update local state & localStorage
    const updated = [...advocateTypes, newItem];
    setAdvocateTypes(updated);
    try {
      localStorage.setItem('advocate_types_list', JSON.stringify(updated));
    } catch (e) {}

    // 2. Background server sync
    try {
      const res = await fetch(`${API_BASE_URL}/api/advocate-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setAdvocateTypes((prev) =>
            prev.map((item) => (item.id === newId ? data.data : item))
          );
        }
      }
    } catch (err) {
      console.warn('Backend sync not available, saved locally:', err);
    }

    return { success: true, data: newItem };
  };

  const handleEditAdvocateType = async (id, name) => {
    const cleanName = String(name || '').trim();
    if (!cleanName) return { success: false, message: 'Type name cannot be empty' };

    // 1. Immediately update local state & localStorage
    const updated = advocateTypes.map((t) => {
      const tId = typeof t === 'string' ? t : (t?.id || t?.name);
      const tName = typeof t === 'string' ? t : (t?.name || '');
      if (tId === id || tName === id || String(tId) === String(id) || tName.toLowerCase() === String(id).toLowerCase()) {
        return typeof t === 'string' ? cleanName : { ...t, name: cleanName };
      }
      return t;
    });
    setAdvocateTypes(updated);
    try {
      localStorage.setItem('advocate_types_list', JSON.stringify(updated));
    } catch (e) {}

    // 2. Background server sync
    try {
      await fetch(`${API_BASE_URL}/api/advocate-types/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName })
      });
    } catch (err) {
      console.warn('Backend sync not available, updated locally:', err);
    }

    return { success: true };
  };

  const handleDeleteAdvocateType = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete advocate type "${name}"?`)) return;

    // 1. Immediately update local state & localStorage
    const updated = advocateTypes.filter((t) => {
      const tId = typeof t === 'string' ? t : (t?.id || t?.name);
      const tName = typeof t === 'string' ? t : (t?.name || '');
      return tId !== id && tName !== name && String(tId) !== String(id);
    });
    setAdvocateTypes(updated);
    try {
      localStorage.setItem('advocate_types_list', JSON.stringify(updated));
    } catch (e) {}

    // 2. Background server sync
    try {
      await fetch(`${API_BASE_URL}/api/advocate-types/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('Backend sync not available, deleted locally:', err);
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
  const criminalSpecialistsCount = validSurveys.filter((s) => {
    const spec = Array.isArray(s?.case_specialization)
      ? s.case_specialization.join(', ')
      : String(s?.case_specialization || '');
    return spec.toLowerCase().includes('criminal');
  }).length;

  const legalAidCount = validSurveys.filter((s) => {
    const aid = String(s?.provides_legal_aid_dlsa || '').toLowerCase();
    return aid === 'yes';
  }).length;

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
              fetchAdvocateTypes();
              fetchQuestions();
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
            <div className="stat-label">Total Advocates</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <Briefcase size={22} />
          </div>
          <div>
            <div className="stat-value">{criminalSpecialistsCount}</div>
            <div className="stat-label">Criminal Defense</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Scale size={22} />
          </div>
          <div>
            <div className="stat-value">{legalAidCount}</div>
            <div className="stat-label">Legal Aid / DLSA</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <Award size={22} />
          </div>
          <div>
            <div className="stat-value">{highExpCount}</div>
            <div className="stat-label">10+ Yrs Practice</div>
          </div>
        </div>
      </div>

      {/* Actions and Search Bar */}
      <div className="survey-action-bar">
        <div className="action-buttons-group">
          <button
            className="btn-add-data"
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
            className="btn-case-types"
            style={{ background: '#F0FDF4', borderColor: '#86EFAC', color: '#16A34A' }}
            onClick={() => setIsAdvocateTypesOpen(true)}
            title="Manage dynamic advocate types"
          >
            <Briefcase size={17} />
            <span>Manage Advocate Types ({advocateTypes.length})</span>
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

        <div className="table-responsive">
          <table className="survey-table sarve-table">
            <thead>
              <tr>
                <th style={{ width: '55px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '150px' }}>Bar / Reg No.</th>
                <th style={{ minWidth: '170px' }}>Advocate Name</th>
                <th style={{ minWidth: '130px' }}>Contact No.</th>
                <th style={{ minWidth: '150px' }}>Primary Court</th>
                <th style={{ minWidth: '110px' }}>Experience</th>
                <th style={{ minWidth: '190px' }}>Specialization</th>
                <th style={{ minWidth: '120px' }}>Survey Date</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#64748B' }}>
                      <RefreshCw size={18} className="animate-spin" style={{ color: '#EA580C' }} />
                      <span>Loading advocate survey records...</span>
                    </div>
                  </td>
                </tr>
              ) : surveys.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state-box">
                      <div className="empty-icon" style={{ background: '#FFF7ED', color: '#EA580C' }}>
                        <Scale size={32} />
                      </div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>
                        {searchQuery ? `No advocate records match "${searchQuery}"` : 'No Advocate Survey Records Found'}
                      </h3>
                      <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0 }}>
                        Click <strong>"+ Add Data"</strong> button to conduct your first advocate questionnaire.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                surveys.map((survey, index) => (
                  <tr key={survey.id || index}>
                    <td style={{ fontWeight: 600, color: '#64748B', textAlign: 'center' }}>{index + 1}</td>
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
                      {Array.isArray(survey.case_specialization) ? survey.case_specialization.join(', ') : (survey.case_specialization || '—')}
                    </td>
                    <td style={{ color: '#64748B', fontSize: '12.5px' }}>
                      {survey.created_at ? new Date(survey.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="table-actions" style={{ justifyContent: 'center' }}>
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
        advocateTypes={advocateTypes}
        onAddAdvocateType={handleAddAdvocateType}
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

      {/* Advocate Types Modal */}
      <AdvocateTypesModal
        isOpen={isAdvocateTypesOpen}
        onClose={() => setIsAdvocateTypesOpen(false)}
        advocateTypes={advocateTypes}
        onAddAdvocateType={handleAddAdvocateType}
        onEditAdvocateType={handleEditAdvocateType}
        onDeleteAdvocateType={handleDeleteAdvocateType}
      />

      {/* Manage Advocate Questions Modal */}
      <ManageAdvocateQuestionsModal
        isOpen={isQuestionsOpen}
        onClose={() => setIsQuestionsOpen(false)}
        questions={questions}
        advocateTypes={advocateTypes}
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
        advocateTypes={advocateTypes}
        onAddAdvocateType={handleAddAdvocateType}
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
