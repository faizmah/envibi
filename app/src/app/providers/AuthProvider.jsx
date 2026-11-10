// src/app/providers/AuthProvider.jsx
// Provider utama untuk autentikasi Supabase.
// Mendukung Cloud Supabase Auth dan Local Demo Mode (offline / dev mode).

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../../services/supabase/client'

const AuthContext = createContext(null)
const DEMO_SESSION_KEY = 'nvb_demo_session_v1'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchUserData = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setRole(null)
      return
    }
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId).order('role'),
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (roleRes.data && roleRes.data.length > 0) {
        const roles = Array.isArray(roleRes.data) ? roleRes.data.map((r) => r.role) : [roleRes.data.role]
        if (roles.includes('SUPER_ADMIN')) setRole('SUPER_ADMIN')
        else if (roles.includes('ADMIN')) setRole('ADMIN')
        else setRole('MEMBER')
      }
    } catch (err) {
      console.error('fetchUserData error:', err)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    // 1. Jika dalam Demo Mode (belum pasang cloud Supabase)
    if (!isSupabaseConfigured) {
      try {
        const raw = localStorage.getItem(DEMO_SESSION_KEY)
        if (raw) {
          const sess = JSON.parse(raw)
          if (sess && sess.user) {
            setUser(sess.user)
            setProfile(sess.profile)
            setRole(sess.role)
          }
        }
      } catch (e) {
        console.warn('Gagal membaca demo session:', e)
      }
      setLoading(false)
      return
    }

    // 2. Jika dalam Cloud Mode
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false)
      }
    }, 3000)

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return
        const session = data?.session ?? null
        setUser(session?.user ?? null)
        if (session?.user?.id) {
          fetchUserData(session.user.id).finally(() => {
            if (mounted) setLoading(false)
          })
        } else {
          setLoading(false)
        }
      })
      .catch((err) => {
        console.warn('Auth session check:', err?.message || err)
        if (mounted) setLoading(false)
      })
      .finally(() => {
        clearTimeout(timeout)
      })

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return
        setUser(session?.user ?? null)
        if (session?.user?.id) {
          await fetchUserData(session.user.id)
        } else {
          setProfile(null)
          setRole(null)
        }
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      clearTimeout(timeout)
      authListener?.subscription?.unsubscribe()
    }
  }, [fetchUserData])

  // Sign Up
  const signUp = async ({ email, password, fullName }) => {
    setError(null)

    // Demo Mode Sign Up
    if (!isSupabaseConfigured) {
      const cleanEmail = email.trim().toLowerCase()
      const userId = 'usr-' + Date.now()

      const demoUser = {
        id: userId,
        email: cleanEmail,
        user_metadata: { full_name: fullName },
      }

      const assignedRole = cleanEmail.includes('admin') ? 'ADMIN' : 'MEMBER'
      const demoProfile = {
        id: userId,
        email: cleanEmail,
        full_name: fullName,
        verification_status: 'VERIFIED',
        address: 'Alamat Anggota (Demo Mode)',
        created_at: new Date().toISOString(),
      }

      // Simpan ke DB demo
      await supabase.from('profiles').insert(demoProfile)
      await supabase.from('user_roles').insert({ user_id: userId, role: assignedRole })

      // Simpan sesi lokal
      localStorage.setItem(
        DEMO_SESSION_KEY,
        JSON.stringify({ user: demoUser, profile: demoProfile, role: assignedRole })
      )

      setUser(demoUser)
      setProfile(demoProfile)
      setRole(assignedRole)
      setLoading(false)

      return { ok: true, data: { user: demoUser } }
    }

    // Cloud Mode Sign Up
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (err) {
      setError(err.message)
      return { ok: false, error: err.message }
    }
    return { ok: true, data }
  }

  // Sign In
  const signIn = async ({ email, password }) => {
    setError(null)

    // Demo Mode Sign In
    if (!isSupabaseConfigured) {
      const cleanEmail = email.trim().toLowerCase()
      const { data: profiles } = await supabase.from('profiles').select('*')
      const matched = (profiles || []).find((p) => p.email?.toLowerCase() === cleanEmail)

      const userId = matched ? matched.id : 'usr-' + Date.now()
      const userFullName = matched ? matched.full_name : cleanEmail.split('@')[0]
      const assignedRole = cleanEmail.includes('admin') ? 'ADMIN' : (matched?.role || 'MEMBER')

      const demoUser = {
        id: userId,
        email: cleanEmail,
        user_metadata: { full_name: userFullName },
      }

      const demoProfile = matched || {
        id: userId,
        email: cleanEmail,
        full_name: userFullName,
        verification_status: 'VERIFIED',
      }

      localStorage.setItem(
        DEMO_SESSION_KEY,
        JSON.stringify({ user: demoUser, profile: demoProfile, role: assignedRole })
      )

      setUser(demoUser)
      setProfile(demoProfile)
      setRole(assignedRole)
      return { ok: true, data: { user: demoUser } }
    }

    // Cloud Mode Sign In
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (err) {
      setError(err.message)
      return { ok: false, error: err.message }
    }
    return { ok: true, data }
  }

  // Sign Out
  const signOut = async () => {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(DEMO_SESSION_KEY)
    } else {
      await supabase.auth.signOut()
    }
    setUser(null)
    setProfile(null)
    setRole(null)
  }

  const refreshProfile = () => fetchUserData(user?.id)

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'
  const isSuperAdmin = role === 'SUPER_ADMIN'
  const isMember = role === 'MEMBER'

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        error,
        isAdmin,
        isSuperAdmin,
        isMember,
        isSupabaseConfigured,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider')
  return context
}
