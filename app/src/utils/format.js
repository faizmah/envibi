// src/utils/format.js
// Utility functions untuk formatting data

/**
 * Format angka ke format mata uang Rupiah
 * @param {number} amount
 * @returns {string}
 */
export function formatRupiah(amount) {
  const num = Math.max(0, Number(amount) || 0)
  return 'Rp ' + num.toLocaleString('id-ID')
}

/**
 * Format tanggal ke format Indonesia
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Format tanggal dan waktu
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDateTime(date) {
  if (!date) return '-'
  return new Date(date).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format waktu relatif (misalnya: "2 menit yang lalu")
 * @param {string|Date} date
 * @returns {string}
 */
export function formatRelativeTime(date) {
  if (!date) return '-'
  const diff = Date.now() - new Date(date).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'Baru saja'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} hari lalu`
  return formatDate(date)
}

/**
 * Escape HTML entities untuk mencegah XSS
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  )
}

/**
 * Generate idempotency key yang unik
 * @returns {string}
 */
export function generateIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Format status transaksi ke label Indonesia
 * @param {string} status
 * @returns {string}
 */
export function formatTransactionStatus(status) {
  const labels = {
    PENDING_CONFIRMATION: 'Menunggu Konfirmasi',
    CONFIRMED: 'Dikonfirmasi',
    PROCESSING: 'Diproses',
    COMPLETED: 'Selesai',
    REJECTED: 'Ditolak',
    FAILED: 'Gagal',
    CANCELLED: 'Dibatalkan',
  }
  return labels[status] || status
}

/**
 * Format status rekening
 * @param {string} status
 * @returns {string}
 */
export function formatAccountStatus(status) {
  const labels = {
    PENDING: 'Menunggu Aktivasi',
    ACTIVE: 'Aktif',
    SUSPENDED: 'Ditangguhkan',
    CLOSED: 'Ditutup',
  }
  return labels[status] || status
}

/**
 * Format status kotak tabungan
 * @param {string} status
 * @returns {string}
 */
export function formatBoxStatus(status) {
  const labels = {
    PREPARING: 'Sedang Disiapkan',
    NFC_PENDING: 'NFC Belum Ditulis',
    READY_TO_SHIP: 'Siap Dikirim',
    SHIPPED: 'Dikirim',
    RECEIVED: 'Diterima',
    ACTIVE: 'Aktif',
    SUSPENDED: 'Ditangguhkan',
    REPLACED: 'Diganti',
  }
  return labels[status] || status
}

/**
 * Hitung persentase pencapaian target
 * @param {number} current
 * @param {number} target
 * @returns {number}
 */
export function calculateProgress(current, target) {
  if (!target || target <= 0) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

