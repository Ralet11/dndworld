import { useEffect } from 'react'

const Modal = ({ title, onClose, children }) => {
  useEffect(() => {
    const handleKeyUp = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    document.addEventListener('keyup', handleKeyUp)
    return () => document.removeEventListener('keyup', handleKeyUp)
  }, [onClose])

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-950/95 p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 transition hover:text-emerald-200"
          aria-label="Cerrar"
        >
          X
        </button>
        {title ? <h2 className="text-xl font-semibold text-parchment">{title}</h2> : null}
        <div className={title ? 'mt-6' : ''}>{children}</div>
      </div>
    </div>
  )
}

export default Modal
