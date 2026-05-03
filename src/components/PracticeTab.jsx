import { useState, useMemo } from 'react';
import { deleteDoc, doc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

const QUIZFORGE_URL = 'https://raiyan-quizforge.netlify.app';

const QUIZFORGE_SHEETS = [
  { id: 'KPP_01', title: 'KPP 01', chapter: 'Electrostatics', subject: 'Physics', totalQns: 15, totalTime: 2700 },
  { id: 'KPP_02', title: 'KPP 02', chapter: 'Electrostatics', subject: 'Physics', totalQns: 21, totalTime: 2700 },
  // Naye sheets yahan add karo jab QuizForge mein add karo
];

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Other'];

const EMPTY_FORM = {
  sheetName: '', subject: 'Physics', date: new Date().toISOString().split('T')[0],
  totalQns: '', correct: '', wrong: '', mode: 'quiz',
};

export default function PracticeTab({ practices, onRefresh, onNotify, user }) {
  const [searchQ, setSearchQ]         = useState('');
  const [filterSubject, setFilterSubject] = useState('All');
  const [activeSection, setActiveSection] = useState('sheets');
  const [showAddModal, setShowAddModal]   = useState(false);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);

  // ── Open QuizForge ──────────────────────────────────────────────────────
  const handleAttempt = (sheet) => {
    const uid = user?.uid;
    if (!uid) { onNotify('Please sign in first', 'error'); return; }
    window.open(`${QUIZFORGE_URL}?sheetId=${sheet.id}&uid=${uid}`, '_blank');
  };

  // ── Manual Add Sheet ────────────────────────────────────────────────────
  const handleAdd = async () => {
    const { sheetName, subject, date, totalQns, correct, wrong, mode } = form;
    if (!sheetName.trim()) { onNotify('Sheet name required', 'error'); return; }
    if (!totalQns || !correct) { onNotify('Total questions aur correct fill karo', 'error'); return; }

    const c = parseInt(correct) || 0;
    const w = parseInt(wrong)   || 0;
    const t = parseInt(totalQns)|| 0;
    const touched  = c + w;
    const skipped  = Math.max(0, t - touched);
    const accuracy = touched > 0 ? parseFloat(((c / touched) * 100).toFixed(1)) : 0.0;

    setSaving(true);
    try {
      await addDoc(collection(db, 'practices'), {
        uid:         user.uid,
        sheetId:     null,           // QuizForge se nahi hai
        sheetName:   sheetName.trim(),
        chapter:     sheetName.trim(),
        subject,
        date,
        totalQns:    t,
        correct:     c,
        wrong:       w,
        touched,
        skipped,
        accuracy,
        marks:       c * 4,
        totalMarks:  t * 4,
        timeTaken:   0,
        mode,
        status:      'completed',
        isReattempt: false,
        reattemptOf: null,
        details:     [],
        flagged:     [],
        timestamp:   new Date(),
        source:      'manual',       // QuizForge nahi, manual entry
      });
      onNotify('Sheet added successfully! ✅', 'success');
      setForm(EMPTY_FORM);
      setShowAddModal(false);
      onRefresh();
    } catch (e) {
      console.error(e);
      onNotify('Failed to add sheet', 'error');
    }
    setSaving(false);
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!confirm('Delete this entry?')) return;
    try {
      await deleteDoc(doc(db, 'practices', id));
      onRefresh();
      onNotify('Deleted successfully', 'success');
    } catch { onNotify('Failed to delete', 'error'); }
  }

  // ── Filtered history ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return (practices || []).filter(p => {
      const matchSubject = filterSubject === 'All' || p.subject === filterSubject;
      const q = searchQ.toLowerCase();
      const matchSearch = !q || p.sheetName?.toLowerCase().includes(q) || p.subject?.toLowerCase().includes(q);
      return matchSubject && matchSearch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [practices, searchQ, filterSubject]);

  // ── Summary ─────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const list = practices || [];
    const totalCorrect  = list.reduce((s, p) => s + (p.correct || 0), 0);
    const totalWrong    = list.reduce((s, p) => s + (p.wrong   || 0), 0);
    const totalTouched  = list.reduce((s, p) => s + (p.touched || 0), 0);
    const totalSkipped  = list.reduce((s, p) => s + (p.skipped || 0), 0);
    const avgAccuracy   = totalTouched > 0 ? ((totalCorrect / totalTouched) * 100).toFixed(1) : '0.0';
    return { total: list.length, totalCorrect, totalWrong, totalTouched, totalSkipped, avgAccuracy };
  }, [practices]);

  const sheetsBySubject = useMemo(() => {
    const map = {};
    QUIZFORGE_SHEETS.forEach(s => { if (!map[s.subject]) map[s.subject] = []; map[s.subject].push(s); });
    return map;
  }, []);

  const getSheetStats = (sheetId) => {
    const attempts = (practices || []).filter(p => p.sheetId === sheetId && p.status === 'completed')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return attempts.length ? { count: attempts.length, last: attempts[0] } : null;
  };

  // ── Shared button style ─────────────────────────────────────────────────
  const tabBtn = (isActive) => ({
    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)',
    cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
    background: isActive ? '#6c5ce7' : 'var(--surface)', color: isActive ? '#fff' : 'var(--text)',
    transition: 'all 0.2s',
  });

  return (
    <section className="tab-content active">

      {/* ── Header ── */}
      <div className="section-header">
        <h2>📋 Practice Tracker</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={tabBtn(activeSection === 'sheets')}  onClick={() => setActiveSection('sheets')}>📚 Sheets</button>
          <button style={tabBtn(activeSection === 'history')} onClick={() => setActiveSection('history')}>📜 History</button>
          <button
            style={{ ...tabBtn(false), background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
            onClick={() => setShowAddModal(true)}
          >+ Add Sheet</button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {summary.total > 0 && (
        <div className="practice-summary-grid">
          <div className="psum-card"><div className="psum-label">📚 Attempted</div><div className="psum-val">{summary.total}</div></div>
          <div className="psum-card green"><div className="psum-label">✅ Correct</div><div className="psum-val">{summary.totalCorrect}</div></div>
          <div className="psum-card red"><div className="psum-label">❌ Wrong</div><div className="psum-val">{summary.totalWrong}</div></div>
          <div className="psum-card orange"><div className="psum-label">⏭️ Skipped</div><div className="psum-val">{summary.totalSkipped}</div></div>
          <div className="psum-card blue"><div className="psum-label">🎯 Avg Accuracy</div><div className="psum-val">{summary.avgAccuracy}%</div></div>
        </div>
      )}

      {/* ══════════ SHEETS SECTION ══════════ */}
      {activeSection === 'sheets' && (
        <div style={{ marginTop: '8px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: '3px solid #6c5ce7' }}>
            🔗 QuizForge se connect hai — kisi bhi sheet pe "Attempt" karo
          </p>
          {Object.entries(sheetsBySubject).map(([subject, sheets]) => (
            <div key={subject} style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                {subject}
              </div>
              {sheets.map(sheet => {
                const stats    = getSheetStats(sheet.id);
                const mins     = Math.floor((sheet.totalTime || 600) / 60);
                const hasPaused = (practices || []).some(p => p.sheetId === sheet.id && p.status === 'paused');
                return (
                  <div key={sheet.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#a594f9', fontFamily: 'monospace', marginBottom: '3px' }}>{sheet.chapter}</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>{sheet.title}</div>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span>❓ {sheet.totalQns} Qns</span>
                        <span>◷ {mins} min</span>
                        {stats && <span>✅ {stats.last.accuracy}% last</span>}
                        {stats && <span>🔁 {stats.count}x attempted</span>}
                        {hasPaused && <span style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '1px 7px', borderRadius: '99px', fontWeight: 600 }}>⏸ Paused</span>}
                      </div>
                    </div>
                    <button onClick={() => handleAttempt(sheet)} style={{ background: '#6c5ce7', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Poppins, sans-serif' }}>
                      {hasPaused ? '▶ Resume' : stats ? '🔁 Reattempt' : '▶ Attempt'}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ══════════ HISTORY SECTION ══════════ */}
      {activeSection === 'history' && (
        <>
          {(practices || []).length > 0 && (
            <div className="practice-filters">
              <input className="practice-search" placeholder="🔍 Search sheet..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              <div className="filter-pills">
                {['All', ...SUBJECTS].map(s => (
                  <button key={s} className={`filter-pill ${filterSubject === s ? 'active' : ''}`} onClick={() => setFilterSubject(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div className="practices-list">
            {filtered.map(p => {
              const accColor   = p.accuracy >= 75 ? 'var(--accent-green)' : p.accuracy >= 50 ? 'var(--accent-orange)' : 'var(--accent-red)';
              const isQuizForge = p.source === 'quizforge';
              const isManual    = p.source === 'manual';
              return (
                <div className="practice-card" key={p.id}>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    {p.isReattempt && <span className="reattempt-badge">🔁 Reattempt</span>}
                    {p.status === 'paused' && <span className="reattempt-badge" style={{ background: 'var(--accent-orange)', color: '#fff' }}>⏸ Paused</span>}
                    {isQuizForge && <span className="reattempt-badge" style={{ background: '#6c5ce7', color: '#fff' }}>⚡ QuizForge</span>}
                    {isManual    && <span className="reattempt-badge" style={{ background: 'var(--accent-green)', color: '#fff' }}>✏️ Manual</span>}
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
                    <div className="practice-accuracy-badge" style={{ background: accColor }}>{p.accuracy}%</div>
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
                    <div className="ppbar-wrong"   style={{ width: `${p.totalQns > 0 ? (p.wrong   / p.totalQns) * 100 : 0}%` }} />
                  </div>

                  <div className="practice-card-actions">
                    {/* Deep Analysis — sirf QuizForge completed attempts ke liye */}
                    {isQuizForge && p.status === 'completed' && (
                      <button className="btn-action" style={{ background: 'rgba(108,92,231,0.12)', color: '#a594f9', border: '1px solid rgba(108,92,231,0.3)' }}
                        onClick={() => window.open(`${QUIZFORGE_URL}?reviewId=${p.id}&uid=${user?.uid}`, '_blank')}>
                        🔬 Deep Analysis
                      </button>
                    )}
                    {/* Reattempt — sirf QuizForge sheets ke liye */}
                    {isQuizForge && (
                      <button className="btn-action reattempt"
                        onClick={() => window.open(`${QUIZFORGE_URL}?sheetId=${p.sheetId}&uid=${user?.uid}`, '_blank')}>
                        🔁 Reattempt
                      </button>
                    )}
                    <button className="btn-action del" onClick={() => handleDelete(p.id)}>🗑️</button>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="empty-state">
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                <p>{(practices || []).length === 0 ? 'Koi attempt nahi. QuizForge se attempt karo ya "+ Add Sheet" se manually add karo!' : 'No results found.'}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════ ADD SHEET MODAL ══════════ */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' }}
          onClick={() => setShowAddModal(false)}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px', maxWidth: '420px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>✏️ Add Sheet Manually</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', borderLeft: '3px solid var(--accent-green)' }}>
              Ye entry sirf history mein dikhegi — Deep Analysis available nahi hogi kyunki QuizForge mein available nahi hai.
            </p>

            {/* Sheet Name */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Sheet Name *</label>
              <input
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontFamily: 'Poppins, sans-serif', fontSize: '14px', outline: 'none' }}
                placeholder="e.g. Gravitation DPP 01"
                value={form.sheetName}
                onChange={e => setForm(f => ({ ...f, sheetName: e.target.value }))}
              />
            </div>

            {/* Subject + Mode row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Subject *</label>
                <select
                  style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontFamily: 'Poppins, sans-serif', fontSize: '14px', outline: 'none' }}
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                >
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Mode</label>
                <select
                  style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontFamily: 'Poppins, sans-serif', fontSize: '14px', outline: 'none' }}
                  value={form.mode}
                  onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
                >
                  <option value="quiz">Quiz</option>
                  <option value="practice">Practice</option>
                </select>
              </div>
            </div>

            {/* Date */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Date *</label>
              <input
                type="date"
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontFamily: 'Poppins, sans-serif', fontSize: '14px', outline: 'none' }}
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            {/* Total, Correct, Wrong */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {[
                { key: 'totalQns', label: 'Total Qns *', placeholder: '30' },
                { key: 'correct',  label: 'Correct *',   placeholder: '20' },
                { key: 'wrong',    label: 'Wrong',        placeholder: '5'  },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>{label}</label>
                  <input
                    type="number" min="0" placeholder={placeholder}
                    style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 8px', color: 'var(--text)', fontFamily: 'Poppins, sans-serif', fontSize: '14px', outline: 'none', textAlign: 'center' }}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {/* Preview */}
            {form.totalQns && form.correct && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                {(() => {
                  const c = parseInt(form.correct)||0, w = parseInt(form.wrong)||0, t = parseInt(form.totalQns)||0;
                  const acc = (c+w) > 0 ? ((c/(c+w))*100).toFixed(1) : '0.0';
                  const skip = Math.max(0, t - c - w);
                  return `✅ ${c} correct · ❌ ${w} wrong · ⏭️ ${skip} skipped · 🎯 ${acc}% accuracy`;
                })()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontSize: '14px' }}>
                Cancel
              </button>
              <button onClick={handleAdd} disabled={saving} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#6c5ce7', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Poppins, sans-serif', fontSize: '14px', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
