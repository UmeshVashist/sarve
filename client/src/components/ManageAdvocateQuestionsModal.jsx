import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  Save,
  RotateCcw,
  Check,
  AlertCircle
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { getAdvocateQuestionLabel, ADVOCATE_SURVEY_QUESTIONS } from '../data/advocateQuestions';

export default function ManageAdvocateQuestionsModal({
  isOpen,
  onClose,
  questions = [],
  onUpdateQuestions,
  onQuestionsUpdated
}) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'add' | 'edit'
  const [editingQuestion, setEditingQuestion] = useState(null);

  const [formData, setFormData] = useState({
    order_num: '',
    label: '',
    placeholder: '',
    type: 'text',
    optionsText: '',
    note: '',
    required: false,
    has_remark: false
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0));
  }, [questions]);

  if (!isOpen) return null;

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const applyQuestionsUpdate = (newList, message = '') => {
    const sorted = [...newList].sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0));
    if (onUpdateQuestions) {
      onUpdateQuestions(sorted);
    }
    try {
      localStorage.setItem('advocate_questions_list', JSON.stringify(sorted));
    } catch (e) {}

    if (message) {
      showSuccess(message);
    }
  };

  const handleStartAdd = () => {
    const nextOrder = sortedQuestions.length > 0
      ? Math.max(...sortedQuestions.map((q) => Number(q.order_num) || 0)) + 1
      : 1;

    setEditingQuestion(null);
    setFormData({
      order_num: nextOrder,
      label: '',
      placeholder: '',
      type: 'text',
      optionsText: '',
      note: '',
      required: false,
      has_remark: false
    });
    setError('');
    setActiveTab('add');
  };

  const handleStartEdit = (q) => {
    setEditingQuestion(q);
    const cleanLabel = (q.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();

    let remarkMap = {};
    try {
      remarkMap = JSON.parse(localStorage.getItem('advocate_questions_remarks_map') || '{}');
    } catch (e) {}

    const hasRemarkVal = (q.has_remark !== undefined && q.has_remark !== null)
      ? Boolean(q.has_remark)
      : Boolean(remarkMap[q.key] ?? remarkMap[q.id]);

    setFormData({
      order_num: q.order_num ?? '',
      label: cleanLabel,
      placeholder: q.placeholder || '',
      type: q.type || 'text',
      optionsText: Array.isArray(q.options) ? q.options.join(', ') : '',
      note: q.note || '',
      required: Boolean(q.required),
      has_remark: hasRemarkVal
    });
    setError('');
    setActiveTab('edit');
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.label.trim()) {
      setError('Question text / label is required!');
      return;
    }

    const orderNum = Number(formData.order_num) || (sortedQuestions.length + 1);
    const parsedOptions = formData.optionsText.trim()
      ? formData.optionsText.split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    const payload = {
      order_num: orderNum,
      label: formData.label.trim(),
      placeholder: formData.placeholder.trim(),
      type: formData.type || 'text',
      options: parsedOptions,
      note: formData.note.trim(),
      required: Boolean(formData.required),
      has_remark: formData.has_remark ? 1 : 0
    };

    setSaving(true);
    try {
      if (editingQuestion) {
        // Edit existing
        const updatedList = sortedQuestions.map((item) => {
          if ((item.id && item.id === editingQuestion.id) || item.key === editingQuestion.key) {
            return {
              ...item,
              ...payload,
              label: `${orderNum}) ${formData.label.trim()}`
            };
          }
          return item;
        });
        // Persist has_remark in local advocate remarks map
        try {
          const remarkMap = JSON.parse(localStorage.getItem('advocate_questions_remarks_map') || '{}');
          remarkMap[editingQuestion.key] = Boolean(formData.has_remark);
          if (editingQuestion.id) remarkMap[editingQuestion.id] = Boolean(formData.has_remark);
          localStorage.setItem('advocate_questions_remarks_map', JSON.stringify(remarkMap));
        } catch (e) {}

        applyQuestionsUpdate(updatedList, 'Advocate Question updated successfully!');

        if (editingQuestion.id) {
          await fetch(`${API_BASE_URL}/api/advocate-questions/${editingQuestion.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
      } else {
        // Add new
        const newKey = 'adv_custom_' + Date.now();
        const newQ = {
          id: Date.now(),
          key: newKey,
          is_custom: 1,
          ...payload,
          label: `${orderNum}) ${formData.label.trim()}`
        };

        // Persist has_remark in local advocate remarks map
        try {
          const remarkMap = JSON.parse(localStorage.getItem('advocate_questions_remarks_map') || '{}');
          remarkMap[newKey] = Boolean(formData.has_remark);
          localStorage.setItem('advocate_questions_remarks_map', JSON.stringify(remarkMap));
        } catch (e) {}

        const updatedList = [...sortedQuestions, newQ];
        applyQuestionsUpdate(updatedList, `New Advocate Question #${orderNum} added successfully!`);

        try {
          const res = await fetch(`${API_BASE_URL}/api/advocate-questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, key: newKey })
          });
          const d = await res.json();
          if (d.success && d.data?.id) {
            newQ.id = d.data.id;
          }
        } catch (e) {}
      }

      if (onQuestionsUpdated) onQuestionsUpdated();
      setActiveTab('list');
    } catch (err) {
      setError(err.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (q) => {
    if (!window.confirm(`Are you sure you want to delete Question: "${q.label}"?`)) return;

    const filtered = sortedQuestions.filter((item) => item !== q && item.id !== q.id && item.key !== q.key);
    applyQuestionsUpdate(filtered, 'Advocate Question deleted successfully');

    if (q.id) {
      try {
        await fetch(`${API_BASE_URL}/api/advocate-questions/${q.id}`, { method: 'DELETE' });
      } catch (e) {}
    }
    if (onQuestionsUpdated) onQuestionsUpdated();
  };

  const handleMove = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedQuestions.length) return;

    const list = [...sortedQuestions];
    const [moved] = list.splice(index, 1);
    list.splice(targetIndex, 0, moved);

    const renumbered = list.map((item, idx) => {
      const clean = (item.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
      return {
        ...item,
        order_num: idx + 1,
        label: `${idx + 1}) ${clean}`
      };
    });

    applyQuestionsUpdate(renumbered, 'Questions reordered successfully');

    try {
      await fetch(`${API_BASE_URL}/api/advocate-questions/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: renumbered.map((i) => ({ id: i.id, order_num: i.order_num, label: i.label }))
        })
      });
    } catch (e) {}
    if (onQuestionsUpdated) onQuestionsUpdated();
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset all advocate questions to default 12 questions? Any custom questions will be removed.')) return;
    setSaving(true);
    try {
      applyQuestionsUpdate(ADVOCATE_SURVEY_QUESTIONS, 'Questions reset to default 12 successfully!');
      await fetch(`${API_BASE_URL}/api/advocate-questions/reset`, { method: 'POST' });
      if (onQuestionsUpdated) onQuestionsUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="review-summary-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px' }}>
        <div className="review-summary-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HelpCircle size={22} color="#FFF" />
            <div>
              <div className="review-summary-title">Manage Advocate Survey Questions</div>
              <div className="review-summary-subtitle">Add custom questions, edit wording, and reorder questions</div>
            </div>
          </div>
          <button className="wizard-close-btn" style={{ color: '#fff' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="wizard-error-banner" style={{ margin: '14px 28px 0 28px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{ margin: '14px 28px 0 28px', background: '#DCFCE7', color: '#15803D', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '0 28px', background: '#F8FAFC' }}>
          <button
            type="button"
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'transparent',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              color: activeTab === 'list' ? '#EA580C' : '#64748B',
              borderBottom: activeTab === 'list' ? '2.5px solid #EA580C' : 'none'
            }}
            onClick={() => setActiveTab('list')}
          >
            All Questions ({sortedQuestions.length})
          </button>
          <button
            type="button"
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'transparent',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              color: activeTab === 'add' ? '#EA580C' : '#64748B',
              borderBottom: activeTab === 'add' ? '2.5px solid #EA580C' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={handleStartAdd}
          >
            <Plus size={15} />
            <span>Add New Question</span>
          </button>
          {activeTab === 'edit' && (
            <button
              type="button"
              style={{
                padding: '12px 18px',
                border: 'none',
                background: 'transparent',
                fontWeight: 700,
                fontSize: '13.5px',
                color: '#EA580C',
                borderBottom: '2.5px solid #EA580C'
              }}
            >
              Edit Question #{formData.order_num}
            </button>
          )}
        </div>

        {/* List Tab */}
        {activeTab === 'list' && (
          <div className="review-summary-list" style={{ padding: '20px 28px', maxHeight: '480px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', color: '#64748B' }}>
                All questions and custom questions configured below automatically export into the Excel report.
              </span>
              <button
                type="button"
                className="btn-wizard-prev"
                style={{ padding: '6px 12px', fontSize: '12px', gap: '6px' }}
                onClick={handleResetDefaults}
                disabled={saving}
                title="Reset to 12 default questions"
              >
                <RotateCcw size={14} />
                <span>Reset 12 Defaults</span>
              </button>
            </div>

            {sortedQuestions.map((q, idx) => (
              <div
                key={q.id || q.key || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  marginBottom: '10px'
                }}
              >
                <div style={{ flex: 1, paddingRight: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: '#EA580C', fontSize: '13px' }}>#{q.order_num ?? idx + 1}</span>
                    <strong style={{ fontSize: '13.5px', color: '#1E293B' }}>{getAdvocateQuestionLabel(q, idx)}</strong>
                    {q.required && <span style={{ color: '#DC2626', fontSize: '11px', fontWeight: 700 }}>*Required</span>}
                    {(Boolean(q.has_remark) || (() => {
                      try {
                        const m = JSON.parse(localStorage.getItem('advocate_questions_remarks_map') || '{}');
                        return Boolean(m[q.key] ?? m[q.id]);
                      } catch (e) { return false; }
                    })()) && (
                      <span style={{ background: '#EDE9FE', color: '#7C3AED', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700 }}>+ Remark</span>
                    )}
                    {q.type === 'advocate_type' && (
                      <span style={{ background: '#DCFCE7', color: '#15803D', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700 }}>Advocate Types</span>
                    )}
                    {q.is_custom ? (
                      <span style={{ background: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700 }}>Custom</span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Type: <span style={{ fontWeight: 600 }}>{q.type}</span> {q.note && `| ${q.note}`}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px', cursor: 'pointer' }}
                    onClick={() => handleMove(idx, -1)}
                    disabled={idx === 0}
                    title="Move Up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px', cursor: 'pointer' }}
                    onClick={() => handleMove(idx, 1)}
                    disabled={idx === sortedQuestions.length - 1}
                    title="Move Down"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700 }}
                    onClick={() => handleStartEdit(q)}
                    title="Edit Question"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '6px', cursor: 'pointer' }}
                    onClick={() => handleDelete(q)}
                    title="Delete Question"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit Tab */}
        {(activeTab === 'add' || activeTab === 'edit') && (
          <form onSubmit={handleSaveForm} style={{ padding: '20px 28px', maxHeight: '480px', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Question No.
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.order_num}
                  onChange={(e) => setFormData({ ...formData, order_num: e.target.value })}
                  placeholder="e.g. 13"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Question Text / Label *
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="e.g. Total cases handled in District Court..."
                  autoFocus
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Input Type
                </label>
                <select
                  className="form-control"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="text">Text (Single line)</option>
                  <option value="number">Number (Digits only)</option>
                  <option value="textarea">Textarea (Multi-line / Remarks)</option>
                  <option value="yesno">Yes / No</option>
                  <option value="choice_text">Single Select Choice</option>
                  <option value="multi-select">Multi-Select Choices</option>
                  <option value="advocate_type">Advocate Types (Dynamic Multi-Select)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Placeholder Hint
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.placeholder}
                  onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                  placeholder="e.g. Enter details..."
                />
              </div>
            </div>

            {(formData.type === 'choice_text' || formData.type === 'multi-select') && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Options (comma separated):
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.optionsText}
                  onChange={(e) => setFormData({ ...formData, optionsText: e.target.value })}
                  placeholder="e.g. Option A, Option B, Option C"
                />
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Note / Instructions (Shown below question)
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="e.g. Note:- Please specify exact details."
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="adv-req-check"
                  checked={formData.required}
                  onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="adv-req-check" style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', cursor: 'pointer' }}>
                  Required Field (User must fill before proceeding)
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="adv-remark-check"
                  checked={formData.has_remark}
                  onChange={(e) => setFormData({ ...formData, has_remark: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#10B981', cursor: 'pointer' }}
                />
                <label htmlFor="adv-remark-check" style={{ fontSize: '13px', fontWeight: 700, color: '#047857', cursor: 'pointer' }}>
                  Include Remark (Optional Remark Input in Survey)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-wizard-prev"
                onClick={() => setActiveTab('list')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                style={{ background: '#EA580C', borderColor: '#EA580C', padding: '8px 24px' }}
                disabled={saving}
              >
                <Save size={16} />
                <span>{saving ? 'Saving...' : activeTab === 'edit' ? 'Update Question' : 'Save Question'}</span>
              </button>
            </div>
          </form>
        )}

        <div className="review-summary-footer" style={{ padding: '14px 28px' }}>
          <button type="button" className="btn-wizard-prev" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
