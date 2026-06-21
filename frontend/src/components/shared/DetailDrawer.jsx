import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * DetailDrawer — right-side slide-over panel (580px desktop)
 *
 * Props:
 *   open, onClose, title, subtitle, status, statusLabel
 *   headerActions: [{ icon: LucideIcon, onClick, tooltip }]
 *   primaryAction: { label, onClick, disabled, disabledReason, loading, className }
 *   secondaryActions: [{ label, onClick, icon, disabled, loading, disabledReason }]
 *   destructiveAction: { label, onClick, disabled }
 *   isLoading, children
 */

const STATUS_STYLES = {
  draft:          'bg-gray-100 text-gray-700',
  sent:           'bg-blue-100 text-blue-700',
  accepted:       'bg-green-100 text-green-700',
  converted:      'bg-purple-100 text-purple-700',
  confirmed:      'bg-blue-100 text-blue-700',
  dispatched:     'bg-indigo-100 text-indigo-700',
  paid:           'bg-green-100 text-green-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  overdue:        'bg-red-100 text-red-700',
  cancelled:      'bg-red-100 text-red-600',
  open:           'bg-gray-100 text-gray-700',
  in_progress:    'bg-blue-100 text-blue-700',
  done:           'bg-green-100 text-green-700',
  lost:           'bg-red-100 text-red-600',
  received:       'bg-green-100 text-green-700',
  pending:        'bg-amber-100 text-amber-700',
  applied:        'bg-purple-100 text-purple-700',
  partial:        'bg-amber-100 text-amber-700',
}

function StatusBadge({ status, label }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
      STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'
    )}>
      {label ?? status?.replace(/_/g, ' ')}
    </span>
  )
}

function DrawerSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-16 bg-gray-100 rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-5 bg-gray-200 rounded" />
        ))}
      </div>
      <div className="h-px bg-gray-100" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 rounded" />
        ))}
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-5 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  )
}

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  status,
  statusLabel,
  headerActions = [],
  primaryAction,
  secondaryActions = [],
  destructiveAction,
  isLoading = false,
  children,
}) {
  const hasFooter = primaryAction || secondaryActions.length > 0 || destructiveAction

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200" />

        {/* Panel — 580px on desktop to comfortably fit line-item tables */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl w-full md:w-[580px] data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        >
          {/* Header */}
          <div className="flex items-start gap-3 border-b px-6 py-4 shrink-0 bg-white">
            {/* Title block */}
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <DialogPrimitive.Title className="text-lg font-bold font-mono tracking-tight">
                  {title}
                </DialogPrimitive.Title>
                {status && <StatusBadge status={status} label={statusLabel} />}
              </div>
              {subtitle && (
                <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>

            {/* Header icon actions (PDF, copy link, etc.) */}
            {headerActions.length > 0 && (
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                {headerActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={action.onClick}
                    title={action.tooltip}
                    className="rounded-md p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <action.icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            )}

            {/* Close */}
            <DialogPrimitive.Close asChild>
              <button className="shrink-0 mt-0.5 rounded-md p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {isLoading ? <DrawerSkeleton /> : children}
          </div>

          {/* Footer */}
          {hasFooter && (
            <div className="shrink-0 border-t bg-gray-50 px-6 py-3.5 flex items-center justify-between gap-3">
              <div>
                {destructiveAction && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={destructiveAction.onClick}
                    disabled={destructiveAction.disabled}
                  >
                    {destructiveAction.label}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {secondaryActions.map((action, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={action.onClick}
                    disabled={action.disabled || action.loading}
                    title={action.disabled && action.disabledReason ? action.disabledReason : undefined}
                  >
                    {action.icon && <action.icon className="h-3.5 w-3.5 mr-1.5" />}
                    {action.loading ? 'Saving…' : action.label}
                  </Button>
                ))}
                {primaryAction && (
                  <Button
                    size="sm"
                    className={cn(
                      'bg-green-600 hover:bg-green-700 text-white',
                      primaryAction.className
                    )}
                    onClick={primaryAction.onClick}
                    disabled={primaryAction.disabled || primaryAction.loading}
                    title={primaryAction.disabled && primaryAction.disabledReason ? primaryAction.disabledReason : undefined}
                  >
                    {primaryAction.loading ? 'Saving…' : primaryAction.label}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Section label inside a drawer body */
export function DrawerSection({ title, children }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      {children}
    </div>
  )
}

/** Key-value grid for document meta fields */
export function DrawerFields({ fields }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      {fields.filter(Boolean).map(({ label, value }) => (
        <div key={label}>
          <dt className="text-slate-400 text-xs">{label}</dt>
          <dd className="font-medium text-slate-800 mt-0.5">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
