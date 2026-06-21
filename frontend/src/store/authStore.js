import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

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
      if (session?.user) {
        // Keep loading spinner until profile is ready — prevents white-page flash
        // where user is set but profile/role is still null.
        set({ loading: true })
        fetchProfile(session.user.id).then(profile => {
          // Bail if a logout raced past this fetch
          if (!get().loading) return
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // Check inactive before onAuthStateChange finishes — gives immediate error message.
    const profile = await fetchProfile(data.user.id)
    if (profile?.is_active === false) {
      await supabase.auth.signOut()
      throw new Error('Your account has been deactivated. Contact your administrator.')
    }
    // State will be set by the onAuthStateChange handler above.
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
