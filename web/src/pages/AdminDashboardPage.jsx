import { useEffect, useState } from 'react';
import api from '../api';
import EditableList from '../components/EditableList';
import Loading from '../components/Loading';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const TABS = ['schedule', 'restaurant', 'poc', 'groups', 'registrations', 'voting-groups', 'voting-results'];
const TAB_LABELS = {
  schedule: 'Schedule',
  restaurant: 'Restaurant',
  poc: 'POC Contact',
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
    menuFile: '',
    menuName: ''
  });
  const [restrooms, setRestrooms] = useState([]);
  const [poc, setPoc] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState(new Set());
  const [groups, setGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [votingSessions, setVotingSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [votingResults, setVotingResults] = useState({ results: [], timerEnd: null, totalVotes: 0 });
  const [timerDuration, setTimerDuration] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [newSessionDescription, setNewSessionDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ saving: false, message: '', error: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const [menuUploadFile, setMenuUploadFile] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, r, rr, p, g, reg] = await Promise.all([
          api.get('/api/admin/schedule'),
          api.get('/api/admin/restaurant'),
          api.get('/api/admin/restrooms'),
          api.get('/api/admin/poc'),
          api.get('/api/admin/groups'),
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
        setGroups(g.data);
        setRegistrations(reg.data);
        
        const vs = await api.get('/api/admin/voting-sessions');
        setVotingSessions(vs.data);
        if (vs.data.length > 0) {
          setSelectedSessionId(vs.data[0].id);
        }
      } catch (err) {
        console.error('Admin data load error:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Failed to load admin data';
        setStatus({ saving: false, message: '', error: errorMessage });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (tab !== 'voting-results' || !selectedSessionId) return;
    loadVotingResults();
    const interval = setInterval(() => {
      loadVotingResults();
    }, 5000);
    return () => clearInterval(interval);
  }, [tab, selectedSessionId]);

  useEffect(() => {
    const session = votingSessions.find((s) => s.id === selectedSessionId);
    if (!session?.timerEnd) {
      setCountdown(null);
      return;
    }
    const updateCountdown = () => {
      const now = new Date();
      const end = new Date(session.timerEnd);
      const diff = end - now;
      if (diff <= 0) {
        setCountdown('00:00:00');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [selectedSessionId, votingSessions]);

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
    setGroups([...groups, { id: `${Date.now()}`, dsp: nextDsp, group: '' }]);
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

  const createVotingSession = async () => {
    if (!newSessionDescription) return;
    setStatus({ saving: true, message: '', error: '' });
    try {
      const { data } = await api.post('/api/admin/voting-sessions', { 
        sessionDescription: newSessionDescription,
        groups: []
      });
      setNewSessionDescription('');
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      setSelectedSessionId(data.id);
      setStatus({ saving: false, message: 'Session created.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Failed to create session.' });
    }
  };

  const updateVotingSession = async (id, updates) => {
    setStatus({ saving: true, message: '', error: '' });
    try {
      await api.put(`/api/admin/voting-sessions/${id}`, updates);
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      setStatus({ saving: false, message: 'Session updated.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Failed to update session.' });
    }
  };

  const deleteVotingSession = async (id) => {
    if (!window.confirm('Are you sure you want to delete this session and all its votes?')) return;
    setStatus({ saving: true, message: '', error: '' });
    try {
      await api.delete(`/api/admin/voting-sessions/${id}`);
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      if (selectedSessionId === id) {
        setSelectedSessionId(sessions.length > 0 ? sessions[0].id : null);
      }
      setStatus({ saving: false, message: 'Session deleted.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Failed to delete session.' });
    }
  };

  const addSessionGroup = (sessionId) => {
    const session = votingSessions.find((s) => s.id === sessionId);
    if (!session) return;
    const updatedGroups = [...(session.groups || []), { id: `${Date.now()}`, name: '', description: '' }];
    updateVotingSession(sessionId, { groups: updatedGroups });
  };

  const updateSessionGroup = (sessionId, groupId, field, value) => {
    const session = votingSessions.find((s) => s.id === sessionId);
    if (!session) return;
    const updatedGroups = session.groups.map((g) => (g.id === groupId ? { ...g, [field]: value } : g));
    updateVotingSession(sessionId, { groups: updatedGroups });
  };

  const removeSessionGroup = (sessionId, groupId) => {
    const session = votingSessions.find((s) => s.id === sessionId);
    if (!session) return;
    const updatedGroups = session.groups.filter((g) => g.id !== groupId);
    updateVotingSession(sessionId, { groups: updatedGroups });
  };

  const startTimer = async () => {
    if (!selectedSessionId) return;
    const duration = Number(timerDuration);
    if (!duration || duration <= 0) return;
    setStatus({ saving: true, message: '', error: '' });
    try {
      const { data } = await api.post(`/api/admin/voting-sessions/${selectedSessionId}/timer`, { durationMinutes: duration });
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      setStatus({ saving: false, message: 'Timer started.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Failed to start timer.' });
    }
  };

  const resetVotes = async () => {
    if (!selectedSessionId) return;
    if (!window.confirm('Are you sure you want to reset all votes for this session?')) return;
    setStatus({ saving: true, message: '', error: '' });
    try {
      await api.post(`/api/admin/voting-sessions/${selectedSessionId}/reset`);
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      setStatus({ saving: false, message: 'Votes reset.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Failed to reset votes.' });
    }
  };

  const loadVotingResults = async () => {
    if (!selectedSessionId) return;
    setStatus({ saving: true, message: '', error: '' });
    try {
      const { data } = await api.get(`/api/admin/voting-sessions/${selectedSessionId}/results`);
      setVotingResults(data);
      setStatus({ saving: false, message: '', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Failed to load voting results.' });
    }
  };

  const downloadVotingResults = async () => {
    if (!selectedSessionId) return;
    try {
      const response = await api.get(`/api/admin/voting-sessions/${selectedSessionId}/export`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'votes.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setStatus({ saving: false, message: '', error: 'Download failed.' });
    }
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
            label={TAB_LABELS[t] || t[0].toUpperCase() + t.slice(1)}
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
        <div>
          <p className="text-sm text-gray-600 mb-2">
            Manage voting sessions. Each session has its own groups and description.
          </p>
          <div className="bg-white rounded-xl p-4 shadow space-y-3 mb-4">
            <h3 className="font-bold text-lg">Create New Session</h3>
            <div className="flex gap-2">
              <input
                value={newSessionDescription}
                onChange={(e) => setNewSessionDescription(e.target.value)}
                className="flex-1 border rounded px-2 py-1"
                placeholder="Session description (required)"
              />
              <button
                onClick={createVotingSession}
                disabled={status.saving || !newSessionDescription}
                className="bg-brand text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow space-y-3 mb-4">
            <h3 className="font-bold text-lg">Sessions</h3>
            {votingSessions.length === 0 ? (
              <p className="text-gray-500">No sessions yet.</p>
            ) : (
              <div className="space-y-2">
                {votingSessions.map((s) => (
                  <div key={s.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium">{s.sessionDescription}</p>
                        <p className="text-sm text-gray-500">
                          Created: {new Date(s.createdAt).toLocaleString()}
                        </p>
                        {s.timerEnd && (
                          <p className="text-sm text-gray-500">
                            Timer ends: {new Date(s.timerEnd).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteVotingSession(s.id)}
                        className="text-red-600 text-sm hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) => updateVotingSession(s.id, { enabled: e.target.checked })}
                      />
                      <span>Enabled</span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedSessionId && (
            <div className="bg-white rounded-xl p-4 shadow space-y-3 mb-4">
              <h3 className="font-bold text-lg">Session Groups</h3>
              {(() => {
                const session = votingSessions.find((s) => s.id === selectedSessionId);
                if (!session) return null;
                return (
                  <>
                    {session.groups.map((g) => (
                      <div key={g.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex gap-2 items-center">
                          <input
                            value={g.name}
                            onChange={(e) => updateSessionGroup(selectedSessionId, g.id, 'name', e.target.value)}
                            className="flex-1 border rounded px-2 py-1"
                            placeholder="Group name"
                          />
                          <button
                            onClick={() => removeSessionGroup(selectedSessionId, g.id)}
                            className="text-red-600 text-sm hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                        <textarea
                          value={g.description || ''}
                          onChange={(e) => updateSessionGroup(selectedSessionId, g.id, 'description', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-sm"
                          rows={2}
                          placeholder="Group description"
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => addSessionGroup(selectedSessionId)}
                      className="w-full py-2 border-2 border-dashed border-brand text-brand rounded-lg"
                    >
                      + Add Group
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {tab === 'voting-results' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2 items-center">
              <select
                value={selectedSessionId || ''}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="">Select a session</option>
                {votingSessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.sessionDescription}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetVotes}
                disabled={status.saving || !selectedSessionId}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                Reset Votes
              </button>
              <button
                onClick={downloadVotingResults}
                disabled={status.saving || !selectedSessionId}
                className="bg-brand text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                Download Results
              </button>
            </div>
          </div>
          {selectedSessionId && (
            <>
              <div className="bg-white rounded-xl p-4 shadow space-y-4 mb-4">
                <h3 className="font-bold text-lg">Timer</h3>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={timerDuration}
                    onChange={(e) => setTimerDuration(e.target.value)}
                    className="w-24 border rounded px-2 py-1"
                    placeholder="Minutes"
                    min="1"
                  />
                  <button
                    onClick={startTimer}
                    disabled={status.saving || !timerDuration}
                    className="bg-brand text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                  >
                    Start Timer
                  </button>
                </div>
                {countdown !== null && (
                  <div className="text-3xl font-mono font-bold text-center text-brand mt-4">
                    {countdown}
                  </div>
                )}
                {(() => {
                  const session = votingSessions.find((s) => s.id === selectedSessionId);
                  return session?.timerEnd ? (
                    <div className="text-sm text-gray-600 text-center">
                      Timer ends at: {new Date(session.timerEnd).toLocaleString()}
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="bg-white rounded-xl p-4 shadow mb-4">
                <h3 className="font-bold text-lg mb-4">Vote Distribution</h3>
                {votingResults.results.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={votingResults.results}
                        dataKey="votes"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {votingResults.results.map((entry, index) => {
                          const dellColors = [
                            '#007DB8',
                            '#76B900',
                            '#FF6600',
                            '#E4002B',
                            '#8C1D82',
                            '#00A9F4',
                            '#FFC107',
                            '#795548',
                            '#607D8B',
                            '#9C27B0'
                          ];
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={dellColors[index % dellColors.length]}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500">No votes yet.</p>
                )}
              </div>
              <div className="bg-white rounded-xl p-4 shadow">
                <h3 className="font-bold text-lg mb-2">Vote Counts</h3>
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="p-3">Group</th>
                      <th className="p-3">Votes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {votingResults.results.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-3">{r.name}</td>
                        <td className="p-3">{r.votes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 text-sm text-gray-600">
                  Total votes: {votingResults.totalVotes}
                </div>
              </div>
            </>
          )}
          <div className="bg-white rounded-xl p-4 shadow mt-4">
            <h3 className="font-bold text-lg mb-2">Session Summary</h3>
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-3">Session</th>
                  <th className="p-3">Total Votes</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {votingSessions.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3">{s.sessionDescription}</td>
                    <td className="p-3">{s.totalVotes || 0}</td>
                    <td className="p-3">
                      {s.enabled ? (s.timerEnd && new Date() < new Date(s.timerEnd) ? 'Active' : 'Ended') : 'Disabled'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
