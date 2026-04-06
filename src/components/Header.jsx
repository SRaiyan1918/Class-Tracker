import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useState } from 'react';

export default function Header({ theme, onToggleTheme, user }) {
  const [showMenu, setShowMenu] = useState(false);

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Logout failed', e);
    }
  }

  return (
    <header className="header">
      <div className="header-content">

        {/* Logo */}
        <div className="logo-section">
          <div className="logo-icon">📚</div>
          <h1 className="app-title">ClassTracker</h1>
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>

          {/* Theme toggle */}
          <button className="theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
            <span className="theme-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
          </button>

          {/* User avatar + dropdown */}
          {user && (
            <div style={{ position: 'relative' }}>
              <button
                className="avatar-btn"
                onClick={() => setShowMenu(v => !v)}
                title={user.displayName}
              >
                {user.photoURL
                  ? <img src={user.photoURL} alt="avatar" className="avatar-img" referrerPolicy="no-referrer" />
                  : <span className="avatar-fallback">{user.displayName?.[0] || '👤'}</span>
                }
              </button>

              {showMenu && (
                <>
                  {/* Backdrop */}
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                    onClick={() => setShowMenu(false)}
                  />
                  {/* Dropdown */}
                  <div className="user-menu">
                    <div className="user-menu-info">
                      <p className="user-name">{user.displayName}</p>
                      <p className="user-email">{user.email}</p>
                    </div>
                    <hr className="user-menu-divider" />
                    <button className="user-menu-logout" onClick={handleLogout}>
                      🚪 Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
