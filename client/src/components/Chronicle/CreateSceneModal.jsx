import { useState } from 'react';
import { X, ImageIcon } from 'lucide-react';
import API_URL from '../../config';

export default function CreateSceneModal({ socket, onClose }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.url) setImageUrl(data.url);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    socket.emit('create-scene', { title: title.trim(), description: description.trim(), imageUrl });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="panel-raised w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-black text-lg" style={{ color: '#EDE6D8' }}>Nueva escena</h2>
          <button onClick={onClose} style={{ color: '#6B6557' }}><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <input
            className="input-base"
            placeholder="Título de la escena"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="input-base resize-none"
            rows={3}
            placeholder="Descripción..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          {imageUrl ? (
            <div className="relative h-32 rounded-lg overflow-hidden">
              <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
              <button
                onClick={() => setImageUrl('')}
                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.7)' }}>
                <X size={14} style={{ color: '#EDE6D8' }} />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 h-20 rounded-lg cursor-pointer transition-colors"
              style={{ border: '1px dashed #2A332F', color: '#6B6557' }}>
              {uploading
                ? <div className="w-5 h-5 border-2 border-bronze-light border-t-transparent rounded-full animate-spin" />
                : <><ImageIcon size={18} /><span className="text-sm">Subir imagen</span></>}
              <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
            </label>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-bold"
            style={{ background: '#1E2A28', color: '#A89F8E', border: '1px solid #2A332F' }}>
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim()}
            className="flex-1 py-2.5 rounded-lg text-sm font-black disabled:opacity-50"
            style={{ background: '#FF7A1A', color: '#1A0E04' }}>
            Crear escena
          </button>
        </div>
      </div>
    </div>
  );
}
