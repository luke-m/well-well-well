import { useState, useEffect } from 'react';

/**
 * A custom hook that provides a way to use localStorage with React state.
 * 
 * @template T The type of the value being stored.
 * @param key The key to use in localStorage.
 * @param initialValue The initial value to use if no value is found in localStorage.
 * @returns An array containing the current value and a function to update the value.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // State to store our value
  // Pass initial state function to useState so initializer is never called twice on re-renders
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that also persists to localStorage.
  // <T> is used here so we can use the object/array/etc. passed in if needed
  // <(val: T) => T> is needed for when we passed a function as the second parameter
  const setValue = (value: T | ((val: T) => T)) => {
    // Allow value to be a function as in setState
    const valueToStore = value instanceof Function ? value(storedValue) : value;

    // Update state
    setStoredValue(valueToStore);

    // Update localStorage
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error(`Error writing localStorage key "${key}":`, error);
      }
    }
  };

  return [storedValue, setValue];
}