import { useState, useEffect } from 'react';

/**
 * Detects if the current client is a mobile/touch device (Smartphone or Tablet).
 * Checks:
 * 1. navigator.maxTouchPoints > 0 or touch event support
 * 2. CSS Media query (pointer: coarse)
 * 3. Mobile User Agent regex check
 * 4. Screen width threshold for mobile/tablet responsive breakpoints
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const hasTouchPoints =
    ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0) ||
    ('msMaxTouchPoints' in navigator && (navigator as any).msMaxTouchPoints > 0) ||
    'ontouchstart' in window;

  const hasCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
    navigator.userAgent || navigator.vendor || (window as any).opera || ''
  );

  const isNarrowScreen = window.innerWidth <= 840;

  // Evaluates to true strictly for mobile/tablet touch interfaces
  return (hasTouchPoints && hasCoarsePointer) || isMobileUA || (hasTouchPoints && isNarrowScreen);
}

/**
 * React hook to reactively track mobile device status on resize or orientation change
 */
export function useIsMobileDevice(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return isMobileDevice();
  });

  useEffect(() => {
    const handleCheck = () => {
      setIsMobile(isMobileDevice());
    };

    handleCheck();

    window.addEventListener('resize', handleCheck, { passive: true });
    window.addEventListener('orientationchange', handleCheck, { passive: true });

    return () => {
      window.removeEventListener('resize', handleCheck);
      window.removeEventListener('orientationchange', handleCheck);
    };
  }, []);

  return isMobile;
}
