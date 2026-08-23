import { useState, useEffect } from 'react';
import api from '../api';

export default function VotingPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [status, setStatus] = useState({ loading: false, error: '', success: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/api/voting/config');
        setConfig(data);
      } catch {
        setStatus({ loading: false, error: 'Failed to load voting config.', success: '' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: '', success: '' });
    try {
      await api.post('/api/voting/submit', { email, groupId: selectedGroupId });
      setStatus({
        loading: false,
        error: '',
        success: 'Your vote has been submitted successfully!'
      });
      setEmail('');
      setSelectedGroupId('');
    } catch (err) {
      setStatus({
        loading: false,
        error: err.response?.data?.message || 'Failed to submit vote.',
        success: ''
      });
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  if (!config?.enabled) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Voting</h2>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg">
          Voting is not available at this time.
        </div>
      </div>
    );
  }

  const isVotingOpen = config.timerEnd && new Date() < new Date(config.timerEnd);
  const isTimerStarted = !!config.timerEnd;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Voting</h2>
      {config.sessionDescription && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-4">
          {config.sessionDescription}
        </div>
      )}
      {!isTimerStarted && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mb-4">
          Voting has not started yet. Please wait for the admin to start the timer.
        </div>
      )}
      {isTimerStarted && !isVotingOpen && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg mb-4">
          Voting has ended.
        </div>
      )}
      <form onSubmit={submit} className="bg-white rounded-2xl p-5 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select a team to vote for
          </label>
          <div className="space-y-2">
            {config.groups.map((g) => (
              <label key={g.id} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="group"
                  value={g.id}
                  checked={selectedGroupId === g.id}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  disabled={!isVotingOpen}
                  className="mr-3"
                />
                <div className="flex-1">
                  <span className="font-medium">{g.name}</span>
                  {g.description && (
                    <p className="text-sm text-gray-600 mt-1">{g.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email (must match your registration)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={!isVotingOpen}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="your.email@example.com"
          />
        </div>
        {status.error && (
          <div className="text-red-600 bg-red-50 p-3 rounded">{status.error}</div>
        )}
        {status.success && (
          <div className="text-green-700 bg-green-50 p-3 rounded">{status.success}</div>
        )}
        <button
          type="submit"
          disabled={status.loading || !isVotingOpen}
          className="w-full bg-brand text-white py-2.5 rounded-lg font-semibold hover:bg-brand-dark disabled:opacity-50"
        >
          {status.loading ? 'Submitting...' : 'Submit Vote'}
        </button>
      </form>
    </div>
  );
}
