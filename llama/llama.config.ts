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
    return text
        .replace(/<think>.*?<\/think>/gs, '') // Remove think tags
        .replace(/REDACTED_SPECIAL_TOKEN/g, '') // Remove redacted tokens
        .replace(/<\|.*?\|>/g, '') // Remove any remaining special tokens
        .replace(/< \｜end_of_sentence\｜>/gi, '') // Remove end of sentence tokens
        .replace(/<\｜.*?end.*?\｜>/gi, '') // Remove any end-related tokens
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
};

export const sendMessage = async (context: LlamaContext, message: string) => {
    try {
        console.log("Starting completion for message:", message);
        
        const msgResult = await context.completion(
            {
                messages: [
                    {
                        role: "user",
                        content: message,
                    },
                ],
                n_predict: 1000,
                stop: stopWords,
                temperature: 0.7,
                top_p: 0.9,
            },
            (data) => {
                // Log progress if needed
                if (data.token) {
                    console.log("Token received:", data.token);
                }
            },
        );

        console.log("Completion result:", msgResult);
        console.log("Response text:", msgResult.text);
        
        const cleanedText = cleanResponse(msgResult.text || "");
        console.log("Cleaned response:", cleanedText);
        
        return cleanedText || "No response generated";
    } catch (error) {
        console.error("Error in sendMessage:", error);
        throw error;
    }
};
