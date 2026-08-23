// src/context/ScrollContext.tsx
import React, { createContext, useContext, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

interface ScrollContextType {
  setScrollValue: (value: number) => void;
  translateY: Animated.Value;
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;

  const setScrollValue = (value: number) => {
    Animated.timing(translateY, {
      toValue: value === 0 ? 0 : 100,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <ScrollContext.Provider value={{ setScrollValue, translateY }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScrollContext() {
  const context = useContext(ScrollContext);
  if (context === undefined) {
    throw new Error('useScrollContext must be used within a ScrollProvider');
  }
  return context;
}