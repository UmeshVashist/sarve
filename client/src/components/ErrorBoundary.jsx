import React from 'react';
import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });

    const msg = error?.message || String(error || '');
    const isChunkError =
      msg.includes('dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module') ||
      error?.name === 'ChunkLoadError';

    if (isChunkError && typeof window !== 'undefined') {
      const lastReload = Number(sessionStorage.getItem('chunk_reload_timestamp') || '0');
      const now = Date.now();
      if (now - lastReload > 15000) {
        sessionStorage.setItem('chunk_reload_timestamp', String(now));
        window.location.reload();
      }
    }
  }

  handleResetCacheAndReload = () => {
    try {
      localStorage.removeItem('advocate_questions_list');
      localStorage.removeItem('advocate_questions_remarks_map');
      localStorage.removeItem('advocate_types_list');
      localStorage.removeItem('survey_questions_list');
      localStorage.removeItem('survey_questions_remarks_map');
    } catch (e) {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1.5px solid #FCA5A5',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            maxWidth: '560px',
            width: '100%',
            padding: '28px 32px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#FEE2E2',
              color: '#DC2626',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#1E293B', marginBottom: '8px' }}>
              Oops! Something went wrong
            </h3>

            <p style={{ fontSize: '13.5px', color: '#64748B', lineHeight: '1.5', marginBottom: '16px' }}>
              Module render karte waqt ek error aayi hai. Cache clear karke refresh karein ya Dashboard par wapas jayein.
            </p>

            <div style={{
              background: '#FEF2F2',
              color: '#991B1B',
              padding: '12px 14px',
              borderRadius: '10px',
              fontSize: '12.5px',
              textAlign: 'left',
              fontFamily: 'monospace',
              wordBreak: 'break-word',
              marginBottom: '20px',
              border: '1px solid #FECACA'
            }}>
              {this.state.error?.message || String(this.state.error)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleResetCacheAndReload}
                style={{
                  background: '#EA580C',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <RotateCcw size={16} />
                <span>Reset Cache & Reload</span>
              </button>

              {this.props.onBackToDashboard && (
                <button
                  type="button"
                  onClick={this.props.onBackToDashboard}
                  style={{
                    background: '#F1F5F9',
                    color: '#334155',
                    border: '1px solid #CBD5E1',
                    padding: '10px 18px',
                    borderRadius: '10px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Dashboard</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
