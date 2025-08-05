import { sendMessage } from "@/llama/llama.config";
import { LlamaContext } from "llama.rn";
import React, { useCallback, useState } from "react";
import { GiftedChat, IMessage } from "react-native-gifted-chat";
import { ActivityIndicator, Text, View } from "react-native";

// Simple ID generator to avoid uuid crypto issues
let messageIdCounter = 0;
const generateId = () => `msg_${Date.now()}_${++messageIdCounter}`;

export default ({ context }: { context: LlamaContext }) => {
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createCompletion = async (message: string) => {
        try {
            setIsLoading(true);
            setError(null);
            console.log("Creating completion for:", message);
            
            const response = await sendMessage(context, message);
            console.log("Received response:", response);
            
            if (response && response.trim()) {
                return response;
            } else {
                throw new Error("Empty response from AI");
            }
        } catch (err) {
            console.error("Error in createCompletion:", err);
            setError(err instanceof Error ? err.message : "Unknown error occurred");
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const onSend = useCallback(async (newMessages: IMessage[] = []) => {
        const userMessage = newMessages[0];
        if (!userMessage?.text) return;

        // Add user message to chat
        setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));

        // Create AI response
        const aiResponse = await createCompletion(userMessage.text);
        
        if (aiResponse) {
            const aiMessage: IMessage = {
                _id: generateId(),
                text: aiResponse,
                createdAt: new Date(),
                user: {
                    _id: 2,
                    name: 'AI',
                    avatar: '🤖',
                },
            };
            
            setMessages(previousMessages => GiftedChat.append(previousMessages, [aiMessage]));
        }
    }, [context]);

    return (
        <View style={{ flex: 1 }}>
            <GiftedChat
                messages={messages}
                onSend={onSend}
                user={{
                    _id: 1,
                }}
                placeholder="Type a message..."
                alwaysShowSend
                infiniteScroll
            />
            
            {isLoading && (
                <View style={{
                    position: 'absolute',
                    bottom: 80,
                    left: 20,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    padding: 10,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center'
                }}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={{ color: '#fff', marginLeft: 10, fontSize: 14 }}>
                        AI is thinking...
                    </Text>
                </View>
            )}
            
            {error && (
                <View style={{
                    position: 'absolute',
                    bottom: 80,
                    left: 20,
                    right: 20,
                    backgroundColor: 'rgba(255,0,0,0.8)',
                    padding: 10,
                    borderRadius: 10
                }}>
                    <Text style={{ color: '#fff', fontSize: 14 }}>
                        Error: {error}
                    </Text>
                </View>
            )}
        </View>
    );
};
