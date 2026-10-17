import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

export interface QuizTimeAttackBadgeProps {
  totalSeconds: number;
  questionIndex: number;
  isAnswered: boolean;
  isCompleted: boolean;
  onTimeOut: () => void;
}

export const QuizTimeAttackBadge: React.FC<QuizTimeAttackBadgeProps> = React.memo(
  ({ totalSeconds, questionIndex, isAnswered, isCompleted, onTimeOut }) => {
    const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
    const startTimeRef = useRef<number>(performance.now());
    const animFrameRef = useRef<number | null>(null);
    const hasTriggeredTimeoutRef = useRef<boolean>(false);
    const onTimeOutRef = useRef(onTimeOut);

    // Keep ref in sync to avoid effect re-runs
    useEffect(() => {
      onTimeOutRef.current = onTimeOut;
    }, [onTimeOut]);

    useEffect(() => {
      // Reset timer on new question or start
      startTimeRef.current = performance.now();
      hasTriggeredTimeoutRef.current = false;
      setRemainingSeconds(totalSeconds);

      if (isAnswered || isCompleted) {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        return;
      }

      let lastSecond = totalSeconds;

      const tick = () => {
        const now = performance.now();
        const elapsed = (now - startTimeRef.current) / 1000;
        const left = Math.max(0, Math.ceil(totalSeconds - elapsed));

        if (left !== lastSecond) {
          lastSecond = left;
          setRemainingSeconds(left);
        }

        if (left <= 0) {
          if (!hasTriggeredTimeoutRef.current) {
            hasTriggeredTimeoutRef.current = true;
            onTimeOutRef.current();
          }
        } else {
          animFrameRef.current = requestAnimationFrame(tick);
        }
      };

      animFrameRef.current = requestAnimationFrame(tick);

      return () => {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
      };
    }, [questionIndex, totalSeconds, isAnswered, isCompleted]);

    if (isAnswered || isCompleted) return null;

    const isUrgent = remainingSeconds <= 5;

    return (
      <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold text-slate-200 transition-colors">
        <Clock
          className={`w-3.5 h-3.5 ${
            isUrgent ? 'text-rose-400 animate-bounce' : 'text-indigo-400'
          }`}
        />
        <span
          className={
            isUrgent
              ? 'text-rose-400 font-black tracking-wide'
              : 'text-white font-black'
          }
        >
          {remainingSeconds}s
        </span>
      </div>
    );
  }
);

QuizTimeAttackBadge.displayName = 'QuizTimeAttackBadge';
