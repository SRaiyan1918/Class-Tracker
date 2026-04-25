import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '../firebase';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleGoogleLogin() {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, provider);
      // App.jsx ka onAuthStateChanged automatically handle karega
    } catch (e) {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Logo + Title */}
        <div className="login-logo">📚</div>
        <h1 className="login-title">ClassTracker</h1>
        <p className="login-subtitle">Track your classes, tests & progress</p>

        {/* Features list */}
        <div className="login-features">
          <div className="login-feature-item">📅 Daily class tracking</div>
          <div className="login-feature-item">🧪 Test score analytics</div>
          <div className="login-feature-item">📊 Monthly progress reports</div>
          <div className="login-feature-item">🔒 Your data, only yours</div>
        </div>

        {/* Google Sign In Button */}
        <button
          className="google-login-btn"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          {loading ? (
            <span className="login-spinner" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
          )}
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        {error && <p className="login-error">{error}</p>}

        <p className="login-footer">
          Free forever · No ads · Your data is private
        </p>

        {/* Contact Us */}
        <p style={{
          marginTop: '1rem',
          fontSize: '0.82rem',
          color: 'var(--text-secondary, #64748b)',
          textAlign: 'center',
        }}>
          📬 Contact Us:{' '}
          <a
            href="https://t.me/md_shagaf_raiyan_rashid"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#3b82f6',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            t.me/md_shagaf_raiyan_rashid
          </a>
        </p>

      </div>
    </div>
  );
}
