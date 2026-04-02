import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Switch,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useWorkout } from '../store/WorkoutContext';
import { UserSettings } from '../types/database';
import { requestCalendarPermissions } from '../services/CalendarService';

interface Props {
  onComplete: () => void;
}

export const OnboardingScreen = ({ onComplete }: Props) => {
  const { updateSettings, settings } = useWorkout();

  const [name, setName] = useState('');
  const [weightUnit, setWeightUnit] = useState<UserSettings['weight_unit']>('KG');
  const [distanceUnit, setDistanceUnit] = useState<UserSettings['distance_unit']>('KM');
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);

  const handleCalendarToggle = async (v: boolean) => {
    if (v) {
      const granted = await requestCalendarPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Enable calendar access in your device settings to use this feature.');
        return;
      }
    }
    setCalendarSyncEnabled(v);
  };

  const handleGetStarted = async () => {
    await updateSettings({
      user_name: name.trim() || null,
      weight_unit: weightUnit,
      distance_unit: distanceUnit,
      rest_timer_enabled: restTimerEnabled,
      calendar_sync_enabled: calendarSyncEnabled,
      onboarding_complete: true,
    } as Partial<UserSettings>);
    onComplete();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <ScrollView showsVerticalScrollIndicator={false} className="p-4 pt-14">

        {/* Header */}
        <View className="mb-10 px-2">
          <Text className="text-4xl font-black text-text-main tracking-tighter mb-2">Welcome.</Text>
          <Text className="text-text-muted font-medium text-base leading-6">
            Let's get you set up. You can change any of this later in Settings.
          </Text>
        </View>

        {/* Profile */}
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Profile</Text>
          <Text className="text-base font-bold text-text-main mb-3">Your Name</Text>
          <TextInput
            className="bg-background border border-border rounded-2xl p-4 text-text-main font-bold"
            placeholder="Enter your name..."
            placeholderTextColor="var(--color-text-muted)"
            value={name}
            onChangeText={setName}
            returnKeyType="done"
          />
        </View>

        {/* Preferences */}
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Preferences</Text>

          {/* Theme */}
          <View className="mb-6">
            <Text className="text-base font-bold text-text-main mb-3">Theme</Text>
            <View className="flex-row bg-background p-1.5 rounded-2xl">
              {(['base', 'light', 'dark'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => updateSettings({ theme: t })}
                  activeOpacity={0.7}
                  className={`flex-1 py-3 rounded-xl items-center ${settings?.theme === t ? 'bg-surface border border-border' : ''}`}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-widest ${settings?.theme === t ? 'text-primary' : 'text-text-muted'}`}>
                    {t === 'base' ? 'System' : t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Weight Unit */}
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-base font-bold text-text-main">Weight Unit</Text>
              <Text className="text-xs text-text-muted">Applies to all logged weights</Text>
            </View>
            <View className="flex-row bg-background p-1 rounded-xl">
              <TouchableOpacity
                onPress={() => setWeightUnit('KG')}
                activeOpacity={0.7}
                className={`px-4 py-2 rounded-lg ${weightUnit === 'KG' ? 'bg-surface' : ''}`}
              >
                <Text className={`text-[10px] font-black ${weightUnit === 'KG' ? 'text-primary' : 'text-text-muted'}`}>KG</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setWeightUnit('LBS')}
                activeOpacity={0.7}
                className={`px-4 py-2 rounded-lg ${weightUnit === 'LBS' ? 'bg-surface' : ''}`}
              >
                <Text className={`text-[10px] font-black ${weightUnit === 'LBS' ? 'text-primary' : 'text-text-muted'}`}>LBS</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Distance Unit */}
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-base font-bold text-text-main">Distance Unit</Text>
              <Text className="text-xs text-text-muted">Applies to all logged distances</Text>
            </View>
            <View className="flex-row bg-background p-1 rounded-xl">
              <TouchableOpacity
                onPress={() => setDistanceUnit('KM')}
                activeOpacity={0.7}
                className={`px-4 py-2 rounded-lg ${distanceUnit === 'KM' ? 'bg-surface' : ''}`}
              >
                <Text className={`text-[10px] font-black ${distanceUnit === 'KM' ? 'text-primary' : 'text-text-muted'}`}>KM</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDistanceUnit('MILES')}
                activeOpacity={0.7}
                className={`px-4 py-2 rounded-lg ${distanceUnit === 'MILES' ? 'bg-surface' : ''}`}
              >
                <Text className={`text-[10px] font-black ${distanceUnit === 'MILES' ? 'text-primary' : 'text-text-muted'}`}>MI</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Calendar Sync */}
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-base font-bold text-text-main">Calendar Sync</Text>
              <Text className="text-xs text-text-muted">Log sessions to system calendar</Text>
            </View>
            <Switch
              value={calendarSyncEnabled}
              onValueChange={handleCalendarToggle}
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }}
            />
          </View>
        </View>

        {/* Rest Timer */}
        <View className="bg-surface rounded-[32px] p-6 mb-8 shadow-sm border border-border">
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Rest Timer</Text>
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-base font-bold text-text-main">Enable Timer</Text>
              <Text className="text-xs text-text-muted">Show rest countdown after each set</Text>
            </View>
            <Switch
              value={restTimerEnabled}
              onValueChange={setRestTimerEnabled}
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }}
            />
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={handleGetStarted}
          activeOpacity={0.85}
          className="bg-text-main rounded-[28px] py-5 items-center mb-16"
        >
          <Text className="text-background font-black text-sm uppercase tracking-widest">Get Started</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};
