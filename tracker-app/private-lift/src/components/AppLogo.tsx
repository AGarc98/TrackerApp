import React, { useEffect } from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withTiming, 
  withSequence,
  Easing
} from 'react-native-reanimated';

interface AppLogoProps {
  size?: number;
  color?: string;
  className?: string;
  animated?: boolean;
}

/**
 * Minimalist Logo: Lock + Dumbbell Hybrid (SVG Version)
 * Bottom: Lock body with keyhole
 * Top: Dumbbell-inspired shackle
 */
export const AppLogo: React.FC<AppLogoProps> = ({ 
  size = 32, 
  color = '#3b82f6', 
  className = '',
  animated = false 
}) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (animated) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Infinite
        true // Reverse
      );
    } else {
      opacity.value = 1;
    }
  }, [animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 0.95 + (opacity.value * 0.05) }]
  }));

  return (
    <Animated.View style={animated ? animatedStyle : {}} className={className}>
      <Svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none"
      >
        {/* Dumbbell Shackle (Top) */}
        <Path 
          d="M25 20 H75 M25 10 V30 M75 10 V30" 
          stroke={color} 
          strokeWidth="10" 
          strokeLinecap="round" 
        />
        
        {/* Lock Body (Bottom) */}
        <Rect 
          x="20" 
          y="45" 
          width="60" 
          height="45" 
          rx="12" 
          fill={color} 
        />
        
        {/* Keyhole (Minimalist) */}
        <Circle cx="50" cy="62" r="4" fill="white" fillOpacity="0.5" />
        <Rect x="48" y="62" width="4" height="10" rx="2" fill="white" fillOpacity="0.5" />
      </Svg>
    </Animated.View>
  );
};
