import { useMemo, useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'

const initialCharacterState = {
  name: '',
  classType: '',
  level: '1',
  race: '',
  background: '',
  alignment: '',
  notes: '',
}

const PlayerCharactersPage = () => {
  const characters = useSessionStore((state) => state.session.playerCharacters ?? [])
  const addPlayerCharacter = useSessionStore((state) => state.addPlayerCharacter)
  const removePlayerCharacter = useSessionStore((state) => state.removePlayerCharacter)

  const [formState, setFormState] = useState(initialCharacterState)
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [characters],
  )

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setError(null)

    if (!formState.name.trim()) {
      setError('El nombre del personaje es obligatorio.')
      return
    }

    if (!formState.classType.trim()) {
      setError('Define la clase del personaje.')
      return
    }

    setIsSubmitting(true)

    try {
      addPlayerCharacter(formState)
      setFormState(initialCharacterState)
    } catch (creationError) {
      setError(creationError?.message ?? 'No se pudo guardar el personaje.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = (characterId) => {
    removePlayerCharacter(characterId)
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Personajes</p>
        <h1 className="font-display text-4xl text-parchment">Tu roster para DnD 5e</h1>
        <p className="text-sm text-slate-300">
          Guarda tus hojas de personaje de manera local mientras preparamos la sincronizacion completa con el backend.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,3fr]">
        <article className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-lg font-semibold text-parchment">Nuevo personaje</h2>
          <p className="text-xs uppercase tracking-widest text-slate-500">Datos basicos</p>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="character-name">
                Nombre
              </label>
              <input
                id="character-name"
                name="name"
                type="text"
                value={formState.name}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                placeholder="Eira Stormborn"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="character-class">
                  Clase
                </label>
                <input
                  id="character-class"
                  name="classType"
                  type="text"
                  value={formState.classType}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  placeholder="Bardo"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="character-level">
                  Nivel
                </label>
                <input
                  id="character-level"
                  name="level"
                  type="number"
                  min="1"
                  max="20"
                  value={formState.level}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="character-race">
                  Raza
                </label>
                <input
                  id="character-race"
                  name="race"
                  type="text"
                  value={formState.race}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  placeholder="Humano"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="character-alignment">
                  Alineacion
                </label>
                <input
                  id="character-alignment"
                  name="alignment"
                  type="text"
                  value={formState.alignment}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  placeholder="Neutral bueno"
                />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="character-background">
                Trasfondo
              </label>
              <input
                id="character-background"
                name="background"
                type="text"
                value={formState.background}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                placeholder="Erudito de Candlekeep"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-slate-400" htmlFor="character-notes">
                Notas
              </label>
              <textarea
                id="character-notes"
                name="notes"
                rows={3}
                value={formState.notes}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                placeholder="Rasgos de personalidad, ideales, vinculos y defectos."
              />
            </div>

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <button
              type="submit"
              className="w-full rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar personaje'}
            </button>
          </form>
        </article>

        <article className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-lg font-semibold text-parchment">Tus personajes</h2>
          {sortedCharacters.length ? (
            <ul className="space-y-4 text-sm text-slate-200">
              {sortedCharacters.map((character) => (
                <li key={character.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-inner">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-parchment">{character.name}</p>
                      <p className="text-xs uppercase tracking-widest text-slate-500">
                        Nivel {character.level}  {character.classType || 'Clase sin definir'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(character.id)}
                      className="rounded-full border border-red-400/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-red-200 transition hover:bg-red-400/20"
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
                    {character.race && <span>Raza: {character.race}</span>}
                    {character.background && <span>Trasfondo: {character.background}</span>}
                    {character.alignment && <span>Alineacion: {character.alignment}</span>}
                  </div>
                  {character.notes && <p className="mt-3 text-xs text-slate-400">Notas: {character.notes}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Todavia no registraste personajes. Crea uno usando el formulario para comenzar.</p>
          )}
        </article>
      </section>
    </section>
  )
}

export default PlayerCharactersPage
