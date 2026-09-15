import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

let toastId = 0

const COLORS = {
  success: { border: '#00E676', icon: '#00E676' },
  error: { border: '#FF5252', icon: '#FF5252' },
  info: { border: '#8FA3FF', icon: '#8FA3FF' },
}

const ICONS = {
  success: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  info: <Info size={16} />,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = ++toastId
    setToasts((prev) => [...prev.slice(-2), { id, message, type }])
    if (duration > 0) {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
    }
    return id
  }, [])

  const toast = useMemo(
    () => ({
      success: (msg, dur) => addToast(msg, 'success', dur),
      error: (msg, dur) => addToast(msg, 'error', dur),
      info: (msg, dur) => addToast(msg, 'info', dur),
    }),
    [addToast],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: '420px',
          width: 'calc(100vw - 2rem)',
          pointerEvents: 'none',
        }}
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const c = COLORS[t.type] ?? COLORS.info
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 60, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                style={{
                  background: 'rgba(1,4,20,0.96)',
                  border: `1px solid ${c.border}`,
                  borderRadius: '4px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  backdropFilter: 'blur(12px)',
                  boxShadow: `0 0 24px ${c.border}30`,
                  pointerEvents: 'auto',
                }}
              >
                <span style={{ color: c.icon, flexShrink: 0, marginTop: '1px' }}>
                  {ICONS[t.type]}
                </span>
                <p
                  style={{
                    flex: 1,
                    margin: 0,
                    fontSize: '0.85rem',
                    color: 'rgba(255,255,255,0.9)',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}
                >
                  {t.message}
                </p>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  <X size={14} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
