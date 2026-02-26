import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { query } from '../database/db';
import { Exercise, MuscleGroup, ExerciseType } from '../types/database';

export const ArchitectZone = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Partial<Exercise> | null>(null);

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    const result = query('SELECT * FROM Exercises ORDER BY name ASC;');
    setExercises(result.rows?._array || []);
  };

  const handleSave = async () => {
    if (!editingExercise?.name || !editingExercise?.muscle_group || !editingExercise?.type) {
      Alert.alert('Error', 'Please fill in name, muscle group, and type.');
      return;
    }

    try {
      const lastModified = Date.now();
      if (editingExercise.id) {
        // Update
        query(
          'UPDATE Exercises SET name = ?, description = ?, muscle_group = ?, type = ?, last_modified = ? WHERE id = ?;',
          [
            editingExercise.name,
            editingExercise.description || '',
            editingExercise.muscle_group,
            editingExercise.type,
            lastModified,
            editingExercise.id,
          ]
        );
      } else {
        // Create
        const id = Math.random().toString(36).substring(2, 15);
        query(
          'INSERT INTO Exercises (id, name, description, type, muscle_group, is_base_content, last_modified) VALUES (?, ?, ?, ?, ?, 0, ?);',
          [
            id,
            editingExercise.name,
            editingExercise.description || '',
            editingExercise.type,
            editingExercise.muscle_group,
            lastModified,
          ]
        );
      }
      setModalVisible(false);
      setEditingExercise(null);
      loadExercises();
    } catch (error) {
      console.error('Save failed:', error);
      Alert.alert('Error', 'Failed to save exercise.');
    }
  };

  const handleDelete = (exercise: Exercise) => {
    if (exercise.is_base_content) {
      Alert.alert('Protected', 'Base exercises cannot be deleted.');
      return;
    }

    Alert.alert('Delete', `Are you sure you want to delete \${exercise.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          query('DELETE FROM Exercises WHERE id = ?;', [exercise.id]);
          loadExercises();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Exercise }) => (
    <View className="bg-white p-4 mb-2 rounded-lg shadow-sm flex-row justify-between items-center border border-gray-100">
      <View className="flex-1">
        <Text className="text-lg font-bold text-gray-800">{item.name}</Text>
        <Text className="text-sm text-gray-500">{item.muscle_group} | {item.type}</Text>
      </View>
      <View className="flex-row">
        <TouchableOpacity
          onPress={() => {
            setEditingExercise(item);
            setModalVisible(true);
          }}
          className="bg-blue-500 p-2 rounded-md mr-2"
        >
          <Text className="text-white">Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          className="bg-red-500 p-2 rounded-md"
        >
          <Text className="text-white">Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50 p-4 pt-12">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-2xl font-bold text-gray-900">Architect Zone</Text>
        <TouchableOpacity
          onPress={() => {
            setEditingExercise({ muscle_group: MuscleGroup.CHEST, type: ExerciseType.STRENGTH });
            setModalVisible(true);
          }}
          className="bg-green-600 px-4 py-2 rounded-lg"
        >
          <Text className="text-white font-semibold">+ Add Exercise</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={exercises}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-center bg-black/50 p-4">
          <View className="bg-white rounded-2xl p-6 shadow-xl">
            <Text className="text-xl font-bold mb-4">
              {editingExercise?.id ? 'Edit Exercise' : 'New Exercise'}
            </Text>
            
            <ScrollView>
              <Text className="text-sm font-semibold text-gray-600 mb-1">Name</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3 mb-4"
                placeholder="Exercise Name"
                value={editingExercise?.name}
                onChangeText={(text) => setEditingExercise({ ...editingExercise, name: text })}
              />

              <Text className="text-sm font-semibold text-gray-600 mb-1">Description</Text>
              <TextInput
                className="border border-gray-200 rounded-lg p-3 mb-4 h-24"
                placeholder="Description"
                multiline
                value={editingExercise?.description}
                onChangeText={(text) => setEditingExercise({ ...editingExercise, description: text })}
              />

              <Text className="text-sm font-semibold text-gray-600 mb-1">Muscle Group</Text>
              <View className="flex-row flex-wrap mb-4">
                {Object.values(MuscleGroup).map((mg) => (
                  <TouchableOpacity
                    key={mg}
                    onPress={() => setEditingExercise({ ...editingExercise, muscle_group: mg })}
                    className={`p-2 m-1 rounded-md border \${
                      editingExercise?.muscle_group === mg ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text className={editingExercise?.muscle_group === mg ? 'text-white' : 'text-gray-700'}>
                      {mg}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-sm font-semibold text-gray-600 mb-1">Type</Text>
              <View className="flex-row flex-wrap mb-6">
                {Object.values(ExerciseType).map((et) => (
                  <TouchableOpacity
                    key={et}
                    onPress={() => setEditingExercise({ ...editingExercise, type: et })}
                    className={`p-2 m-1 rounded-md border \${
                      editingExercise?.type === et ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text className={editingExercise?.type === et ? 'text-white' : 'text-gray-700'}>
                      {et}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View className="flex-row justify-end mt-4">
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="px-6 py-3 mr-2"
              >
                <Text className="text-gray-600 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                className="bg-blue-600 px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-bold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
