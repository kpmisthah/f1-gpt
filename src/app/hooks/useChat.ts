"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
}

const INITIAL_MESSAGE: Message = {
    id: "welcome",
    role: "assistant",
    content:
        "🏎️ Hey there! I'm **F1 GPT** — your Formula 1 expert. Ask me anything about drivers, teams, race results, championships, or F1 history!",
};

export function useChat() {
    const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Focus input on load
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
        };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput("");
        setIsLoading(true);

        const assistantId = (Date.now() + 1).toString();
        setMessages((prev) => [
            ...prev,
            { id: assistantId, role: "assistant", content: "" },
        ]);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: updatedMessages
                        .filter((m) => m.id !== "welcome")
                        .map((m) => ({
                            role: m.role,
                            content: m.content,
                        })),
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to get response");
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                let fullContent = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const text = decoder.decode(value, { stream: true });
                    fullContent += text;

                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === assistantId ? { ...msg, content: fullContent } : msg
                        )
                    );
                }
            }
        } catch (error) {
            console.error("Error:", error);
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantId
                        ? {
                            ...msg,
                            content: "❌ Sorry, something went wrong. Please try again!",
                        }
                        : msg
                )
            );
        } finally {
            setIsLoading(false);
        }
    };

    return {
        messages,
        input,
        isLoading,
        messagesEndRef,
        inputRef,
        setInput,
        handleSubmit,
    };
}
