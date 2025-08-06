import { initLlama, LlamaContext } from "llama.rn";

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

export const loadModel = async (modelPath: string) => {
    const context = await initLlama({
        model: modelPath,
        use_mlock: true,
        n_ctx: 131072,
        n_gpu_layers: 1, // > 0: enable Metal on iOS
        // embedding: true, // use embedding
    });

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

export const sendMessage = async (context: LlamaContext, message: string, onToken?: (token: string) => void) => {
    try {
        console.log("🚀 Starting completion for message:", message);
        console.log("⏱️  Starting token generation...");
        let tokenCount = 0;
        const startTime = Date.now();
        
        const msgResult = await context.completion(
            {
                messages: [
                    {
                        role: "user",
                        content: message,
                    },
                ],
                n_predict: 2048, // Increased to allow longer, more complete responses
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
