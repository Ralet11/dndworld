import { useState, useEffect, useRef } from 'react';
import { Upload, X, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import API_URL from '../config';

export default function MediaPanel() {
  const { socket } = useSocket();
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [sharedMedia, setSharedMedia] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('init', (data) => {
      if (data.sharedMedia) setSharedMedia(data.sharedMedia);
    });

    socket.on('image-shared', (img) => {
      setSharedMedia(prev => [img, ...prev]);
      setIsSharing(true);
    });

    socket.on('image-sharing-stopped', () => {
      setIsSharing(false);
    });

    return () => {
      socket.off('init');
      socket.off('image-shared');
      socket.off('image-sharing-stopped');
    };
  }, [socket]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.url) setImageUrl(data.url);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleShare = () => {
    if (!imageUrl) return;
    socket.emit('share-image', { url: imageUrl, caption });
    setImageUrl('');
    setCaption('');
  };

  const handleStopSharing = () => {
    socket.emit('stop-sharing-image');
    setIsSharing(false);
  };

  const handleReshare = (media) => {
    socket.emit('share-image', media);
    setIsSharing(true);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="mb-6">
        <p className="label-caps">Herramienta DM</p>
        <h1 className="text-3xl font-black mt-1" style={{ color: '#EDE6D8' }}>Media</h1>
        <p className="text-sm mt-1" style={{ color: '#A89F8E' }}>Compartí imágenes con los jugadores en tiempo real</p>
      </div>

      {/* Sharing status */}
      {isSharing && (
        <div className="panel flex items-center gap-3 p-3 mb-4"
          style={{ borderColor: 'rgba(91,168,107,0.4)', background: 'rgba(91,168,107,0.08)' }}>
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-sm font-bold" style={{ color: '#5BA86B' }}>Compartiendo imagen con los jugadores</span>
          <button onClick={handleStopSharing}
            className="ml-auto flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(194,69,47,0.15)', border: '1px solid rgba(194,69,47,0.4)', color: '#C2452F' }}>
            <EyeOff size={14} /> Dejar de compartir
          </button>
        </div>
      )}

      {/* Upload + share */}
      <div className="panel p-5 space-y-4 mb-6">
        <h2 className="font-black text-sm" style={{ color: '#EDE6D8' }}>Subir y compartir</h2>

        {/* Image preview or upload area */}
        {imageUrl ? (
          <div className="relative h-48 rounded-xl overflow-hidden">
            <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
            <button onClick={() => setImageUrl('')}
              className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.7)', color: '#EDE6D8' }}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 h-40 rounded-xl cursor-pointer transition-colors"
            style={{ border: '1px dashed #2A332F', color: '#6B6557' }}>
            {isUploading ? (
              <div className="w-8 h-8 border-2 border-bronze-light border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ImageIcon size={32} />
                <span className="text-sm">Clic para subir imagen</span>
                <span className="label-caps">o pegá una URL abajo</span>
              </>
            )}
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>
        )}

        <div className="flex gap-2">
          <input className="input-base flex-1"
            placeholder="URL de imagen (opcional)"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)} />
          <button onClick={() => fileRef.current?.click()}
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: '#1E2A28', border: '1px solid #2A332F', color: '#A89F8E' }}>
            <Upload size={16} />
          </button>
          <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
        </div>

        <input className="input-base"
          placeholder="Descripción (ej: El Castillo Oscuro)"
          value={caption}
          onChange={e => setCaption(e.target.value)} />

        <div className="flex gap-3">
          <button
            onClick={handleShare}
            disabled={!imageUrl}
            className="flex-1 py-2.5 rounded-lg font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: 'rgba(62,132,214,0.2)', border: '1px solid rgba(62,132,214,0.4)', color: '#3E84D6' }}>
            <Eye size={16} /> Mostrar a jugadores
          </button>
          <button onClick={handleStopSharing}
            className="px-4 py-2.5 rounded-lg font-black text-sm"
            style={{ background: 'rgba(194,69,47,0.15)', border: '1px solid rgba(194,69,47,0.3)', color: '#C2452F' }}>
            <EyeOff size={16} />
          </button>
        </div>
      </div>

      {/* Recent media */}
      {sharedMedia.length > 0 && (
        <div>
          <h2 className="font-black text-sm mb-3" style={{ color: '#EDE6D8' }}>
            Compartidos recientemente
            <span className="label-caps ml-2" style={{ color: '#6B6557' }}>(clic para volver a mostrar)</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {sharedMedia.map((media, i) => (
              <button key={i} onClick={() => handleReshare(media)}
                className="relative h-28 rounded-xl overflow-hidden group"
                style={{ border: '1px solid #2A332F' }}>
                <img src={media.url} alt={media.caption} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-x-0 bottom-0 p-2" style={{ background: 'rgba(0,0,0,0.7)' }}>
                  <p className="text-xs font-bold truncate" style={{ color: '#EDE6D8' }}>{media.caption || 'Sin título'}</p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <Eye size={20} style={{ color: '#EDE6D8' }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
