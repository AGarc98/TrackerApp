import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export const DataZone = () => {
  return (
    <View className="flex-1 bg-background">
      <View className="px-6 pt-6 pb-8 bg-background">
        <View className="flex-row items-center space-x-3">
          <View className="w-8 h-8 bg-text-main rounded-xl items-center justify-center rotate-6 shadow-md shadow-text-main/20">
            <Text className="text-surface text-base font-black italic">D</Text>
          </View>
          <Text className="text-2xl font-black text-text-main tracking-tighter">Analytics</Text>
        </View>
        <Text className="text-text-muted font-medium mt-2">Extrapolated Performance Data</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        <View className="bg-surface rounded-[40px] p-12 border border-dashed border-border items-center justify-center shadow-sm">
          <View className="w-20 h-20 bg-background rounded-[30px] mb-6 items-center justify-center border border-border">
            <Text className="text-3xl">📊</Text>
          </View>
          <Text className="text-text-main font-black text-xl mb-2 text-center">Pivot Engine Offline</Text>
          <Text className="text-text-muted font-medium text-center leading-5 px-4">
            The processing core is coming online soon. Detailed volume load and 1RM tracking will be available here.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};
