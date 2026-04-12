import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
};
const DAY_SHORT = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
};

const EMPTY_CLASS = { subject: '', teacher: '', chapter: '' };

function getSundayOfWeek(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString('en-CA');
}

function getNextSunday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString('en-CA');
}

function getThisSunday() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toLocaleDateString('en-CA');
}

export default function WeeklyPlan({ user, onNotify }) {
  const [plans, setPlans]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [activeDay, setActiveDay]   = useState('monday');
  const [weekStart, setWeekStart]   = useState(getNextSunday());

  // draft: { monday: [{subject,teacher,chapter},...], ... }
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(DAYS.map(d => [d, []]))
  );
  const [copyModal, setCopyModal] = useState(null); // { fromDay } or null

  /* ── Load plans ── */
  async function loadPlans() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'weeklyPlans'), where('uid', '==', user.uid)));
      setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) {
      alert('Load error: ' + e.message);
      onNotify('Failed to load plans', 'error');
    }
    setLoading(false);
  }

  useEffect(() => { loadPlans(); }, []);

  /* ── Draft helpers ── */
  function addClass(day) {
    setDraft(prev => ({ ...prev, [day]: [...prev[day], { ...EMPTY_CLASS }] }));
  }

  function updateClass(day, idx, field, value) {
    setDraft(prev => {
      const arr = [...prev[day]];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, [day]: arr };
    });
  }

  function removeClass(day, idx) {
    setDraft(prev => {
      const arr = prev[day].filter((_, i) => i !== idx);
      return { ...prev, [day]: arr };
    });
  }

  function copyOneClass(fromDay, classIdx) {
    const cls = draft[fromDay][classIdx];
    setDraft(prev => ({ ...prev, [activeDay]: [...prev[activeDay], { ...cls }] }));
    setCopyModal(null);
  }

  /* ── Save plan ── */
  async function handleSave() {
    const totalClasses = DAYS.reduce((s, d) => s + draft[d].length, 0);
    if (totalClasses === 0) { onNotify('Add at least one class!', 'error'); return; }

    // Check if plan for this week already exists
    const existing = plans.find(p => p.weekStart === weekStart);
    if (existing) {
      if (!confirm(`Plan for week of ${weekStart} already exists. Replace it?`)) return;
      await deleteDoc(doc(db, 'weeklyPlans', existing.id));
    }

    try {
      await addDoc(collection(db, 'weeklyPlans'), {
        uid: user.uid,
        weekStart,
        days: draft,
        createdAt: new Date(),
      });
      onNotify('Weekly plan saved! 🎉', 'success');
      setShowForm(false);
      setDraft(Object.fromEntries(DAYS.map(d => [d, []])));
      loadPlans();
    } catch(e) {
      alert('Save error: ' + e.message);
      onNotify('Failed to save plan', 'error');
    }
  }

  /* ── Delete plan ── */
  async function handleDelete(id) {
    if (!confirm('Delete this week\'s plan?')) return;
    try {
      await deleteDoc(doc(db, 'weeklyPlans', id));
      onNotify('Plan deleted', 'success');
      loadPlans();
    } catch {
      onNotify('Failed to delete', 'error');
    }
  }

  /* ── Get current active plan (this week) ── */
  const thisSunday = getThisSunday();
  const activePlan = plans.find(p => p.weekStart === thisSunday);
  const otherPlans = plans.filter(p => p.weekStart !== thisSunday)
    .sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));

  if (loading) return (
    <section className="tab-content active">
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>Loading...</p>
    </section>
  );

  return (
    <>
    <section className="tab-content active">

      {/* Header */}
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h2>📅 Weekly Plan</h2>
        <button className="btn-primary" onClick={() => { setShowForm(v => !v); setDraft(Object.fromEntries(DAYS.map(d => [d, []]))); }}>
          {showForm ? 'Cancel' : '+ New Plan'}
        </button>
      </div>

      {/* ── New Plan Form ── */}
      {showForm && (
        <div className="form-container" style={{ marginBottom: '1.5rem' }}>
          <h3 className="form-title">📋 Plan for week of</h3>

          {/* Week start picker */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>📅 Week Starting (Sunday)</label>
            <input
              type="date"
              value={weekStart}
              onChange={e => setWeekStart(e.target.value)}
              className="month-input"
              style={{ marginTop: '0.3rem' }}
            />
          </div>

          {/* Day tabs */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {DAYS.map(day => (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  border: '1px solid var(--border)',
                  background: activeDay === day ? 'var(--primary-color)' : 'var(--bg-secondary)',
                  color: activeDay === day ? '#fff' : 'var(--text)',
                  fontWeight: activeDay === day ? 700 : 400,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {DAY_SHORT[day]}
                {draft[day].length > 0 && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-4px',
                    background: '#10b981', color: '#fff',
                    borderRadius: '50%', width: '16px', height: '16px',
                    fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700,
                  }}>{draft[day].length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Active day classes */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong style={{ color: 'var(--text)' }}>📆 {DAY_LABELS[activeDay]}</strong>
              {/* Copy from another day — opens modal */}
              {DAYS.some(d => d !== activeDay && draft[d].length > 0) && (
                <select
                  onChange={e => { if (e.target.value) { setCopyModal({ fromDay: e.target.value }); e.target.value = ''; } }}
                  style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', borderRadius: '6px',
                    border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)' }}
                >
                  <option value="">Copy class from...</option>
                  {DAYS.filter(d => d !== activeDay && draft[d].length > 0).map(d => (
                    <option key={d} value={d}>{DAY_LABELS[d]}</option>
                  ))}
                </select>
              )}
            </div>

            {draft[activeDay].length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                No classes planned. Hit + to add.
              </p>
            )}

            {draft[activeDay].map((cls, idx) => (
              <div key={idx} style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '0.75rem', marginBottom: '0.5rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Class {idx + 1}</span>
                  <button onClick={() => removeClass(activeDay, idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>🗑️</button>
                </div>
                <div className="form-grid" style={{ gap: '0.5rem' }}>
                  <div className="form-group">
                    <label>📖 Subject</label>
                    <input value={cls.subject} onChange={e => updateClass(activeDay, idx, 'subject', e.target.value)}
                      placeholder="Physics" />
                  </div>
                  <div className="form-group">
                    <label>👨‍🏫 Teacher</label>
                    <input value={cls.teacher} onChange={e => updateClass(activeDay, idx, 'teacher', e.target.value)}
                      placeholder="Saleem Sir" />
                  </div>
                  <div className="form-group full-width">
                    <label>📂 Chapter (optional)</label>
                    <input value={cls.chapter} onChange={e => updateClass(activeDay, idx, 'chapter', e.target.value)}
                      placeholder="e.g. Electrostatics" />
                  </div>
                </div>
              </div>
            ))}

            <button className="btn-secondary" style={{ width: '100%', marginTop: '0.25rem' }}
              onClick={() => addClass(activeDay)}>
              + Add Class to {DAY_SHORT[activeDay]}
            </button>
          </div>

          {/* Summary */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {DAYS.map(d => draft[d].length > 0 && (
              <span key={d} style={{ fontSize: '0.8rem', background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: '8px', padding: '0.2rem 0.6rem',
                color: 'var(--text-secondary)' }}>
                {DAY_SHORT[d]}: <strong style={{ color: 'var(--primary-color)' }}>{draft[d].length}</strong>
              </span>
            ))}
          </div>

          <button className="btn-primary" style={{ width: '100%' }} onClick={handleSave}>
            💾 Save Weekly Plan
          </button>
        </div>
      )}

      {/* ── This Week's Active Plan ── */}
      {activePlan ? (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem' }}>
              ✅ This Week's Plan
            </h3>
            <button className="delete-btn" onClick={() => handleDelete(activePlan.id)}>🗑️</button>
          </div>
          <PlanCard plan={activePlan} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)',
          background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px dashed var(--border)',
          marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No plan for this week</p>
          <p style={{ fontSize: '0.85rem' }}>Hit "+ New Plan" every Sunday to set your week!</p>
        </div>
      )}

      {/* ── Past Plans ── */}
      {otherPlans.length > 0 && (
        <div>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Past Plans
          </h3>
          {otherPlans.map(plan => (
            <div key={plan.id} style={{ marginBottom: '1rem', opacity: 0.7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Week of {plan.weekStart}</span>
                <button className="delete-btn" onClick={() => handleDelete(plan.id)}>🗑️</button>
              </div>
              <PlanCard plan={plan} />
            </div>
          ))}
        </div>
      )}
    </section>

    {/* ── Copy Class Modal ── */}
    {copyModal && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }} onClick={() => setCopyModal(null)}>
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--bg)', borderRadius: '16px 16px 0 0',
            padding: '1.25rem', width: '100%', maxWidth: '480px',
            maxHeight: '60vh', overflowY: 'auto',
          }}
        >
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <strong style={{ color:'var(--text)' }}>
              Select class from {DAY_LABELS[copyModal.fromDay]}
            </strong>
            <button onClick={() => setCopyModal(null)}
              style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer' }}>✕</button>
          </div>
          {draft[copyModal.fromDay].map((cls, idx) => (
            <div
              key={idx}
              onClick={() => copyOneClass(copyModal.fromDay, idx)}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '0.5rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}
            >
              <span>📖</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>{cls.subject}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  👨‍🏫 {cls.teacher}{cls.chapter ? ` • 📂 ${cls.chapter}` : ''}
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600 }}>+ Add</span>
            </div>
          ))}
        </div>
      </div>
    )}
    </>
  );
}

/* ── Plan display card ── */
function PlanCard({ plan }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {DAYS.map(day => {
        const classes = plan.days?.[day] || [];
        if (!classes.length) return null;
        return (
          <div key={day} style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '0.6rem 0.8rem',
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              📆 {DAY_LABELS[day]}
            </div>
            {classes.map((cls, i) => (
              <div key={i} style={{
                display: 'flex', gap: '0.5rem', alignItems: 'center',
                fontSize: '0.88rem', color: 'var(--text)',
                paddingLeft: '0.5rem', borderLeft: '2px solid var(--primary-color)',
                marginBottom: i < classes.length - 1 ? '0.3rem' : 0,
              }}>
                <span style={{ fontWeight: 600 }}>{cls.subject}</span>
                <span style={{ color: 'var(--text-secondary)' }}>• {cls.teacher}</span>
                {cls.chapter && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>• {cls.chapter}</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
