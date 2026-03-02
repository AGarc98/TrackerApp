import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Keyboard } from 'react-native';
import { query } from '../database/db';
import { useWorkout } from '../store/WorkoutContext';

export const BiometricsLogger = () => {
  const [weight, setWeight] = useState('');
  const [lastWeight, setLastWeight] = useState<number | null>(null);
  const { activeRoutineId } = useWorkout(); // Use to trigger refresh if needed

  useEffect(() => {
    loadLastEntry();
  }, []);

  const loadLastEntry = async () => {
    try {
      const result = query('SELECT body_weight FROM User_Biometrics ORDER BY timestamp DESC LIMIT 1;');
      if (result.rows?._array.length > 0) {
        setLastWeight(result.rows?._array[0].body_weight);
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
      const timestamp = Date.now();
      query(
        'INSERT INTO User_Biometrics (id, timestamp, body_weight, last_modified) VALUES (?, ?, ?, ?);',
        [Math.random().toString(36).substring(2, 15), timestamp, parseFloat(weight), timestamp]
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
    <View className="bg-white rounded-[32px] p-8 mt-6 shadow-sm border border-slate-100 w-full">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Vault Biometrics</Text>
          <Text className="text-xl font-black text-slate-900">Quick-Log</Text>
        </View>
        {lastWeight && (
          <View className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <Text className="text-[10px] font-black text-slate-400 uppercase">Last: {lastWeight} KG</Text>
          </View>
        )}
      </View>

      <View className="flex-row space-x-3 mb-6">
        <TextInput
          className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 font-bold text-lg"
          placeholder="Weight (KG)"
          keyboardType="numeric"
          value={weight}
          onChangeText={setWeight}
        />
        <TouchableOpacity
          onPress={handleLog}
          activeOpacity={0.8}
          className="bg-blue-600 px-6 rounded-2xl justify-center shadow-lg shadow-blue-200"
        >
          <Text className="text-white font-black uppercase tracking-widest text-xs">Log</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center justify-between border-t border-slate-50 pt-6">
        <View className="flex-1 mr-4">
          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Progress Snapshot</Text>
          <Text className="text-xs text-slate-400 font-medium leading-4">Capture current physiological state.</Text>
        </View>
        <TouchableOpacity 
          onPress={() => Alert.alert('Camera Access', 'Scanning module coming soon to the field unit.')}
          className="w-12 h-12 bg-slate-100 rounded-2xl items-center justify-center border border-slate-200"
        >
          <Text className="text-xl">📸</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
