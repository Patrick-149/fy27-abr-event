import { useEffect, useState } from 'react';
import api from '../api';
import Loading from '../components/Loading';

export default function PocContactPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/poc')
      .then((res) => setContacts(res.data))
      .catch(() => setError('Could not load POC contacts.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="text-red-600 p-4">{error}</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">POC Contact</h2>
      <div className="space-y-3">
        {contacts.map((c) => (
          <div key={c.id} className="bg-white rounded-xl p-4 shadow">
            <p className="text-gray-800">
              For <span className="font-semibold">{c.category}</span>: {c.name} - {c.phone}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
