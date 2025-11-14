import React, { createContext, useContext, useRef, useCallback, useMemo } from 'react';

interface AlertClickContextType {
  onAlertClick: (alertId: string) => void;
  setOnAlertClick: (handler: ((alertId: string) => void) | null) => void;
}

const AlertClickContext = createContext<AlertClickContextType | null>(null);

export function AlertClickProvider({ children }: { children: React.ReactNode }) {
  // Use a ref to store the handler so we don't need to recreate the context value when it changes
  const handlerRef = useRef<((alertId: string) => void) | null>(null);

  const handleSetOnAlertClick = useCallback((handler: ((alertId: string) => void) | null) => {
    handlerRef.current = handler;
  }, []);

  const handleAlertClick = useCallback((alertId: string) => {
    if (handlerRef.current) {
      handlerRef.current(alertId);
    }
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    onAlertClick: handleAlertClick,
    setOnAlertClick: handleSetOnAlertClick,
  }), [handleAlertClick, handleSetOnAlertClick]);

  return (
    <AlertClickContext.Provider value={contextValue}>
      {children}
    </AlertClickContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAlertClick() {
  const context = useContext(AlertClickContext);
  return context;
}

