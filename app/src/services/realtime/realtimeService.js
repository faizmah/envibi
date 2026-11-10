// src/services/realtime/realtimeService.js
// Layanan Supabase Realtime — subscribe perubahan data secara real-time.
// Setiap subscription berdasarkan user_id untuk mencegah kebocoran data.

import { supabase, isSupabaseConfigured } from '../supabase/client'

/**
 * Subscribe ke notifikasi user
 * @param {string} userId
 * @param {function} onNotification
 * @returns {function} unsubscribe
 */
export function subscribeToNotifications(userId, onNotification) {
  if (!isSupabaseConfigured || !userId) return () => {}
  try {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onNotification(payload.new)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  } catch (err) {
    console.warn('Realtime error:', err)
    return () => {}
  }
}

/**
 * Subscribe ke perubahan status rekening user
 * @param {string} userId
 * @param {function} onChange
 * @returns {function} unsubscribe
 */
export function subscribeToAccounts(userId, onChange) {
  if (!isSupabaseConfigured || !userId) return () => {}
  try {
    const channel = supabase
      .channel(`accounts:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'accounts',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onChange(payload)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  } catch (e) {
    return () => {}
  }
}

/**
 * Subscribe ke perubahan pengajuan rekening
 * @param {string} userId
 * @param {function} onChange
 * @returns {function} unsubscribe
 */
export function subscribeToApplications(userId, onChange) {
  if (!isSupabaseConfigured || !userId) return () => {}
  try {
    const channel = supabase
      .channel(`applications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'account_applications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onChange(payload)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  } catch (e) {
    return () => {}
  }
}

/**
 * Subscribe ke perubahan status kotak tabungan
 * @param {string} userId
 * @param {function} onChange
 * @returns {function} unsubscribe
 */
export function subscribeToSavingsBoxes(userId, onChange) {
  if (!isSupabaseConfigured || !userId) return () => {}
  try {
    const channel = supabase
      .channel(`savings_boxes:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'savings_boxes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onChange(payload)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  } catch (e) {
    return () => {}
  }
}

/**
 * Subscribe ke transaksi baru (untuk member)
 * @param {string} userId
 * @param {function} onChange
 * @returns {function} unsubscribe
 */
export function subscribeToTransactions(userId, onChange) {
  if (!isSupabaseConfigured || !userId) return () => {}
  try {
    const channel = supabase
      .channel(`transactions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onChange(payload)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  } catch (e) {
    return () => {}
  }
}

/**
 * Subscribe ke semua pengajuan rekening (untuk admin)
 * @param {function} onChange
 * @returns {function} unsubscribe
 */
export function subscribeToAllApplications(onChange) {
  if (!isSupabaseConfigured) return () => {}
  try {
    const channel = supabase
      .channel('admin:applications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'account_applications',
        },
        (payload) => {
          onChange(payload)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  } catch (e) {
    return () => {}
  }
}

/**
 * Subscribe ke semua transaksi (untuk admin)
 * @param {function} onChange
 * @returns {function} unsubscribe
 */
export function subscribeToAllTransactions(onChange) {
  if (!isSupabaseConfigured) return () => {}
  try {
    const channel = supabase
      .channel('admin:transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          onChange(payload)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  } catch (e) {
    return () => {}
  }
}

/**
 * Subscribe ke perubahan kotak tabungan (untuk admin)
 * @param {function} onChange
 * @returns {function} unsubscribe
 */
export function subscribeToAllBoxes(onChange) {
  if (!isSupabaseConfigured) return () => {}
  try {
    const channel = supabase
      .channel('admin:boxes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'savings_boxes',
        },
        (payload) => {
          onChange(payload)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  } catch (e) {
    return () => {}
  }
}

/**
 * Subscribe ke notifikasi admin
 * @param {string} adminUserId
 * @param {function} onNotification
 * @returns {function} unsubscribe
 */
export function subscribeToAdminNotifications(adminUserId, onNotification) {
  return subscribeToNotifications(adminUserId, onNotification)
}

/**
 * Mengelola beberapa subscription sekaligus
 * @param {Array<function>} subscriptions - Array fungsi yang mengembalikan unsubscribe
 * @returns {function} unsubscribe semua
 */
export function combineSubscriptions(...subscriptions) {
  return () => subscriptions.forEach((unsub) => unsub?.())
}

