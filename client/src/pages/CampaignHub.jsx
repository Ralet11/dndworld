import { useEffect, useState } from 'react';
import { Compass, Plus, Shield, Swords } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../config';
import { useAuth } from '../context/AuthContext';
import { useCampaign } from '../context/CampaignContext';

export default function CampaignHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { campaigns, refresh, selectCampaign } = useCampaign();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [managedCampaignId, setManagedCampaignId] = useState(null);
  const superAdmin = user?.role === 'ADMIN';
  const chooseCampaign = next => {
    selectCampaign(next);
    navigate(user?.role === 'DM' || user?.role === 'ADMIN' ? '/dm' : '/chronicles');
  };
  const loadUsers = async () => {
    const response = await fetch(`${API_URL}/api/campaigns/users`, { headers: { Authorization: `Bearer ${localStorage.getItem('dnd_token')}` } });
    const data = await response.json();
    if (response.ok) setUsers(data.users || []);
  };
  useEffect(() => { if (superAdmin) loadUsers(); }, [superAdmin]);
  const changeRole = async (target, role) => {
    const response = await fetch(`${API_URL}/api/campaigns/users/${target.id}/role`, { method: 'PUT', headers: { Authorization: `Bearer ${localStorage.getItem('dnd_token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
    const data = await response.json();
    if (!response.ok) return setError(data.message || 'No se pudo actualizar el rol.');
    await loadUsers();
  };
  const assignDm = async target => {
    const campaignId = managedCampaignId;
    if (!campaignId) return;
    const response = await fetch(`${API_URL}/api/campaigns/${campaignId}/members/${target.id}`, { method: 'PUT', headers: { Authorization: `Bearer ${localStorage.getItem('dnd_token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'DM' }) });
    const data = await response.json();
    if (!response.ok) setError(data.message || 'No se pudo asignar el DM.');
    else setError('');
  };
  const create = async event => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(`${API_URL}/api/campaigns`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('dnd_token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      await refresh(); chooseCampaign(data.campaign);
    } catch (createError) { setError(createError.message || 'No se pudo crear la campaña.'); } finally { setSaving(false); }
  };
  return <main className="auth-shell"><section className="auth-card max-w-2xl !w-full"><div className="text-center mb-8"><div className="auth-emblem"><Compass size={31} /></div><p className="label-caps mb-2 text-[#a9864c]">D&D World</p><h1>Mis campañas</h1><p className="auth-subtitle">Elige una campaña autorizada para continuar.</p></div>
    <div className="grid gap-3">{campaigns.map(item => <div key={item.id} className="p-4 border border-[#493a22] bg-[#0f1518]"><button onClick={() => chooseCampaign(item)} className="w-full text-left"><div className="flex justify-between gap-4"><strong className="font-serif text-[#e2d2ae]">{item.name}</strong><span className="text-xs text-[#c2a269] flex items-center gap-1">{item.membershipRole === 'SUPER_ADMIN' ? <Shield size={13} /> : <Swords size={13} />}{item.membershipRole === 'SUPER_ADMIN' ? 'Super Admin' : item.membershipRole}</span></div>{item.description && <small className="block mt-2 text-[#8e897e]">{item.description}</small>}</button>{superAdmin && <button type="button" onClick={() => setManagedCampaignId(managedCampaignId === item.id ? null : item.id)} className="mt-3 text-xs text-[#c2a269]">{managedCampaignId === item.id ? 'Cerrar administración' : 'Asignar DMs'}</button>}{superAdmin && managedCampaignId === item.id && <div className="mt-3 pt-3 border-t border-[#493a22] space-y-2"><small className="block text-[#8e897e]">Sólo los DMs autorizados pueden dirigir esta campaña.</small>{users.filter(target => target.role === 'DM').map(target => <div className="flex justify-between text-xs" key={target.id}><span>{target.username}</span><button type="button" className="text-[#c2a269]" onClick={() => assignDm(target)}>Asignar como DM</button></div>)}{!users.some(target => target.role === 'DM') && <small className="text-[#8e897e]">Primero habilita un usuario como DM abajo.</small>}</div>}</div>)}{!campaigns.length && <p className="text-center text-sm text-[#8e897e]">No tienes campañas asignadas.</p>}</div>
    {superAdmin && <form onSubmit={create} className="mt-6 pt-5 border-t border-[#493a22]"><label className="label-caps block mb-2">Nueva campaña</label><div className="flex gap-2"><input className="input-base flex-1" value={name} onChange={event => setName(event.target.value)} placeholder="Nombre de la campaña" /><button className="auth-submit !w-auto px-4" disabled={saving}><Plus size={16} /> Crear</button></div>{error && <p className="text-xs mt-2 text-[#b95246]">{error}</p>}</form>}
    {superAdmin && <section className="mt-6 pt-5 border-t border-[#493a22]"><label className="label-caps block mb-3">Directores autorizados</label><div className="space-y-2">{users.filter(target => target.role !== 'ADMIN').map(target => <div key={target.id} className="flex items-center justify-between text-xs"><span>{target.username} <small className="text-[#8e897e]">· {target.email}</small></span><button type="button" onClick={() => changeRole(target, target.role === 'DM' ? 'PLAYER' : 'DM')} className="text-[#c2a269]">{target.role === 'DM' ? 'Quitar DM' : 'Habilitar DM'}</button></div>)}</div></section>}
  </section></main>;
}
