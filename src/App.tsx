import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, ChevronDown, Sparkles, Import } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import rehypeRaw from "rehype-raw"; // Allows raw HTML but sanitizes it
import rehypeSanitize from "rehype-sanitize"; // Sanitizes HTML to prevent XSS
import modelConfig from "./Model";
interface Message {
  role: "user" | "assistant";
  content: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to the bottom of the chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Highlight code blocks
  useEffect(() => {
    hljs.highlightAll();
  }, [messages]);

  // Sanitize user input to prevent XSS
  const sanitizeInput = (input: string): string => {
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  // Handle sending messages
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const sanitizedInput = sanitizeInput(input);
    const newMessage: Message = { role: "user", content: sanitizedInput };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(modelConfig.localhost, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelConfig.modelName,
          prompt: input,
          system: modelConfig.reset,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch response from Ollama");

      const reader = response.body?.getReader();
      let botMessage = "";
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += new TextDecoder().decode(value);

          // Split buffer by newlines and attempt to parse each line
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Save incomplete line back to buffer

          for (const line of lines) {
            try {
              const parsedChunk = JSON.parse(line);
              botMessage += parsedChunk.response;

              // Update the bot's message without removing the user's message
              setMessages((prevMessages) => {
                const lastMessage = prevMessages[prevMessages.length - 1];
                if (lastMessage.role === "assistant") {
                  // If the last message is from the bot, update it
                  return [
                    ...prevMessages.slice(0, -1),
                    { role: "assistant", content: botMessage },
                  ];
                } else {
                  // If the last message is from the user, add the bot's message
                  return [
                    ...prevMessages,
                    { role: "assistant", content: botMessage },
                  ];
                }
              });
            } catch (err) {
              console.error("Error parsing JSON chunk:", err);
            }
          }
        }
      }

      if (!botMessage.trim()) {
        botMessage = "I'm sorry, but I couldn't generate a response.";
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: botMessage },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: Could not fetch response." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
              BlackV
            </h1>
          </div>
          <button className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Chat Container */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`flex items-start space-x-4 ${
                  message.role === "assistant" ? "bg-gray-800" : ""
                } rounded-lg p-4`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    message.role === "assistant"
                      ? "bg-purple-600"
                      : "bg-blue-600"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <Bot className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 prose prose-invert max-w-none">
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw, rehypeSanitize]} // Sanitize HTML
                    components={{
                      code: ({
                        node,
                        inline,
                        className,
                        children,
                        ...props
                      }) => {
                        const match = /language-(\w+)/.exec(className || "");
                        return !inline && match ? (
                          <pre className="!bg-gray-950 rounded-lg p-4">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-800 p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send a message..."
              className="w-full p-4 pr-12 rounded-lg bg-gray-800 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="animate-spin">🌀</div>
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
