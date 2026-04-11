import { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

const EMPTY_FORM = {
  subject: '', teacher: '', chapter: '', topic: '',
  attendance: 'Live',
  theory: false, dpp: false, notes: false, hw: false,
  mistakes: '', improvements: '', remarks: '',
};

function classToForm(cls) {
  return {
    subject:      cls.subject      || '',
    teacher:      cls.teacher      || '',
    chapter:      cls.chapter      || '',
    topic:        cls.topic        || '',
    attendance:   cls.attendance   || 'Live',
    theory:       cls.theory       === 'Yes',
    dpp:          cls.dpp          === 'Yes',
    notes:        cls.notes        === 'Yes',
    hw:           cls.hw           === 'Yes',
    mistakes:     cls.mistakes     || '',
    improvements: cls.improvements || '',
    remarks:      cls.remarks      || '',
  };
}

const STUDY_ITEMS = [
  { key: 'theory', icon: '📚', label: 'Theory' },
  { key: 'dpp',    icon: '📋', label: 'DPP'    },
  { key: 'notes',  icon: '📝', label: 'Notes'  },
  { key: 'hw',     icon: '✏️', label: 'HW'     },
];

export default function TodayTab({ classes, onRefresh, onNotify, user }) {
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [plannedClasses, setPlannedClasses] = useState([]);

  // today and selectedDate MUST be defined before use
  const today = new Date().toLocaleDateString('en-CA'); // local date YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState(today);

  // Get selected day name
  const todayDayName = today === selectedDate
    ? ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]
    : ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(selectedDate + 'T12:00:00').getDay()];

  // Load this week's plan
  useEffect(() => {
    async function loadPlan() {
      if (!user) return;
      const d = new Date(selectedDate + 'T12:00:00');
      d.setDate(d.getDate() - d.getDay());
      const weekStart = d.toLocaleDateString('en-CA');
      try {
        const snap = await getDocs(query(collection(db, 'weeklyPlans'), where('uid', '==', user.uid), where('weekStart', '==', weekStart)));
        if (!snap.empty) {
          const plan = snap.docs[0].data();
          const dayClasses = plan.days?.[todayDayName] || [];
          setPlannedClasses(dayClasses);
        } else {
          setPlannedClasses([]);
        }
      } catch { setPlannedClasses([]); }
    }
    loadPlan();
  }, [selectedDate, user, todayDayName]);

  const todayClasses = classes
    .filter(c => c.date === selectedDate)
    .sort((a, b) => new Date(b.timestamp?.toDate?.() || b.timestamp) - new Date(a.timestamp?.toDate?.() || a.timestamp));

  function handleChange(e) {
    const { id, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [id]: type === 'checkbox' ? checked : value }));
  }

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(cls) {
    setEditingId(cls.id);
    setForm(classToForm(cls));
    setShowForm(true);
    setTimeout(() => document.querySelector('.form-container')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function buildData() {
    return {
      subject:      form.subject,
      teacher:      form.teacher,
      chapter:      form.chapter,
      topic:        form.topic,
      attendance:   form.attendance,
      theory:       form.theory ? 'Yes' : 'No',
      dpp:          form.dpp    ? 'Yes' : 'No',
      notes:        form.notes  ? 'Yes' : 'No',
      hw:           form.hw     ? 'Yes' : 'No',
      mistakes:     form.mistakes,
      improvements: form.improvements,
      remarks:      form.remarks,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'classes', editingId), buildData());
        onNotify('Class updated!', 'success');
      } else {
        await addDoc(collection(db, 'classes'), {
          ...buildData(),
          uid:       user.uid,
          date:      selectedDate,
          timestamp: new Date(),
        });
        onNotify('Class added successfully!', 'success');
      }
      closeForm();
      onRefresh();
    } catch {
      onNotify(editingId ? 'Failed to update class' : 'Failed to add class', 'error');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this class?')) return;
    try {
      await deleteDoc(doc(db, 'classes', id));
      onRefresh();
      onNotify('Class deleted', 'success');
    } catch {
      onNotify('Failed to delete class', 'error');
    }
  }

  return (
    <section className="tab-content active">
      <div className="section-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
        <h2>{selectedDate === today ? "Today's Classes" : `Classes — ${selectedDate}`}</h2>
        <button className="btn-primary" style={{ width: '100%' }} onClick={openAddForm}>
          <span>+</span> Add Class
        </button>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={e => setSelectedDate(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '1.5px solid var(--border)',
            borderRadius: 0,
            padding: '0.25rem 0.1rem',
            fontSize: '0.95rem',
            color: 'var(--text-secondary)',
            outline: 'none',
            cursor: 'pointer',
          }}
        />
      </div>

      {showForm && (
        <form className="form-container" onSubmit={handleSubmit}>
          <h3 className="form-title">
            {editingId ? '✏️ Edit Class' : '➕ New Class'}
          </h3>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="subject">📖 Subject</label>
              <input id="subject" value={form.subject} onChange={handleChange} placeholder="e.g., Physics" required />
            </div>

            <div className="form-group">
              <label htmlFor="teacher">👨‍🏫 Teacher</label>
              <input id="teacher" value={form.teacher} onChange={handleChange} placeholder="Teacher name" required />
            </div>

            <div className="form-group">
              <label htmlFor="chapter">📂 Chapter</label>
              <input id="chapter" value={form.chapter} onChange={handleChange} placeholder="e.g., Kinematics" />
            </div>

            <div className="form-group">
              <label htmlFor="topic">📝 Topic</label>
              <input id="topic" value={form.topic} onChange={handleChange} placeholder="Specific topic within chapter" required />
            </div>

            <div className="form-group">
              <label htmlFor="attendance">📺 Attendance</label>
              <select id="attendance" value={form.attendance} onChange={handleChange}>
                <option value="Live">📺 Live</option>
                <option value="Recorded">📹 Recorded</option>
                <option value="Hybrid">🔄 Hybrid</option>
              </select>
            </div>

            <div className="form-group full-width">
              <label>✅ Study Work Completed:</label>
              <div className="checkbox-grid">
                {STUDY_ITEMS.map(({ key, icon, label }) => (
                  <label className="checkbox-item" key={key}>
                    <input type="checkbox" id={key} checked={form[key]} onChange={handleChange} />
                    <span>{icon} {label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group full-width">
              <label htmlFor="mistakes">⚠️ Mistakes Found</label>
              <textarea id="mistakes" rows={2} value={form.mistakes} onChange={handleChange} placeholder="Note down any mistakes..." />
            </div>

            <div className="form-group full-width">
              <label htmlFor="improvements">💡 Improvements</label>
              <textarea id="improvements" rows={2} value={form.improvements} onChange={handleChange} placeholder="Areas to improve..." />
            </div>

            <div className="form-group full-width">
              <label htmlFor="remarks">📌 Remarks</label>
              <textarea id="remarks" rows={2} value={form.remarks} onChange={handleChange} placeholder="Additional remarks..." />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingId ? '💾 Update Class' : '💾 Save Class'}
            </button>
            <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
          </div>
        </form>
      )}

      {/* Daily Goal — only show if plan exists for today */}
      {selectedDate === today && plannedClasses.length > 0 && (() => {
        const goalTarget = plannedClasses.length; // auto from plan
        const done = todayClasses.length;
        const pct  = Math.min((done / goalTarget) * 100, 100);
        const achieved = done >= goalTarget;
        return (
          <div style={{
            background: achieved ? 'linear-gradient(135deg,#10b981,#059669)' : 'var(--bg-secondary)',
            border: `1px solid ${achieved ? '#10b981' : 'var(--border)'}`,
            borderRadius: '12px', padding: '0.85rem 1rem',
            marginBottom: '1rem', transition: 'all 0.3s',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
              <span style={{ fontWeight:700, color: achieved ? '#fff' : 'var(--text)', fontSize:'0.95rem' }}>
                🎯 Daily Goal
              </span>
              <span style={{ fontSize:'0.85rem', color: achieved ? '#fff' : 'var(--text-secondary)' }}>
                {done}/{goalTarget} classes
              </span>
            </div>
            <div style={{ background: achieved ? 'rgba(255,255,255,0.3)' : 'var(--border)',
              borderRadius:'999px', height:'8px', overflow:'hidden' }}>
              <div style={{ width:`${pct}%`, height:'100%', borderRadius:'999px',
                background: achieved ? '#fff' : 'var(--primary-color)',
                transition:'width 0.4s ease' }} />
            </div>
            {achieved && (
              <p style={{ margin:'0.4rem 0 0', fontSize:'0.8rem', color:'#fff', textAlign:'center' }}>
                🎉 Goal achieved! Keep going!
              </p>
            )}
          </div>
        );
      })()}

      {/* ── Planned Cards (from weekly plan) ── */}
      {plannedClasses.length > 0 && (() => {
        // Find which planned classes are already completed today
        const completedTopics = todayClasses.map(c => c.subject + '_' + c.teacher);
        const pending = plannedClasses.filter(p => !completedTopics.includes(p.subject + '_' + p.teacher));

        if (!pending.length) return null;
        return (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>
              📋 Planned for today — tap to log
            </p>
            {pending.map((cls, i) => (
              <div
                key={i}
                onClick={() => {
                  setEditingId(null);
                  setForm({
                    ...EMPTY_FORM,
                    subject: cls.subject || '',
                    teacher: cls.teacher || '',
                    chapter: cls.chapter || '',
                  });
                  setShowForm(true);
                  setTimeout(() => document.querySelector('.form-container')?.scrollIntoView({ behavior: 'smooth' }), 50);
                }}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1.5px dashed var(--border)',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  marginBottom: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <span style={{ fontSize: '1.4rem', opacity: 0.5 }}>📖</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>{cls.subject}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    👨‍🏫 {cls.teacher}{cls.chapter ? ` • 📂 ${cls.chapter}` : ''}
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                  Tap to log →
                </span>
              </div>
            ))}
          </div>
        );
      })()}

      <div className="classes-container">
        {todayClasses.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            {selectedDate === today ? 'No classes today yet.' : 'No classes on this date.'} Hit <strong>+ Add Class</strong> to log one!
          </p>
        ) : todayClasses.map(cls => (
          <div className="class-card" key={cls.id}>

            <div className="class-header">
              <div className="class-title-section">
                <div className="class-title">📖 {cls.subject}</div>
                <div className="class-meta">
                  👨‍🏫 {cls.teacher}
                  {cls.chapter && <>&nbsp;|&nbsp; 📂 {cls.chapter}</>}
                  &nbsp;|&nbsp; 📝 {cls.topic}
                </div>
              </div>

              <span className={`attendance-badge attendance-${cls.attendance?.toLowerCase()}`}>
                {cls.attendance === 'Live' ? '📺' : cls.attendance === 'Recorded' ? '📹' : '🔄'} {cls.attendance}
              </span>

              <div className="card-actions">
                <button className="edit-btn" onClick={() => openEditForm(cls)} title="Edit class">✏️</button>
                <button className="delete-btn" onClick={() => handleDelete(cls.id)} title="Delete class">🗑️</button>
              </div>
            </div>

            <div className="study-work-grid">
              {STUDY_ITEMS.map(({ key, icon, label }) => (
                <div key={key} className={`study-item ${cls[key] === 'Yes' ? 'completed' : ''}`}>
                  {icon} {label}: {cls[key] === 'Yes' ? '✅' : '❌'}
                </div>
              ))}
            </div>

            {(cls.mistakes || cls.improvements || cls.remarks) && (
              <div className="class-notes">
                {cls.mistakes     && <div className="note-item"><span className="note-label">⚠️ Mistakes:</span> {cls.mistakes}</div>}
                {cls.improvements && <div className="note-item"><span className="note-label">💡 Improvements:</span> {cls.improvements}</div>}
                {cls.remarks      && <div className="note-item"><span className="note-label">📌 Remarks:</span> {cls.remarks}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
