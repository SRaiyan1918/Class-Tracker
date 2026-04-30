import { useState, useMemo } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const EMPTY_FORM = {
  sheetName: '',
  subject: '',
  date: '',
  totalQns: '',
  correct: '',
  wrong: '',
};

function calcStats(correct, wrong, total) {
  const c = parseInt(correct) || 0;
  const w = parseInt(wrong) || 0;
  const t = parseInt(total) || 0;
  const touched = c + w;
  const skipped = Math.max(0, t - touched);
  const accuracy = touched > 0 ? ((c / touched) * 100).toFixed(1) : '0.0';
  return { touched, skipped, accuracy: parseFloat(accuracy) };
}

const SUBJECTS = ['Physics', 'Chemistry', 'Maths', 'Biology', 'Other'];

export default function PracticeTab({ practices, onRefresh, onNotify, user }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [reattemptOf, setReattemptOf] = useState(null); // original practice id
  const [searchQ, setSearchQ] = useState('');
  const [filterSubject, setFilterSubject] = useState('All');

  // Live preview stats while filling form
  const liveStats = useMemo(() => {
    if (!form.correct && !form.wrong) return null;
    return calcStats(form.correct, form.wrong, form.totalQns);
  }, [form.correct, form.wrong, form.totalQns]);

  function handleChange(e) {
    const { id, value } = e.target;
    setForm(prev => ({ ...prev, [id]: value }));
  }

  function openAdd() {
    setEditingId(null);
    setReattemptOf(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p) {
    setEditingId(p.id);
    setReattemptOf(null);
    setForm({
      sheetName: p.sheetName,
      subject: p.subject,
      date: p.date,
      totalQns: String(p.totalQns),
      correct: String(p.correct),
      wrong: String(p.wrong),
    });
    setShowForm(true);
  }

  function openReattempt(p) {
    setEditingId(null);
    setReattemptOf(p.id);
    setForm({
      sheetName: p.sheetName + ' (R)',
      subject: p.subject,
      date: new Date().toISOString().split('T')[0],
      totalQns: String(p.totalQns),
      correct: '',
      wrong: '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setReattemptOf(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const { touched, skipped, accuracy } = calcStats(form.correct, form.wrong, form.totalQns);
    const data = {
      sheetName: form.sheetName.trim(),
      subject: form.subject,
      date: form.date,
      totalQns: parseInt(form.totalQns),
      correct: parseInt(form.correct) || 0,
      wrong: parseInt(form.wrong) || 0,
      touched,
      skipped,
      accuracy,
      reattemptOf: reattemptOf || null,
      timestamp: new Date(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'practices', editingId), data);
        onNotify('Practice updated!', 'success');
      } else {
        await addDoc(collection(db, 'practices'), { ...data, uid: user.uid });
        onNotify(reattemptOf ? 'Reattempt added!' : 'Practice added!', 'success');
      }
      closeForm();
      onRefresh();
    } catch {
      onNotify('Failed to save practice', 'error');
    }
  }

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

  // Filtered list
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

  const formTitle = editingId ? '✏️ Edit Practice' : reattemptOf ? '🔁 Reattempt' : '➕ Add Practice';

  return (
    <section className="tab-content active">
      {/* Header */}
      <div className="section-header">
        <h2>📋 Practice Tracker</h2>
        <button className="btn-primary" onClick={openAdd}>
          <span>+</span> Add Practice
        </button>
      </div>

      {/* Summary Cards */}
      {(practices || []).length > 0 && (
        <div className="practice-summary-grid">
          <div className="psum-card">
            <div className="psum-label">📚 Sheets</div>
            <div className="psum-val">{summary.totalSheets}</div>
          </div>
          <div className="psum-card">
            <div className="psum-label">❓ Total Qns</div>
            <div className="psum-val">{summary.totalQns}</div>
          </div>
          <div className="psum-card green">
            <div className="psum-label">✅ Correct</div>
            <div className="psum-val">{summary.totalCorrect}</div>
          </div>
          <div className="psum-card red">
            <div className="psum-label">❌ Wrong</div>
            <div className="psum-val">{summary.totalWrong}</div>
          </div>
          <div className="psum-card orange">
            <div className="psum-label">⏭️ Skipped</div>
            <div className="psum-val">{summary.totalSkipped}</div>
          </div>
          <div className="psum-card blue">
            <div className="psum-label">🎯 Avg Accuracy</div>
            <div className="psum-val">{summary.avgAccuracy}%</div>
          </div>
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <form className="form-container" onSubmit={handleSubmit}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem', fontWeight: 700 }}>{formTitle}</h3>
          <div className="form-grid">

            <div className="form-group">
              <label htmlFor="sheetName">📄 Sheet Name</label>
              <input id="sheetName" value={form.sheetName} onChange={handleChange} placeholder="e.g., Mechanics DPP-12" required />
            </div>

            <div className="form-group">
              <label htmlFor="subject">📚 Subject</label>
              <select id="subject" value={form.subject} onChange={handleChange} required>
                <option value="">— Select Subject —</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="date">📅 Date</label>
              <input id="date" type="date" value={form.date} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label htmlFor="totalQns">❓ Total Questions</label>
              <input id="totalQns" type="number" min="1" value={form.totalQns} onChange={handleChange} placeholder="e.g., 30" required />
            </div>

            <div className="form-group">
              <label htmlFor="correct">✅ Correct</label>
              <input id="correct" type="number" min="0" value={form.correct} onChange={handleChange} placeholder="0" required />
            </div>

            <div className="form-group">
              <label htmlFor="wrong">❌ Wrong</label>
              <input id="wrong" type="number" min="0" value={form.wrong} onChange={handleChange} placeholder="0" required />
            </div>
          </div>

          {/* Live Preview */}
          {liveStats && (
            <div className="practice-live-preview">
              <span>👆 Touched: <strong>{liveStats.touched}</strong></span>
              <span>⏭️ Skipped: <strong>{liveStats.skipped}</strong></span>
              <span>🎯 Accuracy: <strong>{liveStats.accuracy}%</strong></span>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary">💾 Save</button>
            <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
          </div>
        </form>
      )}

      {/* Filters */}
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

      {/* Practices List */}
      <div className="practices-list">
        {filtered.map(p => {
          const accColor = p.accuracy >= 75 ? 'var(--accent-green)' : p.accuracy >= 50 ? 'var(--accent-orange)' : 'var(--accent-red)';
          return (
            <div className="practice-card" key={p.id}>
              {p.reattemptOf && (
                <span className="reattempt-badge">🔁 Reattempt</span>
              )}
              <div className="practice-card-top">
                <div>
                  <div className="practice-sheet-name">{p.sheetName}</div>
                  <div className="practice-meta">
                    <span>📚 {p.subject}</span>
                    <span>📅 {p.date}</span>
                  </div>
                </div>
                <div className="practice-accuracy-badge" style={{ background: accColor }}>
                  {p.accuracy}%
                </div>
              </div>

              <div className="practice-stats-row">
                <div className="pstat">
                  <span className="pstat-label">Total</span>
                  <span className="pstat-val">{p.totalQns}</span>
                </div>
                <div className="pstat green">
                  <span className="pstat-label">✅ Correct</span>
                  <span className="pstat-val">{p.correct}</span>
                </div>
                <div className="pstat red">
                  <span className="pstat-label">❌ Wrong</span>
                  <span className="pstat-val">{p.wrong}</span>
                </div>
                <div className="pstat purple">
                  <span className="pstat-label">👆 Touched</span>
                  <span className="pstat-val">{p.touched}</span>
                </div>
                <div className="pstat orange">
                  <span className="pstat-label">⏭️ Skipped</span>
                  <span className="pstat-val">{p.skipped}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="practice-progress-bar">
                <div
                  className="ppbar-correct"
                  style={{ width: `${p.totalQns > 0 ? (p.correct / p.totalQns) * 100 : 0}%` }}
                />
                <div
                  className="ppbar-wrong"
                  style={{ width: `${p.totalQns > 0 ? (p.wrong / p.totalQns) * 100 : 0}%` }}
                />
              </div>

              <div className="practice-card-actions">
                <button className="btn-action reattempt" onClick={() => openReattempt(p)}>🔁 Reattempt</button>
                <button className="btn-action edit" onClick={() => openEdit(p)}>✏️ Edit</button>
                <button className="btn-action del" onClick={() => handleDelete(p.id)}>🗑️</button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="empty-state">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <p>{(practices || []).length === 0 ? 'No practice added yet. Start by clicking "+ Add Practice"!' : 'No results found.'}</p>
          </div>
        )}
      </div>
    </section>
  );
}
