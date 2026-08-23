import { useEffect, useState, useRef } from 'react';
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
  const [sessionToEnable, setSessionToEnable] = useState('');
  const [timerExpired, setTimerExpired] = useState(false);
  const autoRefreshIntervalRef = useRef(null);
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
    // Clear any existing auto-refresh when tab changes or session changes
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }
    
    if (tab !== 'voting-results' || !selectedSessionId) return;
    const session = votingSessions.find((s) => s.id === selectedSessionId);
    
    // Auto-refresh only when timer is actively running (has timerEnd and not expired)
    // Do not auto-refresh when paused (has remainingMinutes) or stopped/reset (no timerEnd and no remainingMinutes)
    if (!session?.timerEnd || session?.remainingMinutes) return;
    
    // Check if timer has already expired
    const now = new Date();
    const end = new Date(session.timerEnd);
    if (now >= end) {
      setTimerExpired(true);
      // Stop auto-refresh if timer has expired
      return;
    } else {
      setTimerExpired(false);
    }
    
    loadVotingResults();
    autoRefreshIntervalRef.current = setInterval(() => {
      const currentSession = votingSessions.find((s) => s.id === selectedSessionId);
      // Stop auto-refresh if timer has been paused (has remainingMinutes)
      if (currentSession?.remainingMinutes) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
        return;
      }
      // Stop auto-refresh if timer has been reset (no timerEnd and no remainingMinutes)
      if (!currentSession?.timerEnd && !currentSession?.remainingMinutes) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
        setTimerExpired(false);
        return;
      }
      // Stop auto-refresh if timer has expired
      const now = new Date();
      const end = new Date(currentSession.timerEnd);
      if (now >= end) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
        setTimerExpired(true);
        // Refresh sessions to update total votes when timer ends
        api.get('/api/admin/voting-sessions').then(({ data: sessions }) => {
          setVotingSessions(sessions);
        }).catch(err => console.error('Failed to refresh sessions:', err));
        return;
      }
      // Continue auto-refresh while timer is running
      loadVotingResults();
      // Also refresh sessions to update total votes in summary table
      api.get('/api/admin/voting-sessions').then(({ data: sessions }) => {
        setVotingSessions(sessions);
      }).catch(err => console.error('Failed to refresh sessions:', err));
    }, 5000);
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, [tab, selectedSessionId, votingSessions]);

  useEffect(() => {
    const session = votingSessions.find((s) => s.id === selectedSessionId);
    
    // Handle paused state - show static remaining time
    if (session?.remainingMinutes) {
      const hours = Math.floor(session.remainingMinutes / 60);
      const minutes = session.remainingMinutes % 60;
      setCountdown(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00 (Paused)`
      );
      setTimerDuration(session.remainingMinutes.toString());
      return;
    }
    
    // Handle no timer state
    if (!session?.timerEnd) {
      setCountdown(null);
      return;
    }
    
    // Handle running timer state
    const updateCountdown = () => {
      const now = new Date();
      const end = new Date(session.timerEnd);
      const diff = end - now;
      if (diff <= 0) {
        setCountdown('00:00:00');
        // Refresh voting sessions when timer ends to update total votes in summary table
        api.get('/api/admin/voting-sessions').then(({ data: sessions }) => {
          setVotingSessions(sessions);
        }).catch(err => console.error('Failed to refresh sessions:', err));
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
    const session = votingSessions.find((s) => s.id === selectedSessionId);
    if (!session?.enabled) {
      setStatus({ saving: false, message: '', error: 'Cannot start timer: Session must be enabled first from the Voting Groups tab.' });
      return;
    }
    const duration = Number(timerDuration);
    if (!duration || duration <= 0) return;
    
    // Clear auto-refresh interval before starting timer to prevent conflicts
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }
    
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

  const pauseTimer = async () => {
    if (!selectedSessionId) return;
    
    // Clear auto-refresh interval before pausing timer to prevent conflicts
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }
    
    setStatus({ saving: true, message: '', error: '' });
    try {
      const session = votingSessions.find((s) => s.id === selectedSessionId);
      if (!session?.timerEnd) {
        setStatus({ saving: false, message: '', error: 'No active timer to pause.' });
        return;
      }
      
      // Calculate remaining time
      const now = new Date();
      const end = new Date(session.timerEnd);
      const remainingMs = end - now;
      const remainingMinutes = Math.max(0, Math.ceil(remainingMs / (1000 * 60)));
      
      // Store remaining time and clear timer
      await api.post(`/api/admin/voting-sessions/${selectedSessionId}/timer`, { durationMinutes: remainingMinutes, paused: true });
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      setTimerDuration(remainingMinutes.toString());
      // Countdown will be updated by the useEffect when session has remainingMinutes
      setStatus({ saving: false, message: 'Timer paused.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Failed to pause timer.' });
    }
  };

  const continueTimer = async () => {
    if (!selectedSessionId) return;
    const session = votingSessions.find((s) => s.id === selectedSessionId);
    
    // Clear auto-refresh interval before continuing timer to prevent conflicts
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }
    
    // Use remainingMinutes if available (paused state), otherwise use input
    const duration = session?.remainingMinutes ? session.remainingMinutes : Number(timerDuration);
    if (!duration || duration <= 0) {
      setStatus({ saving: false, message: '', error: 'Please enter a valid duration.' });
      return;
    }
    
    setStatus({ saving: true, message: '', error: '' });
    try {
      const { data } = await api.post(`/api/admin/voting-sessions/${selectedSessionId}/timer`, { durationMinutes: duration });
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      setTimerDuration(duration.toString());
      // Countdown will be updated by the useEffect when session has timerEnd
      setStatus({ saving: false, message: 'Timer continued.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Failed to continue timer.' });
    }
  };

  const resetVotes = async () => {
    if (!selectedSessionId) {
      setStatus({ saving: false, message: '', error: 'Please select a voting session first.' });
      return;
    }
    if (!window.confirm('Are you sure you want to reset all votes for this session?')) return;
    setStatus({ saving: true, message: '', error: '' });
    try {
      await api.post(`/api/admin/voting-sessions/${selectedSessionId}/reset`);
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      setTimerDuration('');
      setCountdown(null);
      setTimerExpired(false);
      setStatus({ saving: false, message: 'Votes reset.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Failed to reset votes.' });
    }
  };

  const resetTimer = async () => {
    if (!selectedSessionId) return;
    
    // Clear auto-refresh interval before resetting timer to prevent conflicts
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }
    
    setStatus({ saving: true, message: '', error: '' });
    try {
      await api.post(`/api/admin/voting-sessions/${selectedSessionId}/reset-timer`);
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      setTimerDuration('');
      setCountdown(null);
      setTimerExpired(false);
      setStatus({ saving: false, message: 'Timer reset.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Failed to reset timer.' });
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
            <h3 className="font-bold text-lg">Enable/Disable Sessions</h3>
            <div className="flex gap-2 items-center">
              <select
                value={sessionToEnable}
                onChange={(e) => setSessionToEnable(e.target.value)}
                className="flex-1 border rounded px-2 py-1"
              >
                <option value="">Select a session to enable</option>
                {votingSessions.filter(s => !s.enabled).map((s) => (
                  <option key={s.id} value={s.id}>{s.sessionDescription}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (sessionToEnable) {
                    updateVotingSession(sessionToEnable, { enabled: true });
                    setSessionToEnable('');
                  }
                }}
                disabled={status.saving || !sessionToEnable}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                Enable Session
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow space-y-3 mb-4">
            <h3 className="font-bold text-lg">Sessions Status</h3>
            {votingSessions.length === 0 ? (
              <p className="text-gray-500">No sessions yet.</p>
            ) : (
              <div className="space-y-2">
                {votingSessions.map((s) => (
                  <div key={s.id} className={`border rounded-lg p-3 ${s.enabled ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{s.sessionDescription}</p>
                          {s.enabled ? (
                            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">Enabled</span>
                          ) : (
                            <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded">Disabled</span>
                          )}
                        </div>
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
                    <div className="flex items-center gap-2">
                      {s.enabled && (
                        <button
                          onClick={() => updateVotingSession(s.id, { enabled: false })}
                          className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200"
                        >
                          Disable
                        </button>
                      )}
                      <span className="text-sm text-gray-600">
                        {s.enabled ? 'Session enabled' : 'Session disabled'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedSessionId && (
            <div className="bg-white rounded-xl p-4 shadow space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">Session Groups</h3>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  {votingSessions.filter(s => s.enabled).map((s) => (
                    <option key={s.id} value={s.id}>{s.sessionDescription}</option>
                  ))}
                </select>
              </div>
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
                {votingSessions.filter(s => s.enabled).map((s) => (
                  <option key={s.id} value={s.id}>{s.sessionDescription}</option>
                ))}
              </select>
              <button
                onClick={resetVotes}
                disabled={status.saving || !selectedSessionId}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                Reset Votes
              </button>
            </div>
            <div className="flex gap-2">
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
                  <span className="text-sm text-gray-600">(mins)</span>
                  <button
                    onClick={startTimer}
                    disabled={status.saving || !timerDuration}
                    className="bg-brand text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                  >
                    Start Timer
                  </button>
                  {(() => {
                    const session = votingSessions.find((s) => s.id === selectedSessionId);
                    if (session?.timerEnd) {
                      // Timer is running - show pause button
                      return (
                        <button
                          onClick={pauseTimer}
                          disabled={status.saving}
                          className="bg-yellow-500 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                        >
                          Pause
                        </button>
                      );
                    } else if (session?.remainingMinutes) {
                      // Timer is paused - show continue button
                      return (
                        <button
                          onClick={continueTimer}
                          disabled={status.saving}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                        >
                          Continue
                        </button>
                      );
                    }
                    return null;
                  })()}
                  <button
                    onClick={resetTimer}
                    disabled={status.saving || !selectedSessionId}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                  >
                    Reset Timer
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
                      {s.remainingMinutes ? 'Paused' :
                       (!s.timerEnd ? 'Not yet started' : 
                       (new Date() < new Date(s.timerEnd) ? 'Active' : 'Ended'))}
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
