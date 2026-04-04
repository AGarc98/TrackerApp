import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { View, ActivityIndicator, TouchableOpacity, Text, Modal } from 'react-native';
import "./global.css";

import { initDatabase } from './src/database/db';
import { seedDatabase } from './src/database/seed';
import { ArchitectZone } from './src/screens/ArchitectZone';
import { AthleteZone } from './src/screens/AthleteZone';
import { DataZone } from './src/screens/DataZone';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { WorkoutProvider, useWorkout } from './src/store/WorkoutContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState<'data' | 'athlete' | 'architect'>('athlete');
  const [showBuildHint, setShowBuildHint] = useState(false);
  const [architectModalOpen, setArchitectModalOpen] = useState(false);
  const { settings, isLoading, activeSession } = useWorkout();

  const navBarHidden = !!activeSession || architectModalOpen;

  const renderContent = () => {
    switch (activeTab) {
      case 'data': return <DataZone />;
      case 'athlete': return <AthleteZone />;
      case 'architect': return <ArchitectZone onModalChange={setArchitectModalOpen} />;
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

  if (!settings?.onboarding_complete) {
    return (
      <SafeAreaView className={`flex-1 ${themeClass} bg-background`} edges={['top', 'left', 'right']}>
        <OnboardingScreen onComplete={() => setShowBuildHint(true)} />
        <StatusBar style={settings?.theme === 'dark' ? 'light' : 'dark'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${themeClass} bg-background`} edges={['top', 'left', 'right']}>
      <View className="flex-1">
        {renderContent()}
      </View>

      {!navBarHidden && <View className="flex-row bg-surface border-t border-border px-4 py-4 pb-10 shadow-2xl">
          <TouchableOpacity
            onPress={() => setActiveTab('data')}
            className="flex-1 items-center"
            activeOpacity={0.7}
          >
            <View className={`px-4 py-2 rounded-2xl ${activeTab === 'data' ? 'bg-primary-soft' : ''}`}>
              <Text className={`font-bold text-[10px] uppercase tracking-widest ${activeTab === 'data' ? 'text-primary' : 'text-text-muted'}`}>
                Stats
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
                Train
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
                Build
              </Text>
            </View>
          </TouchableOpacity>
        </View>}

      {/* Post-onboarding hint */}
      <Modal visible={showBuildHint} transparent animationType="fade">
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="bg-surface rounded-t-[40px] p-8 pb-12">
            <View className="w-10 h-1 bg-border rounded-full self-center mb-8" />
            <Text className="text-2xl font-black text-text-main tracking-tight mb-3">One more thing.</Text>
            <Text className="text-text-muted font-medium leading-6 mb-8">
              Head to the{' '}
              <Text className="text-primary font-black">Build</Text>
              {' '}tab to create your first routine — workouts, exercises, and a schedule that fits your goals. Once a routine is active, the Train tab will guide you through each session automatically.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowBuildHint(false);
                setActiveTab('architect');
              }}
              activeOpacity={0.85}
              className="bg-text-main rounded-2xl py-4 items-center mb-3"
            >
              <Text className="text-background font-black text-xs uppercase tracking-widest">Take Me There</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowBuildHint(false)}
              activeOpacity={0.7}
              className="py-3 items-center"
            >
              <Text className="text-text-muted font-bold text-xs uppercase tracking-widest">I'll Explore First</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
