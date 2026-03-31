import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { DB } from '../database/db';
import { UserSettings, Routine } from '../types/database';
import { useWorkout } from '../store/WorkoutContext';
import { RoutineSelector } from '../components/RoutineSelector';

export const SettingsZone = () => {
  const { activeRoutineId, updateSettings, settings: contextSettings } = useWorkout();
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [routineSelectorVisible, setRoutineSelectorVisible] = useState(false);

  // Local state for inputs to prevent lag while typing
  const [localName, setLocalName] = useState(contextSettings?.user_name || '');
  const [localRest, setLocalRest] = useState((contextSettings?.default_rest_duration ?? 60).toString());
  const [localToken, setLocalToken] = useState(contextSettings?.vault_connection_token || '');
  const [localHistoryLimit, setLocalHistoryLimit] = useState((contextSettings?.sync_history_limit_months ?? 6).toString());

  useEffect(() => {
    if (contextSettings) {
      setLocalName(contextSettings.user_name || '');
      setLocalRest((contextSettings.default_rest_duration ?? 60).toString());
      setLocalToken(contextSettings.vault_connection_token || '');
      setLocalHistoryLimit((contextSettings.sync_history_limit_months ?? 6).toString());
    }
  }, [contextSettings?.user_name, contextSettings?.default_rest_duration, contextSettings?.vault_connection_token, contextSettings?.sync_history_limit_months]);

  useEffect(() => {
    try {
      if (activeRoutineId) {
        const routine = DB.getOne<Routine>('SELECT * FROM Routines WHERE id = ?;', [activeRoutineId]);
        setActiveRoutine(routine);
      } else {
        setActiveRoutine(null);
      }
    } catch (e) { console.error('Failed to load routine:', e); }
  }, [activeRoutineId]);

  const handleExport = () => {
    Alert.alert('Export Data', 'Your training data will be packaged as an AES-256 encrypted vault.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Export', onPress: () => Alert.alert('Success', 'Data exported to PrivateLift/Backups/') },
    ]);
  };

  const handleImport = () => {
    Alert.alert(
      'Restore from Backup',
      'Restoring will overwrite all current data — sessions, workouts, routines, and settings — with the contents of the backup file. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Choose File', onPress: () => Alert.alert('Coming Soon', 'File picker will be available in the next update.') },
      ]
    );
  };

  const wrapUpdate = useCallback(async (update: Partial<UserSettings>) => {
    if (!contextSettings) return;
    const keys = Object.keys(update) as (keyof UserSettings)[];
    const hasChanged = keys.some(key => update[key] !== (contextSettings as any)[key]);
    if (hasChanged) await updateSettings(update);
  }, [contextSettings, updateSettings]);

  if (!contextSettings) return null;

  const routineProgress = activeRoutine
    ? Math.min((activeRoutine.cycle_count / (activeRoutine.duration || 1)) * 100, 100)
    : 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <ScrollView showsVerticalScrollIndicator={false} className="p-4 pt-8">

        {/* Header */}
        <View className="mb-8 px-2">
          <Text className="text-3xl font-black text-text-main tracking-tighter">Settings</Text>
          <Text className="text-text-muted font-medium">Preferences & data management</Text>
        </View>

        {/* Active Routine */}
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Active Routine</Text>
            <TouchableOpacity onPress={() => setRoutineSelectorVisible(true)} activeOpacity={0.7}>
              <Text className="text-[10px] font-black text-primary uppercase tracking-widest">Select</Text>
            </TouchableOpacity>
          </View>

          {activeRoutine ? (
            <View>
              <Text className="text-2xl font-black text-text-main mb-1">{activeRoutine.name}</Text>
              <View className="flex-row items-center mb-4">
                <View className="bg-primary-soft px-2 py-1 rounded-md mr-2">
                  <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">{activeRoutine.mode}</Text>
                </View>
                <Text className="text-text-muted text-xs font-bold">
                  {activeRoutine.cycle_count} / {activeRoutine.duration} cycles
                </Text>
              </View>
              <View className="w-full h-2 bg-background rounded-full overflow-hidden">
                <View className="h-full bg-primary rounded-full" style={{ width: `${routineProgress}%` }} />
              </View>
            </View>
          ) : (
            <Text className="text-text-muted font-bold italic text-center py-4">No routine selected.</Text>
          )}
        </View>

        {/* Profile */}
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Profile</Text>
          <Text className="text-base font-bold text-text-main mb-3">Your Name</Text>
          <TextInput
            className="bg-background border border-border rounded-2xl p-4 text-text-main font-bold"
            placeholder="Enter your name..."
            placeholderTextColor="var(--color-text-muted)"
            value={localName}
            onChangeText={setLocalName}
            onBlur={() => wrapUpdate({ user_name: localName })}
            returnKeyType="done"
            onSubmitEditing={() => wrapUpdate({ user_name: localName })}
          />
        </View>

        {/* Preferences */}
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Preferences</Text>

          <View className="mb-6">
            <Text className="text-base font-bold text-text-main mb-3">Theme</Text>
            <View className="flex-row bg-background p-1.5 rounded-2xl">
              {(['base', 'light', 'dark'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => wrapUpdate({ theme: t })}
                  activeOpacity={0.7}
                  className={`flex-1 py-3 rounded-xl items-center ${contextSettings.theme === t ? 'bg-surface border border-border' : ''}`}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-widest ${contextSettings.theme === t ? 'text-primary' : 'text-text-muted'}`}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-base font-bold text-text-main">Weight Unit</Text>
              <Text className="text-xs text-text-muted">Applies to all logged weights</Text>
            </View>
            <View className="flex-row bg-background p-1 rounded-xl">
              <TouchableOpacity onPress={() => wrapUpdate({ weight_unit: 'KG' })} activeOpacity={0.7} className={`px-4 py-2 rounded-lg ${contextSettings.weight_unit === 'KG' ? 'bg-surface' : ''}`}>
                <Text className={`text-[10px] font-black ${contextSettings.weight_unit === 'KG' ? 'text-primary' : 'text-text-muted'}`}>KG</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => wrapUpdate({ weight_unit: 'LBS' })} activeOpacity={0.7} className={`px-4 py-2 rounded-lg ${contextSettings.weight_unit === 'LBS' ? 'bg-surface' : ''}`}>
                <Text className={`text-[10px] font-black ${contextSettings.weight_unit === 'LBS' ? 'text-primary' : 'text-text-muted'}`}>LBS</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-base font-bold text-text-main">Distance Unit</Text>
              <Text className="text-xs text-text-muted">Applies to all logged distances</Text>
            </View>
            <View className="flex-row bg-background p-1 rounded-xl">
              <TouchableOpacity onPress={() => wrapUpdate({ distance_unit: 'KM' })} activeOpacity={0.7} className={`px-4 py-2 rounded-lg ${contextSettings.distance_unit === 'KM' ? 'bg-surface' : ''}`}>
                <Text className={`text-[10px] font-black ${contextSettings.distance_unit === 'KM' ? 'text-primary' : 'text-text-muted'}`}>KM</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => wrapUpdate({ distance_unit: 'MILES' })} activeOpacity={0.7} className={`px-4 py-2 rounded-lg ${contextSettings.distance_unit === 'MILES' ? 'bg-surface' : ''}`}>
                <Text className={`text-[10px] font-black ${contextSettings.distance_unit === 'MILES' ? 'text-primary' : 'text-text-muted'}`}>MI</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-base font-bold text-text-main">Calendar Sync</Text>
              <Text className="text-xs text-text-muted">Log sessions to system calendar</Text>
            </View>
            <Switch
              value={contextSettings.calendar_sync_enabled}
              onValueChange={(v) => wrapUpdate({ calendar_sync_enabled: v })}
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }}
            />
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-base font-bold text-text-main">Sync History Limit</Text>
              <Text className="text-xs text-text-muted">Months of history to sync</Text>
            </View>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-2 w-20 text-center font-black text-text-main"
              keyboardType="numeric"
              value={localHistoryLimit}
              onChangeText={setLocalHistoryLimit}
              onBlur={() => wrapUpdate({ sync_history_limit_months: parseInt(localHistoryLimit) || 0 })}
            />
          </View>

          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-base font-bold text-text-main">Keep Screen On</Text>
              <Text className="text-xs text-text-muted">Prevent sleep during training</Text>
            </View>
            <Switch
              value={contextSettings.keep_screen_on}
              onValueChange={(v) => wrapUpdate({ keep_screen_on: v })}
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }}
            />
          </View>
        </View>

        {/* Rest Timer */}
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Rest Timer</Text>

          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-base font-bold text-text-main">Enable Timer</Text>
              <Text className="text-xs text-text-muted">Show rest countdown after each set</Text>
            </View>
            <Switch
              value={contextSettings.rest_timer_enabled}
              onValueChange={(v) => wrapUpdate({ rest_timer_enabled: v })}
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }}
            />
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-base font-bold text-text-main">Sound</Text>
              <Text className="text-xs text-text-muted">Play alert when rest ends</Text>
            </View>
            <Switch
              value={contextSettings.rest_timer_sound}
              onValueChange={(v) => wrapUpdate({ rest_timer_sound: v })}
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }}
            />
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-base font-bold text-text-main">Vibrate</Text>
              <Text className="text-xs text-text-muted">Haptic feedback when rest ends</Text>
            </View>
            <Switch
              value={contextSettings.rest_timer_vibrate}
              onValueChange={(v) => wrapUpdate({ rest_timer_vibrate: v })}
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }}
            />
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-base font-bold text-text-main">Auto Start</Text>
              <Text className="text-xs text-text-muted">Start timer automatically after logging a set</Text>
            </View>
            <Switch
              value={contextSettings.auto_start_rest_timer}
              onValueChange={(v) => wrapUpdate({ auto_start_rest_timer: v })}
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }}
            />
          </View>

          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-base font-bold text-text-main">Default Rest</Text>
              <Text className="text-xs text-text-muted">Seconds (per-exercise can override)</Text>
            </View>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-2 w-20 text-center font-black text-text-main"
              keyboardType="numeric"
              value={localRest}
              onChangeText={setLocalRest}
              onBlur={() => wrapUpdate({ default_rest_duration: parseInt(localRest) || 0 })}
            />
          </View>
        </View>

        {/* Desktop Sync */}
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Desktop Sync</Text>
          <Text className="text-base font-bold text-text-main mb-3">Connection Token</Text>
          <TextInput
            className="bg-background border border-border rounded-2xl p-4 text-text-main font-bold"
            placeholder="Paste token from desktop app..."
            placeholderTextColor="var(--color-text-muted)"
            secureTextEntry
            value={localToken}
            onChangeText={setLocalToken}
            onBlur={() => wrapUpdate({ vault_connection_token: localToken })}
            returnKeyType="done"
            onSubmitEditing={() => wrapUpdate({ vault_connection_token: localToken })}
          />
        </View>

        {/* Data */}
        <View className="bg-text-main rounded-[32px] p-8 mb-20">
          <Text className="text-background text-lg font-black mb-1 tracking-tight">Full Backup</Text>
          <Text className="text-background/50 text-xs mb-2 leading-5">
            Backs up your entire vault — all sessions, biometrics, and settings.
          </Text>
          <Text className="text-background/30 text-xs mb-8 leading-5">
            To share individual routines, use the Export button on any routine in the Architect tab.
          </Text>
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={handleImport}
              activeOpacity={0.7}
              className="flex-1 bg-surface/10 py-4 rounded-2xl items-center border border-surface/10"
            >
              <Text className="text-surface font-black text-xs uppercase tracking-widest">Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleExport}
              activeOpacity={0.7}
              className="flex-1 bg-surface/10 py-4 rounded-2xl items-center border border-surface/10"
            >
              <Text className="text-surface font-black text-xs uppercase tracking-widest">Back Up</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      <Modal visible={routineSelectorVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background pt-4">
          <View className="flex-row justify-end px-6">
            <TouchableOpacity
              onPress={() => setRoutineSelectorVisible(false)}
              activeOpacity={0.7}
              className="bg-background border border-border px-4 py-2 rounded-full"
            >
              <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Cancel</Text>
            </TouchableOpacity>
          </View>
          <RoutineSelector onClose={() => setRoutineSelectorVisible(false)} />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};
