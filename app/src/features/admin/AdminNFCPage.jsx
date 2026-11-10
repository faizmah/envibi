import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase/client'
import {
  writeNFCTag,
  readNFCTag,
  getNFCStatus,
  generatePublicToken,
} from '../../services/nfc/nfcService'
import { formatDateTime } from '../../utils/format'
import { Card, Button, Badge, SkeletonTable, ResponsiveTable } from '../../components/ui'

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

    // 1. Ambil kotak dengan accounts
    const { data: bList } = await supabase
      .from('savings_boxes')
      .select('*, accounts:account_id(account_number)')
      .order('created_at', { ascending: false })

    // Manual profiles join untuk mencegah PGRST200
    if (bList && bList.length > 0) {
      const userIds = [...new Set(bList.map((b) => b.user_id).filter(Boolean))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]))
      const enriched = bList.map((b) => ({
        ...b,
        profiles: profileMap.get(b.user_id) || null,
      }))
      setBoxes(enriched)
    } else {
      setBoxes([])
    }

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

    // Read back tag to verify
    setOpMessage('Data ditulis! Membaca ulang tag untuk verifikasi integritas...')
    const readResult = await readNFCTag((p) => setOpMessage(p.message))

    if (!readResult.ok || readResult.token !== generatedToken) {
      setOpState('error')
      setErrorMsg('Verifikasi baca ulang gagal. Token yang terbaca tidak cocok.')
      return
    }

    // Simpan tag ke database Supabase
    setOpMessage('Menyimpan tautan tag NFC ke database...')

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

  const columns = [
    {
      key: 'public_token',
      label: 'Token NDEF',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#c4b5fd' }}>
          {v}
        </span>
      ),
    },
    {
      key: 'savings_boxes',
      label: 'Kotak Terkait',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', color: '#d4a853', fontWeight: '800' }}>
          {v?.box_code || '-'}
        </span>
      ),
    },
    {
      key: 'tag_uid',
      label: 'UID Hardware',
      render: (v) => (
        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
          {v || 'NDEF Only'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status Tag',
      render: (v) => {
        const variant = v === 'VERIFIED' ? 'success' : v === 'REPLACED' ? 'neutral' : 'warning'
        return <Badge variant={variant}>{v}</Badge>
      },
    },
    {
      key: 'written_at',
      label: 'Waktu Penulisan',
      render: (v) => (
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          {formatDateTime(v)}
        </span>
      ),
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            HARDWARE NFC ENCODING
          </span>
          <Badge variant={nfcSupport.supported ? 'success' : 'warning'}>
            {nfcSupport.supported ? 'Web NFC Ready' : 'NFC Emulation Mode'}
          </Badge>
        </div>
        <h1 style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
          Manajemen & Penulisan Tag NFC
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
          Tulis NDEF URL identitas kotak, baca ulang tag fisik, dan verifikasi hubungan ke rekening nasabah
        </p>
      </div>

      {/* Hardware NFC Capability Notice */}
      <div style={{ marginBottom: '20px' }}>
        {nfcSupport.supported ? (
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '18px' }}>✅</span>
            <span>Web NFC API Aktif. Anda dapat menulis dan memverifikasi stiker NFC fisik langsung dari browser ini.</span>
          </div>
        ) : (
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(212, 168, 83, 0.1)',
            border: '1px solid rgba(212, 168, 83, 0.25)',
            color: '#d4a853',
            fontSize: '12px',
            lineHeight: '1.5',
          }}>
            <b>⚠️ Perangkat Saat Ini Menggunakan Mode Simulasi Web NFC</b>
            <div style={{ marginTop: '2px', opacity: 0.9 }}>
              Untuk memprogram tag hardware fisik, buka konsol admin ini menggunakan browser Google Chrome di HP/tablet Android dengan fitur NFC aktif melalui URL HTTPS.
            </div>
          </div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '20px',
        marginBottom: '28px',
      }}>
        {/* Card Penulisan NFC */}
        <Card variant="glass" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#c4b5fd', margin: '0 0 16px' }}>
            🏷️ Tulis Tag NFC Kotak Tabungan
          </h2>

          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '12px',
              fontWeight: '700',
              marginBottom: '14px',
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '12px',
              fontWeight: '700',
              marginBottom: '14px',
            }}>
              ✅ {successMsg}
            </div>
          )}

          {opMessage && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              color: '#c4b5fd',
              fontSize: '12px',
              fontWeight: '700',
              marginBottom: '14px',
            }}>
              ℹ️ {opMessage}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Pilih Kotak Tabungan Tujuan
              </label>
              <select
                value={selectedBoxId}
                onChange={(e) => setSelectedBoxId(e.target.value)}
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
                <option value="">Pilih Kotak...</option>
                {boxes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.box_code} · {b.profiles?.full_name || 'Nasabah'} ({b.accounts?.account_number || '-'})
                  </option>
                ))}
              </select>
            </div>

            {selectedBox && (
              <div style={{
                background: 'rgba(240,246,252,0.03)',
                padding: '14px',
                borderRadius: '10px',
                fontSize: '12.5px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <div>Pemilik: <b style={{ color: 'var(--text-primary)' }}>{selectedBox.profiles?.full_name}</b></div>
                <div>Rekening: <b style={{ color: '#d4a853', fontFamily: 'monospace' }}>{selectedBox.accounts?.account_number}</b></div>
                <div>Status Kotak: <Badge variant="warning">{selectedBox.status}</Badge></div>
                <div style={{ marginTop: '4px', wordBreak: 'break-all' }}>
                  Public Token NDEF: <code style={{ color: '#c4b5fd', fontWeight: '800' }}>{generatedToken}</code>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <Button
                variant="primary"
                style={{ flex: 1 }}
                disabled={!selectedBoxId || opState === 'writing'}
                loading={opState === 'writing'}
                onClick={handleWriteNFC}
              >
                {opState === 'writing' ? 'Menulis Tag...' : '📡 Tulis NDEF ke Tag NFC'}
              </Button>

              <Button
                variant="outline"
                disabled={opState === 'reading'}
                loading={opState === 'reading'}
                onClick={handleReadTest}
              >
                Uji Baca Tag
              </Button>
            </div>
          </div>
        </Card>

        {/* Petunjuk & Standar Penulisan */}
        <Card variant="glass" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#c4b5fd', margin: '0 0 16px' }}>
            📖 Standar Format NDEF Tag NVB
          </h2>
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ margin: 0 }}>
              Setiap kotak fisik NVB menggunakan tag NFC berstandar ISO/IEC 14443 Type 2 (NTAG213 / NTAG215 / NTAG216) yang diformat dengan record NDEF URI.
            </p>
            <div style={{ padding: '10px', background: 'rgba(240,246,252,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Struktur NDEF URI:</div>
              <code style={{ color: '#34d399', fontSize: '12px' }}>
                https://envibi.vercel.app/nfc/scan?t=[PUBLIC_TOKEN]
              </code>
            </div>
            <p style={{ margin: 0 }}>
              Ketika smartphone nasabah mendekati tag kotak fisik, browser akan langsung membaca token tersebut secara aman tanpa membocorkan data saldo atau nomor rekening ke publik.
            </p>
          </div>
        </Card>
      </div>

      {/* History of Written Tags */}
      <div>
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            Riwayat Tag NFC Terdaftar ({tags.length})
          </h2>
        </div>
        <Card variant="glass" style={{ padding: '0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '20px' }}>
              <SkeletonTable rows={4} columns={5} />
            </div>
          ) : (
            <ResponsiveTable
              columns={columns}
              data={tags}
              keyField="id"
              emptyMessage="Belum ada riwayat penulisan tag NFC."
            />
          )}
        </Card>
      </div>
    </div>
  )
}
