import { useState, useMemo, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ─── Constants ────────────────────────────────────────────────────────────────
const TEST_TYPES = [
  { value: 'Mains',   label: '🎯 Mains',                  hasPaper: false },
  { value: 'Advance', label: '📘 Advance',                hasPaper: true  },
  { value: 'AITs_M',  label: '⚡ AITs – Mains Pattern',   hasPaper: false },
  { value: 'AITs_A',  label: '⚡ AITs – Advance Pattern', hasPaper: true  },
];
const DEFAULT_MARKS = { Mains: 300, Advance: 180, AITs_M: 300, AITs_A: 180 };
const ALL_SUBJECTS  = ['Physics', 'Chemistry', 'Maths', 'Biology'];
const DISPLAY_GROUPS = ['Mains', 'Advance', 'AITs_M', 'AITs_A'];

const PRESET_WRONG_REASONS = [
  'Silly mistake', 'Concept not clear', 'Wrong formula applied',
  'Calculation error', 'Misread question', 'Time pressure', 'Guessed wrong',
];
const PRESET_SKIP_REASONS = [
  'Time ran out', 'Concept unknown', 'Too lengthy', 'Not attempted', 'Felt risky',
];

function typeLabel(v) { return TEST_TYPES.find(t => t.value === v)?.label || v; }
function hasPaper(v)  { return TEST_TYPES.find(t => t.value === v)?.hasPaper || false; }

// ─── Subject Preferences (localStorage) ───────────────────────────────────────
function useSubjectPrefs(uid) {
  const KEY = `subjectPrefs_${uid}`;
  const [subjects, setSubjects] = useState(() => {
    try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : ALL_SUBJECTS; }
    catch { return ALL_SUBJECTS; }
  });
  function save(list) {
    setSubjects(list);
    localStorage.setItem(KEY, JSON.stringify(list));
  }
  return [subjects, save];
}

// ─── QnTag Input  (question numbers as chips) ────────────────────────────────
// User types "45" hits Enter/Space/comma → chip appears
function QnTagInput({ tags, onChange, placeholder }) {
  const [input, setInput] = useState('');

  function commit(raw) {
    // support multiple nums separated by space/comma
    const nums = raw.split(/[\s,]+/).map(s => s.trim()).filter(s => /^\d+$/.test(s));
    if (!nums.length) return;
    const next = [...new Set([...tags, ...nums])];
    onChange(next);
    setInput('');
  }

  function onKey(e) {
    if (['Enter',',' ,' '].includes(e.key)) {
      e.preventDefault();
      commit(input);
    } else if (e.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  function removeTag(t) { onChange(tags.filter(x => x !== t)); }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '0.3rem',
      border: '1px solid var(--border)', borderRadius: 10, padding: '0.4rem 0.6rem',
      background: 'transparent', minHeight: 38, cursor: 'text',
      alignItems: 'center',
    }}
      onClick={() => document.getElementById('qn-input-' + placeholder)?.focus()}
    >
      {tags.map(t => (
        <span key={t} style={{
          background: 'rgba(59,130,246,0.12)', border: '1.5px solid rgba(59,130,246,0.4)',
          borderRadius: 6, padding: '0.1rem 0.45rem', fontSize: '0.78rem',
          fontWeight: 700, color: 'var(--primary-color)',
          display: 'flex', alignItems: 'center', gap: '0.2rem',
        }}>
          Q{t}
          <button type="button" onClick={e => { e.stopPropagation(); removeTag(t); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)', fontSize: '0.8rem', lineHeight: 1, padding: 0, fontWeight: 900 }}>×</button>
        </span>
      ))}
      <input
        id={`qn-input-${placeholder}`}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => input.trim() && commit(input)}
        placeholder={tags.length ? '' : placeholder}
        style={{
          border: 'none', outline: 'none', background: 'transparent',
          color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit',
          minWidth: 60, flex: 1,
        }}
      />
    </div>
  );
}

// ─── Reason Tag Picker ─────────────────────────────────────────────────────────
function ReasonPicker({ selected, onChange, presets, placeholder }) {
  const [custom, setCustom] = useState('');

  function toggle(r) {
    onChange(selected.includes(r) ? selected.filter(x => x !== r) : [...selected, r]);
  }
  function addCustom() {
    const v = custom.trim();
    if (!v || selected.includes(v)) { setCustom(''); return; }
    onChange([...selected, v]);
    setCustom('');
  }
  const allOptions = [...new Set([...presets, ...selected])];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.4rem' }}>
        {allOptions.map(r => (
          <button key={r} type="button" onClick={() => toggle(r)}
            style={{
              padding: '0.2rem 0.65rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
              border: `1.5px solid ${selected.includes(r) ? 'var(--primary-color)' : 'var(--border)'}`,
              background: selected.includes(r) ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: selected.includes(r) ? 'var(--primary-color)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.12s',
            }}>{selected.includes(r) ? '✓ ' : ''}{r}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        <input value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder={placeholder}
          style={{ flex: 1, fontSize: '0.78rem', padding: '0.28rem 0.55rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit' }}
        />
        <button type="button" onClick={addCustom}
          style={{ padding: '0.28rem 0.65rem', borderRadius: 8, border: 'none', background: 'var(--primary-color)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          +
        </button>
      </div>
    </div>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ obtained, total }) {
  const pct = total > 0 ? Math.min((obtained / total) * 100, 100) : 0;
  const color = pct >= 70 ? '#10b981' : pct >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginTop: 6, marginBottom: 2 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.5s' }} />
    </div>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────
function BarChart({ data, title }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ marginTop: '0.75rem' }}>
      {title && <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', width: 90, flexShrink: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 99, height: 16, overflow: 'hidden' }}>
              <div style={{ width: `${(d.value / max) * 100}%`, height: '100%', background: d.color || 'var(--primary-color)', borderRadius: 99, display: 'flex', alignItems: 'center', paddingLeft: 6, transition: 'width 0.5s' }}>
                {d.value > 0 && <span style={{ fontSize: '0.6rem', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{d.value}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Subject Picker Modal ─────────────────────────────────────────────────────
function SubjectPickerModal({ current, onSave, onClose }) {
  const [sel, setSel] = useState(current);
  function toggle(s) { setSel(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]); }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} onTouchMove={e => e.stopPropagation()}>
      <div className="modal-box" style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>📚 Your Subjects</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Select only the subjects in your exam. Analysis will only show these.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.2rem' }}>
          {ALL_SUBJECTS.map(s => (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.7rem 1rem', border: `2px solid ${sel.includes(s) ? 'var(--primary-color)' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', background: sel.includes(s) ? 'rgba(59,130,246,0.08)' : 'transparent', transition: 'all 0.15s' }}>
              <input type="checkbox" checked={sel.includes(s)} onChange={() => toggle(s)} style={{ width: 18, height: 18, accentColor: 'var(--primary-color)' }} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{s}</span>
            </label>
          ))}
        </div>
        <button onClick={() => { if (sel.length === 0) return; onSave(sel); onClose(); }}
          className="btn-primary" style={{ width: '100%' }}>
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Analysis Modal ────────────────────────────────────────────────────────────
function AnalysisModal({ test, onClose, onSave, existingAnalysis, activeSubjects }) {
  const emptyRow = () => ({ wrongQns: [], wrongReasons: [], skippedQns: [], skipReasons: [], topicWork: '' });
  const initRows = () => {
    if (existingAnalysis?.rows) return existingAnalysis.rows;
    return Object.fromEntries(activeSubjects.map(s => [s, emptyRow()]));
  };

  const [rows, setRows] = useState(initRows);
  const [overallNote, setOverallNote] = useState(existingAnalysis?.overallNote || '');
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(!!existingAnalysis);

  function updateRow(subject, field, value) {
    setRows(prev => ({ ...prev, [subject]: { ...prev[subject], [field]: value } }));
  }

  // Summary numbers
  const totalWrong   = activeSubjects.reduce((s, sub) => s + (rows[sub]?.wrongQns?.length   || 0), 0);
  const totalSkipped = activeSubjects.reduce((s, sub) => s + (rows[sub]?.skippedQns?.length || 0), 0);

  const reasonCounts = useMemo(() => {
    const counts = {};
    activeSubjects.forEach(sub => {
      (rows[sub]?.wrongReasons || []).forEach(r => { counts[r] = (counts[r] || 0) + 1; });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [rows, activeSubjects]);

  async function handleSave() {
    setSaving(true);
    await onSave({ rows, overallNote, savedAt: new Date() });
    setSaving(false);
    setViewMode(true);
  }

  // ── View mode ──
  if (viewMode) {
    const wrongBarData = activeSubjects.map((s, i) => ({
      label: s, value: rows[s]?.wrongQns?.length || 0,
      color: ['#3b82f6','#10b981','#8b5cf6','#f59e0b'][i % 4],
    }));
    const skipBarData = activeSubjects.map((s, i) => ({
      label: s, value: rows[s]?.skippedQns?.length || 0,
      color: '#f59e0b',
    }));

    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} onTouchMove={e => e.stopPropagation()}>
        <div className="modal-box">
          <div className="modal-header">
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{test.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{test.date} · {typeLabel(test.testType)}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button onClick={() => setViewMode(false)} style={{ padding: '0.28rem 0.7rem', borderRadius: 8, border: '1.5px solid var(--primary-color)', background: 'transparent', color: 'var(--primary-color)', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit' }}>✏️ Edit</button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1 }}>×</button>
            </div>
          </div>

          {/* Summary pills */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.8rem 0' }}>
            {[
              { label: 'Score',    val: `${test.obtainedMarks}/${test.totalMarks}` },
              { label: 'Accuracy', val: `${test.accuracy}%` },
              { label: 'Wrong',    val: totalWrong },
              { label: 'Skipped',  val: totalSkipped },
            ].map(p => (
              <div key={p.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.35rem 0.75rem', textAlign: 'center', flex: 1, minWidth: 70 }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{p.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>{p.val}</div>
              </div>
            ))}
          </div>

          <BarChart data={wrongBarData.filter(d => d.value > 0)} title="❌ Wrong Qs by Subject" />
          <BarChart data={skipBarData.filter(d => d.value > 0)} title="⏭️ Skipped Qs by Subject" />
          {reasonCounts.length > 0 && (
            <BarChart title="⚠️ Top Mistake Reasons"
              data={reasonCounts.map(([label, value], i) => ({ label, value, color: ['#ef4444','#f59e0b','#8b5cf6','#3b82f6','#10b981'][i % 5] }))}
            />
          )}

          {/* Per subject detail */}
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {activeSubjects.map(sub => {
              const r = rows[sub];
              const hasData = r?.wrongQns?.length || r?.skippedQns?.length || r?.topicWork;
              if (!hasData) return null;
              return (
                <div key={sub} style={{ background: 'var(--surface)', borderRadius: 10, padding: '0.7rem 0.9rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.35rem', fontSize: '0.9rem' }}>{sub}</div>
                  {r.wrongQns?.length > 0 && (
                    <div style={{ marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>❌ Wrong: </span>
                      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                        {r.wrongQns.map(q => <span key={q} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, padding: '0.05rem 0.4rem', fontSize: '0.72rem', fontWeight: 700, color: '#ef4444' }}>Q{q}</span>)}
                      </span>
                      {r.wrongReasons?.length > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Reasons: {r.wrongReasons.join(', ')}</div>}
                    </div>
                  )}
                  {r.skippedQns?.length > 0 && (
                    <div style={{ marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>⏭️ Skipped: </span>
                      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                        {r.skippedQns.map(q => <span key={q} style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 5, padding: '0.05rem 0.4rem', fontSize: '0.72rem', fontWeight: 700, color: '#d97706' }}>Q{q}</span>)}
                      </span>
                      {r.skipReasons?.length > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Reasons: {r.skipReasons.join(', ')}</div>}
                    </div>
                  )}
                  {r.topicWork && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>📌 {r.topicWork}</div>}
                </div>
              );
            })}
          </div>

          {overallNote && (
            <div style={{ marginTop: '0.8rem', background: 'var(--surface)', borderRadius: 10, padding: '0.7rem 0.9rem', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>📝 Overall Note</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{overallNote}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Edit / Fill mode ──
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} onTouchMove={e => e.stopPropagation()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>📊 {test.name} — Analysis</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{test.date} · Score: {test.obtainedMarks}/{test.totalMarks}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1 }}>×</button>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.4rem 0 1rem', opacity: 0.8 }}>
          Type Q numbers (e.g. 45, 12) and press Space or Enter to add. Leave blank if none.
        </p>

        {activeSubjects.map(sub => {
          const r = rows[sub] || emptyRow();
          return (
            <div key={sub} style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ background: 'var(--surface)', padding: '0.5rem 0.9rem', fontWeight: 700, fontSize: '0.88rem', borderBottom: '1px solid var(--border)' }}>{sub}</div>
              <div style={{ padding: '0.8rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                {/* Wrong Qs */}
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>❌ Wrong question numbers</label>
                  <QnTagInput tags={r.wrongQns} onChange={v => updateRow(sub, 'wrongQns', v)} placeholder="type 45 23 → Space/Enter" />
                </div>

                {r.wrongQns?.length > 0 && (
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Why wrong?</label>
                    <ReasonPicker selected={r.wrongReasons} onChange={v => updateRow(sub, 'wrongReasons', v)} presets={PRESET_WRONG_REASONS} placeholder="Add own reason..." />
                  </div>
                )}

                {/* Skipped Qs */}
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>⏭️ Skipped question numbers</label>
                  <QnTagInput tags={r.skippedQns} onChange={v => updateRow(sub, 'skippedQns', v)} placeholder="type 10 33 → Space/Enter" />
                </div>

                {r.skippedQns?.length > 0 && (
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Why skipped?</label>
                    <ReasonPicker selected={r.skipReasons} onChange={v => updateRow(sub, 'skipReasons', v)} presets={PRESET_SKIP_REASONS} placeholder="Add own reason..." />
                  </div>
                )}

                {/* Topic */}
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>📌 Topic needing work <span style={{ opacity: 0.6, fontWeight: 400 }}>(optional)</span></label>
                  <input value={r.topicWork} onChange={e => updateRow(sub, 'topicWork', e.target.value)}
                    placeholder="e.g. Rotational dynamics..."
                    style={{ width: '100%', padding: '0.32rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>📝 Overall note</label>
          <textarea value={overallNote} onChange={e => setOverallNote(e.target.value)} rows={2}
            placeholder="What to fix next time..."
            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.82rem', boxSizing: 'border-box', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}
            style={{ padding: '0.5rem 1.1rem', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            style={{ padding: '0.5rem 1.3rem', borderRadius: 10, border: 'none', background: 'var(--primary-color)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── All-Tests Conclusion ─────────────────────────────────────────────────────
function ConclusionPanel({ tests, activeSubjects }) {
  const analysed = tests.filter(t => t.analysis);
  if (analysed.length < 2) return null;

  const reasonCounts = {}, subjectWrong = {}, subjectSkip = {}, topicsNeedWork = [];
  analysed.forEach(t => {
    activeSubjects.forEach(sub => {
      const r = t.analysis.rows?.[sub];
      if (!r) return;
      subjectWrong[sub] = (subjectWrong[sub] || 0) + (r.wrongQns?.length || 0);
      subjectSkip[sub]  = (subjectSkip[sub]  || 0) + (r.skippedQns?.length || 0);
      (r.wrongReasons || []).forEach(reason => { reasonCounts[reason] = (reasonCounts[reason] || 0) + 1; });
      if (r.topicWork?.trim()) topicsNeedWork.push(`${sub}: ${r.topicWork.trim()}`);
    });
  });

  const topReasons  = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const worstSub    = Object.entries(subjectWrong).sort((a, b) => b[1] - a[1])[0];
  const avgScore    = (analysed.reduce((s, t) => s + (t.obtainedMarks / t.totalMarks), 0) / analysed.length * 100).toFixed(1);

  const COLORS = { Physics: '#3b82f6', Chemistry: '#10b981', Maths: '#8b5cf6', Biology: '#f59e0b' };

  return (
    <div style={{ marginTop: '2rem', border: '1.5px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ background: 'linear-gradient(135deg,var(--primary-color),var(--secondary-color))', padding: '0.8rem 1.2rem' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>📈 Overall Analysis — {analysed.length} tests</div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem' }}>Tests with analysis filled</div>
      </div>
      <div style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Avg Score', val: `${avgScore}%` },
            { label: 'Most Wrong', val: worstSub?.[0] || '—' },
            { label: 'Top Mistake', val: topReasons[0]?.[0] || '—' },
          ].map(p => (
            <div key={p.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.45rem 0.8rem', flex: 1, minWidth: 90, textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{p.label}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)' }}>{p.val}</div>
            </div>
          ))}
        </div>
        <BarChart data={activeSubjects.map(s => ({ label: s, value: subjectWrong[s] || 0, color: COLORS[s] })).filter(d => d.value > 0)} title="❌ Total Wrong by Subject" />
        <BarChart data={topReasons.map(([label, value], i) => ({ label, value, color: ['#ef4444','#f59e0b','#8b5cf6','#3b82f6','#10b981'][i] }))} title="⚠️ Most Common Mistakes" />
        {topicsNeedWork.length > 0 && (
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>📌 Topics Needing Work</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {[...new Set(topicsNeedWork)].map((t, i) => (
                <span key={i} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20, padding: '0.15rem 0.65rem', fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Edit Test Modal ──────────────────────────────────────────────────────────
function EditTestModal({ test, onClose, onSave }) {
  const [form, setForm] = useState({
    testType: test.testType, name: test.name, paper: test.paper || '',
    date: test.date, totalMarks: test.totalMarks, obtainedMarks: test.obtainedMarks, accuracy: test.accuracy,
  });
  function handleChange(e) {
    const { id, value } = e.target;
    if (id === 'testType') { setForm(prev => ({ ...prev, testType: value, paper: '', totalMarks: DEFAULT_MARKS[value] || 300 })); return; }
    setForm(prev => ({ ...prev, [id]: value }));
  }
  async function handleSubmit(e) {
    e.preventDefault();
    await onSave({ testType: form.testType, name: form.name, paper: hasPaper(form.testType) ? form.paper : null, date: form.date, totalMarks: parseInt(form.totalMarks), obtainedMarks: parseInt(form.obtainedMarks), accuracy: parseFloat(form.accuracy) });
    onClose();
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} onTouchMove={e => e.stopPropagation()}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>✏️ Edit Test</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <div className="form-grid">
            <div className="form-group"><label htmlFor="testType">📋 Type</label><select id="testType" value={form.testType} onChange={handleChange}>{TEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div className="form-group"><label htmlFor="name">📝 Name</label><input id="name" value={form.name} onChange={handleChange} required /></div>
            <div className="form-group"><label htmlFor="date">📅 Date</label><input id="date" type="date" value={form.date} onChange={handleChange} required /></div>
            {hasPaper(form.testType) && <div className="form-group"><label htmlFor="paper">📄 Paper</label><select id="paper" value={form.paper} onChange={handleChange} required><option value="">—</option><option value="1">Paper 1</option><option value="2">Paper 2</option></select></div>}
            <div className="form-group"><label htmlFor="totalMarks">🏁 Total</label><input id="totalMarks" type="number" value={form.totalMarks} onChange={handleChange} required /></div>
            <div className="form-group"><label htmlFor="obtainedMarks">✅ Obtained</label><input id="obtainedMarks" type="number" value={form.obtainedMarks} onChange={handleChange} required /></div>
            <div className="form-group"><label htmlFor="accuracy">🎯 Accuracy%</label><input id="accuracy" type="number" step="0.1" value={form.accuracy} onChange={handleChange} required /></div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">💾 Save</button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Undo Timer Bar ──────────────────────────────────────────────────────────
function UndoTimer() {
  const [pct, setPct] = useState(100);
  useEffect(() => {
    const start = Date.now();
    const total = 5000;
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, ((total - elapsed) / total) * 100);
      setPct(remaining);
      if (remaining === 0) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ height: 3, background: 'rgba(255,255,255,0.25)', borderRadius: 99, overflow: 'hidden', marginTop: '0.4rem' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: '#fff', borderRadius: 99, transition: 'width 0.05s linear' }} />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TestsTab({ tests, onRefresh, onNotify, user }) {
  const [showForm, setShowForm]           = useState(false);
  const [form, setForm]                   = useState({ testType: 'Mains', name: '', paper: '', date: '', totalMarks: 300, obtainedMarks: '', accuracy: '' });
  const [analysisTest, setAnalysisTest]   = useState(null);
  const [editTest, setEditTest]           = useState(null);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [activeSubjects, saveSubjects]    = useSubjectPrefs(user.uid);
  const [pendingDelete, setPendingDelete] = useState(null); // { id, name, timerRef }

  function handleChange(e) {
    const { id, value } = e.target;
    if (id === 'testType') { setForm(prev => ({ ...prev, testType: value, paper: '', totalMarks: DEFAULT_MARKS[value] || 300 })); return; }
    setForm(prev => ({ ...prev, [id]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'tests'), {
        testType: form.testType, name: form.name,
        paper: hasPaper(form.testType) ? form.paper : null,
        date: form.date, totalMarks: parseInt(form.totalMarks),
        obtainedMarks: parseInt(form.obtainedMarks), accuracy: parseFloat(form.accuracy),
        timestamp: new Date(), uid: user.uid,
      });
      setForm({ testType: 'Mains', name: '', paper: '', date: '', totalMarks: 300, obtainedMarks: '', accuracy: '' });
      setShowForm(false); onRefresh(); onNotify('Test added!', 'success');
    } catch { onNotify('Failed to add test', 'error'); }
  }

  function handleDelete(id, name) {
    // Cancel any existing pending delete
    if (pendingDelete?.timerRef) clearTimeout(pendingDelete.timerRef);
    // Schedule actual delete after 5s
    const timerRef = setTimeout(async () => {
      try { await deleteDoc(doc(db, 'tests', id)); onRefresh(); }
      catch { onNotify('Failed to delete', 'error'); }
      setPendingDelete(null);
    }, 5000);
    setPendingDelete({ id, name, timerRef });
  }

  function handleUndoDelete() {
    if (pendingDelete?.timerRef) clearTimeout(pendingDelete.timerRef);
    setPendingDelete(null);
    onNotify('Delete cancelled ✓', 'success');
  }

  async function handleSaveAnalysis(testId, data) {
    try { await updateDoc(doc(db, 'tests', testId), { analysis: data }); onRefresh(); onNotify('Analysis saved!', 'success'); }
    catch { onNotify('Failed to save analysis', 'error'); }
  }

  async function handleSaveEdit(testId, data) {
    try { await updateDoc(doc(db, 'tests', testId), data); onRefresh(); onNotify('Test updated!', 'success'); }
    catch { onNotify('Failed to update', 'error'); }
  }

  return (
    <section className="tab-content active">
      {/* Header */}
      <div className="section-header">
        <h2>🧪 Test Tracker</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setShowSubjectPicker(true)}
            style={{ padding: '0.4rem 0.7rem', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}>
            📚 Subjects
          </button>
          <button className="btn-primary" onClick={() => { setForm({ testType: 'Mains', name: '', paper: '', date: '', totalMarks: 300, obtainedMarks: '', accuracy: '' }); setShowForm(v => !v); }}>
            <span>+</span> Add
          </button>
        </div>
      </div>

      {showForm && (
        <form className="form-container" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group"><label htmlFor="testType">📋 Test Type</label><select id="testType" value={form.testType} onChange={handleChange} required>{TEST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div className="form-group"><label htmlFor="name">📝 Name</label><input id="name" value={form.name} onChange={handleChange} placeholder="e.g., Mock Test 5" required /></div>
            <div className="form-group"><label htmlFor="date">📅 Date</label><input id="date" type="date" value={form.date} onChange={handleChange} required /></div>
            {hasPaper(form.testType) && <div className="form-group"><label htmlFor="paper">📄 Paper</label><select id="paper" value={form.paper} onChange={handleChange} required><option value="">— Select —</option><option value="1">Paper 1</option><option value="2">Paper 2</option></select></div>}
            <div className="form-group"><label htmlFor="totalMarks">🏁 Total Marks</label><input id="totalMarks" type="number" value={form.totalMarks} onChange={handleChange} required /></div>
            <div className="form-group"><label htmlFor="obtainedMarks">✅ Obtained</label><input id="obtainedMarks" type="number" value={form.obtainedMarks} onChange={handleChange} placeholder="0" required /></div>
            <div className="form-group"><label htmlFor="accuracy">🎯 Accuracy %</label><input id="accuracy" type="number" step="0.1" value={form.accuracy} onChange={handleChange} placeholder="0" required /></div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">💾 Save Test</button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Tests list */}
      <div className="tests-container">
        {DISPLAY_GROUPS.map(type => {
          const typeTests = tests.filter(t => t.testType === type).sort((a, b) => new Date(b.date) - new Date(a.date));
          if (!typeTests.length) return null;
          return (
            <div className="test-category" key={type}>
              <div className="test-category-title">{typeLabel(type)}</div>
              <div className="test-list">
                {typeTests.map(test => {
                  const hasAnalysis = !!test.analysis;
                  return (
                    <div className="test-card" key={test.id}>
                      {/* Left: info */}
                      <div className="test-info" style={{ flex: 1, minWidth: 0 }}>
                        <div className="test-name">
                          {test.name}
                          {test.paper && <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.82rem', marginLeft: '0.35rem' }}>(P{test.paper})</span>}
                          {hasAnalysis && <span style={{ marginLeft: '0.4rem', fontSize: '0.62rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981', borderRadius: 20, padding: '0.08rem 0.45rem', fontWeight: 700, verticalAlign: 'middle' }}>✓</span>}
                        </div>
                        <div className="test-date">📅 {test.date}</div>
                        <div className="test-scores" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span className="score-item">📊 <span className="score-value">{test.obtainedMarks}/{test.totalMarks}</span></span>
                          <span className="score-item">🎯 <span className="score-value">{test.accuracy}%</span></span>
                        </div>
                        <ScoreBar obtained={test.obtainedMarks} total={test.totalMarks} />
                      </div>
                      {/* Right: actions */}
                      <div className="test-card-actions">
                        <button onClick={() => setEditTest(test)} className="tca-btn tca-edit">✏️</button>
                        <button onClick={() => setAnalysisTest(test)} className={`tca-btn tca-analyse ${hasAnalysis ? 'done' : ''}`}>
                          {hasAnalysis ? '📊' : '📊'}
                          <span>{hasAnalysis ? 'View' : 'Analyse'}</span>
                        </button>
                        <button onClick={() => handleDelete(test.id, test.name)} className="tca-btn tca-del">🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!tests.length && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No tests added yet.</p>}
      </div>

      <ConclusionPanel tests={tests} activeSubjects={activeSubjects} />

      {/* Modals */}
      {analysisTest && (
        <AnalysisModal test={analysisTest} existingAnalysis={analysisTest.analysis || null}
          activeSubjects={activeSubjects}
          onClose={() => { setAnalysisTest(null); onRefresh(); }}
          onSave={data => handleSaveAnalysis(analysisTest.id, data)}
        />
      )}
      {editTest && (
        <EditTestModal test={editTest} onClose={() => setEditTest(null)}
          onSave={data => handleSaveEdit(editTest.id, data)}
        />
      )}
      {showSubjectPicker && (
        <SubjectPickerModal current={activeSubjects} onSave={saveSubjects} onClose={() => setShowSubjectPicker(false)} />
      )}

      {/* Undo Delete Toast */}
      {pendingDelete && (
        <div className="undo-toast">
          <span>🗑️ "<strong>{pendingDelete.name}</strong>" deleting…</span>
          <button onClick={handleUndoDelete} className="undo-btn">↩ Undo</button>
          <UndoTimer onDone={() => {}} />
        </div>
      )}
    </section>
  );
}
