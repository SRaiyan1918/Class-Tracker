import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';

import Header       from './components/Header';
import TabNav       from './components/TabNav';
import TodayTab     from './components/TodayTab';
import TestsTab     from './components/TestsTab';
import AnalyticsTab from './components/AnalyticsTab';
import PracticeTab  from './components/PracticeTab';
import LoginPage    from './components/LoginPage';

export default function App() {
  const [theme, setTheme]           = useState(() => localStorage.getItem('theme') || 'light');
  const [activeTab, setActiveTab]   = useState('today');
  const [classes, setClasses]       = useState([]);
  const [tests, setTests]           = useState([]);
  const [practices, setPractices]   = useState([]);
  const [notification, setNotification] = useState(null);

  // Auth state
  const [user, setUser]         = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // show nothing until auth resolves

  /* ── Theme ── */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  /* ── Auth listener ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  /* ── Load data — filtered by uid ── */
  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const uid = user.uid;
      const [classSnap, testSnap, practiceSnap] = await Promise.all([
        getDocs(query(collection(db, 'classes'),   where('uid', '==', uid))),
        getDocs(query(collection(db, 'tests'),     where('uid', '==', uid))),
        getDocs(query(collection(db, 'practices'), where('uid', '==', uid))),
      ]);
      setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTests(testSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPractices(practiceSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      showNotification('Failed to load data', 'error');
    }
  }, [user]);

  useEffect(() => {
    if (user) loadData();
    else { setClasses([]); setTests([]); setPractices([]); }
  }, [user, loadData]);

  function showNotification(message, type) {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }

  /* ── Loading screen ── */
  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
      </div>
    );
  }

  /* ── Not logged in → Login page ── */
  if (!user) return <LoginPage />;

  /* ── Logged in → Main app ── */
  return (
    <div className="app-container">
      <Header
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        user={user}
      />

      <main className="main-content">
        <TabNav activeTab={activeTab} onSwitch={setActiveTab} />

        {activeTab === 'today' && (
          <TodayTab classes={classes} onRefresh={loadData} onNotify={showNotification} user={user} />
        )}
        {activeTab === 'tests' && (
          <TestsTab tests={tests} onRefresh={loadData} onNotify={showNotification} user={user} />
        )}
        {activeTab === 'practice' && (
          <PracticeTab practices={practices} onRefresh={loadData} onNotify={showNotification} user={user} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab classes={classes} tests={tests} />
        )}
      </main>

      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}
