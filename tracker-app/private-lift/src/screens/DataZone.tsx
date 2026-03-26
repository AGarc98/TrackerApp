import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MuscleGroup } from '../types/database';
import { useAnalytics } from '../hooks/useAnalytics';

const MUSCLE_GROUPS = Object.values(MuscleGroup);
const TIMEFRAMES = [4, 8, 12, 24];
type Metric = 'VOLUME' | 'INTENSITY' | 'DISTANCE' | 'TIME';

const ENDURANCE_MUSCLES = [MuscleGroup.CARDIO, MuscleGroup.FULL_BODY];

export const DataZone = () => {
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup>(MuscleGroup.CHEST);
  const [selectedWeeks, setSelectedWeeks] = useState(8);
  const [selectedMetric, setSelectedMetric] = useState<Metric>('VOLUME');
  const { data, comparison, isLoading } = useAnalytics(selectedMuscle, selectedWeeks);

  const isEnduranceFocus = useMemo(() => ENDURANCE_MUSCLES.includes(selectedMuscle), [selectedMuscle]);

  const handleMuscleSelect = useCallback((mg: MuscleGroup) => {
    setSelectedMuscle(mg);
    const isEndurance = ENDURANCE_MUSCLES.includes(mg);
    if (isEndurance && (selectedMetric === 'VOLUME' || selectedMetric === 'INTENSITY')) {
      setSelectedMetric('DISTANCE');
    } else if (!isEndurance && (selectedMetric === 'DISTANCE' || selectedMetric === 'TIME')) {
      setSelectedMetric('VOLUME');
    }
  }, [selectedMetric]);

  const getMetricValue = useCallback((point: any) => {
    switch (selectedMetric) {
      case 'VOLUME': return point.volume;
      case 'INTENSITY': return point.intensity;
      case 'DISTANCE': return point.distance;
      case 'TIME': return point.time_ms / (1000 * 60); // In minutes
      default: return 0;
    }
  }, [selectedMetric]);

  const maxVal = useMemo(() => Math.max(...data.map(getMetricValue), 1), [data, getMetricValue]);
  
  const currentChange = useMemo(() => {
    switch (selectedMetric) {
      case 'VOLUME': return comparison.volumeChange;
      case 'INTENSITY': return comparison.intensityChange;
      case 'DISTANCE': return comparison.distanceChange;
      case 'TIME': return comparison.timeChange;
      default: return 0;
    }
  }, [selectedMetric, comparison]);

  const formatPercent = useCallback((val: number) => {
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  }, []);

  const getUnit = useCallback(() => {
    switch (selectedMetric) {
      case 'VOLUME': return ' KG';
      case 'INTENSITY': return ' KG';
      case 'DISTANCE': return ' KM';
      case 'TIME': return ' MIN';
      default: return '';
    }
  }, [selectedMetric]);

  const averageValue = useMemo(() => {
    const validData = data.filter(d => getMetricValue(d) > 0);
    return (data.reduce((acc, curr) => acc + getMetricValue(curr), 0) / (validData.length || 1)).toFixed(1);
  }, [data, getMetricValue]);

  const totalPeriodValue = useMemo(() => {
    return data.reduce((acc, curr) => acc + (isEnduranceFocus ? curr.distance : curr.volume), 0);
  }, [data, isEnduranceFocus]);

  const totalFrequency = useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.frequency, 0);
  }, [data]);

  if (isLoading && data.length === 0) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-text-muted font-bold uppercase tracking-widest text-[10px]">Analyzing Vault...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 pt-2 pb-4 bg-background">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center space-x-3">
            <View className="w-8 h-8 bg-text-main rounded-xl items-center justify-center rotate-6 shadow-md shadow-text-main/20">
              <Text className="text-surface text-base font-black italic">D</Text>
            </View>
            <Text className="text-2xl font-black text-text-main tracking-tighter">Analytics</Text>
          </View>
          {isLoading && <ActivityIndicator size="small" color="#8B5CF6" />}
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 40 }}
        style={{ opacity: isLoading ? 0.6 : 1 }}
      >
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
              onPress={() => handleMuscleSelect(mg)}
              disabled={isLoading}
              className={`mr-3 px-6 py-3 rounded-2xl border ${
                selectedMuscle === mg 
                  ? 'bg-text-main border-text-main' 
                  : 'bg-surface border-border'
              }`}
            >
              <Text className={`font-black text-xs uppercase tracking-widest ${
                selectedMuscle === mg ? 'text-surface' : 'text-text-muted'
              }`}>
                {mg.replace(/_/g, ' ')}
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
                            disabled={isLoading}
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
                    {!isEnduranceFocus ? (
                      <>
                        <TouchableOpacity
                            onPress={() => setSelectedMetric('VOLUME')}
                            disabled={isLoading}
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
                            disabled={isLoading}
                            className={`px-4 py-1.5 rounded-lg ${
                                selectedMetric === 'INTENSITY' ? 'bg-background shadow-sm' : ''
                            }`}
                        >
                            <Text className={`font-black text-xs ${
                                selectedMetric === 'INTENSITY' ? 'text-text-main' : 'text-text-muted'
                            }`}>Intensity</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                            onPress={() => setSelectedMetric('DISTANCE')}
                            disabled={isLoading}
                            className={`px-4 py-1.5 rounded-lg ${
                                selectedMetric === 'DISTANCE' ? 'bg-background shadow-sm' : ''
                            }`}
                        >
                            <Text className={`font-black text-xs ${
                                selectedMetric === 'DISTANCE' ? 'text-text-main' : 'text-text-muted'
                            }`}>Distance</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setSelectedMetric('TIME')}
                            disabled={isLoading}
                            className={`px-4 py-1.5 rounded-lg ${
                                selectedMetric === 'TIME' ? 'bg-background shadow-sm' : ''
                            }`}
                        >
                            <Text className={`font-black text-xs ${
                                selectedMetric === 'TIME' ? 'text-text-main' : 'text-text-muted'
                            }`}>Time</Text>
                        </TouchableOpacity>
                      </>
                    )}
                </View>
            </View>
        </View>

        {/* Chart Card */}
        <View className="mx-6 bg-surface rounded-[40px] p-8 border border-border shadow-sm">
            <View className="flex-row justify-between items-center mb-6">
                <View>
                    <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-1">
                        Weekly {selectedMetric.toLowerCase()}
                    </Text>
                    <View className="flex-row items-center">
                        <Text className="text-2xl font-black text-text-main">
                            {averageValue}
                            <Text className="text-xs text-text-muted">{getUnit()}</Text>
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
                                    val > 0 ? (selectedMetric === 'VOLUME' || selectedMetric === 'DISTANCE' ? 'bg-primary' : 'bg-accent') : 'bg-border/30'
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
                    <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-2">
                      Total {isEnduranceFocus ? 'Distance' : 'Volume'}
                    </Text>
                    <Text className="text-2xl font-black text-text-main">
                        {totalPeriodValue.toLocaleString()}
                        <Text className="text-xs text-text-muted">{isEnduranceFocus ? ' KM' : ' KG'}</Text>
                    </Text>
                    <Text className={`text-[10px] font-black mt-1 ${isEnduranceFocus ? (comparison.distanceChange >= 0 ? 'text-success' : 'text-accent') : (comparison.volumeChange >= 0 ? 'text-success' : 'text-accent')}`}>
                        {formatPercent(isEnduranceFocus ? comparison.distanceChange : comparison.volumeChange)}
                    </Text>
                </View>
                <View className="flex-1 bg-surface p-6 rounded-[32px] border border-border">
                    <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-2">Frequency</Text>
                    <Text className="text-2xl font-black text-text-main">
                        {totalFrequency}
                    </Text>
                    <Text className={`text-[10px] font-black mt-1 ${comparison.frequencyChange >= 0 ? 'text-success' : 'text-accent'}`}>
                        {formatPercent(comparison.frequencyChange)}
                    </Text>
                </View>
            </View>

            <View className="bg-surface p-6 rounded-[32px] border border-border">
                <View className="flex-row justify-between items-center">
                    <View className="flex-1">
                        <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-1">Period Summary</Text>
                        <Text className="text-text-main font-bold text-sm leading-5">
                            You've trained {selectedMuscle.toLowerCase().replace(/_/g, ' ')} {totalFrequency} times over the last {selectedWeeks} weeks.
                        </Text>
                    </View>
                    <View className="w-12 h-12 bg-primary-soft rounded-2xl items-center justify-center ml-4">
                        <Text className="text-xl">📈</Text>
                    </View>
                </View>
            </View>
        </View>
      </ScrollView>
    </View>
  );
};
