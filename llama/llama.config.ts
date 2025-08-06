import { initLlama, LlamaContext } from "llama.rn";
import * as FileSystem from 'expo-file-system';

export const stopWords = [
    "</s>",
    "<|end|>",
    "<|eot_id|>",
    "<|end_of_text|>",
    "<|im_end|>",
    "REDACTED_SPECIAL_TOKEN",
    "<|END_OF_TURN_TOKEN|>",
    "<|end_of_turn|>",
    "<|endoftext|>",
];

export const loadModel = async (modelPath: string, mmprojPath?: string) => {
    const context = await initLlama({
        model: modelPath,
        use_mlock: true,
        n_ctx: 131072,
        n_gpu_layers: 1, // > 0: enable Metal on iOS
        // embedding: true, // use embedding
    });

    // Try to initialize multimodal support if this is a multimodal model
    try {
        console.log("🔄 Attempting to initialize multimodal support...");
        if (mmprojPath) {
            console.log("📁 Using mmproj file:", mmprojPath);
            const multimodalInitialized = await context.initMultimodal({
                path: mmprojPath,
                use_gpu: true,
            });
            
            if (multimodalInitialized) {
                console.log("✅ Multimodal support initialized successfully");
                const support = await context.getMultimodalSupport();
                console.log("📊 Multimodal capabilities:", support);
            } else {
                console.log("ℹ️  Multimodal initialization failed");
            }
        } else {
            console.log("ℹ️  No mmproj file provided, skipping multimodal initialization");
        }
    } catch (error) {
        console.log("ℹ️  Multimodal initialization failed (this is normal for text-only models):", error);
    }

    return context;
};

// Clean response text by removing unwanted tokens
const cleanResponse = (text: string): string => {
    // Limit thinking content to first 200 characters to reduce token usage
    const limitedThinking = text.replace(/<think>(.*?)<\/think>/gs, (match, thinkingContent) => {
        if (thinkingContent.length > 200) {
            return `<think>${thinkingContent.substring(0, 200)}...</think>`;
        }
        return match;
    });
    
    return limitedThinking
        .replace(/<think>.*?<\/think>/gs, '') // Remove think tags and their content
        .replace(/REDACTED_SPECIAL_TOKEN/g, '') // Remove redacted tokens
        .replace(/<\|.*?\|>/g, '') // Remove any remaining special tokens
        .replace(/< \｜end_of_sentence\｜>/gi, '') // Remove end of sentence tokens
        .replace(/<\｜.*?end.*?\｜>/gi, '') // Remove any end-related tokens
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Normalize multiple newlines to double newlines
        .replace(/[ \t]+/g, ' ') // Normalize horizontal whitespace only
        .trim();
};

export const sendMessage = async (context: LlamaContext, message: string, onToken?: (token: string) => void, maxParams?: number, imageUri?: string) => {
    try {
        console.log("🚀 Starting completion for message:", message);
        if (imageUri) {
            console.log("🖼️  Processing image:", imageUri);
        }
        console.log("⏱️  Starting token generation...");
        let tokenCount = 0;
        const startTime = Date.now();
        
        // Prepare message content
        let messageContent: any = message;
        
        // If we have an image, format it for multimodal input
        if (imageUri) {
            console.log("🖼️  Processing image:", imageUri);
            try {
                // Use image path directly (no base64 conversion needed)
                messageContent = [
                    {
                        type: "text",
                        text: message || "What's in this image?"
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: imageUri
                        }
                    }
                ];
                console.log("📝 Multimodal message with image, content types:", messageContent.map((item: any) => item.type));
            } catch (error) {
                console.error("❌ Error processing image:", error);
                // Fallback to just the image path
                messageContent = `${message || "What's in this image?"} [IMAGE: ${imageUri}]`;
            }
        } else {
            console.log("📝 Text-only message content:", message);
        }
        
        console.log("🔄 Starting model completion...");
        const msgResult = await context.completion(
            {
                messages: [
                    {
                        role: "user",
                        content: messageContent,
                    },
                ],
                n_predict: imageUri ? 64 : (maxParams || 2048), // Shorter responses for images
                stop: stopWords,
                temperature: 0.7,
                top_p: 0.9,

            },
            (data) => {
                // Log tokens as they come out in real-time
                if (data.token) {
                    tokenCount++;
                    const elapsed = Date.now() - startTime;
                    console.log(`🔄 TOKEN #${tokenCount} (${elapsed}ms): "${data.token}"`);
                    
                    // Call the streaming callback if provided
                    if (onToken) {
                        onToken(data.token);
                    }
                }
            },
        );

        const endTime = Date.now();
        const totalTime = endTime - startTime;
        console.log(`✅ Completion finished in ${totalTime}ms with ${tokenCount} tokens`);
        console.log("Response text:", msgResult.text);
        
        const cleanedText = cleanResponse(msgResult.text || "");
        console.log("Cleaned response:", cleanedText);
        
        return cleanedText || "No response generated";
    } catch (error) {
        console.error("Error in sendMessage:", error);
        throw error;
    }
};
