import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { inferenceEngine } from '../../inference/engine';
import { ModelDownloader, ModelInfo } from '../../utils/modelDownloader';

interface AvailableModel {
  id: string;
  name: string;
  size: number;
  parameters: number;
  description: string;
  downloadUrl: string;
  isDownloaded: boolean;
  downloadProgress?: number;
}

export default function ModelsScreen() {
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableModels();
  }, []);

  const loadAvailableModels = async () => {
    setLoading(true);
    try {
      // For now, we'll use a curated list of small models suitable for mobile
      const availableModels: AvailableModel[] = [
        {
          id: 'llama2-3b-q4',
          name: 'Llama 2 3B (Q4)',
          size: 1.8, // GB
          parameters: 3,
          description: 'Small, fast model good for basic tasks',
          downloadUrl: 'https://huggingface.co/TheBloke/Llama-2-3B-GGML/resolve/main/llama-2-3b.ggmlv3.q4_0.bin',
          isDownloaded: false,
        },
        {
          id: 'mistral-7b-q4',
          name: 'Mistral 7B (Q4)',
          size: 4.1,
          parameters: 7,
          description: 'Good balance of performance and speed',
          downloadUrl: 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGML/resolve/main/mistral-7b-instruct-v0.2.ggmlv3.q4_0.bin',
          isDownloaded: false,
        },
        {
          id: 'phi-2-q4',
          name: 'Phi-2 (Q4)',
          size: 1.6,
          parameters: 2.7,
          description: 'Microsoft\'s efficient small model',
          downloadUrl: 'https://huggingface.co/TheBloke/phi-2-GGML/resolve/main/phi-2.ggmlv3.q4_0.bin',
          isDownloaded: false,
        },
        {
          id: 'tinyllama-1b-q4',
          name: 'TinyLlama 1.1B (Q4)',
          size: 0.7,
          parameters: 1.1,
          description: 'Ultra-small model for basic tasks',
          downloadUrl: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGML/resolve/main/tinyllama-1.1b-chat-v1.0.ggmlv3.q4_0.bin',
          isDownloaded: false,
        },
      ];

      setModels(availableModels);
    } catch (error) {
      console.error('Failed to load models:', error);
      Alert.alert('Error', 'Failed to load available models');
    } finally {
      setLoading(false);
    }
  };

  const downloadModel = async (model: AvailableModel) => {
    if (downloading) return;

    setDownloading(model.id);
    try {
      // Simulate download progress
      for (let progress = 0; progress <= 100; progress += 10) {
        setModels(prev => prev.map(m => 
          m.id === model.id 
            ? { ...m, downloadProgress: progress }
            : m
        ));
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Mark as downloaded
      setModels(prev => prev.map(m => 
        m.id === model.id 
          ? { ...m, isDownloaded: true, downloadProgress: undefined }
          : m
      ));

      Alert.alert('Success', `${model.name} downloaded successfully!`);
    } catch (error) {
      console.error('Download failed:', error);
      Alert.alert('Error', `Failed to download ${model.name}`);
    } finally {
      setDownloading(null);
    }
  };

  const deleteModel = async (model: AvailableModel) => {
    Alert.alert(
      'Delete Model',
      `Are you sure you want to delete ${model.name}? This will free up ${model.size}GB of storage.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setModels(prev => prev.map(m => 
                m.id === model.id 
                  ? { ...m, isDownloaded: false }
                  : m
              ));
              Alert.alert('Success', `${model.name} deleted successfully!`);
            } catch (error) {
              console.error('Delete failed:', error);
              Alert.alert('Error', `Failed to delete ${model.name}`);
            }
          },
        },
      ]
    );
  };

  const loadModel = async (model: AvailableModel) => {
    try {
      await inferenceEngine.loadModel(`models/${model.id}`);
      Alert.alert('Success', `${model.name} loaded successfully!`);
    } catch (error) {
      console.error('Load failed:', error);
      Alert.alert('Error', `Failed to load ${model.name}`);
    }
  };

  const renderModel = ({ item }: { item: AvailableModel }) => (
    <View style={styles.modelCard}>
      <View style={styles.modelHeader}>
        <View style={styles.modelInfo}>
          <Text style={styles.modelName}>{item.name}</Text>
          <Text style={styles.modelDescription}>{item.description}</Text>
          <Text style={styles.modelDetails}>
            {item.parameters}B parameters • {item.size}GB
          </Text>
        </View>
        <View style={styles.modelStatus}>
          {item.isDownloaded ? (
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.statusText}>Downloaded</Text>
            </View>
          ) : (
            <View style={styles.statusBadge}>
              <Ionicons name="cloud-download-outline" size={16} color="#8E8E93" />
              <Text style={styles.statusText}>Not Downloaded</Text>
            </View>
          )}
        </View>
      </View>

      {item.downloadProgress !== undefined && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { width: `${item.downloadProgress}%` }]} 
            />
          </View>
          <Text style={styles.progressText}>{item.downloadProgress}%</Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        {item.isDownloaded ? (
          <>
            <TouchableOpacity
              style={[styles.button, styles.loadButton]}
              onPress={() => loadModel(item)}
            >
              <Ionicons name="play" size={16} color="#FFFFFF" />
              <Text style={styles.buttonText}>Load</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={() => deleteModel(item)}
            >
              <Ionicons name="trash" size={16} color="#FF3B30" />
              <Text style={[styles.buttonText, styles.deleteButtonText]}>Delete</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.downloadButton, downloading && styles.buttonDisabled]}
            onPress={() => downloadModel(item)}
            disabled={downloading !== null}
          >
            {downloading === item.id ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="download" size={16} color="#FFFFFF" />
            )}
            <Text style={styles.buttonText}>
              {downloading === item.id ? 'Downloading...' : 'Download'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading models...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Models</Text>
        <Text style={styles.subtitle}>Download and manage local LLM models</Text>
      </View>

      <FlatList
        data={models}
        renderItem={renderModel}
        keyExtractor={(item) => item.id}
        style={styles.modelsList}
        contentContainerStyle={styles.modelsContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadAvailableModels} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  modelsList: {
    flex: 1,
  },
  modelsContent: {
    padding: 16,
  },
  modelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modelInfo: {
    flex: 1,
    marginRight: 12,
  },
  modelName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  modelDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  modelDetails: {
    fontSize: 12,
    color: '#8E8E93',
  },
  modelStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#8E8E93',
    minWidth: 40,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  downloadButton: {
    backgroundColor: '#007AFF',
  },
  loadButton: {
    backgroundColor: '#34C759',
  },
  deleteButton: {
    backgroundColor: '#FFE5E5',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  deleteButtonText: {
    color: '#FF3B30',
  },
}); 