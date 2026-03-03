import { create } from 'zustand';
import { startOfWeek } from 'date-fns';

interface UIState {
  selectedLocationId: string | null;
  activeWeekStart: Date;
  unreadNotificationCount: number;
  staleShiftIds: Set<string>;

  // Actions
  setSelectedLocationId: (id: string | null) => void;
  setActiveWeekStart: (date: Date) => void;
  setUnreadNotificationCount: (count: number) => void;
  addStaleShiftId: (id: string) => void;
  clearStaleShiftIds: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedLocationId: null, // Will be hydrated from API or user preference
  activeWeekStart: startOfWeek(new Date(), { weekStartsOn: 1 }), // Monday start
  unreadNotificationCount: 0,
  staleShiftIds: new Set(),

  setSelectedLocationId: (id) => set({ selectedLocationId: id }),
  setActiveWeekStart: (date) => set({ activeWeekStart: date }),
  setUnreadNotificationCount: (count) => set({ unreadNotificationCount: count }),
  
  addStaleShiftId: (id) => set((state) => {
      const newSet = new Set(state.staleShiftIds);
      newSet.add(id);
      return { staleShiftIds: newSet };
  }),
  
  clearStaleShiftIds: () => set({ staleShiftIds: new Set() })
}));
