import { useState } from 'react';
import api from '../api';
import FormInput from '../components/FormInput';

const COUNTRIES = ['Bangladesh', 'Malaysia', 'Pakistan', 'Singapore', 'Sri Lanka', 'Thailand', 'Vietnam'];
const DSPS = ['1000Fix', 'CTC', 'Digipro', 'Inbox', 'ISS', 'NCR', 'Soft Logic', 'SOG', 'SVOA'];

export default function RegistrationPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    country: '',
    dsp: ''
  });
  const [status, setStatus] = useState({
    loading: false,
    error: '',
    success: ''
  });

  const change = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
  };

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: '', success: '' });
    try {
      await api.post('/api/register', form);
      setStatus({
        loading: false,
        error: '',
        success: 'Registration submitted successfully!'
      });
      setForm({ fullName: '', email: '', country: '', dsp: '' });
    } catch {
      setStatus({
        loading: false,
        error: 'Could not submit. Please try again.',
        success: ''
      });
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Registration Form</h2>
      {status.error && (
        <div className="mb-4 text-red-600 bg-red-50 p-3 rounded">{status.error}</div>
      )}
      {status.success && (
        <div className="mb-4 text-green-700 bg-green-50 p-3 rounded">{status.success}</div>
      )}
      <form onSubmit={submit} className="bg-white rounded-2xl p-5 shadow space-y-1">
        <FormInput
          label="Full Name"
          value={form.fullName}
          onChange={change('fullName')}
          required
        />
        <FormInput
          label="Email"
          type="email"
          value={form.email}
          onChange={change('email')}
          required
        />
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Country <span className="text-red-500">*</span>
          </label>
          <select
            value={form.country}
            onChange={change('country')}
            required
            className="mt-1 w-full border rounded-lg px-3 py-2"
          >
            <option value="">Select a country</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700">
            DSP <span className="text-red-500">*</span>
          </label>
          <select
            value={form.dsp}
            onChange={change('dsp')}
            required
            className="mt-1 w-full border rounded-lg px-3 py-2"
          >
            <option value="">Select a DSP</option>
            {DSPS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={status.loading}
          className="w-full bg-brand text-white py-2.5 rounded-lg font-semibold hover:bg-brand-dark disabled:opacity-50"
        >
          {status.loading ? 'Submitting...' : 'Submit Registration'}
        </button>
      </form>
    </div>
  );
}
