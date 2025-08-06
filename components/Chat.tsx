import { sendMessage } from "@/llama/llama.config";
import { LlamaContext } from "llama.rn";
import React, { useCallback, useState, useRef, useEffect } from "react";
import { 
    ActivityIndicator, 
    Text, 
    View, 
    TextInput, 
    TouchableOpacity, 
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
    Animated,
    Modal,
    Alert
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get('window');

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
}

interface ModelConfig {
    id: string;
    name: string;
    description: string;
    url: string;
    sizeGB: number;
    maxParams: number;
    recommended: boolean;
}

// Simple ID generator to avoid uuid crypto issues
let messageIdCounter = 0;
const generateId = () => `msg_${Date.now()}_${++messageIdCounter}`;

// Default system prompt
const getSystemPrompt = (model: ModelConfig) => {
    const basePrompt = `You are a helpful AI assistant.

CRITICAL RULES:
- Only respond to what the user actually said, not what you think they might want
- NEVER mention platform features, tools, or getting started guides unless the user specifically asks about them

You should be friendly and helpful, but never create problems or scenarios that don't exist. You are NOT a user asking questions - you are the assistant answering them.`;

    // Add model-specific instructions
    switch (model.id) {
        case 'qwen3-1.7b':
            return basePrompt.replace('You are a helpful AI assistant', 'You are Qwen, a helpful AI assistant');
        case 'qwen2.5-vl-3b':
            return basePrompt.replace('You are a helpful AI assistant', 'You are Qwen2.5-VL, a helpful AI assistant that can see and understand images');
        case 'phi-3-mini':
            return basePrompt.replace('You are a helpful AI assistant', 'You are Phi-3, a helpful AI assistant');
        case 'llama3-1b':
            return basePrompt.replace('You are a helpful AI assistant', 'You are Llama, a helpful AI assistant');
        default:
            return basePrompt;
    }
};

const DEFAULT_SYSTEM_PROMPT = getSystemPrompt({ id: 'qwen3-1.7b' } as ModelConfig);

export default ({ context, selectedModel, onMenuPress }: { context: LlamaContext; selectedModel: ModelConfig; onMenuPress?: () => void }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [systemPrompt, setSystemPrompt] = useState(getSystemPrompt(selectedModel));
    const scrollViewRef = useRef<ScrollView>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Using in-memory storage for system prompt
    const saveSystemPrompt = (prompt: string) => {
        setSystemPrompt(prompt);
        setShowSettings(false);
    };

    const resetSystemPrompt = () => {
        Alert.alert(
            'Reset System Prompt',
            'Are you sure you want to reset to the default prompt?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Reset', 
                    style: 'destructive',
                    onPress: () => saveSystemPrompt(getSystemPrompt(selectedModel))
                }
            ]
        );
    };

    // Welcome message
    useEffect(() => {
        const welcomeMessage: Message = {
            id: generateId(),
            text: `Welcome to ${selectedModel.name}! I'm here to help you with any questions or tasks. What would you like to work on today?`,
            isUser: false,
            timestamp: new Date()
        };
        setMessages([welcomeMessage]);
        
        // Fade in animation
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    const createCompletion = async (message: string) => {
        try {
            setIsLoading(true);
            setError(null);
            
            // For simple greetings, don't include conversation history to prevent hallucination
            const isSimpleGreeting = /^(hey|hello|hi|sup|yo|greetings)$/i.test(message.trim());
            
            let fullPrompt;
            if (isSimpleGreeting) {
                // For greetings, use only the system prompt and current message
                fullPrompt = `${systemPrompt}\n\nUser: ${message}`;
            } else {
                // For other messages, include recent conversation history
                const recentMessages = messages.slice(-4);
                const conversationHistory = recentMessages
                    .map(msg => `${msg.isUser ? 'User' : 'Assistant'}: ${msg.text}`)
                    .join('\n');
                fullPrompt = `${systemPrompt}\n\n${conversationHistory}\nUser: ${message}`;
            }
            
            // Create a streaming message that updates in real-time
            const streamingMessageId = generateId();
            const streamingMessage: Message = {
                id: streamingMessageId,
                text: "",
                isUser: false,
                timestamp: new Date()
            };
            
            // Add the streaming message and get its index
            setMessages(prev => [...prev, streamingMessage]);
            
            const response = await sendMessage(context, fullPrompt, (token: string) => {
                // Update the streaming message in real-time
                setMessages(prev => {
                    const newMessages = [...prev];
                    // Find the streaming message by ID
                    const streamingIndex = newMessages.findIndex(msg => msg.id === streamingMessageId);
                    if (streamingIndex !== -1) {
                        newMessages[streamingIndex] = {
                            ...newMessages[streamingIndex],
                            text: newMessages[streamingIndex].text + token
                        };
                    }
                    return newMessages;
                });
            }, selectedModel.maxParams);
            
            if (response && response.trim()) {
                // Update the streaming message with the final cleaned response
                setMessages(prev => {
                    const newMessages = [...prev];
                    const streamingIndex = newMessages.findIndex(msg => msg.id === streamingMessageId);
                    if (streamingIndex !== -1) {
                        newMessages[streamingIndex] = {
                            ...newMessages[streamingIndex],
                            text: response
                        };
                    }
                    return newMessages;
                });
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

    const handleSend = async () => {
        if (!inputText.trim() || isLoading) return;

        const userMessage: Message = {
            id: generateId(),
            text: inputText.trim(),
            isUser: true,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText("");

        // Create AI response (streaming is handled in createCompletion)
        await createCompletion(userMessage.text);
    };

    const renderMarkdownText = (text: string) => {
        // Split text by markdown patterns
        const parts = text.split(/(\*\*.*?\*\*|###.*?(?=\n|$))/g);
        
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                // Bold text
                const boldText = part.slice(2, -2);
                return (
                    <Text key={index} style={{ 
                        color: '#1f2937', 
                        fontWeight: 'bold' 
                    }}>
                        {boldText}
                    </Text>
                );
            } else if (part.startsWith('###')) {
                // Header
                const headerText = part.slice(3).trim();
                return (
                    <Text key={index} style={{ 
                        color: '#1f2937', 
                        fontWeight: 'bold',
                        fontSize: 18,
                        marginTop: 16,
                        marginBottom: 8
                    }}>
                        {headerText}
                    </Text>
                );
            } else if (part.trim() === '---') {
                // Horizontal rule
                return (
                    <View key={index} style={{
                        height: 1,
                        backgroundColor: '#e5e7eb',
                        marginVertical: 12
                    }} />
                );
            } else if (part.trim() === '') {
                // Empty line - add spacing
                return <Text key={index} style={{ height: 8 }} />;
            } else {
                // Regular text
                return (
                    <Text key={index} style={{ color: '#1f2937' }}>
                        {part}
                    </Text>
                );
            }
        });
    };

    const renderTextWithThinking = (text: string) => {
        // Check if <think> appears in the text
        const thinkIndex = text.indexOf('<think>');
        
        if (thinkIndex === -1) {
            // No thinking content, render all text with markdown
            return renderMarkdownText(text);
        }
        
        // Split text into before-thinking and thinking parts
        const beforeThinking = text.substring(0, thinkIndex);
        const thinkingAndAfter = text.substring(thinkIndex);
        
        // Remove the <think> tag from the thinking content
        const thinkingContent = thinkingAndAfter.replace(/<\/?think>/g, '');
        
        return (
            <>
                {beforeThinking && renderMarkdownText(beforeThinking)}
                <Text style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                    {thinkingContent}
                </Text>
            </>
        );
    };

    const scrollToBottom = () => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const renderUserMessage = (message: Message) => (
        <View key={message.id} style={{
            alignSelf: 'flex-end',
            marginVertical: 8,
            marginHorizontal: 16,
            maxWidth: width * 0.75
        }}>
            <View style={{
                backgroundColor: '#6366f1',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 20,
                borderBottomRightRadius: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2
            }}>
                <Text style={{
                    color: '#ffffff',
                    fontSize: 16,
                    lineHeight: 22
                }}>
                    {message.text}
                </Text>
            </View>
            <Text style={{
                fontSize: 12,
                color: '#9ca3af',
                textAlign: 'right',
                marginTop: 4,
                marginRight: 4
            }}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
        </View>
    );

    const renderAIMessage = (message: Message) => (
        <Animated.View 
            key={message.id} 
            style={{
                opacity: fadeAnim,
                marginVertical: 8,
                marginHorizontal: 16,
                maxWidth: width * 0.85
            }}
        >
            <View style={{
                backgroundColor: '#f8fafc',
                padding: 16,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 1
            }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 8
                }}>
                    <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: '#6366f1',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 8
                    }}>
                        <Ionicons name="sparkles" size={14} color="#ffffff" />
                    </View>
                    <Text style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: '#374151'
                    }}>
                        Qwen AI
                    </Text>
                </View>
                <Text style={{
                    fontSize: 16,
                    lineHeight: 24,
                    color: '#1f2937'
                }}>
                    {renderTextWithThinking(message.text)}
                </Text>
                <Text style={{
                    fontSize: 12,
                    color: '#9ca3af',
                    marginTop: 8
                }}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        </Animated.View>
    );

    return (
        <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Header */}
            <SafeAreaView style={{ backgroundColor: '#ffffff' }}>
                <View style={{
                    backgroundColor: '#ffffff',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#e5e7eb',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}>
                    <TouchableOpacity 
                        style={{ marginRight: 12 }}
                        onPress={onMenuPress}
                    >
                        <Ionicons name="menu" size={24} color="#6b7280" />
                    </TouchableOpacity>
                    <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#6366f1',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12
                    }}>
                        <Ionicons name="chatbubbles" size={18} color="#ffffff" />
                    </View>
                    <View>
                        <Text style={{
                            fontSize: 18,
                            fontWeight: '600',
                            color: '#1f2937'
                        }}>
                            {selectedModel.name}
                        </Text>
                        <Text style={{
                            fontSize: 12,
                            color: '#6b7280'
                        }}>
                            AI Assistant • {selectedModel.sizeGB}GB
                        </Text>
                    </View>
                </View>
                <TouchableOpacity 
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#f3f4f6',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                    onPress={() => setShowSettings(true)}
                >
                    <Ionicons name="ellipsis-horizontal" size={18} color="#6b7280" />
                </TouchableOpacity>
                    </View>
                </SafeAreaView>

            {/* Messages */}
            <ScrollView
                ref={scrollViewRef}
                style={{ flex: 1, backgroundColor: '#ffffff' }}
                contentContainerStyle={{ paddingVertical: 8 }}
                showsVerticalScrollIndicator={false}
            >
                {messages.map(message => 
                    message.isUser ? renderUserMessage(message) : renderAIMessage(message)
                )}
                
                {isLoading && (
                    <View style={{
                        marginVertical: 8,
                        marginHorizontal: 16,
                        maxWidth: width * 0.85
                    }}>
                        <View style={{
                            backgroundColor: '#f8fafc',
                            padding: 16,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: '#e5e7eb',
                            flexDirection: 'row',
                            alignItems: 'center'
                        }}>
                            <View style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: '#6366f1',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 8
                            }}>
                                <Ionicons name="sparkles" size={14} color="#ffffff" />
                            </View>
                            <Text style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: '#374151',
                                marginRight: 8
                            }}>
                                Qwen AI
                            </Text>
                            <ActivityIndicator size="small" color="#6366f1" />
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Error Message */}
            {error && (
                <View style={{
                    backgroundColor: '#fef2f2',
                    borderWidth: 1,
                    borderColor: '#fecaca',
                    margin: 16,
                    padding: 12,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center'
                }}>
                    <Ionicons name="alert-circle" size={16} color="#ef4444" style={{ marginRight: 8 }} />
                    <Text style={{
                        fontSize: 14,
                        color: '#dc2626',
                        flex: 1
                    }}>
                        {error}
                    </Text>
                </View>
            )}

            {/* Input Area */}
            <View style={{
                backgroundColor: '#ffffff',
                borderTopWidth: 1,
                borderTopColor: '#e5e7eb',
                paddingHorizontal: 16,
                paddingVertical: 12
            }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    backgroundColor: '#f9fafb',
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    paddingHorizontal: 16,
                    paddingVertical: 8
                }}>
                    <TextInput
                        style={{
                            flex: 1,
                            fontSize: 16,
                            color: '#1f2937',
                            maxHeight: 100,
                            paddingVertical: 8
                        }}
                        placeholder="Type a message..."
                        placeholderTextColor="#9ca3af"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        onSubmitEditing={handleSend}
                        blurOnSubmit={false}
                    />
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={!inputText.trim() || isLoading}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: inputText.trim() && !isLoading ? '#6366f1' : '#e5e7eb',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginLeft: 8
                        }}
                    >
                        <Ionicons 
                            name="send" 
                            size={18} 
                            color={inputText.trim() && !isLoading ? '#ffffff' : '#9ca3af'} 
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Settings Modal */}
            <Modal
                visible={showSettings}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
                    {/* Settings Header */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: '#e5e7eb'
                    }}>
                        <Text style={{
                            fontSize: 18,
                            fontWeight: '600',
                            color: '#1f2937'
                        }}>
                            System Prompt Settings
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowSettings(false)}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: '#f3f4f6',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                        >
                            <Ionicons name="close" size={18} color="#6b7280" />
                        </TouchableOpacity>
                    </View>

                    {/* Settings Content */}
                    <ScrollView style={{ flex: 1, padding: 16 }}>
                        <Text style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: '#1f2937',
                            marginBottom: 8
                        }}>
                            Customize AI Behavior
                        </Text>
                        <Text style={{
                            fontSize: 14,
                            color: '#6b7280',
                            marginBottom: 16,
                            lineHeight: 20
                        }}>
                            Modify the system prompt to change how the AI responds. This will affect all future conversations.
                        </Text>

                        <TextInput
                            style={{
                                borderWidth: 1,
                                borderColor: '#e5e7eb',
                                borderRadius: 12,
                                padding: 16,
                                fontSize: 14,
                                color: '#1f2937',
                                backgroundColor: '#f9fafb',
                                minHeight: 200,
                                textAlignVertical: 'top'
                            }}
                            placeholder="Enter your custom system prompt..."
                            placeholderTextColor="#9ca3af"
                            value={systemPrompt}
                            onChangeText={setSystemPrompt}
                            multiline
                            textAlignVertical="top"
                        />

                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginTop: 16
                        }}>
                            <TouchableOpacity
                                onPress={resetSystemPrompt}
                                style={{
                                    paddingHorizontal: 16,
                                    paddingVertical: 8,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: '#ef4444'
                                }}
                            >
                                <Text style={{
                                    color: '#ef4444',
                                    fontSize: 14,
                                    fontWeight: '500'
                                }}>
                                    Reset to Default
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => saveSystemPrompt(systemPrompt)}
                                style={{
                                    paddingHorizontal: 24,
                                    paddingVertical: 8,
                                    borderRadius: 8,
                                    backgroundColor: '#6366f1'
                                }}
                            >
                                <Text style={{
                                    color: '#ffffff',
                                    fontSize: 14,
                                    fontWeight: '600'
                                }}>
                                    Save Changes
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </KeyboardAvoidingView>
    );
};
