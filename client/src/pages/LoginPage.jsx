import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async event => {
    event.preventDefault();
    if (!email || !password) {
      setError('Completa todos los campos');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'No se pudo entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="text-center mb-9">
          <div className="auth-emblem"><Compass size={31} strokeWidth={1.1} /></div>
          <p className="label-caps mb-2 text-[#a9864c]">Portal del aventurero</p>
          <h1>DnD World</h1>
          <p className="auth-subtitle">Regresa a la campaña</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="label-caps block mb-2">Correo electrónico</span>
            <span className="relative block">
              <Mail size={16} className="auth-field-icon" aria-hidden="true" />
              <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@email.com" className="input-base auth-input-leading" autoComplete="email" />
            </span>
          </label>
          <label className="block">
            <span className="label-caps block mb-2">Contraseña</span>
            <span className="relative block">
              <Lock size={16} className="auth-field-icon" aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Tu contraseña"
                className="input-base auth-input-leading auth-input-trailing"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(current => !current)}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-[#746a57] transition-colors hover:text-[#c2a269] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#c2a269]"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>

          {error && <p className="text-xs text-center text-[#b95246]">{error}</p>}

          <button type="submit" disabled={loading} className="auth-submit disabled:opacity-50">
            {loading ? <span className="flex items-center justify-center gap-2"><i className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />Abriendo portal...</span> : 'Entrar a la campaña'}
          </button>
        </form>

        <p className="mt-7 text-center text-xs text-[#777269]">
          ¿Primera vez en este mundo? <Link to="/register" className="ml-1 text-[#c2a269] hover:text-[#dfc58f]">Crear cuenta</Link>
        </p>
      </section>
    </div>
  );
}
