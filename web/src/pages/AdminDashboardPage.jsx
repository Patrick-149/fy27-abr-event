import { useState, useEffect } from 'react';
import api from '../api';

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
  const [schedule, setSchedule] = useState([]);
  const [restaurant, setRestaurant] = useState({
    name: '',
    location: '',
    timing: '',
    qrFile: '',
    qrName: ''
  });
  const [qrUploadFile, setQrUploadFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ saving: false, message: '', error: '' });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [s, r] = await Promise.all([
          api.get('/api/admin/schedule'),
          api.get('/api/admin/restaurant')
        ]);
        setSchedule(s.data);
        setRestaurant({
          name: '',
          location: '',
          timing: '',
          qrFile: '',
          qrName: '',
          ...r.data
        });
      } catch (err) {
        console.error('Failed to load data:', err);
        setStatus({ saving: false, message: '', error: 'Failed to load data' });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const saveSchedule = async () => {
    setStatus({ saving: true, message: '', error: '' });
    try {
      await api.put('/api/admin/schedule', schedule);
      setStatus({ saving: false, message: 'Saved successfully.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Save failed.' });
    }
  };

  const uploadQR = async () => {
    if (!qrUploadFile) return;
    setStatus({ saving: true, message: '', error: '' });
    try {
      const formData = new FormData();
      formData.append('qr', qrUploadFile);
      const { data } = await api.post('/api/admin/restaurant/qr', formData);
      setRestaurant({ ...restaurant, qrFile: data.qrFile, qrName: data.qrName });
      setQrUploadFile(null);
      setStatus({ saving: false, message: 'QR code uploaded successfully.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'QR code upload failed.' });
    }
  };

  const saveRestaurant = () => {
    setStatus({ saving: true, message: '', error: '' });
    try {
      api.put('/api/admin/restaurant', restaurant).then(() => {
        setStatus({ saving: false, message: 'Saved successfully.', error: '' });
      });
    } catch {
      setStatus({ saving: false, message: '', error: 'Save failed.' });
    }
  };

  if (loading) return <div className="text-center p-8">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin Dashboard</h2>
      {status.error && (
        <div className="mb-3 text-red-600 bg-red-50 p-2 rounded">{status.error}</div>
      )}
      {status.message && (
        <div className="mb-3 text-green-700 bg-green-50 p-2 rounded">{status.message}</div>
      )}
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
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 shadow">
            <h3 className="font-bold text-lg mb-2">Schedule</h3>
            {schedule.length === 0 ? (
              <p className="text-gray-500">No schedule items yet.</p>
            ) : (
              <div className="space-y-2">
                {schedule.map((item, index) => (
                  <div key={index} className="border rounded p-3">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <input
                        value={item.duration}
                        onChange={(e) => {
                          const updated = [...schedule];
                          updated[index] = { ...updated[index], duration: e.target.value };
                          setSchedule(updated);
                        }}
                        className="border rounded px-2 py-1"
                        placeholder="Duration"
                      />
                      <input
                        value={item.topic}
                        onChange={(e) => {
                          const updated = [...schedule];
                          updated[index] = { ...updated[index], topic: e.target.value };
                          setSchedule(updated);
                        }}
                        className="border rounded px-2 py-1"
                        placeholder="Topic"
                      />
                      <input
                        value={item.presenter}
                        onChange={(e) => {
                          const updated = [...schedule];
                          updated[index] = { ...updated[index], presenter: e.target.value };
                          setSchedule(updated);
                        }}
                        className="border rounded px-2 py-1"
                        placeholder="Presenter"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setSchedule([...schedule, { duration: '', topic: '', presenter: '' }])}
              className="mt-3 bg-brand text-white px-4 py-2 rounded-lg font-semibold"
            >
              Add Item
            </button>
          </div>
          <button
            onClick={saveSchedule}
            disabled={status.saving}
            className="w-full bg-brand text-white py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {status.saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      )}

      {tab === 'restaurant' && (
        <div className="bg-white rounded-xl p-4 shadow space-y-3">
          <h3 className="font-bold text-lg">Restaurant Details</h3>
          <input
            value={restaurant.name}
            onChange={(e) => setRestaurant({ ...restaurant, name: e.target.value })}
            placeholder="Name"
            className="w-full border rounded px-3 py-2"
          />
          <input
            value={restaurant.location}
            onChange={(e) => setRestaurant({ ...restaurant, location: e.target.value })}
            placeholder="Location"
            className="w-full border rounded px-3 py-2"
          />
          <input
            value={restaurant.timing}
            onChange={(e) => setRestaurant({ ...restaurant, timing: e.target.value })}
            placeholder="Timing"
            className="w-full border rounded px-3 py-2"
          />
          <div className="space-y-2">
            <h4 className="font-semibold">QR Code</h4>
            {restaurant.qrName && (
              <p className="text-sm text-gray-600">
                Current: <span className="font-medium">{restaurant.qrName}</span>
              </p>
            )}
            <input
              type="file"
              onChange={(e) => setQrUploadFile(e.target.files[0])}
              className="block w-full text-sm text-gray-700"
            />
            {qrUploadFile && <p className="text-sm text-gray-500">{qrUploadFile.name}</p>}
            <button
              onClick={uploadQR}
              disabled={!qrUploadFile || status.saving}
              className="w-full bg-brand text-white py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              {status.saving ? 'Uploading...' : 'Upload QR Code'}
            </button>
          </div>
          <button
            onClick={saveRestaurant}
            disabled={status.saving}
            className="w-full bg-brand text-white py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {status.saving ? 'Saving...' : 'Save Restaurant'}
          </button>
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