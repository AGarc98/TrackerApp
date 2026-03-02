import { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkout } from '../store/WorkoutContext';

export const useRestTimer = () => {
  const { settings } = useWorkout();
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsActive(false);
    setTimeLeft(0);
  }, []);

  const startTimer = useCallback((durationOverride?: number) => {
    if (!settings?.rest_timer_enabled) return;

    stopTimer();
    const duration = durationOverride || settings.default_rest_duration || 60;
    setTimeLeft(duration);
    setIsActive(true);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [settings, stopTimer]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    timeLeft,
    isActive,
    startTimer,
    stopTimer,
  };
};
