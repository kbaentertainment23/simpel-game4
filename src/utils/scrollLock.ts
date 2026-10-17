import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;

function preventDefaultScroll(e: Event) {
  // If the event occurs inside an element marked data-modal-scrollable="true", allow internal scrolling
  const target = e.target as HTMLElement | null;
  const scrollable = target?.closest('[data-modal-scrollable="true"]');
  if (scrollable) {
    return;
  }
  if (e.cancelable) {
    e.preventDefault();
  }
}

/**
 * Safely increment scroll lock count and disable background scrolling completely.
 * Locks both <html> and <body>, pins scroll position to prevent rubberbanding/shifting,
 * and cancels passive wheel & touchmove events on the window.
 */
export function lockBodyScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  lockCount++;
  if (lockCount === 1) {
    savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // 1. Intercept wheel and touchmove events outside modal containers
    window.addEventListener('wheel', preventDefaultScroll, { passive: false });
    window.addEventListener('touchmove', preventDefaultScroll, { passive: false });

    // 2. Lock html
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.touchAction = 'none';

    // 3. Pin body fixed to current scrollY position to completely freeze the viewport
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
}

/**
 * Safely decrement scroll lock count and re-enable scrolling when all locks are released.
 */
export function unlockBodyScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    window.removeEventListener('wheel', preventDefaultScroll);
    window.removeEventListener('touchmove', preventDefaultScroll);

    document.documentElement.style.overflow = '';
    document.documentElement.style.touchAction = '';

    const top = document.body.style.top;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.paddingRight = '';

    const scrollY = top ? -parseInt(top, 10) : savedScrollY;
    window.scrollTo({ top: scrollY, behavior: 'instant' });
  }
}

/**
 * Force-reset all scroll locks (e.g. on navigation or unhandled error).
 */
export function forceUnlockBodyScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  lockCount = 0;
  window.removeEventListener('wheel', preventDefaultScroll);
  window.removeEventListener('touchmove', preventDefaultScroll);

  document.documentElement.style.overflow = '';
  document.documentElement.style.touchAction = '';

  const top = document.body.style.top;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
  document.body.style.paddingRight = '';

  if (top) {
    const scrollY = -parseInt(top, 10);
    window.scrollTo({ top: scrollY, behavior: 'instant' });
  }
}

/**
 * React hook to lock document body scroll while `isLocked` is true.
 * Automatically cleans up on unmount or when `isLocked` becomes false.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}
