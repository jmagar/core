import { useState, useEffect } from "react";

/**
 * A hook that persists state to localStorage
 * @param key - The localStorage key to store the value under
 * @param defaultValue - The default value to use if nothing is stored
 * @returns A tuple of [value, setValue] similar to useState
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prevValue: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    // Only access localStorage on the client side
    if (typeof window === "undefined") {
      return defaultValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  const setValue = (value: T | ((prevValue: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(state) : value;
      setState(valueToStore);

      // Save to localStorage on the client side
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [state, setValue];
}