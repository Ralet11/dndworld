import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !email || !password) { setError('Completá todos los campos'); return; }
    setError('');
    setLoading(true);
    try {
      await register(username, email, password);
    } catch (err) {
      setError(err.message || 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(180deg, #0F1518 0%, #11191A 100%)' }}>

      <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-64"
        style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(255,122,26,0.08) 0%, transparent 70%)' }} />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl font-bold mb-2"
            style={{ color: '#F59E0B', textShadow: '0 2px 14px rgba(245,158,11,0.45)' }}>
            DnD World
          </h1>
          <p className="italic text-sm" style={{ color: '#A89F8E' }}>Únete a la aventura</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: '#C8A36A' }} />
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Nombre de aventurero"
              className="input-base pl-11"
              autoComplete="username"
            />
          </div>

          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: '#C8A36A' }} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              className="input-base pl-11"
              autoComplete="email"
            />
          </div>

          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: '#C8A36A' }} />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="input-base pl-11"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-xs font-bold text-center" style={{ color: '#C2452F' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-lg font-black text-base tracking-wider glow-ember transition-opacity disabled:opacity-60"
            style={{ background: '#FF7A1A', color: '#1A0E04' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Creando cuenta...
              </span>
            ) : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm" style={{ color: '#A89F8E' }}>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-bold" style={{ color: '#F59E0B' }}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
