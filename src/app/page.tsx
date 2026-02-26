"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Markdown from "react-markdown";

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

export default function Home() {
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

    // Create a placeholder for the assistant's response
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

      // Stream the response
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
              content:
                "❌ Sorry, something went wrong. Please try again!",
            }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      {/* Background decorations */}
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      <div className="bg-grid" />

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="logo-title">F1 GPT</h1>
              <p className="logo-subtitle">Formula 1 AI Assistant</p>
            </div>
          </div>
          <div className="status-badge">
            <span className="status-dot" />
            Online
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="chat-area">
        <div className="messages-container">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message-row ${message.role === "user" ? "message-user" : "message-assistant"
                }`}
            >
              {message.role === "assistant" && (
                <div className="avatar avatar-bot">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </div>
              )}
              <div
                className={`message-bubble ${message.role === "user" ? "bubble-user" : "bubble-assistant"
                  }`}
              >
                <div className="message-content">
                  {message.content ? (
                    <Markdown>{message.content}</Markdown>
                  ) : (
                    <div className="typing-indicator">
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </div>
              </div>
              {message.role === "user" && (
                <div className="avatar avatar-user">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="input-area">
        <form onSubmit={handleSubmit} className="input-form">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about F1 drivers, teams, races..."
            className="chat-input"
            disabled={isLoading}
            id="chat-input"
          />
          <button
            type="submit"
            className="send-button"
            disabled={isLoading || !input.trim()}
            id="send-button"
          >
            {isLoading ? (
              <div className="spinner" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>
        <p className="disclaimer">
          F1 GPT can make mistakes. Verify important F1 facts independently.
        </p>
      </footer>
    </div>
  );
}
