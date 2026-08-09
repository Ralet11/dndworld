import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Music2, Pause, Play, Repeat2, Search, Square, Trash2, Upload, X } from 'lucide-react';
import API_URL from '../config';

export default function GameAudioControl({ session, socket, onError }) {
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Ambiente');
  const fileRef = useRef(null);
  const token = localStorage.getItem('dnd_token');

  const loadTracks = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/audio/tracks`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setTracks(Array.isArray(data) ? data : []);
    } catch (error) { onError(error.message || 'No se pudo cargar el audio.'); }
  }, [onError, token]);

  useEffect(() => { if (open) loadTracks(); }, [loadTracks, open]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return tracks.filter(track => !query || `${track.name} ${track.category}`.toLocaleLowerCase('es').includes(query));
  }, [search, tracks]);

  const command = (action, extra = {}) => socket.timeout(6000).emit('game:update-audio', { sessionId: session.id, action, ...extra }, (timeoutError, response) => {
    if (timeoutError || !response?.ok) onError(response?.message || 'No se pudo controlar el audio.');
  });

  const upload = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('audio', file);
      form.append('name', name.trim() || file.name.replace(/\.[^.]+$/, ''));
      form.append('category', category.trim() || 'Ambiente');
      const response = await fetch(`${API_URL}/api/audio/tracks`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setTracks(current => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
    } catch (error) { onError(error.message || 'No se pudo subir el audio.'); }
    finally { setUploading(false); }
  };

  const remove = async track => {
    if (!window.confirm(`¿Eliminar “${track.name}” de la biblioteca?`)) return;
    try {
      const response = await fetch(`${API_URL}/api/audio/tracks/${track.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setTracks(current => current.filter(item => item.id !== track.id));
    } catch (error) { onError(error.message || 'No se pudo eliminar el tema.'); }
  };

  return (
    <div className="game-dm-audio">
      <button type="button" className={session.audio_status === 'PLAYING' ? 'is-playing' : ''} onClick={() => setOpen(current => !current)} title="Música de la partida">
        <Music2 size={12} /><span>{session.audioTrack?.name || 'Música'}</span>{session.audio_status === 'PLAYING' && <i />}
      </button>
      {open && <div className="game-audio-popover">
        <header><div><small>Sonido de la mesa</small><strong>{session.audioTrack?.name || 'Sin tema seleccionado'}</strong></div><button onClick={() => setOpen(false)}><X size={14} /></button></header>
        <div className="game-audio-transport">
          <button disabled={!session.audioTrack} onClick={() => command(session.audio_status === 'PLAYING' ? 'PAUSE' : 'PLAY')}>{session.audio_status === 'PLAYING' ? <Pause size={15} /> : <Play size={15} />}</button>
          <button disabled={!session.audioTrack} onClick={() => command('STOP')}><Square size={13} /></button>
          <button className={session.audio_loop ? 'is-active' : ''} disabled={!session.audioTrack} onClick={() => command('LOOP', { loop: !session.audio_loop })}><Repeat2 size={14} /> Repetir</button>
        </div>
        <label className="game-audio-search"><Search size={12} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre..." /></label>
        <div className="game-audio-list">
          {filtered.map(track => <article key={track.id} className={session.audio_track_id === track.id ? 'is-active' : ''}>
            <button onClick={() => command('SELECT', { trackId: track.id })}><span>{session.audio_track_id === track.id ? <Check size={11} /> : <Music2 size={11} />}</span><div><strong>{track.name}</strong><small>{track.category}</small></div></button>
            <button className="is-delete" onClick={() => remove(track)} aria-label={`Eliminar ${track.name}`}><Trash2 size={11} /></button>
          </article>)}
          {!filtered.length && <p>No hay temas en esta búsqueda.</p>}
        </div>
        <div className="game-audio-upload">
          <div><input value={name} onChange={event => setName(event.target.value)} placeholder="Nombre del tema" /><input value={category} onChange={event => setCategory(event.target.value)} placeholder="Categoría" /></div>
          <button disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <i /> : <Upload size={13} />}{uploading ? 'Subiendo...' : 'Subir audio'}</button>
          <input ref={fileRef} hidden type="file" accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/aac,audio/flac" onChange={upload} />
        </div>
      </div>}
    </div>
  );
}
