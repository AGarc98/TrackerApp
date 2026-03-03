import React from 'react';
import { View } from 'react-native';

interface AppLogoProps {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Minimalist Logo: Lock + Dumbbell Hybrid
 * Bottom half: Rounded lock body
 * Top half: Dumbbell shackle
 */
export const AppLogo: React.FC<AppLogoProps> = ({ size = 32, color = 'var(--color-primary)', className = '' }) => {
  const bodySize = size * 0.6;
  const shackleWidth = size * 0.7;
  const shackleHeight = size * 0.4;
  const plateWidth = size * 0.15;
  const barHeight = size * 0.08;

  return (
    <View 
      style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }} 
      className={className}
    >
      {/* Dumbbell Shackle (Top) */}
      <View style={{ width: shackleWidth, height: shackleHeight, alignItems: 'center', marginBottom: -size * 0.05 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Left Plate */}
          <View 
            style={{ 
              width: plateWidth, 
              height: shackleHeight, 
              backgroundColor: color, 
              borderRadius: plateWidth / 2 
            }} 
          />
          {/* Handle / Bar */}
          <View 
            style={{ 
              width: shackleWidth - (plateWidth * 2), 
              height: barHeight, 
              backgroundColor: color 
            }} 
          />
          {/* Right Plate */}
          <View 
            style={{ 
              width: plateWidth, 
              height: shackleHeight, 
              backgroundColor: color, 
              borderRadius: plateWidth / 2 
            }} 
          />
        </View>
      </View>

      {/* Lock Body (Bottom) */}
      <View 
        style={{ 
          width: bodySize, 
          height: bodySize, 
          backgroundColor: color, 
          borderRadius: size * 0.15,
          borderBottomLeftRadius: size * 0.25,
          borderBottomRightRadius: size * 0.25,
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {/* Minimal Keyhole */}
        <View 
          style={{ 
            width: size * 0.1, 
            height: size * 0.2, 
            backgroundColor: 'rgba(255,255,255,0.3)', 
            borderRadius: size * 0.05 
          }} 
        />
      </View>
    </View>
  );
};
