import type React from "react"
import ReactDOM from "react-dom"

type SuccessModalProps = {
  open: boolean
  title?: string
  message: string
  onClose: () => void
}

const OVERLAY_STYLE: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
  zIndex: 100000, backgroundColor: "rgba(0,0,0,0.55)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "16px", boxSizing: "border-box",
}

const CheckCircleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="8 12.5 10.5 15 16 9" />
  </svg>
)

const CloseIconX = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export default function SuccessModal({ open, title = "Berhasil", message, onClose }: SuccessModalProps) {
  if (!open) return null

  return ReactDOM.createPortal(
    <div style={OVERLAY_STYLE} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="relative bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl w-full max-w-sm shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
        >
          <CloseIconX />
        </button>

        <div className="flex flex-col items-center text-center px-7 py-8">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center mb-4">
            <CheckCircleIcon />
          </div>
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">{message}</p>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 px-6 py-2 text-sm font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors shadow-sm"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
