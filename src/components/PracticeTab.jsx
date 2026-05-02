import { useState, useMemo } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

// ── QuizForge URL — apna deployed URL yahan likho ──
const QUIZFORGE_URL = 'https://raiyan-quizforge.netlify.app/';

// ── Yahan wahi sheets likho jo QuizForge mein hain ──
// id aur baaki fields QuizForge ke JSON se match karni chahiye
const QUIZFORGE_SHEETS = [
  { id: 'KPP_01', title: 'KPP 01 : Electrostatics', chapter: 'Electrostatics', subject: 'Physics', totalQns: 15, totalTime: 2700 },
  { id: 'KPP_02', title: 'Matrices : DPP 01',       chapter: 'Matrices',       subject: 'Mathematics', totalQns: 10, totalTime: 900 },
  // Naye sheets yahan add karo jab QuizForge mein add karo
];

const SUBJECTS = ['Physics', 'Chemistry', 'Maths', 'Mathematics', 'Biology', 'Other'];

function calcStats(correct, wrong, total) {
  const c = parseInt(correct) || 0;
  const w = parseInt(wrong) || 0;
  const t = parseInt(total) || 0;
  const touched = c + w;
  const skipped = Math.max(0, t - touched);
  const accuracy = touched > 0 ? ((c / touched) * 100).toFixed(1) : '0.0';
  return { touched, skipped, accuracy: parseFloat(accuracy) };
}

export default function PracticeTab({ practices, onRefresh, onNotify, user }) {
  const [searchQ, setSearchQ] = useState('');
  const [filterSubject, setFilterSubject] = useState('All');
  const [activeSection, setActiveSection] = useState('sheets'); // 'sheets' | 'history'

  // Open QuizForge for a specific sheet
  const handleAttempt = (sheet) => {
    const url = `${QUIZFORGE_URL}?sheetId=${sheet.id}`;
    window.open(url, '_blank');
  };

  // Filtered practice history
  const filtered = useMemo(() => {
    return (practices || []).filter(p => {
      const matchSubject = filterSubject === 'All' || p.subject === filterSubject;
      const q = searchQ.toLowerCase();
      const matchSearch = !q || p.sheetName?.toLowerCase().includes(q) || p.subject?.toLowerCase().includes(q);
      return matchSubject && matchSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [practices, searchQ, filterSubject]);

  // Summary stats
  const summary = useMemo(() => {
    const list = practices || [];
    const totalSheets = list.length;
    const totalQns = list.reduce((s, p) => s + (p.totalQns || 0), 0);
    const totalCorrect = list.reduce((s, p) => s + (p.correct || 0), 0);
    const totalWrong = list.reduce((s, p) => s + (p.wrong || 0), 0);
    const totalTouched = list.reduce((s, p) => s + (p.touched || 0), 0);
    const totalSkipped = list.reduce((s, p) => s + (p.skipped || 0), 0);
    const avgAccuracy = totalTouched > 0 ? ((totalCorrect / totalTouched) * 100).toFixed(1) : '0.0';
    return { totalSheets, totalQns, totalCorrect, totalWrong, totalTouched, totalSkipped, avgAccuracy };
  }, [practices]);

  async function handleDelete(id) {
    if (!confirm('Delete this practice entry?')) return;
    try {
      await deleteDoc(doc(db, 'practices', id));
      onRefresh();
      onNotify('Deleted successfully', 'success');
    } catch {
      onNotify('Failed to delete', 'error');
    }
  }

  // Group sheets by subject for display
  const sheetsBySubject = useMemo(() => {
    const map = {};
    QUIZFORGE_SHEETS.forEach(s => {
      if (!map[s.subject]) map[s.subject] = [];
      map[s.subject].push(s);
    });
    return map;
  }, []);

  // Get last attempt for a sheet from practices
  const getSheetStats = (sheetId) => {
    const attempts = (practices || [])
      .filter(p => p.sheetId === sheetId && p.status === 'completed')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    if (attempts.length === 0) return null;
    return { count: attempts.length, last: attempts[0] };
  };

  return (
    <section className="tab-content active">
      {/* Header */}
      <div className="section-header">
        <h2>📋 Practice Tracker</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)',
              cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
              background: activeSection === 'sheets' ? '#6c5ce7' : 'var(--surface)',
              color: activeSection === 'sheets' ? '#fff' : 'var(--text)',
              transition: 'all 0.2s'
            }}
            onClick={() => setActiveSection('sheets')}
          >📚 Sheets</button>
          <button
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)',
              cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
              background: activeSection === 'history' ? '#6c5ce7' : 'var(--surface)',
              color: activeSection === 'history' ? '#fff' : 'var(--text)',
              transition: 'all 0.2s'
            }}
            onClick={() => setActiveSection('history')}
          >📜 History</button>
        </div>
      </div>

      {/* Summary Cards */}
      {(practices || []).length > 0 && (
        <div className="practice-summary-grid">
          <div className="psum-card"><div className="psum-label">📚 Attempted</div><div className="psum-val">{summary.totalSheets}</div></div>
          <div className="psum-card"><div className="psum-label">❓ Total Qns</div><div className="psum-val">{summary.totalQns}</div></div>
          <div className="psum-card green"><div className="psum-label">✅ Correct</div><div className="psum-val">{summary.totalCorrect}</div></div>
          <div className="psum-card red"><div className="psum-label">❌ Wrong</div><div className="psum-val">{summary.totalWrong}</div></div>
          <div className="psum-card orange"><div className="psum-label">⏭️ Skipped</div><div className="psum-val">{summary.totalSkipped}</div></div>
          <div className="psum-card blue"><div className="psum-label">🎯 Avg Accuracy</div><div className="psum-val">{summary.avgAccuracy}%</div></div>
        </div>
      )}

      {/* ── SHEETS SECTION ── */}
      {activeSection === 'sheets' && (
        <div style={{ marginTop: '8px' }}>
          <p style={{
            fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px',
            padding: '8px 12px', background: 'var(--bg-secondary)',
            borderRadius: '8px', borderLeft: '3px solid #6c5ce7'
          }}>
            🔗 QuizForge se connect hai — kisi bhi sheet pe "Attempt" karo
          </p>
          {Object.entries(sheetsBySubject).map(([subject, sheets]) => (
            <div key={subject} style={{ marginBottom: '20px' }}>
              <div style={{
                fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '1px', color: 'var(--text-muted)',
                marginBottom: '8px', padding: '0 4px'
              }}>{subject}</div>
              {sheets.map(sheet => {
                const stats = getSheetStats(sheet.id);
                const mins = Math.floor((sheet.totalTime || 600) / 60);
                const hasPaused = (practices || []).some(p => p.sheetId === sheet.id && p.status === 'paused');
                return (
                  <div key={sheet.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: '12px', background: 'var(--card-bg)', border: '1px solid var(--border)',
                    borderRadius: '12px', padding: '14px 16px', marginBottom: '8px',
                    transition: 'border-color 0.2s'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#a594f9', fontFamily: 'monospace', marginBottom: '3px' }}>
                        {sheet.chapter}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                        {sheet.title}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>❓ {sheet.totalQns} Qns</span>
                        <span>◷ {mins} min</span>
                        {stats && <span>✅ {stats.last.accuracy}% last</span>}
                        {stats && <span>🔁 {stats.count}x attempted</span>}
                        {hasPaused && (
                          <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '1px 7px', borderRadius: '99px', fontWeight: 600 }}>
                            ⏸ Paused
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAttempt(sheet)}
                      style={{
                        background: '#6c5ce7', color: '#fff', border: 'none',
                        borderRadius: '8px', padding: '8px 16px', fontSize: '13px',
                        fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                        fontFamily: 'Poppins, sans-serif', transition: 'all 0.2s'
                      }}
                    >
                      {hasPaused ? '▶ Resume' : stats ? '🔁 Reattempt' : '▶ Attempt'}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ── HISTORY SECTION ── */}
      {activeSection === 'history' && (
        <>
          {(practices || []).length > 0 && (
            <div className="practice-filters">
              <input
                className="practice-search"
                placeholder="🔍 Search sheet..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              <div className="filter-pills">
                {['All', ...SUBJECTS].map(s => (
                  <button
                    key={s}
                    className={`filter-pill ${filterSubject === s ? 'active' : ''}`}
                    onClick={() => setFilterSubject(s)}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          <div className="practices-list">
            {filtered.map(p => {
              const accColor = p.accuracy >= 75 ? 'var(--accent-green)' : p.accuracy >= 50 ? 'var(--accent-orange)' : 'var(--accent-red)';
              return (
                <div className="practice-card" key={p.id}>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    {p.isReattempt && <span className="reattempt-badge">🔁 Reattempt</span>}
                    {p.status === 'paused' && <span className="reattempt-badge" style={{background:'var(--accent-orange)', color:'#fff'}}>⏸ Paused</span>}
                    {p.source === 'quizforge' && <span className="reattempt-badge" style={{background:'#6c5ce7', color:'#fff'}}>⚡ QuizForge</span>}
                  </div>
                  <div className="practice-card-top">
                    <div>
                      <div className="practice-sheet-name">{p.sheetName}</div>
                      <div className="practice-meta">
                        <span>📚 {p.subject}</span>
                        <span>📅 {p.date}</span>
                        {p.mode && <span>🎮 {p.mode}</span>}
                      </div>
                    </div>
                    <div className="practice-accuracy-badge" style={{ background: accColor }}>
                      {p.accuracy}%
                    </div>
                  </div>

                  <div className="practice-stats-row">
                    <div className="pstat"><span className="pstat-label">Total</span><span className="pstat-val">{p.totalQns}</span></div>
                    <div className="pstat green"><span className="pstat-label">✅ Correct</span><span className="pstat-val">{p.correct}</span></div>
                    <div className="pstat red"><span className="pstat-label">❌ Wrong</span><span className="pstat-val">{p.wrong}</span></div>
                    <div className="pstat purple"><span className="pstat-label">👆 Touched</span><span className="pstat-val">{p.touched}</span></div>
                    <div className="pstat orange"><span className="pstat-label">⏭️ Skipped</span><span className="pstat-val">{p.skipped}</span></div>
                  </div>

                  <div className="practice-progress-bar">
                    <div className="ppbar-correct" style={{ width: `${p.totalQns > 0 ? (p.correct / p.totalQns) * 100 : 0}%` }} />
                    <div className="ppbar-wrong" style={{ width: `${p.totalQns > 0 ? (p.wrong / p.totalQns) * 100 : 0}%` }} />
                  </div>

                  <div className="practice-card-actions">
                    <button className="btn-action reattempt" onClick={() => window.open(`${QUIZFORGE_URL}?sheetId=${p.sheetId}`, '_blank')}>
                      🔁 Reattempt
                    </button>
                    <button className="btn-action del" onClick={() => handleDelete(p.id)}>🗑️</button>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="empty-state">
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                <p>{(practices || []).length === 0 ? 'Koi attempt nahi hua abhi. QuizForge se koi sheet attempt karo!' : 'No results found.'}</p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
