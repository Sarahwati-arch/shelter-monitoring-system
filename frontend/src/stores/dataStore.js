import { create } from 'zustand'
import { dashboardService } from '@/services/dashboardService'

/**
 * Global data store for cross-page caching.
 * Prevents redundant re-fetches when navigating between pages.
 * Uses stale-while-revalidate: serve cached data immediately,
 * then refresh in the background.
 */
export const useDataStore = create((set, get) => ({
  // ─── Shelters ────────────────────────────────────────────────────────────────
  shelters: [],
  sheltersLoaded: false,

  fetchShelters: async (force = false) => {
    if (!force && get().sheltersLoaded) return get().shelters
    try {
      const data = await dashboardService.getShelters()
      set({ shelters: data, sheltersLoaded: true })
      return data
    } catch (error) {
      console.error('[dataStore] fetchShelters:', error)
      return get().shelters // return stale data on error
    }
  },

  // ─── Open Alerts (for Header badge) ──────────────────────────────────────────
  openAlerts: [],
  openAlertsLoaded: false,

  fetchOpenAlerts: async () => {
    try {
      const data = await dashboardService.getAlerts({ status: 'open' })
      set({ openAlerts: data, openAlertsLoaded: true })
      return data
    } catch (error) {
      console.error('[dataStore] fetchOpenAlerts:', error)
      return get().openAlerts
    }
  },

  setOpenAlerts: (alerts) => set({ openAlerts: alerts, openAlertsLoaded: true }),

  // Add a new alert to the open list (called from realtime handlers)
  addOpenAlert: (alert) => set((state) => ({
    openAlerts: [alert, ...state.openAlerts]
  })),

  // Remove alert from open list when acknowledged/closed
  removeOpenAlert: (alertId) => set((state) => ({
    openAlerts: state.openAlerts.filter((a) => a.alert_id !== alertId)
  })),

  // ─── Devices cache (per shelter) ─────────────────────────────────────────────
  devicesByShelterId: {},

  getDevicesCache: (shelterId) => {
    return get().devicesByShelterId[shelterId ?? 'all'] ?? null
  },

  setDevicesCache: (shelterId, devices) => set((state) => ({
    devicesByShelterId: {
      ...state.devicesByShelterId,
      [shelterId ?? 'all']: devices
    }
  })),

  // ─── Evidence cache (per shelter) ────────────────────────────────────────────
  evidenceByShelterId: {},

  getEvidenceCache: (shelterId) => {
    return get().evidenceByShelterId[shelterId ?? 'all'] ?? null
  },

  setEvidenceCache: (shelterId, evidence) => set((state) => ({
    evidenceByShelterId: {
      ...state.evidenceByShelterId,
      [shelterId ?? 'all']: evidence
    }
  })),

  // Prepend a new evidence item to ALL shelter caches (realtime event)
  prependEvidence: (evidenceItem) => set((state) => {
    const updated = {}
    Object.keys(state.evidenceByShelterId).forEach((key) => {
      updated[key] = [evidenceItem, ...state.evidenceByShelterId[key]]
    })
    return { evidenceByShelterId: updated }
  }),
}))
