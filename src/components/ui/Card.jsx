/**
 * Modern Card Component (Standard 2026)
 * Variants: 'surface' | 'glass' | 'elevated' | 'gradient' | 'interactive'
 */
export function Card({
  children,
  variant = 'surface',
  header = null,
  title = null,
  subtitle = null,
  action = null,
  className = '',
  style = {},
  onClick = null,
  ...props
}) {
  const variantClasses = {
    surface: 'card',
    glass: 'card-glass',
    elevated: 'card-elevated',
    gradient: 'card-gradient',
    interactive: 'card card-interactive',
  }

  const baseClass = `${variantClasses[variant] || 'card'} ${className}`.trim()

  return (
    <div
      className={baseClass}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        ...style,
      }}
      {...props}
    >
      {(header || title || subtitle || action) && (
        <div className="card-header" style={{ marginBottom: '16px' }}>
          {header ? (
            header
          ) : (
            <div>
              {title && <h3 className="card-title">{title}</h3>}
              {subtitle && (
                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
                  {subtitle}
                </p>
              )}
            </div>
          )}
          {action && <div className="card-action">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export default Card
