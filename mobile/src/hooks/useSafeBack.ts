import { useCallback, useRef } from 'react';
import { router, useFocusEffect, useNavigation, type Href } from 'expo-router';

export function useSafeBack(fallback: Href = '/(student)/dashboard') {
  const navigation = useNavigation();
  const leaving = useRef(false);
  useFocusEffect(useCallback(() => {
    leaving.current = false;
    return () => { leaving.current = true; };
  }, []));
  return useCallback(() => {
    if (leaving.current || !navigation.isFocused()) return;
    leaving.current = true;
    if (navigation.canGoBack()) navigation.goBack();
    else router.replace(fallback);
  }, [navigation, fallback]);
}
