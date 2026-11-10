import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase/client'
import {
  writeNFCTag,
  readNFCTag,
  isNFCSupported,
  getNFCStatus,
  generatePublicToken,
} from '../../services/nfc/nfcService'
import { formatDateTime } from '../../utils/format'

export default function AdminNFCPage() {
  const [boxes, setBoxes] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)

  // Selected Box for Writing
  const [selectedBoxId, setSelectedBoxId] = useState('')
  const [generatedToken, setGeneratedToken] = useState('')

  // NFC Operation State
  const [opState, setOpState] = useState('idle') // idle, writing, reading, success, error
  const [opMessage, setOpMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const nfcSupport = getNFCStatus()

  const loadData = async () => {
    setLoading(true)

    // 1. Ambil kotak yang siap ditulis NFC atau aktif
    const { data: bList } = await supabase
      .from('savings_boxes')
      .select('*, profiles:user_id(full_name), accounts:account_id(account_number)')
      .order('created_at', { ascending: false })

    if (bList) setBoxes(bList)

    // 2. Ambil seluruh riwayat tag NFC
    const { data: tList } = await supabase
      .from('nfc_tags')
      .select('*, savings_boxes(box_code)')
      .order('created_at', { ascending: false })

    if (tList) setTags(tList)

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // Generate new token when box changes
  useEffect(() => {
    if (selectedBoxId) {
      setGeneratedToken(generatePublicToken())
      setErrorMsg('')
      setSuccessMsg('')
      setOpMessage('')
    }
  }, [selectedBoxId])

  // Handle Write NFC Tag
  const handleWriteNFC = async () => {
    if (!selectedBoxId || !generatedToken) {
      setErrorMsg('Pilih kotak tabungan terlebih dahulu.')
      return
    }

    setOpState('writing')
    setErrorMsg('')
    setSuccessMsg('')
    setOpMessage('Dekatkan tag NFC kosong / yang ingin ditulis ke perangkat...')

    const writeResult = await writeNFCTag(generatedToken, (p) => {
      setOpMessage(p.message)
    })

    if (!writeResult.ok) {
      setOpState('error')
      setErrorMsg(writeResult.error || 'Gagal menulis ke tag NFC.')
      return
    }

    // Step 8 & 9: Read back tag to verify
    setOpMessage('Data ditulis! Membaca ulang tag untuk verifikasi integritas...')
    const readResult = await readNFCTag((p) => setOpMessage(p.message))

    if (!readResult.ok || readResult.token !== generatedToken) {
      setOpState('error')
      setErrorMsg('Verifikasi baca ulang gagal. Token yang terbaca tidak cocok.')
      return
    }

    // Step 10: Simpan tag ke database Supabase
    setOpMessage('Menyimpan tautan tag NFC ke database...')

    // Deactivate previous tags for this box if any
    await supabase
      .from('nfc_tags')
      .update({ status: 'REPLACED', replaced_at: new Date().toISOString() })
      .eq('box_id', selectedBoxId)
      .eq('status', 'VERIFIED')

    const { error: tagErr } = await supabase.from('nfc_tags').insert({
      box_id: selectedBoxId,
      public_token: generatedToken,
      tag_uid: readResult.serialNumber || null,
      status: 'VERIFIED',
      written_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      ndef_url: writeResult.url,
    })

    // Update box status to READY_TO_SHIP
    await supabase
      .from('savings_boxes')
      .update({ status: 'READY_TO_SHIP' })
      .eq('id', selectedBoxId)

    if (tagErr) {
      setOpState('error')
      setErrorMsg('Gagal menyimpan tag ke database: ' + tagErr.message)
    } else {
      setOpState('success')
      setSuccessMsg(`Tag NFC berhasil ditulis dan diverifikasi! Kotak siap dikirim.`)
      loadData()
    }
  }

  // Handle Read Tag Diagnostic
  const handleReadTest = async () => {
    setOpState('reading')
    setErrorMsg('')
    setSuccessMsg('')
    setOpMessage('Dekatkan tag NFC apa saja ke perangkat...')

    const res = await readNFCTag((p) => setOpMessage(p.message))
    if (!res.ok) {
      setOpState('error')
      setErrorMsg(res.error || 'Gagal membaca tag.')
    } else {
      setOpState('success')
      setSuccessMsg(`Tag terbaca! Token: ${res.token} (UID: ${res.serialNumber || 'N/A'})`)
    }
  }

  const selectedBox = boxes.find((b) => b.id === selectedBoxId)

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>Manajemen & Penulisan Tag NFC</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: '12px' }}>
          Tulis NDEF URL identitas kotak, baca ulang tag, dan verifikasi hubungan ke rekening nasabah
        </p>
      </div>

      {/* Hardware NFC Capability Alert */}
      <div style={{ marginBottom: '24px' }}>
        {nfcSupport.supported ? (
          <div className="nfc-status-indicator supported">
            ✅ Web NFC API Aktif. Anda dapat menulis dan memverifikasi tag NFC fisik langsung dari browser ini.
          </div>
        ) : (
          <div className="nfc-status-indicator unsupported">
            <div>
              <b>⚠️ Perangkat Saat Ini Tidak Mendukung Penulisan Web NFC Langsung</b>
              <p style={{ margin: '4px 0 0', fontSize: '11px', opacity: 0.9 }}>
                Untuk penulisan hardware NFC, buka halaman admin ini melalui browser Google Chrome di HP/Tablet Android berkemampuan NFC dengan koneksi HTTPS. Anda tetap dapat mengaitkan token secara manual di bawah.
              </p>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Card Penulisan NFC */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '14px' }}>🏷️ Tulis Tag NFC Kotak Tabungan</h3>

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

          {opMessage && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(52, 152, 219, 0.15)', color: '#74c0e8', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
              ℹ️ {opMessage}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label">Pilih Kotak Tabungan Tujuan</label>
              <select
                className="form-field"
                value={selectedBoxId}
                onChange={(e) => setSelectedBoxId(e.target.value)}
              >
                <option value="">Pilih Kotak...</option>
                {boxes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.box_code} · {b.profiles?.full_name || 'Member'} ({b.accounts?.account_number || '-'})
                  </option>
                ))}
              </select>
            </div>

            {selectedBox && (
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '10px', fontSize: '12px', border: '1px solid var(--border)' }}>
                <div>Pemilik: <b>{selectedBox.profiles?.full_name}</b></div>
                <div>Rekening: <b>{selectedBox.accounts?.account_number}</b></div>
                <div>Status Saat Ini: <span className="status wait">{selectedBox.status}</span></div>
                <div style={{ marginTop: '6px', wordBreak: 'break-all' }}>
                  Public Token NDEF: <code style={{ color: 'var(--accent2)' }}>{generatedToken}</code>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, padding: '12px' }}
                disabled={!selectedBoxId || opState === 'writing' || !nfcSupport.supported}
                onClick={handleWriteNFC}
              >
                {opState === 'writing' ? 'Menulis Tag...' : '📡 Tulis NDEF ke Tag NFC'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                disabled={opState === 'reading' || !nfcSupport.supported}
                onClick={handleReadTest}
              >
                Baca Tag
              </button>
            </div>
          </div>
        </div>

        {/* Card Spesifikasi & Aturan NFC */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '14px' }}>🛡️ Spesifikasi Keamanan NFC</h3>
          <ul style={{ fontSize: '12px', color: 'var(--fg-muted)', lineHeight: '1.7', paddingLeft: '18px', margin: 0 }}>
            <li><b>Format NDEF URL:</b> <code>https://domain-aplikasi.com/nfc/TOKEN</code></li>
            <li><b>Privasi Terjamin:</b> Tag NFC hanya menyimpan token acak 16-byte hex. Tidak memuat nomor rekening, PIN, atau saldo.</li>
            <li><b>Validasi Backend:</b> Akses rekening dan saldo divalidasi ketat oleh Supabase RLS & RPC.</li>
            <li><b>Mekanisme Penggantian:</b> Jika tag hilang atau rusak, penulisan tag baru akan otomatis menonaktifkan tag lama.</li>
          </ul>
        </div>
      </div>

      {/* Riwayat Tag NFC */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '14px' }}>Riwayat Penulisan & Tag Terdaftar ({tags.length})</h3>

        {tags.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--fg-muted)' }}>
                  <th style={{ padding: '8px 12px' }}>Kode Kotak</th>
                  <th style={{ padding: '8px 12px' }}>Token NFC</th>
                  <th style={{ padding: '8px 12px' }}>UID Fisik</th>
                  <th style={{ padding: '8px 12px' }}>Waktu Penulisan</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(220, 230, 240, 0.05)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '800' }}>{t.savings_boxes?.box_code || '-'}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--accent2)' }}>
                      {t.public_token}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{t.tag_uid || '-'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--fg-muted)' }}>{formatDateTime(t.written_at || t.created_at)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`status ${t.status === 'VERIFIED' ? 'good' : 'bad'}`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--fg-muted)', fontSize: '12px', textAlign: 'center', margin: '20px 0' }}>
            Belum ada tag NFC yang ditulis.
          </p>
        )}
      </div>
    </div>
  )
}

