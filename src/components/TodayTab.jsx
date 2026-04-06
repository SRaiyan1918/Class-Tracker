import { useState } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const EMPTY_FORM = {
  subject: '', teacher: '', chapter: '', topic: '',
  attendance: 'Live',
  theory: false, dpp: false, pyqs: false, formula: false,
  mistakes: '', improvements: '', notes: '',
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
    pyqs:         cls.pyqs         === 'Yes',
    formula:      cls.formula      === 'Yes',
    mistakes:     cls.mistakes     || '',
    improvements: cls.improvements || '',
    notes:        cls.notes        || '',
  };
}

const STUDY_ITEMS = [
  { key: 'theory',  icon: '📚', label: 'Theory'  },
  { key: 'dpp',     icon: '📋', label: 'DPP'     },
  { key: 'pyqs',    icon: '❓', label: 'PYQs'    },
  { key: 'formula', icon: '📐', label: 'Formula'  },
];

export default function TodayTab({ classes, onRefresh, onNotify, user }) {
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const todayClasses = classes
    .filter(c => c.date === today)
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
      theory:       form.theory  ? 'Yes' : 'No',
      dpp:          form.dpp     ? 'Yes' : 'No',
      pyqs:         form.pyqs    ? 'Yes' : 'No',
      formula:      form.formula ? 'Yes' : 'No',
      mistakes:     form.mistakes,
      improvements: form.improvements,
      notes:        form.notes,
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
          date:      today,
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
      <div className="section-header">
        <h2>Today's Classes</h2>
        <button className="btn-primary" onClick={openAddForm}>
          <span>+</span> Add Class
        </button>
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
              <label htmlFor="notes">📌 Notes</label>
              <textarea id="notes" rows={2} value={form.notes} onChange={handleChange} placeholder="Additional notes..." />
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

      <div className="classes-container">
        {todayClasses.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            No classes today yet. Hit <strong>+ Add Class</strong> to get started!
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

            {(cls.mistakes || cls.improvements || cls.notes) && (
              <div className="class-notes">
                {cls.mistakes     && <div className="note-item"><span className="note-label">⚠️ Mistakes:</span> {cls.mistakes}</div>}
                {cls.improvements && <div className="note-item"><span className="note-label">💡 Improvements:</span> {cls.improvements}</div>}
                {cls.notes        && <div className="note-item"><span className="note-label">📌 Notes:</span> {cls.notes}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
