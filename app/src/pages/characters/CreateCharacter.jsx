import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import SelectionCard from './components/SelectionCard'

const ALIGNMENTS = [
  'LAWFUL_GOOD',
  'NEUTRAL_GOOD',
  'CHAOTIC_GOOD',
  'LAWFUL_NEUTRAL',
  'TRUE_NEUTRAL',
  'CHAOTIC_NEUTRAL',
  'LAWFUL_EVIL',
  'NEUTRAL_EVIL',
  'CHAOTIC_EVIL',
]

const INITIAL_FORM = {
  name: '',
  age: '',
  raceId: '',
  classId: '',
  alignment: 'TRUE_NEUTRAL',
  history: '',
  fears: '',
  goalsShort: '',
  goalsLong: '',
}

const STEPS = [
  { key: 'race', label: 'Raza' },
  { key: 'class', label: 'Clase' },
  { key: 'details', label: 'Detalles' },
]

export default function CreateCharacter() {
  const [races, setRaces] = useState([])
  const [classes, setClasses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      try {
        const [racesRes, classesRes] = await Promise.all([
          api.get('/catalog/races'),
          api.get('/catalog/classes'),
        ])
        if (!isMounted) return
        setRaces(Array.isArray(racesRes?.data) ? racesRes.data : [])
        setClasses(Array.isArray(classesRes?.data) ? classesRes.data : [])
      } catch (error) {
        console.error('Error loading character catalog', error)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    fetchData()
    return () => {
      isMounted = false
    }
  }, [])

  const selectedRace = useMemo(
    () => races.find((race) => race.id === form.raceId) || null,
    [form.raceId, races]
  )
  const selectedClass = useMemo(
    () => classes.find((klass) => klass.id === form.classId) || null,
    [classes, form.classId]
  )

  const goToStep = (target) => {
    setStep(Math.min(Math.max(target, 0), STEPS.length - 1))
  }

  const goNext = () => {
    goToStep(step + 1)
  }

  const goBack = () => {
    goToStep(step - 1)
  }

  const resetWizard = () => {
    setForm(INITIAL_FORM)
    goToStep(0)
  }

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const canAdvance = useMemo(() => {
    if (step === 0) return Boolean(form.raceId)
    if (step === 1) return Boolean(form.classId)
    if (step === 2)
      return (
        form.name.trim().length > 0 &&
        form.alignment &&
        form.goalsShort.trim().length > 0 &&
        form.goalsLong.trim().length > 0
      )
    return true
  }, [form.alignment, form.classId, form.goalsLong, form.goalsShort, form.name, form.raceId, step])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canAdvance || submitting) return
    setSubmitting(true)
    try {
      const trimmedHistory = form.history.trim()
      const trimmedFears = form.fears.trim()
      const trimmedGoalsShort = form.goalsShort.trim()
      const trimmedGoalsLong = form.goalsLong.trim()
      const parsedAge = form.age === '' ? null : Number(form.age)

      const payload = {
        name: form.name.trim(),
        raceId: form.raceId,
        classId: form.classId,
        alignment: form.alignment,
        age: Number.isNaN(parsedAge) ? null : parsedAge,
        background: trimmedHistory || null,
        history: trimmedHistory || null,
        fears: trimmedFears || null,
        goalsShort: trimmedGoalsShort || null,
        goalsLong: trimmedGoalsLong || null,
      }
      const { data } = await api.post('/characters', payload)
      await api.post(`/characters/${data.characterId}/choices`)
      navigate(`/personajes/${data.characterId}/oferta`)
    } catch (error) {
      console.error('Error creating character', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-2xl font-semibold text-white">Crear personaje</h2>
      <p className="mt-1 text-sm text-slate-300">
        Completá el asistente paso a paso para definir tu nuevo héroe.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {STEPS.map((item, index) => {
          const isCompleted = index < step
          const isActive = index === step
          return (
            <div
              key={item.key}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                isActive
                  ? 'border-cyan-400 bg-cyan-400/10 text-white'
                  : isCompleted
                  ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200'
                  : 'border-slate-700/70 bg-slate-900/70 text-slate-300'
              }`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs font-semibold">
                {index + 1}
              </span>
              <span className="font-medium">{item.label}</span>
            </div>
          )
        })}
      </div>

      <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
        {step === 0 && (
          <section>
            <header className="mb-4">
              <h3 className="text-xl font-semibold text-white">Elegí una raza</h3>
              <p className="text-sm text-slate-300">
                Explora cada tarjeta manteniendo presionado para descubrir sus ventajas.
              </p>
            </header>
            {isLoading ? (
              <p className="text-sm text-slate-400">Cargando razas…</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {races.map((race) => (
                  <SelectionCard
                    key={race.id}
                    title={race.name}
                    description={race.description}
                    improvements={race.improvements || race.traits || []}
                    iconAssetId={race.iconAssetId}
                    selected={form.raceId === race.id}
                    onSelect={() => updateForm('raceId', race.id)}
                  />
                ))}
                {races.length === 0 && (
                  <p className="text-sm italic text-slate-400">
                    No hay razas disponibles por el momento.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {step === 1 && (
          <section>
            <header className="mb-4">
              <h3 className="text-xl font-semibold text-white">Elegí una clase</h3>
              <p className="text-sm text-slate-300">
                Compará estilos y mejoras antes de comprometerte.
              </p>
            </header>
            {isLoading ? (
              <p className="text-sm text-slate-400">Cargando clases…</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((klass) => (
                  <SelectionCard
                    key={klass.id}
                    title={klass.name}
                    description={klass.description}
                    improvements={klass.improvements || klass.features || []}
                    iconAssetId={klass.iconAssetId}
                    selected={form.classId === klass.id}
                    onSelect={() => updateForm('classId', klass.id)}
                  />
                ))}
                {classes.length === 0 && (
                  <p className="text-sm italic text-slate-400">
                    No hay clases disponibles por el momento.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6">
            <header>
              <h3 className="text-xl font-semibold text-white">
                Definí los detalles finales
              </h3>
              <p className="text-sm text-slate-300">
                {selectedRace && selectedClass
                  ? `Tu personaje será un ${selectedRace.name} ${selectedClass.name}. Ahora definí su historia y motivaciones.`
                  : 'Completá la información esencial para tu personaje.'}
              </p>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-200">Nombre</span>
                <input
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  placeholder="¿Cómo se llama?"
                  required
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-200">Edad</span>
                <input
                  type="number"
                  min="0"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                  value={form.age}
                  onChange={(event) => updateForm('age', event.target.value)}
                  placeholder="Años vividos"
                />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">Alineamiento</span>
              <select
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                value={form.alignment}
                onChange={(event) => updateForm('alignment', event.target.value)}
                required
              >
                {ALIGNMENTS.map((alignment) => (
                  <option key={alignment} value={alignment}>
                    {alignment.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">Historia</span>
              <textarea
                rows={4}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                value={form.history}
                onChange={(event) => updateForm('history', event.target.value)}
                placeholder="Relatá los orígenes, vínculos y eventos clave de tu personaje."
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-200">Miedos</span>
                <textarea
                  rows={4}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                  value={form.fears}
                  onChange={(event) => updateForm('fears', event.target.value)}
                  placeholder="¿Qué cosas lo paralizan o lo persiguen?"
                />
              </label>
              <div className="space-y-4">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Objetivo a corto plazo
                  </span>
                  <textarea
                    rows={2}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    value={form.goalsShort}
                    onChange={(event) => updateForm('goalsShort', event.target.value)}
                    placeholder="Una meta alcanzable en la próxima aventura."
                    required
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Objetivo a largo plazo
                  </span>
                  <textarea
                    rows={3}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    value={form.goalsLong}
                    onChange={(event) => updateForm('goalsLong', event.target.value)}
                    placeholder="El sueño que lo impulsa más allá de lo inmediato."
                    required
                  />
                </label>
              </div>
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-6">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={resetWizard}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-white"
              disabled={submitting}
            >
              Reiniciar
            </button>
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-white"
                disabled={submitting}
              >
                Volver
              </button>
            )}
          </div>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              disabled={!canAdvance || submitting}
            >
              Siguiente
            </button>
          ) : (
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-6 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              disabled={!canAdvance || submitting}
            >
              {submitting ? 'Creando…' : 'Confirmar y crear'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
