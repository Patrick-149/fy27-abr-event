import { useEffect, useState } from 'react';
import api from '../api';
import Loading from '../components/Loading';

export default function RestroomMapPage() {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/restrooms')
      .then((res) => setPins(res.data))
      .catch(() => setError('Could not load restroom locations.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="text-red-600 p-4">{error}</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Restroom Locations</h2>
      <div
        className="relative w-full bg-gray-200 rounded-xl overflow-hidden shadow"
        style={{ paddingBottom: '75%' }}
      >
        <img
          src="/floor-plan.svg"
          alt="Venue floor plan"
          className="absolute inset-0 w-full h-full object-contain"
        />
        {pins.map((p) => (
          <button
            key={p.id}
            title={p.name}
            className="absolute w-8 h-8 -ml-4 -mt-4 bg-brand text-white rounded-full text-xs font-bold shadow hover:scale-110 transition flex items-center justify-center"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            R
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-1">
        {pins.map((p) => (
          <li key={p.id} className="text-sm text-gray-700">
            <span className="font-bold text-brand">{p.name}</span> — {p.x}%, {p.y}%
          </li>
        ))}
      </ul>
    </div>
  );
}
