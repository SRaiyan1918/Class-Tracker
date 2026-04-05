const TABS = [
  { id: 'today', icon: '📅', label: 'Today' },
  { id: 'tests', icon: '🧪', label: 'Tests' },
  { id: 'analytics', icon: '📊', label: 'Analytics' },
];

export default function TabNav({ activeTab, onSwitch }) {
  return (
    <nav className="tabs-navigation">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onSwitch(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
