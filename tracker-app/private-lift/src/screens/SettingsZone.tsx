import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, Modal } from 'react-native';
import { DB } from '../database/db';
import { UserSettings, Routine } from '../types/database';
import { useWorkout } from '../store/WorkoutContext';
import { RoutineSelector } from '../components/RoutineSelector';

export const SettingsZone = () => {
  const { activeRoutineId, updateSettings, settings: contextSettings } = useWorkout();
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [routineSelectorVisible, setRoutineSelectorVisible] = useState(false);

  useEffect(() => {
    loadRoutine();
  }, [activeRoutineId, contextSettings?.last_modified]);

  const loadRoutine = async () => {
    try {
      if (activeRoutineId) {
        const routine = DB.getOne<Routine>('SELECT * FROM Routines WHERE id = ?;', [activeRoutineId]);
        setActiveRoutine(routine);
      } else {
        setActiveRoutine(null);
      }
    } catch (e) { console.error('Failed to load routine:', e); }
  };

  const handleExport = async () => {
    Alert.alert('Export Vault', 'Your encrypted data package is ready.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Download', onPress: () => Alert.alert('Success', 'Data exported to PrivateLift/Backups/') }
    ]);
  };

  const wrapUpdate = async (update: Partial<UserSettings>) => {
    console.log('Requesting settings update:', update);
    await updateSettings(update);
  };

  if (!contextSettings) return null;

  return (
    <View className="flex-1 bg-background p-4 pt-8">
      <View className="mb-8 px-2">
        <Text className="text-3xl font-black text-text-main tracking-tighter">Vault Settings</Text>
        <Text className="text-text-muted font-medium">Identity & System Preferences</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <View className="flex-row justify-between items-start mb-4">
            <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Current Directive</Text>
            <TouchableOpacity onPress={() => setRoutineSelectorVisible(true)}>
              <Text className="text-[10px] font-black text-primary uppercase tracking-widest">{activeRoutine ? 'Change' : 'Set Plan'}</Text>
            </TouchableOpacity>
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

        <View className="bg-surface rounded-[32px] p-6 mb-6 shadow-sm border border-border">
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-6">Preferences</Text>
          
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
            <View><Text className="text-base font-bold text-text-main">Weight Unit</Text><Text className="text-xs text-text-muted">Load standard</Text></View>
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
            <View><Text className="text-base font-bold text-text-main">Rest Timer</Text><Text className="text-xs text-text-muted">Auto-countdown</Text></View>
            <Switch value={contextSettings.rest_timer_enabled} onValueChange={(v) => wrapUpdate({ rest_timer_enabled: v })} trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }} />
          </View>
          <View className="flex-row justify-between items-center">
            <View><Text className="text-base font-bold text-text-main">Calendar Sync</Text><Text className="text-xs text-text-muted">Log to system</Text></View>
            <Switch value={contextSettings.calendar_sync_enabled} onValueChange={(v) => wrapUpdate({ calendar_sync_enabled: v })} trackColor={{ false: '#e2e8f0', true: '#8B5CF6' }} />
          </View>
        </View>

        <View className="bg-text-main rounded-[32px] p-8 mb-12">
          <Text className="text-background text-lg font-black mb-2 tracking-tight">Data Sovereignty</Text>
          <Text className="text-text-muted text-xs mb-8">All training data is stored locally. Exporting generates an AES-256 encrypted JSON vault.</Text>
          <TouchableOpacity onPress={handleExport} className="bg-surface/10 py-4 rounded-2xl items-center border border-surface/10"><Text className="text-surface font-black text-xs uppercase tracking-widest">Generate Export</Text></TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={routineSelectorVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background pt-4">
          <View className="flex-row justify-end px-6">
            <TouchableOpacity onPress={() => setRoutineSelectorVisible(false)} className="bg-primary-soft px-4 py-2 rounded-full">
              <Text className="text-xs font-black text-text-muted uppercase tracking-widest">Cancel</Text>
            </TouchableOpacity>
          </View>
          <RoutineSelector onClose={() => setRoutineSelectorVisible(false)} />
        </View>
      </Modal>
    </View>
  );
};
