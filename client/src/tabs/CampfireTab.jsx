import { Flame, LogOut, Mail, Shield, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function InfoRow({ Icon, label, value }) {
  return (
    <div className="campfire-info-row">
      <div className="campfire-info-icon"><Icon size={18} strokeWidth={1.4} /></div>
      <div><p className="label-caps">{label}</p><p className="mt-1 text-sm text-[#d4cbbb]">{value || '—'}</p></div>
    </div>
  );
}

export default function CampfireTab() {
  const { user, logout } = useAuth();
  const roleLabel = user?.role === 'DM' ? 'Dungeon Master' : user?.role === 'ADMIN' ? 'Administrador' : 'Aventurero';
  const handleLogout = () => {
    if (window.confirm('¿Seguro que quieres salir del campamento?')) logout();
  };

  return (
    <div className="section-page">
      <p className="section-kicker">Refugio del aventurero</p>
      <h1 className="section-title">Campamento</h1>
      <p className="section-lead">Descansa, revisa tu identidad y prepara el próximo tramo del viaje.</p>
      <div className="section-rule" />

      <div className="campfire-layout">
        <section className="campfire-hero">
          <Flame size={76} strokeWidth={0.8} className="absolute left-1/2 top-24 -translate-x-1/2 text-[#9b4930] drop-shadow-[0_0_35px_rgba(143,40,30,0.45)]" />
          <p className="section-kicker">Hoguera encendida</p>
          <h2 className="mt-2 text-2xl font-medium text-[#d7cbb5]">Bienvenido, {user?.username || 'aventurero'}</h2>
          <p className="mt-3 text-xs leading-6 text-[#777269]">Mientras el fuego siga vivo, siempre habrá un lugar al que regresar.</p>
        </section>

        <section className="campfire-account">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="section-kicker">Registro del viajero</p><h2 className="mt-1 text-xl text-[#d7cbb5]">Tu cuenta</h2></div>
            <div className="app-user-medallion !m-0 !h-11 !w-11">{(user?.username || 'A').slice(0, 1).toUpperCase()}</div>
          </div>
          <InfoRow Icon={User} label="Usuario" value={user?.username} />
          <InfoRow Icon={Mail} label="Correo" value={user?.email} />
          <InfoRow Icon={Shield} label="Rol" value={roleLabel} />
          <button onClick={handleLogout} className="mt-7 flex h-11 w-full items-center justify-center gap-2 border border-[#74352d]/60 bg-[#5b1e18]/10 font-serif text-[10px] uppercase tracking-widest text-[#b45c50] hover:bg-[#5b1e18]/20">
            <LogOut size={15} /> Cerrar sesión
          </button>
        </section>
      </div>
    </div>
  );
}
