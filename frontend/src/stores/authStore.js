import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,
  _authSubscription: null,

  setLoading: (loading) => set({ loading }),
  
  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('supabase_user_id', userId)
        .single()

      if (error) throw error
      set({ profile: data })
      return data
    } catch (error) {
      console.error('Error fetching profile:', error)
      return null
    }
  },

  initialize: async () => {
    // Guard: prevent double-initialization from React StrictMode or multiple callers
    if (get().initialized) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        set({ user: session.user })
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('supabase_user_id', session.user.id)
          .single()
        
        set({ profile })
      }
    } catch (error) {
      console.error('Initialization error:', error)
    } finally {
      set({ loading: false, initialized: true })
    }

    // Listen for auth changes — save subscription so we can clean up later
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip INITIAL_SESSION: already handled via getSession() above
      if (event === 'INITIAL_SESSION') return

      if (session) {
        set({ user: session.user })
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('supabase_user_id', session.user.id)
          .single()
        set({ profile })
      } else {
        set({ user: null, profile: null })
      }
      set({ loading: false })
    })

    set({ _authSubscription: subscription })
  },

  cleanup: () => {
    const { _authSubscription } = get()
    if (_authSubscription) {
      _authSubscription.unsubscribe()
      set({ _authSubscription: null })
    }
  },

  updateProfile: async (updates) => {
    const { profile } = get()
    if (!profile) throw new Error('No profile loaded')
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('user_id', profile.user_id)
      .select()
      .single()
    if (error) throw error
    set({ profile: data })
    return data
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  }
}))

