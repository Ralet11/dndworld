import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'

const RegisterPage = () => {
  const navigate = useNavigate()
  const registerUser = useSessionStore((state) => state.registerUser)

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setError(null)

    const trimmedName = form.name.trim()
    const normalizedEmail = form.email.trim().toLowerCase()
    const trimmedPassword = form.password.trim()

    if (!trimmedName || !normalizedEmail || !trimmedPassword) {
      setError('Completa nombre, email y password.')
      return
    }

    setIsSubmitting(true)

    try {
      registerUser({ name: trimmedName, email: normalizedEmail, password: trimmedPassword })
      navigate('/dm', { replace: true })
    } catch (submitError) {
      const message = submitError?.message ?? 'No se pudo crear la cuenta.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-6 py-12">
      <header className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Comienza tu mesa</p>
        <h1 className="font-display text-4xl text-parchment">Crear cuenta DungeonWorld</h1>
        <p className="text-sm text-slate-300">Prepara campanas, invita jugadores y coordina sesiones en vivo.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-8 shadow-lg">
        <div>
          <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="name">
            Nombre completo
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            placeholder="Aria la guia"
            required
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            placeholder="dm@example.com"
            required
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            placeholder="********"
            required
          />
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <button
          type="submit"
          className="w-full rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creando cuenta...' : 'Registrarme'}
        </button>
      </form>

      <p className="text-center text-xs text-slate-400">
        Ya tienes cuenta? <Link to="/login" className="text-emerald-300 underline">Inicia sesion</Link>
      </p>
    </div>
  )
}

export default RegisterPage
