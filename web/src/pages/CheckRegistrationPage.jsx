import { useState } from 'react';
import api from '../api';

export default function CheckRegistrationPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const checkRegistration = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { data } = await api.post('/api/check-registration', { email });
      setResult(data);
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to check registration';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Check Registration</h2>
      <p className="text-gray-600 mb-4">
        Enter your email address to check your assigned group and table.
      </p>
      <form onSubmit={checkRegistration} className="bg-white rounded-2xl p-5 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2"
            placeholder="your.email@example.com"
          />
        </div>
        {error && (
          <div className="text-red-600 bg-red-50 p-3 rounded">{error}</div>
        )}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <div className="font-semibold text-green-800">Registration Found</div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">Name:</span> {result.fullName}
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">DSP:</span> {result.dsp}
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">Group:</span> {result.group || 'Not assigned'}
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">Table:</span> {result.table || 'Not assigned'}
            </div>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-white py-2.5 rounded-lg font-semibold hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Registration'}
        </button>
      </form>
    </div>
  );
}