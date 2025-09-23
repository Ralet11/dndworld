import { useMemo } from 'react'

const ImageCarousel = ({ images = [], activeIndex = 0, onChange }) => {
  const { currentImage, index } = useMemo(() => {
    if (!images.length) {
      return { currentImage: null, index: 0 }
    }

    const normalizedIndex = Math.min(Math.max(activeIndex, 0), images.length - 1)
    return { currentImage: images[normalizedIndex], index: normalizedIndex }
  }, [images, activeIndex])

  if (!images.length) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-400">
        Adjunta imagenes al escenario para mostrarlas al grupo.
      </div>
    )
  }

  const handlePrev = () => {
    const nextIndex = (index - 1 + images.length) % images.length
    onChange?.(nextIndex)
  }

  const handleNext = () => {
    const nextIndex = (index + 1) % images.length
    onChange?.(nextIndex)
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80">
      <div className="relative flex items-center justify-center">
        <img
          src={currentImage?.url}
          alt={currentImage?.label ?? `Imagen ${index + 1}`}
          className="h-60 w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-4 text-sm text-parchment">
          {currentImage?.label ?? `Imagen ${index + 1}`} ({index + 1}/{images.length})
        </div>
      </div>
      <div className="absolute inset-y-0 left-0 flex items-center">
        <button
          type="button"
          onClick={handlePrev}
          className="m-3 rounded-full border border-slate-700 bg-slate-900/70 p-2 text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
        >
          {'<'}
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          type="button"
          onClick={handleNext}
          className="m-3 rounded-full border border-slate-700 bg-slate-900/70 p-2 text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
        >
          {'>'}
        </button>
      </div>
    </div>
  )
}

export default ImageCarousel
