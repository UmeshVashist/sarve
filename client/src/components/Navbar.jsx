import React from 'react';
import { LogOut, User, ShieldCheck, Scale, Users, LayoutDashboard, Globe, Compass, Briefcase, FolderArchive } from 'lucide-react';

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
      case 'new_prisoner':
        return {
          title: 'New Prisoner Module',
          badgeText: 'New Prisoner',
          subtitle: 'UT / CT New Prisoner Field Records Management',
          bg: '#EEF2FF',
          color: '#4338CA',
          border: '#C7D2FE',
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
      case 'web_review':
        return {
          title: 'Web Review Module',
          badgeText: 'Web Review',
          subtitle: 'Website URL & Performance Reviews Directory',
          bg: '#F0FDF4',
          color: '#15803D',
          border: '#BBF7D0',
          icon: Globe
        };
      case 'raasta':
        return {
          title: 'Raasta Function Module',
          badgeText: 'Raasta Function',
          subtitle: 'Portal Operations, Functions & Execution Details',
          bg: '#FAF5FF',
          color: '#7E22CE',
          border: '#E9D5FF',
          icon: Compass
        };
      case 'work_role':
        return {
          title: 'Work Role Module',
          badgeText: 'Work Role',
          subtitle: 'Organizational Roles & Work Task Allocation',
          bg: '#FEF3C7',
          color: '#B45309',
          border: '#FDE68A',
          icon: Briefcase
        };
      case 'doc_store':
        return {
          title: 'Doc Store Module',
          badgeText: 'Doc Store',
          subtitle: 'Cloudflare R2 Object Storage & Directory Manager',
          bg: '#CCFBF1',
          color: '#0D9488',
          border: '#99F6E4',
          icon: FolderArchive
        };
      default:
        return {
          title: 'Main Dashboard',
          badgeText: 'Dashboard',
          subtitle: 'Legal Survey, Web Review & Operations System',
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
