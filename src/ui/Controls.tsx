import { Minus, Plus } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  children: ReactNode
}

/** Square icon button with a 44 pixel touch target and an accessible name. */
export function IconButton({ label, active, children, className = '', ...rest }: IconButtonProps) {
  return (
    <button type="button" className={`v-icon-btn ${active ? 'is-active' : ''} ${className}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}

interface SegmentedProps<T extends string | number> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="v-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'is-on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface ToggleProps {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="v-row v-toggle" onClick={() => onChange(!checked)}>
      <span className="v-row-text">
        <span className="v-row-title">{label}</span>
        {hint ? <span className="v-row-hint">{hint}</span> : null}
      </span>
      <span className={`v-switch ${checked ? 'is-on' : ''}`} aria-hidden="true">
        <span />
      </span>
    </button>
  )
}

interface StepperProps {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  onChange: (value: number) => void
}

export function Stepper({ label, value, min, max, unit = '', onChange }: StepperProps) {
  return (
    <div className="v-row">
      <span className="v-row-text">
        <span className="v-row-title">{label}</span>
      </span>
      <span className="v-stepper">
        <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
          <Minus size={16} strokeWidth={1.5} />
        </button>
        <output aria-live="polite">{value}{unit}</output>
        <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
          <Plus size={16} strokeWidth={1.5} />
        </button>
      </span>
    </div>
  )
}
