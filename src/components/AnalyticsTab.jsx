import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

/* ── helpers ── */
function getStats(tests, type) {
  const filtered = tests.filter(t => t.testType === type);
  if (!filtered.length) return { count: 0, avgScore: 0, avgAccuracy: 0 };
  const avgScore    = (filtered.reduce((s, t) => s + t.obtainedMarks, 0) / filtered.length).toFixed(1);
  const avgAccuracy = (filtered.reduce((s, t) => s + t.accuracy,      0) / filtered.length).toFixed(1);
  return { count: filtered.length, avgScore, avgAccuracy };
}

/* ── mini bar chart (pure CSS/SVG, no library needed) ── */
function BarChart({ data, color = '#3b82f6', label = 'Classes' }) {
  if (!data.length) return <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No data for this month.</p>;

  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '200px', padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{d.value || ''}</span>
          <div
            style={{
              width: '100%',
              height: `${(d.value / max) * 160}px`,
              background: `linear-gradient(180deg, ${color}, ${color}99)`,
              borderRadius: '6px 6px 0 0',
              minHeight: d.value ? '6px' : '0',
              transition: 'height 0.4s ease',
            }}
          />
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.2 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── donut chart (SVG) ── */
function DonutChart({ data }) {
  if (!data.length) return <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No data for this month.</p>;

  const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899'];
  const total  = data.reduce((s, d) => s + d.value, 0);
  const r = 70, cx = 90, cy = 90, stroke = 28;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const slices = data.map((d, i) => {
    const pct   = d.value / total;
    const dash  = pct * circ;
    const slice = { ...d, dash, offset, color: COLORS[i % COLORS.length] };
    offset += dash;
    return slice;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-s.offset + circ / 4}
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text)">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">classes</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text)' }}>{s.label}</span>
            <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto', paddingLeft: '0.5rem', fontWeight: 600 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tree View Component ── */
function TreeView({ treeData }) {
  const [openSubjects, setOpenSubjects] = useState({});
  const [openChapters, setOpenChapters] = useState({});

  if (!Object.keys(treeData).length)
    return <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No data for this month.</p>;

  const toggleSubject = (subj) => setOpenSubjects(p => ({ ...p, [subj]: !p[subj] }));
  const toggleChapter = (key)  => setOpenChapters(p => ({ ...p, [key]: !p[key] }));

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
      {Object.entries(treeData).map(([subj, chapters]) => {
        const subjTotal = Object.values(chapters).reduce((s, topics) =>
          s + Object.values(topics._count).reduce((a, b) => a + b, 0), 0);
        const isSubjOpen = openSubjects[subj];

        return (
          <div key={subj} style={{ marginBottom: '0.4rem' }}>
            {/* Subject row */}
            <div
              onClick={() => toggleSubject(subj)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                cursor: 'pointer', padding: '0.45rem 0.6rem',
                borderRadius: '8px', fontWeight: 700,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', width: '12px' }}>
                {isSubjOpen ? '▼' : '▶'}
              </span>
              <span>📚</span>
              <span style={{ color: 'var(--text)', flex: 1 }}>{subj}</span>
              <span style={{
                background: 'var(--primary-color)', color: '#fff',
                borderRadius: '12px', padding: '0.1rem 0.5rem',
                fontSize: '0.75rem', fontWeight: 700,
              }}>{subjTotal}</span>
            </div>

            {/* Chapters */}
            {isSubjOpen && Object.entries(chapters).map(([chap, topics]) => {
              const chapTotal = Object.values(topics._count).reduce((a, b) => a + b, 0);
              const chapKey = `${subj}__${chap}`;
              const isChapOpen = openChapters[chapKey];

              return (
                <div key={chap} style={{ marginLeft: '1.2rem', marginTop: '0.3rem' }}>
                  {/* Chapter row */}
                  <div
                    onClick={() => toggleChapter(chapKey)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      cursor: 'pointer', padding: '0.35rem 0.6rem',
                      borderRadius: '6px', fontWeight: 600,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', width: '12px' }}>
                      {isChapOpen ? '▼' : '▶'}
                    </span>
                    <span>{isChapOpen ? '📂' : '📁'}</span>
                    <span style={{ color: 'var(--text)', flex: 1 }}>{chap}</span>
                    <span style={{
                      color: 'var(--primary-color)', fontWeight: 700, fontSize: '0.8rem'
                    }}>{chapTotal}</span>
                  </div>

                  {/* Topics — old to new, hide ×1 */}
                  {isChapOpen && topics._order.map((topic) => {
                    const count = topics._count[topic];
                    return (
                      <div
                        key={topic}
                        style={{
                          marginLeft: '1.4rem', marginTop: '0.25rem',
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '6px',
                          borderLeft: '2px solid var(--border)',
                          color: 'var(--text-secondary)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <span>📝</span>
                        <span style={{ flex: 1 }}>{topic}</span>
                        {count > 1 && (
                          <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>×{count}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════ */
export default function AnalyticsTab({ classes, tests }) {
  const today = new Date();
  const [month, setMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );

  /* filter by selected month */
  const [selYear, selMonth] = month.split('-').map(Number);

  const monthClasses = useMemo(() =>
    classes.filter(c => {
      if (!c.date) return false;
      const [y, m] = c.date.split('-').map(Number);
      return y === selYear && m === selMonth;
    }), [classes, selYear, selMonth]);

  const monthTests = useMemo(() =>
    tests.filter(t => {
      if (!t.date) return false;
      const [y, m] = t.date.split('-').map(Number);
      return y === selYear && m === selMonth;
    }), [tests, selYear, selMonth]);

  /* stats */
  const mains   = getStats(monthTests, 'Mains');
  const advance = getStats(monthTests, 'Advance');
  const aits    = getStats(monthTests, 'AITs');

  /* classes-per-day chart data */
  const classesPerDay = useMemo(() => {
    const daysInMonth = new Date(selYear, selMonth, 0).getDate();
    const map = {};
    monthClasses.forEach(c => {
      const day = parseInt(c.date?.split('-')[2]);
      map[day] = (map[day] || 0) + 1;
    });
    // show only days 1..daysInMonth, skip zeros but keep at least the days that have data
    const hasDays = Object.keys(map).map(Number);
    if (!hasDays.length) return [];
    const minDay = Math.min(...hasDays);
    const maxDay = Math.max(...hasDays);
    return Array.from({ length: maxDay - minDay + 1 }, (_, i) => {
      const d = minDay + i;
      return { label: String(d), value: map[d] || 0 };
    });
  }, [monthClasses, selYear, selMonth]);

  /* subject distribution donut data */
  const subjectData = useMemo(() => {
    const map = {};
    monthClasses.forEach(c => {
      if (c.subject) map[c.subject] = (map[c.subject] || 0) + 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthClasses]);

  /* chapter distribution */
  const chapterData = useMemo(() => {
    const map = {};
    monthClasses.forEach(c => {
      const key = c.chapter ? `${c.subject} – ${c.chapter}` : c.subject;
      if (key) map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthClasses]);

  /* tree data: subject → chapter → topics (old to new order) */
  const treeData = useMemo(() => {
    const tree = {};
    // monthClasses sorted by date asc (old first)
    const sorted = [...monthClasses].sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(c => {
      const subj = c.subject || 'Unknown';
      const chap = c.chapter || '(No Chapter)';
      const topic = c.topic || '(No Topic)';
      if (!tree[subj]) tree[subj] = {};
      if (!tree[subj][chap]) tree[subj][chap] = { _order: [], _count: {} };
      if (!tree[subj][chap]._count[topic]) {
        tree[subj][chap]._order.push(topic); // first time — push to preserve order
      }
      tree[subj][chap]._count[topic] = (tree[subj][chap]._count[topic] || 0) + 1;
    });
    return tree;
  }, [monthClasses]);


  /* ── COMPARISON ANALYSIS DATA ── */

  // 1. Attendance breakdown
  const attendanceStats = useMemo(() => {
    const total = monthClasses.length;
    if (!total) return [];
    const map = { Live: 0, Recorded: 0, Hybrid: 0 };
    monthClasses.forEach(c => { if (c.attendance) map[c.attendance] = (map[c.attendance] || 0) + 1; });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({
        label, value,
        pct: Math.round((value / total) * 100),
        color: label === 'Live' ? '#3b82f6' : label === 'Recorded' ? '#8b5cf6' : '#10b981',
        icon: label === 'Live' ? '📺' : label === 'Recorded' ? '📹' : '🔄',
      }));
  }, [monthClasses]);

  // 2. Study work accuracy
  const studyWorkStats = useMemo(() => {
    const total = monthClasses.length;
    if (!total) return [];
    const items = [
      { key: 'theory', label: 'Theory', icon: '📚', color: '#3b82f6', triState: false },
      { key: 'dpp',    label: 'DPP',    icon: '📋', color: '#8b5cf6', triState: true  },
      { key: 'notes',  label: 'Notes',  icon: '📝', color: '#10b981', triState: false },
      { key: 'hw',     label: 'HW',     icon: '✏️', color: '#f59e0b', triState: true  },
    ];
    return items.map(({ key, label, icon, color, triState }) => {
      const yes = monthClasses.filter(c => c[key] === 'Yes').length;
      const na  = triState ? monthClasses.filter(c => c[key] === 'N/A').length : 0;
      const applicable = total - na;
      const pct = applicable > 0 ? Math.round((yes / applicable) * 100) : 0;
      return { key, label, icon, color, yes, na, no: total - yes - na, pct, applicable, total };
    });
  }, [monthClasses]);

  // 3. Per-subject breakdown
  const subjectWorkStats = useMemo(() => {
    const map = {};
    monthClasses.forEach(c => {
      const s = c.subject || 'Unknown';
      if (!map[s]) map[s] = { total: 0, dppYes: 0, dppNA: 0, hwYes: 0, hwNA: 0, theory: 0, notes: 0 };
      map[s].total++;
      if (c.theory === 'Yes') map[s].theory++;
      if (c.dpp    === 'Yes') map[s].dppYes++;
      if (c.dpp    === 'N/A') map[s].dppNA++;
      if (c.notes  === 'Yes') map[s].notes++;
      if (c.hw     === 'Yes') map[s].hwYes++;
      if (c.hw     === 'N/A') map[s].hwNA++;
    });
    return Object.entries(map).map(([subject, d]) => {
      const dppApp = d.total - d.dppNA;
      const hwApp  = d.total - d.hwNA;
      return {
        subject, total: d.total,
        theoryPct: Math.round((d.theory  / d.total)  * 100),
        dppPct:    dppApp > 0 ? Math.round((d.dppYes / dppApp) * 100) : null,
        notesPct:  Math.round((d.notes   / d.total)  * 100),
        hwPct:     hwApp  > 0 ? Math.round((d.hwYes  / hwApp)  * 100) : null,
        dppNA: d.dppNA, hwNA: d.hwNA,
      };
    }).sort((a, b) => b.total - a.total);
  }, [monthClasses]);

  // 4. Overall completion score
  const overallScore = useMemo(() => {
    if (!studyWorkStats.length) return 0;
    return Math.round(studyWorkStats.reduce((a, s) => a + s.pct, 0) / studyWorkStats.length);
  }, [studyWorkStats]);

  /* ── BEAUTIFUL PDF EXPORT ── */
  function exportPDF() {
    const monthStr = new Date(selYear, selMonth - 1).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });

    const subjectRows = subjectData.map(s =>
      `<tr><td>${s.label}</td><td style="text-align:center;font-weight:700">${s.value}</td></tr>`
    ).join('');

    const chapterRows = chapterData.map(c =>
      `<tr><td>${c.label}</td><td style="text-align:center;font-weight:700">${c.value}</td></tr>`
    ).join('');

    const classRows = [...monthClasses].sort((a,b) => new Date(a.date) - new Date(b.date)).map(c => `
      <tr>
        <td>${c.date || ''}</td>
        <td>${c.subject || ''}</td>
        <td>${c.teacher || ''}</td>
        <td>${c.chapter || '—'}</td>
        <td>${c.topic || ''}</td>
        <td>${c.attendance || ''}</td>
        <td style="text-align:center">${c.theory  === 'Yes' ? '✅' : '❌'}</td>
        <td style="text-align:center">${c.dpp     === 'Yes' ? '✅' : c.dpp === 'N/A' ? '⚠️ N/A' : '❌'}</td>
        <td style="text-align:center">${c.notes === 'Yes' ? '✅' : '❌'}</td>
        <td style="text-align:center">${c.hw    === 'Yes' ? '✅' : c.hw === 'N/A' ? '⚠️ N/A' : '❌'}</td>
      </tr>`).join('');

    const testRows = monthTests.map(t => `
      <tr>
        <td>${t.date || ''}</td>
        <td>${t.testType || ''}</td>
        <td>${t.name || ''}</td>
        <td style="text-align:center">${t.paper ? `P${t.paper}` : '—'}</td>
        <td style="text-align:center;font-weight:700;color:#3b82f6">${t.obtainedMarks}/${t.totalMarks}</td>
        <td style="text-align:center;font-weight:700;color:#8b5cf6">${t.accuracy}%</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ClassTracker Report – ${monthStr}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; }

  .page { max-width: 900px; margin: 0 auto; padding: 2rem; }

  /* Header */
  .report-header {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: white; padding: 2.5rem 2rem; border-radius: 16px;
    margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;
  }
  .report-header h1 { font-size: 2rem; font-weight: 800; }
  .report-header p  { font-size: 1rem; opacity: 0.85; margin-top: 0.3rem; }
  .report-badge { background: rgba(255,255,255,0.2); padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem; }

  /* Section */
  .section { margin-bottom: 2rem; }
  .section-title {
    font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;
    padding-bottom: 0.5rem; border-bottom: 2px solid #e2e8f0;
    display: flex; align-items: center; gap: 0.5rem;
  }

  /* Stat Cards */
  .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
  .stat-box {
    background: white; border-radius: 12px; padding: 1.2rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.07); text-align: center;
  }
  .stat-box h4 { font-size: 0.85rem; color: #64748b; margin-bottom: 0.5rem; }
  .stat-num  { font-size: 2rem; font-weight: 800; background: linear-gradient(135deg,#3b82f6,#8b5cf6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  .stat-sub  { font-size: 0.8rem; color: #64748b; margin-top: 0.3rem; }
  .stat-sub span { color: #1e293b; font-weight: 600; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.07); font-size: 0.85rem; }
  thead { background: linear-gradient(135deg,#3b82f6,#8b5cf6); color: white; }
  th { padding: 0.75rem 0.6rem; text-align: left; font-weight: 600; font-size: 0.8rem; }
  td { padding: 0.65rem 0.6rem; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #f8fafc; }

  /* Small tables side by side */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

  /* Summary counts */
  .summary-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
  .summary-chip {
    background: white; border-radius: 10px; padding: 0.6rem 1rem;
    box-shadow: 0 2px 6px rgba(0,0,0,0.06); font-size: 0.9rem;
  }
  .summary-chip span { font-weight: 700; color: #3b82f6; }

  .footer { text-align:center; color:#94a3b8; font-size:0.8rem; margin-top:2rem; padding-top:1rem; border-top:1px solid #e2e8f0; }

  @media print {
    body { background: white; }
    .page { padding: 0; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="report-header">
    <div>
      <h1>📚 ClassTracker</h1>
      <p>Monthly Progress Report</p>
    </div>
    <div class="report-badge">📅 ${monthStr}</div>
  </div>

  <!-- Summary -->
  <div class="summary-row">
    <div class="summary-chip">Total Classes: <span>${monthClasses.length}</span></div>
    <div class="summary-chip">Total Tests: <span>${monthTests.length}</span></div>
    <div class="summary-chip">Subjects Covered: <span>${subjectData.length}</span></div>
    <div class="summary-chip">Chapters Covered: <span>${chapterData.length}</span></div>
  </div>

  <!-- Test Stats -->
  <div class="section">
    <div class="section-title">🎯 Test Performance</div>
    <div class="stats-row">
      <div class="stat-box">
        <h4>🎯 Mains Tests</h4>
        <div class="stat-num">${mains.count}</div>
        <div class="stat-sub">Avg Score: <span>${mains.avgScore}</span></div>
        <div class="stat-sub">Accuracy: <span>${mains.avgAccuracy}%</span></div>
      </div>
      <div class="stat-box">
        <h4>📘 Advance Tests</h4>
        <div class="stat-num">${advance.count}</div>
        <div class="stat-sub">Avg Score: <span>${advance.avgScore}</span></div>
        <div class="stat-sub">Accuracy: <span>${advance.avgAccuracy}%</span></div>
      </div>
      <div class="stat-box">
        <h4>⚡ AITs</h4>
        <div class="stat-num">${aits.count}</div>
        <div class="stat-sub">Avg Score: <span>${aits.avgScore}</span></div>
        <div class="stat-sub">Accuracy: <span>${aits.avgAccuracy}%</span></div>
      </div>
    </div>

    ${monthTests.length ? `
    <table>
      <thead><tr><th>Date</th><th>Type</th><th>Name</th><th>Paper</th><th>Score</th><th>Accuracy</th></tr></thead>
      <tbody>${testRows}</tbody>
    </table>` : '<p style="color:#94a3b8;text-align:center;padding:1rem">No tests this month.</p>'}
  </div>

  <!-- Distribution Tables -->
  ${(subjectData.length || chapterData.length) ? `
  <div class="section">
    <div class="section-title">📊 Distribution</div>
    <div class="two-col">
      <div>
        <table>
          <thead><tr><th>Subject</th><th>Classes</th></tr></thead>
          <tbody>${subjectRows || '<tr><td colspan="2" style="text-align:center;color:#94a3b8">No data</td></tr>'}</tbody>
        </table>
      </div>
      <div>
        <table>
          <thead><tr><th>Chapter</th><th>Classes</th></tr></thead>
          <tbody>${chapterRows || '<tr><td colspan="2" style="text-align:center;color:#94a3b8">No data</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  </div>` : ''}

  <!-- Classes Detail -->
  <div class="section">
    <div class="section-title">📖 Classes Detail</div>
    ${monthClasses.length ? `
    <table>
      <thead>
        <tr><th>Date</th><th>Subject</th><th>Teacher</th><th>Chapter</th><th>Topic</th><th>Mode</th><th>Theory</th><th>DPP</th><th>Notes</th><th>HW</th></tr>
      </thead>
      <tbody>${classRows}</tbody>
    </table>` : '<p style="color:#94a3b8;text-align:center;padding:1rem">No classes this month.</p>'}
  </div>

  <div class="footer">Generated by ClassTracker &nbsp;•&nbsp; ${new Date().toLocaleString('en-IN')}</div>
</div>

<script>window.onload = () => window.print();</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) {
      // fallback: direct download
      const a = document.createElement('a');
      a.href = url; a.download = `ClassTracker_${monthStr}.html`; a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const CARDS = [
    { key: 'mains',   label: '🎯 Mains Tests',  cls: 'mains',   stats: mains   },
    { key: 'advance', label: '📘 Advance Tests', cls: 'advance', stats: advance },
    { key: 'aits',    label: '⚡ AITs',          cls: 'aits',    stats: aits    },
  ];

  return (
    <section className="tab-content active">
      <div className="section-header">
        <h2>Monthly Analytics</h2>
        <div className="analytics-controls">
          <input type="month" className="month-input" value={month} onChange={e => setMonth(e.target.value)} />
          <button className="btn-primary" onClick={exportPDF}>📥 Export PDF</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        {CARDS.map(({ key, label, cls, stats }) => (
          <div className={`stat-card ${cls}`} key={key}>
            <h3>{label}</h3>
            <div className="stat-value">{stats.count}</div>
            <p className="stat-label">Average Score: <strong>{stats.avgScore}</strong></p>
            <p className="stat-label">Accuracy: <strong>{stats.avgAccuracy}%</strong></p>
          </div>
        ))}
      </div>

      {/* Summary chips */}
      <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
        {[
          { label:'Total Classes', value: monthClasses.length },
          { label:'Subjects',      value: subjectData.length  },
          { label:'Chapters',      value: chapterData.length  },
          { label:'Tests',         value: monthTests.length   },
        ].map(chip => (
          <div key={chip.label} style={{
            background:'var(--bg-secondary)', border:'1px solid var(--border)',
            borderRadius:'10px', padding:'0.5rem 1rem', fontSize:'0.9rem'
          }}>
            {chip.label}: <strong style={{ color:'var(--primary-color)' }}>{chip.value}</strong>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="charts-container">
        <div className="chart-box">
          <h3>📊 Classes Per Day</h3>
          <BarChart data={classesPerDay} color="#3b82f6" />
        </div>
        <div className="chart-box">
          <h3>🎨 Subject Distribution</h3>
          <DonutChart data={subjectData} />
        </div>
      </div>

      {/* Chapter Tree */}
      {Object.keys(treeData).length > 0 && (
        <div className="chart-box" style={{ marginTop:'1.5rem' }}>
          <h3>📁 Subject → Chapter → Topic</h3>
          <TreeView treeData={treeData} />
        </div>
      )}

      {/* ════ COMPARISON ANALYSIS SECTION ════ */}
      {monthClasses.length > 0 && (
        <div style={{ marginTop: '2rem' }}>

          {/* ── Overall Score Card ── */}
          <div style={{
            background: overallScore >= 80
              ? 'linear-gradient(135deg,#10b981,#059669)'
              : overallScore >= 50
              ? 'linear-gradient(135deg,#f59e0b,#d97706)'
              : 'linear-gradient(135deg,#ef4444,#dc2626)',
            borderRadius: '16px', padding: '1.25rem 1.5rem',
            marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, opacity: 0.9 }}>
                📊 Overall Study Completion Score
              </div>
              <div style={{ color: '#fff', fontSize: '2rem', fontWeight: 900, lineHeight: 1.2 }}>
                {overallScore}%
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                Based on {monthClasses.length} classes this month
              </div>
            </div>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', flexShrink: 0,
            }}>
              {overallScore >= 80 ? '🏆' : overallScore >= 50 ? '📈' : '💪'}
            </div>
          </div>

          {/* ── Attendance Mode Comparison ── */}
          <div className="chart-box" style={{ marginBottom: '1.25rem' }}>
            <h3>📺 Attendance Mode Comparison</h3>
            {attendanceStats.length === 0
              ? <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'1rem' }}>No data</p>
              : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem', marginTop:'0.75rem' }}>
                {attendanceStats.map(s => (
                  <div key={s.label}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.3rem' }}>
                      <span style={{ fontWeight:600, fontSize:'0.9rem' }}>{s.icon} {s.label}</span>
                      <span style={{ fontWeight:700, color: s.color }}>
                        {s.value} classes &nbsp;·&nbsp; {s.pct}%
                      </span>
                    </div>
                    <div style={{ background:'var(--border)', borderRadius:'999px', height:'10px', overflow:'hidden' }}>
                      <div style={{
                        width: `${s.pct}%`, height:'100%', borderRadius:'999px',
                        background: s.color, transition:'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                ))}
                {/* mini bar chart visual */}
                <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.75rem', height:'120px', alignItems:'flex-end' }}>
                  {attendanceStats.map(s => {
                    const maxPct = Math.max(...attendanceStats.map(x => x.pct));
                    return (
                      <div key={s.label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', height:'100%', justifyContent:'flex-end' }}>
                        <span style={{ fontSize:'0.75rem', fontWeight:700, color: s.color }}>{s.pct}%</span>
                        <div style={{
                          width:'100%',
                          height:`${(s.pct/maxPct)*90}px`,
                          background:`linear-gradient(180deg,${s.color},${s.color}99)`,
                          borderRadius:'8px 8px 0 0', minHeight: s.pct ? '6px':'0',
                          transition:'height 0.5s ease',
                        }}/>
                        <span style={{ fontSize:'0.72rem', color:'var(--text-secondary)', fontWeight:600 }}>{s.icon} {s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Study Work Accuracy ── */}
          <div className="chart-box" style={{ marginBottom: '1.25rem' }}>
            <h3>✅ Study Work Accuracy</h3>
            <p style={{ fontSize:'0.78rem', color:'var(--text-secondary)', marginBottom:'0.75rem' }}>
              N/A classes (teacher did not give) are excluded from accuracy calculation
            </p>
            {studyWorkStats.length === 0
              ? <p style={{ color:'var(--text-secondary)', textAlign:'center', padding:'1rem' }}>No data</p>
              : (
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {studyWorkStats.map(s => (
                  <div key={s.key}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.3rem' }}>
                      <span style={{ fontWeight:700, fontSize:'0.92rem' }}>{s.icon} {s.label}</span>
                      <div style={{ display:'flex', gap:'0.6rem', alignItems:'center', fontSize:'0.8rem' }}>
                        <span style={{ color:'#10b981', fontWeight:600 }}>✅ {s.yes}</span>
                        <span style={{ color:'#ef4444', fontWeight:600 }}>❌ {s.no}</span>
                        {s.na > 0 && <span style={{ color:'#f59e0b', fontWeight:600 }}>⚠️ {s.na} N/A</span>}
                        <span style={{
                          background: s.pct>=80 ? '#10b981' : s.pct>=50 ? '#f59e0b' : '#ef4444',
                          color:'#fff', borderRadius:'20px', padding:'0.1rem 0.55rem',
                          fontWeight:800, fontSize:'0.85rem',
                        }}>{s.pct}%</span>
                      </div>
                    </div>
                    <div style={{ background:'var(--border)', borderRadius:'999px', height:'12px', overflow:'hidden', position:'relative' }}>
                      <div style={{
                        width:`${s.pct}%`, height:'100%', borderRadius:'999px',
                        background:`linear-gradient(90deg,${s.color},${s.color}cc)`,
                        transition:'width 0.5s ease',
                      }}/>
                    </div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text-secondary)', marginTop:'0.2rem' }}>
                      {s.applicable} applicable classes {s.na > 0 ? `(${s.na} N/A excluded)` : ''}
                    </div>
                  </div>
                ))}

                {/* Bar chart comparing all 4 */}
                <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem', height:'140px', alignItems:'flex-end', padding:'0 4px' }}>
                  {studyWorkStats.map(s => (
                    <div key={s.key} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', height:'100%', justifyContent:'flex-end' }}>
                      <span style={{ fontSize:'0.72rem', fontWeight:800, color: s.color }}>{s.pct}%</span>
                      <div style={{
                        width:'100%', height:`${(s.pct/100)*100}px`,
                        background:`linear-gradient(180deg,${s.color},${s.color}99)`,
                        borderRadius:'8px 8px 0 0', minHeight: s.pct ? '4px':'0',
                        transition:'height 0.5s ease',
                      }}/>
                      <span style={{ fontSize:'0.7rem', color:'var(--text-secondary)', fontWeight:600 }}>{s.icon}</span>
                      <span style={{ fontSize:'0.68rem', color:'var(--text-secondary)' }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Per-Subject Breakdown ── */}
          {subjectWorkStats.length > 0 && (
            <div className="chart-box" style={{ marginBottom: '1.25rem' }}>
              <h3>📚 Per-Subject Accuracy Breakdown</h3>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem', minWidth:'480px', marginTop:'0.75rem' }}>
                  <thead>
                    <tr style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', color:'#fff' }}>
                      <th style={{ padding:'0.6rem 0.7rem', textAlign:'left', fontWeight:700, borderRadius:'8px 0 0 0' }}>Subject</th>
                      <th style={{ padding:'0.6rem 0.5rem', textAlign:'center', fontWeight:700 }}>Classes</th>
                      <th style={{ padding:'0.6rem 0.5rem', textAlign:'center', fontWeight:700 }}>📚 Theory</th>
                      <th style={{ padding:'0.6rem 0.5rem', textAlign:'center', fontWeight:700 }}>📋 DPP</th>
                      <th style={{ padding:'0.6rem 0.5rem', textAlign:'center', fontWeight:700 }}>📝 Notes</th>
                      <th style={{ padding:'0.6rem 0.5rem', textAlign:'center', fontWeight:700, borderRadius:'0 8px 0 0' }}>✏️ HW</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectWorkStats.map((s, i) => {
                      const pctCell = (pct, na) => {
                        if (pct === null) return <td style={{ padding:'0.5rem', textAlign:'center', color:'var(--text-secondary)', fontSize:'0.75rem' }}>—</td>;
                        const bg = pct>=80 ? '#10b981' : pct>=50 ? '#f59e0b' : '#ef4444';
                        return (
                          <td style={{ padding:'0.5rem 0.4rem', textAlign:'center' }}>
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
                              <span style={{ background:bg, color:'#fff', borderRadius:'12px', padding:'0.1rem 0.45rem', fontWeight:700, fontSize:'0.8rem' }}>
                                {pct}%
                              </span>
                              {na > 0 && <span style={{ fontSize:'0.65rem', color:'#f59e0b' }}>⚠️{na} N/A</span>}
                            </div>
                          </td>
                        );
                      };
                      return (
                        <tr key={s.subject} style={{ background: i%2===0 ? 'var(--bg)' : 'var(--bg-secondary)' }}>
                          <td style={{ padding:'0.55rem 0.7rem', fontWeight:700, color:'var(--text)' }}>{s.subject}</td>
                          <td style={{ padding:'0.55rem 0.5rem', textAlign:'center', fontWeight:600, color:'var(--primary-color)' }}>{s.total}</td>
                          {pctCell(s.theoryPct, 0)}
                          {pctCell(s.dppPct, s.dppNA)}
                          {pctCell(s.notesPct, 0)}
                          {pctCell(s.hwPct, s.hwNA)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Classes Detail Table */}
      {monthClasses.length > 0 && (
        <div className="chart-box" style={{ marginTop:'1.5rem' }}>
          <h3>📋 Classes Detail</h3>
          <ClassesTable classes={monthClasses} />
        </div>
      )}
    </section>
  );
}

/* ── Classes Detail Table ── */
function ClassesTable({ classes }) {
  const [sortField, setSortField] = useState('date');
  const [sortAsc, setSortAsc]     = useState(true);
  const [filterSubj, setFilterSubj] = useState('');
  const [editingClass, setEditingClass] = useState(null);
  const [saving, setSaving] = useState(false);

  const subjects = [...new Set(classes.map(c => c.subject).filter(Boolean))].sort();

  const sorted = [...classes]
    .filter(c => !filterSubj || c.subject === filterSubj)
    .sort((a, b) => {
      const va = a[sortField] || '';
      const vb = b[sortField] || '';
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  function toggleSort(field) {
    if (sortField === field) setSortAsc(v => !v);
    else { setSortField(field); setSortAsc(true); }
  }

  function openEdit(c) {
    setEditingClass({
      id:    c.id,
      subj:  c.subject,
      date:  c.date,
      notes: c.notes || 'No',
      dpp:   c.dpp   || 'No',
      hw:    c.hw    || 'No',
    });
  }

  async function saveEdit() {
    if (!editingClass?.id) return;
    setSaving(true);
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await updateDoc(doc(db, 'classes', editingClass.id), {
        notes: editingClass.notes,
        dpp:   editingClass.dpp,
        hw:    editingClass.hw,
      });
      const row = classes.find(c => c.id === editingClass.id);
      if (row) {
        row.notes = editingClass.notes;
        row.dpp   = editingClass.dpp;
        row.hw    = editingClass.hw;
      }
      setEditingClass(null);
    } catch (e) {
      alert('Save failed: ' + e.message);
    }
    setSaving(false);
  }

  const TH = ({ field, children }) => (
    <th
      onClick={() => toggleSort(field)}
      style={{
        padding: '0.6rem 0.5rem', textAlign: 'left', fontWeight: 700,
        fontSize: '0.75rem', cursor: 'pointer', userSelect: 'none',
        background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', color: '#fff',
        whiteSpace: 'nowrap',
      }}
    >
      {children} {sortField === field ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  const CHECK = ({ val }) => (
    <span style={{ fontSize: '0.95rem' }}>
      {val === 'Yes' ? '✅' : val === 'N/A'
        ? <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700 }}>⚠️ N/A</span>
        : '❌'}
    </span>
  );

  const TriToggle = ({ field, label, triState }) => {
    const val = editingClass[field];
    const options = triState
      ? [{ v:'Yes', e:'✅', t:'Yes', c:'#10b981' }, { v:'No', e:'❌', t:'No', c:'#ef4444' }, { v:'N/A', e:'⚠️', t:'N/A', c:'#f59e0b' }]
      : [{ v:'Yes', e:'✅', t:'Yes', c:'#10b981' }, { v:'No', e:'❌', t:'No', c:'#ef4444' }];
    return (
      <div style={{ marginBottom:'0.9rem' }}>
        <div style={{ fontSize:'0.82rem', fontWeight:700, color:'var(--text)', marginBottom:'0.4rem' }}>{label}</div>
        <div style={{ display:'flex', gap:'0.4rem' }}>
          {options.map(({ v, e, t, c }) => (
            <button key={v} type="button"
              onClick={() => setEditingClass(prev => ({ ...prev, [field]: v }))}
              style={{
                flex:1, padding:'0.45rem 0.2rem', fontSize:'0.78rem', fontWeight:700,
                borderRadius:'10px', cursor:'pointer', transition:'all 0.15s',
                border: `2px solid ${val === v ? c : 'var(--border)'}`,
                background: val === v ? (c + '22') : 'transparent',
                color: val === v ? c : 'var(--text-secondary)',
              }}
            >{e} {t}</button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* ── Edit Modal ── */}
      {editingClass && createPortal(
        <div
          onClick={e => { if (e.target === e.currentTarget) setEditingClass(null); }}
          style={{
            position:'fixed', inset:0,
            background:'rgba(0,0,0,0.72)',
            zIndex:99999,
            display:'flex', alignItems:'center', justifyContent:'center',
            padding:'1.5rem',
            backdropFilter:'blur(4px)',
            WebkitBackdropFilter:'blur(4px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background:'var(--bg)', borderRadius:'20px', padding:'1.5rem',
              width:'100%', maxWidth:'340px',
              boxShadow:'0 24px 80px rgba(0,0,0,0.5)',
              border:'1px solid var(--border)',
            }}
          >
            <div style={{ marginBottom:'1.2rem', borderBottom:'1px solid var(--border)', paddingBottom:'0.8rem' }}>
              <div style={{ fontWeight:800, fontSize:'1.05rem', color:'var(--text)' }}>Quick Edit</div>
              <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginTop:'0.25rem' }}>
                {editingClass.date} &bull; <strong>{editingClass.subj}</strong>
              </div>
            </div>

            <TriToggle field="notes" label="Notes"  triState={false} />
            <TriToggle field="dpp"   label="DPP"    triState={true}  />
            <TriToggle field="hw"    label="HW"     triState={true}  />

            <div style={{ display:'flex', gap:'0.6rem', marginTop:'1.2rem' }}>
              <button
                onClick={saveEdit}
                disabled={saving}
                style={{
                  flex:1, padding:'0.7rem', borderRadius:'12px', border:'none',
                  background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                  color:'#fff', fontWeight:700, fontSize:'0.95rem', cursor:'pointer',
                  opacity: saving ? 0.7 : 1,
                  boxShadow:'0 4px 15px rgba(59,130,246,0.4)',
                }}
              >{saving ? 'Saving...' : 'Save'}</button>
              <button
                onClick={() => setEditingClass(null)}
                style={{
                  padding:'0.7rem 1.1rem', borderRadius:'12px',
                  border:'1px solid var(--border)', background:'var(--bg-secondary)',
                  color:'var(--text)', fontWeight:600, fontSize:'0.95rem', cursor:'pointer',
                }}
              >Cancel</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Filter ── */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filterSubj}
          onChange={e => setFilterSubj(e.target.value)}
          style={{ padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border)',
            background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem' }}
        >
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {sorted.length} class{sorted.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '650px' }}>
          <thead>
            <tr>
              <TH field="date">Date</TH>
              <TH field="subject">Subject</TH>
              <TH field="teacher">Teacher</TH>
              <TH field="chapter">Chapter</TH>
              <TH field="topic">Topic</TH>
              <TH field="attendance">Mode</TH>
              <th style={{ padding:'0.6rem 0.4rem', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', color:'#fff', fontSize:'0.75rem', whiteSpace:'nowrap' }}>Theory</th>
              <th style={{ padding:'0.6rem 0.4rem', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', color:'#fff', fontSize:'0.75rem', whiteSpace:'nowrap' }}>DPP</th>
              <th style={{ padding:'0.6rem 0.4rem', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', color:'#fff', fontSize:'0.75rem', whiteSpace:'nowrap' }}>Notes</th>
              <th style={{ padding:'0.6rem 0.4rem', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', color:'#fff', fontSize:'0.75rem', whiteSpace:'nowrap' }}>HW</th>
              <th style={{ padding:'0.6rem 0.4rem', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', color:'#fff', fontSize:'0.75rem', whiteSpace:'nowrap' }}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr key={c.id || i} style={{ background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg-secondary)' }}>
                <td style={{ padding:'0.55rem 0.5rem', whiteSpace:'nowrap', color:'var(--text-secondary)', fontSize:'0.78rem' }}>{c.date}</td>
                <td style={{ padding:'0.55rem 0.5rem', fontWeight:600, color:'var(--text)', whiteSpace:'nowrap' }}>{c.subject}</td>
                <td style={{ padding:'0.55rem 0.5rem', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{c.teacher}</td>
                <td style={{ padding:'0.55rem 0.5rem', color:'var(--text-secondary)' }}>{c.chapter || '—'}</td>
                <td style={{ padding:'0.55rem 0.5rem', color:'var(--text)' }}>{c.topic}</td>
                <td style={{ padding:'0.55rem 0.5rem', whiteSpace:'nowrap' }}>
                  <span style={{
                    background: c.attendance === 'Live' ? '#dbeafe' : c.attendance === 'Recorded' ? '#fce7f3' : '#d1fae5',
                    color: c.attendance === 'Live' ? '#1d4ed8' : c.attendance === 'Recorded' ? '#be185d' : '#065f46',
                    borderRadius: '6px', padding: '0.15rem 0.4rem', fontSize: '0.75rem', fontWeight: 600,
                  }}>
                    {c.attendance === 'Live' ? '📺' : c.attendance === 'Recorded' ? '📹' : '🔄'} {c.attendance}
                  </span>
                </td>
                <td style={{ padding:'0.55rem 0.4rem', textAlign:'center' }}><CHECK val={c.theory} /></td>
                <td style={{ padding:'0.55rem 0.4rem', textAlign:'center' }}><CHECK val={c.dpp} /></td>
                <td style={{ padding:'0.55rem 0.4rem', textAlign:'center' }}><CHECK val={c.notes} /></td>
                <td style={{ padding:'0.55rem 0.4rem', textAlign:'center' }}><CHECK val={c.hw} /></td>
                <td style={{ padding:'0.4rem 0.4rem', textAlign:'center' }}>
                  <button
                    onClick={() => openEdit(c)}
                    title="Edit Notes / DPP / HW"
                    style={{
                      background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                      border:'none', borderRadius:'8px',
                      padding:'0.28rem 0.5rem',
                      color:'#fff', cursor:'pointer',
                      fontSize:'0.85rem', lineHeight:1,
                    }}
                  >✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
