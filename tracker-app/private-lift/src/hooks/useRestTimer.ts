import { useState, useEffect, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useWorkout } from '../store/WorkoutContext';
import { Platform } from 'react-native';

export const useRestTimer = () => {
  const { settings } = useWorkout();
  const [timeLeft, setTimeLeft] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAlerts = useCallback(async () => {
    if (!settings) return;

    if (settings.rest_timer_vibrate && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if (settings.rest_timer_sound) {
      // Note: In a real app, we'd bundle a specific alert sound. 
      // For now, we'll use a placeholder or system-like behavior if possible.
      try {
        const { sound } = await Audio.Sound.createAsync(
           { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' } // Simple beep
        );
        await sound.playAsync();
        // Unload after playing
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync();
          }
        });
      } catch (e) {
        console.warn('Failed to play timer sound:', e);
      }
    }
  }, [settings]);

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
          triggerAlerts();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [settings, stopTimer, triggerAlerts]);

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
