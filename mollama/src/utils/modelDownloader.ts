import * as FileSystem from 'expo-file-system';

export interface ModelInfo {
  id: string;
  name: string;
  size: number; // in GB
  parameters: number; // in billions
  description: string;
  huggingfaceRepo: string;
  modelFile: string;
  localPath?: string;
  isDownloaded: boolean;
  downloadProgress?: number;
}

export class ModelDownloader {
  private static readonly MODELS_DIR = `${FileSystem.documentDirectory}models/`;

  static async initialize(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.MODELS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.MODELS_DIR, { intermediates: true });
        console.log('Models directory created');
      }
    } catch (error) {
      console.error('Failed to initialize models directory:', error);
      throw error;
    }
  }

  static async getAvailableModels(): Promise<ModelInfo[]> {
    // Curated list of small models suitable for mobile
    return [
      {
        id: 'llama2-3b-q4',
        name: 'Llama 2 3B (Q4)',
        size: 1.8,
        parameters: 3,
        description: 'Small, fast model good for basic tasks',
        huggingfaceRepo: 'TheBloke/Llama-2-3B-GGML',
        modelFile: 'llama-2-3b.ggmlv3.q4_0.bin',
        isDownloaded: false,
      },
      {
        id: 'mistral-7b-q4',
        name: 'Mistral 7B (Q4)',
        size: 4.1,
        parameters: 7,
        description: 'Good balance of performance and speed',
        huggingfaceRepo: 'TheBloke/Mistral-7B-Instruct-v0.2-GGML',
        modelFile: 'mistral-7b-instruct-v0.2.ggmlv3.q4_0.bin',
        isDownloaded: false,
      },
      {
        id: 'phi-2-q4',
        name: 'Phi-2 (Q4)',
        size: 1.6,
        parameters: 2.7,
        description: 'Microsoft\'s efficient small model',
        huggingfaceRepo: 'TheBloke/phi-2-GGML',
        modelFile: 'phi-2.ggmlv3.q4_0.bin',
        isDownloaded: false,
      },
      {
        id: 'tinyllama-1b-q4',
        name: 'TinyLlama 1.1B (Q4)',
        size: 0.7,
        parameters: 1.1,
        description: 'Ultra-small model for basic tasks',
        huggingfaceRepo: 'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGML',
        modelFile: 'tinyllama-1.1b-chat-v1.0.ggmlv3.q4_0.bin',
        isDownloaded: false,
      },
    ];
  }

  static async checkDownloadedModels(): Promise<ModelInfo[]> {
    const models = await this.getAvailableModels();
    const downloadedModels: ModelInfo[] = [];

    for (const model of models) {
      const localPath = `${this.MODELS_DIR}${model.id}/${model.modelFile}`;
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      
      if (fileInfo.exists) {
        downloadedModels.push({
          ...model,
          localPath,
          isDownloaded: true,
        });
      }
    }

    return downloadedModels;
  }

  static async downloadModel(
    model: ModelInfo,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const modelDir = `${this.MODELS_DIR}${model.id}/`;
    const localPath = `${modelDir}${model.modelFile}`;
    
    // Create model directory
    await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });

    // Download URL from Hugging Face
    const downloadUrl = `https://huggingface.co/${model.huggingfaceRepo}/resolve/main/${model.modelFile}`;

    console.log(`Downloading ${model.name} from: ${downloadUrl}`);

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          onProgress?.(progress * 100);
        }
      );

      const result = await downloadResumable.downloadAsync();
      
      if (result?.status === 200) {
        console.log(`Successfully downloaded ${model.name}`);
        return localPath;
      } else {
        throw new Error(`Download failed with status: ${result?.status}`);
      }
    } catch (error) {
      console.error(`Failed to download ${model.name}:`, error);
      throw error;
    }
  }

  static async deleteModel(model: ModelInfo): Promise<void> {
    if (!model.localPath) return;

    try {
      await FileSystem.deleteAsync(model.localPath);
      console.log(`Deleted model: ${model.name}`);
    } catch (error) {
      console.error(`Failed to delete model ${model.name}:`, error);
      throw error;
    }
  }

  static async getModelSize(model: ModelInfo): Promise<number> {
    if (!model.localPath) return 0;

    try {
      const fileInfo = await FileSystem.getInfoAsync(model.localPath);
      return (fileInfo as any).size || 0;
    } catch (error) {
      console.error(`Failed to get model size for ${model.name}:`, error);
      return 0;
    }
  }

  static async getAvailableStorage(): Promise<number> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory!);
      return (dirInfo as any).size || 0;
    } catch (error) {
      console.error('Failed to get available storage:', error);
      return 0;
    }
  }
} 