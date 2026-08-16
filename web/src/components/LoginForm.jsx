import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import FormInput from './FormInput';

export default function LoginForm({ admin = false }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password, admin);
      navigate(admin ? '/admin' : '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-2xl shadow w-full max-w-sm"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-1">
        {admin ? 'Admin Login' : 'FY27 ABR'}
      </h2>
      <p className="text-gray-500 mb-6">
        {admin ? 'Event management' : 'Please sign in to continue'}
      </p>
      {error && (
        <div className="mb-4 text-red-600 text-sm bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      <FormInput
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoComplete="username"
      />
      <FormInput
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete={admin ? 'current-password' : 'current-password'}
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand text-white py-2.5 rounded-lg font-semibold hover:bg-brand-dark disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
