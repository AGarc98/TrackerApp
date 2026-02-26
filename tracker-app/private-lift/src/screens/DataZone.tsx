import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export const DataZone = () => {
  return (
    <View className="flex-1 bg-slate-50 p-4 pt-8">
      <View className="mb-8 px-2">
        <Text className="text-3xl font-black text-slate-900 tracking-tighter">Vault Analytics</Text>
        <Text className="text-slate-400 font-medium">Extrapolated Performance Data</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="bg-white rounded-[32px] p-10 border border-dashed border-slate-200 items-center justify-center">
          <View className="w-16 h-16 bg-slate-100 rounded-2xl mb-4 items-center justify-center">
            <Text className="text-2xl text-slate-300">📊</Text>
          </View>
          <Text className="text-slate-400 font-bold text-center leading-5">
            {"The Pivot Engine is coming soon.\nDetailed volume load and 1RM tracking will be available here."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};
