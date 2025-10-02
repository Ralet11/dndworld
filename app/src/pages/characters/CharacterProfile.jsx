import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api/client'

const EMPTY_FORM = {
  background: '',
  goalsShort: '',
  goalsLong: '',
  fears: ''
}

function extractProfile(payload){
  if (!payload) return null
  if (payload.profile) return payload.profile
  const creature = payload.Creature || {}
  const inventories = payload.CharacterInventories || []
  return {
    id: payload.id,
    name: creature.name,
    level: creature.level,
    alignment: creature.alignment,
    race: creature.Race || null,
    class: creature.Class || null,
    portrait: creature.portrait || null,
    background: creature.background || '',
    goalsShort: creature.goalsShort || '',
    goalsLong: creature.goalsLong || '',
    fears: creature.fears || '',
    equipment: inventories.filter(it=>it.equipped).map(it=>({
      id: it.id,
      qty: it.qty,
      item: it.Item
    })),
    activity: []
  }
}

export default function CharacterProfile(){
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = async()=>{
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/characters/${id}`)
      setData(res.data)
    } catch (err) {
      console.error('No se pudo cargar el perfil del personaje', err)
      setError('No se pudo cargar el perfil del personaje.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() }, [id])

  const profile = useMemo(()=>extractProfile(data), [data])
  const isOwner = Boolean(data?.meta?.canEdit)

  useEffect(()=>{
    if (!profile || !isOwner) return
    setForm({
      background: profile.background ?? '',
      goalsShort: profile.goalsShort ?? '',
      goalsLong: profile.goalsLong ?? '',
      fears: profile.fears ?? ''
    })
  },[profile, isOwner])

  const portraitUrl = profile?.portrait?.meta?.secureUrl ?? null

  const handleChange = (field)=>(event)=>{
    const value = event.target.value
    setForm(prev=>({ ...prev, [field]: value }))
  }

  const handleSave = async()=>{
    setSaving(true)
    try {
      await api.patch(`/characters/${id}`, {
        background: form.background,
        goalsShort: form.goalsShort,
        goalsLong: form.goalsLong,
        fears: form.fears
      })
      await load()
      setEditing(false)
    } catch (err) {
      console.error('No se pudo actualizar el personaje', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Cargando perfil…</div>
  if (error) return <div className="text-red-400">{error}</div>
  if (!profile) return <div>No se encontró el personaje.</div>

  const equipment = profile.equipment || []
  const activity = profile.activity || []

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="h-48 w-full overflow-hidden rounded-xl bg-slate-900">
          {portraitUrl ? (
            <img src={portraitUrl} alt={`Portada de ${profile.name ?? 'personaje'}`} className="h-full w-full object-cover opacity-60" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm opacity-70">
              Sin portada disponible
            </div>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="h-28 w-28 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
              {portraitUrl ? (
                <img src={portraitUrl} alt={`Retrato de ${profile.name ?? 'personaje'}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs opacity-70">Sin retrato</div>
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">{profile.name}</h1>
              <div className="text-sm opacity-80">
                {profile.level ? `Nivel ${profile.level}` : 'Nivel desconocido'}
              </div>
              <div className="text-xs uppercase tracking-wide opacity-60">
                {[profile.race?.name, profile.class?.name, profile.alignment].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/personajes" className="btn">Volver</Link>
            {isOwner && (
              <>
                <Link to={`/personajes/${id}`} className="btn">Panel privado</Link>
                <Link to={`/personajes/${id}/talentos`} className="btn">Talentos</Link>
                <Link to={`/personajes/${id}/mazo`} className="btn">Mazo</Link>
                <Link to={`/personajes/${id}/inventario`} className="btn">Inventario</Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Acerca de</h2>
              {isOwner && (
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <button className="btn" onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
                      <button className="btn" type="button" onClick={()=>{ setEditing(false); setForm({
                        background: profile.background ?? '',
                        goalsShort: profile.goalsShort ?? '',
                        goalsLong: profile.goalsLong ?? '',
                        fears: profile.fears ?? ''
                      }) }}>Cancelar</button>
                    </>
                  ) : (
                    <button className="btn" type="button" onClick={()=>setEditing(true)}>Editar</button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-3 text-sm">
              <section>
                <h3 className="font-semibold uppercase tracking-wide text-slate-300">Historia</h3>
                {editing ? (
                  <textarea className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2" rows={4} value={form.background} onChange={handleChange('background')} />
                ) : (
                  <p className="mt-1 whitespace-pre-line opacity-80">{profile.background || 'Sin descripción disponible.'}</p>
                )}
              </section>
              <section>
                <h3 className="font-semibold uppercase tracking-wide text-slate-300">Objetivos a corto plazo</h3>
                {editing ? (
                  <textarea className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2" rows={2} value={form.goalsShort} onChange={handleChange('goalsShort')} />
                ) : (
                  <p className="mt-1 whitespace-pre-line opacity-80">{profile.goalsShort || 'Sin objetivos inmediatos.'}</p>
                )}
              </section>
              <section>
                <h3 className="font-semibold uppercase tracking-wide text-slate-300">Visión a largo plazo</h3>
                {editing ? (
                  <textarea className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2" rows={3} value={form.goalsLong} onChange={handleChange('goalsLong')} />
                ) : (
                  <p className="mt-1 whitespace-pre-line opacity-80">{profile.goalsLong || 'Sin planes a largo plazo.'}</p>
                )}
              </section>
              {isOwner && profile.fears !== undefined && (
                <section>
                  <h3 className="font-semibold uppercase tracking-wide text-slate-300">Temores</h3>
                  {editing ? (
                    <textarea className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2" rows={2} value={form.fears} onChange={handleChange('fears')} />
                  ) : (
                    <p className="mt-1 whitespace-pre-line opacity-80">{profile.fears || 'Sin temores registrados.'}</p>
                  )}
                </section>
              )}
            </div>
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Equipamiento visible</h2>
              {equipment.length > 0 && <span className="text-xs uppercase tracking-wide opacity-60">{equipment.length} ítem(s)</span>}
            </div>
            {equipment.length === 0 ? (
              <div className="text-sm opacity-70">No hay equipamiento público.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {equipment.map(it=>(
                  <div key={it.id} className="rounded border border-slate-700 bg-slate-950 p-3">
                    <div className="font-semibold">{it.item?.name ?? 'Ítem desconocido'}</div>
                    <div className="text-xs opacity-60">x{it.qty}</div>
                    {it.item?.description && (
                      <p className="mt-2 text-xs opacity-80 line-clamp-3">{it.item.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="text-lg font-semibold">Actividad reciente</h2>
            {activity.length === 0 ? (
              <div className="text-sm opacity-70">Sin actividad para mostrar.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {activity.map(entry=>(
                  <li key={entry.id} className="rounded border border-slate-700 bg-slate-950 p-3">
                    <div className="font-semibold">{entry.label}</div>
                    {entry.timestamp && (
                      <div className="text-xs opacity-60">{new Date(entry.timestamp).toLocaleString()}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!isOwner && (
            <div className="card text-sm opacity-80">
              Esta es una versión pública del perfil de {profile.name ?? 'este personaje'}. Algunos detalles pueden estar ocultos para proteger la privacidad del jugador.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

