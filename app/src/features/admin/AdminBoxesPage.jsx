import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../services/supabase/client'
import { subscribeToAllBoxes } from '../../services/realtime/realtimeService'
import { formatBoxStatus, formatDateTime } from '../../utils/format'
import { Card, Button, Badge, Modal, SkeletonTable, ResponsiveTable } from '../../components/ui'

export default function AdminBoxesPage() {
  const [boxes, setBoxes] = useState([])
  const [members, setMembers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  // New Box Form
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [creating, setCreating] = useState(false)

  // Shipment Modal
  const [shippingBox, setShippingBox] = useState(null)
  const [courier, setCourier] = useState('JNE')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [shippingNotes, setShippingNotes] = useState('')
  const [shippingUpdating, setShippingUpdating] = useState(false)

  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const loadData = async () => {
    setLoading(true)

    // 1. Ambil kotak dengan accounts & shipments (tanpa direct profiles PostgREST join untuk mencegah PGRST200)
    const { data: bList, error: bErr } = await supabase
      .from('savings_boxes')
      .select('*, accounts:account_id(account_number), shipments(*)')
      .order('created_at', { ascending: false })

    if (bErr) {
      console.error('Error fetching savings_boxes:', bErr)
    }

    // 2. Ambil member & rekening
    const [mRes, aRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, address'),
      supabase.from('accounts').select('id, account_number, user_id').eq('status', 'ACTIVE'),
    ])

    const profMap = new Map((mRes.data || []).map((p) => [p.id, p]))

    if (bList) {
      const enriched = bList.map((b) => ({
        ...b,
        profiles: profMap.get(b.user_id) || null,
      }))
      setBoxes(enriched)
    } else {
      setBoxes([])
    }

    if (mRes.data) setMembers(mRes.data)
    if (aRes.data) setAccounts(aRes.data)

    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const unsub = subscribeToAllBoxes(() => loadData())
    return () => unsub?.()
  }, [])

  // Create New Savings Box
  const handleCreateBox = async (e) => {
    e.preventDefault()
    if (!selectedUserId || !selectedAccountId) {
      setErrorMsg('Pilih member dan rekening tabungan.')
      return
    }

    setCreating(true)
    setErrorMsg('')
    setMessage('')

    const boxCode = 'BOX-' + Math.floor(100000 + Math.random() * 900000)

    const { data, error } = await supabase
      .from('savings_boxes')
      .insert({
        box_code: boxCode,
        user_id: selectedUserId,
        account_id: selectedAccountId,
        status: 'NFC_PENDING',
        prepared_at: new Date().toISOString(),
      })
      .select()
      .single()

    setCreating(false)

    if (error) {
      setErrorMsg('Gagal membuat kotak: ' + error.message)
    } else {
      setMessage(`Kotak tabungan ${boxCode} berhasil dibuat! Lanjutkan penulisan NFC.`)
      setShowCreateModal(false)
      loadData()
    }
  }

  // Submit Shipment Resi
  const handleSaveShipment = async (e) => {
    e.preventDefault()
    if (!shippingBox || !trackingNumber.trim()) return

    setShippingUpdating(true)
    setErrorMsg('')

    const { error: shipErr } = await supabase.from('shipments').upsert({
      box_id: shippingBox.id,
      courier,
      tracking_number: trackingNumber.trim(),
      status: 'SHIPPED',
      shipped_at: new Date().toISOString(),
      notes: shippingNotes.trim() || null,
    })

    const { error: boxErr } = await supabase
      .from('savings_boxes')
      .update({
        status: 'SHIPPED',
        shipped_at: new Date().toISOString(),
      })
      .eq('id', shippingBox.id)

    setShippingUpdating(false)

    if (shipErr || boxErr) {
      setErrorMsg('Gagal memperbarui status pengiriman: ' + (shipErr?.message || boxErr?.message))
    } else {
      await supabase.from('notifications').insert({
        user_id: shippingBox.user_id,
        type: 'BOX_SHIPPED',
        title: 'Kotak Tabungan Sedang Dikirim',
        body: `Kotak fisik Anda (${shippingBox.box_code}) telah dikirim via ${courier} No. Resi: ${trackingNumber}.`,
        data: { box_id: shippingBox.id, tracking_number: trackingNumber },
      })

      setMessage(`Pengiriman kotak ${shippingBox.box_code} dicatat dan notifikasi telah dikirim ke member!`)
      setShippingBox(null)
      loadData()
    }
  }

  const memberAccounts = accounts.filter((a) => a.user_id === selectedUserId)

  const columns = [
    {
      key: 'box_code',
      label: 'Kode Kotak',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: '800', color: '#c4b5fd' }}>
          {v}
        </span>
      ),
    },
    {
      key: 'profiles',
      label: 'Pemilik & Alamat',
      render: (v) => (
        <div>
          <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{v?.full_name || 'Nasabah'}</div>
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            maxWidth: '220px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {v?.address || 'Alamat belum diatur'}
          </div>
        </div>
      ),
    },
    {
      key: 'accounts',
      label: 'Rekening',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', color: '#d4a853', fontWeight: '700' }}>
          {v?.account_number || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status Kotak',
      render: (v) => {
        const variant = v === 'ACTIVE' ? 'success' : v === 'SHIPPED' ? 'info' : 'warning'
        return <Badge variant={variant}>{formatBoxStatus(v)}</Badge>
      },
    },
    {
      key: 'shipments',
      label: 'Ekspedisi / Resi',
      render: (v) => {
        const ship = v && v.length > 0 ? v[0] : null
        return ship ? (
          <div>
            <b style={{ color: 'var(--text-primary)' }}>{ship.courier}</b>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)' }}>
              {ship.tracking_number}
            </div>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>Belum Dikirim</span>
        )
      },
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (_, row) => {
        const ship = row.shipments && row.shipments.length > 0 ? row.shipments[0] : null
        return (
          <div style={{ display: 'flex', gap: '6px' }}>
            <Button variant="outline" size="sm" to="/admin/nfc">
              📡 NFC
            </Button>
            {row.status !== 'ACTIVE' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setShippingBox(row)
                  setCourier(ship?.courier || 'JNE')
                  setTrackingNumber(ship?.tracking_number || '')
                }}
              >
                Kirim
              </Button>
            )}
          </div>
        )
      },
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
              HARDWARE & LOGISTIK
            </span>
            <Badge variant="neutral">{boxes.length} Kotak Terdata</Badge>
          </div>
          <h1 style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Manajemen Kotak Tabungan Fisik
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
            Pembuatan nomor seri kotak, pengaitan ke rekening nasabah, penulisan NFC, dan resi ekspedisi
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setShowCreateModal(true)
            setErrorMsg('')
          }}
        >
          ＋ Siapkan Kotak Baru
        </Button>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#34d399',
          fontSize: '12.5px',
          fontWeight: '700',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>✅</span>
          <span>{message}</span>
        </div>
      )}

      {/* Table of Boxes */}
      <Card variant="glass" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '20px' }}>
            <SkeletonTable rows={5} columns={6} />
          </div>
        ) : (
          <ResponsiveTable
            columns={columns}
            data={boxes}
            keyField="id"
            emptyMessage="Belum ada kotak tabungan fisik yang dibuat."
          />
        )}
      </Card>

      {/* Modal Siapkan Kotak Baru */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Siapkan Kotak Tabungan Baru"
        maxWidth="460px"
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', margin: '0 0 16px', lineHeight: '1.5' }}>
          Pilih nasabah dan rekening tabungan yang telah aktif untuk dipasangkan ke kotak fisik yang akan dikirimkan.
        </p>

        {errorMsg && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '12px',
            borderRadius: '8px',
            marginBottom: '14px',
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreateBox} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Pilih Nasabah
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value)
                setSelectedAccountId('')
              }}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Pilih Nasabah...</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Pilih Rekening Terkait
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={!selectedUserId}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="">
                {selectedUserId ? (memberAccounts.length > 0 ? 'Pilih Rekening...' : 'Tidak ada rekening aktif') : 'Pilih nasabah terlebih dahulu'}
              </option>
              {memberAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_number}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={creating} disabled={creating || !selectedAccountId}>
              {creating ? 'Membuat...' : 'Buat Kotak & Generate Kode ➔'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Input Resi Pengiriman */}
      <Modal
        isOpen={Boolean(shippingBox)}
        onClose={() => setShippingBox(null)}
        title="Input Resi Pengiriman Kotak"
        maxWidth="460px"
      >
        <div style={{
          padding: '10px 12px',
          background: 'rgba(139,92,246,0.08)',
          border: '1px solid rgba(139,92,246,0.25)',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}>
          Kotak: <b style={{ color: '#c4b5fd' }}>{shippingBox?.box_code}</b> • Penerima: <b style={{ color: 'var(--text-primary)' }}>{shippingBox?.profiles?.full_name}</b>
        </div>

        <form onSubmit={handleSaveShipment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Jasa Kurir / Ekspedisi
            </label>
            <select
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="JNE">JNE Express</option>
              <option value="J&T">J&T Express</option>
              <option value="SiCepat">SiCepat Ekspres</option>
              <option value="Pos Indonesia">Pos Indonesia</option>
              <option value="Kurir Bank">Kurir Resmi Narayan Bank</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Nomor Resi / AWB
            </label>
            <input
              type="text"
              placeholder="Contoh: JNE01928381923"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Catatan Pengiriman (Opsional)
            </label>
            <input
              type="text"
              placeholder="Estimasi tiba atau catatan khusus kurir"
              value={shippingNotes}
              onChange={(e) => setShippingNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated, #161b22)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button type="button" variant="outline" onClick={() => setShippingBox(null)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" loading={shippingUpdating} disabled={shippingUpdating || !trackingNumber.trim()}>
              {shippingUpdating ? 'Menyimpan...' : 'Kirim Kotak & Update Status ➔'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
