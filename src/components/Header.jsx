export default function Header({ theme, onToggleTheme }) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo-section">
          <div className="logo-icon">📚</div>
          <h1 className="app-title">ClassTracker</h1>
        </div>
        <button className="theme-toggle" onClick={onToggleTheme} aria-label="Toggle theme">
          <span className="theme-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
        </button>
      </div>
    </header>
  );
}
