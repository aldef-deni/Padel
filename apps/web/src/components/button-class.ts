export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'dark'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-600 text-white shadow-sm shadow-emerald-900/20 hover:bg-emerald-500 focus-visible:outline-emerald-600 disabled:bg-emerald-600/50',
  secondary:
    'border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/5 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50',
  danger: 'border border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50 disabled:opacity-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50',
  dark: 'bg-ink-900 text-white hover:bg-ink-800 disabled:opacity-50',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-sm',
}

/** Class list for links styled as buttons (react-router <Link>). */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') {
  return `inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`
}
