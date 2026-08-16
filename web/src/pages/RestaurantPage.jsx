import { useEffect, useState } from 'react';
import api from '../api';
import Loading from '../components/Loading';

export default function RestaurantPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/restaurant')
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load restaurant information.'))
      .finally(() => setLoading(false));
  }, []);

  const downloadMenu = async () => {
    try {
      const response = await api.get('/api/restaurant/menu', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: response.data.type || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', data.menuName || 'menu');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Could not download menu.');
    }
  };

  if (loading) return <Loading />;
  if (error || !data) return <div className="text-red-600 p-4">{error || 'No data'}</div>;

  return (
    <div>
      <h2 className="text-2xl text-gray-900 mb-2 font-normal">
        Restaurant: <span className="font-bold">{data.name}</span>
      </h2>
      <div className="space-y-2 text-gray-700">
        <p>
          <span className="font-semibold">Location:</span> {data.location}
        </p>
        <p>
          <span className="font-semibold">Timing:</span> {data.timing}
        </p>
      </div>
      <button
        onClick={downloadMenu}
        disabled={!data.menuFile}
        className="mt-6 w-full bg-brand text-white py-2.5 rounded-lg font-semibold disabled:opacity-50"
      >
        Download Menu
      </button>
      {!data.menuFile && (
        <p className="text-sm text-gray-500 mt-2">Menu will be available once uploaded.</p>
      )}
    </div>
  );
}
