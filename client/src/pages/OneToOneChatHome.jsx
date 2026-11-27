import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageSquare, Users, UserPlus, Plus, Search, Send,
  Trash2, Edit3, AtSign, CheckCheck, ArrowLeft, X,
  Shield, Check, RefreshCw, Sparkles, Smile, UserCheck,
  Settings, Hash, ChevronRight, MoreVertical
} from 'lucide-react';
import { API_BASE_URL } from '../config';

// Available Avatar Colors
const AVATAR_COLORS = [
  '#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626',
  '#0891B2', '#4F46E5', '#EA580C', '#0D9488', '#BE185D'
];

// Available Group Emoji Logos
const GROUP_LOGOS = ['💬', '⚖️', '👥', '📑', '🏢', '🏛️', '🛡️', '⚡', '📢', '🎯', '💼', '🚀'];

// Helper: Format message time like WhatsApp
function formatWhatsAppTime(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  if (isToday) {
    return timeStr;
  }
  if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  }
  const dateFormatted = d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `${dateFormatted}, ${timeStr}`;
}

// Helper: Format divider date pill
function formatDividerDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Helper: Check if two dates belong to different days
function isDifferentDay(d1Str, d2Str) {
  if (!d1Str || !d2Str) return true;
  const d1 = new Date(d1Str);
  const d2 = new Date(d2Str);
  return d1.toDateString() !== d2.toDateString();
}

export default function OneToOneChatHome({ onBackToDashboard }) {
  // Main Data States
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');

  // Current Sender
  const [currentSender, setCurrentSender] = useState('meet (Admin)');

  // New Message Input & @ Mention states
  const [inputText, setInputText] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null); // null if not active, string if typing @...
  const [mentionCursorIndex, setMentionCursorIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // Modals
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null); // null for create, group obj for edit
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isGroupMembersModalOpen, setIsGroupMembersModalOpen] = useState(false);

  // 3-Dots Dropdown Menu State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Group Form State
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    logo_url: '💬',
    member_ids: []
  });

  // Group Members quick add/remove state
  const [groupMembersForm, setGroupMembersForm] = useState([]);

  // Member Form State (for adding / editing members)
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberColor, setNewMemberColor] = useState(AVATAR_COLORS[0]);
  const [editingMember, setEditingMember] = useState(null);

  // Notification Toast
  const [toast, setToast] = useState('');

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastMsgIdRef = useRef(0);
  const pollingTimerRef = useRef(null);

  // Click outside and Esc key listener for 3-dots dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Show Toast
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // 1. Fetch All Members
  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/members?_t=${Date.now()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.members)) {
        setMembers(data.members);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  // 2. Fetch All Groups (without forcing auto-selection so user can close chat)
  const fetchGroups = async (q = groupSearch) => {
    try {
      const url = new URL(`${API_BASE_URL}/api/chat/groups`);
      if (q.trim()) url.searchParams.append('q', q.trim());
      url.searchParams.append('_t', Date.now());

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setGroups(data.groups);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  // 3. Fetch Messages for Active Group
  const fetchMessages = async (groupId, isInitial = false) => {
    if (!groupId) return;
    if (isInitial) setLoadingMessages(true);

    try {
      const url = new URL(`${API_BASE_URL}/api/chat/messages`);
      url.searchParams.append('group_id', groupId);
      url.searchParams.append('_t', Date.now());

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setMessages(data.messages);
        if (data.messages.length > 0) {
          lastMsgIdRef.current = data.messages[data.messages.length - 1].id;
        } else {
          lastMsgIdRef.current = 0;
        }
        if (isInitial) {
          setTimeout(scrollToBottom, 100);
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      if (isInitial) setLoadingMessages(false);
    }
  };

  // 4. Delta Polling for Real-Time Sync (every 1.8 seconds)
  const pollNewMessages = async () => {
    if (!activeGroupId) return;
    const sinceId = lastMsgIdRef.current;
    if (!sinceId) {
      fetchMessages(activeGroupId, false);
      return;
    }

    try {
      const url = new URL(`${API_BASE_URL}/api/chat/messages`);
      url.searchParams.append('group_id', activeGroupId);
      url.searchParams.append('since', sinceId);
      url.searchParams.append('_t', Date.now());

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map(m => m.id));
          const newUnique = data.messages.filter(m => !existingIds.has(m.id));
          if (newUnique.length === 0) return prev;
          const merged = [...prev, ...newUnique];
          lastMsgIdRef.current = merged[merged.length - 1].id;
          setTimeout(scrollToBottom, 50);
          return merged;
        });

        // Also refresh groups list to update last message preview in sidebar
        fetchGroups(groupSearch);
      }
    } catch (err) {
      // Silently catch background poll error
    }
  };

  // Initial load
  useEffect(() => {
    fetchMembers();
    fetchGroups('');
  }, []);

  // When activeGroupId changes, reload messages and set up polling
  useEffect(() => {
    if (activeGroupId) {
      lastMsgIdRef.current = 0;
      fetchMessages(activeGroupId, true);

      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = setInterval(pollNewMessages, 1800);
    }
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [activeGroupId]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Active Group Object
  const activeGroup = useMemo(() => {
    return groups.find(g => g.id === activeGroupId) || null;
  }, [groups, activeGroupId]);

  // Members of active group
  const activeGroupMembers = useMemo(() => {
    if (!activeGroup || !Array.isArray(activeGroup.members)) return [];
    return activeGroup.members;
  }, [activeGroup]);

  // Keep currentSender in sync with activeGroupMembers (only members belonging to this group)
  useEffect(() => {
    if (activeGroupMembers && activeGroupMembers.length > 0) {
      const isMemberInGroup = activeGroupMembers.some(m => m.name === currentSender);
      if (!isMemberInGroup) {
        setCurrentSender(activeGroupMembers[0].name);
      }
    }
  }, [activeGroupId, activeGroupMembers]);

  // Send Message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean || !activeGroupId) return;

    // Detect @ mentions in text
    const foundMentions = [];
    if (activeGroupMembers.length > 0) {
      activeGroupMembers.forEach(m => {
        if (clean.includes(`@${m.name}`)) {
          foundMentions.push(m.name);
        }
      });
    }

    const payload = {
      group_id: activeGroupId,
      sender_name: currentSender,
      message: clean,
      mentions: foundMentions
    };

    // Optimistic message display
    const tempId = Date.now();
    const optimisticMsg = {
      id: tempId,
      group_id: activeGroupId,
      sender_name: currentSender,
      message: clean,
      mentions: JSON.stringify(foundMentions),
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setInputText('');
    setMentionQuery(null);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.message) {
        lastMsgIdRef.current = Math.max(lastMsgIdRef.current, data.message.id);
        // Replace optimistic msg with confirmed server msg
        setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
        fetchGroups(groupSearch);
      }
    } catch (err) {
      console.error('Send message error:', err);
      showToast('Failed to send message. Please retry.');
    }
  };

  // Handle Input Change & detect @ mention trigger
  const handleInputChange = (e) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    setInputText(val);

    // Look back from cursor to see if inside @mention
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      // Check if @ is at start of word
      const charBeforeAt = lastAtPos > 0 ? textBeforeCursor[lastAtPos - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n') {
        const query = textBeforeCursor.slice(lastAtPos + 1);
        // If query doesn't contain space or is short, show dropdown
        if (!query.includes(' ') && query.length <= 25) {
          setMentionQuery(query.toLowerCase());
          setMentionCursorIndex(lastAtPos);
          setSelectedMentionIndex(0);
          return;
        }
      }
    }
    setMentionQuery(null);
  };

  // Mention suggestions matching current query
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return activeGroupMembers.filter(m =>
      m.name.toLowerCase().includes(mentionQuery)
    );
  }, [mentionQuery, activeGroupMembers]);

  // Insert selected mention
  const insertMention = (memberName) => {
    if (mentionCursorIndex === -1) return;
    const before = inputText.slice(0, mentionCursorIndex);
    // Find where the mention query ends
    const after = inputText.slice(mentionCursorIndex + 1 + (mentionQuery || '').length);
    const updated = `${before}@${memberName} ${after}`;
    setInputText(updated);
    setMentionQuery(null);
    setMentionCursorIndex(-1);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = before.length + memberName.length + 2;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 50);
  };

  // Input Key Down: Handle Tab, Enter, Arrows for Mentions
  const handleKeyDown = (e) => {
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionSuggestions[selectedMentionIndex].name);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Delete Single Message
  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/messages/${msgId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
        showToast('Message deleted');
      }
    } catch (err) {
      showToast('Error deleting message');
    }
  };

  // Open Create Group Modal
  const openCreateGroupModal = () => {
    setEditingGroup(null);
    setGroupForm({
      name: '',
      description: '',
      logo_url: '💬',
      member_ids: members.map(m => m.id) // Default all members checked
    });
    setIsGroupModalOpen(true);
  };

  // Open Edit Group Modal
  const openEditGroupModal = (grp) => {
    setEditingGroup(grp);
    const existingMemberIds = (grp.members || []).map(m => m.id);
    setGroupForm({
      name: grp.name || '',
      description: grp.description || '',
      logo_url: grp.logo_url || '💬',
      member_ids: existingMemberIds
    });
    setIsGroupModalOpen(true);
  };

  // Save Group (Create / Update)
  const handleSaveGroup = async (e) => {
    e.preventDefault();
    const cleanName = groupForm.name.trim();
    if (!cleanName) {
      showToast('Group name is required');
      return;
    }

    try {
      const url = editingGroup
        ? `${API_BASE_URL}/api/chat/groups/${editingGroup.id}`
        : `${API_BASE_URL}/api/chat/groups`;
      const method = editingGroup ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupForm)
      });
      const data = await res.json();
      if (data.success) {
        showToast(editingGroup ? 'Group updated successfully' : 'Group created successfully');
        setIsGroupModalOpen(false);
        await fetchGroups(groupSearch);
        if (!editingGroup && data.group_id) {
          setActiveGroupId(data.group_id);
        }
      } else {
        showToast(data.message || 'Error saving group');
      }
    } catch (err) {
      showToast('Network error saving group');
    }
  };

  // Delete Group
  const handleDeleteGroup = async (grpId, grpName) => {
    if (!window.confirm(`Are you sure you want to delete group "${grpName}"? All messages will be permanently deleted.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/groups/${grpId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Group deleted successfully');
        const remaining = groups.filter(g => g.id !== grpId);
        setGroups(remaining);
        if (activeGroupId === grpId) {
          setActiveGroupId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (err) {
      showToast('Error deleting group');
    }
  };

  // Open Quick Group Members Modal (Add / Remove members anytime)
  const openGroupMembersModal = (grp) => {
    const existingIds = (grp.members || []).map(m => m.id);
    setGroupMembersForm(existingIds);
    setIsGroupMembersModalOpen(true);
  };

  // Save Group Members
  const handleSaveGroupMembers = async () => {
    if (!activeGroup) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/groups/${activeGroup.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: groupMembersForm })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Group members updated successfully');
        setIsGroupMembersModalOpen(false);
        fetchGroups(groupSearch);
      }
    } catch (err) {
      showToast('Error updating group members');
    }
  };

  // Add New Member to Global Members List
  const handleAddMember = async (e) => {
    e.preventDefault();
    const clean = newMemberName.trim();
    if (!clean) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clean, avatar_color: newMemberColor })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Member "${clean}" added!`);
        setNewMemberName('');
        await fetchMembers();
        fetchGroups(groupSearch);
      } else {
        showToast(data.message || 'Error adding member');
      }
    } catch (err) {
      showToast('Network error adding member');
    }
  };

  // Update Member Name / Color
  const handleUpdateMember = async (e) => {
    e.preventDefault();
    if (!editingMember || !editingMember.name.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/members/${editingMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingMember.name.trim(), avatar_color: editingMember.avatar_color })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Member updated');
        setEditingMember(null);
        await fetchMembers();
        fetchGroups(groupSearch);
      }
    } catch (err) {
      showToast('Error updating member');
    }
  };

  // Delete Member from Global List
  const handleDeleteMember = async (memberId, memberName) => {
    if (!window.confirm(`Delete member "${memberName}"? They will be removed from all groups.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/members/${memberId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(`Member "${memberName}" deleted`);
        await fetchMembers();
        fetchGroups(groupSearch);
      }
    } catch (err) {
      showToast('Error deleting member');
    }
  };

  // Helper to render message text with highlighted @mentions
  const renderMessageContent = (text) => {
    if (!text) return '';
    // Match @ followed by words
    const parts = text.split(/(@[\w\s().-]+)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={idx}
            style={{
              color: '#1D4ED8',
              backgroundColor: '#DBEAFE',
              padding: '1px 6px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '13px',
              display: 'inline-block',
              margin: '0 2px'
            }}
          >
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // Helper to get color for sender
  const getSenderColor = (senderName) => {
    const found = members.find(m => m.name.toLowerCase() === senderName.toLowerCase());
    return found ? found.avatar_color : '#2563EB';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 75px)',
      backgroundColor: '#0F172A',
      color: '#0F172A',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          zIndex: 9999999,
          background: '#1E293B',
          color: '#F8FAFC',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          fontWeight: 600,
          border: '1px solid #334155'
        }}>
          <Sparkles size={16} color="#38BDF8" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Header / Action Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBackToDashboard}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#DCFCE7',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '16px'
            }}>
              💬
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                1 to 1 Group Chat
              </h2>
              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>
                WhatsApp Style Real-Time Multi-Member Collaboration
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Manage All Members Button */}
          <button
            onClick={() => setIsMemberModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#EEF2FF',
              color: '#4F46E5',
              border: '1px solid #C7D2FE',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Manage all members (Add, Edit name, Delete)"
          >
            <Users size={16} /> Manage Members ({members.length})
          </button>

          {/* Create Group Button */}
          <button
            onClick={openCreateGroupModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#16A34A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
            }}
          >
            <Plus size={16} /> Create Group
          </button>
        </div>
      </div>

      {/* Main WhatsApp Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT SIDEBAR: Groups Directory */}
        <div style={{
          width: '360px',
          minWidth: '320px',
          maxWidth: '400px',
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Search Bar in Sidebar */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' }}>
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              padding: '0 10px'
            }}>
              <Search size={16} color="#94A3B8" />
              <input
                type="text"
                placeholder="Search groups or chat..."
                value={groupSearch}
                onChange={(e) => {
                  setGroupSearch(e.target.value);
                  fetchGroups(e.target.value);
                }}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  padding: '9px 8px',
                  fontSize: '13px',
                  color: '#1E293B',
                  backgroundColor: 'transparent'
                }}
              />
              {groupSearch && (
                <button
                  onClick={() => {
                    setGroupSearch('');
                    fetchGroups('');
                  }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Groups List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingGroups ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
                <span>Loading groups...</span>
              </div>
            ) : groups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94A3B8' }}>
                <span style={{ fontSize: '36px', display: 'block', marginBottom: '10px' }}>💬</span>
                <p style={{ fontWeight: 700, margin: '0 0 6px 0', color: '#475569' }}>No Groups Found</p>
                <p style={{ fontSize: '12px', margin: '0 0 16px 0' }}>Create your first group to start chatting!</p>
                <button
                  onClick={openCreateGroupModal}
                  style={{
                    backgroundColor: '#16A34A',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  + Create Group
                </button>
              </div>
            ) : (
              groups.map((grp) => {
                const isSelected = grp.id === activeGroupId;
                const lastMsg = grp.last_message;
                const formattedTime = lastMsg ? formatWhatsAppTime(lastMsg.created_at) : '';

                return (
                  <div
                    key={grp.id}
                    onClick={() => setActiveGroupId(prev => prev === grp.id ? null : grp.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderBottom: '1px solid #F1F5F9',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                      transition: 'background-color 0.15s ease',
                      borderLeft: isSelected ? '4px solid #2563EB' : '4px solid transparent',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF';
                    }}
                  >
                    {/* Group Logo Avatar */}
                    <div style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? '#DBEAFE' : '#F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      flexShrink: 0,
                      marginRight: '12px'
                    }}>
                      {grp.logo_url || '💬'}
                    </div>

                    {/* Group Info & Last Message */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: '14.5px',
                          fontWeight: 700,
                          color: isSelected ? '#1E40AF' : '#0F172A',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {grp.name}
                        </h4>
                        {formattedTime && (
                          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, flexShrink: 0, marginLeft: '6px' }}>
                            {formattedTime}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <p style={{
                          margin: 0,
                          fontSize: '12px',
                          color: '#64748B',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1
                        }}>
                          {lastMsg ? (
                            <>
                              <strong style={{ color: '#475569' }}>{lastMsg.sender_name}: </strong>
                              {lastMsg.message}
                            </>
                          ) : (
                            <span style={{ fontStyle: 'italic', color: '#94A3B8' }}>{grp.description || 'No messages yet'}</span>
                          )}
                        </p>

                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isSelected ? '#BFDBFE' : '#F1F5F9',
                          color: isSelected ? '#1D4ED8' : '#64748B',
                          padding: '1px 7px',
                          borderRadius: '10px',
                          flexShrink: 0
                        }}>
                          {grp.member_count || 0} members
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT CHAT AREA */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#EFEAE2', // WhatsApp Classic warm beige chat canvas
          position: 'relative'
        }}>
          {activeGroup ? (
            <>
              {/* Top Chat Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 20px',
                backgroundColor: '#FFFFFF',
                borderBottom: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                zIndex: 5
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: '#EEF2FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    flexShrink: 0
                  }}>
                    {activeGroup.logo_url || '💬'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: '#0F172A' }}>
                        {activeGroup.name}
                      </h3>
                      <span style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        padding: '1px 8px',
                        borderRadius: '12px'
                      }}>
                        {activeGroupMembers.length} Members
                      </span>
                    </div>

                    {/* Member preview string */}
                    <p style={{
                      margin: '2px 0 0 0',
                      fontSize: '12px',
                      color: '#64748B',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '650px'
                    }}>
                      {activeGroupMembers.map(m => m.name).join(', ') || 'No members assigned'}
                    </p>
                  </div>
                </div>

                {/* Group Action Buttons: Close Chat + 3-Dots Vertical Options Menu */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Close Chat Button */}
                  <button
                    onClick={() => setActiveGroupId(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      color: '#64748B',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Close Chat (Unselect Group)"
                  >
                    <X size={18} />
                  </button>

                  {/* 3-Dots Vertical Menu (MoreVertical) */}
                  <div style={{ position: 'relative' }} ref={menuRef}>
                    <button
                      onClick={() => setIsMenuOpen(prev => !prev)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: isMenuOpen ? '#E2E8F0' : '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        color: '#334155',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title="Group Options (3 dots)"
                    >
                      <MoreVertical size={19} />
                    </button>

                    {/* 3-Dots Dropdown Menu */}
                    {isMenuOpen && (
                      <div style={{
                        position: 'absolute',
                        top: '44px',
                        right: '0',
                        width: '220px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '10px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        border: '1px solid #E2E8F0',
                        padding: '6px 0',
                        zIndex: 100,
                        animation: 'fadeIn 0.15s ease'
                      }}>
                        {/* 1. Add / Remove Members */}
                        <button
                          onClick={() => {
                            setIsMenuOpen(false);
                            openGroupMembersModal(activeGroup);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#1E293B',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <UserPlus size={16} color="#2563EB" />
                          <span>Add / Remove Members</span>
                        </button>

                        {/* 2. Edit Group */}
                        <button
                          onClick={() => {
                            setIsMenuOpen(false);
                            openEditGroupModal(activeGroup);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#1E293B',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Edit3 size={16} color="#475569" />
                          <span>Edit Group</span>
                        </button>

                        {/* 3. Close Chat */}
                        <button
                          onClick={() => {
                            setIsMenuOpen(false);
                            setActiveGroupId(null);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#475569',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <X size={16} color="#64748B" />
                          <span>Close Chat</span>
                        </button>

                        <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '4px 0' }} />

                        {/* 4. Delete Group */}
                        <button
                          onClick={() => {
                            setIsMenuOpen(false);
                            handleDeleteGroup(activeGroup.id, activeGroup.name);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '10px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#DC2626',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Trash2 size={16} color="#DC2626" />
                          <span>Delete Group</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Messages Feed */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backgroundImage: 'radial-gradient(#CBD5E1 0.75px, transparent 0.75px)',
                backgroundSize: '20px 20px'
              }}>
                {loadingMessages ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <span>Loading messages...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '30px 20px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    maxWidth: '400px',
                    margin: 'auto',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}>
                    <span style={{ fontSize: '32px' }}>🔒</span>
                    <h4 style={{ margin: '10px 0 4px 0', color: '#1E293B' }}>End-to-End Secure Group</h4>
                    <p style={{ fontSize: '12.5px', color: '#64748B', margin: 0 }}>
                      Messages are securely stored. Type <code style={{ background: '#E2E8F0', padding: '2px 4px', borderRadius: '4px' }}>@</code> to mention any group member!
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showDateDivider = !prevMsg || isDifferentDay(msg.created_at, prevMsg.created_at);
                    const isSystem = msg.sender_name === 'System';
                    const isOutgoing = msg.sender_name === currentSender;
                    const senderColor = getSenderColor(msg.sender_name);

                    return (
                      <React.Fragment key={msg.id}>
                        {/* WhatsApp Centered Date Divider Badge */}
                        {showDateDivider && (
                          <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 8px 0' }}>
                            <span style={{
                              backgroundColor: '#FFFFFF',
                              color: '#54656F',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              padding: '4px 14px',
                              borderRadius: '8px',
                              boxShadow: '0 1px 2px rgba(11,20,26,0.1)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              {formatDividerDate(msg.created_at)}
                            </span>
                          </div>
                        )}

                        {/* System Message Pill */}
                        {isSystem ? (
                          <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                            <span style={{
                              backgroundColor: '#FEF3C7',
                              color: '#92400E',
                              fontSize: '12px',
                              fontWeight: 600,
                              padding: '5px 16px',
                              borderRadius: '8px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              maxWidth: '80%',
                              textAlign: 'center'
                            }}>
                              🔔 {msg.message}
                            </span>
                          </div>
                        ) : (
                          /* Chat Message Bubble */
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: isOutgoing ? 'flex-end' : 'flex-start',
                              position: 'relative'
                            }}
                            className="chat-message-row"
                          >
                            <div style={{
                              maxWidth: '68%',
                              backgroundColor: isOutgoing ? '#DCF8C6' : '#FFFFFF', // WhatsApp green for sent, white for received
                              borderRadius: isOutgoing ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                              padding: '8px 12px 6px 12px',
                              boxShadow: '0 1px 2px rgba(11,20,26,0.12)',
                              position: 'relative',
                              wordBreak: 'break-word'
                            }}>
                              {/* Sender Name with their member color (Only on incoming or if different sender) */}
                              {!isOutgoing && (
                                <div style={{
                                  fontSize: '12.5px',
                                  fontWeight: 800,
                                  color: senderColor,
                                  marginBottom: '3px'
                                }}>
                                  {msg.sender_name}
                                </div>
                              )}

                              {/* Message Text with Highlighted Mentions */}
                              <div style={{ fontSize: '13.5px', color: '#111B21', lineHeight: '1.45' }}>
                                {renderMessageContent(msg.message)}
                              </div>

                              {/* Footer: Timestamp and double tick */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '4px',
                                marginTop: '4px'
                              }}>
                                <span style={{ fontSize: '10.5px', color: '#667781', fontWeight: 500 }}>
                                  {formatWhatsAppTime(msg.created_at)}
                                </span>
                                {isOutgoing && (
                                  <CheckCheck size={14} color="#53BDEB" />
                                )}
                                
                                {/* Delete message button on hover */}
                                <button
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    padding: '0 0 0 6px',
                                    color: '#94A3B8',
                                    opacity: 0.6
                                  }}
                                  title="Delete message"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Bottom Input Section */}
              <div style={{
                backgroundColor: '#F0F2F5',
                padding: '10px 18px',
                borderTop: '1px solid #D1D7DB',
                position: 'relative'
              }}>
                {/* Floating @ Mention Autocomplete Box */}
                {mentionQuery !== null && mentionSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    bottom: '68px',
                    left: '20px',
                    width: '280px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                    border: '1px solid #E2E8F0',
                    overflow: 'hidden',
                    zIndex: 100
                  }}>
                    <div style={{
                      padding: '8px 12px',
                      backgroundColor: '#F8FAFC',
                      borderBottom: '1px solid #E2E8F0',
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AtSign size={13} color="#2563EB" /> MENTION GROUP MEMBER
                    </div>
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {mentionSuggestions.map((m, idx) => (
                        <div
                          key={m.id}
                          onClick={() => insertMention(m.name)}
                          style={{
                            padding: '9px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            backgroundColor: idx === selectedMentionIndex ? '#EFF6FF' : '#FFFFFF',
                            borderBottom: '1px solid #F1F5F9'
                          }}
                          onMouseEnter={() => setSelectedMentionIndex(idx)}
                        >
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: m.avatar_color || '#2563EB',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700
                          }}>
                            {m.name.charAt(0).toUpperCase()}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                            {m.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sender Selector + Text Input Form */}
                <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Sender Pill Dropdown */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '24px',
                    padding: '4px 10px',
                    flexShrink: 0
                  }}>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>As:</span>
                    <select
                      value={currentSender}
                      onChange={(e) => setCurrentSender(e.target.value)}
                      style={{
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: getSenderColor(currentSender),
                        cursor: 'pointer'
                      }}
                    >
                      {activeGroupMembers && activeGroupMembers.length > 0 ? (
                        activeGroupMembers.map(m => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))
                      ) : (
                        <option value={currentSender}>{currentSender}</option>
                      )}
                    </select>
                  </div>

                  {/* Text Input */}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '24px',
                    border: '1px solid #CBD5E1',
                    padding: '0 14px'
                  }}>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder={`Type a message... Type @ to mention members`}
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        padding: '11px 4px',
                        fontSize: '13.5px',
                        color: '#111B21',
                        backgroundColor: 'transparent'
                      }}
                    />
                  </div>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: inputText.trim() ? '#16A34A' : '#94A3B8',
                      color: '#FFFFFF',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: inputText.trim() ? 'pointer' : 'default',
                      transition: 'background-color 0.15s ease',
                      flexShrink: 0
                    }}
                    title="Send message (Enter)"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* No Group Selected Placeholder */
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F0F2F5',
              padding: '40px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                marginBottom: '20px',
                fontSize: '54px'
              }}>
                💬
              </div>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: 800, color: '#1E293B' }}>
                1 to 1 Chat for Survey Portal
              </h2>
              <p style={{ margin: '0 0 24px 0', maxWidth: '440px', color: '#64748B', fontSize: '14px', lineHeight: '1.5' }}>
                Collaborate in real-time with advocates, legal staff, and survey teams. Send messages with WhatsApp-style timestamps and tag team members using <strong style={{ color: '#2563EB' }}>@ Mentions</strong>.
              </p>
              <button
                onClick={openCreateGroupModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(22, 163, 74, 0.25)'
                }}
              >
                <Plus size={18} /> Create New Group
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================== */}
      {/* MODAL 1: Create or Edit Group (with multi-member selector) */}
      {/* ========================================================== */}
      {isGroupModalOpen && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#F8FAFC'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>{groupForm.logo_url}</span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                  {editingGroup ? 'Edit Group Settings' : 'Create New Group'}
                </h3>
              </div>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveGroup} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {/* Group Logo Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                  Group Logo / Icon
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {GROUP_LOGOS.map(logo => (
                    <button
                      key={logo}
                      type="button"
                      onClick={() => setGroupForm(prev => ({ ...prev, logo_url: logo }))}
                      style={{
                        width: '38px',
                        height: '38px',
                        fontSize: '20px',
                        borderRadius: '8px',
                        border: groupForm.logo_url === logo ? '2px solid #2563EB' : '1px solid #CBD5E1',
                        backgroundColor: groupForm.logo_url === logo ? '#EFF6FF' : '#FFFFFF',
                        cursor: 'pointer'
                      }}
                    >
                      {logo}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group Name */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Group Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Legal Survey Coordination"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Group Description */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Group Description
                </label>
                <input
                  type="text"
                  placeholder="Brief description of purpose..."
                  value={groupForm.description}
                  onChange={(e) => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Select Members to Add (Multiple members in 1 time) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                    Select Group Members ({groupForm.member_ids.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (groupForm.member_ids.length === members.length) {
                        setGroupForm(prev => ({ ...prev, member_ids: [] }));
                      } else {
                        setGroupForm(prev => ({ ...prev, member_ids: members.map(m => m.id) }));
                      }
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#2563EB',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {groupForm.member_ids.length === members.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div style={{
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  padding: '6px'
                }}>
                  {members.map(m => {
                    const isChecked = groupForm.member_ids.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: isChecked ? '#F0FDF4' : 'transparent',
                          marginBottom: '2px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGroupForm(prev => ({ ...prev, member_ids: [...prev.member_ids, m.id] }));
                            } else {
                              setGroupForm(prev => ({ ...prev, member_ids: prev.member_ids.filter(id => id !== m.id) }));
                            }
                          }}
                          style={{ width: '16px', height: '16px', accentColor: '#16A34A', cursor: 'pointer' }}
                        />
                        <span style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: m.avatar_color || '#2563EB',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700
                        }}>
                          {m.name.charAt(0).toUpperCase()}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>{m.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
                    color: '#475569',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#16A34A',
                    color: '#FFFFFF',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {editingGroup ? 'Save Changes' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================== */}
      {/* MODAL 2: Add / Remove Members From Group Anytime */}
      {/* ========================================================== */}
      {isGroupMembersModalOpen && activeGroup && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '460px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#F8FAFC'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={18} color="#2563EB" />
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: '#0F172A' }}>
                  Manage Members of "{activeGroup.name}"
                </h3>
              </div>
              <button
                onClick={() => setIsGroupMembersModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#64748B' }}>
                Check members you want in this group, uncheck to remove them:
              </p>

              <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '6px' }}>
                {members.map(m => {
                  const isChecked = groupMembersForm.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: isChecked ? '#EFF6FF' : 'transparent',
                        marginBottom: '3px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setGroupMembersForm(prev => [...prev, m.id]);
                          } else {
                            setGroupMembersForm(prev => prev.filter(id => id !== m.id));
                          }
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#2563EB', cursor: 'pointer' }}
                      />
                      <span style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        backgroundColor: m.avatar_color || '#2563EB',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700
                      }}>
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>{m.name}</span>
                    </label>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setIsGroupMembersModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#F8FAFC',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGroupMembers}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563EB',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Update Group Members
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================== */}
      {/* MODAL 3: Manage All Members (Add, Edit name, Delete) */}
      {/* ========================================================== */}
      {isMemberModalOpen && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#F8FAFC'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="#4F46E5" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                  Manage Members Directory
                </h3>
              </div>
              <button
                onClick={() => setIsMemberModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              {/* Form to Add New Member */}
              <form onSubmit={handleAddMember} style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '20px'
              }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13.5px', fontWeight: 800, color: '#334155' }}>
                  + Add New Member
                </h4>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <input
                    type="text"
                    placeholder="Enter member name (e.g. Ramesh Legal Aid)"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    required
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#4F46E5',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Add Member
                  </button>
                </div>

                {/* Color Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Color:</span>
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewMemberColor(c)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: c,
                        border: newMemberColor === c ? '2.5px solid #0F172A' : 'none',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </form>

              {/* Members List */}
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: '#334155' }}>
                All Registered Members ({members.length})
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {members.map(m => {
                  const isEditingThis = editingMember && editingMember.id === m.id;

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: isEditingThis ? '#EFF6FF' : '#FFFFFF'
                      }}
                    >
                      {isEditingThis ? (
                        <form onSubmit={handleUpdateMember} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                          <input
                            type="text"
                            value={editingMember.name}
                            onChange={(e) => setEditingMember(prev => ({ ...prev, name: e.target.value }))}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: '1px solid #3B82F6',
                              fontSize: '13px',
                              outline: 'none'
                            }}
                          />
                          <button
                            type="submit"
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#2563EB',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMember(null)}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#F1F5F9',
                              color: '#475569',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              backgroundColor: m.avatar_color || '#2563EB',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 700
                            }}>
                              {m.name.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                                {m.name}
                              </div>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>
                                In {m.group_count || 0} groups
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => setEditingMember(m)}
                              style={{
                                border: '1px solid #CBD5E1',
                                background: '#F8FAFC',
                                color: '#475569',
                                borderRadius: '6px',
                                padding: '5px 8px',
                                cursor: 'pointer'
                              }}
                              title="Edit member name"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteMember(m.id, m.name)}
                              style={{
                                border: '1px solid #FECACA',
                                background: '#FEF2F2',
                                color: '#DC2626',
                                borderRadius: '6px',
                                padding: '5px 8px',
                                cursor: 'pointer'
                              }}
                              title="Delete member"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
