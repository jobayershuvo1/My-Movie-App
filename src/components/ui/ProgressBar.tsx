import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

interface ProgressBarProps {
  /**
   * Optional manual controls. If provided, overrides default automatic routing-based tracking.
   */
  manualProgress?: number | null;
}

export default function ProgressBar({ manualProgress = null }: ProgressBarProps) {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);

  // Handle routing-based fake progress progress bar (NProgress-like behaviour)
  useEffect(() => {
    // If there is manual override, neglect automated router simulation
    if (manualProgress !== null) return;

    setActive(true);
    setProgress(15);

    // Initial rapid burst to 45%
    const fastTimer = setTimeout(() => {
      setProgress(48);
    }, 120);

    // Slower increment to 88% simulating server wait
    const slowTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) {
          clearInterval(slowTimer);
          return 88;
        }
        return prev + Math.floor(Math.random() * 5) + 2;
      });
    }, 350);

    // Completion sequence
    const completeTimer = setTimeout(() => {
      setProgress(100);
      const fadeTimer = setTimeout(() => {
        setActive(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(fadeTimer);
    }, 600);

    return () => {
      clearTimeout(fastTimer);
      clearInterval(slowTimer);
      clearTimeout(completeTimer);
    };
  }, [location.pathname, location.search, manualProgress]);

  // Hook into manual overrides (if any background system fires detailed loader hooks)
  useEffect(() => {
    if (manualProgress !== null) {
      if (manualProgress > 0 && manualProgress < 100) {
        setActive(true);
        setProgress(manualProgress);
      } else if (manualProgress >= 100) {
        setProgress(100);
        const timer = setTimeout(() => {
          setActive(false);
          setProgress(0);
        }, 300);
        return () => clearTimeout(timer);
      } else {
        setActive(false);
        setProgress(0);
      }
    }
  }, [manualProgress]);

  // Listen to custom window actions so pages can broadcast file-import or download progress manually
  useEffect(() => {
    const handleProgressUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ progress: number }>;
      if (customEvent.detail && typeof customEvent.detail.progress === 'number') {
        setActive(true);
        setProgress(customEvent.detail.progress);
        if (customEvent.detail.progress >= 100) {
          setTimeout(() => {
            setActive(false);
            setProgress(0);
          }, 350);
        }
      }
    };

    window.addEventListener('cinevault_global_progress', handleProgressUpdate);
    return () => {
      window.removeEventListener('cinevault_global_progress', handleProgressUpdate);
    };
  }, []);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[3.2px]"
        >
          {/* Progress bar fill gradient */}
          <motion.div
            className="h-full bg-gradient-to-r from-red-650 via-red-500 to-amber-550 relative rounded-r"
            animate={{ width: `${progress}%` }}
            transition={{
              type: 'spring',
              stiffness: 120,
              damping: 18,
              mass: 0.6,
            }}
          >
            {/* Ambient neon light trailing glow effect at the right end of the bar */}
            <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-r from-transparent to-red-400 opacity-80 blur-[2px] transition-all" />
            <div className="absolute right-0 top-0 h-full w-8 bg-white opacity-40 shadow-[0_0_12px_#ef4444]" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Utility helper to dispatch manual progress events worldwide in the app.
 * E.g. dispatchCinevaultProgress(45) -> updates bar to 45%
 */
export function dispatchCinevaultProgress(percent: number) {
  const event = new CustomEvent('cinevault_global_progress', {
    detail: { progress: percent },
  });
  window.dispatchEvent(event);
}
