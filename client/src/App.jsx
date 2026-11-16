import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PrisonerSurveyHome from './pages/PrisonerSurveyHome';
import AdvocateSurveyHome from './pages/AdvocateSurveyHome';
import Navbar from './components/Navbar';
import './App.css';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('survey_user') || localStorage.getItem('sarve_user');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.username === 'sarve' || parsed.username === 'meet')) {
        return { ...parsed, username: 'meet' };
      }
      return parsed;
    } catch (e) {
      return null;
    }
  });

  // Remember current screen across page reloads (Stay on Prisoner Survey if reloaded!)
  const [currentScreen, setCurrentScreen] = useState(() => {
    return localStorage.getItem('survey_current_screen') || localStorage.getItem('sarve_current_screen') || 'dashboard';
  });
  const [toastMessage, setToastMessage] = useState('');

  const navigateTo = (screen) => {
    setCurrentScreen(screen);
    localStorage.setItem('survey_current_screen', screen);
  };

  const handleLoginSuccess = (userData) => {
    const updatedUser = { ...userData, username: 'meet' };
    setUser(updatedUser);
    localStorage.setItem('survey_user', JSON.stringify(updatedUser));
    navigateTo('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('survey_user');
    localStorage.removeItem('sarve_user');
    localStorage.removeItem('survey_current_screen');
    localStorage.removeItem('sarve_current_screen');
    setCurrentScreen('dashboard');
  };

  const handleSelectDashboardOption = (optionId) => {
    if (optionId === 'prisoner') {
      navigateTo('prisoner');
    } else if (optionId === 'advocate') {
      navigateTo('advocate');
    } else {
      const labels = {
        citizen: 'Citizen Survey',
        other: 'Other Survey'
      };
      setToastMessage(`${labels[optionId] || optionId} portal module is currently in development and will be activated in the next phase!`);
      setTimeout(() => setToastMessage(''), 5000);
    }
  };

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Global Top Navbar */}
      <Navbar
        user={user}
        onLogout={handleLogout}
        onHomeClick={() => navigateTo('dashboard')}
      />

      {/* Optional Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '76px',
          right: '24px',
          background: '#1E293B',
          color: '#FFFFFF',
          padding: '14px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          zIndex: 999,
          maxWidth: '420px',
          fontSize: '13.5px',
          lineHeight: '1.4',
          border: '1px solid rgba(255,255,255,0.1)',
          animation: 'slideUp 0.2s ease-out'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Main Pages */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentScreen === 'dashboard' && (
          <DashboardPage onSelectOption={handleSelectDashboardOption} />
        )}

        {currentScreen === 'prisoner' && (
          <PrisonerSurveyHome onBackToDashboard={() => navigateTo('dashboard')} />
        )}

        {currentScreen === 'advocate' && (
          <AdvocateSurveyHome onBackToDashboard={() => navigateTo('dashboard')} />
        )}
      </main>
    </div>
  );
}
