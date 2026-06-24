import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

// Module-level ref to hold the auth subscription — prevents listener stacking
let authSubscription = null

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

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
    // Guard: only run once. Prevents duplicate listeners on re-renders.
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

    // Clean up any existing subscription before registering a new one
    if (authSubscription) {
      authSubscription.unsubscribe()
    }

    // Listen for auth changes (SIGNED_IN / SIGNED_OUT only)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ user: null, profile: null })
        return
      }

      if (event === 'SIGNED_IN' && session) {
        set({ user: session.user })
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('supabase_user_id', session.user.id)
            .single()
          set({ profile })
        } catch (error) {
          console.error('Error fetching profile on SIGNED_IN:', error)
        }
      }
      // NOTE: Do NOT touch `loading` here — it would trigger ProtectedRoute's
      // spinner for every background token refresh (TOKEN_REFRESHED event).
    })

    authSubscription = subscription
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

