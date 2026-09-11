import { useState } from 'react';

const TABS = ['schedule', 'restaurant', 'groups', 'registrations', 'voting-groups', 'voting-results'];
const TAB_LABELS = {
  schedule: 'Schedule',
  restaurant: 'Restaurant',
  groups: 'Groups',
  restrooms: 'Restrooms',
  registrations: 'Registrations',
  'voting-groups': 'Voting Groups',
  'voting-results': 'Voting Results'
};

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
        active
          ? 'bg-brand text-white'
          : 'bg-white text-gray-700 border'
      }`}
    >
      {label}
    </button>
  );
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState('schedule');

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin Dashboard</h2>
      <div className="flex gap-2 overflow-x-auto mb-4">
        {TABS.map((t) => (
          <TabButton
            key={t}
            active={tab === t}
            onClick={() => setTab(t)}
            label={TAB_LABELS[t] || t[0].toUpperCase() + t.slice(1)}
          />
        ))}
      </div>

      {tab === 'schedule' && (
        <div className="bg-white rounded-xl p-4 shadow">
          <h3 className="font-bold text-lg mb-2">Schedule</h3>
          <p className="text-gray-600">Schedule management will be added here.</p>
        </div>
      )}

      {tab === 'restaurant' && (
        <div className="bg-white rounded-xl p-4 shadow">
          <h3 className="font-bold text-lg mb-2">Restaurant</h3>
          <p className="text-gray-600">Restaurant management will be added here.</p>
        </div>
      )}

      {tab === 'groups' && (
        <div className="bg-white rounded-xl p-4 shadow">
          <h3 className="font-bold text-lg mb-2">Groups</h3>
          <p className="text-gray-600">Group management will be added here.</p>
        </div>
      )}

      {tab === 'registrations' && (
        <div className="bg-white rounded-xl p-4 shadow">
          <h3 className="font-bold text-lg mb-2">Registrations</h3>
          <p className="text-gray-600">Registration management will be added here.</p>
        </div>
      )}

      {tab === 'voting-groups' && (
        <div className="bg-white rounded-xl p-4 shadow">
          <h3 className="font-bold text-lg mb-2">Voting Groups</h3>
          <p className="text-gray-600">Voting group management will be added here.</p>
        </div>
      )}

      {tab === 'voting-results' && (
        <div className="bg-white rounded-xl p-4 shadow">
          <h3 className="font-bold text-lg mb-2">Voting Results</h3>
          <p className="text-gray-600">Voting results will be displayed here.</p>
        </div>
      )}
    </div>
  );
}