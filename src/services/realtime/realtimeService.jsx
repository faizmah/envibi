// src/services/realtime/realtimeService.jsx
// Simple realtime service used by admin/member pages.
// In production (Supabase cloud) you can replace the polling
// with real `supabase.channel(...).subscribe()` calls.

/**
 * Subscribe to *all* account application changes.
 * @param {Function} callback - called whenever we want to refresh data.
 * @returns {Function} unsubscribe function.
 */
export const subscribeToAllApplications = (callback) => {
  // Demo fallback – poll every 3 seconds.
  const timer = setInterval(() => {
    try {
      callback && callback();
    } catch (e) {
      console.warn('Realtime poll error:', e);
    }
  }, 3000);
  return () => clearInterval(timer);
};

/**
 * Subscribe to a single user’s application changes (member view).
 * @param {string} userId
 * @param {Function} callback
 * @returns {Function} unsubscribe function.
 */
export const subscribeToApplications = (userId, callback) => {
  if (!userId) return () => {};
  const timer = setInterval(() => {
    try {
      callback && callback();
    } catch (e) {
      console.warn('Realtime poll error:', e);
    }
  }, 3000);
  return () => clearInterval(timer);
};

