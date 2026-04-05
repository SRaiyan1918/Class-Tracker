import { useState } from 'react';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

/*
  Paper logic:
  - Mains       → no paper field (single paper)
  - Advance     → Paper 1 or Paper 2
  - AITs Mains  → no paper (single paper, Mains pattern)
  - AITs Adv    → Paper 1 or Paper 2 (Advance pattern)
*/

const TEST_TYPES = [
  { value: 'Mains',     label: '🎯 Mains',     hasPaper: false },
  { value: 'Advance',   label: '📘 Advance',   hasPaper: true  },
  { value: 'AITs_M',   label: '⚡ AITs – Mains Pattern',   hasPaper: false },
  { value: 'AITs_A',   label: '⚡ AITs – Advance Pattern', hasPaper: true  },
];

// Default total marks per type
const DEFAULT_MARKS = {
  Mains:   300,
  Advance: 180,
  AITs_M:  300,
  AITs_A:  180,
};

const EMPTY_FORM = {
  testType: 'Mains', name: '', paper: '',
  date: '', totalMarks: 300, obtainedMarks: '', accuracy: '',
};

// Display label for card heading
function typeLabel(value) {
  return TEST_TYPES.find(t => t.value === value)?.label || value;
}

function hasPaper(testType) {
  return TEST_TYPES.find(t => t.value === testType)?.hasPaper || false;
}

// Group order for rendering
const DISPLAY_GROUPS = ['Mains', 'Advance', 'AITs_M', 'AITs_A'];

export default function TestsTab({ tests, onRefresh, onNotify }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);

  function handleChange(e) {
    const { id, value } = e.target;

    if (id === 'testType') {
      // reset paper + update default marks when type changes
      setForm(prev => ({
        ...prev,
        testType:   value,
        paper:      '',                          // always clear paper on type change
        totalMarks: DEFAULT_MARKS[value] || 300,
      }));
      return;
    }

    setForm(prev => ({ ...prev, [id]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const needsPaper = hasPaper(form.testType);
    const data = {
      testType:     form.testType,
      name:         form.name,
      paper:        needsPaper ? form.paper : null,   // null = no paper
      date:         form.date,
      totalMarks:   parseInt(form.totalMarks),
      obtainedMarks:parseInt(form.obtainedMarks),
      accuracy:     parseFloat(form.accuracy),
      timestamp:    new Date(),
    };
    try {
      await addDoc(collection(db, 'tests'), data);
      setForm(EMPTY_FORM);
      setShowForm(false);
      onRefresh();
      onNotify('Test added successfully!', 'success');
    } catch {
      onNotify('Failed to add test', 'error');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this test?')) return;
    try {
      await deleteDoc(doc(db, 'tests', id));
      onRefresh();
      onNotify('Test deleted', 'success');
    } catch {
      onNotify('Failed to delete test', 'error');
    }
  }

  const showPaperField = hasPaper(form.testType);

  return (
    <section className="tab-content active">
      <div className="section-header">
        <h2>Test Tracker</h2>
        <button className="btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowForm(v => !v); }}>
          <span>+</span> Add Test
        </button>
      </div>

      {showForm && (
        <form className="form-container" onSubmit={handleSubmit}>
          <div className="form-grid">

            {/* Test Type */}
            <div className="form-group">
              <label htmlFor="testType">📋 Test Type</label>
              <select id="testType" value={form.testType} onChange={handleChange} required>
                {TEST_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Test Name */}
            <div className="form-group">
              <label htmlFor="name">📝 Test Name</label>
              <input id="name" value={form.name} onChange={handleChange} placeholder="e.g., Mock Test 5" required />
            </div>

            {/* Date */}
            <div className="form-group">
              <label htmlFor="date">📅 Date</label>
              <input id="date" type="date" value={form.date} onChange={handleChange} required />
            </div>

            {/* Paper — only for Advance & AITs_A */}
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

            {/* Total Marks */}
            <div className="form-group">
              <label htmlFor="totalMarks">🏁 Total Marks</label>
              <input id="totalMarks" type="number" value={form.totalMarks} onChange={handleChange} required />
            </div>

            {/* Obtained Marks */}
            <div className="form-group">
              <label htmlFor="obtainedMarks">✅ Obtained Marks</label>
              <input id="obtainedMarks" type="number" value={form.obtainedMarks} onChange={handleChange} placeholder="0" required />
            </div>

            {/* Accuracy */}
            <div className="form-group">
              <label htmlFor="accuracy">🎯 Accuracy %</label>
              <input id="accuracy" type="number" step="0.1" value={form.accuracy} onChange={handleChange} placeholder="0" required />
            </div>

          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">💾 Save Test</button>
            <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Tests List */}
      <div className="tests-container">
        {DISPLAY_GROUPS.map(type => {
          const typeTests = tests
            .filter(t => t.testType === type)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          if (!typeTests.length) return null;

          return (
            <div className="test-category" key={type}>
              <div className="test-category-title">{typeLabel(type)}</div>
              <div className="test-list">
                {typeTests.map(test => (
                  <div className="test-card" key={test.id}>
                    <div className="test-info">
                      <div className="test-name">
                        {test.name}
                        {test.paper ? <span style={{ color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '0.4rem' }}>(Paper {test.paper})</span> : ''}
                      </div>
                      <div className="test-date">📅 {test.date}</div>
                      <div className="test-scores">
                        <div className="score-item">
                          📊 Score: <span className="score-value">{test.obtainedMarks}/{test.totalMarks}</span>
                        </div>
                        <div className="score-item">
                          🎯 Accuracy: <span className="score-value">{test.accuracy}%</span>
                        </div>
                      </div>
                    </div>
                    <button className="delete-btn" onClick={() => handleDelete(test.id)} title="Delete">🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {!tests.length && (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            No tests added yet.
          </p>
        )}
      </div>
    </section>
  );
}
