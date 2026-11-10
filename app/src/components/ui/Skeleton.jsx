/**
 * Modern Skeleton Loader Component (Standard 2026)
 */
export function Skeleton({
  variant = 'text', // 'text' | 'circle' | 'card' | 'rect'
  width = '100%',
  height = '14px',
  borderRadius = '8px',
  className = '',
  style = {},
  ...props
}) {
  const getStyle = () => {
    switch (variant) {
      case 'circle':
        return {
          width: width === '100%' ? '40px' : width,
          height: height === '14px' ? '40px' : height,
          borderRadius: '50%',
        }
      case 'card':
        return {
          width,
          height: height === '14px' ? '120px' : height,
          borderRadius: '16px',
        }
      case 'rect':
        return { width, height, borderRadius }
      case 'text':
      default:
        return { width, height, borderRadius }
    }
  }

  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={{
        ...getStyle(),
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  )
}

export function SkeletonGrid({ count = 3, height = '120px' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="card" height={height} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Skeleton height="36px" borderRadius="10px" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height="48px" borderRadius="10px" style={{ opacity: 0.7 }} />
      ))}
    </div>
  )
}

export default Skeleton
