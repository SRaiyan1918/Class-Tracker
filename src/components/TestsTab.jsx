import { useState, useMemo } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ─── Constants ────────────────────────────────────────────────────────────────
const TEST_TYPES = [
  { value: 'Mains',   label: '🎯 Mains',                 hasPaper: false },
  { value: 'Advance', label: '📘 Advance',               hasPaper: true  },
  { value: 'AITs_M',  label: '⚡ AITs – Mains Pattern',   hasPaper: false },
  { value: 'AITs_A',  label: '⚡ AITs – Advance Pattern', hasPaper: true  },
];
const DEFAULT_MARKS = { Mains: 300, Advance: 180, AITs_M: 300, AITs_A: 180 };
const SUBJECTS = ['Physics', 'Chemistry', 'Maths', 'Biology'];
const DISPLAY_GROUPS = ['Mains', 'Advance', 'AITs_M', 'AITs_A'];

const PRESET_WRONG_REASONS = [
  'Silly mistake', 'Concept not clear', 'Wrong formula applied',
  'Calculation error', 'Misread question', 'Time pressure', 'Guessed wrong',
];
const PRESET_SKIP_REASONS = [
  'Time ran out', 'Concept unknown', 'Too lengthy', 'Not attempted',
  'Left for later', 'Felt risky',
];

const EMPTY_FORM = {
  testType: 'Mains', name: '', paper: '',
  date: '', totalMarks: 300, obtainedMarks: '', accuracy: '',
};

function typeLabel(v) { return TEST_TYPES.find(t => t.value === v)?.label || v; }
function hasPaper(v)  { return TEST_TYPES.find(t => t.value === v)?.hasPaper || false; }

// ─── Small helpers ─────────────────────────────────────────────────────────────
function ScoreBar({ obtained, total }) {
  const pct = total > 0 ? Math.min((obtained / total) * 100, 100) : 0;
  const color = pct >= 70 ? '#10b981' : pct >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s' }} />
    </div>
  );
}

// Simple bar chart using divs (no library needed)
function BarChart({ data, title }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ marginTop: '0.5rem' }}>
      {title && <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', width: 110, flexShrink: 0, textAlign: 'right' }}>{d.label}</div>
            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 99, height: 14, overflow: 'hidden' }}>
              <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: d.color || 'var(--primary-color)', borderRadius: 99, transition: 'width 0.5s', display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                {d.value > 0 && <span style={{ fontSize: '0.6rem', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{d.value}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Reason Tag Picker ─────────────────────────────────────────────────────────
// Presets + custom input, selections stored as array
function ReasonPicker({ selected, onChange, presets, placeholder }) {
  const [custom, setCustom] = useState('');

  function toggle(r) {
    if (selected.includes(r)) onChange(selected.filter(x => x !== r));
    else onChange([...selected, r]);
  }
  function addCustom() {
    const v = custom.trim();
    if (!v || selected.includes(v)) { setCustom(''); return; }
    onChange([...selected, v]);
    setCustom('');
  }

  // Merge presets + any custom already in selected not in presets
  const allOptions = [...new Set([...presets, ...selected])];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
        {allOptions.map(r => (
          <button key={r} type="button"
            onClick={() => toggle(r)}
            style={{
              padding: '0.25rem 0.7rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
              border: `1.5px solid ${selected.includes(r) ? 'var(--primary-color)' : 'var(--border)'}`,
              background: selected.includes(r) ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: selected.includes(r) ? 'var(--primary-color)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{selected.includes(r) ? '✓ ' : ''}{r}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <input value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder={placeholder}
          style={{ flex: 1, fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit' }}
        />
        <button type="button" onClick={addCustom}
          style={{ padding: '0.3rem 0.7rem', borderRadius: 8, border: 'none', background: 'var(--primary-color)', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
          + Add
        </button>
      </div>
    </div>
  );
}

// ─── Analysis Modal ────────────────────────────────────────────────────────────
function AnalysisModal({ test, onClose, onSave, existingAnalysis, allTests }) {
  // Per-subject rows
  const emptyRow = () => ({ wrong: '', wrongReasons: [], skipped: '', skipReasons: [], topicWork: '' });
  const initRows = () => {
    if (existingAnalysis?.rows) return existingAnalysis.rows;
    return Object.fromEntries(SUBJECTS.map(s => [s, emptyRow()]));
  };

  const [rows, setRows] = useState(initRows);
  const [overallNote, setOverallNote] = useState(existingAnalysis?.overallNote || '');
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(!!existingAnalysis); // if already saved, show view first

  function updateRow(subject, field, value) {
    setRows(prev => ({ ...prev, [subject]: { ...prev[subject], [field]: value } }));
  }

  // Which subjects have data — show all but dim empty ones
  const activeSubjects = SUBJECTS; // always show all 4

  // Stats for this test
  const totalWrong   = SUBJECTS.reduce((s, sub) => s + (parseInt(rows[sub]?.wrong)   || 0), 0);
  const totalSkipped = SUBJECTS.reduce((s, sub) => s + (parseInt(rows[sub]?.skipped) || 0), 0);

  // Top wrong reasons across all subjects (flatten + count)
  const reasonCounts = useMemo(() => {
    const counts = {};
    SUBJECTS.forEach(sub => {
      (rows[sub]?.wrongReasons || []).forEach(r => { counts[r] = (counts[r] || 0) + 1; });
    });
    return Object.entries(counts).sort((a,b) => b[1]-a[1]);
  }, [rows]);

  async function handleSave() {
    setSaving(true);
    const data = { rows, overallNote, savedAt: new Date() };
    await onSave(data);
    setSaving(false);
    setViewMode(true);
  }

  // ── View mode (already saved analysis) ──
  if (viewMode) {
    const wrongBySubject = SUBJECTS.map(s => ({
      label: s, value: parseInt(rows[s]?.wrong) || 0,
      color: s==='Physics'?'#3b82f6':s==='Chemistry'?'#10b981':s==='Maths'?'#8b5cf6':'#f59e0b',
    }));
    const skipBySubject = SUBJECTS.map(s => ({
      label: s, value: parseInt(rows[s]?.skipped) || 0,
      color: '#f59e0b',
    }));

    return (
      <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
        <div className="modal-box">
          <div className="modal-header">
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{test.name} — Analysis</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{test.date} · {typeLabel(test.testType)}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setViewMode(false)} style={{ padding:'0.3rem 0.8rem', borderRadius:8, border:'1.5px solid var(--primary-color)', background:'transparent', color:'var(--primary-color)', fontWeight:700, cursor:'pointer', fontSize:'0.8rem' }}>✏️ Edit</button>
              <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.4rem', cursor:'pointer', color:'var(--text-secondary)', lineHeight:1 }}>×</button>
            </div>
          </div>

          {/* Summary pills */}
          <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap', margin:'1rem 0 0.5rem' }}>
            {[
              { label:'Score', val:`${test.obtainedMarks}/${test.totalMarks}` },
              { label:'Accuracy', val:`${test.accuracy}%` },
              { label:'Wrong', val:totalWrong },
              { label:'Skipped', val:totalSkipped },
            ].map(p => (
              <div key={p.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'0.4rem 0.8rem', textAlign:'center' }}>
                <div style={{ fontSize:'0.68rem', color:'var(--text-secondary)', fontWeight:600 }}>{p.label}</div>
                <div style={{ fontSize:'1rem', fontWeight:800, color:'var(--text)' }}>{p.val}</div>
              </div>
            ))}
          </div>

          <BarChart data={wrongBySubject.filter(d=>d.value>0)} title="❌ Wrong by Subject" />
          <BarChart data={skipBySubject.filter(d=>d.value>0)} title="⏭️ Skipped by Subject" />

          {reasonCounts.length > 0 && (
            <BarChart
              title="⚠️ Top Mistake Reasons"
              data={reasonCounts.map(([label, value], i) => ({
                label, value, color: ['#ef4444','#f59e0b','#8b5cf6','#3b82f6','#10b981'][i%5]
              }))}
            />
          )}

          {/* Per subject detail */}
          <div style={{ marginTop:'1rem' }}>
            {SUBJECTS.map(sub => {
              const r = rows[sub];
              const hasData = r?.wrong || r?.skipped || r?.wrongReasons?.length || r?.skipReasons?.length || r?.topicWork;
              if (!hasData) return null;
              return (
                <div key={sub} style={{ marginBottom:'0.8rem', background:'var(--surface)', borderRadius:10, padding:'0.75rem 1rem', border:'1px solid var(--border)' }}>
                  <div style={{ fontWeight:700, marginBottom:'0.3rem' }}>{sub}</div>
                  <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', display:'flex', flexWrap:'wrap', gap:'0.8rem' }}>
                    {r.wrong   && <span>❌ Wrong: <b style={{color:'var(--text)'}}>{r.wrong}</b></span>}
                    {r.skipped && <span>⏭️ Skipped: <b style={{color:'var(--text)'}}>{r.skipped}</b></span>}
                    {r.wrongReasons?.length > 0 && <span>Reasons: <b style={{color:'var(--text)'}}>{r.wrongReasons.join(', ')}</b></span>}
                    {r.topicWork && <span>📌 Need work: <b style={{color:'var(--text)'}}>{r.topicWork}</b></span>}
                  </div>
                </div>
              );
            })}
          </div>

          {overallNote && (
            <div style={{ marginTop:'0.5rem', background:'var(--surface)', borderRadius:10, padding:'0.75rem 1rem', border:'1px solid var(--border)' }}>
              <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'0.3rem' }}>📝 Overall Note</div>
              <div style={{ fontSize:'0.85rem', color:'var(--text)' }}>{overallNote}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Edit / Fill mode ──
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <div style={{ fontWeight:800, fontSize:'1.05rem' }}>📊 Analysis — {test.name}</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>{test.date} · Score: {test.obtainedMarks}/{test.totalMarks}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.4rem', cursor:'pointer', color:'var(--text-secondary)', lineHeight:1 }}>×</button>
        </div>

        <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)', marginBottom:'1rem', opacity:0.8 }}>
          Fill only what's relevant. Subjects with no mistakes can be left blank.
        </div>

        {SUBJECTS.map(sub => {
          const r = rows[sub];
          return (
            <div key={sub} style={{ marginBottom:'1.2rem', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
              {/* Subject header */}
              <div style={{ background:'var(--surface)', padding:'0.6rem 1rem', fontWeight:700, fontSize:'0.9rem', borderBottom:'1px solid var(--border)' }}>
                {sub}
              </div>
              <div style={{ padding:'0.9rem 1rem', display:'flex', flexDirection:'column', gap:'0.85rem' }}>

                {/* Wrong */}
                <div>
                  <label style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-secondary)', display:'block', marginBottom:'0.3rem' }}>❌ Wrong questions</label>
                  <input type="number" min="0" value={r.wrong}
                    onChange={e => updateRow(sub,'wrong',e.target.value)}
                    placeholder="0"
                    style={{ width:80, padding:'0.3rem 0.6rem', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', fontFamily:'inherit', fontSize:'0.9rem' }}
                  />
                </div>

                {parseInt(r.wrong) > 0 && (
                  <div>
                    <label style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-secondary)', display:'block', marginBottom:'0.4rem' }}>Why wrong? (select all that apply)</label>
                    <ReasonPicker
                      selected={r.wrongReasons}
                      onChange={v => updateRow(sub,'wrongReasons',v)}
                      presets={PRESET_WRONG_REASONS}
                      placeholder="Add your own reason..."
                    />
                  </div>
                )}

                {/* Skipped */}
                <div>
                  <label style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-secondary)', display:'block', marginBottom:'0.3rem' }}>⏭️ Skipped questions</label>
                  <input type="number" min="0" value={r.skipped}
                    onChange={e => updateRow(sub,'skipped',e.target.value)}
                    placeholder="0"
                    style={{ width:80, padding:'0.3rem 0.6rem', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', fontFamily:'inherit', fontSize:'0.9rem' }}
                  />
                </div>

                {parseInt(r.skipped) > 0 && (
                  <div>
                    <label style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-secondary)', display:'block', marginBottom:'0.4rem' }}>Why skipped?</label>
                    <ReasonPicker
                      selected={r.skipReasons}
                      onChange={v => updateRow(sub,'skipReasons',v)}
                      presets={PRESET_SKIP_REASONS}
                      placeholder="Add your own reason..."
                    />
                  </div>
                )}

                {/* Topic (optional) */}
                <div>
                  <label style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-secondary)', display:'block', marginBottom:'0.3rem' }}>📌 Topic needing work <span style={{opacity:0.6,fontWeight:400}}>(optional)</span></label>
                  <input value={r.topicWork}
                    onChange={e => updateRow(sub,'topicWork',e.target.value)}
                    placeholder="e.g., Rotational dynamics, Electrochemistry..."
                    style={{ width:'100%', padding:'0.3rem 0.6rem', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', fontFamily:'inherit', fontSize:'0.82rem', boxSizing:'border-box' }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Overall note */}
        <div style={{ marginBottom:'1.2rem' }}>
          <label style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-secondary)', display:'block', marginBottom:'0.4rem' }}>📝 Overall note / what to fix next time</label>
          <textarea value={overallNote} onChange={e => setOverallNote(e.target.value)}
            rows={2} placeholder="General observation from this test..."
            style={{ width:'100%', padding:'0.5rem 0.75rem', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', fontFamily:'inherit', fontSize:'0.82rem', boxSizing:'border-box', resize:'vertical' }}
          />
        </div>

        <div style={{ display:'flex', gap:'0.6rem', justifyContent:'flex-end' }}>
          <button type="button" onClick={onClose}
            style={{ padding:'0.5rem 1.2rem', borderRadius:10, border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            style={{ padding:'0.5rem 1.4rem', borderRadius:10, border:'none', background:'var(--primary-color)', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: saving?0.7:1 }}>
            {saving ? 'Saving...' : '💾 Save Analysis'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── All-Tests Conclusion Panel ────────────────────────────────────────────────
function ConclusionPanel({ tests }) {
  const analysed = tests.filter(t => t.analysis);
  if (analysed.length < 2) return null;

  // Aggregate wrong reasons across all analysed tests
  const reasonCounts = {};
  const subjectWrong = {};
  const subjectSkip  = {};
  const topicsNeedWork = [];

  analysed.forEach(t => {
    SUBJECTS.forEach(sub => {
      const r = t.analysis.rows?.[sub];
      if (!r) return;
      subjectWrong[sub] = (subjectWrong[sub]||0) + (parseInt(r.wrong)||0);
      subjectSkip[sub]  = (subjectSkip[sub]||0)  + (parseInt(r.skipped)||0);
      (r.wrongReasons||[]).forEach(reason => { reasonCounts[reason] = (reasonCounts[reason]||0)+1; });
      if (r.topicWork?.trim()) topicsNeedWork.push(`${sub}: ${r.topicWork.trim()}`);
    });
  });

  const topReasons = Object.entries(reasonCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const worstSubject = Object.entries(subjectWrong).sort((a,b)=>b[1]-a[1])[0];

  const wrongBarData = SUBJECTS.map(s => ({
    label: s, value: subjectWrong[s]||0,
    color: s==='Physics'?'#3b82f6':s==='Chemistry'?'#10b981':s==='Maths'?'#8b5cf6':'#f59e0b',
  }));
  const reasonBarData = topReasons.map(([label,value],i) => ({
    label, value, color: ['#ef4444','#f59e0b','#8b5cf6','#3b82f6','#10b981'][i],
  }));

  // Avg score %
  const avgScore = (analysed.reduce((s,t)=>s+(t.obtainedMarks/t.totalMarks),0)/analysed.length*100).toFixed(1);

  return (
    <div style={{ marginTop:'2rem', border:'1.5px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
      <div style={{ background:'linear-gradient(135deg,var(--primary-color),var(--secondary-color))', padding:'0.8rem 1.2rem' }}>
        <div style={{ color:'#fff', fontWeight:800, fontSize:'1rem' }}>📈 Overall Analysis — {analysed.length} tests</div>
        <div style={{ color:'rgba(255,255,255,0.75)', fontSize:'0.75rem' }}>Based on tests where analysis was filled</div>
      </div>
      <div style={{ padding:'1.2rem', display:'flex', flexDirection:'column', gap:'1.2rem' }}>

        {/* Avg score */}
        <div style={{ display:'flex', gap:'0.8rem', flexWrap:'wrap' }}>
          {[
            { label:'Avg Score', val:`${avgScore}%` },
            { label:'Most Wrong', val: worstSubject?worstSubject[0]:'—' },
            { label:'Top Mistake', val: topReasons[0]?topReasons[0][0]:'—' },
          ].map(p => (
            <div key={p.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'0.5rem 0.9rem', flex:1, minWidth:100, textAlign:'center' }}>
              <div style={{ fontSize:'0.68rem', color:'var(--text-secondary)', fontWeight:600 }}>{p.label}</div>
              <div style={{ fontSize:'0.95rem', fontWeight:800, color:'var(--text)' }}>{p.val}</div>
            </div>
          ))}
        </div>

        <BarChart data={wrongBarData.filter(d=>d.value>0)} title="❌ Total Wrong by Subject (all tests)" />
        <BarChart data={reasonBarData} title="⚠️ Most Common Mistake Reasons" />

        {topicsNeedWork.length > 0 && (
          <div>
            <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'0.5rem' }}>📌 Topics Needing Work</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem' }}>
              {[...new Set(topicsNeedWork)].map((t,i) => (
                <span key={i} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:20, padding:'0.2rem 0.7rem', fontSize:'0.75rem', color:'#ef4444', fontWeight:600 }}>{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Edit Test Form ────────────────────────────────────────────────────────────
function EditTestModal({ test, onClose, onSave }) {
  const [form, setForm] = useState({
    testType:     test.testType,
    name:         test.name,
    paper:        test.paper || '',
    date:         test.date,
    totalMarks:   test.totalMarks,
    obtainedMarks:test.obtainedMarks,
    accuracy:     test.accuracy,
  });

  function handleChange(e) {
    const { id, value } = e.target;
    if (id === 'testType') { setForm(prev => ({ ...prev, testType: value, paper: '', totalMarks: DEFAULT_MARKS[value]||300 })); return; }
    setForm(prev => ({ ...prev, [id]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await onSave({
      testType:     form.testType,
      name:         form.name,
      paper:        hasPaper(form.testType) ? form.paper : null,
      date:         form.date,
      totalMarks:   parseInt(form.totalMarks),
      obtainedMarks:parseInt(form.obtainedMarks),
      accuracy:     parseFloat(form.accuracy),
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div style={{ fontWeight:800, fontSize:'1.05rem' }}>✏️ Edit Test</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'1.4rem', cursor:'pointer', color:'var(--text-secondary)', lineHeight:1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ marginTop:'1rem' }}>
            <div className="form-group">
              <label htmlFor="testType">📋 Test Type</label>
              <select id="testType" value={form.testType} onChange={handleChange}>
                {TEST_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="name">📝 Test Name</label>
              <input id="name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="date">📅 Date</label>
              <input id="date" type="date" value={form.date} onChange={handleChange} required />
            </div>
            {hasPaper(form.testType) && (
              <div className="form-group">
                <label htmlFor="paper">📄 Paper</label>
                <select id="paper" value={form.paper} onChange={handleChange} required>
                  <option value="">— Select —</option>
                  <option value="1">Paper 1</option>
                  <option value="2">Paper 2</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="totalMarks">🏁 Total Marks</label>
              <input id="totalMarks" type="number" value={form.totalMarks} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="obtainedMarks">✅ Obtained</label>
              <input id="obtainedMarks" type="number" value={form.obtainedMarks} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="accuracy">🎯 Accuracy %</label>
              <input id="accuracy" type="number" step="0.1" value={form.accuracy} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">💾 Save Changes</button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TestsTab({ tests, onRefresh, onNotify, user }) {
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState({ testType:'Mains', name:'', paper:'', date:'', totalMarks:300, obtainedMarks:'', accuracy:'' });
  const [analysisTest, setAnalysisTest] = useState(null); // test being analysed
  const [editTest, setEditTest]         = useState(null); // test being edited

  function handleChange(e) {
    const { id, value } = e.target;
    if (id === 'testType') { setForm(prev => ({ ...prev, testType:value, paper:'', totalMarks:DEFAULT_MARKS[value]||300 })); return; }
    setForm(prev => ({ ...prev, [id]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const needsPaper = hasPaper(form.testType);
    try {
      await addDoc(collection(db,'tests'), {
        testType:     form.testType,
        name:         form.name,
        paper:        needsPaper ? form.paper : null,
        date:         form.date,
        totalMarks:   parseInt(form.totalMarks),
        obtainedMarks:parseInt(form.obtainedMarks),
        accuracy:     parseFloat(form.accuracy),
        timestamp:    new Date(),
        uid:          user.uid,
      });
      setForm({ testType:'Mains', name:'', paper:'', date:'', totalMarks:300, obtainedMarks:'', accuracy:'' });
      setShowForm(false);
      onRefresh();
      onNotify('Test added!', 'success');
    } catch { onNotify('Failed to add test', 'error'); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this test?')) return;
    try { await deleteDoc(doc(db,'tests',id)); onRefresh(); onNotify('Test deleted','success'); }
    catch { onNotify('Failed to delete','error'); }
  }

  async function handleSaveAnalysis(testId, data) {
    try {
      await updateDoc(doc(db,'tests',testId), { analysis: data });
      onRefresh();
      onNotify('Analysis saved!','success');
    } catch { onNotify('Failed to save analysis','error'); }
  }

  async function handleSaveEdit(testId, data) {
    try {
      await updateDoc(doc(db,'tests',testId), data);
      onRefresh();
      onNotify('Test updated!','success');
    } catch { onNotify('Failed to update','error'); }
  }

  const showPaperField = hasPaper(form.testType);

  return (
    <section className="tab-content active">
      <div className="section-header">
        <h2>🧪 Test Tracker</h2>
        <button className="btn-primary" onClick={() => { setForm({ testType:'Mains', name:'', paper:'', date:'', totalMarks:300, obtainedMarks:'', accuracy:'' }); setShowForm(v=>!v); }}>
          <span>+</span> Add Test
        </button>
      </div>

      {showForm && (
        <form className="form-container" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="testType">📋 Test Type</label>
              <select id="testType" value={form.testType} onChange={handleChange} required>
                {TEST_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="name">📝 Test Name</label>
              <input id="name" value={form.name} onChange={handleChange} placeholder="e.g., Mock Test 5" required />
            </div>
            <div className="form-group">
              <label htmlFor="date">📅 Date</label>
              <input id="date" type="date" value={form.date} onChange={handleChange} required />
            </div>
            {showPaperField && (
              <div className="form-group">
                <label htmlFor="paper">📄 Paper</label>
                <select id="paper" value={form.paper} onChange={handleChange} required>
                  <option value="">— Select Paper —</option>
                  <option value="1">Paper 1</option>
                  <option value="2">Paper 2</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="totalMarks">🏁 Total Marks</label>
              <input id="totalMarks" type="number" value={form.totalMarks} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="obtainedMarks">✅ Obtained Marks</label>
              <input id="obtainedMarks" type="number" value={form.obtainedMarks} onChange={handleChange} placeholder="0" required />
            </div>
            <div className="form-group">
              <label htmlFor="accuracy">🎯 Accuracy %</label>
              <input id="accuracy" type="number" step="0.1" value={form.accuracy} onChange={handleChange} placeholder="0" required />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">💾 Save Test</button>
            <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Tests List */}
      <div className="tests-container">
        {DISPLAY_GROUPS.map(type => {
          const typeTests = tests.filter(t=>t.testType===type).sort((a,b)=>new Date(b.date)-new Date(a.date));
          if (!typeTests.length) return null;
          return (
            <div className="test-category" key={type}>
              <div className="test-category-title">{typeLabel(type)}</div>
              <div className="test-list">
                {typeTests.map(test => {
                  const hasAnalysis = !!test.analysis;
                  return (
                    <div className="test-card" key={test.id}>
                      <div className="test-info">
                        <div className="test-name">
                          {test.name}
                          {test.paper && <span style={{ color:'var(--text-secondary)', fontWeight:500, marginLeft:'0.4rem' }}>(Paper {test.paper})</span>}
                          {hasAnalysis && <span style={{ marginLeft:'0.5rem', fontSize:'0.65rem', background:'rgba(16,185,129,0.15)', color:'#10b981', border:'1px solid #10b981', borderRadius:20, padding:'0.1rem 0.5rem', fontWeight:700 }}>✓ Analysed</span>}
                        </div>
                        <div className="test-date">📅 {test.date}</div>
                        <div className="test-scores">
                          <div className="score-item">📊 Score: <span className="score-value">{test.obtainedMarks}/{test.totalMarks}</span></div>
                          <div className="score-item">🎯 Accuracy: <span className="score-value">{test.accuracy}%</span></div>
                        </div>
                        <ScoreBar obtained={test.obtainedMarks} total={test.totalMarks} />
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', alignItems:'flex-end', flexShrink:0 }}>
                        <button onClick={() => setEditTest(test)}
                          style={{ padding:'0.3rem 0.7rem', borderRadius:8, border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontWeight:600, cursor:'pointer', fontSize:'0.75rem', whiteSpace:'nowrap', fontFamily:'inherit' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => setAnalysisTest(test)}
                          style={{ padding:'0.3rem 0.7rem', borderRadius:8, border:`1.5px solid ${hasAnalysis?'#10b981':'var(--primary-color)'}`, background: hasAnalysis?'rgba(16,185,129,0.1)':'rgba(59,130,246,0.08)', color:hasAnalysis?'#10b981':'var(--primary-color)', fontWeight:700, cursor:'pointer', fontSize:'0.75rem', whiteSpace:'nowrap', fontFamily:'inherit' }}>
                          {hasAnalysis ? '📊 View' : '📊 Analyse'}
                        </button>
                        <button onClick={() => handleDelete(test.id)}
                          style={{ padding:'0.3rem 0.7rem', borderRadius:8, border:'1.5px solid var(--accent-red)', background:'rgba(239,68,68,0.08)', color:'var(--accent-red)', fontWeight:600, cursor:'pointer', fontSize:'0.75rem', fontFamily:'inherit' }}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!tests.length && <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'2rem' }}>No tests added yet.</p>}
      </div>

      {/* All-tests conclusion */}
      <ConclusionPanel tests={tests} />

      {/* Modals */}
      {analysisTest && (
        <AnalysisModal
          test={analysisTest}
          existingAnalysis={analysisTest.analysis || null}
          allTests={tests}
          onClose={() => { setAnalysisTest(null); onRefresh(); }}
          onSave={data => handleSaveAnalysis(analysisTest.id, data)}
        />
      )}
      {editTest && (
        <EditTestModal
          test={editTest}
          onClose={() => setEditTest(null)}
          onSave={data => handleSaveEdit(editTest.id, data)}
        />
      )}
    </section>
  );
}
