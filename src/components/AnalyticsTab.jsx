import { useState, useMemo } from 'react';

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

  /* ── BEAUTIFUL PDF EXPORT ── */
  function exportPDF() {
    const monthStr = new Date(selYear, selMonth - 1).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });

    const subjectRows = subjectData.map(s =>
      `<tr><td>${s.label}</td><td style="text-align:center;font-weight:700">${s.value}</td></tr>`
    ).join('');

    const chapterRows = chapterData.map(c =>
      `<tr><td>${c.label}</td><td style="text-align:center;font-weight:700">${c.value}</td></tr>`
    ).join('');

    const classRows = monthClasses.map(c => `
      <tr>
        <td>${c.date || ''}</td>
        <td>${c.subject || ''}</td>
        <td>${c.teacher || ''}</td>
        <td>${c.chapter || '—'}</td>
        <td>${c.topic || ''}</td>
        <td>${c.attendance || ''}</td>
        <td style="text-align:center">${c.theory  === 'Yes' ? '✅' : '❌'}</td>
        <td style="text-align:center">${c.dpp     === 'Yes' ? '✅' : '❌'}</td>
        <td style="text-align:center">${c.pyqs    === 'Yes' ? '✅' : '❌'}</td>
        <td style="text-align:center">${c.formula === 'Yes' ? '✅' : '❌'}</td>
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
        <tr><th>Date</th><th>Subject</th><th>Teacher</th><th>Chapter</th><th>Topic</th><th>Mode</th><th>Theory</th><th>DPP</th><th>PYQs</th><th>Formula</th></tr>
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

      {/* Chapter breakdown */}
      {chapterData.length > 0 && (
        <div className="chart-box" style={{ marginTop:'1.5rem' }}>
          <h3>📂 Chapter Distribution</h3>
          <BarChart data={chapterData.map(d => ({ label: d.label.length > 14 ? d.label.slice(0,14)+'…' : d.label, value: d.value }))} color="#8b5cf6" />
        </div>
      )}
    </section>
  );
}
