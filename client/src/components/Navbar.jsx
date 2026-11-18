import React from 'react';
import { LogOut, User, ShieldCheck, Scale, Users, LayoutDashboard } from 'lucide-react';

export default function Navbar({ user, currentScreen = 'dashboard', onLogout, onHomeClick }) {
  const getModuleConfig = () => {
    switch (currentScreen) {
      case 'prisoner':
        return {
          title: 'Prisoner Survey Module',
          badgeText: 'Prisoner Survey',
          subtitle: 'UT / CT Prisoner Field Records Management',
          bg: '#EFF6FF',
          color: '#1D4ED8',
          border: '#BFDBFE',
          icon: Users
        };
      case 'advocate':
        return {
          title: 'Advocate Survey Module',
          badgeText: 'Advocate Survey',
          subtitle: 'Advocate & Legal Practitioner Survey System',
          bg: '#FFF7ED',
          color: '#C2410C',
          border: '#FED7AA',
          icon: Scale
        };
      default:
        return {
          title: 'Main Dashboard',
          badgeText: 'Dashboard',
          subtitle: 'Prisoner & Advocacy Field Survey System',
          bg: '#F8FAFC',
          color: '#475569',
          border: '#E2E8F0',
          icon: LayoutDashboard
        };
    }
  };

  const currentMod = getModuleConfig();
  const IconComponent = currentMod.icon;

  return (
    <header className="app-header">
      <div className="header-brand" onClick={onHomeClick} title="Go to Dashboard">
        <span className="brand-badge">SURVEY</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="brand-title">Legal Survey Portal</span>

            {/* Active Module Pill */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 12px',
              borderRadius: '20px',
              fontSize: '12.5px',
              fontWeight: 800,
              background: currentMod.bg,
              color: currentMod.color,
              border: `1.5px solid ${currentMod.border}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}>
              <IconComponent size={14} />
              <span>{currentMod.title}</span>
            </span>
          </div>
          <div className="brand-subtitle">{currentMod.subtitle}</div>
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
