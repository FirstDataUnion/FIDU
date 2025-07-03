import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePromptTextOptions {
  initialValue?: string;
  debounceMs?: number;
  onDebouncedChange?: (value: string) => void;
}

export const usePromptText = ({
  initialValue = '',
  debounceMs = 300,
  onDebouncedChange
}: UsePromptTextOptions = {}) => {
  const [localValue, setLocalValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSyncedValue = useRef(initialValue);

  // Update local value when initial value changes (e.g., when loading a saved prompt)
  useEffect(() => {
    if (initialValue !== lastSyncedValue.current) {
      setLocalValue(initialValue);
      setDebouncedValue(initialValue);
      lastSyncedValue.current = initialValue;
    }
  }, [initialValue]);

  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue); // Immediate local update

    // Debounced sync
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      if (newValue !== lastSyncedValue.current) {
        setDebouncedValue(newValue);
        lastSyncedValue.current = newValue;
        onDebouncedChange?.(newValue);
      }
    }, debounceMs);
  }, [debounceMs, onDebouncedChange]);

  const handleBlur = useCallback(() => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Immediate sync on blur
    if (localValue !== lastSyncedValue.current) {
      setDebouncedValue(localValue);
      lastSyncedValue.current = localValue;
      onDebouncedChange?.(localValue);
    }
  }, [localValue, onDebouncedChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    value: localValue,
    debouncedValue,
    onChange: handleChange,
    onBlur: handleBlur,
    setValue: setLocalValue // For programmatic updates
  };
}; 