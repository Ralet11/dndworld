import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useSessionStore } from '../../store/useSessionStore'

const LoginPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const loginUser = useSessionStore((state) => state.loginUser)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectTo = searchParams.get('redirectTo') ?? '/dm'

  const handleSubmit = (event) => {
    event.preventDefault()
    setError(null)

    const normalizedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    if (!normalizedEmail || !trimmedPassword) {
      setError('Ingresa email y password.')
      return
    }

    setIsSubmitting(true)

    try {
      loginUser({ email: normalizedEmail, password: trimmedPassword })
      navigate(redirectTo, { replace: true })
    } catch (loginError) {
      const message = loginError?.message ?? 'No se pudo iniciar sesion.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-6 py-12">
      <header className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Accede a tu mesa</p>
        <h1 className="font-display text-4xl text-parchment">Dungeon Master Console</h1>
        <p className="text-sm text-slate-300">Gestiona campanas, escenarios y tableros compartidos sin dejar el navegador.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-8 shadow-lg">
        <div>
          <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          {isSubmitting ? 'Ingresando...' : 'Iniciar sesion'}
        </button>
      </form>

      <p className="text-center text-xs text-slate-400">
        No tienes cuenta? <Link to="/register" className="text-emerald-300 underline">Crear una nueva</Link>
      </p>
    </div>
  )
}

export default LoginPage
