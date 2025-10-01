// src/pages/Landing.jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"   // ← React Router (quita esta línea si no lo usas)
import useAuth from "../store/useAuth"

export default function Landing() {
  const navigate = useNavigate()                // ← React Router (comenta si no lo usas)
  const [mode, setMode] = useState("login")
  const { signup, login, loading } = useAuth()
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [showPortal, setShowPortal] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    let success = false

    if (mode === "signup") {
      success = await signup(form)
    } else {
      success = await login({ email: form.email, password: form.password })
    }

    if (success) {
      setShowPortal(true)
      setTimeout(() => {
        // Redirección:
        navigate("/home")                      // ← usa React Router
        // window.location.assign("/home")     // ← si NO usas React Router, descomenta esta línea y comenta la de arriba
      }, 2500)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black flex items-center justify-center">
      {showPortal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black portal-transition">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Expanding portal rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="portal-ring portal-ring-1"></div>
              <div className="portal-ring portal-ring-2"></div>
              <div className="portal-ring portal-ring-3"></div>
              <div className="portal-ring portal-ring-4"></div>
              <div className="portal-ring portal-ring-5"></div>
            </div>

            {/* Center vortex */}
            <div className="relative z-10">
              <div className="w-32 h-32 rounded-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 animate-spin blur-xl"></div>
              <div className="absolute inset-0 w-32 h-32 rounded-full bg-gradient-to-l from-fuchsia-500 via-purple-500 to-blue-500 animate-[spin_1.5s_linear_infinite_reverse] blur-2xl"></div>
            </div>

            {/* Portal text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-4xl font-bold text-white animate-pulse tracking-widest">ENTRANDO AL PORTAL...</p>
            </div>
          </div>
        </div>
      )}

      {/* Animated Portal Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950 via-indigo-950 to-black">
        {/* Portal rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600/30 to-blue-600/30 blur-3xl animate-pulse"></div>
          <div className="absolute inset-[10%] rounded-full bg-gradient-to-r from-violet-500/20 to-cyan-500/20 blur-2xl animate-[pulse_3s_ease-in-out_infinite]"></div>
          <div className="absolute inset-[20%] rounded-full bg-gradient-to-r from-fuchsia-500/30 to-indigo-500/30 blur-xl animate-[pulse_4s_ease-in-out_infinite]"></div>
        </div>

        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-purple-400 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`,
              opacity: Math.random() * 0.7 + 0.3,
            }}
          ></div>
        ))}

        {/* Mystical grid overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
            animation: "gridMove 20s linear infinite",
          }}
        ></div>
      </div>

      {/* Portal Form Container */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="relative backdrop-blur-xl bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-slate-900/40 border-2 border-purple-500/30 rounded-2xl p-8 shadow-2xl shadow-purple-500/20">
          {/* Glowing corners */}
          <div className="absolute -top-1 -left-1 w-8 h-8 border-t-2 border-l-2 border-purple-400 rounded-tl-2xl animate-pulse"></div>
          <div className="absolute -top-1 -right-1 w-8 h-8 border-t-2 border-r-2 border-purple-400 rounded-tr-2xl animate-pulse"></div>
          <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-2 border-l-2 border-purple-400 rounded-bl-2xl animate-pulse"></div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-2 border-r-2 border-purple-400 rounded-br-2xl animate-pulse"></div>

          {/* Title */}
          <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-purple-300 via-violet-300 to-indigo-300 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] tracking-wider">
            DUNGEON WORLD
          </h1>

          {/* Mode Toggle */}
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all duration-300 ${
                mode === "login"
                  ? "bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/50 scale-105"
                  : "bg-slate-800/50 text-purple-300 hover:bg-slate-700/50 border border-purple-500/20"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all duration-300 ${
                mode === "signup"
                  ? "bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/50 scale-105"
                  : "bg-slate-800/50 text-purple-300 hover:bg-slate-700/50 border border-purple-500/20"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-5">
            {mode === "signup" && (
              <div>
                <label className="block text-purple-200 text-sm font-medium mb-2 tracking-wide">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-4 py-3 bg-slate-900/60 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 transition-all"
                  placeholder="Tu nombre de aventurero"
                />
              </div>
            )}

            <div>
              <label className="block text-purple-200 text-sm font-medium mb-2 tracking-wide">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="w-full px-4 py-3 bg-slate-900/60 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 transition-all"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="block text-purple-200 text-sm font-medium mb-2 tracking-wide">Contraseña</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                className="w-full px-4 py-3 bg-slate-900/60 border border-purple-500/30 rounded-lg text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 uppercase tracking-wider"
            >
              {loading ? "Abriendo portal..." : mode === "signup" ? "Crear aventurero" : "Entrar al mundo"}
            </button>
          </form>

          {/* Mystical decoration */}
          <div className="mt-6 text-center text-purple-300/60 text-xs tracking-widest">✦ ✧ ✦</div>
        </div>
      </div>

      {/* ⬇️ En React estándar NO uses styled-jsx; un <style> normal funciona perfecto */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(50px); opacity: 0; }
        }
        @keyframes gridMove {
          0% { transform: perspective(500px) rotateX(60deg) translateY(0); }
          100% { transform: perspective(500px) rotateX(60deg) translateY(50px); }
        }
        .animate-float { animation: float linear infinite; }
        .portal-transition { animation: portalFade 0.5s ease-in forwards; }
        @keyframes portalFade { from { opacity: 0; } to { opacity: 1; } }
        .portal-ring { position: absolute; border-radius: 50%; border: 3px solid; animation: portalExpand 2s ease-out forwards; }
        .portal-ring-1 { width: 100px; height: 100px; border-color: rgba(168,85,247,0.8); animation-delay: 0s; }
        .portal-ring-2 { width: 100px; height: 100px; border-color: rgba(139,92,246,0.6); animation-delay: 0.2s; }
        .portal-ring-3 { width: 100px; height: 100px; border-color: rgba(124,58,237,0.5); animation-delay: 0.4s; }
        .portal-ring-4 { width: 100px; height: 100px; border-color: rgba(109,40,217,0.4); animation-delay: 0.6s; }
        .portal-ring-5 { width: 100px; height: 100px; border-color: rgba(91,33,182,0.3); animation-delay: 0.8s; }
        @keyframes portalExpand {
          0% { width: 100px; height: 100px; opacity: 1; }
          100% { width: 2000px; height: 2000px; opacity: 0; }
        }
      `}</style>
    </div>
  )
}
