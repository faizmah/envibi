import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../services/supabase/client'
import { subscribeToAllBoxes } from '../../services/realtime/realtimeService'
import { formatBoxStatus, formatDateTime } from '../../utils/format'

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

    // 1. Ambil kotak dengan relasi profile & account
    const { data: bList } = await supabase
      .from('savings_boxes')
      .select('*, profiles:user_id(full_name, email, address), accounts:account_id(account_number), shipments(*)')
      .order('created_at', { ascending: false })

    if (bList) setBoxes(bList)

    // 2. Ambil member & rekening
    const [mRes, aRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email'),
      supabase.from('accounts').select('id, account_number, user_id').eq('status', 'ACTIVE'),
    ])

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

    // Generate box code via RPC or DB function
    const boxCode = 'BOX-' + Math.floor(100000 + Math.random() * 900000)

    const { data, error } = await supabase.from('savings_boxes').insert({
      box_code: boxCode,
      user_id: selectedUserId,
      account_id: selectedAccountId,
      status: 'NFC_PENDING',
      prepared_at: new Date().toISOString(),
    }).select().single()

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

    // Update or insert shipment
    const { error: shipErr } = await supabase.from('shipments').upsert({
      box_id: shippingBox.id,
      courier,
      tracking_number: trackingNumber.trim(),
      status: 'SHIPPED',
      shipped_at: new Date().toISOString(),
      notes: shippingNotes.trim() || null,
    })

    // Update status box to SHIPPED
    const { error: boxErr } = await supabase
      .from('savings_boxes')
      .update({
        status: 'SHIPPED',
        shipped_at: new Date().toISOString(),
      })
      .eq('id', shippingBox.id)

    setShippingUpdating(false)

    if (shipErr || boxErr) {
      setErrorMsg('Gagal memperbarui status pengiriman.')
    } else {
      // Send notification to member
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>Manajemen Kotak Tabungan Fisik</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
            Pembuatan nomor seri kotak, pengaitan ke rekening nasabah, penulisan NFC, dan resi ekspedisi
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setShowCreateModal(true)
            setErrorMsg('')
          }}
        >
          ＋ Siapkan Kotak Tabungan Baru
        </button>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.18)', color: '#65d69a', fontSize: '12px', fontWeight: '700', marginBottom: '20px' }}>
          ✅ {message}
        </div>
      )}

      {/* Table of Boxes */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--fg-muted)' }}>Memuat kotak tabungan...</p>
          </div>
        ) : boxes.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Kode Kotak</th>
                  <th style={{ padding: '8px 12px' }}>Pemilik & Alamat</th>
                  <th style={{ padding: '8px 12px' }}>Rekening Tertaut</th>
                  <th style={{ padding: '8px 12px' }}>Status Kotak</th>
                  <th style={{ padding: '8px 12px' }}>Pengiriman / Resi</th>
                  <th style={{ padding: '8px 12px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {boxes.map((b) => {
                  const ship = b.shipments && b.shipments.length > 0 ? b.shipments[0] : null
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(220, 230, 240, 0.05)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '800' }}>{b.box_code}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <b>{b.profiles?.full_name || 'Member'}</b>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--fg-muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.profiles?.address || 'Alamat belum diisi'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{b.accounts?.account_number || '-'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`status ${b.status === 'ACTIVE' ? 'good' : b.status === 'SHIPPED' ? 'info' : 'wait'}`}>
                          {formatBoxStatus(b.status)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {ship ? (
                          <div>
                            <b>{ship.courier}</b>: {ship.tracking_number}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--fg-muted)', fontSize: '11px' }}>Belum Dikirim</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Link to="/admin/nfc" className="btn btn-sm btn-secondary">
                            📡 NFC
                          </Link>
                          {b.status !== 'ACTIVE' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => {
                                setShippingBox(b)
                                setCourier(ship?.courier || 'JNE')
                                setTrackingNumber(ship?.tracking_number || '')
                              }}
                            >
                              Kirim
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', textAlign: 'center', margin: '30px 0' }}>
            Belum ada kotak tabungan fisik yang dibuat.
          </p>
        )}
      </div>

      {/* Modal Siapkan Kotak Baru */}
      {showCreateModal && (
        <div className="member-portal-overlay">
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>Siapkan Kotak Tabungan Baru</h3>
            <p style={{ color: 'var(--fg-muted)', fontSize: '12px', margin: '0 0 16px' }}>
              Pilih member dan rekening yang telah disetujui untuk dihubungkan ke kotak fisik.
            </p>

            {errorMsg && (
              <div style={{ padding: '8px 12px', background: 'rgba(231, 76, 60, 0.2)', color: '#ff8a80', fontSize: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateBox} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">Pilih Member</label>
                <select
                  className="form-field"
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value)
                    setSelectedAccountId('')
                  }}
                  required
                >
                  <option value="">Pilih Member...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name || m.email} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Pilih Rekening Terkait</label>
                <select
                  className="form-field"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  disabled={!selectedUserId}
                  required
                >
                  <option value="">Pilih Rekening...</option>
                  {memberAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_number}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Batal
                </button>
                <button type="submit" disabled={creating} className="btn btn-primary">
                  {creating ? 'Membuat...' : 'Buat Kotak & Generate Kode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Input Resi Pengiriman */}
      {shippingBox && (
        <div className="member-portal-overlay">
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>Input Pengiriman Kotak</h3>
            <p style={{ color: 'var(--fg-muted)', fontSize: '12px', margin: '0 0 16px' }}>
              Kotak: <b>{shippingBox.box_code}</b> · Tujuan: <b>{shippingBox.profiles?.full_name}</b>
            </p>

            <form onSubmit={handleSaveShipment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">Jasa Kurir / Ekspedisi</label>
                <select
                  className="form-field"
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                >
                  <option value="JNE">JNE Express</option>
                  <option value="J&T">J&T Express</option>
                  <option value="SiCepat">SiCepat Ekspres</option>
                  <option value="Pos Indonesia">Pos Indonesia</option>
                  <option value="Kurir Bank">Kurir Resmi Narayan Bank</option>
                </select>
              </div>

              <div>
                <label className="form-label">Nomor Resi / AWB</label>
                <input
                  type="text"
                  className="form-field"
                  placeholder="Masukkan nomor resi..."
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">Catatan Pengiriman</label>
                <input
                  type="text"
                  className="form-field"
                  placeholder="Estimasi tiba atau catatan kurir"
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShippingBox(null)}
                >
                  Batal
                </button>
                <button type="submit" disabled={shippingUpdating} className="btn btn-primary">
                  {shippingUpdating ? 'Menyimpan...' : 'Kirim Kotak & Perbarui Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

