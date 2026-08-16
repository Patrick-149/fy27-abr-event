import { useEffect, useState } from 'react';
import api from '../api';
import Loading from '../components/Loading';

export default function MeetingSchedulePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/schedule')
      .then((res) => setItems(res.data))
      .catch(() => setError('Could not load schedule.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="text-red-600 p-4">{error}</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Meeting Schedule</h2>
      <div className="space-y-3">
        {items.map((s) => (
          <div key={s.id} className="bg-white rounded-xl p-4 shadow">
            <div className="flex justify-between items-start gap-3">
              <div className="font-bold text-lg">{s.topic}</div>
              <span className="bg-brand text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                {s.duration}
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Presenter: {s.presenter || 'TBA'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
