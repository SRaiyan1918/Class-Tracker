import { useState, useMemo } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const EMPTY_FORM = {
  sheetName: '',
  subject: '',
  date: '',
  totalQns: '',
  attempted: '',
  revisionInput: '',
};

const SUBJECTS = ['Physics', 'Chemistry', 'Maths', 'Biology', 'Other'];

// Parse "3, 7, 12 15" style input into a clean, sorted, unique array of numbers
function parseRevisionInput(str) {
  if (!str) return [];
  return [...new Set(
    str
      .split(/[,\s]+/)
      .map(x => x.trim())
      .filter(Boolean)
      .map(x => parseInt(x))
      .filter(x => !isNaN(x) && x > 0)
  )].sort((a, b) => a - b);
}

function calcProgress(totalQns, attempted) {
  const t = parseInt(totalQns) || 0;
  const a = Math.min(parseInt(attempted) || 0, t);
  const remaining = Math.max(0, t - a);
  const pct = t > 0 ? Math.round((a / t) * 100) : 0;
  return { total: t, attempted: a, remaining, pct };
}

// Backward-compatible readers for old test-style entries saved before this update
function getAttempted(p) {
  if (p.attempted !== undefined && p.attempted !== null) return p.attempted;
  if (p.touched !== undefined) return p.touched; // old schema fallback
  return 0;
}
function getRevisionQns(p) {
  return Array.isArray(p.revisionQns) ? p.revisionQns : [];
}

export default function PracticeTab({ practices, onRefresh, onNotify, user }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [filterSubject, setFilterSubject] = useState('All');
  const [revisionOnly, setRevisionOnly] = useState(false);

  const liveProgress = useMemo(() => {
    if (!form.totalQns) return null;
    return calcProgress(form.totalQns, form.attempted);
  }, [form.totalQns, form.attempted]);

  const liveRevisionCount = useMemo(() => parseRevisionInput(form.revisionInput).length, [form.revisionInput]);

  function handleChange(e) {
    const { id, value } = e.target;
    setForm(prev => ({ ...prev, [id]: value }));
  }

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p) {
    setEditingId(p.id);
    setForm({
      sheetName: p.sheetName,
      subject: p.subject,
      date: p.date,
      totalQns: String(p.totalQns),
      attempted: String(getAttempted(p)),
      revisionInput: getRevisionQns(p).join(', '),
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const { total, attempted, remaining } = calcProgress(form.totalQns, form.attempted);
    const revisionQns = parseRevisionInput(form.revisionInput);
    const data = {
      sheetName: form.sheetName.trim(),
      subject: form.subject,
      date: form.date,
      totalQns: total,
      attempted,
      remaining,
      revisionQns,
      timestamp: new Date(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'practices', editingId), data);
        onNotify('Practice updated!', 'success');
      } else {
        await addDoc(collection(db, 'practices'), { ...data, uid: user.uid });
        onNotify('Practice added!', 'success');
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

  // Clear a single question number off the revision list once it's been revised
  async function handleClearRevision(p, num) {
    const updated = getRevisionQns(p).filter(n => n !== num);
    try {
      await updateDoc(doc(db, 'practices', p.id), { revisionQns: updated });
      onRefresh();
    } catch {
      onNotify('Failed to update revision list', 'error');
    }
  }

  // Filtered list
  const filtered = useMemo(() => {
    return (practices || []).filter(p => {
      const matchSubject = filterSubject === 'All' || p.subject === filterSubject;
      const q = searchQ.toLowerCase();
      const matchSearch = !q || p.sheetName?.toLowerCase().includes(q) || p.subject?.toLowerCase().includes(q);
      const matchRevision = !revisionOnly || getRevisionQns(p).length > 0;
      return matchSubject && matchSearch && matchRevision;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [practices, searchQ, filterSubject, revisionOnly]);

  // Summary stats
  const summary = useMemo(() => {
    const list = practices || [];
    const totalSheets = list.length;
    const totalQns = list.reduce((s, p) => s + (p.totalQns || 0), 0);
    const totalAttempted = list.reduce((s, p) => s + getAttempted(p), 0);
    const totalRemaining = Math.max(0, totalQns - totalAttempted);
    const totalRevisionPending = list.reduce((s, p) => s + getRevisionQns(p).length, 0);
    return { totalSheets, totalQns, totalAttempted, totalRemaining, totalRevisionPending };
  }, [practices]);

  const formTitle = editingId ? '✏️ Edit Practice' : '➕ Add Practice';

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
            <div className="psum-label">👆 Attempted</div>
            <div className="psum-val">{summary.totalAttempted}</div>
          </div>
          <div className="psum-card blue">
            <div className="psum-label">⏭️ Remaining</div>
            <div className="psum-val">{summary.totalRemaining}</div>
          </div>
          <div className="psum-card orange">
            <div className="psum-label">🔁 To Revise</div>
            <div className="psum-val">{summary.totalRevisionPending}</div>
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
              <input id="totalQns" type="number" min="1" value={form.totalQns} onChange={handleChange} placeholder="e.g., 50" required />
            </div>

            <div className="form-group">
              <label htmlFor="attempted">👆 Attempted So Far</label>
              <input id="attempted" type="number" min="0" value={form.attempted} onChange={handleChange} placeholder="e.g., 30" required />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="revisionInput">🔁 Question Numbers To Revise (jo nahi bane)</label>
              <input
                id="revisionInput"
                value={form.revisionInput}
                onChange={handleChange}
                placeholder="e.g., 3, 7, 12, 21, 34"
              />
            </div>
          </div>

          {/* Live Preview */}
          {liveProgress && (
            <div className="practice-live-preview">
              <span>👆 Attempted: <strong>{liveProgress.attempted}</strong></span>
              <span>⏭️ Remaining: <strong>{liveProgress.remaining}</strong></span>
              <span>🔁 To Revise: <strong>{liveRevisionCount}</strong></span>
              <span>📊 Progress: <strong>{liveProgress.pct}%</strong></span>
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
            <button
              className={`filter-pill ${revisionOnly ? 'active' : ''}`}
              onClick={() => setRevisionOnly(v => !v)}
            >🔁 Revision Pending</button>
          </div>
        </div>
      )}

      {/* Practices List */}
      <div className="practices-list">
        {filtered.map(p => {
          const { total, attempted, remaining, pct } = calcProgress(p.totalQns, getAttempted(p));
          const revisionQns = getRevisionQns(p);
          const badgeColor = revisionQns.length > 0
            ? 'var(--accent-orange)'
            : remaining > 0
              ? 'var(--primary-color)'
              : 'var(--accent-green)';
          const badgeText = revisionQns.length > 0
            ? `🔁 ${revisionQns.length} to revise`
            : remaining > 0
              ? `📝 ${remaining} left`
              : '✅ Complete';

          return (
            <div className="practice-card" key={p.id}>
              <div className="practice-card-top">
                <div>
                  <div className="practice-sheet-name">{p.sheetName}</div>
                  <div className="practice-meta">
                    <span>📚 {p.subject}</span>
                    <span>📅 {p.date}</span>
                  </div>
                </div>
                <div className="practice-accuracy-badge" style={{ background: badgeColor }}>
                  {badgeText}
                </div>
              </div>

              <div className="practice-stats-row">
                <div className="pstat">
                  <span className="pstat-label">Total</span>
                  <span className="pstat-val">{total}</span>
                </div>
                <div className="pstat green">
                  <span className="pstat-label">👆 Attempted</span>
                  <span className="pstat-val">{attempted}</span>
                </div>
                <div className="pstat orange">
                  <span className="pstat-label">⏭️ Remaining</span>
                  <span className="pstat-val">{remaining}</span>
                </div>
                <div className="pstat purple">
                  <span className="pstat-label">🔁 To Revise</span>
                  <span className="pstat-val">{revisionQns.length}</span>
                </div>
              </div>

              {/* Progress bar: attempted vs total */}
              <div className="practice-progress-bar">
                <div
                  className="ppbar-correct"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Revision question numbers */}
              {revisionQns.length > 0 && (
                <div className="revision-chip-block">
                  <div className="revision-chip-label">🔁 Revise these questions (tap ✕ once done):</div>
                  <div className="revision-chip-list">
                    {revisionQns.map(num => (
                      <span className="revision-chip" key={num}>
                        Q{num}
                        <button
                          type="button"
                          className="revision-chip-clear"
                          onClick={() => handleClearRevision(p, num)}
                          title="Mark revised"
                        >✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="practice-card-actions">
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
