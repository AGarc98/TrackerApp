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
import { WorkoutProvider, useWorkout } from './src/store/WorkoutContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'data' | 'athlete' | 'architect'>('athlete');
  const { settings, isLoading } = useWorkout();

  const renderContent = () => {
    switch (activeTab) {
      case 'data': return <DataZone />;
      case 'athlete': return <AthleteZone />;
      case 'architect': return <ArchitectZone />;
      default: return <AthleteZone />;
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-text-muted font-medium">Loading Vault...</Text>
      </View>
    );
  }

  const themeClass = settings?.theme === 'light' ? 'theme-light' : settings?.theme === 'dark' ? 'theme-dark' : 'theme-base';

  return (
    <SafeAreaView className={`flex-1 ${themeClass} bg-background`}>
      <View className="flex-1">
        {renderContent()}
      </View>

      <View className="flex-row bg-surface border-t border-border px-4 py-4 pb-10 shadow-2xl">
          <TouchableOpacity 
            onPress={() => setActiveTab('data')}
            className="flex-1 items-center"
            activeOpacity={0.7}
          >
            <View className={`px-4 py-2 rounded-2xl ${activeTab === 'data' ? 'bg-primary-soft' : ''}`}>
              <Text className={`font-bold text-[10px] uppercase tracking-widest ${activeTab === 'data' ? 'text-primary' : 'text-text-muted'}`}>
                Data
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('athlete')}
            className="flex-1 items-center"
            activeOpacity={0.7}
          >
            <View className={`px-4 py-2 rounded-2xl ${activeTab === 'athlete' ? 'bg-primary-soft' : ''}`}>
              <Text className={`font-bold text-[10px] uppercase tracking-widest ${activeTab === 'athlete' ? 'text-primary' : 'text-text-muted'}`}>
                Athlete
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setActiveTab('architect')}
            className="flex-1 items-center"
            activeOpacity={0.7}
          >
            <View className={`px-4 py-2 rounded-2xl ${activeTab === 'architect' ? 'bg-primary-soft' : ''}`}>
              <Text className={`font-bold text-[10px] uppercase tracking-widest ${activeTab === 'architect' ? 'text-primary' : 'text-text-muted'}`}>
                Architect
              </Text>
            </View>
          </TouchableOpacity>
        </View>

      <StatusBar style={settings?.theme === 'dark' ? 'light' : 'dark'} />
    </SafeAreaView>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

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
        <Text className="mt-4 text-slate-500 font-medium">Initializing Systems...</Text>
      </View>
    );
  }

  return (
    <WorkoutProvider>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </WorkoutProvider>
  );
}
