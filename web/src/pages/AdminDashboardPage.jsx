import { useState, useEffect, useRef } from 'react';
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
  const [groups, setGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
  const [registrations, setRegistrations] = useState([]);
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState(new Set());
  const [showAddRegistration, setShowAddRegistration] = useState(false);
  const [newRegistration, setNewRegistration] = useState({
    fullName: '',
    email: '',
    dsp: '',
    group: '',
    table: ''
  });
  const [votingSessions, setVotingSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [votingResults, setVotingResults] = useState({ results: [], timerEnd: null, totalVotes: 0 });
  const [timerDuration, setTimerDuration] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [newSessionDescription, setNewSessionDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ saving: false, message: '', error: '' });
  const votingResultsAutoRefreshRef = useRef(null);
  const [localSessionGroups, setLocalSessionGroups] = useState([]);

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
        
        const vs = await api.get('/api/admin/voting-sessions');
        setVotingSessions(vs.data);
        if (vs.data.length > 0) {
          setSelectedSessionId(vs.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setStatus({ saving: false, message: '', error: 'Failed to load data' });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (tab === 'voting-results' && selectedSessionId) {
      const loadResults = async () => {
        try {
          const { data } = await api.get(`/api/admin/voting-sessions/${selectedSessionId}/results`);
          setVotingResults(data);
        } catch (err) {
          console.error('Failed to load voting results:', err);
        }
      };
      loadResults();
    }
  }, [tab, selectedSessionId]);

  // Sync local session groups with selected session
  useEffect(() => {
    if (selectedSessionId) {
      const session = votingSessions.find((s) => s.id === selectedSessionId);
      if (session) {
        setLocalSessionGroups(session.groups || []);
      }
    }
  }, [selectedSessionId, votingSessions]);

  // Auto-refresh voting results only when timer is active (within timer duration)
  useEffect(() => {
    // Clear any existing interval
    if (votingResultsAutoRefreshRef.current) {
      clearInterval(votingResultsAutoRefreshRef.current);
      votingResultsAutoRefreshRef.current = null;
    }

    // Only auto-refresh if on voting-results tab, session is selected, and timer is active
    if (tab !== 'voting-results' || !selectedSessionId) return;

    const session = votingSessions.find((s) => s.id === selectedSessionId);
    
    // Check if timer is active (has timerEnd and not paused)
    if (!session?.timerEnd || session?.remainingMinutes) return;

    // Check if timer has expired
    const now = new Date();
    const end = new Date(session.timerEnd);
    if (now >= end) return;

    // Timer is active - set up auto-refresh every 5 seconds
    const loadResults = async () => {
      try {
        const { data } = await api.get(`/api/admin/voting-sessions/${selectedSessionId}/results`);
        setVotingResults(data);
        // Also refresh sessions to update total votes
        const { data: sessions } = await api.get('/api/admin/voting-sessions');
        setVotingSessions(sessions);
      } catch (err) {
        console.error('Failed to load voting results:', err);
      }
    };

    loadResults();
    votingResultsAutoRefreshRef.current = setInterval(loadResults, 5000);

    // Cleanup function
    return () => {
      if (votingResultsAutoRefreshRef.current) {
        clearInterval(votingResultsAutoRefreshRef.current);
        votingResultsAutoRefreshRef.current = null;
      }
    };
  }, [tab, selectedSessionId, votingSessions]);

  useEffect(() => {
    const session = votingSessions.find((s) => s.id === selectedSessionId);
    
    if (session?.remainingMinutes) {
      const hours = Math.floor(session.remainingMinutes / 60);
      const minutes = session.remainingMinutes % 60;
      setCountdown(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00 (Paused)`
      );
      setTimerDuration(session.remainingMinutes.toString());
      return;
    }
    
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
        // Clear auto-refresh interval when timer expires
        if (votingResultsAutoRefreshRef.current) {
          clearInterval(votingResultsAutoRefreshRef.current);
          votingResultsAutoRefreshRef.current = null;
        }
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
    setGroups([...groups, { id: `${Date.now()}`, email: '', group: '', table: '' }]);
  };

  const updateGroup = (id, field, value) => {
    setGroups(groups.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
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

  const refreshRegistrations = async () => {
    try {
      const { data } = await api.get('/api/admin/registrations');
      setRegistrations(data);
    } catch (err) {
      console.error('Failed to load registrations:', err);
    }
  };

  const addManualRegistration = async () => {
    if (!newRegistration.fullName || !newRegistration.email) {
      setStatus({ saving: false, message: '', error: 'Full Name and Email are required' });
      return;
    }
    
    setStatus({ saving: true, message: '', error: '' });
    try {
      const { data } = await api.post('/api/admin/registrations', newRegistration);
      setRegistrations([data.registration, ...registrations]);
      setNewRegistration({ fullName: '', email: '', dsp: '', group: '', table: '' });
      setShowAddRegistration(false);
      setStatus({ saving: false, message: 'Registration added successfully.', error: '' });
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to add registration';
      setStatus({ saving: false, message: '', error: errorMessage });
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
    const newGroup = { id: `${Date.now()}`, name: '', description: '' };
    setLocalSessionGroups([...localSessionGroups, newGroup]);
    // Save immediately when adding a new group
    updateVotingSession(sessionId, { groups: [...localSessionGroups, newGroup] });
  };

  const updateSessionGroup = (sessionId, groupId, field, value) => {
    // Update local state immediately for smooth typing
    const updatedGroups = localSessionGroups.map((g) => (g.id === groupId ? { ...g, [field]: value } : g));
    setLocalSessionGroups(updatedGroups);
  };

  // Debounced save function to save to API after user stops typing
  const saveSessionGroupsDebounced = useRef(null);
  const saveSessionGroups = () => {
    if (!selectedSessionId) return;
    
    // Clear any existing timeout
    if (saveSessionGroupsDebounced.current) {
      clearTimeout(saveSessionGroupsDebounced.current);
    }
    
    // Set new timeout to save after 1 second of no typing
    saveSessionGroupsDebounced.current = setTimeout(async () => {
      try {
        await updateVotingSession(selectedSessionId, { groups: localSessionGroups });
        setStatus({ saving: false, message: 'Groups saved.', error: '' });
      } catch {
        setStatus({ saving: false, message: '', error: 'Failed to save groups.' });
      }
    }, 1000);
  };

  const removeSessionGroup = (sessionId, groupId) => {
    const updatedGroups = localSessionGroups.filter((g) => g.id !== groupId);
    setLocalSessionGroups(updatedGroups);
    // Save immediately when removing a group
    updateVotingSession(sessionId, { groups: updatedGroups });
  };

  const startTimer = async () => {
    if (!selectedSessionId) return;
    const session = votingSessions.find((s) => s.id === selectedSessionId);
    const duration = Number(timerDuration);
    if (!duration || duration <= 0) return;
    
    setStatus({ saving: true, message: '', error: '' });
    try {
      // Enable the session when starting the timer so users can see it
      await updateVotingSession(selectedSessionId, { enabled: true });
      // Disable all other sessions
      votingSessions.forEach(s => {
        if (s.id !== selectedSessionId) {
          updateVotingSession(s.id, { enabled: false });
        }
      });
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
    
    // Clear auto-refresh interval when pausing
    if (votingResultsAutoRefreshRef.current) {
      clearInterval(votingResultsAutoRefreshRef.current);
      votingResultsAutoRefreshRef.current = null;
    }
    
    setStatus({ saving: true, message: '', error: '' });
    try {
      const session = votingSessions.find((s) => s.id === selectedSessionId);
      if (!session?.timerEnd) {
        setStatus({ saving: false, message: '', error: 'No active timer to pause.' });
        return;
      }
      
      const now = new Date();
      const end = new Date(session.timerEnd);
      const remainingMs = end - now;
      const remainingMinutes = Math.max(0, Math.ceil(remainingMs / (1000 * 60)));
      
      await api.post(`/api/admin/voting-sessions/${selectedSessionId}/timer`, { durationMinutes: remainingMinutes, paused: true });
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      setTimerDuration(remainingMinutes.toString());
      setStatus({ saving: false, message: 'Timer paused.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Failed to pause timer.' });
    }
  };

  const continueTimer = async () => {
    if (!selectedSessionId) return;
    const session = votingSessions.find((s) => s.id === selectedSessionId);
    
    const duration = session?.remainingMinutes ? session.remainingMinutes : Number(timerDuration);
    if (!duration || duration <= 0) {
      setStatus({ saving: false, message: '', error: 'Please enter a valid duration.' });
      return;
    }
    
    setStatus({ saving: true, message: '', error: '' });
    try {
      // Enable the session when continuing the timer so users can see it
      await updateVotingSession(selectedSessionId, { enabled: true });
      // Disable all other sessions
      votingSessions.forEach(s => {
        if (s.id !== selectedSessionId) {
          updateVotingSession(s.id, { enabled: false });
        }
      });
      const { data } = await api.post(`/api/admin/voting-sessions/${selectedSessionId}/timer`, { durationMinutes: duration });
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      setTimerDuration(duration.toString());
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
    
    // Clear auto-refresh interval when resetting votes
    if (votingResultsAutoRefreshRef.current) {
      clearInterval(votingResultsAutoRefreshRef.current);
      votingResultsAutoRefreshRef.current = null;
    }
    
    setStatus({ saving: true, message: '', error: '' });
    try {
      await api.post(`/api/admin/voting-sessions/${selectedSessionId}/reset`);
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      // Clear the vote distribution area
      setVotingResults({ results: [], timerEnd: null, totalVotes: 0 });
      setTimerDuration('');
      setCountdown(null);
      setStatus({ saving: false, message: 'Votes reset.', error: '' });
    } catch {
      setStatus({ saving: false, message: '', error: 'Failed to reset votes.' });
    }
  };

  const resetTimer = async () => {
    if (!selectedSessionId) return;
    
    // Clear auto-refresh interval when resetting timer
    if (votingResultsAutoRefreshRef.current) {
      clearInterval(votingResultsAutoRefreshRef.current);
      votingResultsAutoRefreshRef.current = null;
    }
    
    setStatus({ saving: true, message: '', error: '' });
    try {
      await api.post(`/api/admin/voting-sessions/${selectedSessionId}/reset-timer`);
      const { data: sessions } = await api.get('/api/admin/voting-sessions');
      setVotingSessions(sessions);
      setTimerDuration('');
      setCountdown(null);
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
            Assign a group and table to each email address. Registrations will show the group and table that matches their email.
          </p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={addGroup}
              disabled={status.saving}
              className="bg-brand text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              Add Email
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
                    <th className="p-3">Email</th>
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
                        <input
                          value={g.email || ''}
                          onChange={(e) => updateGroup(g.id, 'email', e.target.value)}
                          className="w-full border rounded px-2 py-1"
                          placeholder="email@example.com"
                          type="email"
                        />
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
          <div className="flex justify-between items-center mb-3">
            <button
              onClick={() => setShowAddRegistration(!showAddRegistration)}
              disabled={status.saving}
              className="bg-brand text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
            >
              {showAddRegistration ? 'Cancel' : 'Add Registration'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={refreshRegistrations}
                disabled={status.saving}
                className="bg-brand text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                Refresh
              </button>
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
          </div>
          
          {showAddRegistration && (
            <div className="bg-white rounded-xl p-4 shadow mb-4 space-y-3">
              <h3 className="font-bold text-lg">Add Manual Registration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newRegistration.fullName}
                    onChange={(e) => setNewRegistration({ ...newRegistration, fullName: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newRegistration.email}
                    onChange={(e) => setNewRegistration({ ...newRegistration, email: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="john@example.com"
                    type="email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DSP (optional)
                  </label>
                  <input
                    value={newRegistration.dsp}
                    onChange={(e) => setNewRegistration({ ...newRegistration, dsp: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="DSP Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group (optional)
                  </label>
                  <input
                    value={newRegistration.group}
                    onChange={(e) => setNewRegistration({ ...newRegistration, group: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Group Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Table (optional)
                  </label>
                  <input
                    value={newRegistration.table}
                    onChange={(e) => setNewRegistration({ ...newRegistration, table: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Table Number"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addManualRegistration}
                  disabled={status.saving || !newRegistration.fullName || !newRegistration.email}
                  className="bg-brand text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                >
                  {status.saving ? 'Adding...' : 'Add Registration'}
                </button>
                <button
                  onClick={() => {
                    setShowAddRegistration(false);
                    setNewRegistration({ fullName: '', email: '', dsp: '', group: '', table: '' });
                  }}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
            <h3 className="font-bold text-lg">All Sessions</h3>
            {votingSessions.length === 0 ? (
              <p className="text-gray-500">No sessions yet.</p>
            ) : (
              <div className="space-y-2">
                {votingSessions.map((s) => (
                  <div key={s.id} className="border rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{s.sessionDescription}</p>
                      <p className="text-sm text-gray-500">
                        Created: {new Date(s.createdAt).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        Groups: {s.groups?.length || 0}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteVotingSession(s.id)}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Delete
                    </button>
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
                  onChange={(e) => {
                    const newSessionId = e.target.value;
                    setSelectedSessionId(newSessionId);
                    // Enable the selected session and disable others
                    if (newSessionId) {
                      votingSessions.forEach(session => {
                        updateVotingSession(session.id, { enabled: session.id === newSessionId });
                      });
                    }
                  }}
                  className="border rounded px-2 py-1"
                >
                  {votingSessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.sessionDescription}</option>
                  ))}
                </select>
              </div>
              {(() => {
                if (!selectedSessionId) return null;
                return (
                  <>
                    {localSessionGroups.map((g) => (
                      <div key={g.id} className="border rounded-lg p-3">
                        <div className="flex gap-2 items-center">
                          <input
                            value={g.name}
                            onChange={(e) => updateSessionGroup(selectedSessionId, g.id, 'name', e.target.value)}
                            onBlur={saveSessionGroups}
                            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                            placeholder="Group name"
                          />
                          <button
                            onClick={() => removeSessionGroup(selectedSessionId, g.id)}
                            className="text-red-600 text-sm hover:underline whitespace-nowrap"
                          >
                            Remove
                          </button>
                        </div>
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
                onChange={(e) => {
                  const newSessionId = e.target.value;
                  setSelectedSessionId(newSessionId);
                  if (newSessionId) {
                    votingSessions.forEach(session => {
                      updateVotingSession(session.id, { enabled: session.id === newSessionId });
                    });
                  }
                }}
                className="border rounded px-2 py-1"
              >
                <option value="">Select a session</option>
                {votingSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sessionDescription}
                  </option>
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
                onClick={loadVotingResults}
                disabled={status.saving || !selectedSessionId}
                className="bg-brand text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                Refresh Results
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
                  <div className="space-y-2">
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
                      const percentage = votingResults.totalVotes > 0 
                        ? ((entry.votes / votingResults.totalVotes) * 100).toFixed(1)
                        : 0;
                      return (
                        <div key={entry.id} className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: dellColors[index % dellColors.length] }}
                          />
                          <div className="flex-1">
                            <div className="flex justify-between text-sm">
                              <span>{entry.name}</span>
                              <span>{entry.votes} votes ({percentage}%)</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className="h-2 rounded-full"
                                style={{ 
                                  width: `${percentage}%`,
                                  backgroundColor: dellColors[index % dellColors.length]
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                    {(() => {
                      const session = votingSessions.find((s) => s.id === selectedSessionId);
                      const isTimerEnded = session?.timerEnd && new Date() >= new Date(session.timerEnd);
                      const maxVotes = Math.max(...votingResults.results.map(r => r.votes), 0);
                      
                      return votingResults.results.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-3">
                            {r.name}
                            {isTimerEnded && r.votes > 0 && r.votes === maxVotes && (
                              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-yellow-400 text-yellow-900">
                                🏆 Winner
                              </span>
                            )}
                          </td>
                          <td className="p-3">{r.votes}</td>
                        </tr>
                      ));
                    })()}
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