import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

const EMPTY_FORM = {
  subject: '', teacher: '', chapter: '', topic: '',
  attendance: 'Live',
  theory: false, dpp: 'no', notes: false, hw: 'no',
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
    dpp:          cls.dpp === 'Yes' ? 'yes' : cls.dpp === 'N/A' ? 'na' : 'no',
    notes:        cls.notes        === 'Yes',
    hw:           cls.hw === 'Yes' ? 'yes' : cls.hw === 'N/A' ? 'na' : 'no',
    mistakes:     cls.mistakes     || '',
    improvements: cls.improvements || '',
    remarks:      cls.remarks      || '',
  };
}

const STUDY_ITEMS = [
  { key: 'theory', icon: '📚', label: 'Theory',  triState: false },
  { key: 'dpp',    icon: '📋', label: 'DPP',     triState: true  },
  { key: 'notes',  icon: '📝', label: 'Notes',   triState: false },
  { key: 'hw',     icon: '✏️', label: 'HW',      triState: true  },
];

// ── Autocomplete Input ────────────────────────────────────────────────────────
function AutoInput({ id, label, icon, value, onChange, placeholder, suggestions, required }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const filtered = useMemo(() => {
    const pool = suggestions || [];
    // CI dedup within the pool before filtering
    const seen = new Map();
    for (const v of pool) {
      const k = v.toLowerCase().trim();
      if (!seen.has(k)) seen.set(k, v);
    }
    const deduped = [...seen.values()];
    if (!value.trim()) return deduped.slice(0, 8);
    const q = value.toLowerCase();
    return deduped
      .filter(s => s.toLowerCase().includes(q))
      .sort((a, b) => {
        const as = a.toLowerCase().startsWith(q);
        const bs = b.toLowerCase().startsWith(q);
        return as === bs ? 0 : as ? -1 : 1;
      })
      .slice(0, 8);
  }, [value, suggestions]);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const showDrop = open && filtered.length > 0;

  return (
    <div className="form-group" ref={ref}>
      <label htmlFor={id}>{icon} {label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          value={value}
          onChange={e => { onChange(e); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          style={{ width: '100%' }}
        />
        {showDrop && (
          <ul className="ac-dropdown">
            {filtered.map((s, i) => {
              const q = value.toLowerCase();
              const idx = s.toLowerCase().indexOf(q);
              return (
                <li key={i} className="ac-item"
                  onMouseDown={() => { onChange({ target: { id, value: s } }); setOpen(false); }}>
                  {idx === -1 || !value ? s : (
                    <>{s.slice(0, idx)}<mark className="ac-mark">{s.slice(idx, idx + value.length)}</mark>{s.slice(idx + value.length)}</>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TodayTab({ classes, onRefresh, onNotify, user }) {
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [plannedClasses, setPlannedClasses] = useState([]);

  const today = new Date().toLocaleDateString('en-CA');
  const [selectedDate, setSelectedDate] = useState(today);

  function goDay(offset) {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toLocaleDateString('en-CA'));
  }

  function dateLabel(dateStr) {
    const diff = Math.round((new Date(dateStr + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
    if (diff === 0)  return "Today's Classes";
    if (diff === -1) return `Yesterday — ${dateStr}`;
    if (diff === 1)  return `Tomorrow — ${dateStr}`;
    return `Classes — ${dateStr}`;
  }

  // ── Suggestion pools (case-insensitive dedup: keep most recent casing) ──
  function dedupCI(arr) {
    const seen = new Map();
    for (const v of arr) {
      const key = v.toLowerCase().trim();
      if (!seen.has(key)) seen.set(key, v);
    }
    return [...seen.values()];
  }
  // Sort by most recent so latest casing wins in dedup
  const byRecent = useMemo(() =>
    [...classes].sort((a,b) => new Date(b.timestamp?.toDate?.() || b.timestamp) - new Date(a.timestamp?.toDate?.() || a.timestamp)),
  [classes]);
  const allTeachers = useMemo(() => dedupCI(byRecent.map(c => c.teacher).filter(Boolean)), [byRecent]);
  const allChapters = useMemo(() => dedupCI(byRecent.map(c => c.chapter).filter(Boolean)), [byRecent]);
  const allTopics   = useMemo(() => dedupCI(byRecent.map(c => c.topic).filter(Boolean)),   [byRecent]);
  const allSubjects = useMemo(() => dedupCI(byRecent.map(c => c.subject).filter(Boolean)), [byRecent]);

  // Subject-scoped suggestions: most recent first from same subject, then rest (CI dedup)
  function scopedSugg(field, allPool) {
    if (!form.subject) return allPool;
    const fromSubj = dedupCI(
      classes
        .filter(c => c.subject === form.subject)
        .sort((a, b) => new Date(b.timestamp?.toDate?.() || b.timestamp) - new Date(a.timestamp?.toDate?.() || a.timestamp))
        .map(c => c[field])
        .filter(Boolean)
    );
    const fromSubjLower = new Set(fromSubj.map(s => s.toLowerCase().trim()));
    const rest = allPool.filter(s => !fromSubjLower.has(s.toLowerCase().trim()));
    return [...fromSubj, ...rest];
  }

  // ── Auto-fill on subject select ──
  function handleSubjectChange(e) {
    const subj = e.target.value;
    const recent = classes
      .filter(c => c.subject === subj)
      .sort((a, b) => new Date(b.timestamp?.toDate?.() || b.timestamp) - new Date(a.timestamp?.toDate?.() || a.timestamp))[0];
    setForm(prev => ({
      ...prev,
      subject: subj,
      teacher: recent?.teacher || prev.teacher,
      chapter: recent?.chapter || prev.chapter,
      topic:   recent?.topic   || prev.topic,
    }));
  }

  function handleChange(e) {
    const { id, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [id]: type === 'checkbox' ? checked : value }));
  }

  // ── Weekly plan ──
  const todayDayName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][
    new Date(selectedDate + 'T12:00:00').getDay()
  ];
  useEffect(() => {
    async function loadPlan() {
      if (!user) return;
      const d = new Date(selectedDate + 'T12:00:00');
      d.setDate(d.getDate() - d.getDay());
      const weekStart = d.toLocaleDateString('en-CA');
      try {
        const snap = await getDocs(query(collection(db, 'weeklyPlans'), where('uid','==',user.uid), where('weekStart','==',weekStart)));
        setPlannedClasses(!snap.empty ? snap.docs[0].data().days?.[todayDayName] || [] : []);
      } catch { setPlannedClasses([]); }
    }
    loadPlan();
  }, [selectedDate, user, todayDayName]);

  const todayClasses = classes
    .filter(c => c.date === selectedDate)
    .sort((a, b) => new Date(b.timestamp?.toDate?.() || b.timestamp) - new Date(a.timestamp?.toDate?.() || a.timestamp));

  function openAddForm()  { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }
  function openEditForm(cls) {
    setEditingId(cls.id); setForm(classToForm(cls)); setShowForm(true);
    setTimeout(() => document.querySelector('.form-container')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }
  function closeForm() { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }

  function buildData() {
    return {
      subject: form.subject, teacher: form.teacher, chapter: form.chapter, topic: form.topic,
      attendance: form.attendance,
      theory: form.theory ? 'Yes' : 'No',
      dpp:    form.dpp === 'yes' ? 'Yes' : form.dpp === 'na' ? 'N/A' : 'No',
      notes:  form.notes ? 'Yes' : 'No',
      hw:     form.hw === 'yes' ? 'Yes' : form.hw === 'na' ? 'N/A' : 'No',
      mistakes: form.mistakes, improvements: form.improvements, remarks: form.remarks,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'classes', editingId), buildData());
        onNotify('Class updated!', 'success');
      } else {
        await addDoc(collection(db, 'classes'), { ...buildData(), uid: user.uid, date: selectedDate, timestamp: new Date() });
        onNotify('Class added successfully!', 'success');
      }
      closeForm(); onRefresh();
    } catch { onNotify(editingId ? 'Failed to update' : 'Failed to add class', 'error'); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this class?')) return;
    try { await deleteDoc(doc(db, 'classes', id)); onRefresh(); onNotify('Class deleted', 'success'); }
    catch { onNotify('Failed to delete class', 'error'); }
  }

  const hasAutoFill = !editingId && form.subject && classes.some(c => c.subject === form.subject);

  return (
    <section className="tab-content active">

      {/* ── Header ── */}
      <div className="section-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
        <h2>{dateLabel(selectedDate)}</h2>
        <button className="btn-primary" style={{ width: '100%' }} onClick={openAddForm}>
          <span>+</span> Add Class
        </button>

        {/* Date nav row */}
        <div className="date-nav-row">
          <button className="day-nav-btn" onClick={() => goDay(-1)} title="Previous day">&#8249;</button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="date-nav-input"
          />
          <button className="day-nav-btn" onClick={() => goDay(1)} title="Next day">&#8250;</button>
        </div>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <form className="form-container" onSubmit={handleSubmit}>
          <h3 className="form-title">{editingId ? '✏️ Edit Class' : '➕ New Class'}</h3>

          {hasAutoFill && (
            <div className="autofill-banner">
              ✨ Auto-filled from your last <strong>{form.subject}</strong> class — edit any field below if needed
            </div>
          )}

          <div className="form-grid">
            {/* Subject with autofill trigger */}
            <AutoInput
              id="subject" label="Subject" icon="📖"
              value={form.subject}
              onChange={handleSubjectChange}
              placeholder="e.g., Physics"
              suggestions={allSubjects}
              required
            />

            <AutoInput
              id="teacher" label="Teacher" icon="👨‍🏫"
              value={form.teacher}
              onChange={handleChange}
              placeholder="Teacher name"
              suggestions={scopedSugg('teacher', allTeachers)}
              required
            />

            <AutoInput
              id="chapter" label="Chapter" icon="📂"
              value={form.chapter}
              onChange={handleChange}
              placeholder="e.g., Kinematics"
              suggestions={scopedSugg('chapter', allChapters)}
            />

            <AutoInput
              id="topic" label="Topic" icon="📝"
              value={form.topic}
              onChange={handleChange}
              placeholder="Specific topic"
              suggestions={scopedSugg('topic', allTopics)}
              required
            />

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
                {STUDY_ITEMS.map(({ key, icon, label, triState }) => (
                  triState ? (
                    <div key={key} style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                      <span style={{ fontSize:'0.82rem', color:'var(--text-secondary)', fontWeight:600 }}>{icon} {label}</span>
                      <div style={{ display:'flex', gap:'0.3rem' }}>
                        {[
                          { val:'yes', emoji:'✅', text:'Yes' },
                          { val:'no',  emoji:'❌', text:'No'  },
                          { val:'na',  emoji:'⚠️', text:'N/A' },
                        ].map(({ val, emoji, text }) => (
                          <button key={val} type="button"
                            onClick={() => setForm(prev => ({ ...prev, [key]: val }))}
                            style={{
                              flex:1, padding:'0.3rem 0.2rem', fontSize:'0.75rem', fontWeight:600,
                              borderRadius:'8px',
                              border:`2px solid ${form[key]===val ? val==='yes'?'#10b981':val==='no'?'#ef4444':'#f59e0b' : 'var(--border)'}`,
                              background: form[key]===val ? val==='yes'?'rgba(16,185,129,0.15)':val==='no'?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)' : 'transparent',
                              color: form[key]===val ? val==='yes'?'#10b981':val==='no'?'#ef4444':'#f59e0b' : 'var(--text-secondary)',
                              cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap',
                            }}
                          >{emoji} {text}</button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <label className="checkbox-item" key={key}>
                      <input type="checkbox" id={key} checked={form[key]} onChange={handleChange} />
                      <span>{icon} {label}</span>
                    </label>
                  )
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
            <button type="submit" className="btn-primary">{editingId ? '💾 Update Class' : '💾 Save Class'}</button>
            <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
          </div>
        </form>
      )}

      {/* ── Daily Goal ── */}
      {selectedDate === today && plannedClasses.length > 0 && (() => {
        const goalTarget = plannedClasses.length;
        const done = todayClasses.length;
        const pct  = Math.min((done / goalTarget) * 100, 100);
        const achieved = done >= goalTarget;
        return (
          <div style={{ background: achieved?'linear-gradient(135deg,#10b981,#059669)':'var(--bg-secondary)', border:`1px solid ${achieved?'#10b981':'var(--border)'}`, borderRadius:'12px', padding:'0.85rem 1rem', marginBottom:'1rem', transition:'all 0.3s' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
              <span style={{ fontWeight:700, color:achieved?'#fff':'var(--text)', fontSize:'0.95rem' }}>🎯 Daily Goal</span>
              <span style={{ fontSize:'0.85rem', color:achieved?'#fff':'var(--text-secondary)' }}>{done}/{goalTarget} classes</span>
            </div>
            <div style={{ background:achieved?'rgba(255,255,255,0.3)':'var(--border)', borderRadius:'999px', height:'8px', overflow:'hidden' }}>
              <div style={{ width:`${pct}%`, height:'100%', borderRadius:'999px', background:achieved?'#fff':'var(--primary-color)', transition:'width 0.4s ease' }} />
            </div>
            {achieved && <p style={{ margin:'0.4rem 0 0', fontSize:'0.8rem', color:'#fff', textAlign:'center' }}>🎉 Goal achieved! Keep going!</p>}
          </div>
        );
      })()}

      {/* ── Planned Cards ── */}
      {plannedClasses.length > 0 && (() => {
        const completedTopics = todayClasses.map(c => c.subject + '_' + c.teacher);
        const pending = plannedClasses.filter(p => !completedTopics.includes(p.subject + '_' + p.teacher));
        if (!pending.length) return null;
        return (
          <div style={{ marginBottom:'1rem' }}>
            <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', fontWeight:600, marginBottom:'0.5rem' }}>📋 Planned for today — tap to log</p>
            {pending.map((cls, i) => (
              <div key={i}
                onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM, subject:cls.subject||'', teacher:cls.teacher||'', chapter:cls.chapter||'' }); setShowForm(true); setTimeout(()=>document.querySelector('.form-container')?.scrollIntoView({behavior:'smooth'}),50); }}
                style={{ background:'var(--bg-secondary)', border:'1.5px dashed var(--border)', borderRadius:'12px', padding:'0.75rem 1rem', marginBottom:'0.5rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.75rem', transition:'border-color 0.2s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--primary-color)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
              >
                <span style={{ fontSize:'1.4rem', opacity:0.5 }}>📖</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, color:'var(--text)', fontSize:'0.95rem' }}>{cls.subject}</div>
                  <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>👨‍🏫 {cls.teacher}{cls.chapter?` • 📂 ${cls.chapter}`:''}</div>
                </div>
                <span style={{ fontSize:'0.75rem', color:'var(--primary-color)', fontWeight:600 }}>Tap to log →</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Classes list ── */}
      <div className="classes-container">
        {todayClasses.length === 0 ? (
          <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>
            {selectedDate===today?'No classes today yet.':'No classes on this date.'} Hit <strong>+ Add Class</strong> to log one!
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
                {cls.attendance==='Live'?'📺':cls.attendance==='Recorded'?'📹':'🔄'} {cls.attendance}
              </span>
              <div className="card-actions">
                <button className="edit-btn" onClick={() => openEditForm(cls)} title="Edit">✏️</button>
                <button className="delete-btn" onClick={() => handleDelete(cls.id)} title="Delete">🗑️</button>
              </div>
            </div>

            <div className="study-work-grid">
              {STUDY_ITEMS.map(({ key, icon, label, triState }) => {
                const val = cls[key];
                let badge, c2;
                if (triState) {
                  if (val==='Yes')      { badge='✅'; c2='completed'; }
                  else if (val==='N/A') { badge='⚠️ N/A'; c2='na'; }
                  else                  { badge='❌'; c2=''; }
                } else { badge=val==='Yes'?'✅':'❌'; c2=val==='Yes'?'completed':''; }
                return (
                  <div key={key} className={`study-item ${c2}`} style={c2==='na'?{opacity:0.65,fontStyle:'italic'}:{}}>
                    {icon} {label}: {badge}
                  </div>
                );
              })}
            </div>

            {(cls.mistakes||cls.improvements||cls.remarks) && (
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
