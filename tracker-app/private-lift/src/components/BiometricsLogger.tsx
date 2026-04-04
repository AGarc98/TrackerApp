import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Keyboard, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { DB } from '../database/db';
import { useWorkout } from '../store/WorkoutContext';

export const BiometricsLogger = () => {
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [lastEntry, setLastEntry] = useState<{ weight: number, fat?: number } | null>(null);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const { settings } = useWorkout();

  useEffect(() => {
    loadLastEntry();
  }, []);

  const loadLastEntry = async () => {
    try {
      const result = DB.getOne<{ body_weight: number, body_fat_pct: number }>('SELECT body_weight, body_fat_pct FROM User_Biometrics ORDER BY measured_at DESC LIMIT 1;');
      if (result) {
        setLastEntry({ weight: result.body_weight, fat: result.body_fat_pct });
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
      const weightVal = parseFloat(weight);
      const fatVal = bodyFat ? parseFloat(bodyFat) : null;

      DB.run(
        'INSERT INTO User_Biometrics (id, measured_at, body_weight, body_fat_pct, notes, photo_path, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [Math.random().toString(36).substring(2, 15), now, weightVal, fatVal, notes.trim() || null, selectedPhotoUri, now]
      );

      setLastEntry({ weight: weightVal, fat: fatVal || undefined });
      setWeight('');
      setBodyFat('');
      setSelectedPhotoUri(null);
      setNotes('');
      Keyboard.dismiss();
      Alert.alert('Saved', 'Body measurements updated.');
    } catch (e) {
      console.error('Failed to log biometrics:', e);
      Alert.alert('Error', 'Failed to save biometrics.');
    }
  };

  const handlePhotoPress = () => {
    Alert.alert('Progress Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: pickFromCamera },
      { text: 'Choose from Library', onPress: pickFromLibrary },
      ...(selectedPhotoUri ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: () => setSelectedPhotoUri(null) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (!result.canceled) setSelectedPhotoUri(result.assets[0].uri);
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });
    if (!result.canceled) setSelectedPhotoUri(result.assets[0].uri);
  };

  return (
    <View className="bg-surface rounded-[32px] p-8 mt-6 shadow-sm border border-border w-full">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-xs font-black text-text-muted uppercase tracking-widest mb-1">Body Measurements</Text>
          <Text className="text-xl font-black text-text-main tracking-tighter">Quick Log</Text>
        </View>
        {lastEntry && (
          <View className="items-end">
            <View className="bg-background px-3 py-1.5 rounded-xl border border-border mb-1">
              <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">Weight: {lastEntry.weight} {settings?.weight_unit || 'KG'}</Text>
            </View>
            {lastEntry.fat && (
              <View className="bg-background px-3 py-1.5 rounded-xl border border-border">
                <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest">Fat: {lastEntry.fat}%</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View className="space-y-4 mb-6">
        <View className="flex-row space-x-3">
          <TextInput
            className="flex-1 bg-background border border-border rounded-2xl p-5 text-text-main font-black text-lg shadow-sm"
            placeholder={`Weight (${settings?.weight_unit || 'KG'})`}
            placeholderTextColor="var(--color-text-muted)"
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
          />
          <TextInput
            className="flex-1 bg-background border border-border rounded-2xl p-5 text-text-main font-black text-lg shadow-sm"
            placeholder="Body Fat %"
            placeholderTextColor="var(--color-text-muted)"
            keyboardType="numeric"
            value={bodyFat}
            onChangeText={setBodyFat}
          />
        </View>
        <TextInput
          className="bg-background border border-border rounded-2xl p-5 text-text-main font-medium text-base shadow-sm"
          placeholder="Notes (optional)"
          placeholderTextColor="var(--color-text-muted)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
        />
        <TouchableOpacity
          onPress={handleLog}
          activeOpacity={0.8}
          className="bg-primary py-5 rounded-2xl items-center shadow-lg shadow-primary/20"
        >
          <Text className="text-surface font-black uppercase tracking-widest text-xs">Log Weight</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center justify-between border-t border-border pt-6">
        <View className="flex-1 mr-4">
          <Text className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Progress Photo</Text>
          <Text className="text-xs text-text-muted font-medium leading-4">
            {selectedPhotoUri ? 'Photo attached. Tap to change or remove.' : 'Take a photo to track your progress over time.'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handlePhotoPress}
          activeOpacity={0.8}
          className="w-14 h-14 bg-background rounded-2xl items-center justify-center border border-border shadow-sm overflow-hidden"
        >
          {selectedPhotoUri ? (
            <Image source={{ uri: selectedPhotoUri }} className="w-14 h-14" resizeMode="cover" />
          ) : (
            <Text className="text-xl">📸</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};
