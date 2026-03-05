import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Keyboard } from 'react-native';
import { DB } from '../database/db';
import { useWorkout } from '../store/WorkoutContext';

export const BiometricsLogger = () => {
  const [weight, setWeight] = useState('');
  const [lastWeight, setLastWeight] = useState<number | null>(null);
  const { settings } = useWorkout();

  useEffect(() => {
    loadLastEntry();
  }, []);

  const loadLastEntry = async () => {
    try {
      const result = DB.getOne<{ body_weight: number }>('SELECT body_weight FROM User_Biometrics ORDER BY measured_at DESC LIMIT 1;');
      if (result) {
        setLastWeight(result.body_weight);
      }
    } catch (e) {
      console.error('Failed to load last biometrics:', e);
    }
  };

  const handleLog = async () => {
    if (!weight || isNaN(parseFloat(weight))) {
      Alert.alert('Invalid Input', 'Please enter a valid weight.');
      return;
    }

    try {
      const now = Date.now();
      DB.run(
        'INSERT INTO User_Biometrics (id, measured_at, body_weight, last_modified) VALUES (?, ?, ?, ?);',
        [Math.random().toString(36).substring(2, 15), now, parseFloat(weight), now]
      );
      
      setLastWeight(parseFloat(weight));
      setWeight('');
      Keyboard.dismiss();
      Alert.alert('Logged', 'Biometrics vault updated.');
    } catch (e) {
      console.error('Failed to log biometrics:', e);
      Alert.alert('Error', 'Failed to save biometrics.');
    }
  };

  return (
    <View className="bg-surface rounded-[32px] p-8 mt-6 shadow-sm border border-border w-full">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-1">Vault Biometrics</Text>
          <Text className="text-xl font-black text-text-main tracking-tighter">Quick-Log</Text>
        </View>
        {lastWeight && (
          <View className="bg-background px-3 py-1.5 rounded-xl border border-border">
            <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">Last: {lastWeight} {settings?.weight_unit || 'KG'}</Text>
          </View>
        )}
      </View>

      <View className="flex-row space-x-3 mb-6">
        <TextInput
          className="flex-1 bg-background border border-border rounded-2xl p-5 text-text-main font-black text-lg shadow-sm"
          placeholder={`Weight (${settings?.weight_unit || 'KG'})`}
          placeholderTextColor="var(--color-text-muted)"
          keyboardType="numeric"
          value={weight}
          onChangeText={setWeight}
        />
        <TouchableOpacity
          onPress={handleLog}
          activeOpacity={0.8}
          className="bg-primary px-8 rounded-2xl justify-center shadow-lg shadow-primary/20"
        >
          <Text className="text-surface font-black uppercase tracking-widest text-xs">Log</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center justify-between border-t border-border pt-6">
        <View className="flex-1 mr-4">
          <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Progress Snapshot</Text>
          <Text className="text-xs text-text-muted font-medium leading-4">Capture current physiological state for analysis.</Text>
        </View>
        <TouchableOpacity 
          onPress={() => Alert.alert('Camera Access', 'Scanning module coming soon to the field unit.')}
          className="w-14 h-14 bg-background rounded-2xl items-center justify-center border border-border shadow-sm"
        >
          <Text className="text-xl">📸</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
