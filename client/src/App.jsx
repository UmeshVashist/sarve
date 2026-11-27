import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

// Code-split heavy page views for 10x faster initial loading & lightweight bundle
const PrisonerSurveyHome = lazy(() => import('./pages/PrisonerSurveyHome'));
const NewPrisonerSurveyHome = lazy(() => import('./pages/NewPrisonerSurveyHome'));
const AdvocateSurveyHome = lazy(() => import('./pages/AdvocateSurveyHome'));
const WebReviewHome = lazy(() => import('./pages/WebReviewHome'));
const RaastaFunctionHome = lazy(() => import('./pages/RaastaFunctionHome'));
const WorkRoleHome = lazy(() => import('./pages/WorkRoleHome'));
const DocStoreHome = lazy(() => import('./pages/DocStoreHome'));
const PassMsHome = lazy(() => import('./pages/PassMsHome'));

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes auto-logout

export default function App() {
  const [user, setUser] = useState(() => {
    // Check if session expired during tab close / idle
    const lastActive = sessionStorage.getItem('survey_last_active');
    if (lastActive && Date.now() - Number(lastActive) > INACTIVITY_TIMEOUT_MS) {
      sessionStorage.clear();
      localStorage.removeItem('survey_user');
      localStorage.removeItem('sarve_user');
      return null;
    }

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

  // Remember current screen across page reloads
  const [currentScreen, setCurrentScreen] = useState(() => {
    return localStorage.getItem('survey_current_screen') || localStorage.getItem('sarve_current_screen') || 'dashboard';
  });
  const [toastMessage, setToastMessage] = useState('');
  const lastActiveRef = useRef(Date.now());

  // Clean up any legacy offline cache data keys from browser localStorage
  useEffect(() => {
    const legacyKeys = [
      'local_survey_answers_map',
      'local_advocate_survey_answers_map',
      'survey_questions_list',
      'advocate_questions_list',
      'survey_questions_remarks_map',
      'advocate_questions_remarks_map',
      'advocate_types_list',
      'case_types_list',
      'court_types_list'
    ];
    legacyKeys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    });
  }, []);

  const navigateTo = (screen) => {
    setCurrentScreen(screen);
    try {
      localStorage.setItem('survey_current_screen', screen);
    } catch (e) {}
  };

  const handleLoginSuccess = (userData) => {
    const updatedUser = { ...userData, username: 'meet' };
    lastActiveRef.current = Date.now();
    try {
      sessionStorage.setItem('survey_last_active', String(Date.now()));
      localStorage.setItem('survey_user', JSON.stringify(updatedUser));
    } catch (e) {}
    setUser(updatedUser);
    navigateTo('dashboard');
  };

  const handleLogout = useCallback((reason = '') => {
    setUser(null);
    try {
      localStorage.removeItem('survey_user');
      localStorage.removeItem('sarve_user');
      localStorage.removeItem('survey_current_screen');
      localStorage.removeItem('sarve_current_screen');
      sessionStorage.removeItem('survey_last_active');
    } catch (e) {}
    setCurrentScreen('dashboard');

    if (reason === 'inactivity') {
      setToastMessage('Aap 10 minutes tak inactive the, isliye system ne security ke liye auto-logout kar diya hai. Kripya dobara login karein.');
      setTimeout(() => setToastMessage(''), 7000);
    }
  }, []);

  // 10-Minute Inactivity Auto-Logout Tracking
  useEffect(() => {
    if (!user) return;

    lastActiveRef.current = Date.now();
    try {
      sessionStorage.setItem('survey_last_active', String(Date.now()));
    } catch (e) {}

    const updateActivity = () => {
      lastActiveRef.current = Date.now();
      try {
        sessionStorage.setItem('survey_last_active', String(Date.now()));
      } catch (e) {}
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => window.addEventListener(evt, updateActivity, { passive: true }));

    // Check every 10 seconds if user has been inactive for >= 10 minutes
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - lastActiveRef.current;
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        handleLogout('inactivity');
      }
    }, 10000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, updateActivity));
      clearInterval(intervalId);
    };
  }, [user, handleLogout]);

  const handleSelectDashboardOption = (optionId) => {
    if (optionId === 'prisoner') {
      navigateTo('prisoner');
    } else if (optionId === 'new_prisoner') {
      navigateTo('new_prisoner');
    } else if (optionId === 'advocate') {
      navigateTo('advocate');
    } else if (optionId === 'web_review') {
      navigateTo('web_review');
    } else if (optionId === 'raasta') {
      navigateTo('raasta');
    } else if (optionId === 'work_role') {
      navigateTo('work_role');
    } else if (optionId === 'doc_store') {
      navigateTo('doc_store');
    } else if (optionId === 'pass_ms') {
      navigateTo('pass_ms');
    } else {
      navigateTo('dashboard');
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
        currentScreen={currentScreen}
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
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '14px', color: '#64748B' }}>
            <div style={{ width: '36px', height: '36px', border: '3.5px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Loading module...</span>
          </div>
        }>
          {currentScreen === 'dashboard' && (
            <DashboardPage onSelectOption={handleSelectDashboardOption} />
          )}

          {currentScreen === 'prisoner' && (
            <ErrorBoundary onBackToDashboard={() => navigateTo('dashboard')}>
              <PrisonerSurveyHome onBackToDashboard={() => navigateTo('dashboard')} />
            </ErrorBoundary>
          )}

          {currentScreen === 'new_prisoner' && (
            <ErrorBoundary onBackToDashboard={() => navigateTo('dashboard')}>
              <NewPrisonerSurveyHome onBackToDashboard={() => navigateTo('dashboard')} />
            </ErrorBoundary>
          )}

          {currentScreen === 'advocate' && (
            <ErrorBoundary onBackToDashboard={() => navigateTo('dashboard')}>
              <AdvocateSurveyHome onBackToDashboard={() => navigateTo('dashboard')} />
            </ErrorBoundary>
          )}

          {currentScreen === 'web_review' && (
            <ErrorBoundary onBackToDashboard={() => navigateTo('dashboard')}>
              <WebReviewHome onBackToDashboard={() => navigateTo('dashboard')} />
            </ErrorBoundary>
          )}

          {currentScreen === 'raasta' && (
            <ErrorBoundary onBackToDashboard={() => navigateTo('dashboard')}>
              <RaastaFunctionHome onBackToDashboard={() => navigateTo('dashboard')} />
            </ErrorBoundary>
          )}

          {currentScreen === 'work_role' && (
            <ErrorBoundary onBackToDashboard={() => navigateTo('dashboard')}>
              <WorkRoleHome onBackToDashboard={() => navigateTo('dashboard')} />
            </ErrorBoundary>
          )}

          {currentScreen === 'doc_store' && (
            <ErrorBoundary onBackToDashboard={() => navigateTo('dashboard')}>
              <DocStoreHome onBackToDashboard={() => navigateTo('dashboard')} />
            </ErrorBoundary>
          )}

          {currentScreen === 'pass_ms' && (
            <ErrorBoundary onBackToDashboard={() => navigateTo('dashboard')}>
              <PassMsHome onBackToDashboard={() => navigateTo('dashboard')} />
            </ErrorBoundary>
          )}
        </Suspense>
      </main>
    </div>
  );
}
