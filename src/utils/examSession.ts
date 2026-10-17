import { useSyncExternalStore } from 'react';
import { playPopSound, playCompletionSound } from './audioSynth';

export interface ExamSessionState {
  isActive: boolean;
  materialId?: string;
  materialTitle?: string;
  isExitModalOpen?: boolean;
  isLockdownMode?: boolean;
  violationsCount: number;
  maxViolations: number;
  showViolationModal?: boolean;
  showLockdownModal?: boolean;
  isTerminated?: boolean;
  lastViolationTime?: string;
  violationHistory: string[];
}

const MAX_VIOLATIONS = 3;

let currentState: ExamSessionState = {
  isActive: false,
  isExitModalOpen: false,
  isLockdownMode: false,
  violationsCount: 0,
  maxViolations: MAX_VIOLATIONS,
  showViolationModal: false,
  showLockdownModal: false,
  isTerminated: false,
  violationHistory: [],
};

let pendingExitAction: (() => void) | null = null;
let pendingMaterialTitle: string | undefined = undefined;
let lastViolationTimestamp = 0;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (currentState.isActive) {
    e.preventDefault();
    e.returnValue = 'PERINGATAN: Ujian sedang berlangsung! Yakin ingin keluar dari sistem?';
    return e.returnValue;
  }
};

/**
 * Fullscreen request helper
 */
export function requestLockdownFullscreen() {
  try {
    const docEl = document.documentElement as any;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(() => {});
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) {
      docEl.msRequestFullscreen();
    }
  } catch (err) {
    console.warn('Fullscreen request error:', err);
  }
}

/**
 * Register a security tab-switching or window blur violation
 */
export function registerTabViolation(reason: string = 'Berpindah Tab / Layar') {
  if (!currentState.isActive || currentState.isTerminated) return;

  const now = Date.now();
  // Cooldown 1.5s to prevent multiple trigger events from a single tab switch
  if (now - lastViolationTimestamp < 1500) return;
  lastViolationTimestamp = now;

  const timeStr = new Date().toLocaleTimeString('id-ID');
  const nextCount = currentState.violationsCount + 1;
  const newHistory = [...currentState.violationHistory, `${timeStr} - ${reason}`];

  if (nextCount >= MAX_VIOLATIONS) {
    // 3rd Violation: AUTOMATIC CANCEL / TERMINATION
    currentState = {
      ...currentState,
      violationsCount: nextCount,
      isTerminated: true,
      showViolationModal: true,
      lastViolationTime: timeStr,
      violationHistory: newHistory,
    };
    playPopSound();
  } else {
    // 1st or 2nd Violation: WARNING MODAL
    currentState = {
      ...currentState,
      violationsCount: nextCount,
      showViolationModal: true,
      lastViolationTime: timeStr,
      violationHistory: newHistory,
    };
    playPopSound();
  }

  notifyListeners();
}

/**
 * Handle visibility & window focus changes
 */
const handleVisibilityChange = () => {
  if (currentState.isActive && !currentState.isTerminated && document.hidden) {
    registerTabViolation('Berpindah Tab / Minimalkan Browser');
  }
};

const handleWindowBlur = () => {
  if (!currentState.isActive || currentState.isTerminated) return;

  setTimeout(() => {
    // If document became hidden, visibilitychange handles it
    if (document.hidden) {
      return;
    }

    // Check if user clicked/tapped inside Google Form iframe (NOT a violation)
    const activeTag = document.activeElement?.tagName?.toUpperCase();
    if (activeTag === 'IFRAME') {
      return;
    }

    if (!document.hasFocus()) {
      registerTabViolation('Meninggalkan Jendela Ujian');
    }
  }, 400);
};

/**
 * Handle Fullscreen change
 */
const handleFullscreenChange = () => {
  if (!currentState.isActive || currentState.isTerminated || !currentState.isLockdownMode) return;

  const doc = document as any;
  const isFS = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);

  if (!isFS) {
    currentState = {
      ...currentState,
      showLockdownModal: true,
    };
    notifyListeners();
  } else {
    if (currentState.showLockdownModal) {
      currentState = {
        ...currentState,
        showLockdownModal: false,
      };
      notifyListeners();
    }
  }
};

/**
 * Global Keyboard shortcuts restriction during active exam
 */
const handleKeyDown = (e: KeyboardEvent) => {
  if (!currentState.isActive || currentState.isTerminated) return;

  // Intercept Ctrl/Cmd + T, N, W, etc.
  if (
    (e.ctrlKey || e.metaKey) &&
    (e.key === 't' || e.key === 'T' || e.key === 'n' || e.key === 'N' || e.key === 'w' || e.key === 'W')
  ) {
    e.preventDefault();
    e.stopPropagation();
    registerTabViolation('Mencoba Membuka Tab Baru / Menutup Jendela');
  } else if (
    e.key === 'F12' ||
    ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j'))
  ) {
    e.preventDefault();
    e.stopPropagation();
    registerTabViolation('Mencoba Membuka Developer Tools (F12)');
  }
};

/**
 * Start an active exam session globally and bind system exit & anti-cheat protection
 */
export function startExamSession(
  materialId?: string,
  materialTitle?: string,
  options?: { enableLockdown?: boolean }
) {
  const enableLockdown = options?.enableLockdown ?? true;

  if (
    currentState.isActive &&
    currentState.materialId === materialId &&
    currentState.materialTitle === materialTitle &&
    !currentState.isExitModalOpen &&
    !currentState.isTerminated
  ) {
    return;
  }

  currentState = {
    isActive: true,
    materialId,
    materialTitle,
    isExitModalOpen: false,
    isLockdownMode: enableLockdown,
    violationsCount: 0,
    maxViolations: MAX_VIOLATIONS,
    showViolationModal: false,
    showLockdownModal: false,
    isTerminated: false,
    violationHistory: [],
  };

  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('beforeunload', handleBeforeUnload);

  document.removeEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  window.removeEventListener('blur', handleWindowBlur);
  window.addEventListener('blur', handleWindowBlur);

  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('fullscreenchange', handleFullscreenChange);

  window.removeEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keydown', handleKeyDown, true);

  if (enableLockdown) {
    requestLockdownFullscreen();
  }

  notifyListeners();
}

/**
 * Stop active exam session globally and clear protection
 */
export function stopExamSession() {
  if (!currentState.isActive && !currentState.isExitModalOpen && !currentState.isTerminated) {
    return;
  }

  currentState = {
    isActive: false,
    isExitModalOpen: false,
    isLockdownMode: false,
    violationsCount: 0,
    maxViolations: MAX_VIOLATIONS,
    showViolationModal: false,
    showLockdownModal: false,
    isTerminated: false,
    violationHistory: [],
  };
  pendingExitAction = null;
  pendingMaterialTitle = undefined;

  window.removeEventListener('beforeunload', handleBeforeUnload);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('blur', handleWindowBlur);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  window.removeEventListener('keydown', handleKeyDown, true);

  try {
    const doc = document as any;
    if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement) {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  } catch (err) {}

  notifyListeners();
}

export function dismissViolationModal() {
  currentState = {
    ...currentState,
    showViolationModal: false,
  };
  notifyListeners();
}

export function dismissLockdownModal() {
  requestLockdownFullscreen();
  currentState = {
    ...currentState,
    showLockdownModal: false,
  };
  notifyListeners();
}

/**
 * Check if an exam is currently active anywhere in the system
 */
export function isExamActive(): boolean {
  return currentState.isActive;
}

/**
 * Get full state of current exam session
 */
export function getExamSessionState(): ExamSessionState {
  return currentState;
}

/**
 * Get pending material title for exit confirmation
 */
export function getPendingExitMaterialTitle(): string | undefined {
  return pendingMaterialTitle || currentState.materialTitle;
}

/**
 * Utility helper to confirm exit with student using strict modal confirmation
 */
export function confirmExitExam(onConfirmed: () => void): boolean {
  if (currentState.isActive && !currentState.isTerminated) {
    pendingExitAction = onConfirmed;
    pendingMaterialTitle = currentState.materialTitle;
    currentState = {
      ...currentState,
      isExitModalOpen: true,
    };
    notifyListeners();
    return false;
  }
  onConfirmed();
  return true;
}

/**
 * Confirms exiting the exam session, stops session and triggers pending navigation
 */
export function confirmExitAndStop() {
  const action = pendingExitAction;
  stopExamSession();
  if (action) {
    action();
  }
}

/**
 * Cancels the exit modal and resumes the active exam
 */
export function cancelExitModal() {
  pendingExitAction = null;
  pendingMaterialTitle = undefined;
  currentState = {
    ...currentState,
    isExitModalOpen: false,
  };
  notifyListeners();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot() {
  return currentState;
}

/**
 * React Hook for subscribing to global exam session state safely
 */
export function useExamSession(): ExamSessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}



