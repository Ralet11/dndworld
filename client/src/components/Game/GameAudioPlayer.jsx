import { useEffect, useRef, useState } from 'react';
import { Music2, Volume2, VolumeX } from 'lucide-react';

function expectedPosition(session) {
  const base = Math.max(0, Number(session?.audio_position_seconds) || 0);
  if (session?.audio_status !== 'PLAYING' || !session?.audio_started_at) return base;
  return base + Math.max(0, (Date.now() - new Date(session.audio_started_at).getTime()) / 1000);
}

export default function GameAudioPlayer({ session }) {
  const audioRef = useRef(null);
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('dndworld_audio_volume') ?? 0.65));
  const [muted, setMuted] = useState(() => localStorage.getItem('dndworld_audio_muted') === 'true');
  const [needsActivation, setNeedsActivation] = useState(false);
  const track = session?.audioTrack;
  const audioLoop = session?.audio_loop;
  const audioPosition = session?.audio_position_seconds;
  const audioStartedAt = session?.audio_started_at;
  const audioStatus = session?.audio_status;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.muted = muted;
  }, [muted, track, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    const sync = () => {
      const target = expectedPosition({ audio_position_seconds: audioPosition, audio_status: audioStatus, audio_started_at: audioStartedAt });
      if (Number.isFinite(audio.duration) && audio.duration > 0 && audioLoop) audio.currentTime = target % audio.duration;
      else if (Math.abs((audio.currentTime || 0) - target) > 2) audio.currentTime = target;

      if (audioStatus === 'PLAYING') {
        audio.play().then(() => setNeedsActivation(false)).catch(() => setNeedsActivation(true));
      } else {
        audio.pause();
        if (audioStatus === 'STOPPED') audio.currentTime = 0;
      }
    };
    if (audio.readyState >= 1) sync();
    else audio.addEventListener('loadedmetadata', sync, { once: true });
    return () => audio.removeEventListener('loadedmetadata', sync);
  }, [audioLoop, audioPosition, audioStartedAt, audioStatus, track]);

  const updateVolume = next => {
    const value = Number(next);
    setVolume(value);
    setMuted(false);
    localStorage.setItem('dndworld_audio_volume', String(value));
    localStorage.setItem('dndworld_audio_muted', 'false');
  };

  const toggleMute = () => {
    setMuted(current => {
      localStorage.setItem('dndworld_audio_muted', String(!current));
      return !current;
    });
  };

  if (!track) return null;

  return (
    <section className={`game-player-audio${needsActivation ? ' needs-activation' : ''}`}>
      <audio ref={audioRef} src={track.url} loop={audioLoop !== false} preload="auto" />
      <div className="game-player-audio-copy"><Music2 size={13} /><span><small>Ambientación</small><strong>{track.name}</strong></span></div>
      {needsActivation ? (
        <button className="game-audio-enable" type="button" onClick={() => audioRef.current?.play().then(() => setNeedsActivation(false))}>Activar sonido</button>
      ) : (
        <div className="game-player-volume">
          <button type="button" onClick={toggleMute} aria-label={muted ? 'Activar audio' : 'Silenciar audio'}>{muted ? <VolumeX size={13} /> : <Volume2 size={13} />}</button>
          <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={event => updateVolume(event.target.value)} aria-label="Volumen de la ambientación" />
        </div>
      )}
    </section>
  );
}
