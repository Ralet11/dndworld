import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../../api/client"
import SelectionCard from "./components/SelectionCard"
import { PortraitUploaderCard, isBlobUrl } from "../../components/PortraitUploaderCard"

const ALIGNMENTS = [
  "LAWFUL_GOOD",
  "NEUTRAL_GOOD",
  "CHAOTIC_GOOD",
  "LAWFUL_NEUTRAL",
  "TRUE_NEUTRAL",
  "CHAOTIC_NEUTRAL",
  "LAWFUL_EVIL",
  "NEUTRAL_EVIL",
  "CHAOTIC_EVIL",
]

const DEFAULT_TRANSFORM = { x: 0, y: 0, scale: 1 }

const INITIAL_FORM = {
  name: "",
  age: "",
  raceId: "",
  classId: "",
  alignment: "TRUE_NEUTRAL",
  history: "",
  fears: "",
  goalsShort: "",
  goalsLong: "",
  portraitAssetId: "",
  portraitUrl: "",
  portraitFile: null,
  portraitPreview: "",
  portraitTransform: { ...DEFAULT_TRANSFORM },
}

const STEPS = [
  { key: "race", label: "Raza" },
  { key: "class", label: "Clase" },
  { key: "story", label: "Historia" },
  { key: "portrait", label: "Retrato" },
]

export default function CreateCharacter() {
  const [races, setRaces] = useState([])
  const [classes, setClasses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      try {
        const [racesRes, classesRes] = await Promise.all([
          api.get("/catalog/races"),
          api.get("/catalog/classes"),
        ])
        if (!isMounted) return
        setRaces(Array.isArray(racesRes?.data) ? racesRes.data : [])
        setClasses(Array.isArray(classesRes?.data) ? classesRes.data : [])
      } catch (error) {
        console.error("Error loading character catalog", error)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    fetchData()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (isBlobUrl(form.portraitPreview)) {
        URL.revokeObjectURL(form.portraitPreview)
      }
    }
  }, [form.portraitPreview])

  const selectedRace = useMemo(
    () => races.find((race) => race.id === form.raceId) || null,
    [form.raceId, races],
  )
  const selectedClass = useMemo(
    () => classes.find((klass) => klass.id === form.classId) || null,
    [classes, form.classId],
  )
  const alignmentLabel = useMemo(() => {
    if (!form.alignment) return "Sin definir"
    return form.alignment.replace(/_/g, " ")
  }, [form.alignment])

  const goToStep = (target) => {
    setStep(Math.min(Math.max(target, 0), STEPS.length - 1))
  }

  const goNext = () => {
    if (!canAdvance) return
    goToStep(step + 1)
  }

  const goBack = () => {
    goToStep(step - 1)
  }

  const handleFormKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !isFinalStep &&
      event.target?.tagName !== "TEXTAREA"
    ) {
      event.preventDefault()
    }
  }

  const releasePortraitPreview = () => {
    if (isBlobUrl(form.portraitPreview)) {
      URL.revokeObjectURL(form.portraitPreview)
    }
  }

  const resetWizard = () => {
    releasePortraitPreview()
    setForm({ ...INITIAL_FORM, portraitTransform: { ...DEFAULT_TRANSFORM } })
    goToStep(0)
  }

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handlePortraitChange = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const biographyValid = useMemo(() => {
    return (
      form.name.trim().length > 0 &&
      form.alignment &&
      form.goalsShort.trim().length > 0 &&
      form.goalsLong.trim().length > 0
    )
  }, [form.alignment, form.goalsLong, form.goalsShort, form.name])

  const canAdvance = useMemo(() => {
    if (step === 0) return Boolean(form.raceId)
    if (step === 1) return Boolean(form.classId)
    if (step === 2) return biographyValid
    return true
  }, [biographyValid, form.classId, form.raceId, step])

  const isFinalStep = step === STEPS.length - 1

  const primaryButtonClass = `rounded-lg ${isFinalStep ? "bg-emerald-500 hover:bg-emerald-400" : "bg-cyan-500 hover:bg-cyan-400"} px-5 py-2 text-sm font-semibold text-slate-900 transition disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300`

  const handleSubmit = async (event) => {
    if (event?.preventDefault) event.preventDefault()
    if (!canAdvance || submitting) return
    setSubmitting(true)
    setErrorMessage("")
    try {
      let portraitAssetId = form.portraitAssetId?.trim() || null
      const portraitUrl = form.portraitUrl?.trim() || null

      if (!portraitAssetId && form.portraitFile) {
        const fd = new FormData()
        fd.append("kind", "image")
        fd.append("file", form.portraitFile)
        const media = await api.post("/media", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        portraitAssetId = media?.data?.id || portraitAssetId
      }

      if (!portraitAssetId && portraitUrl) {
        const media = await api.post("/media", { kind: "image", url: portraitUrl })
        portraitAssetId = media?.data?.id || portraitAssetId
      }

      const trimmedHistory = form.history.trim()
      const trimmedFears = form.fears.trim()
      const trimmedGoalsShort = form.goalsShort.trim()
      const trimmedGoalsLong = form.goalsLong.trim()
      const parsedAge = form.age === "" ? null : Number(form.age)

      const payload = {
        name: form.name.trim(),
        raceId: form.raceId,
        classId: form.classId,
        alignment: form.alignment,
        age: Number.isNaN(parsedAge) ? null : parsedAge,
        portraitAssetId: portraitAssetId || null,
        background: trimmedHistory || null,
        history: trimmedHistory || null,
        fears: trimmedFears || null,
        goalsShort: trimmedGoalsShort || null,
        goalsLong: trimmedGoalsLong || null,
      }

      const { data } = await api.post("/characters", payload)
      const characterId = data?.characterId
      if (!characterId) throw new Error("No character id returned")

      await api.post(`/characters/${characterId}/choices`)

      releasePortraitPreview()
      navigate(`/personajes/${characterId}/oferta`)
    } catch (error) {
      console.error("Error creating character", error)
      const message = error?.response?.data?.error
      if (error?.response?.status === 400 && message) {
        setErrorMessage(message)
      } else {
        setErrorMessage("No se pudo crear el personaje. Intenta nuevamente mas tarde.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  const portraitSummary = useMemo(
    () => [
      { label: "Nivel", value: 1 },
      { label: "Raza", value: selectedRace?.name || "-" },
      { label: "Clase", value: selectedClass?.name || "-" },
      { label: "Aline.", value: alignmentLabel || "-" },
    ],
    [alignmentLabel, selectedClass, selectedRace],
  )

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-2xl font-semibold text-white">Crear personaje</h2>
      <p className="mt-1 text-sm text-slate-300">
        Sigue el asistente para construir a tu aventurero. Los atributos se definiran en la fase final.
      </p>
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {errorMessage}
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {STEPS.map((item, index) => {
          const isCompleted = index < step
          const isActive = index === step
          return (
            <div
              key={item.key}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                isActive
                  ? "border-cyan-400 bg-cyan-400/10 text-white"
                  : isCompleted
                  ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                  : "border-slate-700/70 bg-slate-900/70 text-slate-300"
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

      <form className="mt-8 space-y-8" onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
        {step === 0 && (
          <section>
            <header className="mb-4">
              <h3 className="text-xl font-semibold text-white">Elige una raza</h3>
              <p className="text-sm text-slate-300">
                Explora cada tarjeta manteniendo presionado para descubrir sus ventajas.
              </p>
            </header>
            {isLoading ? (
              <p className="text-sm text-slate-400">Cargando razas...</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {races.map((race) => (
                  <SelectionCard
                    key={race.id}
                    item={race}
                    isSelected={form.raceId === race.id}
                    onSelect={() => updateForm("raceId", race.id)}
                    badge={race.lineage || ""}
                    description={race.description || "Aun sin descripcion."}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {step === 1 && (
          <section>
            <header className="mb-4">
              <h3 className="text-xl font-semibold text-white">Escoge una clase</h3>
              <p className="text-sm text-slate-300">
                Observa sus habilidades principales y el estilo de juego sugerido.
              </p>
            </header>
            {isLoading ? (
              <p className="text-sm text-slate-400">Cargando clases...</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {classes.map((klass) => (
                  <SelectionCard
                    key={klass.id}
                    item={klass}
                    isSelected={form.classId === klass.id}
                    onSelect={() => updateForm("classId", klass.id)}
                    badge={klass.role || ""}
                    description={klass.description || "Aun sin descripcion."}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <header>
              <h3 className="text-xl font-semibold text-white">Historia y motivaciones</h3>
              <p className="text-sm text-slate-300">
                Dale contexto, personalidad y objetivos a tu personaje. Los atributos llegaran en la fase final.
              </p>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-200">Nombre</span>
                <input
                  type="text"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="Como se llama?"
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
                  onChange={(event) => updateForm("age", event.target.value)}
                  placeholder="Anos vividos"
                />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">Alineamiento</span>
              <select
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                value={form.alignment}
                onChange={(event) => updateForm("alignment", event.target.value)}
                required
              >
                {ALIGNMENTS.map((alignment) => (
                  <option key={alignment} value={alignment}>
                    {alignment.replace(/_/g, " ")}
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
                onChange={(event) => updateForm("history", event.target.value)}
                placeholder="Cuenta origenes, lazos y eventos clave de tu personaje."
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-200">Miedos</span>
                <textarea
                  rows={4}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                  value={form.fears}
                  onChange={(event) => updateForm("fears", event.target.value)}
                  placeholder="Que cosas lo paralizan o lo persiguen?"
                />
              </label>
              <div className="space-y-4">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-200">Objetivo a corto plazo</span>
                  <textarea
                    rows={2}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    value={form.goalsShort}
                    onChange={(event) => updateForm("goalsShort", event.target.value)}
                    placeholder="Una meta alcanzable en la proxima aventura."
                    required
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-200">Objetivo a largo plazo</span>
                  <textarea
                    rows={3}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    value={form.goalsLong}
                    onChange={(event) => updateForm("goalsLong", event.target.value)}
                    placeholder="Su gran meta o sueno personal."
                    required
                  />
                </label>
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-6">
            <header>
              <h3 className="text-xl font-semibold text-white">Retrato y presencia</h3>
              <p className="text-sm text-slate-300">
                Sube o vincula una imagen para darle rostro a tu personaje. Puedes ajustar la posicion y el zoom.
              </p>
            </header>
            <PortraitUploaderCard
              form={{ ...form, level: 1, armorClass: null, maxHp: null, speedValue: null }}
              onChange={handlePortraitChange}
              raceName={selectedRace?.name || ""}
              classLabel={selectedClass?.name || ""}
              alignmentLabel={alignmentLabel}
              titlePlaceholder="Heroe sin nombre"
              summaryBadges={portraitSummary}
              bottomMetrics={[]}
              footerNote="El retrato se subira automaticamente al crear el personaje."
            />
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
          <button
            type="button"
            onClick={isFinalStep ? handleSubmit : goNext}
            className={primaryButtonClass}
            disabled={!canAdvance || submitting}
          >
            {isFinalStep ? (submitting ? "Creando..." : "Confirmar y crear") : "Siguiente"}
          </button>
        </div>
      </form>
    </div>
  )
}












