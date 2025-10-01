import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/client'

export default function ScenarioDetail(){
  const { id } = useParams()
  const [scenario, setScenario] = useState(null)
  const [layers, setLayers] = useState([])
  const [layerForm, setLayerForm] = useState({ layerType: 'IMAGE', sortOrder: 0, imageAssetId: '', audioAssetId: '', notes: '' })
  const [mapForm, setMapForm] = useState({ gridSize: 50, widthCells: 20, heightCells: 14, backgroundAssetId: '' })

  const load = ()=>{
    api.get(`/scenarios/${id}`).then(r=>setScenario(r.data))
    api.get(`/scenarios/${id}/layers`).then(r=>setLayers(r.data))
  }
  useEffect(()=>{ load() },[id])

  const addLayer = async ()=>{
    const r = await api.post(`/scenarios/${id}/layers`, layerForm)
    if (r.data.layerType==='TACTICAL'){
      await api.post(`/scenarios/layers/${r.data.id}/map`, mapForm)
    }
    setLayerForm({ layerType:'IMAGE', sortOrder:0, imageAssetId:'', audioAssetId:'', notes:'' })
    load()
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">{scenario?.name || 'Escenario'}</h2>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="card space-y-2">
          <div className="font-semibold">Capas</div>
          {layers.length===0 && <div className="opacity-70 text-sm">Aún no hay capas.</div>}
          {layers.map(l=>(
            <div key={l.id} className="border-b border-slate-700 pb-2 mb-2">
              <div className="text-sm opacity-70">{l.layerType} · Orden {l.sortOrder}</div>
              <div className="text-sm">{l.notes}</div>
            </div>
          ))}
        </div>
        <div className="card space-y-2">
          <div className="font-semibold">Nueva capa</div>
          <select value={layerForm.layerType} onChange={e=>setLayerForm(f=>({...f,layerType:e.target.value}))}><option>IMAGE</option><option>TACTICAL</option></select>
          <input type="number" placeholder="Orden" value={layerForm.sortOrder} onChange={e=>setLayerForm(f=>({...f,sortOrder:Number(e.target.value)}))} />
          <input placeholder="imageAssetId (opcional)" value={layerForm.imageAssetId} onChange={e=>setLayerForm(f=>({...f,imageAssetId:e.target.value}))} />
          <input placeholder="audioAssetId (opcional)" value={layerForm.audioAssetId} onChange={e=>setLayerForm(f=>({...f,audioAssetId:e.target.value}))} />
          <textarea rows="3" placeholder="Notas" value={layerForm.notes} onChange={e=>setLayerForm(f=>({...f,notes:e.target.value}))}></textarea>
          {layerForm.layerType==='TACTICAL' && (
            <div className="grid grid-cols-3 gap-2">
              <input type="number" placeholder="gridSize" value={mapForm.gridSize} onChange={e=>setMapForm(f=>({...f,gridSize:Number(e.target.value)}))} />
              <input type="number" placeholder="widthCells" value={mapForm.widthCells} onChange={e=>setMapForm(f=>({...f,widthCells:Number(e.target.value)}))} />
              <input type="number" placeholder="heightCells" value={mapForm.heightCells} onChange={e=>setMapForm(f=>({...f,heightCells:Number(e.target.value)}))} />
            </div>
          )}
          <button className="btn" onClick={addLayer}>Añadir capa</button>
        </div>
      </div>
    </div>
  )
}
