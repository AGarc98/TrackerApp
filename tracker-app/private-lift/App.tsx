import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import "./global.css";

import { initDatabase } from './src/database/db';
import { seedDatabase } from './src/database/seed';
import { ArchitectZone } from './src/screens/ArchitectZone';
import { AthleteZone } from './src/screens/AthleteZone';
import { DataZone } from './src/screens/DataZone';
import { WorkoutProvider } from './src/store/WorkoutContext';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'athlete' | 'architect'>('athlete');

  useEffect(() => {
    const setup = async () => {
      try {
        await initDatabase();
        await seedDatabase();
        setIsReady(true);
      } catch (error) {
        console.error('Initialization failed:', error);
      }
    };

    setup();
  }, []);

  if (!isReady) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-slate-500 font-medium">Loading Vault...</Text>
      </View>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'data': return <DataZone />;
      case 'athlete': return <AthleteZone />;
      case 'architect': return <ArchitectZone />;
      default: return <AthleteZone />;
    }
  };

  return (
    <WorkoutProvider>
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-slate-50">
          <View className="flex-1">
            {renderContent()}
          </View>
          
          <View className="flex-row bg-white border-t border-slate-200 px-4 py-4 pb-10 shadow-2xl">
            <TouchableOpacity 
              onPress={() => setActiveTab('data')}
              className="flex-1 items-center"
              activeOpacity={0.7}
            >
              <View className={`px-4 py-2 rounded-2xl \${activeTab === 'data' ? 'bg-blue-50' : ''}`}>
                <Text className={`font-bold text-[10px] uppercase tracking-widest \${activeTab === 'data' ? 'text-blue-600' : 'text-slate-400'}`}>
                  Data
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setActiveTab('athlete')}
              className="flex-1 items-center"
              activeOpacity={0.7}
            >
              <View className={`px-4 py-2 rounded-2xl \${activeTab === 'athlete' ? 'bg-blue-50' : ''}`}>
                <Text className={`font-bold text-[10px] uppercase tracking-widest \${activeTab === 'athlete' ? 'text-blue-600' : 'text-slate-400'}`}>
                  Athlete
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setActiveTab('architect')}
              className="flex-1 items-center"
              activeOpacity={0.7}
            >
              <View className={`px-4 py-2 rounded-2xl \${activeTab === 'architect' ? 'bg-blue-50' : ''}`}>
                <Text className={`font-bold text-[10px] uppercase tracking-widest \${activeTab === 'architect' ? 'text-blue-600' : 'text-slate-400'}`}>
                  Architect
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          
          <StatusBar style="dark" />
        </SafeAreaView>
      </SafeAreaProvider>
    </WorkoutProvider>
  );
}
