import React, { useEffect, useState } from "react";
import * as FileSystem from "expo-file-system";
import { loadModel } from "../llama/llama.config";
import Chat from "@/components/Chat";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LlamaContext } from "llama.rn";
import { Text, View, ActivityIndicator, TouchableOpacity, Modal, ScrollView, Alert, Dimensions } from "react-native";
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Model configurations with size limits and validation
interface ModelConfig {
    id: string;
    name: string;
    description: string;
    url: string;
    sizeGB: number;
    maxParams: number;
    recommended: boolean;
}

const AVAILABLE_MODELS: ModelConfig[] = [
    {
        id: "qwen3-1.7b",
        name: "Qwen3 1.7B",
        description: "Fast, efficient model good for general conversation",
        url: "https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q5_K_M.gguf",
        sizeGB: 1.1,
        maxParams: 2048,
        recommended: true
    },
    {
        id: "qwen2.5-vl-3b",
        name: "Qwen2.5-VL 3B",
        description: "Multimodal model that can see and understand images",
        url: "https://huggingface.co/unsloth/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf",
        sizeGB: 1.93,
        maxParams: 4096,
        recommended: false
    },
    {
        id: "phi-3-mini",
        name: "Phi-3 Mini",
        description: "Microsoft's efficient model with good reasoning",
        url: "https://huggingface.co/unsloth/Phi-3-mini-GGUF/resolve/main/Phi-3-mini-Q5_K_M.gguf",
        sizeGB: 0.8,
        maxParams: 2048,
        recommended: true
    },
    {
        id: "llama3-1b",
        name: "Llama3 1B",
        description: "Meta's lightweight Llama model",
        url: "https://huggingface.co/unsloth/Llama-3-1B-GGUF/resolve/main/Llama-3-1B-Q5_K_M.gguf",
        sizeGB: 0.6,
        maxParams: 2048,
        recommended: false
    }
];

// Parameter restrictions
const PARAMETER_LIMITS = {
    maxModelSizeGB: 2.0, // Maximum model size in GB
    maxContextLength: 4096, // Maximum context length
    maxResponseLength: 2048, // Maximum response length
    minRAMGB: 4.0 // Minimum recommended RAM
};

export default () => {
    const [context, setContext] = useState<LlamaContext | null | undefined>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState("Initializing...");
    const [showModelSelector, setShowModelSelector] = useState(false);
    const [selectedModel, setSelectedModel] = useState<ModelConfig>(AVAILABLE_MODELS[0]);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [currentTab, setCurrentTab] = useState<'chat' | 'models'>('chat');
    const [showSidebar, setShowSidebar] = useState(false);

    // Check if model file exists for current selection
    const getModelPath = (model: ModelConfig) => {
        return FileSystem.documentDirectory + `model_${model.id}.gguf`;
    };

    const validateModelSelection = (model: ModelConfig): { valid: boolean; message?: string } => {
        if (model.sizeGB > PARAMETER_LIMITS.maxModelSizeGB) {
            return { 
                valid: false, 
                message: `Model too large (${model.sizeGB}GB > ${PARAMETER_LIMITS.maxModelSizeGB}GB limit)` 
            };
        }
        
        if (model.maxParams > PARAMETER_LIMITS.maxContextLength) {
            return { 
                valid: false, 
                message: `Model exceeds context length limit (${model.maxParams} > ${PARAMETER_LIMITS.maxContextLength})` 
            };
        }

        return { valid: true };
    };

    const downloadResumable = (model: ModelConfig) => FileSystem.createDownloadResumable(
        model.url,
        getModelPath(model),
        {},
        (downloadProgress) => {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            setDownloadProgress(progress);
            setStatus(`Downloading ${model.name}: ${(progress * 100).toFixed(1)}%`);
        },
    );

    const downloadModel = async (model: ModelConfig) => {
        try {
            setStatus("Checking for existing model...");
            const modelPath = getModelPath(model);
            const isExists = (await FileSystem.getInfoAsync(modelPath)).exists;
            
            if (isExists) {
                setStatus("Loading existing model...");
                console.log("Model exists, loading...");
                try {
                    const context = await loadModel(modelPath);
                    console.log("Model loaded successfully!");
                    setContext(context);
                    setLoading(false);
                    return;
                } catch (loadError) {
                    console.error("Error loading existing model:", loadError);
                    console.log("Model file may be corrupted, will re-download...");
                    // Delete corrupted file and re-download
                    try {
                        await FileSystem.deleteAsync(modelPath);
                    } catch (deleteError) {
                        console.error("Error deleting corrupted model:", deleteError);
                    }
                }
            }

            setStatus("Downloading model...");
            const res = await downloadResumable(model).downloadAsync();
            console.log("Finished downloading to ", res?.uri);

            if (!res?.uri) {
                throw new Error("Download failed - no URI returned");
            }

            setStatus("Loading downloaded model...");
            console.log("Loading model from:", res.uri);
            const context = await loadModel(res.uri);
            console.log("Model loaded successfully!");
            setContext(context);
            setLoading(false);
        } catch (e) {
            console.error("Error in downloadModel:", e);
            setError(e instanceof Error ? e.message : "Unknown error occurred");
            setLoading(false);
        }
    };

    const switchModel = async (newModel: ModelConfig) => {
        const validation = validateModelSelection(newModel);
        if (!validation.valid) {
            Alert.alert("Model Too Large", validation.message);
            return;
        }

        setSelectedModel(newModel);
        setShowModelSelector(false);
        setLoading(true);
        setError(null);
        setContext(null);
        
        // Download and load the new model
        await downloadModel(newModel);
    };

    useEffect(() => {
        downloadModel(selectedModel);
    }, []);

    if (error) {
        return (
            <SafeAreaProvider>
                <SafeAreaView style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, color: 'red', textAlign: 'center', marginBottom: 20 }}>
                        Error: {error}
                    </Text>
                    <Text style={{ fontSize: 14, color: 'gray', textAlign: 'center', marginBottom: 20 }}>
                        Try restarting the app or check your internet connection.
                    </Text>
                    <TouchableOpacity 
                        style={{
                            backgroundColor: '#6366f1',
                            paddingHorizontal: 20,
                            paddingVertical: 12,
                            borderRadius: 8
                        }}
                        onPress={() => {
                            setError(null);
                            setLoading(true);
                            downloadModel(selectedModel);
                        }}
                    >
                        <Text style={{ color: 'white', fontWeight: '600' }}>Retry</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            </SafeAreaProvider>
        );
    }

    if (loading) {
        return (
            <SafeAreaProvider>
                <SafeAreaView style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#007AFF" style={{ marginBottom: 20 }} />
                    <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 8 }}>
                        {status}
                    </Text>
                    <Text style={{ fontSize: 14, color: 'gray', textAlign: 'center', marginBottom: 20 }}>
                        Current Model: {selectedModel.name}
                    </Text>
                    <TouchableOpacity 
                        style={{
                            backgroundColor: '#f3f4f6',
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 6
                        }}
                        onPress={() => setShowModelSelector(true)}
                    >
                        <Text style={{ color: '#6b7280', fontSize: 14 }}>Switch Model</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            </SafeAreaProvider>
        );
    }

    const renderSidebar = () => (
        <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: width * 0.8,
            height: '100%',
            backgroundColor: '#ffffff',
            zIndex: 1000,
            shadowColor: '#000',
            shadowOffset: { width: 2, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 5
        }}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 20,
                    paddingVertical: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: '#e5e7eb'
                }}>
                    <Text style={{ fontSize: 20, fontWeight: '600', color: '#1f2937' }}>
                        Menu
                    </Text>
                    <TouchableOpacity onPress={() => setShowSidebar(false)}>
                        <Ionicons name="close" size={24} color="#6b7280" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
                    <TouchableOpacity
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 16,
                            borderBottomWidth: 1,
                            borderBottomColor: '#f3f4f6'
                        }}
                        onPress={() => {
                            setCurrentTab('chat');
                            setShowSidebar(false);
                        }}
                    >
                        <Ionicons 
                            name="chatbubbles" 
                            size={20} 
                            color={currentTab === 'chat' ? '#6366f1' : '#6b7280'} 
                        />
                        <Text style={{
                            marginLeft: 12,
                            fontSize: 16,
                            fontWeight: currentTab === 'chat' ? '600' : '400',
                            color: currentTab === 'chat' ? '#6366f1' : '#1f2937'
                        }}>
                            Chat
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 16,
                            borderBottomWidth: 1,
                            borderBottomColor: '#f3f4f6'
                        }}
                        onPress={() => {
                            setCurrentTab('models');
                            setShowSidebar(false);
                        }}
                    >
                        <Ionicons 
                            name="settings" 
                            size={20} 
                            color={currentTab === 'models' ? '#6366f1' : '#6b7280'} 
                        />
                        <Text style={{
                            marginLeft: 12,
                            fontSize: 16,
                            fontWeight: currentTab === 'models' ? '600' : '400',
                            color: currentTab === 'models' ? '#6366f1' : '#1f2937'
                        }}>
                            Models
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </View>
    );

    const renderModelsTab = () => (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#e5e7eb'
            }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center'
                }}>
                    <TouchableOpacity 
                        style={{ marginRight: 16 }}
                        onPress={() => setShowSidebar(true)}
                    >
                        <Ionicons name="menu" size={24} color="#6b7280" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937' }}>
                        Models
                    </Text>
                </View>
            </View>

            <ScrollView style={{ flex: 1, padding: 16 }}>
                <Text style={{ fontSize: 16, color: '#6b7280', marginBottom: 20 }}>
                    Choose a model based on your device capabilities and needs:
                </Text>
                
                {AVAILABLE_MODELS.map((model) => {
                    const validation = validateModelSelection(model);
                    const isCurrentModel = model.id === selectedModel.id;
                    
                    return (
                        <TouchableOpacity
                            key={model.id}
                            style={{
                                backgroundColor: isCurrentModel ? '#f0f9ff' : '#f8fafc',
                                borderWidth: 1,
                                borderColor: isCurrentModel ? '#0ea5e9' : '#e5e7eb',
                                borderRadius: 12,
                                padding: 16,
                                marginBottom: 12,
                                opacity: validation.valid ? 1 : 0.5
                            }}
                            onPress={() => validation.valid && switchModel(model)}
                            disabled={!validation.valid}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <Text style={{ 
                                    fontSize: 16, 
                                    fontWeight: '600', 
                                    color: '#1f2937',
                                    flex: 1
                                }}>
                                    {model.name}
                                    {model.recommended && (
                                        <Text style={{ color: '#059669', fontSize: 12, marginLeft: 8 }}>
                                            ★ Recommended
                                        </Text>
                                    )}
                                </Text>
                                {isCurrentModel && (
                                    <Text style={{ color: '#0ea5e9', fontSize: 12, fontWeight: '600' }}>
                                        Current
                                    </Text>
                                )}
                            </View>
                            
                            <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
                                {model.description}
                            </Text>
                            
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                    Size: {model.sizeGB}GB
                                </Text>
                                <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                    Context: {model.maxParams}
                                </Text>
                            </View>
                            
                            {!validation.valid && (
                                <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>
                                    {validation.message}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );

    return (
        <SafeAreaProvider>
            {loading ? (
                <SafeAreaView style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#007AFF" style={{ marginBottom: 20 }} />
                    <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 8 }}>
                        {status}
                    </Text>
                    <Text style={{ fontSize: 14, color: 'gray', textAlign: 'center', marginBottom: 20 }}>
                        Current Model: {selectedModel.name}
                    </Text>
                    <TouchableOpacity 
                        style={{
                            backgroundColor: '#f3f4f6',
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 6
                        }}
                        onPress={() => setShowModelSelector(true)}
                    >
                        <Text style={{ color: '#6b7280', fontSize: 14 }}>Switch Model</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            ) : error ? (
                <SafeAreaView style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, color: 'red', textAlign: 'center', marginBottom: 20 }}>
                        Error: {error}
                    </Text>
                    <Text style={{ fontSize: 14, color: 'gray', textAlign: 'center', marginBottom: 20 }}>
                        Try restarting the app or check your internet connection.
                    </Text>
                    <TouchableOpacity 
                        style={{
                            backgroundColor: '#6366f1',
                            paddingHorizontal: 20,
                            paddingVertical: 12,
                            borderRadius: 8
                        }}
                        onPress={() => {
                            setError(null);
                            setLoading(true);
                            downloadModel(selectedModel);
                        }}
                    >
                        <Text style={{ color: 'white', fontWeight: '600' }}>Retry</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            ) : (
                <View style={{ flex: 1 }}>
                    {currentTab === 'chat' ? (
                        <View style={{ flex: 1, padding: 4 }}>
                            {context && <Chat context={context} selectedModel={selectedModel} onMenuPress={() => setShowSidebar(true)} />}
                        </View>
                    ) : (
                        renderModelsTab()
                    )}
                    
                    {showSidebar && (
                        <>
                            <TouchableOpacity
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                    zIndex: 999
                                }}
                                onPress={() => setShowSidebar(false)}
                            />
                            {renderSidebar()}
                        </>
                    )}
                </View>
            )}

            {/* Model Selector Modal */}
            <Modal
                visible={showModelSelector}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: '#e5e7eb'
                    }}>
                        <Text style={{ fontSize: 18, fontWeight: '600', color: '#1f2937' }}>
                            Select Model
                        </Text>
                        <TouchableOpacity onPress={() => setShowModelSelector(false)}>
                            <Ionicons name="close" size={24} color="#6b7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1, padding: 16 }}>
                        <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                            Choose a model based on your device capabilities and needs:
                        </Text>
                        
                        {AVAILABLE_MODELS.map((model) => {
                            const validation = validateModelSelection(model);
                            const isCurrentModel = model.id === selectedModel.id;
                            
                            return (
                                <TouchableOpacity
                                    key={model.id}
                                    style={{
                                        backgroundColor: isCurrentModel ? '#f0f9ff' : '#f8fafc',
                                        borderWidth: 1,
                                        borderColor: isCurrentModel ? '#0ea5e9' : '#e5e7eb',
                                        borderRadius: 12,
                                        padding: 16,
                                        marginBottom: 12,
                                        opacity: validation.valid ? 1 : 0.5
                                    }}
                                    onPress={() => validation.valid && switchModel(model)}
                                    disabled={!validation.valid}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <Text style={{ 
                                            fontSize: 16, 
                                            fontWeight: '600', 
                                            color: '#1f2937',
                                            flex: 1
                                        }}>
                                            {model.name}
                                            {model.recommended && (
                                                <Text style={{ color: '#059669', fontSize: 12, marginLeft: 8 }}>
                                                    ★ Recommended
                                                </Text>
                                            )}
                                        </Text>
                                        {isCurrentModel && (
                                            <Text style={{ color: '#0ea5e9', fontSize: 12, fontWeight: '600' }}>
                                                Current
                                            </Text>
                                        )}
                                    </View>
                                    
                                    <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
                                        {model.description}
                                    </Text>
                                    
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                            Size: {model.sizeGB}GB
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#6b7280' }}>
                                            Context: {model.maxParams}
                                        </Text>
                                    </View>
                                    
                                    {!validation.valid && (
                                        <Text style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>
                                            {validation.message}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaProvider>
    );
};
