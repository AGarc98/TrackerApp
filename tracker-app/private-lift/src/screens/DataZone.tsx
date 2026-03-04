import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { MuscleGroup } from '../types/database';
import { useAnalytics } from '../hooks/useAnalytics';

const MUSCLE_GROUPS = Object.values(MuscleGroup);
const TIMEFRAMES = [4, 8, 12];
type Metric = 'VOLUME' | 'INTENSITY';

export const DataZone = () => {
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup>(MuscleGroup.CHEST);
  const [selectedWeeks, setSelectedWeeks] = useState(8);
  const [selectedMetric, setSelectedMetric] = useState<Metric>('VOLUME');
  const { data, comparison, isLoading } = useAnalytics(selectedMuscle, selectedWeeks);

  const getMetricValue = (point: any) => selectedMetric === 'VOLUME' ? point.volume : point.intensity;
  const maxVal = Math.max(...data.map(getMetricValue), 1);
  const currentChange = selectedMetric === 'VOLUME' ? comparison.volumeChange : comparison.intensityChange;

  const formatPercent = (val: number) => {
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  };

  if (isLoading && data.length === 0) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <View className="w-12 h-12 bg-surface rounded-3xl items-center justify-center border border-border">
            <Text className="text-2xl">📊</Text>
        </View>
        <Text className="mt-4 text-text-muted font-bold uppercase tracking-widest text-[10px]">Analyzing Vault...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 pt-6 pb-4 bg-background">
        <View className="flex-row items-center space-x-3">
          <View className="w-8 h-8 bg-text-main rounded-xl items-center justify-center rotate-6 shadow-md shadow-text-main/20">
            <Text className="text-surface text-base font-black italic">D</Text>
          </View>
          <Text className="text-2xl font-black text-text-main tracking-tighter">Analytics</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Muscle Group Selector */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          className="px-6 mb-6"
          contentContainerStyle={{ paddingRight: 40 }}
        >
          {MUSCLE_GROUPS.map((mg) => (
            <TouchableOpacity
              key={mg}
              onPress={() => setSelectedMuscle(mg)}
              className={`mr-3 px-6 py-3 rounded-2xl border ${
                selectedMuscle === mg 
                  ? 'bg-text-main border-text-main' 
                  : 'bg-surface border-border'
              }`}
            >
              <Text className={`font-black text-xs uppercase tracking-widest ${
                selectedMuscle === mg ? 'text-surface' : 'text-text-muted'
              }`}>
                {mg.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Controls Row */}
        <View className="px-6 mb-6 space-y-4">
            <View className="flex-row items-center justify-between">
                <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest">Timeframe</Text>
                <View className="flex-row bg-surface p-1 rounded-xl border border-border">
                    {TIMEFRAMES.map((w) => (
                        <TouchableOpacity
                            key={w}
                            onPress={() => setSelectedWeeks(w)}
                            className={`px-4 py-1.5 rounded-lg ${
                                selectedWeeks === w ? 'bg-background shadow-sm' : ''
                            }`}
                        >
                            <Text className={`font-black text-xs ${
                                selectedWeeks === w ? 'text-text-main' : 'text-text-muted'
                            }`}>{w}W</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View className="flex-row items-center justify-between">
                <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest">Metric</Text>
                <View className="flex-row bg-surface p-1 rounded-xl border border-border">
                    <TouchableOpacity
                        onPress={() => setSelectedMetric('VOLUME')}
                        className={`px-4 py-1.5 rounded-lg ${
                            selectedMetric === 'VOLUME' ? 'bg-background shadow-sm' : ''
                        }`}
                    >
                        <Text className={`font-black text-xs ${
                            selectedMetric === 'VOLUME' ? 'text-text-main' : 'text-text-muted'
                        }`}>Volume</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setSelectedMetric('INTENSITY')}
                        className={`px-4 py-1.5 rounded-lg ${
                            selectedMetric === 'INTENSITY' ? 'bg-background shadow-sm' : ''
                        }`}
                    >
                        <Text className={`font-black text-xs ${
                            selectedMetric === 'INTENSITY' ? 'text-text-main' : 'text-text-muted'
                        }`}>Intensity</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>

        {/* Chart Card */}
        <View className="mx-6 bg-surface rounded-[40px] p-8 border border-border shadow-sm">
            <View className="flex-row justify-between items-center mb-6">
                <View>
                    <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-1">
                        {selectedMetric === 'VOLUME' ? 'Weekly Volume Load' : 'Average Intensity'}
                    </Text>
                    <View className="flex-row items-center">
                        <Text className="text-2xl font-black text-text-main">
                            {selectedMetric === 'VOLUME' 
                                ? (data.reduce((acc, curr) => acc + curr.volume, 0) / (data.filter(d => d.volume > 0).length || 1)).toFixed(0)
                                : (data.reduce((acc, curr) => acc + curr.intensity, 0) / (data.filter(d => d.intensity > 0).length || 1)).toFixed(1)
                            }
                            <Text className="text-xs text-text-muted"> KG</Text>
                        </Text>
                        <View className={`ml-3 px-2 py-1 rounded-lg ${currentChange >= 0 ? 'bg-success/10' : 'bg-accent/10'}`}>
                            <Text className={`text-[10px] font-black ${currentChange >= 0 ? 'text-success' : 'text-accent'}`}>
                                {formatPercent(currentChange)}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            <View className="flex-row justify-between items-end h-40 mb-6 px-2">
                {data.map((point, index) => {
                    const val = getMetricValue(point);
                    return (
                        <View key={point.weekStart} className="flex-1 items-center">
                            <View 
                                className={`w-3 rounded-full ${
                                    val > 0 ? (selectedMetric === 'VOLUME' ? 'bg-primary' : 'bg-accent') : 'bg-border/30'
                                }`}
                                style={{ 
                                    height: `${(val / maxVal) * 100}%`,
                                    minHeight: val > 0 ? 8 : 4
                                }}
                            />
                            {(index === 0 || index === data.length - 1 || (selectedWeeks <= 8 && index % 2 === 0)) && (
                                <Text className="text-[7px] font-black text-text-muted mt-2 rotate-45 origin-left">
                                    {point.weekStart.split('-').slice(1).join('/')}
                                </Text>
                            )}
                        </View>
                    );
                })}
            </View>
        </View>

        {/* Metric Breakdown */}
        <View className="px-6 mt-8">
            <Text className="text-text-main font-black text-xl mb-4 tracking-tighter">Metric Breakdown</Text>
            
            <View className="flex-row space-x-4 mb-4">
                <View className="flex-1 bg-surface p-6 rounded-[32px] border border-border">
                    <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-2">Total Volume</Text>
                    <Text className="text-2xl font-black text-text-main">
                        {data.reduce((acc, curr) => acc + curr.volume, 0).toLocaleString()}
                    </Text>
                    <Text className={`text-[10px] font-black mt-1 ${comparison.volumeChange >= 0 ? 'text-success' : 'text-accent'}`}>
                        {formatPercent(comparison.volumeChange)}
                    </Text>
                </View>
                <View className="flex-1 bg-surface p-6 rounded-[32px] border border-border">
                    <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-2">Frequency</Text>
                    <Text className="text-2xl font-black text-text-main">
                        {data.reduce((acc, curr) => acc + curr.frequency, 0)}
                    </Text>
                    <Text className={`text-[10px] font-black mt-1 ${comparison.frequencyChange >= 0 ? 'text-success' : 'text-accent'}`}>
                        {formatPercent(comparison.frequencyChange)}
                    </Text>
                </View>
            </View>

            <View className="bg-surface p-6 rounded-[32px] border border-border">
                <View className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-1">Period Summary</Text>
                        <Text className="text-text-main font-bold text-sm leading-5">
                            You've trained {selectedMuscle.toLowerCase().replace('_', ' ')} {data.reduce((acc, curr) => acc + curr.frequency, 0)} times over the last {selectedWeeks} weeks.
                        </Text>
                    </View>
                    <View className="w-12 h-12 bg-primary-soft rounded-2xl items-center justify-center">
                        <Text className="text-xl">📈</Text>
                    </View>
                </View>
            </View>
        </View>
      </ScrollView>
    </View>
  );
};
