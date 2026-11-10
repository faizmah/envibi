import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase/client'
import { formatDateTime } from '../../utils/format'
import { Card, Button, Badge, SkeletonTable, ResponsiveTable } from '../../components/ui'

export default function AdminAuditPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState('ALL')
  const [selectedLog, setSelectedLog] = useState(null)

  const loadLogs = async () => {
    setLoading(true)

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filterAction !== 'ALL') {
      query = query.eq('action', filterAction)
    }

    const { data: logList } = await query

    // Manual profiles join untuk mencegah PGRST200
    if (logList && logList.length > 0) {
      const actorIds = [...new Set(logList.map((l) => l.actor_id).filter(Boolean))]
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', actorIds)

      const profMap = new Map((profs || []).map((p) => [p.id, p]))
      const enriched = logList.map((l) => ({
        ...l,
        profiles: profMap.get(l.actor_id) || null,
      }))
      setLogs(enriched)
    } else {
      setLogs([])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadLogs()
  }, [filterAction])

  const actionTypes = Array.from(new Set(logs.map((l) => l.action)))

  const columns = [
    {
      key: 'created_at',
      label: 'Waktu',
      render: (v) => (
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          {formatDateTime(v)}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Aksi Sistem',
      render: (v) => (
        <span style={{
          fontFamily: 'monospace',
          fontWeight: '800',
          color: v.includes('REJECT') || v.includes('DELET') ? '#f87171' : v.includes('APPROVE') || v.includes('CREATE') ? '#10b981' : '#c4b5fd',
        }}>
          {v}
        </span>
      ),
    },
    {
      key: 'profiles',
      label: 'Aktor / Eksekutor',
      render: (v) => (
        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
          {v?.full_name || v?.email || 'Sistem Otomatis'}
        </span>
      ),
    },
    {
      key: 'entity_type',
      label: 'Entitas Target',
      render: (v, row) => (
        <div>
          <Badge variant="neutral">{v || 'System'}</Badge>
          {row.entity_id && (
            <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
              {row.entity_id.slice(0, 8)}...
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Inspeksi',
      render: (_, row) => (
        <Button
          variant={selectedLog?.id === row.id ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setSelectedLog(row)}
        >
          {selectedLog?.id === row.id ? 'Terbuka' : 'Payload'}
        </Button>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              JEJAK AUDIT & KEAMANAN
            </span>
            <Badge variant="neutral">Append-Only Log</Badge>
          </div>
          <h1 style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Jejak Audit Sistem (Audit Trail)
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
            Catatan kekal seluruh aktivitas operasional penting bank (bersifat append-only dan tidak dapat dihapus)
          </p>
        </div>

        <div>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(139,92,246,0.3)',
              background: 'rgba(139,92,246,0.06)',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              outline: 'none',
              boxSizing: 'border-box',
              minWidth: '200px',
            }}
          >
            <option value="ALL">Semua Jenis Aksi</option>
            {actionTypes.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedLog ? 'minmax(0, 1fr) 380px' : '1fr',
        gap: '20px',
        alignItems: 'start',
      }}>
        {/* Table of Audit Logs */}
        <Card variant="glass" style={{ padding: '0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '20px' }}>
              <SkeletonTable rows={6} columns={5} />
            </div>
          ) : (
            <ResponsiveTable
              columns={columns}
              data={logs}
              keyField="id"
              emptyMessage="Belum ada riwayat audit log."
            />
          )}
        </Card>

        {/* Selected Audit Log Payload Sidebar */}
        {selectedLog && (
          <Card variant="elevated" style={{ padding: '20px', border: '1px solid rgba(139,92,246,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#c4b5fd' }}>
                Payload Audit Trail
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                style={{
                  border: 'none',
                  background: 'rgba(240,246,252,0.08)',
                  color: 'var(--text-muted)',
                  borderRadius: '6px',
                  width: '26px',
                  height: '26px',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Aksi Sistem:</span>
                <b style={{ color: '#d4a853', fontFamily: 'monospace' }}>{selectedLog.action}</b>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>ID Entitas:</span>
                <code style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{selectedLog.entity_id || '-'}</code>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Waktu Eksekusi:</span>
                <span style={{ color: 'var(--text-primary)' }}>{formatDateTime(selectedLog.created_at)}</span>
              </div>

              {selectedLog.old_data && (
                <div style={{ marginTop: '6px' }}>
                  <span style={{ color: '#f87171', fontSize: '11px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                    Data Sebelum (Old Data):
                  </span>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: '12px',
                    borderRadius: '8px',
                    overflowX: 'auto',
                    fontSize: '11px',
                    color: '#fca5a5',
                    border: '1px solid rgba(239,68,68,0.2)',
                    margin: 0,
                  }}>
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_data && (
                <div style={{ marginTop: '6px' }}>
                  <span style={{ color: '#34d399', fontSize: '11px', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                    Data Baru (New Data):
                  </span>
                  <pre style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: '12px',
                    borderRadius: '8px',
                    overflowX: 'auto',
                    fontSize: '11px',
                    color: '#86efac',
                    border: '1px solid rgba(16,185,129,0.2)',
                    margin: 0,
                  }}>
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
