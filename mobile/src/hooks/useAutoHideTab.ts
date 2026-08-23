// src/hooks/useAutoHideTab.ts
import { useRef } from 'react';
import { useScrollContext } from '../context/ScrollContext';

export const useAutoHideTab = () => {
  const { setScrollValue } = useScrollContext();
  const lastScrollY = useRef(0);

  const handleScroll = (event: any) => {
    const currentOffsetY = event.nativeEvent.contentOffset.y;
    const diff = currentOffsetY - lastScrollY.current;
    
    if (diff > 5) {
      setScrollValue(1);
    } else if (diff < -5) {
      setScrollValue(0);
    }
    
    lastScrollY.current = currentOffsetY;
  };

  return { handleScroll };
};