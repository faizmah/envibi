import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase/client'
import { formatDateTime } from '../../utils/format'

export default function AdminMembersPage() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberAccounts, setMemberAccounts] = useState([])
  const [memberBoxes, setMemberBoxes] = useState([])
  const [updating, setUpdating] = useState(false)
  const [search, setSearch] = useState('')

  const loadMembers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setMembers(data)
    setLoading(false)
  }

  useEffect(() => {
    loadMembers()
  }, [])

  const handleSelectMember = async (m) => {
    setSelectedMember(m)
    // Ambil rekening & kotak milik member ini
    const [accRes, boxRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', m.id),
      supabase.from('savings_boxes').select('*').eq('user_id', m.id),
    ])
    setMemberAccounts(accRes.data || [])
    setMemberBoxes(boxRes.data || [])
  }

  const handleUpdateVerification = async (newStatus) => {
    if (!selectedMember) return
    setUpdating(true)

    const { error } = await supabase
      .from('profiles')
      .update({ verification_status: newStatus })
      .eq('id', selectedMember.id)

    setUpdating(false)
    if (!error) {
      setSelectedMember((prev) => ({ ...prev, verification_status: newStatus }))
      loadMembers()
    }
  }

  const filteredMembers = members.filter((m) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      m.full_name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.identity_number?.includes(q)
    )
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>Manajemen Data Member</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
            Daftar nasabah, verifikasi identitas, dan status kepemilikan kotak tabungan fisik
          </p>
        </div>
        <input
          type="text"
          className="form-field"
          placeholder="Cari nama, email, NIK..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '280px', margin: 0 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedMember ? '1fr 380px' : '1fr', gap: '20px' }}>
        {/* Table of Members */}
        <div className="card">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--fg-muted)' }}>Memuat data member...</p>
            </div>
          ) : filteredMembers.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                    <th style={{ padding: '8px 12px' }}>Nama Member</th>
                    <th style={{ padding: '8px 12px' }}>Email</th>
                    <th style={{ padding: '8px 12px' }}>Identitas (KTP)</th>
                    <th style={{ padding: '8px 12px' }}>Verifikasi</th>
                    <th style={{ padding: '8px 12px' }}>Terdaftar</th>
                    <th style={{ padding: '8px 12px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((m) => (
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: '1px solid rgba(220, 230, 240, 0.05)',
                        background: selectedMember?.id === m.id ? 'rgba(195, 154, 88, 0.1)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: '700' }}>{m.full_name || 'Tanpa Nama'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--fg-muted)' }}>{m.email}</td>
                      <td style={{ padding: '10px 12px' }}>{m.identity_number || '-'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span className={`status ${
                          m.verification_status === 'VERIFIED' ? 'good' :
                          m.verification_status === 'PENDING' ? 'wait' : 'bad'
                        }`}>
                          {m.verification_status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--fg-muted)' }}>{formatDateTime(m.created_at)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSelectMember(m)}
                        >
                          Rincian
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--fg-muted)' }}>
              Tidak ada data member yang ditemukan.
            </div>
          )}
        </div>

        {/* Selected Member Detail Sidebar */}
        {selectedMember && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 className="card-title">Rincian Member</h3>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setSelectedMember(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Nama Lengkap:</span>
                <b style={{ fontSize: '14px' }}>{selectedMember.full_name || '-'}</b>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Email:</span>
                <span>{selectedMember.email}</span>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Nomor Telepon:</span>
                <span>{selectedMember.phone || '-'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--fg-muted)', display: 'block' }}>Alamat Rumah:</span>
                <p style={{ margin: 0, lineHeight: '1.4' }}>{selectedMember.address || '-'}</p>
              </div>

              {/* Status Verifikasi Actions */}
              <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--fg-muted)', display: 'block', marginBottom: '6px' }}>
                  Ubah Status Verifikasi:
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    disabled={updating || selectedMember.verification_status === 'VERIFIED'}
                    onClick={() => handleUpdateVerification('VERIFIED')}
                  >
                    Verifikasi (Sah)
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    disabled={updating || selectedMember.verification_status === 'REJECTED'}
                    onClick={() => handleUpdateVerification('REJECTED')}
                  >
                    Tolak
                  </button>
                </div>
              </div>

              {/* Rekening Terdaftar */}
              <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <span style={{ fontWeight: '800', display: 'block', marginBottom: '6px' }}>
                  Rekening Dimiliki ({memberAccounts.length}):
                </span>
                {memberAccounts.map((a) => (
                  <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                    <b>{a.account_number}</b> ({a.account_type}) · Saldo: Rp {Number(a.book_balance).toLocaleString('id-ID')}
                  </div>
                ))}
              </div>

              {/* Kotak Fisik Terdaftar */}
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontWeight: '800', display: 'block', marginBottom: '6px' }}>
                  Kotak Fisik Dimiliki ({memberBoxes.length}):
                </span>
                {memberBoxes.map((b) => (
                  <div key={b.id} style={{ padding: '6px 0' }}>
                    <b>{b.box_code}</b> · Status: <span className="status good">{b.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

