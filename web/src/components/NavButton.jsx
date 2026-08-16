import { useNavigate } from 'react-router-dom';

export default function NavButton({ to, label, color = 'bg-brand' }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      className={`${color} text-white rounded-2xl p-6 flex items-center justify-center shadow hover:brightness-110 active:scale-95 transition min-h-[120px]`}
    >
      <span className="font-semibold text-xl text-center leading-tight">{label}</span>
    </button>
  );
}
