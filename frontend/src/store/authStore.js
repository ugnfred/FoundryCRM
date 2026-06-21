import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

// Prevents onAuthStateChange from interfering while login() is in flight
let _loginInProgress = false

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const profile = await fetchProfile(session.user.id)
      if (profile?.is_active === false) {
        await supabase.auth.signOut()
        set({ user: null, profile: null, loading: false })
      } else {
        set({ user: session.user, profile, loading: false })
      }
    } else {
      set({ loading: false })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // login() handles its own state — skip to avoid race conditions
      if (_loginInProgress) return

      if (session?.user) {
        const current = get()
        // Already have this user+profile set by login() — nothing to do
        if (current.user?.id === session.user.id && current.profile) return

        // Page refresh / cross-tab / token refresh path
        set({ loading: true })
        fetchProfile(session.user.id).then(profile => {
          if (profile?.is_active === false) {
            supabase.auth.signOut()
            set({ user: null, profile: null, loading: false })
          } else {
            set({ user: session.user, profile, loading: false })
          }
        })
      } else {
        set({ user: null, profile: null, loading: false })
      }
    })

    return () => subscription.unsubscribe()
  },

  login: async (email, password) => {
    _loginInProgress = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const profile = await fetchProfile(data.user.id)
      if (profile?.is_active === false) {
        await supabase.auth.signOut()
        throw new Error('Your account has been deactivated. Contact your administrator.')
      }
      // Set user + profile together so the app renders correctly on first paint
      set({ user: data.user, profile, loading: false })
    } finally {
      _loginInProgress = false
    }
  },

  logout: async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      set({ user: null, profile: null })
    }
  },
}))

async function fetchProfile(userId) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export default useAuthStore
