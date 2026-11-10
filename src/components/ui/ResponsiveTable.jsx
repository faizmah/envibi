/**
 * Responsive Adaptive Table Component (Standard 2026)
 * Menampilkan tabular view di desktop, dan kartu ringkas di layar mobile.
 */
export function ResponsiveTable({
  columns = [], // Array<{ key, label, render?, align? }>
  data = [],
  keyField = 'id',
  emptyMessage = 'Tidak ada data ditemukan.',
  renderMobileCard = null,
  className = '',
}) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          padding: '36px 20px',
          textAlign: 'center',
          color: 'var(--text-secondary, #8b949e)',
          fontSize: '13px',
          background: 'rgba(255, 255, 255, 0.015)',
          borderRadius: '12px',
          border: '1px dashed var(--border, rgba(240,246,252,0.1))',
        }}
      >
        <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>📭</span>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={`responsive-table-wrapper ${className}`.trim()}>
      {/* ─── Desktop View: Tabular Table ─── */}
      <div className="table-desktop-view" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border, rgba(240,246,252,0.1))', textAlign: 'left', color: 'var(--text-secondary, #8b949e)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '12px 14px',
                    fontWeight: '700',
                    fontSize: '11px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    textAlign: col.align || 'left',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={row[keyField] || index}
                style={{
                  borderBottom: '1px solid rgba(240,246,252,0.05)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(240,246,252,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '13px 14px',
                      textAlign: col.align || 'left',
                      verticalAlign: 'middle',
                    }}
                  >
                    {col.render ? col.render(row[col.key], row, index) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Mobile View: Adaptive Card List ─── */}
      <div className="table-mobile-view" style={{ display: 'none', flexDirection: 'column', gap: '10px' }}>
        {data.map((row, index) =>
          renderMobileCard ? (
            renderMobileCard(row, index)
          ) : (
            <div
              key={row[keyField] || index}
              style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'var(--bg-surface, #161b22)',
                border: '1px solid var(--border, rgba(240,246,252,0.1))',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {columns.map((col) => (
                <div
                  key={col.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ color: 'var(--text-muted, #656d76)', fontWeight: '600' }}>
                    {col.label}
                  </span>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary, #f0f6fc)' }}>
                    {col.render ? col.render(row[col.key], row, index) : row[col.key]}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .table-desktop-view { display: none !important; }
          .table-mobile-view { display: flex !important; }
        }
      `}</style>
    </div>
  )
}

export default ResponsiveTable
