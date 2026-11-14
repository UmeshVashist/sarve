import React from 'react';
import { LogOut, User, ShieldCheck } from 'lucide-react';

export default function Navbar({ user, onLogout, onHomeClick }) {
  return (
    <header className="app-header">
      <div className="header-brand" onClick={onHomeClick} title="Go to Dashboard">
        <span className="brand-badge">SARVE</span>
        <div>
          <div className="brand-title">Legal Sarve Portal</div>
          <div className="brand-subtitle">Prisoner & Advocacy Field Survey System</div>
        </div>
      </div>

      <div className="header-actions">
        {user && (
          <div className="user-badge">
            <span className="user-avatar">
              <User size={14} />
            </span>
            <span>{user.username}</span>
            <span style={{ fontSize: '11px', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <ShieldCheck size={13} /> Active
            </span>
          </div>
        )}

        <button className="btn-logout" onClick={onLogout} title="Sign Out">
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}

