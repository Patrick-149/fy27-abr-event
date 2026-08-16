import { useEffect, useState } from 'react';
import api from '../api';
import EditableList from '../components/EditableList';
import Loading from '../components/Loading';

const TABS = ['schedule', 'restaurant', 'poc', 'registrations'];

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
    menuFile: '',
    menuName: ''
  });
  const [restrooms, setRestrooms] = useState([]);
  const [poc, setPoc] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ saving: false, message: '', error: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const [menuUploadFile, setMenuUploadFile] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, r, rr, p, reg] = await Promise.all([
          api.get('/api/admin/schedule'),
          api.get('/api/admin/restaurant'),
          api.get('/api/admin/restrooms'),
          api.get('/api/admin/poc'),
          api.get('/api/admin/registrations')
        ]);
        setSchedule(s.data);
        setRestaurant({
          name: '',
          location: '',
          timing: '',
          menuFile: '',
          menuName: '',
          ...r.data
        });
        setRestrooms(rr.data);
        setPoc(p.data);
        setRegistrations(reg.data);
      } catch {
        setStatus({ saving: false, message: '', error: 'Failed to load admin data.' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const setMessage = (message, error = '') => {
    setStatus({ saving: false, message, error });
  };

  const uploadSchedule = async () => {
    if (!uploadFile) return;
    setStatus({ saving: true, message: '', error: '' });
    try {
      const formData = new FormData();
      formData.append('schedule', uploadFile);
      const { data } = await api.post('/api/admin/schedule/upload', formData);
      setSchedule(data.schedule);
      setUploadFile(null);
      setMessage(`Uploaded ${data.count} rows successfully.`);
    } catch {
      setStatus({ saving: false, message: '', error: 'Upload failed. Make sure the file is a valid Excel with Duration, Topic, Presenter columns.' });
    }
  };

  const save = async (endpoint, payload) => {
    setStatus({ saving: true, message: '', error: '' });
    try {
      await api.put(endpoint, payload);
      setMessage('Saved successfully.');
    } catch {
      setStatus({ saving: false, message: '', error: 'Save failed.' });
    }
  };

  const downloadRegistrations = async () => {
    try {
      const response = await api.get('/api/admin/registrations/export', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'registrations.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setStatus({ saving: false, message: '', error: 'Download failed.' });
    }
  };

  const uploadMenu = async () => {
    if (!menuUploadFile) return;
    setStatus({ saving: true, message: '', error: '' });
    try {
      const formData = new FormData();
      formData.append('menu', menuUploadFile);
      const { data } = await api.post('/api/admin/restaurant/menu', formData);
      setRestaurant({ ...restaurant, menuFile: data.menuFile, menuName: data.menuName });
      setMenuUploadFile(null);
      setMessage('Menu uploaded successfully.');
    } catch {
      setStatus({ saving: false, message: '', error: 'Menu upload failed.' });
    }
  };

  const saveRestaurant = () => {
    save('/api/admin/restaurant', restaurant);
  };

  const saveRestrooms = () => {
    const payload = restrooms.map((r) => ({
      ...r,
      x: Number(r.x) || 0,
      y: Number(r.y) || 0
    }));
    save('/api/admin/restrooms', payload);
  };

  const savePoc = () => {
    save('/api/admin/poc', poc);
  };

  if (loading) return <Loading />;

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
            label={t === 'poc' ? 'POC Contact' : t[0].toUpperCase() + t.slice(1)}
          />
        ))}
      </div>

      {tab === 'schedule' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 shadow space-y-3">
            <h3 className="font-bold text-lg">Upload Schedule Excel</h3>
            <p className="text-sm text-gray-600">
              First row should be a header. Columns: <strong>Duration</strong>, <strong>Topic</strong>, <strong>Presenter</strong>.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="block w-full text-sm text-gray-700"
            />
            {uploadFile && <p className="text-sm text-gray-500">{uploadFile.name}</p>}
            <button
              onClick={uploadSchedule}
              disabled={!uploadFile || status.saving}
              className="w-full bg-brand text-white py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              {status.saving ? 'Uploading...' : 'Upload Excel'}
            </button>
          </div>
          <EditableList
            items={schedule}
            onChange={setSchedule}
            fields={[
              { key: 'duration', label: 'Duration' },
              { key: 'topic', label: 'Topic' },
              { key: 'presenter', label: 'Presenter' }
            ]}
          />
          <button
            onClick={() => save('/api/admin/schedule', schedule)}
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
            <h4 className="font-semibold">Menu</h4>
            {restaurant.menuName && (
              <p className="text-sm text-gray-600">
                Current: <span className="font-medium">{restaurant.menuName}</span>
              </p>
            )}
            <input
              type="file"
              onChange={(e) => setMenuUploadFile(e.target.files[0])}
              className="block w-full text-sm text-gray-700"
            />
            {menuUploadFile && <p className="text-sm text-gray-500">{menuUploadFile.name}</p>}
            <button
              onClick={uploadMenu}
              disabled={!menuUploadFile || status.saving}
              className="w-full bg-brand text-white py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              {status.saving ? 'Uploading...' : 'Upload Menu'}
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

      {tab === 'restrooms' && (
        <div>
          <p className="text-sm text-gray-600 mb-2">
            Set pin name and percentage coordinates (0–100) for the floor plan.
          </p>
          <EditableList
            items={restrooms}
            onChange={setRestrooms}
            fields={[
              { key: 'name', label: 'Name' },
              { key: 'x', label: 'X %', type: 'number', default: 0 },
              { key: 'y', label: 'Y %', type: 'number', default: 0 }
            ]}
          />
          <button
            onClick={saveRestrooms}
            disabled={status.saving}
            className="mt-4 w-full bg-brand text-white py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {status.saving ? 'Saving...' : 'Save Restrooms'}
          </button>
        </div>
      )}

      {tab === 'poc' && (
        <div>
          <EditableList
            items={poc}
            onChange={setPoc}
            fields={[
              { key: 'category', label: 'Category' },
              { key: 'name', label: 'Name' },
              { key: 'phone', label: 'Phone' }
            ]}
          />
          <button
            onClick={savePoc}
            disabled={status.saving}
            className="mt-4 w-full bg-brand text-white py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {status.saving ? 'Saving...' : 'Save POC Contacts'}
          </button>
        </div>
      )}

      {tab === 'registrations' && (
        <div>
          <div className="flex justify-end mb-3">
            <button
              onClick={downloadRegistrations}
              disabled={status.saving || registrations.length === 0}
              className="bg-brand text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              Download Excel
            </button>
          </div>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            {registrations.length === 0 ? (
              <p className="p-4 text-gray-500">No registrations yet.</p>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Country</th>
                    <th className="p-3">DSP</th>
                    <th className="p-3">Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{r.fullName}</td>
                      <td className="p-3">{r.email}</td>
                      <td className="p-3">{r.country}</td>
                      <td className="p-3">{r.dsp}</td>
                      <td className="p-3">{new Date(r.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
