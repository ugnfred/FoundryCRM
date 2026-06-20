import { create } from 'zustand'
import { useEffect } from 'react'

const useToastStore = create((set) => ({
  toasts: [],
  add: (toast) => set((s) => ({ toasts: [...s.toasts, { id: Date.now(), ...toast }] })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function useToast() {
  const { add } = useToastStore()
  return {
    toast: ({ title, description, variant = 'default' }) => {
      add({ title, description, variant })
    },
  }
}

function Toast({ t, remove }) {
  useEffect(() => {
    const timer = setTimeout(() => remove(t.id), 3000)
    return () => clearTimeout(timer)
  }, [t.id, remove])

  return (
    <div
      onClick={() => remove(t.id)}
      className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-4 py-3 shadow-lg transition-all ${
        t.variant === 'destructive'
          ? 'bg-gray-900 border-l-4 border-red-500 border-r-0 border-t-0 border-b-0 text-white'
          : 'bg-white text-foreground border'
      }`}
    >
      {t.title && <p className="text-sm font-semibold">{t.title}</p>}
      {t.description && (
        <p className={`text-xs ${t.variant === 'destructive' ? 'text-gray-300' : 'text-muted-foreground'}`}>
          {t.description}
        </p>
      )}
    </div>
  )
}

export function Toaster() {
  const { toasts, remove } = useToastStore()
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => <Toast key={t.id} t={t} remove={remove} />)}
    </div>
  )
}
