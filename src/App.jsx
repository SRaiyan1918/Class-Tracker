import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, getIdToken } from 'firebase/auth';
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

  const [user, setUser]           = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  /* ── FIX 1: Proactive token refresh har 45 min ──
     Firebase token 60 min mein expire hota hai.
     45 min pe refresh karo taaki kabhi expire na ho. */
  useEffect(() => {
    if (!user) return;
    const INTERVAL = 45 * 60 * 1000; // 45 minutes
    const timer = setInterval(async () => {
      try {
        if (auth.currentUser) await getIdToken(auth.currentUser, true);
      } catch (e) {
        console.warn('Token refresh failed:', e);
      }
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [user]);

  /* ── FIX 2: App wapas foreground mein aaye to token refresh + data reload ──
     Ye sabse important fix hai — phone unlock karo ya tab switch karo
     to token turant refresh hota hai, data bhi reload hota hai. */
  useEffect(() => {
    if (!user) return;
    async function handleVisibility() {
      if (document.visibilityState === 'visible') {
        try {
          if (auth.currentUser) {
            await getIdToken(auth.currentUser, true);
            await loadData();
          }
        } catch (e) {
          console.warn('Visibility token refresh failed:', e);
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user]);

  /* ── Load data ── */
  const loadData = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const uid = auth.currentUser.uid;
      const [classSnap, testSnap, practiceSnap] = await Promise.all([
        getDocs(query(collection(db, 'classes'),   where('uid', '==', uid))),
        getDocs(query(collection(db, 'tests'),     where('uid', '==', uid))),
        getDocs(query(collection(db, 'practices'), where('uid', '==', uid))),
      ]);
      setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTests(testSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPractices(practiceSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      /* ── FIX 3: Permission error pe token refresh karke retry ──
         Agar Firestore permission deny kare to pehle token refresh karo
         phir ek baar aur try karo — user ko logout nahi karna padega. */
      if (e.code === 'permission-denied' || e.code === 'unauthenticated') {
        try {
          await getIdToken(auth.currentUser, true);
          const uid = auth.currentUser.uid;
          const [classSnap, testSnap, practiceSnap] = await Promise.all([
            getDocs(query(collection(db, 'classes'),   where('uid', '==', uid))),
            getDocs(query(collection(db, 'tests'),     where('uid', '==', uid))),
            getDocs(query(collection(db, 'practices'), where('uid', '==', uid))),
          ]);
          setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setTests(testSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setPractices(practiceSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch {
          showNotification('Session expired, please refresh', 'error');
        }
      } else {
        showNotification('Failed to load data', 'error');
      }
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
    else { setClasses([]); setTests([]); setPractices([]); }
  }, [user, loadData]);

  function showNotification(message, type) {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }

  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

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
