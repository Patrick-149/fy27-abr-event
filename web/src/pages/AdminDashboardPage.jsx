import { useState, useEffect, useCallback } from 'react';
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
const GROUP_DSPS = [
  '1000Fix',
  'Inbox',
  'Softlogic',
  'CTC',
  'Digipro',
  'NCR',
  'SOG',
  'Getronics',
  'SVOA',
  'ISS'
].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

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
  const [groups, setGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [registrations, setRegistrations] = useState([]);
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ saving: false, message: '', error: '' });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [s, r, g, reg] = await Promise.all([
          api.get('/api/admin/schedule'),
          api.get('/api/admin/restaurant'),
          api.get('/api/admin/groups'),
          api.get('/api/admin/registrations')
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
        setGroups(g.data);
        setRegistrations(reg.data);
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

  const saveGroups = async () => {
    setStatus({ saving: true, message: '', error: '' });
    try {
      await api.put('/api/admin/groups', groups);
      const { data } = await api.get('/api/admin/registrations');
      setRegistrations(data);
      setSelectedGroupIds(new Set());
      setStatus({ saving: false, message: 'Saved successfully.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Save failed.' });
    }
  };

  const addGroup = () => {
    const used = new Set(groups.map((g) => g.dsp));
    const nextDsp = GROUP_DSPS.find((d) => !used.has(d));
    if (!nextDsp) return;
    setGroups([...groups, { id: `${Date.now()}`, dsp: nextDsp, group: '', table: '' }]);
  };

  const updateGroup = (id, field, value) => {
    setGroups(groups.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
  };

  const availableDsps = (id) => {
    const used = new Set(groups.filter((g) => g.id !== id).map((g) => g.dsp));
    return GROUP_DSPS.filter((d) => !used.has(d));
  };

  const toggleGroup = (id) => {
    const next = new Set(selectedGroupIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedGroupIds(next);
  };

  const toggleAllGroups = () => {
    if (selectedGroupIds.size === groups.length) {
      setSelectedGroupIds(new Set());
    } else {
      setSelectedGroupIds(new Set(groups.map((g) => g.id)));
    }
  };

  const removeSelectedGroups = async () => {
    if (selectedGroupIds.size === 0) return;
    const count = selectedGroupIds.size;
    if (!window.confirm(`Are you sure you want to remove ${count} group mapping(s)?`)) return;
    setStatus({ saving: true, message: '', error: '' });
    try {
      const ids = Array.from(selectedGroupIds);
      await api.delete('/api/admin/groups', { data: { ids } });
      const { data } = await api.get('/api/admin/groups');
      setGroups(data);
      const { data: regData } = await api.get('/api/admin/registrations');
      setRegistrations(regData);
      setSelectedGroupIds(new Set());
      setStatus({ saving: false, message: 'Removed successfully.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Remove failed.' });
    }
  };

  const toggleRegistration = (id) => {
    const next = new Set(selectedRegistrationIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRegistrationIds(next);
  };

  const toggleAllRegistrations = () => {
    if (selectedRegistrationIds.size === registrations.length) {
      setSelectedRegistrationIds(new Set());
    } else {
      setSelectedRegistrationIds(new Set(registrations.map((r) => r.id)));
    }
  };

  const removeSelectedRegistrations = async () => {
    if (selectedRegistrationIds.size === 0) return;
    const count = selectedRegistrationIds.size;
    if (!window.confirm(`Are you sure you want to remove ${count} registration(s)?`)) return;
    setStatus({ saving: true, message: '', error: '' });
    try {
      const ids = Array.from(selectedRegistrationIds);
      await api.delete('/api/admin/registrations', { data: { ids } });
      const { data } = await api.get('/api/admin/registrations');
      setRegistrations(data);
      setSelectedRegistrationIds(new Set());
      setStatus({ saving: false, message: 'Removed successfully.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Remove failed.' });
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

  const loadRegistrations = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/registrations');
      setRegistrations(data);
    } catch (err) {
      console.error('Failed to load registrations:', err);
    }
  }, []);

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
        <div>
          <p className="text-sm text-gray-600 mb-2">
            Assign a group to each DSP. Registrations will show the group that matches their DSP.
          </p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={addGroup}
              disabled={status.saving || !GROUP_DSPS.some((d) => !groups.some((g) => g.dsp === d))}
              className="bg-brand text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              Add DSP
            </button>
            <button
              onClick={removeSelectedGroups}
              disabled={status.saving || selectedGroupIds.size === 0}
              className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              Remove Selected
            </button>
          </div>
          <div className="bg-white rounded-xl shadow overflow-hidden mb-4">
            {groups.length === 0 ? (
              <p className="p-4 text-gray-500">No group mappings yet.</p>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={groups.length > 0 && selectedGroupIds.size === groups.length}
                        onChange={toggleAllGroups}
                      />
                    </th>
                    <th className="p-3">DSP</th>
                    <th className="p-3">Group</th>
                    <th className="p-3">Table</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.id} className="border-t">
                      <td className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.has(g.id)}
                          onChange={() => toggleGroup(g.id)}
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={g.dsp}
                          onChange={(e) => updateGroup(g.id, 'dsp', e.target.value)}
                          className="w-full border rounded px-2 py-1 bg-white"
                        >
                          {(() => {
                            const options = availableDsps(g.id);
                            if (g.dsp && !options.includes(g.dsp)) options.unshift(g.dsp);
                            return options.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ));
                          })()}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          value={g.group}
                          onChange={(e) => updateGroup(g.id, 'group', e.target.value)}
                          className="w-full border rounded px-2 py-1"
                          placeholder="Group"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          value={g.table || ''}
                          onChange={(e) => updateGroup(g.id, 'table', e.target.value)}
                          className="w-full border rounded px-2 py-1"
                          placeholder="Table"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <button
            onClick={saveGroups}
            disabled={status.saving}
            className="w-full bg-brand text-white py-2 rounded-lg font-semibold disabled:opacity-50"
          >
            {status.saving ? 'Saving...' : 'Save Groups'}
          </button>
        </div>
      )}

      {tab === 'registrations' && (
        <div>
          <div className="flex justify-end gap-2 mb-3">
            <button
              onClick={removeSelectedRegistrations}
              disabled={status.saving || selectedRegistrationIds.size === 0}
              className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              Remove Selected
            </button>
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
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={registrations.length > 0 && selectedRegistrationIds.size === registrations.length}
                        onChange={toggleAllRegistrations}
                      />
                    </th>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">DSP</th>
                    <th className="p-3">Group</th>
                    <th className="p-3">Table</th>
                    <th className="p-3">Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedRegistrationIds.has(r.id)}
                          onChange={() => toggleRegistration(r.id)}
                        />
                      </td>
                      <td className="p-3">{r.fullName}</td>
                      <td className="p-3">{r.email}</td>
                      <td className="p-3">{r.dsp}</td>
                      <td className="p-3">{r.group || '-'}</td>
                      <td className="p-3">{r.table || '-'}</td>
                      <td className="p-3">{new Date(r.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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