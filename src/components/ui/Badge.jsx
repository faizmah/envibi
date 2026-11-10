/**
 * Modern Status Badge Component (Standard 2026)
 * Variants: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'
 */
export function Badge({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
  style = {},
  ...props
}) {
  const variantClasses = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    neutral: 'badge-neutral',
    accent: 'badge-accent',
  }

  const dotColors = {
    success: 'var(--success, #10b981)',
    warning: 'var(--warning, #f59e0b)',
    danger: 'var(--danger, #ef4444)',
    info: 'var(--info, #3b82f6)',
    neutral: 'var(--text-muted, #8b949e)',
    accent: 'var(--accent, #d4a853)',
  }

  return (
    <span
      className={`badge ${variantClasses[variant] || 'badge-neutral'} ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.02em',
        ...style,
      }}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: dotColors[variant] || 'currentColor',
            display: 'inline-block',
          }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

export default Badge
