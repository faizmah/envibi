import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase/client'
import { formatDateTime } from '../../utils/format'

export default function AdminAuditPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('ALL')
  const [selectedLog, setSelectedLog] = useState(null)

  const loadLogs = async () => {
    setLoading(true)

    let query = supabase
      .from('audit_logs')
      .select('*, profiles:actor_id(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filterAction !== 'ALL') {
      query = query.eq('action', filterAction)
    }

    const { data } = await query
    if (data) setLogs(data)
    setLoading(false)
  }

  useEffect(() => {
    loadLogs()
  }, [filterAction])

  const actionTypes = Array.from(new Set(logs.map((l) => l.action)))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>Jejak Audit Sistem (Audit Trail)</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
            Catatan kekal seluruh aktivitas operasional penting bank (Bersifat Append-Only, Dilarang Hapus)
          </p>
        </div>

        <div>
          <select
            className="form-field"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{ margin: 0, maxWidth: '240px' }}
          >
            <option value="ALL">Semua Aksi</option>
            {actionTypes.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedLog ? '1fr 380px' : '1fr', gap: '20px' }}>
        {/* Table of Audit Logs */}
        <div className="card">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--fg-muted)' }}>Memuat log audit...</p>
            </div>
          ) : logs.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                    <th style={{ padding: '8px 12px' }}>Waktu</th>
                    <th style={{ padding: '8px 12px' }}>Aksi</th>
                    <th style={{ padding: '8px 12px' }}>Aktor</th>
                    <th style={{ padding: '8px 12px' }}>Entitas</th>
                    <th style={{ padding: '8px 12px' }}>Rincian</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid rgba(220, 230, 240, 0.05)',
                        background: selectedLog?.id === log.id ? 'rgba(195, 154, 88, 0.1)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 12px', color: 'var(--fg-muted)' }}>
                        {formatDateTime(log.created_at)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: '800', color: 'var(--accent2)' }}>{log.action}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {log.profiles?.full_name || log.profiles?.email || 'Sistem / Guest'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--fg-muted)' }}>
                        {log.entity_type || '-'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          Lihat Payload
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--fg-muted)', fontSize: '12px', textAlign: 'center', margin: '30px 0' }}>
              Belum ada riwayat audit log.
            </p>
          )}
        </div>

        {/* Selected Audit Log Payload Sidebar */}
        {selectedLog && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 className="card-title">Payload Audit</h3>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setSelectedLog(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Aksi:</span>
                <b style={{ color: 'var(--accent2)' }}>{selectedLog.action}</b>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted)', display: 'block' }}>ID Entitas:</span>
                <code>{selectedLog.entity_id || '-'}</code>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Waktu:</span>
                <span>{formatDateTime(selectedLog.created_at)}</span>
              </div>

              {selectedLog.old_data && (
                <div style={{ marginTop: '8px' }}>
                  <span style={{ color: 'var(--fg-muted)', display: 'block', marginBottom: '4px' }}>Data Sebelum (Old Data):</span>
                  <pre style={{ background: '#0e1722', padding: '10px', borderRadius: '8px', overflowX: 'auto', fontSize: '11px', color: '#ff8a80' }}>
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_data && (
                <div style={{ marginTop: '8px' }}>
                  <span style={{ color: 'var(--fg-muted)', display: 'block', marginBottom: '4px' }}>Data Baru (New Data):</span>
                  <pre style={{ background: '#0e1722', padding: '10px', borderRadius: '8px', overflowX: 'auto', fontSize: '11px', color: '#65d69a' }}>
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

