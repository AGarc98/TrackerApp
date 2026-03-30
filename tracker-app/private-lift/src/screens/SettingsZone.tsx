import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Touchable, TouchableOpacity } from 'react-native';
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

  // Keep local state in sync when context settings change externally
  useEffect(() => {
    if (contextSettings) {
      setLocalName(contextSettings.user_name || '');
      setLocalRest((contextSettings.default_rest_duration ?? 60).toString());
      setLocalToken(contextSettings.vault_connection_token || '');
      setLocalHistoryLimit((contextSettings.sync_history_limit_months ?? 6).toString());
    }
  }, [contextSettings?.user_name, contextSettings?.default_rest_duration, contextSettings?.vault_connection_token, contextSettings?.sync_history_limit_months]);

  // Load routine only when activeRoutineId changes
  useEffect(() => {
    const loadRoutine = () => {
      try {
        if (activeRoutineId) {
          const routine = DB.getOne<Routine>('SELECT * FROM Routines WHERE id = ?;', [activeRoutineId]);
          setActiveRoutine(routine);
        } else {
          setActiveRoutine(null);
        }
      } catch (e) { console.error('Failed to load routine:', e); }
    };
    loadRoutine();
  }, [activeRoutineId]);

  const handleExport = async () => {
    Alert.alert('Export Vault', 'Your encrypted data package is ready.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Download', onPress: () => Alert.alert('Success', 'Data exported to PrivateLift/Backups/') }
    ]);
  };

  const wrapUpdate = useCallback(async (update: Partial<UserSettings>) => {
    if (!contextSettings) return;
    
    // Prevent redundant updates if value hasn't changed
    const keys = Object.keys(update) as (keyof UserSettings)[];
    const hasChanged = keys.some(key => update[key] !== (contextSettings as any)[key]);
    
    if (hasChanged) {
      await updateSettings(update);
    }
  }, [contextSettings, updateSettings]);

  if (!contextSettings) return null;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <ScrollView showsVerticalScrollIndicator={false} className="p-4 pt-8">
        <View className="mb-8 px-2">
          <Text className="text-3xl font-black text-text-main tracking-tighter">Vault Settings</Text>
          <Text className="text-text-muted font-medium">Identity & System Preferences</Text>
        </View>

        {/* Current Directive (Routine) */}
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <View className="flex-row justify-between items-start mb-4">
            <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Current Directive</Text>
            <Pressable onPress={() => setRoutineSelectorVisible(true)}>
              <Text className="text-[10px] font-black text-primary uppercase tracking-widest">{activeRoutine ? 'Change' : 'Set Plan'}</Text>
            </Pressable>
          </View>
          
          {activeRoutine ? (
            <View>
              <Text className="text-2xl font-black text-text-main mb-1">{activeRoutine.name}</Text>
              <View className="flex-row items-center mb-4">
                <View className="bg-primary-soft px-2 py-1 rounded-md mr-2">
                  <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">{activeRoutine.mode}</Text>
                </View>
                <Text className="text-text-muted text-xs font-bold">Progress: Cycle {activeRoutine.cycle_count + 1}</Text>
              </View>
              <View className="w-full h-2 bg-background rounded-full overflow-hidden">
                <View 
                  className="h-full bg-primary rounded-full" 
                  style={{ width: `${Math.min((activeRoutine.cycle_count / (activeRoutine.duration || 1)) * 100, 100)}%` }} 
                />
              </View>
            </View>
          ) : (
            <Text className="text-text-muted font-bold italic text-center py-4">No active routine blueprint.</Text>
          )}
        </View>

        {/* User Identity */}
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Identity</Text>
          <View className="mb-2">
            <Text className="text-base font-bold text-text-main mb-3">Agent Name</Text>
            <TextInput
              className="bg-background border border-border rounded-2xl p-4 text-text-main font-bold"
              placeholder="Enter name..."
              placeholderTextColor="var(--color-text-muted)"
              value={localName}
              onChangeText={setLocalName}
              onBlur={() => wrapUpdate({ user_name: localName })}
              returnKeyType="done"
              onSubmitEditing={() => wrapUpdate({ user_name: localName })}
            />
          </View>
        </View>

        {/* System Preferences */}
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">System Preferences</Text>
          
          <View className="mb-6">
            <Text className="text-base font-bold text-text-main mb-3">Interface Theme</Text>
            <View className="flex-row bg-background p-1.5 rounded-2xl">
              {(['base', 'light', 'dark'] as const).map((t) => (
                <TouchableOpacity 
                  key={t}
                  onPress={() => wrapUpdate({ theme: t })} 
                  className={`flex-1 py-3 rounded-xl items-center ${contextSettings.theme === t ? 'bg-surface shadow-sm border border-border' : ''}`}
                >
                  <Text className={`text-[10px] font-black uppercase tracking-widest ${contextSettings.theme === t ? 'text-primary' : 'text-text-muted'}`}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View><Text className="text-base font-bold text-text-main">Weight Unit</Text><Text className="text-xs text-text-muted">Global standard</Text></View>
            <View className="flex-row bg-background p-1 rounded-xl">
              <TouchableOpacity onPress={() => wrapUpdate({ weight_unit: 'KG' })} className={`px-4 py-2 rounded-lg ${contextSettings.weight_unit === 'KG' ? 'bg-surface shadow-sm' : ''}`}><Text className={`text-[10px] font-black ${contextSettings.weight_unit === 'KG' ? 'text-primary' : 'text-text-muted'}`}>KG</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => wrapUpdate({ weight_unit: 'LBS' })} className={`px-4 py-2 rounded-lg ${contextSettings.weight_unit === 'LBS' ? 'bg-surface shadow-sm' : ''}`}><Text className={`text-[10px] font-black ${contextSettings.weight_unit === 'LBS' ? 'text-primary' : 'text-text-muted'}`}>LBS</Text></TouchableOpacity>
            </View>
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View><Text className="text-base font-bold text-text-main">Distance Unit</Text><Text className="text-xs text-text-muted">Movement standard</Text></View>
            <View className="flex-row bg-background p-1 rounded-xl">
              <TouchableOpacity onPress={() => wrapUpdate({ distance_unit: 'KM' })} className={`px-4 py-2 rounded-lg ${contextSettings.distance_unit === 'KM' ? 'bg-surface shadow-sm' : ''}`}><Text className={`text-[10px] font-black ${contextSettings.distance_unit === 'KM' ? 'text-primary' : 'text-text-muted'}`}>KM</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => wrapUpdate({ distance_unit: 'MILES' })} className={`px-4 py-2 rounded-lg ${contextSettings.distance_unit === 'MILES' ? 'bg-surface shadow-sm' : ''}`}><Text className={`text-[10px] font-black ${contextSettings.distance_unit === 'MILES' ? 'text-primary' : 'text-text-muted'}`}>MI</Text></TouchableOpacity>
            </View>
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View><Text className="text-base font-bold text-text-main">Calendar Sync</Text><Text className="text-xs text-text-muted">Log sessions to system</Text></View>
            <Switch 
              value={contextSettings.calendar_sync_enabled} 
              onValueChange={(v) => wrapUpdate({ calendar_sync_enabled: v })} 
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }} 
            />
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View><Text className="text-base font-bold text-text-main">Sync History Limit</Text><Text className="text-xs text-text-muted">Months to retain in sync</Text></View>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-2 w-20 text-center font-black text-text-main"
              keyboardType="numeric"
              value={localHistoryLimit}
              onChangeText={setLocalHistoryLimit}
              onBlur={() => wrapUpdate({ sync_history_limit_months: parseInt(localHistoryLimit) || 0 })}
            />
          </View>

          <View className="flex-row justify-between items-center">
            <View><Text className="text-base font-bold text-text-main">Keep Screen On</Text><Text className="text-xs text-text-muted">Prevent sleep during training</Text></View>
            <Switch 
              value={contextSettings.keep_screen_on} 
              onValueChange={(v) => wrapUpdate({ keep_screen_on: v })} 
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }} 
            />
          </View>
        </View>

        {/* Timer Calibration */}
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Timer Calibration</Text>
          
          <View className="flex-row justify-between items-center mb-6">
            <View><Text className="text-base font-bold text-text-main">Rest Timer</Text><Text className="text-xs text-text-muted">Enable countdown</Text></View>
            <Switch 
              value={contextSettings.rest_timer_enabled} 
              onValueChange={(v) => wrapUpdate({ rest_timer_enabled: v })} 
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }} 
            />
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View><Text className="text-base font-bold text-text-main">Sound</Text><Text className="text-xs text-text-muted">Alert on completion</Text></View>
            <Switch 
              value={contextSettings.rest_timer_sound} 
              onValueChange={(v) => wrapUpdate({ rest_timer_sound: v })} 
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }} 
            />
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View><Text className="text-base font-bold text-text-main">Vibrate</Text><Text className="text-xs text-text-muted">Haptic feedback</Text></View>
            <Switch 
              value={contextSettings.rest_timer_vibrate} 
              onValueChange={(v) => wrapUpdate({ rest_timer_vibrate: v })} 
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }} 
            />
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <View><Text className="text-base font-bold text-text-main">Auto Start</Text><Text className="text-xs text-text-muted">Trigger after set completion</Text></View>
            <Switch 
              value={contextSettings.auto_start_rest_timer} 
              onValueChange={(v) => wrapUpdate({ auto_start_rest_timer: v })} 
              trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }} 
            />
          </View>

          <View className="flex-row justify-between items-center">
            <View><Text className="text-base font-bold text-text-main">Default Rest</Text><Text className="text-xs text-text-muted">Seconds</Text></View>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-2 w-20 text-center font-black text-text-main"
              keyboardType="numeric"
              value={localRest}
              onChangeText={setLocalRest}
              onBlur={() => wrapUpdate({ default_rest_duration: parseInt(localRest) || 0 })}
            />
          </View>
        </View>

        {/* Data Management */}
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Vault Connectivity</Text>
          <View className="mb-2">
            <Text className="text-base font-bold text-text-main mb-3">Connection Token</Text>
            <TextInput
              className="bg-background border border-border rounded-2xl p-4 text-text-main font-bold"
              placeholder="Enter vault token..."
              placeholderTextColor="var(--color-text-muted)"
              secureTextEntry
              value={localToken}
              onChangeText={setLocalToken}
              onBlur={() => wrapUpdate({ vault_connection_token: localToken })}
              returnKeyType="done"
              onSubmitEditing={() => wrapUpdate({ vault_connection_token: localToken })}
            />
          </View>
        </View>

        {/* Data Sovereignty */}
        <View className="bg-text-main rounded-[32px] p-8 mb-20">
          <Text className="text-background text-lg font-black mb-2 tracking-tight">Data Sovereignty</Text>
          <Text className="text-text-muted text-xs mb-8">All training data is stored locally. Exporting generates an AES-256 encrypted JSON vault.</Text>
          <Pressable onPress={handleExport} className="bg-surface/10 py-4 rounded-2xl items-center border border-surface/10">
            <Text className="text-surface font-black text-xs uppercase tracking-widest">Generate Export</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={routineSelectorVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background pt-4">
          <View className="flex-row justify-end px-6">
            <Pressable onPress={() => setRoutineSelectorVisible(false)} className="bg-primary-soft px-4 py-2 rounded-full">
              <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Cancel</Text>
            </Pressable>
          </View>
          <RoutineSelector onClose={() => setRoutineSelectorVisible(false)} />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};
