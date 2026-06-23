import { Flame, User, Mail, Shield, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function InfoRow({ Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: '#1E2A28', border: '1px solid #2A332F' }}>
        <Icon size={18} style={{ color: '#C8A36A' }} />
      </div>
      <div>
        <p className="label-caps">{label}</p>
        <p className="text-sm font-semibold mt-0.5" style={{ color: '#EDE6D8' }}>{value || '—'}</p>
      </div>
    </div>
  );
}

export default function CampfireTab() {
  const { user, logout } = useAuth();

  const roleLabel = user?.role === 'DM'
    ? 'Dungeon Master'
    : user?.role === 'ADMIN'
    ? 'Administrador'
    : 'Aventurero';

  const handleLogout = () => {
    if (window.confirm('¿Seguro que querés salir del campamento?')) logout();
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      {/* ── DESKTOP: 2-column layout ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start gap-8">

        {/* Left: flame hero */}
        <div className="flex flex-col items-center md:items-start gap-4 md:w-64 shrink-0">
          <div
            className="w-[88px] h-[88px] rounded-full flex items-center justify-center"
            style={{
              background: '#16211F',
              border: '1.5px solid #8A6A3B',
              boxShadow: '0 0 24px rgba(255,122,26,0.2)',
            }}
          >
            <Flame size={40} style={{ color: '#FF7A1A' }} />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-black" style={{ color: '#EDE6D8' }}>Campamento</h1>
            <p className="text-sm mt-1" style={{ color: '#A89F8E' }}>
              Descansa, {user?.username || 'aventurero'}.
            </p>
          </div>

          {/* Logout — visible beside hero on desktop */}
          <button
            onClick={handleLogout}
            className="hidden md:flex w-full h-11 rounded-lg font-black items-center justify-center gap-2 mt-4"
            style={{ background: 'rgba(194,69,47,0.15)', border: '1px solid rgba(194,69,47,0.4)', color: '#C2452F' }}
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>

        {/* Right: account panel */}
        <div className="flex-1">
          <p className="label-caps px-1 mb-2" style={{ color: '#6B6557' }}>Tu cuenta</p>
          <div className="rounded-xl overflow-hidden" style={{ background: '#16211F', border: '1px solid #2A332F' }}>
            <div className="px-4">
              <InfoRow Icon={User}   label="Usuario" value={user?.username} />
              <div style={{ height: 1, background: '#2A332F' }} />
              <InfoRow Icon={Mail}   label="Email"   value={user?.email} />
              <div style={{ height: 1, background: '#2A332F' }} />
              <InfoRow Icon={Shield} label="Rol"     value={roleLabel} />
            </div>
          </div>
        </div>
      </div>

      {/* Logout — mobile only */}
      <button
        onClick={handleLogout}
        className="flex md:hidden w-full h-12 rounded-lg font-black items-center justify-center gap-2 mt-8"
        style={{ background: 'rgba(194,69,47,0.15)', border: '1px solid rgba(194,69,47,0.4)', color: '#C2452F' }}
      >
        <LogOut size={18} />
        Cerrar sesión
      </button>
    </div>
  );
}
