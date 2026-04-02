import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Modal } from 'react-native';
import { MuscleGroup } from '../types/database';
import { useAnalytics } from '../hooks/useAnalytics';
import { useWorkout } from '../store/WorkoutContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const TIMEFRAMES = [4, 8, 12, 24];
const CHART_HEIGHT = 160;

type Metric = 'SETS' | 'E1RM' | 'LOAD' | 'DISTANCE' | 'TIME' | 'RPE';

const ENDURANCE_MUSCLES = new Set([MuscleGroup.CARDIO, MuscleGroup.FULL_BODY]);

// Muscle groups organized by anatomical category
const MUSCLE_CATEGORIES: { label: string; groups: MuscleGroup[] }[] = [
  {
    label: 'Chest',
    groups: [MuscleGroup.CHEST, MuscleGroup.UPPER_CHEST, MuscleGroup.LOWER_CHEST],
  },
  {
    label: 'Back',
    groups: [MuscleGroup.LATS, MuscleGroup.UPPER_BACK, MuscleGroup.MID_BACK, MuscleGroup.LOWER_BACK, MuscleGroup.TRAPS],
  },
  {
    label: 'Shoulders',
    groups: [MuscleGroup.SHOULDERS, MuscleGroup.FRONT_DELTOIDS, MuscleGroup.SIDE_DELTOIDS, MuscleGroup.REAR_DELTOIDS],
  },
  {
    label: 'Arms',
    groups: [MuscleGroup.BICEPS, MuscleGroup.TRICEPS, MuscleGroup.FOREARMS, MuscleGroup.BRACHIALIS],
  },
  {
    label: 'Legs',
    groups: [MuscleGroup.QUADS, MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES, MuscleGroup.GLUTEUS_MEDIUS, MuscleGroup.CALVES, MuscleGroup.ADDUCTORS, MuscleGroup.ABDUCTORS],
  },
  {
    label: 'Core',
    groups: [MuscleGroup.ABS, MuscleGroup.CORE, MuscleGroup.ROTATOR_CUFF],
  },
  {
    label: 'Cardio',
    groups: [MuscleGroup.CARDIO, MuscleGroup.FULL_BODY],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export const DataZone = () => {
  const { settings } = useWorkout();

  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup>(MuscleGroup.CHEST);
  const [selectedWeeks, setSelectedWeeks] = useState(8);
  const [selectedMetric, setSelectedMetric] = useState<Metric>('SETS');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [musclePickerVisible, setMusclePickerVisible] = useState(false);
  const [expandedPickerCategory, setExpandedPickerCategory] = useState<string | null>('Chest');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportCSV, setExportCSV] = useState('');

  const isEnduranceFocus = ENDURANCE_MUSCLES.has(selectedMuscle);

  const { data, comparison, exerciseOptions, isLoading } = useAnalytics(
    selectedMuscle,
    selectedWeeks,
    selectedExerciseId,
  );

  // ─── Metric helpers ─────────────────────────────────────────────────────

  const getMetricPrimaryValue = useCallback((point: any): number => {
    switch (selectedMetric) {
      case 'SETS':     return point.primarySets;
      case 'E1RM':     return point.peakE1RM;
      case 'LOAD':     return point.avgLoad;
      case 'DISTANCE': return point.distance;
      case 'TIME':     return point.time_ms / (1000 * 60);
      case 'RPE':      return point.avgRPE;
      default:         return 0;
    }
  }, [selectedMetric]);

  // Secondary value only makes sense for SETS (secondary muscle sets stacked on top)
  const getMetricSecondaryValue = useCallback((point: any): number => {
    if (selectedMetric === 'SETS') return point.secondarySets;
    return 0;
  }, [selectedMetric]);

  const currentChange = useMemo((): number => {
    switch (selectedMetric) {
      case 'SETS':     return comparison.setsChange;
      case 'E1RM':     return comparison.e1RMChange;
      case 'LOAD':     return comparison.loadChange;
      case 'DISTANCE': return comparison.distanceChange;
      case 'TIME':     return comparison.timeChange;
      case 'RPE':      return comparison.rpeChange;
      default:         return 0;
    }
  }, [selectedMetric, comparison]);

  const weightUnit = settings?.weight_unit || 'KG';

  const getUnit = useCallback((): string => {
    switch (selectedMetric) {
      case 'SETS':     return ' sets';
      case 'E1RM':     return ` ${weightUnit}`;
      case 'LOAD':     return ` ${weightUnit}`;
      case 'DISTANCE': return ' KM';
      case 'TIME':     return ' MIN';
      case 'RPE':      return ' / 10'; // Effort (0–10 scale)
      default:         return '';
    }
  }, [selectedMetric, weightUnit]);

  const maxPrimary = useMemo(
    () => Math.max(...data.map(getMetricPrimaryValue), 1),
    [data, getMetricPrimaryValue],
  );
  const maxTotal = useMemo(() => {
    if (selectedMetric !== 'SETS') return maxPrimary;
    return Math.max(...data.map(p => p.primarySets + p.secondarySets), 1);
  }, [data, selectedMetric, maxPrimary]);

  const averageValue = useMemo(() => {
    const values = data.map(getMetricPrimaryValue).filter(v => v > 0);
    if (values.length === 0) return '0';
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(
      selectedMetric === 'RPE' ? 1 : selectedMetric === 'SETS' ? 0 : 1,
    );
  }, [data, getMetricPrimaryValue, selectedMetric]);

  const formatPercent = useCallback((val: number) => {
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  }, []);

  const hasData = data.some(p => getMetricPrimaryValue(p) > 0 || p.secondarySets > 0);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleMuscleSelect = useCallback((mg: MuscleGroup) => {
    setSelectedMuscle(mg);
    setSelectedExerciseId(null);
    const isEndurance = ENDURANCE_MUSCLES.has(mg);
    if (isEndurance && (selectedMetric === 'SETS' || selectedMetric === 'E1RM' || selectedMetric === 'LOAD' || selectedMetric === 'RPE')) {
      setSelectedMetric('DISTANCE');
    } else if (!isEndurance && (selectedMetric === 'DISTANCE' || selectedMetric === 'TIME')) {
      setSelectedMetric('SETS');
    }
  }, [selectedMetric]);

  const handleExerciseSelect = useCallback((id: string | null) => {
    setSelectedExerciseId(prev => (prev === id ? null : id));
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!hasData) {
      Alert.alert('No Data', 'There is no data for this muscle group and timeframe yet.');
      return;
    }
    const header = `Week,Primary Sets,Secondary Sets,Avg Weight (${weightUnit}),Est. Best Lift (${weightUnit}),Distance (KM),Time (min),Avg Effort (RPE),Frequency`;
    const rows = data.map(p =>
      [
        p.weekStart,
        p.primarySets,
        p.secondarySets,
        p.avgLoad.toFixed(1),
        p.peakE1RM.toFixed(1),
        p.distance.toFixed(2),
        (p.time_ms / (1000 * 60)).toFixed(1),
        p.avgRPE > 0 ? p.avgRPE.toFixed(1) : '',
        p.frequency,
      ].join(','),
    );
    setExportCSV([header, ...rows].join('\n'));
    setExportModalVisible(true);
  }, [data, hasData, weightUnit]);

  // ─── Metric tabs ─────────────────────────────────────────────────────────

  const strengthMetrics: { key: Metric; label: string }[] = [
    { key: 'SETS', label: 'Sets' },
    { key: 'E1RM', label: 'Est. Max' },
    { key: 'LOAD', label: 'Weight' },
    { key: 'RPE', label: 'Effort' },
  ];
  const enduranceMetrics: { key: Metric; label: string }[] = [
    { key: 'DISTANCE', label: 'Distance' },
    { key: 'TIME', label: 'Time' },
    { key: 'RPE', label: 'Effort' },
  ];
  const activeMetrics = isEnduranceFocus ? enduranceMetrics : strengthMetrics;

  // ─── Totals for breakdown cards ──────────────────────────────────────────

  const totalPrimarySets  = useMemo(() => data.reduce((a, p) => a + p.primarySets, 0), [data]);
  const totalSecondarySets = useMemo(() => data.reduce((a, p) => a + p.secondarySets, 0), [data]);
  const totalFrequency    = useMemo(() => data.reduce((a, p) => a + p.frequency, 0), [data]);
  const totalDistance     = useMemo(() => data.reduce((a, p) => a + p.distance, 0), [data]);
  const periodBestE1RM    = useMemo(() => Math.max(...data.map(p => p.peakE1RM), 0), [data]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading && data.length === 0) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="mt-4 text-text-muted font-black uppercase tracking-widest text-[10px]">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* ── Header ── */}
      <View className="px-6 pt-2 pb-4 bg-background">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center space-x-3">
            <View className="w-8 h-8 bg-text-main rounded-xl items-center justify-center rotate-6 shadow-md shadow-text-main/20">
              <Text className="text-surface text-base font-black italic">A</Text>
            </View>
            <Text className="text-2xl font-black text-text-main tracking-tighter">nalytics</Text>
          </View>
          <View className="flex-row items-center space-x-3">
            {isLoading && <ActivityIndicator size="small" color="#8B5CF6" />}
            <TouchableOpacity
              onPress={handleExportCSV}
              activeOpacity={0.8}
              className="bg-surface px-4 py-3 rounded-2xl border border-border shadow-sm"
            >
              <Text className="text-text-muted font-black text-xs uppercase tracking-widest">Export CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        style={{ opacity: isLoading ? 0.6 : 1 }}
      >
        {/* ── Muscle Group Selector ── */}
        <View className="px-6 mb-4">
          <TouchableOpacity
            onPress={() => setMusclePickerVisible(true)}
            disabled={isLoading}
            activeOpacity={0.7}
            className="flex-row items-center justify-between bg-surface border border-border px-5 py-4 rounded-2xl"
          >
            <View>
              <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-0.5">Muscle Group</Text>
              <Text className="text-text-main font-black text-sm uppercase tracking-wide">
                {selectedMuscle.replace(/_/g, ' ')}
              </Text>
            </View>
            <Text className="text-text-muted text-xs font-black">▼</Text>
          </TouchableOpacity>
        </View>

        {/* ── Exercise Drill-Down ── */}
        {exerciseOptions.length > 0 && (
          <View className="px-6 mb-4">
            <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-2">Exercise</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 16 }}
            >
              <TouchableOpacity
                onPress={() => handleExerciseSelect(null)}
                disabled={isLoading}
                className={`mr-2 px-5 py-2.5 rounded-2xl border ${
                  selectedExerciseId === null
                    ? 'bg-primary border-primary'
                    : 'bg-surface border-border'
                }`}
              >
                <Text className={`font-black text-xs ${
                  selectedExerciseId === null ? 'text-surface' : 'text-text-muted'
                }`}>All</Text>
              </TouchableOpacity>
              {exerciseOptions.map(ex => (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => handleExerciseSelect(ex.id)}
                  disabled={isLoading}
                  className={`mr-2 px-5 py-2.5 rounded-2xl border ${
                    selectedExerciseId === ex.id
                      ? 'bg-primary border-primary'
                      : 'bg-surface border-border'
                  }`}
                >
                  <Text className={`font-black text-xs ${
                    selectedExerciseId === ex.id ? 'text-surface' : 'text-text-muted'
                  }`}>{ex.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Controls Row ── */}
        <View className="px-6 mb-6 space-y-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest">Timeframe</Text>
            <View className="flex-row bg-surface p-1 rounded-xl border border-border">
              {TIMEFRAMES.map(w => (
                <TouchableOpacity
                  key={w}
                  onPress={() => setSelectedWeeks(w)}
                  disabled={isLoading}
                  className={`px-4 py-2.5 rounded-lg ${selectedWeeks === w ? 'bg-background' : ''}`}
                >
                  <Text className={`font-black text-xs ${selectedWeeks === w ? 'text-text-main' : 'text-text-muted'}`}>
                    {w}W
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest">Metric</Text>
            <View className="flex-row bg-surface p-1 rounded-xl border border-border">
              {activeMetrics.map(m => (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setSelectedMetric(m.key)}
                  disabled={isLoading}
                  className={`px-4 py-2.5 rounded-lg ${selectedMetric === m.key ? 'bg-background' : ''}`}
                >
                  <Text className={`font-black text-xs ${selectedMetric === m.key ? 'text-text-main' : 'text-text-muted'}`}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── Chart Card ── */}
        <View className="mx-6 bg-surface rounded-[40px] p-8 border border-border shadow-sm">
          {/* Chart header */}
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-1">
                Weekly {selectedMetric === 'SETS' ? 'Sets' : selectedMetric === 'E1RM' ? 'Est. Best Lift' : selectedMetric === 'LOAD' ? 'Avg Weight' : selectedMetric === 'RPE' ? 'Effort' : selectedMetric.toLowerCase()}
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
            {/* Legend for stacked sets */}
            {selectedMetric === 'SETS' && (
              <View className="items-end space-y-1">
                <View className="flex-row items-center space-x-1.5">
                  <View className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <Text className="text-[9px] font-black text-text-muted uppercase tracking-widest">Primary</Text>
                </View>
                <View className="flex-row items-center space-x-1.5">
                  <View className="w-2.5 h-2.5 rounded-full bg-primary/30" />
                  <Text className="text-[9px] font-black text-text-muted uppercase tracking-widest">Secondary</Text>
                </View>
              </View>
            )}
          </View>

          {/* Chart bars */}
          {!hasData ? (
            <View className="h-40 items-center justify-center">
              <Text className="text-text-muted font-black text-xs uppercase tracking-widest text-center">
                No sessions logged{'\n'}for this period
              </Text>
              <Text className="text-text-muted text-[10px] mt-2 text-center">Try a longer timeframe</Text>
            </View>
          ) : (
            <View className="flex-row justify-between items-end h-40 mb-6 px-2">
              {data.map((point, index) => {
                const primaryVal = getMetricPrimaryValue(point);
                const secondaryVal = getMetricSecondaryValue(point);
                const totalVal = primaryVal + secondaryVal;

                const totalBarHeight = Math.max((totalVal / maxTotal) * CHART_HEIGHT, totalVal > 0 ? 8 : 4);
                const primaryBarHeight = totalVal > 0
                  ? Math.max((primaryVal / totalVal) * totalBarHeight, primaryVal > 0 ? 4 : 0)
                  : totalBarHeight;
                const secondaryBarHeight = totalBarHeight - primaryBarHeight;

                const isEmpty = primaryVal === 0 && secondaryVal === 0;
                const showLabel = index === 0 || index === data.length - 1 || (selectedWeeks <= 8 && index % 2 === 0);

                return (
                  <View key={point.weekStart} className="flex-1 items-center justify-end" style={{ height: CHART_HEIGHT + 24 }}>
                    {isEmpty ? (
                      <View className="w-3 rounded-full bg-border/30" style={{ height: 4 }} />
                    ) : (
                      <View className="w-3 rounded-full overflow-hidden items-center" style={{ height: totalBarHeight }}>
                        {/* Secondary on top */}
                        {secondaryBarHeight > 0 && (
                          <View
                            className={`w-full ${selectedMetric === 'SETS' ? 'bg-primary/30' : 'bg-border/30'}`}
                            style={{ height: secondaryBarHeight }}
                          />
                        )}
                        {/* Primary on bottom */}
                        <View
                          className={`w-full ${
                            selectedMetric === 'DISTANCE' || selectedMetric === 'TIME'
                              ? 'bg-accent'
                              : selectedMetric === 'RPE'
                              ? 'bg-primary/60'
                              : 'bg-primary'
                          }`}
                          style={{ height: primaryBarHeight }}
                        />
                      </View>
                    )}
                    {showLabel && (
                      <Text className="text-[7px] font-black text-text-muted mt-2 rotate-45 origin-left">
                        {point.weekStart.split('-').slice(1).join('/')}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Metric Breakdown ── */}
        <View className="px-6 mt-8">
          <Text className="text-text-main font-black text-xl mb-4 tracking-tighter">Breakdown</Text>

          {isEnduranceFocus ? (
            // Endurance breakdown
            <View className="flex-row space-x-4 mb-4">
              <View className="flex-1 bg-surface p-6 rounded-[32px] border border-border">
                <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-2">Total Distance</Text>
                <Text className="text-2xl font-black text-text-main">
                  {totalDistance.toFixed(1)}
                  <Text className="text-xs text-text-muted"> KM</Text>
                </Text>
                <Text className={`text-[10px] font-black mt-1 ${comparison.distanceChange >= 0 ? 'text-success' : 'text-accent'}`}>
                  {formatPercent(comparison.distanceChange)}
                </Text>
              </View>
              <View className="flex-1 bg-surface p-6 rounded-[32px] border border-border">
                <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-2">Frequency</Text>
                <Text className="text-2xl font-black text-text-main">{totalFrequency}</Text>
                <Text className={`text-[10px] font-black mt-1 ${comparison.frequencyChange >= 0 ? 'text-success' : 'text-accent'}`}>
                  {formatPercent(comparison.frequencyChange)}
                </Text>
              </View>
            </View>
          ) : (
            // Strength breakdown
            <>
              <View className="flex-row space-x-4 mb-4">
                <View className="flex-1 bg-surface p-6 rounded-[32px] border border-border">
                  <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-2">Primary Sets</Text>
                  <Text className="text-2xl font-black text-text-main">{totalPrimarySets}</Text>
                  <Text className="text-[10px] text-text-muted font-medium mt-0.5">+{totalSecondarySets} secondary</Text>
                  <Text className={`text-[10px] font-black mt-1 ${comparison.primarySetsChange >= 0 ? 'text-success' : 'text-accent'}`}>
                    {formatPercent(comparison.primarySetsChange)}
                  </Text>
                </View>
                <View className="flex-1 bg-surface p-6 rounded-[32px] border border-border">
                  <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-2">Est. Best Lift</Text>
                  <Text className="text-2xl font-black text-text-main">
                    {periodBestE1RM > 0 ? periodBestE1RM.toFixed(1) : '—'}
                    {periodBestE1RM > 0 && <Text className="text-xs text-text-muted"> {weightUnit}</Text>}
                  </Text>
                  <Text className={`text-[10px] font-black mt-1 ${comparison.e1RMChange >= 0 ? 'text-success' : 'text-accent'}`}>
                    {periodBestE1RM > 0 ? formatPercent(comparison.e1RMChange) : '—'}
                  </Text>
                </View>
              </View>
              <View className="flex-row space-x-4 mb-4">
                <View className="flex-1 bg-surface p-6 rounded-[32px] border border-border">
                  <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-2">Frequency</Text>
                  <Text className="text-2xl font-black text-text-main">{totalFrequency}</Text>
                  <Text className={`text-[10px] font-black mt-1 ${comparison.frequencyChange >= 0 ? 'text-success' : 'text-accent'}`}>
                    {formatPercent(comparison.frequencyChange)}
                  </Text>
                </View>
                <View className="flex-1 bg-surface p-6 rounded-[32px] border border-border">
                  <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-2">Avg Weight</Text>
                  <Text className="text-2xl font-black text-text-main">
                    {data.some(p => p.avgLoad > 0) ? (data.reduce((a, p) => a + p.avgLoad, 0) / data.filter(p => p.avgLoad > 0).length).toFixed(1) : '—'}
                    {data.some(p => p.avgLoad > 0) && <Text className="text-xs text-text-muted"> {weightUnit}</Text>}
                  </Text>
                  <Text className={`text-[10px] font-black mt-1 ${comparison.loadChange >= 0 ? 'text-success' : 'text-accent'}`}>
                    {data.some(p => p.avgLoad > 0) ? formatPercent(comparison.loadChange) : '—'}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Period summary */}
          <View className="bg-surface p-6 rounded-[32px] border border-border">
            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest mb-1">Period Summary</Text>
                {hasData ? (
                  <Text className="text-text-main font-bold text-sm leading-5">
                    {selectedExerciseId
                      ? `${exerciseOptions.find(e => e.id === selectedExerciseId)?.name ?? 'This exercise'} logged ${totalFrequency} session${totalFrequency !== 1 ? 's' : ''} over the last ${selectedWeeks} weeks.`
                      : `You've trained ${selectedMuscle.toLowerCase().replace(/_/g, ' ')} ${totalFrequency} time${totalFrequency !== 1 ? 's' : ''} over the last ${selectedWeeks} weeks.`
                    }
                    {!isEnduranceFocus && totalPrimarySets > 0 && ` ${totalPrimarySets} primary working sets logged.`}
                  </Text>
                ) : (
                  <Text className="text-text-muted font-bold text-sm leading-5">
                    No sessions logged for {selectedMuscle.toLowerCase().replace(/_/g, ' ')} in this period. Try expanding the timeframe.
                  </Text>
                )}
              </View>
              <View className="w-12 h-12 bg-primary-soft rounded-2xl items-center justify-center ml-4">
                <Text className="text-xl">📈</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ─── Muscle Picker Modal ──────────────────────────────────────────── */}
      <Modal visible={musclePickerVisible} animationType="slide" transparent statusBarTranslucent>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-surface rounded-t-[40px] p-8 pb-12 shadow-2xl" style={{ maxHeight: '80%' }}>
            <View className="w-12 h-1.5 bg-border rounded-full self-center mb-6" />
            <Text className="text-2xl font-black text-text-main mb-6">Muscle Group</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {MUSCLE_CATEGORIES.map(category => (
                <View key={category.label} className="mb-4">
                  <TouchableOpacity
                    onPress={() => setExpandedPickerCategory(prev => prev === category.label ? null : category.label)}
                    className="flex-row items-center justify-between mb-2"
                  >
                    <Text className="text-text-muted font-black text-[10px] uppercase tracking-widest">{category.label}</Text>
                    <Text className="text-text-muted text-xs">{expandedPickerCategory === category.label ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {expandedPickerCategory === category.label && (
                    <View className="flex-row flex-wrap gap-2">
                      {category.groups.map(mg => (
                        <TouchableOpacity
                          key={mg}
                          onPress={() => { handleMuscleSelect(mg); setMusclePickerVisible(false); }}
                          className={`px-5 py-2.5 rounded-2xl border ${
                            selectedMuscle === mg
                              ? 'bg-text-main border-text-main'
                              : 'bg-background border-border'
                          }`}
                        >
                          <Text className={`font-black text-xs uppercase tracking-widest ${
                            selectedMuscle === mg ? 'text-surface' : 'text-text-muted'
                          }`}>
                            {mg.replace(/_/g, ' ')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setMusclePickerVisible(false)}
              className="bg-background border border-border py-4 rounded-2xl mt-6"
            >
              <Text className="text-text-muted font-black text-center text-sm uppercase tracking-widest">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Export CSV Modal ─────────────────────────────────────────────── */}
      <Modal visible={exportModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-surface rounded-t-[40px] p-8 pb-12 shadow-2xl h-[75%]">
            <View className="w-12 h-1.5 bg-border rounded-full self-center mb-6" />
            <Text className="text-2xl font-black text-text-main mb-1">Export CSV</Text>
            <Text className="text-text-muted text-xs font-medium mb-6 leading-5">
              {`${selectedMuscle.replace(/_/g, ' ')}${selectedExerciseId ? ` · ${exerciseOptions.find(e => e.id === selectedExerciseId)?.name}` : ''} · last ${selectedWeeks} weeks. Copy and paste into any spreadsheet app.`}
            </Text>
            <ScrollView className="flex-1 bg-background rounded-2xl p-4 border border-border mb-6">
              <Text selectable className="text-text-muted font-mono text-xs leading-5">{exportCSV}</Text>
            </ScrollView>
            <TouchableOpacity
              onPress={() => setExportModalVisible(false)}
              className="bg-primary py-5 rounded-2xl"
            >
              <Text className="text-surface font-black text-center text-sm uppercase tracking-widest">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};
