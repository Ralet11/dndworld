import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/client'
import { equipItem } from '../../api/inventory'

export default function Inventory(){
  const { id } = useParams()
  const [items, setItems] = useState([])
  const [all, setAll] = useState([])
  const [sel, setSel] = useState('')
  const [qty, setQty] = useState(1)
  const [itemStatus, setItemStatus] = useState({})
  const [portraitUrl, setPortraitUrl] = useState(null)
  const [portraitError, setPortraitError] = useState('')
  const [portraitLoading, setPortraitLoading] = useState(true)
  const isMounted = useRef(true)

  useEffect(()=>{
    return ()=>{ isMounted.current = false }
  },[])

  const load = async()=>{
    try {
      const inv = await api.get(`/characters/${id}/inventory`)
      if (isMounted.current) setItems(inv.data)
    } catch (error) {
      console.error('No se pudo cargar el inventario', error)
    }
    try {
      const ai = await api.get('/items')
      if (isMounted.current) setAll(ai.data)
    } catch (error) {
      console.error('No se pudo cargar el catálogo de ítems', error)
    }
  }

  const updatePortrait = async (silent = false)=>{
    if (!silent && isMounted.current) {
      setPortraitLoading(true)
      setPortraitError('')
    }
    try {
      const res = await api.get(`/characters/${id}`)
      const url = res.data?.Creature?.portrait?.meta?.secureUrl ?? null
      if (isMounted.current) {
        setPortraitUrl(url)
        setPortraitError('')
        if (!silent) setPortraitLoading(false)
      }
      return url
    } catch (error) {
      console.error('No se pudo obtener el retrato', error)
      if (isMounted.current) {
        if (!silent) setPortraitLoading(false)
        setPortraitError('No se pudo cargar el retrato.')
      }
      throw error
    }
  }

  useEffect(()=>{
    if (!isMounted.current) return
    load()
    updatePortrait().catch(()=>{})
  },[id])

  const pollPortraitChange = async (previousUrl)=>{
    const timeoutMs = 20000
    const intervalMs = 2000
    const deadline = Date.now() + timeoutMs
    let lastError = ''
    while (Date.now() < deadline) {
      await new Promise(resolve=>setTimeout(resolve, intervalMs))
      try {
        const nextUrl = await updatePortrait(true)
        if (nextUrl !== previousUrl) {
          return { changed: true, url: nextUrl }
        }
      } catch (error) {
        lastError = 'Error al refrescar el retrato.'
      }
    }
    return { changed: false, error: lastError }
  }

  const add = async()=>{
    await api.post(`/characters/${id}/inventory`, { itemId: sel, qty: Number(qty)||1 })
    load()
  }

  const toggleEquip = async (inventoryItem)=>{
    if (itemStatus[inventoryItem.id]?.pending) return
    const nextValue = !inventoryItem.equipped
    const prevPortrait = portraitUrl
    if (isMounted.current) {
      setItemStatus(prev=>({
        ...prev,
        [inventoryItem.id]: { pending: true, message: 'Actualizando retrato…', error: '' }
      }))
    }
    try {
      await equipItem(inventoryItem.id, nextValue)
      await load()
      const result = await pollPortraitChange(prevPortrait)
      if (!isMounted.current) return
      if (result.changed) {
        setItemStatus(prev=>({
          ...prev,
          [inventoryItem.id]: { pending: false, message: 'Retrato actualizado.', error: '' }
        }))
      } else {
        const errorMessage = result?.error || 'No se detectó un cambio en el retrato.'
        setItemStatus(prev=>({
          ...prev,
          [inventoryItem.id]: { pending: false, message: errorMessage, error: errorMessage }
        }))
      }
    } catch (error) {
      console.error('Error al equipar/unequipar el ítem', error)
      if (!isMounted.current) return
      setItemStatus(prev=>({
        ...prev,
        [inventoryItem.id]: { pending: false, message: 'No se pudo actualizar el ítem.', error: 'No se pudo actualizar el ítem.' }
      }))
      updatePortrait(true).catch(()=>{})
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Inventario</h2>
      <div className="card flex flex-col md:flex-row gap-3 items-center">
        <div className="flex-1">
          <div className="font-semibold">Retrato actual</div>
          {portraitLoading ? (
            <div className="text-sm opacity-70">Cargando retrato…</div>
          ) : portraitUrl ? (
            <div className="mt-2">
              <img src={portraitUrl} alt="Retrato del personaje" className="w-32 h-32 object-cover rounded" />
            </div>
          ) : portraitError ? (
            <div className="text-sm text-red-400">{portraitError}</div>
          ) : (
            <div className="text-sm opacity-70">Sin retrato disponible</div>
          )}
        </div>
      </div>
      <div className="card space-y-2">
        <div className="font-semibold">Agregar</div>
        <div className="grid grid-cols-3 gap-2">
          <select value={sel} onChange={e=>setSel(e.target.value)}><option value="">Ítem…</option>{all.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select>
          <input type="number" value={qty} onChange={e=>setQty(e.target.value)} />
          <button className="btn" onClick={add} disabled={!sel}>Añadir</button>
        </div>
      </div>
      <div className="card">
        <div className="font-semibold mb-2">Tus ítems</div>
        <div className="grid md:grid-cols-3 gap-3">
          {items.map(it=>(
            <div key={it.id} className="border border-slate-700 rounded p-3">
              <div className="font-semibold">{it.Item?.name}</div>
              <div className="text-sm opacity-70">x{it.qty}</div>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  className="btn"
                  disabled={!!itemStatus[it.id]?.pending}
                  onClick={()=>toggleEquip(it)}
                >
                  {it.equipped ? 'Quitar' : 'Equipar'}
                </button>
                {itemStatus[it.id]?.message && (
                  <div className={`text-xs ${itemStatus[it.id]?.error ? 'text-red-400' : 'text-emerald-400'}`}>
                    {itemStatus[it.id].message}
                  </div>
                )}
              </div>
            </div>
          ))}
          {items.length===0 && <div className="opacity-70">Vacío</div>}
        </div>
      </div>
    </div>
  )
}
