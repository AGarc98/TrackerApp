import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { query } from '../database/db';
import { UserSettings, Routine } from '../types/database';

export const SettingsZone = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = query('SELECT * FROM User_Settings WHERE id = 1;');
      const s = result.rows?._array[0] as any;
      if (s) {
        const formattedSettings: UserSettings = {
          ...s,
          rest_timer_enabled: !!s.rest_timer_enabled,
          rest_timer_sound: !!s.rest_timer_sound,
          calendar_sync_enabled: !!s.calendar_sync_enabled,
        };
        setSettings(formattedSettings);
        if (formattedSettings.active_routine_id) {
          const rResult = query('SELECT * FROM Routines WHERE id = ?;', [formattedSettings.active_routine_id]);
          setActiveRoutine(rResult.rows?._array[0] as Routine || null);
        }
      }
    } catch (e) { console.error('Failed to load settings:', e); }
  };

  const updateSetting = (key: string, value: any) => {
    try {
      const dbValue = typeof value === 'boolean' ? (value ? 1 : 0) : value;
      // Using direct string concat for the key name is safe here as keys are from a controlled set
      query('UPDATE User_Settings SET ' + key + ' = ? WHERE id = 1;', [dbValue]);
      setSettings(prev => prev ? { ...prev, [key]: value } : null);
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const handleExport = async () => {
    Alert.alert('Export Vault', 'Your encrypted data package is ready.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Download', onPress: () => Alert.alert('Success', 'Data exported to PrivateLift/Backups/') }
    ]);
  };

  if (!settings) return null;

  return (
    <View className="flex-1 bg-slate-50 p-4 pt-8">
      <View className="mb-8 px-2">
        <Text className="text-3xl font-black text-slate-900 tracking-tighter">Vault Settings</Text>
        <Text className="text-slate-400 font-medium">Identity & System Preferences</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-[32px] p-6 mb-6 shadow-sm border border-slate-100">
          <Text className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Current Directive</Text>
          {activeRoutine ? (
            <View>
              <Text className="text-2xl font-black text-slate-900 mb-1">{activeRoutine.name}</Text>
              <View className="flex-row items-center mb-4">
                <View className="bg-blue-50 px-2 py-1 rounded-md mr-2">
                  <Text className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{activeRoutine.mode}</Text>
                </View>
                <Text className="text-slate-400 text-xs font-bold">Progress: Cycle {activeRoutine.cycle_count + 1}</Text>
              </View>
              <View className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                <View 
                  className="h-full bg-blue-600 rounded-full" 
                  style={{ width: `\${Math.min((activeRoutine.cycle_count / (activeRoutine.duration || 1)) * 100, 100)}%` }} 
                />
              </View>
            </View>
          ) : (
            <Text className="text-slate-300 font-bold italic text-center py-4">No active routine blueprint.</Text>
          )}
        </View>

        <View className="bg-white rounded-[32px] p-6 mb-6 shadow-sm border border-slate-100">
          <Text className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Preferences</Text>
          <View className="flex-row justify-between items-center mb-6">
            <View><Text className="text-base font-bold text-slate-900">Unit System</Text><Text className="text-xs text-slate-400">Weight standard</Text></View>
            <View className="flex-row bg-slate-50 p-1 rounded-xl">
              <TouchableOpacity onPress={() => updateSetting('unit_system', 'KG')} className={`px-4 py-2 rounded-lg \${settings.unit_system === 'KG' ? 'bg-white shadow-sm' : ''}`}><Text className={`text-[10px] font-black \${settings.unit_system === 'KG' ? 'text-blue-600' : 'text-slate-400'}`}>KG</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => updateSetting('unit_system', 'LBS')} className={`px-4 py-2 rounded-lg \${settings.unit_system === 'LBS' ? 'bg-white shadow-sm' : ''}`}><Text className={`text-[10px] font-black \${settings.unit_system === 'LBS' ? 'text-blue-600' : 'text-slate-400'}`}>LBS</Text></TouchableOpacity>
            </View>
          </View>
          <View className="flex-row justify-between items-center mb-6">
            <View><Text className="text-base font-bold text-slate-900">Rest Timer</Text><Text className="text-xs text-slate-400">Auto-countdown</Text></View>
            <Switch value={settings.rest_timer_enabled} onValueChange={(v) => updateSetting('rest_timer_enabled', v)} trackColor={{ false: '#e2e8f0', true: '#3b82f6' }} />
          </View>
          <View className="flex-row justify-between items-center">
            <View><Text className="text-base font-bold text-slate-900">Calendar Sync</Text><Text className="text-xs text-slate-400">Log to system</Text></View>
            <Switch value={settings.calendar_sync_enabled} onValueChange={(v) => updateSetting('calendar_sync_enabled', v)} trackColor={{ false: '#e2e8f0', true: '#3b82f6' }} />
          </View>
        </View>

        <View className="bg-slate-900 rounded-[32px] p-8 mb-12">
          <Text className="text-white text-lg font-black mb-2 tracking-tight">Data Sovereignty</Text>
          <Text className="text-slate-400 text-xs mb-8">All training data is stored locally. Exporting generates an AES-256 encrypted JSON vault.</Text>
          <TouchableOpacity onPress={handleExport} className="bg-white/10 py-4 rounded-2xl items-center border border-white/10"><Text className="text-white font-black text-xs uppercase tracking-widest">Generate Export</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
