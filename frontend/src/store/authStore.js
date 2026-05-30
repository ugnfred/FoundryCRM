import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  loading: true,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const profile = await fetchProfile(session.user.id)
      set({ user: session.user, profile, loading: false })
    } else {
      set({ loading: false })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Set user immediately (synchronous), then fetch profile without blocking
        set({ user: session.user })
        fetchProfile(session.user.id).then(profile => {
          // Discard if a logout raced past this fetch
          if (useAuthStore.getState().user?.id === session.user.id) {
            set({ profile })
          }
        })
      } else {
        set({ user: null, profile: null })
      }
    })

    return () => subscription.unsubscribe()
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const profile = await fetchProfile(data.user.id)
    set({ user: data.user, profile })
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
