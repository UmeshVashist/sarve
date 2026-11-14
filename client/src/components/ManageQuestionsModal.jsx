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
import { getQuestionLabel, SURVEY_QUESTIONS } from '../data/questions';

export default function ManageQuestionsModal({
  isOpen,
  onClose,
  questions = [],
  onUpdateQuestions,
  onQuestionsUpdated
}) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'add' | 'edit'
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    order_num: '',
    label: '',
    placeholder: '',
    type: 'text',
    optionsText: '',
    note: '',
    required: false
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Always keep questions sorted by order_num
  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0));
  }, [questions]);

  if (!isOpen) return null;

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  // Helper to sync changes locally immediately and then in background to server
  const applyQuestionsUpdate = (newList, message = '') => {
    const sorted = [...newList].sort((a, b) => (Number(a.order_num) || 0) - (Number(b.order_num) || 0));
    if (onUpdateQuestions) {
      onUpdateQuestions(sorted);
    }
    try {
      localStorage.setItem('survey_questions_list', JSON.stringify(sorted));
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
      required: false
    });
    setError('');
    setActiveTab('add');
  };

  const handleStartEdit = (q) => {
    setEditingQuestion(q);
    // Strip leading number prefix so user can edit cleanly
    const cleanLabel = (q.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();

    setFormData({
      order_num: q.order_num ?? '',
      label: cleanLabel,
      placeholder: q.placeholder || '',
      type: q.type || 'text',
      optionsText: Array.isArray(q.options) ? q.options.join(', ') : '',
      note: q.note || '',
      required: Boolean(q.required)
    });
    setError('');
    setActiveTab('edit');
  };

  const handleCancelForm = () => {
    setEditingQuestion(null);
    setError('');
    setActiveTab('list');
  };

  // Change individual question number directly (input blur or enter)
  const handleUpdateOrderNumber = async (q, newOrderVal) => {
    const parsed = parseInt(newOrderVal, 10);
    if (isNaN(parsed) || parsed < 1) return;

    const currentIndex = sortedQuestions.findIndex((item) => item.id === q.id);
    if (currentIndex === -1) return;
    const currentNum = sortedQuestions[currentIndex].order_num ?? (currentIndex + 1);
    if (parsed === currentNum) return;

    // Bound target index
    const targetIndex = Math.max(0, Math.min(parsed - 1, sortedQuestions.length - 1));
    if (targetIndex === currentIndex) return;

    const copy = [...sortedQuestions];
    const [removed] = copy.splice(currentIndex, 1);
    copy.splice(targetIndex, 0, removed);

    // Reassign sequential order numbers & updated labels
    const reordered = copy.map((item, idx) => {
      const newNum = idx + 1;
      const cleanLabel = (item.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
      return {
        ...item,
        order_num: newNum,
        label: `${newNum}) ${cleanLabel}`
      };
    });

    applyQuestionsUpdate(reordered, `Question moved to position #${targetIndex + 1}!`);

    // Sync to server in background
    try {
      await fetch(`${API_BASE_URL}/api/questions/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: reordered.map((item) => ({
            id: item.id,
            order_num: item.order_num,
            label: item.label
          }))
        })
      });
      if (onQuestionsUpdated) onQuestionsUpdated();
    } catch (err) {
      console.warn('API reorder sync warning:', err);
    }
  };

  // Reorder using Up / Down arrows
  const handleMove = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedQuestions.length) return;

    const copy = [...sortedQuestions];
    const [removed] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, removed);

    const reordered = copy.map((item, idx) => {
      const newNum = idx + 1;
      const cleanLabel = (item.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
      return {
        ...item,
        order_num: newNum,
        label: `${newNum}) ${cleanLabel}`
      };
    });

    applyQuestionsUpdate(reordered, `Question moved to #${targetIndex + 1}!`);

    try {
      await fetch(`${API_BASE_URL}/api/questions/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: reordered.map((item) => ({
            id: item.id,
            order_num: item.order_num,
            label: item.label
          }))
        })
      });
      if (onQuestionsUpdated) onQuestionsUpdated();
    } catch (err) {
      console.warn('API reorder sync warning:', err);
    }
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.label || !formData.label.trim()) {
      setError('Question text / label is required!');
      return;
    }

    setSaving(true);
    try {
      const options = formData.optionsText
        ? formData.optionsText.split(',').map((s) => s.trim()).filter(Boolean)
        : null;

      const cleanLabel = formData.label.replace(/^\d+[\)\.\-]\s*/, '').trim();

      let reordered = [];
      let serverPayload = null;

      if (editingQuestion) {
        const oldIndex = sortedQuestions.findIndex((item) => item.id === editingQuestion.id);
        const targetOrder = Number(formData.order_num) || (oldIndex + 1);
        const targetIndex = Math.max(0, Math.min(targetOrder - 1, sortedQuestions.length - 1));

        const updatedItem = {
          ...editingQuestion,
          placeholder: formData.placeholder ? formData.placeholder.trim() : '',
          type: formData.type || 'text',
          options: options && options.length > 0 ? options : null,
          note: formData.note ? formData.note.trim() : '',
          required: formData.required ? 1 : 0,
          label: cleanLabel
        };

        const copy = [...sortedQuestions];
        if (oldIndex !== -1) {
          copy.splice(oldIndex, 1);
        }
        copy.splice(targetIndex, 0, updatedItem);

        reordered = copy.map((item, idx) => {
          const newNum = idx + 1;
          const cLabel = (item.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
          return {
            ...item,
            order_num: newNum,
            label: `${newNum}) ${cLabel}`
          };
        });

        applyQuestionsUpdate(reordered, `Question #${targetIndex + 1} updated successfully!`);
        setActiveTab('list');
        setEditingQuestion(null);

        serverPayload = {
          order_num: targetIndex + 1,
          label: `${targetIndex + 1}) ${cleanLabel}`,
          placeholder: formData.placeholder ? formData.placeholder.trim() : '',
          type: formData.type || 'text',
          options: options && options.length > 0 ? options : null,
          note: formData.note ? formData.note.trim() : '',
          required: formData.required ? 1 : 0
        };

        await fetch(`${API_BASE_URL}/api/questions/${editingQuestion.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serverPayload)
        });

        await fetch(`${API_BASE_URL}/api/questions/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: reordered.map((item) => ({
              id: item.id,
              order_num: item.order_num,
              label: item.label
            }))
          })
        });
      } else {
        const targetOrder = Number(formData.order_num) || (sortedQuestions.length + 1);
        const targetIndex = Math.max(0, Math.min(targetOrder - 1, sortedQuestions.length));
        const tempId = 'custom_' + Date.now();
        const customKey = `custom_${Date.now()}`;

        const newQ = {
          id: tempId,
          key: customKey,
          placeholder: formData.placeholder ? formData.placeholder.trim() : '',
          type: formData.type || 'text',
          options: options && options.length > 0 ? options : null,
          note: formData.note ? formData.note.trim() : '',
          required: formData.required ? 1 : 0,
          label: cleanLabel,
          is_custom: true
        };

        const copy = [...sortedQuestions];
        copy.splice(targetIndex, 0, newQ);

        reordered = copy.map((item, idx) => {
          const newNum = idx + 1;
          const cLabel = (item.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
          return {
            ...item,
            order_num: newNum,
            label: `${newNum}) ${cLabel}`
          };
        });

        applyQuestionsUpdate(reordered, `New Question added at #${targetIndex + 1}!`);
        setActiveTab('list');
        setEditingQuestion(null);

        serverPayload = {
          key: customKey,
          order_num: targetIndex + 1,
          label: `${targetIndex + 1}) ${cleanLabel}`,
          placeholder: formData.placeholder ? formData.placeholder.trim() : '',
          type: formData.type || 'text',
          options: options && options.length > 0 ? options : null,
          note: formData.note ? formData.note.trim() : '',
          required: formData.required ? 1 : 0
        };

        const res = await fetch(`${API_BASE_URL}/api/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serverPayload)
        });
        const resData = await res.json();
        if (resData.success && resData.data) {
          const finalized = reordered.map((item) =>
            item.id === tempId
              ? { ...item, id: resData.data.id, key: resData.data.key || customKey }
              : item
          );
          applyQuestionsUpdate(finalized);
          await fetch(`${API_BASE_URL}/api/questions/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: finalized.map((item) => ({
                id: item.id,
                order_num: item.order_num,
                label: item.label
              }))
            })
          });
        }
      }

      if (onQuestionsUpdated) onQuestionsUpdated();
    } catch (err) {
      console.warn('API sync warning:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (q) => {
    if (!window.confirm(`Are you sure you want to delete Question #${q.order_num || ''}: "${getQuestionLabel(q)}"?`)) {
      return;
    }

    const filtered = sortedQuestions.filter((item) => item.id !== q.id);
    const reordered = filtered.map((item, idx) => {
      const newNum = idx + 1;
      const clean = (item.label || '').replace(/^\d+[\)\.\-]\s*/, '').trim();
      return {
        ...item,
        order_num: newNum,
        label: `${newNum}) ${clean}`
      };
    });

    applyQuestionsUpdate(reordered, 'Question deleted successfully!');

    try {
      await fetch(`${API_BASE_URL}/api/questions/${q.id}`, { method: 'DELETE' });
      await fetch(`${API_BASE_URL}/api/questions/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: reordered.map((item) => ({
            id: item.id,
            order_num: item.order_num,
            label: item.label
          }))
        })
      });
      if (onQuestionsUpdated) onQuestionsUpdated();
    } catch (err) {
      console.warn('API delete sync warning:', err);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Reset all questions to default 24 questions? Custom questions and numbering will be restored.')) {
      return;
    }

    applyQuestionsUpdate(SURVEY_QUESTIONS, 'Questions reset to default 24 successfully!');
    try {
      localStorage.removeItem('survey_questions_list');
    } catch (e) {}

    try {
      await fetch(`${API_BASE_URL}/api/questions/reset`, { method: 'POST' });
      if (onQuestionsUpdated) onQuestionsUpdated();
    } catch (err) {
      console.warn('API reset sync warning:', err);
    }
  };

  return createPortal(
    <div className="wizard-backdrop animate-fade-in" onClick={onClose}>
      <div className="questions-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HelpCircle size={22} color="#8B5CF6" />
              <span>Survey Questions Management</span>
            </div>
            <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
              Add, edit, delete questions & customize their numbering and sequence
            </div>
          </div>
          <button className="wizard-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Notifications */}
          {error && (
            <div className="wizard-error-banner" style={{ marginBottom: '14px' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              background: '#D1FAE5',
              border: '1px solid #6EE7B7',
              color: '#065F46',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '14px',
              fontSize: '13.5px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Check size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="questions-header-tabs">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => { setActiveTab('list'); setEditingQuestion(null); }}
            >
              <span>All Questions ({sortedQuestions.length})</span>
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
              onClick={handleStartAdd}
            >
              <Plus size={16} />
              <span>+ Add Question</span>
            </button>
            {editingQuestion && (
              <button
                type="button"
                className={`tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
              >
                <Edit2 size={15} />
                <span>Edit Question #{editingQuestion.order_num}</span>
              </button>
            )}
          </div>

          {/* TAB 1: ALL QUESTIONS LIST */}
          {activeTab === 'list' && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: '#475569' }}>
                  Number change karke <strong>Enter</strong> dabayein ya <strong>↑/↓</strong> arrows se position badlein.
                </span>
                <button
                  type="button"
                  className="btn-add-data"
                  style={{ padding: '6px 12px', fontSize: '12.5px', background: '#8B5CF6' }}
                  onClick={handleStartAdd}
                >
                  <Plus size={15} />
                  <span>Add Question</span>
                </button>
              </div>

              {sortedQuestions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px', color: '#64748B' }}>
                  No questions found in system. Click "Reset to Defaults" below.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '52vh', overflowY: 'auto', paddingRight: '4px' }}>
                  {sortedQuestions.map((q, idx) => (
                    <div key={q.id || idx} className="question-item-card">
                      {/* Numbering and Reorder arrows */}
                      <div className="question-number-box">
                        <input
                          key={`order_${q.id}_${q.order_num}`}
                          type="number"
                          className="question-num-input"
                          title="Change number and press Enter or click outside"
                          defaultValue={q.order_num ?? idx + 1}
                          onBlur={(e) => handleUpdateOrderNumber(q, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleUpdateOrderNumber(q, e.target.value);
                            }
                          }}
                        />
                        <div className="question-reorder-btns">
                          <button
                            type="button"
                            className="btn-reorder"
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, -1)}
                            title="Move Up (Pehle le jayein)"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-reorder"
                            disabled={idx === sortedQuestions.length - 1}
                            onClick={() => handleMove(idx, 1)}
                            title="Move Down (Neeche le jayein)"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Question Content */}
                      <div className="question-info-area">
                        <div className="question-label-text">{getQuestionLabel(q, idx)}</div>
                        <div className="question-meta-row">
                          <span className="badge-qtype">{q.type || 'text'}</span>
                          {q.required ? <span className="badge-required">Required</span> : null}
                          {q.is_custom ? <span className="badge-custom">Custom</span> : null}
                          {q.note && (
                            <span style={{ fontSize: '11.5px', color: '#64748B', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {q.note}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="question-actions-group">
                        <button
                          type="button"
                          className="btn-q-action edit"
                          onClick={() => handleStartEdit(q)}
                          title="Edit Question"
                        >
                          <Edit2 size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="btn-q-action delete"
                          onClick={() => handleDelete(q)}
                          title="Delete Question"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer'
                  }}
                  onClick={handleResetDefaults}
                  title="Reset to default 24 questions"
                >
                  <RotateCcw size={14} />
                  <span>Reset to Default 24 Questions</span>
                </button>

                <button
                  type="button"
                  className="btn-primary-coral"
                  style={{ width: 'auto', padding: '9px 20px', fontSize: '13.5px' }}
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* TAB 2 & 3: ADD / EDIT QUESTION FORM */}
          {(activeTab === 'add' || activeTab === 'edit') && (
            <form onSubmit={handleSaveForm} style={{ marginTop: '16px' }}>
              <div className="question-form-card">
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>
                  {activeTab === 'add' ? '+ Add New Question' : `Edit Question #${editingQuestion?.order_num}`}
                </h4>

                <div className="question-form-grid">
                  {/* Numbering Field */}
                  <div className="form-group">
                    <label className="form-label">
                      Question Number <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.order_num}
                      onChange={(e) => setFormData({ ...formData, order_num: e.target.value })}
                      placeholder="e.g. 25"
                      required
                    />
                    <span style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px', display: 'block' }}>
                      Position & sequence number in survey form
                    </span>
                  </div>

                  {/* Input Type */}
                  <div className="form-group">
                    <label className="form-label">Question Input Type</label>
                    <select
                      className="form-control"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="text">Single Line Text (Input)</option>
                      <option value="number">Number (e.g. 1, 2, 3)</option>
                      <option value="yesno">Yes / No</option>
                      <option value="choice_text">Dropdown / Single Choice</option>
                      <option value="multi-select">Multi-select Checkbox</option>
                      <option value="textarea">Paragraph / Long Textarea</option>
                    </select>
                  </div>
                </div>

                {/* Question Label / Text */}
                <div className="form-group" style={{ marginTop: '14px' }}>
                  <label className="form-label">
                    Question Text / Label <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="Enter question text (e.g. Do you have a copy of the case diary?)"
                    required
                  />
                </div>

                {/* Options if choice or dropdown */}
                {(formData.type === 'choice_text' || formData.type === 'multi-select' || formData.type === 'yesno_or_choice') && (
                  <div className="form-group" style={{ marginTop: '14px' }}>
                    <label className="form-label">
                      Selectable Options (comma separated)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.optionsText}
                      onChange={(e) => setFormData({ ...formData, optionsText: e.target.value })}
                      placeholder="e.g. Yes, No, Partially, Not Applicable"
                    />
                    <span style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px', display: 'block' }}>
                      Separate multiple options with commas
                    </span>
                  </div>
                )}

                <div className="question-form-grid" style={{ marginTop: '14px' }}>
                  {/* Placeholder */}
                  <div className="form-group">
                    <label className="form-label">Input Placeholder</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.placeholder}
                      onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                      placeholder="e.g. Enter details or type Yes/No..."
                    />
                  </div>

                  {/* Required Checkbox */}
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label className="form-label" style={{ marginBottom: '8px' }}>Validation</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={formData.required}
                        onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: '#8B5CF6' }}
                      />
                      <span>Mark question as Required (Mandatory)</span>
                    </label>
                  </div>
                </div>

                {/* Helper Note */}
                <div className="form-group" style={{ marginTop: '14px' }}>
                  <label className="form-label">Helper Note (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="e.g. Note:- Pls enter details accurately"
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-back-nav"
                  onClick={handleCancelForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-add-data"
                  style={{ background: '#8B5CF6', padding: '10px 22px' }}
                  disabled={saving}
                >
                  <Save size={16} />
                  <span>{saving ? 'Saving Question...' : (editingQuestion ? 'Update Question' : 'Add Question')}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
