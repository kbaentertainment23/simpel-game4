import { useEffect, useRef } from 'react';
import { confirmExitExam, isExamActive } from './examSession';

type ModalCloseHandler = () => void;

interface ModalStackItem {
  id: string;
  close: ModalCloseHandler;
}

// Global modal stack for back-button dismissal
const modalStack: ModalStackItem[] = [];

/**
 * Register a modal or popup to be closed when the Back button is pressed.
 */
export function registerMobileModal(id: string, closeHandler: ModalCloseHandler): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  // Remove any existing entry with the same ID first
  const existingIdx = modalStack.findIndex((item) => item.id === id);
  if (existingIdx >= 0) {
    modalStack.splice(existingIdx, 1);
  }

  modalStack.push({ id, close: closeHandler });

  // Push history state to capture back button
  try {
    window.history.pushState({ appNavLevel: 'modal', mobileModalId: id, timestamp: Date.now() }, '');
  } catch {}

  // Return unregister callback
  return () => {
    const idx = modalStack.findIndex((item) => item.id === id);
    if (idx >= 0) {
      modalStack.splice(idx, 1);
    }
  };
}

/**
 * Hook to automatically register a modal for back button interception
 * when `isOpen` is true.
 */
export function useMobileBackModal(id: string, isOpen: boolean, onClose: ModalCloseHandler) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const unregister = registerMobileModal(id, () => {
      onCloseRef.current();
    });

    return () => {
      unregister();
    };
  }, [id, isOpen]);
}

export interface MobileNavigationCallbacks {
  selectedSubjectId: string | null;
  selectedCategoryId: string | null;
  onBackToSubjects: () => void;
  onBackToCategories: () => void;
}

/**
 * Hook for main application back button & gesture orchestration.
 * Guarantees strict sequential navigation:
 * Materi (category_detail) -> Topik (category_list) -> Mata Pelajaran (subject_selector) -> Exit
 */
export function useMobileHardwareBack(callbacks: MobileNavigationCallbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const currentLevelRef = useRef<'subject_selector' | 'category_list' | 'category_detail'>('subject_selector');
  const isNavigatingViaPopstateRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);

  // Determine current navigation level
  const currentLevel: 'subject_selector' | 'category_list' | 'category_detail' = callbacks.selectedCategoryId
    ? 'category_detail'
    : callbacks.selectedSubjectId
    ? 'category_list'
    : 'subject_selector';

  // 1. Initial history state setup: ensure root entry is tagged with 'subject_selector'
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      try {
        window.history.replaceState({ appNavLevel: 'subject_selector', timestamp: Date.now() }, '');
      } catch {}
      currentLevelRef.current = currentLevel;
    }
  }, []);

  // 2. Synchronize forward navigation with browser history
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const previousLevel = currentLevelRef.current;

    // If this level change was triggered by popstate (back navigation), don't push state!
    if (isNavigatingViaPopstateRef.current) {
      isNavigatingViaPopstateRef.current = false;
      currentLevelRef.current = currentLevel;
      return;
    }

    if (currentLevel !== previousLevel) {
      try {
        if (currentLevel === 'category_list' && previousLevel === 'subject_selector') {
          // Navigating from Mata Pelajaran -> Topik
          window.history.pushState(
            { appNavLevel: 'category_list', subjectId: callbacks.selectedSubjectId, timestamp: Date.now() },
            ''
          );
        } else if (currentLevel === 'category_detail' && previousLevel === 'category_list') {
          // Navigating from Topik -> Materi
          window.history.pushState(
            {
              appNavLevel: 'category_detail',
              subjectId: callbacks.selectedSubjectId,
              categoryId: callbacks.selectedCategoryId,
              timestamp: Date.now(),
            },
            ''
          );
        } else if (currentLevel === 'category_detail' && previousLevel === 'subject_selector') {
          // Direct open from Mata Pelajaran -> Materi (e.g. search / quick card)
          // Push category_list first so sequential back goes: Materi -> Topik -> Mata Pelajaran!
          window.history.pushState(
            { appNavLevel: 'category_list', subjectId: callbacks.selectedSubjectId, timestamp: Date.now() },
            ''
          );
          window.history.pushState(
            {
              appNavLevel: 'category_detail',
              subjectId: callbacks.selectedSubjectId,
              categoryId: callbacks.selectedCategoryId,
              timestamp: Date.now() + 1,
            },
            ''
          );
        }
      } catch {}

      currentLevelRef.current = currentLevel;
    }
  }, [currentLevel, callbacks.selectedSubjectId, callbacks.selectedCategoryId]);

  // 3. Listen to popstate event (triggered by HP back button or back gesture)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (e: PopStateEvent) => {
      // 1. Check if an active exam session is in progress
      if (isExamActive()) {
        try {
          window.history.pushState({ examLock: true }, '');
        } catch {}

        confirmExitExam(() => {
          isNavigatingViaPopstateRef.current = true;
          if (callbacksRef.current.selectedCategoryId) {
            callbacksRef.current.onBackToCategories();
          } else if (callbacksRef.current.selectedSubjectId) {
            callbacksRef.current.onBackToSubjects();
          }
        });
        return;
      }

      // 2. Check if any modal is currently open in modalStack
      if (modalStack.length > 0) {
        const topModal = modalStack.pop();
        if (topModal) {
          topModal.close();
          return;
        }
      }

      // 3. Mark that we are navigating via popstate so useEffect does not push a duplicate state!
      isNavigatingViaPopstateRef.current = true;

      // 4. Sequential back navigation:
      // If inside Category Detail (Materi): return to Category List (Topik)
      if (callbacksRef.current.selectedCategoryId) {
        callbacksRef.current.onBackToCategories();
        return;
      }

      // If inside Category List (Topik): return to Subject Selector (Mata Pelajaran)
      if (callbacksRef.current.selectedSubjectId) {
        callbacksRef.current.onBackToSubjects();
        return;
      }

      // If already at Subject Selector (Mata Pelajaran):
      // Natural browser pop to previous site / close tab
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
}
