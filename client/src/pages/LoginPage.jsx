import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim().toLowerCase();
    if (cleanUser === 'sarve') {
      setError('Username "sarve" is disabled. Please login using new username: meet');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        onLoginSuccess(data.user);
      } else {
        setError(data.message || 'Invalid username or password!');
      }
    } catch (err) {
      // Fallback local check if offline (ONLY case-insensitive meet)
      if (cleanUser === 'meet' && password === 'New@1020') {
        onLoginSuccess({ username: 'meet', role: 'Administrator', displayName: 'Survey Admin' });
      } else {
        setError('Server connection failed or invalid credentials. Check if backend is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card animate-slide-up">
        <div className="login-header">
          <div className="login-icon-box">
            <ShieldCheck size={32} />
          </div>
          <h1 className="login-title">Survey Portal Login</h1>
          <p className="login-desc">Sign in to access Prison & Advocate Survey Portals</p>
        </div>

        {error && (
          <div className="error-banner animate-fade-in">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input
                type="text"
                className="form-control"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn-toggle-pwd"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary-coral" disabled={loading} style={{ marginTop: '22px' }}>
            <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

