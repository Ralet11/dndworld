import { createElement, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async event => {
    event.preventDefault();
    if (!username || !email || !password) {
      setError('Completa todos los campos');
      return;
    }
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

  const fields = [
    { label: 'Nombre de aventurero', type: 'text', value: username, setter: setUsername, Icon: User, autoComplete: 'username' },
    { label: 'Correo electrónico', type: 'email', value: email, setter: setEmail, Icon: Mail, autoComplete: 'email' },
    { label: 'Contraseña', type: 'password', value: password, setter: setPassword, Icon: Lock, autoComplete: 'new-password' },
  ];

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <div className="text-center mb-8">
          <div className="auth-emblem"><Compass size={31} strokeWidth={1.1} /></div>
          <p className="label-caps mb-2 text-[#a9864c]">Nuevo aventurero</p>
          <h1>DnD World</h1>
          <p className="auth-subtitle">Comienza tu historia</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {fields.map(({ label, type, value, setter, Icon, autoComplete }) => (
            <label className="block" key={label}>
              <span className="label-caps block mb-2">{label}</span>
              <span className="relative block">
                {createElement(Icon, { size: 16, className: 'auth-field-icon', 'aria-hidden': true })}
                <input type={type} value={value} onChange={event => setter(event.target.value)} placeholder={label} className="input-base auth-input-leading" autoComplete={autoComplete} />
              </span>
            </label>
          ))}

          {error && <p className="text-xs text-center text-[#b95246]">{error}</p>}

          <button type="submit" disabled={loading} className="auth-submit disabled:opacity-50">
            {loading ? <span className="flex items-center justify-center gap-2"><i className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />Creando registro...</span> : 'Crear aventurero'}
          </button>
        </form>

        <p className="mt-7 text-center text-xs text-[#777269]">
          ¿Ya tienes una cuenta? <Link to="/login" className="ml-1 text-[#c2a269] hover:text-[#dfc58f]">Entrar</Link>
        </p>
      </section>
    </div>
  );
}
