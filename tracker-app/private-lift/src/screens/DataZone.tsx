import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export const DataZone = () => {
  return (
    <View className="flex-1 bg-slate-50">
      <View className="px-6 pt-6 pb-8 bg-slate-50">
        <View className="flex-row items-center space-x-3">
          <View className="w-8 h-8 bg-slate-900 rounded-xl items-center justify-center rotate-6 shadow-md shadow-slate-300">
            <Text className="text-white text-base font-black italic">D</Text>
          </View>
          <Text className="text-2xl font-black text-slate-900 tracking-tighter">Analytics</Text>
        </View>
        <Text className="text-slate-400 font-medium mt-2">Extrapolated Performance Data</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        <View className="bg-white rounded-[40px] p-12 border border-dashed border-slate-200 items-center justify-center shadow-sm">
          <View className="w-20 h-20 bg-slate-50 rounded-[30px] mb-6 items-center justify-center border border-slate-100">
            <Text className="text-3xl">📊</Text>
          </View>
          <Text className="text-slate-900 font-black text-xl mb-2 text-center">Pivot Engine Offline</Text>
          <Text className="text-slate-400 font-medium text-center leading-5 px-4">
            The processing core is coming online soon. Detailed volume load and 1RM tracking will be available here.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};
