import { useState, useEffect, useCallback, useRef } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  isChecking: boolean;
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
  checkConnection: () => Promise<boolean>;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(() => (isOnline ? new Date() : null));
  const [lastOfflineAt, setLastOfflineAt] = useState<Date | null>(() => (!isOnline ? new Date() : null));
  
  const hasBeenOffline = useRef<boolean>(!isOnline);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }

    setIsChecking(true);
    try {
      // Lightweight probe with a short timeout to check real internet access
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // Probe origin or lightweight resource
      await fetch(`/?_ping=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setIsOnline(true);
      return true;
    } catch {
      // If network request failed or timed out, might be offline or unreachable
      const online = typeof navigator !== 'undefined' ? navigator.onLine : false;
      setIsOnline(online);
      return online;
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
      if (hasBeenOffline.current) {
        setWasOffline(true);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastOfflineAt(new Date());
      hasBeenOffline.current = true;
      setWasOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // When back online, reset `wasOffline` after 5 seconds so the online notification auto-hides
  useEffect(() => {
    if (isOnline && wasOffline) {
      const timer = setTimeout(() => {
        setWasOffline(false);
        hasBeenOffline.current = false;
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  return {
    isOnline,
    wasOffline,
    isChecking,
    lastOnlineAt,
    lastOfflineAt,
    checkConnection,
  };
}
