import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export const useAuthStore = create((set) => ({
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

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
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
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  }
}))
