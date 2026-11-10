import { useState, useEffect } from 'react'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { formatDate } from '../../utils/format'

export default function ProfilePage() {
  const { user, profile, role, refreshProfile } = useAuth()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [identityNumber, setIdentityNumber] = useState('')
  const [identityType, setIdentityType] = useState('KTP')

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setPhone(profile.phone || '')
      setAddress(profile.address || '')
      setBirthDate(profile.birth_date || '')
      setIdentityNumber(profile.identity_number || '')
      setIdentityType(profile.identity_type || 'KTP')
    }
  }, [profile])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const { error: err } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone,
        address,
        birth_date: birthDate || null,
        identity_number: identityNumber,
        identity_type: identityType,
        verification_status: profile?.verification_status === 'UNVERIFIED' && identityNumber ? 'PENDING' : profile?.verification_status,
      })
      .eq('id', user.id)

    setSaving(false)

    if (err) {
      setError('Gagal memperbarui profil: ' + err.message)
    } else {
      setMessage('Profil berhasil diperbarui!')
      refreshProfile()
    }
  }

  return (
    <div style={{ maxWidth: '720px', margin: '20px auto 60px', padding: '0 20px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>Profil Member</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
              Kelola data pribadi dan verifikasi identitas resmi Anda
            </p>
          </div>
          <span className={`status ${profile?.verification_status === 'VERIFIED' ? 'good' : profile?.verification_status === 'PENDING' ? 'wait' : 'bad'}`}>
            {profile?.verification_status || 'UNVERIFIED'}
          </span>
        </div>

        {message && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.18)', color: '#65d69a', fontSize: '12px', fontWeight: '700', marginBottom: '16px' }}>
            ✅ {message}
          </div>
        )}
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(231, 76, 60, 0.18)', color: '#ff8a80', fontSize: '12px', fontWeight: '700', marginBottom: '16px' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="form-label">Email Terdaftar</label>
            <input
              type="email"
              className="form-field"
              value={user?.email || ''}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
            <small style={{ color: 'var(--fg-muted)', fontSize: '11px' }}>Email akun tidak dapat diubah</small>
          </div>

          <div>
            <label className="form-label">Nama Lengkap</label>
            <input
              type="text"
              className="form-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Nomor Telepon / WhatsApp</label>
              <input
                type="tel"
                className="form-field"
                placeholder="081234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Tanggal Lahir</label>
              <input
                type="date"
                className="form-field"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px' }}>
            <div>
              <label className="form-label">Jenis Identitas</label>
              <select
                className="form-field"
                value={identityType}
                onChange={(e) => setIdentityType(e.target.value)}
              >
                <option value="KTP">KTP</option>
                <option value="SIM">SIM</option>
                <option value="PASPOR">Paspor</option>
              </select>
            </div>
            <div>
              <label className="form-label">Nomor Identitas (NIK / No. KTP)</label>
              <input
                type="text"
                className="form-field"
                placeholder="3201xxxxxxxxxxxx"
                value={identityNumber}
                onChange={(e) => setIdentityNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Alamat Lengkap Rumah (Tujuan Pengiriman Kotak)</label>
            <textarea
              className="form-field"
              rows="3"
              placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota, Kode Pos"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <small style={{ color: 'var(--fg-muted)', fontSize: '11px' }}>
              Alamat ini digunakan oleh Admin untuk mengirimkan kotak tabungan fisik NFC ke rumah Anda.
            </small>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
              Role Akun: <b style={{ color: 'var(--accent2)' }}>{role || 'MEMBER'}</b>
            </span>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

