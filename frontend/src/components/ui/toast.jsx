import { create } from 'zustand'

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

export function Toaster() {
  const { toasts, remove } = useToastStore()
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          className={`flex cursor-pointer flex-col gap-1 rounded-lg border px-4 py-3 shadow-lg transition-all ${
            t.variant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-white text-foreground'
          }`}
        >
          {t.title && <p className="text-sm font-semibold">{t.title}</p>}
          {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
        </div>
      ))}
    </div>
  )
}
