// src/services/nfc/nfcService.js
// Layanan Web NFC API untuk membaca dan menulis tag NFC NDEF.
// Hanya tersedia di browser yang mendukung Web NFC (Chrome di Android).
// Semua operasi menggunakan HTTPS.

const NFC_BASE_URL = import.meta.env.VITE_NFC_BASE_URL || window.location.origin

/**
 * Memeriksa apakah browser mendukung Web NFC
 */
export function isNFCSupported() {
  return 'NDEFReader' in window
}

/**
 * Status NFC support dengan detail
 */
export function getNFCStatus() {
  if (!isNFCSupported()) {
    return {
      supported: false,
      reason: 'Web NFC API tidak tersedia di browser/perangkat ini.',
      instructions: [
        'Gunakan Chrome terbaru di perangkat Android.',
        'Pastikan NFC diaktifkan di pengaturan perangkat.',
        'Pastikan aplikasi diakses melalui HTTPS.',
      ],
    }
  }
  return { supported: true }
}

/**
 * Menulis token ke tag NFC sebagai NDEF URL record.
 * @param {string} token - Public token kotak tabungan
 * @param {function} onProgress - Callback untuk update progress
 * @returns {Promise<{ok: boolean, url?: string, error?: string}>}
 */
export async function writeNFCTag(token, onProgress) {
  if (!isNFCSupported()) {
    return { ok: false, error: 'Web NFC tidak didukung di perangkat ini' }
  }

  const url = `${NFC_BASE_URL}/nfc/${token}`

  try {
    onProgress?.({ status: 'waiting', message: 'Dekatkan tag NFC ke perangkat...' })

    const ndef = new NDEFReader()

    // Request permission
    await ndef.scan()

    return await new Promise((resolve) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => {
        controller.abort()
        resolve({ ok: false, error: 'Waktu habis. Dekatkan tag NFC dan coba lagi.' })
      }, 30000)

      ndef.write(
        {
          records: [
            {
              recordType: 'url',
              data: url,
            },
          ],
        },
        { signal: controller.signal, overwrite: true }
      )
        .then(() => {
          clearTimeout(timeout)
          onProgress?.({ status: 'success', message: 'Tag NFC berhasil ditulis!' })
          resolve({ ok: true, url })
        })
        .catch((err) => {
          clearTimeout(timeout)
          const message = parseNFCError(err)
          onProgress?.({ status: 'error', message })
          resolve({ ok: false, error: message })
        })
    })
  } catch (err) {
    const message = parseNFCError(err)
    return { ok: false, error: message }
  }
}

/**
 * Membaca tag NFC dan mengekstrak token dari URL NDEF.
 * @param {function} onProgress - Callback untuk update progress
 * @returns {Promise<{ok: boolean, token?: string, url?: string, error?: string}>}
 */
export async function readNFCTag(onProgress) {
  if (!isNFCSupported()) {
    return { ok: false, error: 'Web NFC tidak didukung di perangkat ini' }
  }

  try {
    onProgress?.({ status: 'waiting', message: 'Dekatkan tag NFC ke perangkat...' })

    const ndef = new NDEFReader()
    await ndef.scan()

    return await new Promise((resolve) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => {
        controller.abort()
        resolve({ ok: false, error: 'Waktu habis. Dekatkan tag NFC dan coba lagi.' })
      }, 30000)

      ndef.addEventListener(
        'reading',
        ({ message, serialNumber }) => {
          clearTimeout(timeout)

          let foundToken = null
          let foundUrl = null

          for (const record of message.records) {
            if (record.recordType === 'url') {
              const decoder = new TextDecoder()
              const url = decoder.decode(record.data)
              foundUrl = url

              // Ekstrak token dari URL
              // Format: https://domain/nfc/TOKEN
              const match = url.match(/\/nfc\/([a-zA-Z0-9_-]+)$/)
              if (match) {
                foundToken = match[1]
              }
            }
          }

          if (foundToken) {
            onProgress?.({ status: 'success', message: 'Tag NFC berhasil dibaca!' })
            resolve({
              ok: true,
              token: foundToken,
              url: foundUrl,
              serialNumber,
            })
          } else {
            resolve({
              ok: false,
              error: 'Tag NFC tidak mengandung token yang valid. Mungkin bukan tag Narayan Virtual Bank.',
              rawUrl: foundUrl,
            })
          }
        },
        { signal: controller.signal }
      )

      ndef.addEventListener(
        'readingerror',
        () => {
          clearTimeout(timeout)
          resolve({ ok: false, error: 'Gagal membaca tag NFC. Coba lagi.' })
        },
        { signal: controller.signal }
      )
    })
  } catch (err) {
    const message = parseNFCError(err)
    return { ok: false, error: message }
  }
}

/**
 * Memverifikasi tag NFC: baca lalu kirim token ke backend untuk validasi.
 * @param {function} onProgress
 * @param {function} verifyFn - Fungsi async yang dipanggil dengan token, harus return {ok, ...data}
 * @returns {Promise}
 */
export async function verifyNFCTag(onProgress, verifyFn) {
  const readResult = await readNFCTag(onProgress)

  if (!readResult.ok) {
    return readResult
  }

  onProgress?.({ status: 'verifying', message: 'Memverifikasi token ke server...' })

  try {
    const verifyResult = await verifyFn(readResult.token)
    if (verifyResult.ok) {
      onProgress?.({ status: 'verified', message: 'Tag NFC terverifikasi!' })
    } else {
      onProgress?.({ status: 'error', message: verifyResult.error || 'Verifikasi gagal' })
    }
    return { ...verifyResult, token: readResult.token }
  } catch (err) {
    const message = 'Gagal menghubungi server untuk verifikasi'
    onProgress?.({ status: 'error', message })
    return { ok: false, error: message }
  }
}

/**
 * Mengubah error NFC menjadi pesan yang ramah pengguna
 */
function parseNFCError(err) {
  if (!err) return 'Terjadi kesalahan tidak diketahui'

  const msg = err.message || err.toString()

  if (msg.includes('AbortError') || msg.includes('abort')) {
    return 'Operasi dibatalkan'
  }
  if (msg.includes('NotAllowedError') || msg.includes('permission')) {
    return 'Izin NFC ditolak. Izinkan akses NFC di pengaturan browser.'
  }
  if (msg.includes('NetworkError')) {
    return 'Tag NFC tidak dapat dibaca. Pastikan tag tidak rusak.'
  }
  if (msg.includes('overwrite')) {
    return 'Tag NFC sudah berisi data dan tidak dapat ditimpa.'
  }
  if (msg.includes('NotSupportedError')) {
    return 'Operasi NFC tidak didukung di perangkat ini.'
  }

  return `Kesalahan NFC: ${msg}`
}

/**
 * Generate public token untuk kotak tabungan baru
 * (Digunakan admin, token ini yang akan ditulis ke NFC)
 */
export function generatePublicToken() {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

