import { forwardRef } from 'react'

/**
 * Modern Button Component (Standard 2026)
 * Variants: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'icon'
 * Sizes: 'sm' | 'md' | 'lg'
 */
export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon = null,
    iconRight = null,
    className = '',
    style = {},
    type = 'button',
    ...props
  },
  ref
) {
  const sizeClasses = {
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  }

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
    success: 'btn-success',
    icon: 'btn-icon',
  }

  const baseClass = `btn ${variantClasses[variant] || 'btn-primary'} ${sizeClasses[size] || ''} ${loading ? 'btn-loading' : ''} ${className}`.trim()

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={baseClass}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        userSelect: 'none',
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span className="loading-spinner-sm" aria-hidden="true" />
      ) : icon ? (
        <span className="btn-icon-prefix" aria-hidden="true">{icon}</span>
      ) : null}
      
      <span>{children}</span>

      {!loading && iconRight && (
        <span className="btn-icon-suffix" aria-hidden="true">{iconRight}</span>
      )}
    </button>
  )
})

export default Button
