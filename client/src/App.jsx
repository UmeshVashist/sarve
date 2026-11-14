import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PrisonerSurveyHome from './pages/PrisonerSurveyHome';
import Navbar from './components/Navbar';
import './App.css';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('sarve_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Remember current screen across page reloads (Stay on Prisoner Survey if reloaded!)
  const [currentScreen, setCurrentScreen] = useState(() => {
    return localStorage.getItem('sarve_current_screen') || 'dashboard';
  });
  const [toastMessage, setToastMessage] = useState('');

  const navigateTo = (screen) => {
    setCurrentScreen(screen);
    localStorage.setItem('sarve_current_screen', screen);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('sarve_user', JSON.stringify(userData));
    navigateTo('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sarve_user');
    localStorage.removeItem('sarve_current_screen');
    setCurrentScreen('dashboard');
  };

  const handleSelectDashboardOption = (optionId) => {
    if (optionId === 'prisoner') {
      navigateTo('prisoner');
    } else {
      const labels = {
        advocate: 'Advocate Sarve',
        citizen: 'Citizen Sarve',
        other: 'Other Survey'
      };
      setToastMessage(`${labels[optionId] || optionId} portal module is currently in development and will be activated in the next phase! Please explore "Prisoner Sarve".`);
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
      </main>
    </div>
  );
}
