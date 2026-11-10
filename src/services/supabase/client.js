// src/services/supabase/client.js
// Supabase client singleton dengan dukungan Dual-Mode:
// 1. Cloud Mode: Ketika VITE_SUPABASE_URL & ANON_KEY terpasang dengan benar.
// 2. Demo/Local Mode: Fallback otomatis saat URL belum dikonfigurasi,
//    memungkinkan pendaftaran, login, dan pengujian seluruh fitur secara instan.

import { createClient } from '@supabase/supabase-js'

const envUrl = import.meta.env.VITE_SUPABASE_URL
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  envUrl &&
  envKey &&
  envUrl.startsWith('http') &&
  !envUrl.includes('placeholder')
)

// Inisialisasi Supabase SDK asli
const safeUrl = isSupabaseConfigured ? envUrl : 'https://nvb-placeholder.supabase.co'
const safeKey = isSupabaseConfigured ? envKey : 'dummy-nvb-anon-key-placeholder'

const realSupabase = createClient(safeUrl, safeKey, {
  auth: {
    autoRefreshToken: isSupabaseConfigured,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// =============================================================================
// LOCAL DEMO STORE (Bekerja otomatis saat belum menghubungkan Supabase Cloud)
// =============================================================================
const DEMO_STORE_KEY = 'nvb_local_demo_db_v1'

function getDemoDB() {
  try {
    const raw = localStorage.getItem(DEMO_STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('Gagal membaca demo DB:', e)
  }
  return {
    users: [],
    profiles: [],
    user_roles: [],
    accounts: [],
    savings_boxes: [],
    nfc_tags: [],
    transactions: [],
    ledger_entries: [],
    physical_balance_reports: [],
    savings_goals: [],
    notifications: [],
    account_applications: [],
    audit_logs: [],
    shipments: [],
  }
}

function saveDemoDB(db) {
  try {
    localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(db))
  } catch (e) {
    console.warn('Gagal menyimpan demo DB:', e)
  }
}

// Demo RPC Handlers
const demoRPCHandlers = {
  // 1. Approve account application
  approve_account_application: ({ p_application_id, p_admin_notes }) => {
    const db = getDemoDB()
    const app = db.account_applications.find((a) => a.id === p_application_id)
    if (!app) return { ok: false, error: 'Pengajuan tidak ditemukan' }

    const accNumber = 'NVB-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(100000 + Math.random() * 900000)
    const newAccount = {
      id: 'acc-' + Date.now(),
      account_number: accNumber,
      user_id: app.user_id,
      account_type: app.account_type || 'TABUNGAN',
      status: 'ACTIVE',
      currency: 'IDR',
      book_balance: Number(app.initial_deposit) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.accounts.push(newAccount)

    app.status = 'APPROVED'
    app.account_id = newAccount.id
    app.admin_notes = p_admin_notes
    app.reviewed_at = new Date().toISOString()

    // Buat notifikasi
    db.notifications.push({
      id: 'notif-' + Date.now(),
      user_id: app.user_id,
      type: 'ACCOUNT_APPROVED',
      title: 'Rekening Disetujui',
      body: `Rekening Anda telah terbit dengan nomor ${accNumber}`,
      is_read: false,
      created_at: new Date().toISOString(),
    })

    saveDemoDB(db)
    return { ok: true, account_id: newAccount.id, account_number: accNumber }
  },

  // 2. Reject account application
  reject_account_application: ({ p_application_id, p_reason }) => {
    const db = getDemoDB()
    const app = db.account_applications.find((a) => a.id === p_application_id)
    if (app) {
      app.status = 'REJECTED'
      app.admin_notes = p_reason
      saveDemoDB(db)
    }
    return { ok: true }
  },

  // 3. Request revision
  request_application_revision: ({ p_application_id, p_notes }) => {
    const db = getDemoDB()
    const app = db.account_applications.find((a) => a.id === p_application_id)
    if (app) {
      app.status = 'REVISION_REQUIRED'
      app.admin_notes = p_notes
      saveDemoDB(db)
    }
    return { ok: true }
  },

  // 4. Process Deposit
  process_deposit: ({ p_account_id, p_box_id, p_amount, p_description, p_idempotency_key }) => {
    const db = getDemoDB()
    const acc = db.accounts.find((a) => a.id === p_account_id)
    if (!acc) return { ok: false, error: 'Rekening tidak ditemukan' }

    const txNumber = 'TRX-' + Date.now().toString(36).toUpperCase()
    const txId = 'tx-' + Date.now()

    const tx = {
      id: txId,
      transaction_number: txNumber,
      account_id: p_account_id,
      user_id: acc.user_id,
      box_id: p_box_id || null,
      transaction_type: 'DEPOSIT',
      amount: Number(p_amount),
      status: 'PENDING_CONFIRMATION',
      description: p_description,
      idempotency_key: p_idempotency_key,
      source: p_box_id ? 'NFC' : 'MEMBER_APP',
      physical_confirmed: false,
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }
    db.transactions.unshift(tx)
    saveDemoDB(db)

    return { ok: true, transaction_id: txId, transaction_number: txNumber, status: 'PENDING_CONFIRMATION' }
  },

  // 5. Confirm physical deposit
  confirm_physical_deposit: ({ p_transaction_id }) => {
    const db = getDemoDB()
    const tx = db.transactions.find((t) => t.id === p_transaction_id)
    if (!tx) return { ok: false, error: 'Transaksi tidak ditemukan' }

    const acc = db.accounts.find((a) => a.id === tx.account_id)
    if (!acc) return { ok: false, error: 'Rekening tidak ditemukan' }

    const newBal = Number(acc.book_balance) + Number(tx.amount)
    acc.book_balance = newBal

    tx.status = 'COMPLETED'
    tx.physical_confirmed = true
    tx.confirmed_at = new Date().toISOString()
    tx.processed_at = new Date().toISOString()

    // Ledger
    db.ledger_entries.unshift({
      id: 'led-' + Date.now(),
      transaction_id: tx.id,
      account_id: acc.id,
      entry_type: 'CREDIT',
      amount: tx.amount,
      balance_after: newBal,
      description: 'Setoran dikonfirmasi',
      created_at: new Date().toISOString(),
    })

    saveDemoDB(db)
    return { ok: true, new_balance: newBal, transaction_id: tx.id }
  },

  // 6. Process withdrawal
  process_withdrawal: ({ p_account_id, p_box_id, p_amount, p_description, p_idempotency_key }) => {
    const db = getDemoDB()
    const acc = db.accounts.find((a) => a.id === p_account_id)
    if (!acc) return { ok: false, error: 'Rekening tidak ditemukan' }

    const amt = Number(p_amount)
    if (acc.book_balance < amt) {
      return { ok: false, error: 'Saldo tidak mencukupi' }
    }

    const newBal = Number(acc.book_balance) - amt
    acc.book_balance = newBal

    const txNumber = 'TRX-' + Date.now().toString(36).toUpperCase()
    const txId = 'tx-' + Date.now()

    db.transactions.unshift({
      id: txId,
      transaction_number: txNumber,
      account_id: p_account_id,
      user_id: acc.user_id,
      box_id: p_box_id || null,
      transaction_type: 'WITHDRAWAL',
      amount: amt,
      status: 'COMPLETED',
      description: p_description,
      idempotency_key: p_idempotency_key,
      source: p_box_id ? 'NFC' : 'MEMBER_APP',
      physical_confirmed: true,
      confirmed_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })

    db.ledger_entries.unshift({
      id: 'led-' + Date.now(),
      transaction_id: txId,
      account_id: acc.id,
      entry_type: 'DEBIT',
      amount: amt,
      balance_after: newBal,
      description: p_description || 'Penarikan mandiri',
      created_at: new Date().toISOString(),
    })

    saveDemoDB(db)
    return { ok: true, transaction_id: txId, transaction_number: txNumber, new_balance: newBal }
  },

  // 7. Verify NFC token
  verify_nfc_token: ({ p_public_token }) => {
    const db = getDemoDB()
    const tag = db.nfc_tags.find((t) => t.public_token === p_public_token)
    if (!tag) {
      // Auto-fallback: jika belum ada tag, cari kotak aktif pertama untuk kemudahan pengujian
      const activeBox = db.savings_boxes.find((b) => b.status === 'ACTIVE') || db.savings_boxes[0]
      if (activeBox) {
        const acc = db.accounts.find((a) => a.id === activeBox.account_id)
        return {
          ok: true,
          box_id: activeBox.id,
          box_code: activeBox.box_code,
          account_id: acc?.id,
          account_number: acc?.account_number || 'NVB-DEMO-001',
          book_balance: acc?.book_balance || 0,
        }
      }
      return { ok: false, error: 'Token NFC tidak terdaftar dalam sistem.' }
    }

    const box = db.savings_boxes.find((b) => b.id === tag.box_id)
    const acc = db.accounts.find((a) => a.id === box?.account_id)

    return {
      ok: true,
      box_id: box?.id,
      box_code: box?.box_code,
      account_id: acc?.id,
      account_number: acc?.account_number,
      book_balance: acc?.book_balance || 0,
    }
  },

  // 8. Activate savings box
  activate_savings_box: ({ p_box_id, p_nfc_token }) => {
    const db = getDemoDB()
    const box = db.savings_boxes.find((b) => b.id === p_box_id)
    if (!box) return { ok: false, error: 'Kotak tidak ditemukan' }

    box.status = 'ACTIVE'
    box.activated_at = new Date().toISOString()
    box.received_at = new Date().toISOString()

    saveDemoDB(db)
    return { ok: true, box_id: p_box_id, status: 'ACTIVE' }
  },

  // 9. Admin dashboard data
  get_admin_dashboard_data: () => {
    const db = getDemoDB()
    const totalBalance = db.accounts.reduce((s, a) => s + Number(a.book_balance || 0), 0)
    return {
      ok: true,
      total_members: Math.max(1, db.users.length),
      total_active_accounts: db.accounts.filter((a) => a.status === 'ACTIVE').length,
      pending_applications: db.account_applications.filter((a) => a.status === 'PENDING' || a.status === 'UNDER_REVIEW').length,
      preparing_boxes: db.savings_boxes.filter((b) => b.status === 'PREPARING' || b.status === 'NFC_PENDING').length,
      shipped_boxes: db.savings_boxes.filter((b) => b.status === 'SHIPPED').length,
      active_boxes: db.savings_boxes.filter((b) => b.status === 'ACTIVE').length,
      total_book_balance: totalBalance,
      total_deposits_today: db.transactions.filter((t) => t.transaction_type === 'DEPOSIT').reduce((s, t) => s + Number(t.amount || 0), 0),
      total_withdrawals_today: db.transactions.filter((t) => t.transaction_type === 'WITHDRAWAL').reduce((s, t) => s + Number(t.amount || 0), 0),
      pending_transactions: db.transactions.filter((t) => t.status === 'PENDING_CONFIRMATION').length,
    }
  },

  // 10. Notifications read
  mark_notification_read: ({ p_notification_id }) => {
    const db = getDemoDB()
    const n = db.notifications.find((x) => x.id === p_notification_id)
    if (n) n.is_read = true
    saveDemoDB(db)
    return true
  },

  mark_all_notifications_read: () => {
    const db = getDemoDB()
    db.notifications.forEach((n) => (n.is_read = true))
    saveDemoDB(db)
    return true
  },
}

// Demo Query Builder
function createDemoQueryBuilder(tableName) {
  let filters = []
  let orders = []
  let limitVal = null
  let isSingle = false

  const builder = {
    select: (columns = '*') => builder,
    eq: (col, val) => {
      filters.push((row) => row[col] === val)
      return builder
    },
    gte: (col, val) => {
      filters.push((row) => row[col] >= val)
      return builder
    },
    lte: (col, val) => {
      filters.push((row) => row[col] <= val)
      return builder
    },
    order: (col, { ascending = true } = {}) => {
      orders.push({ col, ascending })
      return builder
    },
    limit: (num) => {
      limitVal = num
      return builder
    },
    single: () => {
      isSingle = true
      return builder
    },
    then: (resolve, reject) => {
      const db = getDemoDB()
      let rows = db[tableName] || []

      // Populate relations if any (e.g. profiles, accounts, shipments)
      rows = rows.map((r) => {
        const item = { ...r }
        if (tableName === 'accounts' || tableName === 'savings_boxes' || tableName === 'account_applications') {
          item.profiles = db.profiles.find((p) => p.id === item.user_id) || { full_name: 'Member Demo', email: 'demo@nvb.local' }
        }
        if (tableName === 'savings_boxes') {
          item.accounts = db.accounts.find((a) => a.id === item.account_id) || null
          item.shipments = db.shipments.filter((s) => s.box_id === item.id)
        }
        if (tableName === 'nfc_tags') {
          item.savings_boxes = db.savings_boxes.find((b) => b.id === item.box_id) || null
        }
        if (tableName === 'transactions') {
          item.profiles = db.profiles.find((p) => p.id === item.user_id) || { full_name: 'Member Demo' }
          item.accounts = db.accounts.find((a) => a.id === item.account_id) || null
        }
        return item
      })

      // Apply filters
      for (const f of filters) {
        rows = rows.filter(f)
      }

      // Apply orders
      for (const o of orders) {
        rows.sort((a, b) => {
          const va = a[o.col] || ''
          const vb = b[o.col] || ''
          return o.ascending ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
        })
      }

      // Apply limit
      if (limitVal !== null) {
        rows = rows.slice(0, limitVal)
      }

      const result = isSingle ? (rows[0] || null) : rows
      return Promise.resolve({ data: result, error: null, count: rows.length }).then(resolve, reject)
    },

    insert: (payload) => {
      const db = getDemoDB()
      const list = Array.isArray(payload) ? payload : [payload]
      const inserted = []

      for (const item of list) {
        const row = {
          id: item.id || (tableName + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item,
        }
        if (!db[tableName]) db[tableName] = []
        db[tableName].unshift(row)
        inserted.push(row)
      }

      saveDemoDB(db)
      return {
        select: () => ({
          single: () => Promise.resolve({ data: inserted[0], error: null }),
          then: (res, rej) => Promise.resolve({ data: inserted, error: null }).then(res, rej),
        }),
        then: (res, rej) => Promise.resolve({ data: inserted, error: null }).then(res, rej),
      }
    },

    update: (updates) => ({
      eq: (col, val) => {
        const db = getDemoDB()
        if (db[tableName]) {
          db[tableName].forEach((row) => {
            if (row[col] === val) {
              Object.assign(row, updates, { updated_at: new Date().toISOString() })
            }
          })
          saveDemoDB(db)
        }
        return Promise.resolve({ data: null, error: null })
      },
    }),

    delete: () => ({
      eq: (col, val) => {
        const db = getDemoDB()
        if (db[tableName]) {
          db[tableName] = db[tableName].filter((row) => row[col] !== val)
          saveDemoDB(db)
        }
        return Promise.resolve({ data: null, error: null })
      },
    }),

    upsert: (payload) => {
      const db = getDemoDB()
      if (!db[tableName]) db[tableName] = []
      const existingIdx = db[tableName].findIndex((x) => x.id === payload.id || (payload.box_id && x.box_id === payload.box_id))
      if (existingIdx >= 0) {
        db[tableName][existingIdx] = { ...db[tableName][existingIdx], ...payload }
      } else {
        db[tableName].push({ id: 'item-' + Date.now(), ...payload })
      }
      saveDemoDB(db)
      return Promise.resolve({ data: null, error: null })
    },
  }

  return builder
}

// Client Wrapper
export const supabase = isSupabaseConfigured
  ? realSupabase
  : {
      ...realSupabase,
      from: (tableName) => createDemoQueryBuilder(tableName),
      rpc: async (fnName, params = {}) => {
        const handler = demoRPCHandlers[fnName]
        if (handler) {
          const res = handler(params)
          return { data: res, error: null }
        }
        console.warn(`[Demo RPC] Fungsi ${fnName} belum didefinisikan di handler demo.`)
        return { data: { ok: true }, error: null }
      },
    }

export default supabase
