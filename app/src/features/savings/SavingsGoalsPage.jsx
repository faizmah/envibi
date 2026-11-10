import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { supabase } from '../../services/supabase/client'
import { formatRupiah, formatDate, calculateProgress } from '../../utils/format'

export default function SavingsGoalsPage() {
  const { user } = useAuth()

  const [account, setAccount] = useState(null)
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  // New Goal Form
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const loadData = async () => {
    if (!user) return
    setLoading(true)

    // Ambil rekening aktif
    const { data: accs } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .limit(1)

    if (accs && accs.length > 0) {
      setAccount(accs[0])

      // Ambil goals
      const { data: g } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('account_id', accs[0].id)
        .order('created_at', { ascending: false })

      setGoals(g || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [user])

  const handleCreateGoal = async (e) => {
    e.preventDefault()
    if (!account) return

    if (!name.trim() || Number(targetAmount) <= 0) {
      setErrorMsg('Nama target dan nominal target harus valid.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    const { error } = await supabase.from('savings_goals').insert({
      user_id: user.id,
      account_id: account.id,
      name: name.trim(),
      target_amount: Number(targetAmount),
      target_date: targetDate || null,
      notes: notes.trim() || null,
    })

    setSubmitting(false)

    if (error) {
      setErrorMsg('Gagal membuat target: ' + error.message)
    } else {
      setSuccessMsg('Target tabungan berhasil dibuat!')
      setName('')
      setTargetAmount('')
      setTargetDate('')
      setNotes('')
      loadData()
    }
  }

  const handleDeleteGoal = async (id) => {
    if (!confirm('Hapus target tabungan ini?')) return
    await supabase.from('savings_goals').delete().eq('id', id)
    loadData()
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--fg-muted)' }}>Memuat target tabungan...</p>
      </div>
    )
  }

  if (!account) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <h3>Belum ada rekening aktif</h3>
        <Link to="/accounts/apply" className="btn btn-primary">Buka Rekening</Link>
      </div>
    )
  }

  const currentBalance = Number(account.book_balance || 0)

  return (
    <div style={{ maxWidth: '900px', margin: '20px auto 60px', padding: '0 20px' }}>
      {/* Top Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div>
            <span style={{ fontSize: '11px', color: 'var(--accent2)', fontWeight: '800' }}>
              PENGELOLAAN KEUANGAN
            </span>
            <h2 style={{ margin: '4px 0', fontSize: '22px', fontWeight: '800' }}>
              Target Tabungan Pribadi
            </h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: 'var(--fg-muted)', fontSize: '11px', display: 'block' }}>Saldo Saat Ini:</span>
            <b style={{ color: 'var(--accent2)', fontSize: '16px' }}>{formatRupiah(currentBalance)}</b>
          </div>
        </div>
        <p style={{ color: 'var(--fg-muted)', fontSize: '12px', lineHeight: '1.6', margin: 0 }}>
          Tetapkan tujuan menabung Anda (misalnya: Dana Darurat, Qurban, Biaya Sekolah, Modal Usaha). Pantau persentase pencapaian berdasarkan uang yang terkumpul di kotak tabungan Anda.
        </p>
      </div>

      {/* Grid: Create Goal & Goals List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Form Tambah Target */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '14px' }}>🎯 Tambah Target Baru</h3>

          {errorMsg && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(231, 76, 60, 0.18)', color: '#ff8a80', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
              ⚠️ {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.18)', color: '#65d69a', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
              ✅ {successMsg}
            </div>
          )}

          <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="form-label">Nama Target Tabungan</label>
              <input
                type="text"
                className="form-field"
                placeholder="Contoh: Beli Laptop Baru"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label">Nominal Target (Rp)</label>
              <input
                type="number"
                className="form-field"
                placeholder="Contoh: 10000000"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                min="50000"
                step="50000"
                required
              />
            </div>

            <div>
              <label className="form-label">Target Tanggal Tercapai (Opsional)</label>
              <input
                type="date"
                className="form-field"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Catatan Tambahan</label>
              <input
                type="text"
                className="form-field"
                placeholder="Motivasi atau catatan"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ marginTop: '8px' }}>
              {submitting ? 'Menyimpan...' : '＋ Buat Target Tabungan'}
            </button>
          </form>
        </div>

        {/* List Target Tabungan */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '14px' }}>Daftar Target Anda ({goals.length})</h3>

          {goals.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {goals.map((g) => {
                const targetNum = Number(g.target_amount)
                const progress = calculateProgress(currentBalance, targetNum)
                const isAchieved = currentBalance >= targetNum

                return (
                  <div
                    key={g.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <b style={{ fontSize: '14px' }}>{g.name}</b>
                      <span className={`status ${isAchieved ? 'good' : 'wait'}`}>
                        {isAchieved ? 'TERCAPAI 🎉' : `${progress}%`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--fg-muted)', marginBottom: '8px' }}>
                      <span>Target: <b>{formatRupiah(targetNum)}</b></span>
                      <span>{g.target_date ? `Batas: ${formatDate(g.target_date)}` : 'Tanpa batas waktu'}</span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ height: '8px', background: 'var(--section-bg)', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${progress}%`,
                          background: isAchieved
                            ? 'linear-gradient(90deg, #2ecc71, #65d69a)'
                            : 'linear-gradient(90deg, var(--accent), var(--accent2))',
                          borderRadius: '6px',
                          transition: 'width 0.4s',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--fg-muted)' }}>
                      <span>{g.notes || '-'}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteGoal(g.id)}
                        style={{ border: 'none', background: 'transparent', color: '#ff8a80', cursor: 'pointer', padding: 0 }}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--fg-muted)', fontSize: '12px', textAlign: 'center', margin: '30px 0' }}>
              Belum ada target tabungan yang dibuat.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

