import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import api from "../../api/client"
import { equipItem } from "../../api/inventory"

const PORTRAIT_REFRESH_POLL_MS = 2000
const PORTRAIT_REFRESH_TIMEOUT_MS = 20000

function getPortraitUrl(payload) {
  if (!payload) return null
  const portraitSources = [
    payload.profile?.portrait,
    payload.Creature?.portrait,
    payload.portrait,
  ].filter(Boolean)
  for (const portrait of portraitSources) {
    if (!portrait) continue
    const meta = portrait.meta || {}
    const candidates = [
      meta.secureUrl,
      meta.secure_url,
      meta.url,
      portrait.secureUrl,
      portrait.secure_url,
      portrait.url,
    ].filter(Boolean)
    if (candidates.length > 0) {
      return candidates[0]
    }
  }
  return null
}

const STORAGE_KEYWORDS = ["storage", "stash", "vault", "almacen", "chest", "locker"]

function isStoredItem(entry) {
  const meta = entry?.Item?.meta
  if (!meta) return false
  if (meta.stored === true || meta.storage === true) return true
  const storage = String(meta.storage || meta.placement || "").toLowerCase()
  return STORAGE_KEYWORDS.some((kw) => storage.includes(kw))
}

function InventorySection({ title, description, emptyMessage, items, onToggle, itemStatus }) {
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 shadow-md shadow-slate-950/30">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {description && <p className="text-sm text-slate-400">{description}</p>}
        </div>
      </header>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700/70 bg-slate-950/50 px-4 py-6 text-center text-sm text-slate-400">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((entry) => {
            const pending = Boolean(itemStatus[entry.id]?.pending)
            const message = itemStatus[entry.id]?.message || ""
            const hasError = Boolean(itemStatus[entry.id]?.error)
            const displayInitial = (entry.Item?.name || "?").slice(0, 2).toUpperCase()
            return (
              <article
                key={entry.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 p-4 transition-all duration-200 hover:border-cyan-500/60 hover:shadow-lg hover:shadow-cyan-900/30"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-slate-700/60 bg-slate-950/70">
                    <span className="text-xs font-semibold text-slate-300">{displayInitial}</span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-base font-semibold text-white">{entry.Item?.name ?? "Sin nombre"}</h4>
                      <span className="rounded-full bg-slate-800/70 px-2 py-0.5 text-xs text-slate-300">x{entry.qty}</span>
                    </div>
                    {entry.Item?.description && (
                      <p className="text-xs text-slate-400 line-clamp-3">{entry.Item.description}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    onClick={() => onToggle(entry)}
                    disabled={pending}
                  >
                    {entry.equipped ? "Quitar" : "Equipar"}
                  </button>
                  {message && (
                    <p className={`text-xs ${hasError ? "text-red-400" : "text-emerald-400"}`}>{message}</p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function Inventory() {
  const { id } = useParams()
  const [items, setItems] = useState([])
  const [catalog, setCatalog] = useState([])
  const [selectedItemId, setSelectedItemId] = useState("")
  const [qty, setQty] = useState(1)
  const [itemStatus, setItemStatus] = useState({})
  const [portraitUrl, setPortraitUrl] = useState(null)
  const [portraitError, setPortraitError] = useState("")
  const [portraitLoading, setPortraitLoading] = useState(true)
  const isMounted = useRef(true)

  useEffect(() => () => {
    isMounted.current = false
  }, [])

  const loadInventory = useCallback(async () => {
    try {
      const response = await api.get(`/characters/${id}/inventory`)
      if (isMounted.current) setItems(response.data || [])
    } catch (error) {
      console.error("No se pudo cargar el inventario", error)
    }
  }, [id])

  const loadCatalog = useCallback(async () => {
    try {
      const response = await api.get("/items")
      if (isMounted.current) setCatalog(response.data || [])
    } catch (error) {
      console.error("No se pudo cargar el catalogo de items", error)
    }
  }, [])

  const updatePortrait = useCallback(
    async (silent = false) => {
      if (!silent && isMounted.current) {
        setPortraitLoading(true)
        setPortraitError("")
      }
      try {
        const response = await api.get(`/characters/${id}`)
        const url = getPortraitUrl(response.data)
        if (isMounted.current) {
          setPortraitUrl(url)
          setPortraitError("")
          if (!silent) setPortraitLoading(false)
        }
        return url
      } catch (error) {
        console.error("No se pudo obtener el retrato", error)
        if (isMounted.current) {
          if (!silent) setPortraitLoading(false)
          setPortraitError("No se pudo cargar el retrato.")
        }
        throw error
      }
    },
    [id],
  )

  useEffect(() => {
    if (!isMounted.current) return
    loadInventory()
    loadCatalog()
    updatePortrait().catch(() => {})
  }, [id, loadInventory, loadCatalog, updatePortrait])

  const pollPortraitChange = useCallback(
    async (previousUrl) => {
      let lastError = ""
      const deadline = Date.now() + PORTRAIT_REFRESH_TIMEOUT_MS
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, PORTRAIT_REFRESH_POLL_MS))
        try {
          const nextUrl = await updatePortrait(true)
          if (nextUrl !== previousUrl) {
            return { changed: true, url: nextUrl }
          }
        } catch (error) {
          lastError = "Error al refrescar el retrato."
        }
      }
      return { changed: false, error: lastError }
    },
    [updatePortrait],
  )

  const handleAdd = useCallback(async () => {
    const sanitizedQty = Number(qty)
    if (!selectedItemId || Number.isNaN(sanitizedQty) || sanitizedQty <= 0) return
    try {
      await api.post(`/characters/${id}/inventory`, {
        itemId: selectedItemId,
        qty: sanitizedQty,
      })
      setQty(1)
      loadInventory()
    } catch (error) {
      console.error("No se pudo anadir el item", error)
    }
  }, [id, loadInventory, qty, selectedItemId])

  const handleToggleEquip = useCallback(
    async (entry) => {
      if (itemStatus[entry.id]?.pending) return
      const nextValue = !entry.equipped
      const prevPortrait = portraitUrl
      if (isMounted.current) {
        setItemStatus((prev) => ({
          ...prev,
          [entry.id]: { pending: true, message: "Actualizando retrato…", error: "" },
        }))
      }
      try {
        await equipItem(entry.id, nextValue)
        await loadInventory()
        const result = await pollPortraitChange(prevPortrait)
        if (!isMounted.current) return
        if (result.changed) {
          setItemStatus((prev) => ({
            ...prev,
            [entry.id]: { pending: false, message: "Retrato actualizado.", error: "" },
          }))
        } else {
          const errorMessage = result?.error || "No se detecto un cambio en el retrato."
          setItemStatus((prev) => ({
            ...prev,
            [entry.id]: { pending: false, message: errorMessage, error: errorMessage },
          }))
        }
      } catch (error) {
        console.error("Error al equipar/unequipar el item", error)
        if (!isMounted.current) return
        setItemStatus((prev) => ({
          ...prev,
          [entry.id]: {
            pending: false,
            message: "No se pudo actualizar el item.",
            error: "No se pudo actualizar el item.",
          },
        }))
        updatePortrait(true).catch(() => {})
      }
    },
    [itemStatus, loadInventory, pollPortraitChange, portraitUrl, updatePortrait],
  )

  const equippedItems = useMemo(() => items.filter((entry) => entry.equipped), [items])
  const storedItems = useMemo(
    () => items.filter((entry) => !entry.equipped && isStoredItem(entry)),
    [items],
  )
  const carriedItems = useMemo(
    () => items.filter((entry) => !entry.equipped && !isStoredItem(entry)),
    [items],
  )

  useEffect(() => {
    if (!selectedItemId && catalog.length > 0) {
      setSelectedItemId(catalog[0].id)
    }
  }, [catalog, selectedItemId])

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Inventario</h2>
        <p className="text-sm text-slate-400">
          Gestiona el equipo equipado, lo que llevas encima y lo que guardas a salvo.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,3fr),minmax(0,2fr)]">
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 shadow-md shadow-slate-950/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Retrato actual</h3>
              <p className="text-sm text-slate-400">Tu apariencia se actualiza con los cambios de equipo.</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600/60 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/60 hover:text-white"
              onClick={() => updatePortrait().catch(() => {})}
              disabled={portraitLoading}
            >
              Refrescar
            </button>
          </div>
          <div className="mt-4 flex items-center justify-center rounded-2xl border border-dashed border-slate-700/70 bg-slate-950/60 p-6">
            {portraitLoading ? (
              <span className="text-sm text-slate-400">Cargando retrato…</span>
            ) : portraitUrl ? (
              <img
                src={portraitUrl}
                alt="Retrato del personaje"
                className="h-40 w-40 rounded-2xl object-cover shadow-lg shadow-slate-950/40"
              />
            ) : portraitError ? (
              <span className="text-sm text-red-400">{portraitError}</span>
            ) : (
              <span className="text-sm text-slate-400">Sin retrato disponible</span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 shadow-md shadow-slate-950/30">
          <h3 className="text-lg font-semibold text-white">Anadir item</h3>
          <p className="text-sm text-slate-400">
            Busca en el catalogo y agrega objetos a tu inventario o reservas.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
            <select
              value={selectedItemId}
              onChange={(event) => setSelectedItemId(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              {catalog.length === 0 && <option value="">Cargando…</option>}
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(event) => setQty(event.target.value)}
                className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="button"
                className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                onClick={handleAdd}
                disabled={!selectedItemId}
              >
                Anadir
              </button>
            </div>
          </div>
        </div>
      </section>

      <InventorySection
        title="Equipado"
        description="Objetos activos que afectan a tu retrato y estadisticas."
        emptyMessage="No tienes items equipados en este momento."
        items={equippedItems}
        onToggle={handleToggleEquip}
        itemStatus={itemStatus}
      />

      <InventorySection
        title="Bolsa"
        description="Equipo listo para usar durante la aventura."
        emptyMessage="Tu bolsa esta vacia."
        items={carriedItems}
        onToggle={handleToggleEquip}
        itemStatus={itemStatus}
      />

      <InventorySection
        title="Almacenado"
        description="Objetos guardados en cofres, carromatos u otras reservas."
        emptyMessage="No hay items almacenados."
        items={storedItems}
        onToggle={handleToggleEquip}
        itemStatus={itemStatus}
      />
    </div>
  )
}




