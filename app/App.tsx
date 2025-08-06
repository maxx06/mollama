import React, { useEffect, useState } from "react";
import * as FileSystem from "expo-file-system";
import { loadModel } from "../llama/llama.config";
import Chat from "@/components/Chat";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { LlamaContext } from "llama.rn";
import { Text, View, ActivityIndicator } from "react-native";

const downloadLink =
    "https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q5_K_M.gguf";

export default () => {
    const [context, setContext] = useState<LlamaContext | null | undefined>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState("Initializing...");

    const downloadResumable = FileSystem.createDownloadResumable(
        downloadLink,
        FileSystem.documentDirectory + "model.gguf",
        {},
        (downloadProgress) => {
            const progress = downloadProgress.totalBytesWritten /
                downloadProgress.totalBytesExpectedToWrite;
            console.log(progress);
            setStatus(`Downloading: ${(progress * 100).toFixed(1)}%`);
        },
    );

    const downloadModel = async () => {
        try {
            setStatus("Checking for existing model...");
            const modelPath = FileSystem.documentDirectory + "model.gguf";
            console.log("Looking for model at:", modelPath);
            console.log("Document directory:", FileSystem.documentDirectory);
            
            // List all files in document directory to see what's there
            try {
                const docDir = FileSystem.documentDirectory;
                if (docDir) {
                    const files = await FileSystem.readDirectoryAsync(docDir);
                    console.log("Files in document directory:", files);
                } else {
                    console.log("Document directory is null");
                }
            } catch (e) {
                console.log("Could not read directory:", e);
            }
            
            const fileInfo = await FileSystem.getInfoAsync(modelPath);
            console.log("File info:", fileInfo);
            const isExists = fileInfo.exists;
            
            if (isExists) {
                setStatus("Loading existing model...");
                console.log("Model exists, loading from:", modelPath);
                try {
                    const context = await loadModel(modelPath);
                    console.log("Model loaded successfully!");
                    setContext(context);
                    setLoading(false);
                    return;
                } catch (loadError) {
                    console.error("Error loading existing model:", loadError);
                    console.log("Will re-download model...");
                    // Continue to download if loading fails
                }
            }

            setStatus("Downloading model...");
            const res = await downloadResumable.downloadAsync();
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

    useEffect(() => {
        downloadModel();
    }, []);

    if (error) {
        return (
            <SafeAreaProvider>
                <SafeAreaView style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, color: 'red', textAlign: 'center', marginBottom: 20 }}>
                        Error: {error}
                    </Text>
                    <Text style={{ fontSize: 14, color: 'gray', textAlign: 'center' }}>
                        Try restarting the app or check your internet connection.
                    </Text>
                </SafeAreaView>
            </SafeAreaProvider>
        );
    }

    if (loading) {
        return (
            <SafeAreaProvider>
                <SafeAreaView style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#007AFF" style={{ marginBottom: 20 }} />
                    <Text style={{ fontSize: 16, textAlign: 'center' }}>
                        {status}
                    </Text>
                </SafeAreaView>
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            <SafeAreaView style={{ flex: 1, padding: 4 }}>
                {context && <Chat context={context} />}
            </SafeAreaView>
        </SafeAreaProvider>
    );
};
