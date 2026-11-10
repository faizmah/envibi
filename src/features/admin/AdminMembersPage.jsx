import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase/client'
import { formatDateTime, formatRupiah } from '../../utils/format'
import { Card, Button, Badge, SkeletonTable, ResponsiveTable } from '../../components/ui'

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

  const columns = [
    {
      key: 'full_name',
      label: 'Nama Nasabah',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{v || 'Tanpa Nama'}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.email}</div>
        </div>
      ),
    },
    {
      key: 'identity_number',
      label: 'NIK / KTP',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {v || '-'}
        </span>
      ),
    },
    {
      key: 'verification_status',
      label: 'Verifikasi',
      render: (v) => {
        const variant = v === 'VERIFIED' ? 'success' : v === 'PENDING' ? 'warning' : 'danger'
        return <Badge variant={variant}>{v || 'UNVERIFIED'}</Badge>
      },
    },
    {
      key: 'created_at',
      label: 'Terdaftar',
      render: (v) => (
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          {formatDateTime(v)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (_, row) => (
        <Button
          variant={selectedMember?.id === row.id ? 'primary' : 'outline'}
          size="sm"
          onClick={() => handleSelectMember(row)}
        >
          {selectedMember?.id === row.id ? 'Terpilih' : 'Detail'}
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
              DATABASE NASABAH
            </span>
            <Badge variant="neutral">{members.length} Member Terdaftar</Badge>
          </div>
          <h1 style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Manajemen Data Member
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
            Kelola data KYC identitas, verifikasi status nasabah, dan kepemilikan kotak tabungan fisik
          </p>
        </div>

        <div style={{ position: 'relative', minWidth: '240px' }}>
          <input
            type="text"
            placeholder="Cari nama, email, NIK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              borderRadius: '8px',
              border: '1px solid rgba(139,92,246,0.3)',
              background: 'rgba(139,92,246,0.06)',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}>
            🔍
          </span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedMember ? 'minmax(0, 1fr) 360px' : '1fr',
        gap: '20px',
        alignItems: 'start',
      }}>
        {/* Table of Members */}
        <Card variant="glass" style={{ padding: '0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '20px' }}>
              <SkeletonTable rows={6} columns={5} />
            </div>
          ) : (
            <ResponsiveTable
              columns={columns}
              data={filteredMembers}
              keyField="id"
              emptyMessage="Tidak ada nasabah yang cocok dengan pencarian."
            />
          )}
        </Card>

        {/* Selected Member Detail Sidebar */}
        {selectedMember && (
          <Card variant="elevated" style={{ padding: '20px', border: '1px solid rgba(139,92,246,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#c4b5fd' }}>
                Profil Lengkap Nasabah
              </h3>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
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
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Nama Lengkap</span>
                <b style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{selectedMember.full_name || '-'}</b>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Alamat Email</span>
                <span style={{ color: 'var(--text-secondary)' }}>{selectedMember.email}</span>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Nomor Telepon</span>
                <span style={{ color: 'var(--text-secondary)' }}>{selectedMember.phone || '-'}</span>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>Alamat Lengkap</span>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {selectedMember.address || '-'}
                </p>
              </div>

              {/* Status Verifikasi Actions */}
              <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '8px' }}>
                  Keputusan Verifikasi Identitas (KYC):
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="success"
                    size="sm"
                    disabled={updating || selectedMember.verification_status === 'VERIFIED'}
                    onClick={() => handleUpdateVerification('VERIFIED')}
                    style={{ flex: 1 }}
                  >
                    ✓ Verifikasi
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={updating || selectedMember.verification_status === 'REJECTED'}
                    onClick={() => handleUpdateVerification('REJECTED')}
                    style={{ flex: 1 }}
                  >
                    ✕ Tolak
                  </Button>
                </div>
              </div>

              {/* Rekening Terdaftar */}
              <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <span style={{ fontWeight: '800', color: '#d4a853', display: 'block', marginBottom: '6px' }}>
                  Rekening Dimiliki ({memberAccounts.length}):
                </span>
                {memberAccounts.length > 0 ? (
                  memberAccounts.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '8px 10px',
                        background: 'rgba(240,246,252,0.03)',
                        borderRadius: '8px',
                        marginBottom: '6px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <b style={{ color: 'var(--text-primary)' }}>{a.account_number}</b>
                        <Badge variant="success">{a.status}</Badge>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#10b981', marginTop: '2px', fontWeight: '700' }}>
                        {formatRupiah(a.book_balance)}
                      </div>
                    </div>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Belum membuka rekening</span>
                )}
              </div>

              {/* Kotak Fisik Terdaftar */}
              <div style={{ marginTop: '6px' }}>
                <span style={{ fontWeight: '800', color: '#c4b5fd', display: 'block', marginBottom: '6px' }}>
                  Kotak Tabungan Fisik ({memberBoxes.length}):
                </span>
                {memberBoxes.length > 0 ? (
                  memberBoxes.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        padding: '8px 10px',
                        background: 'rgba(139,92,246,0.06)',
                        borderRadius: '8px',
                        marginBottom: '6px',
                        border: '1px solid rgba(139,92,246,0.2)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <b style={{ color: '#c4b5fd' }}>{b.box_code}</b>
                        <Badge variant="warning">{b.status}</Badge>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Tag NFC: {b.nfc_tag_id || 'Belum di-bind'}
                      </div>
                    </div>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Belum memiliki kotak tabungan</span>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
