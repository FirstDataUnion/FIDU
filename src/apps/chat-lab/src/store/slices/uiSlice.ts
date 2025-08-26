import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UIState, Notification } from '../../types';

const initialState: UIState = {
  sidebarOpen: true,
  currentPage: 'conversations',
  notifications: [],
  modals: {
    exportData: false,
    importData: false,
    settings: false,
    deleteConfirmation: false,
  },
  draggedItem: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setCurrentPage: (state, action: PayloadAction<string>) => {
      state.currentPage = action.payload;
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: Notification = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        read: false,
        ...action.payload,
      };
      state.notifications.unshift(notification);
      
      // Keep only the last 50 notifications
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50);
      }
    },
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.read = true;
      }
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearAllNotifications: (state) => {
      state.notifications = [];
    },
    markAllNotificationsRead: (state) => {
      state.notifications.forEach(n => n.read = true);
    },
    openModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      const modalName = action.payload;
      if (modalName in state.modals) {
        state.modals[modalName] = true;
      }
    },
    closeModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      const modalName = action.payload;
      if (modalName in state.modals) {
        state.modals[modalName] = false;
      }
    },
    closeAllModals: (state) => {
      Object.keys(state.modals).forEach(key => {
        state.modals[key as keyof typeof state.modals] = false;
      });
    },
    setDraggedItem: (state, action: PayloadAction<UIState['draggedItem']>) => {
      state.draggedItem = action.payload;
    },
    clearDraggedItem: (state) => {
      state.draggedItem = null;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setCurrentPage,
  addNotification,
  markNotificationRead,
  removeNotification,
  clearAllNotifications,
  markAllNotificationsRead,
  openModal,
  closeModal,
  closeAllModals,
  setDraggedItem,
  clearDraggedItem,
} = uiSlice.actions;

export default uiSlice.reducer; 