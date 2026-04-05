import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

import Header from './components/Header';
import TabNav from './components/TabNav';
import TodayTab from './components/TodayTab';
import TestsTab from './components/TestsTab';
import AnalyticsTab from './components/AnalyticsTab';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [activeTab, setActiveTab] = useState('today');
  const [classes, setClasses] = useState([]);
  const [tests, setTests] = useState([]);
  const [notification, setNotification] = useState(null);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load data from Firestore
  const loadData = useCallback(async () => {
    try {
      const [classSnap, testSnap] = await Promise.all([
        getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'tests')),
      ]);
      setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTests(testSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      showNotification('Failed to load data', 'error');
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function showNotification(message, type) {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }

  return (
    <div className="app-container">
      <Header theme={theme} onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />

      <main className="main-content">
        <TabNav activeTab={activeTab} onSwitch={setActiveTab} />

        {activeTab === 'today' && (
          <TodayTab classes={classes} onRefresh={loadData} onNotify={showNotification} />
        )}
        {activeTab === 'tests' && (
          <TestsTab tests={tests} onRefresh={loadData} onNotify={showNotification} />
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