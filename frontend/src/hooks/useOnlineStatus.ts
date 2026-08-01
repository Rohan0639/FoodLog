import { useEffect, useState } from 'react';

/**
 * Whether the browser currently has a network connection.
 *
 * Storage is always available now, so this no longer says anything about
 * whether logs can be saved. It reflects one thing only: whether the AI parser
 * endpoint is reachable. The Navbar indicator it drives is unchanged.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
