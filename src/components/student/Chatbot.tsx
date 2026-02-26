"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiCall } from "@/lib/api";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  citations?: Array<{
    subject: string;
    subjectName: string;
    year: number;
    file_type: string;
  }>;
  // New fields for exam-style answers
  markingPoints?: Array<{ point: string; marks: number }>;
  commonMistakes?: string[];
  confidenceScore?: number;
  coveragePercentage?: number;
  lowConfidence?: boolean;
  responseType?: "smalltalk" | "paper_lookup" | "exam_question";
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      type: "assistant",
      content: "Hi! I'm your study assistant. Ask me questions about your past papers and I'll find relevant sources for you. 📚",
      timestamp: new Date(),
      responseType: "smalltalk",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await apiCall("/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input,
          limit: 3,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response: " + response.statusText);
      }

      const data = await response.json();

      let assistantContent = "";
      let citations = [];
      let markingPoints: Array<{ point: string; marks: number }> | undefined;
      let commonMistakes: string[] | undefined;
      let confidenceScore: number | undefined;
      let coveragePercentage: number | undefined;
      let lowConfidence: boolean | undefined;
      let responseType: "smalltalk" | "paper_lookup" | "exam_question" = data.type || "exam_question";

      // Handle three response types from backend
      if (data.type === "smalltalk") {
        // Case A: Smalltalk - just show the response
        assistantContent = data.answer;
      } else if (data.type === "paper_lookup") {
        // Case B: Navigation - format paper list
        if (data.results && data.results.length > 0) {
          assistantContent =
            data.answer +
            "\n\n" +
            data.results
              .map(
                (result: any) =>
                  `📚 **${result.subject} ${result.year}** (${result.level})\n` +
                  Object.entries(result.sessions)
                    .map(
                      ([session, s]: [string, any]) =>
                        `  • Session ${session}:\n` +
                        Object.entries(s.papers)
                          .map(
                            ([paper, p]: [string, any]) =>
                              `    - Paper ${paper}: ${Object.keys(p.files).join(", ")}`
                          )
                          .join("\n")
                    )
                    .join("\n")
              )
              .join("\n\n");
        } else {
          assistantContent = "No papers found for your query.";
        }
      } else {
        // Case C: Exam question - show generated answer with citations and marking points
        if (!data?.answer) {
          throw new Error("Invalid response format");
        }
        
        assistantContent = data.answer;
        citations = (data.citations || []).slice(0, 3).map((c: any) => ({
          subject: c.subject,
          subjectName: c.subjectName,
          year: c.year,
          file_type: c.file_type,
        }));
        
        // Extract new fields for exam answers
        markingPoints = data.marking_points;
        commonMistakes = data.common_mistakes;
        confidenceScore = data.confidence_score;
        coveragePercentage = data.coverage_percentage;
        lowConfidence = data.low_confidence;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: assistantContent,
        timestamp: new Date(),
        citations: citations.length > 0 ? citations : undefined,
        markingPoints,
        commonMistakes,
        confidenceScore,
        coveragePercentage,
        lowConfidence,
        responseType,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceBadgeColor = (score: number | undefined) => {
    if (score === undefined) return "bg-gray-200";
    if (score >= 0.7) return "bg-green-200 text-green-800";
    if (score >= 0.5) return "bg-yellow-200 text-yellow-800";
    return "bg-red-200 text-red-800";
  };

  const getConfidenceText = (score: number | undefined) => {
    if (score === undefined) return "N/A";
    if (score >= 0.7) return `High (${Math.round(score * 100)}%)`;
    if (score >= 0.5) return `Medium (${Math.round(score * 100)}%)`;
    return `Low (${Math.round(score * 100)}%)`;
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
        {/* Header - Centered with mobile menu space */}
        <div className="px-6 py-5 border-b border-gray-200 bg-white shadow-sm flex items-center justify-center">
          <div className="text-center max-w-2xl">
            <h1 className="font-bold text-gray-900 text-2xl">Study Assistant</h1>
            <p className="text-sm text-gray-600 mt-1">
              Ask questions about your past papers and get instant answers
            </p>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xl px-4 py-3 rounded-lg ${
                  msg.type === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-white border border-gray-200 text-gray-900 rounded-bl-none"
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>

                {/* Low Confidence Warning */}
                {msg.lowConfidence && (
                  <div className="mt-3 pt-3 border-t border-yellow-300 bg-yellow-50 p-2 rounded text-xs text-yellow-800">
                    ⚠️ Low confidence answer - results may not be reliable. Try rephrasing or check the sources.
                  </div>
                )}

                {/* Marking Points (Exam-style) */}
                {msg.markingPoints && msg.markingPoints.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300 space-y-2">
                    <p className="font-semibold text-xs text-gray-700">📌 Marking Points:</p>
                    {msg.markingPoints.map((item, idx) => {
                      const point = typeof item === 'string' ? item : item.point;
                      const marks = typeof item === 'object' && item.marks ? item.marks : 1;
                      return (
                        <div key={idx} className="text-xs bg-blue-50 p-2 rounded border-l-2 border-blue-500 flex justify-between items-start">
                          <p className="text-gray-700 flex-1">• {point}</p>
                          <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs font-bold shrink-0">
                            {marks}M
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Common Mistakes (Exam-style) */}
                {msg.commonMistakes && msg.commonMistakes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300 space-y-2">
                    <p className="font-semibold text-xs text-gray-700">⚡ Common Mistakes:</p>
                    {msg.commonMistakes.map((mistake, idx) => (
                      <div key={idx} className="text-xs bg-red-50 p-2 rounded border-l-2 border-red-500">
                        <p className="text-gray-700">✗ {mistake}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Confidence & Coverage Metrics */}
                {(msg.confidenceScore !== undefined || msg.coveragePercentage !== undefined) && (
                  <div className="mt-3 pt-3 border-t border-gray-300 flex gap-2 flex-wrap">
                    {msg.confidenceScore !== undefined && (
                      <span className={`text-xs px-2 py-1 rounded ${getConfidenceBadgeColor(msg.confidenceScore)}`}>
                        Confidence: {getConfidenceText(msg.confidenceScore)}
                      </span>
                    )}
                    {msg.coveragePercentage !== undefined && (
                      <span className="text-xs px-2 py-1 rounded bg-indigo-200 text-indigo-800">
                        Coverage: {Math.round(msg.coveragePercentage)}%
                      </span>
                    )}
                  </div>
                )}

                {/* Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300 space-y-2">
                    <p className="font-semibold text-xs text-gray-700">📖 Sources:</p>
                    {msg.citations.map((cite, idx) => (
                      <div key={idx} className="text-xs bg-gray-100 p-2 rounded">
                        <p className="font-semibold text-gray-700">
                          {cite.subjectName || cite.subject} ({cite.year})
                        </p>
                        <p className="text-gray-600">{cite.file_type}</p>
                      </div>
                    ))}
                  </div>
                )}

                <p
                  className={`text-xs mt-2 ${
                    msg.type === "user" ? "text-blue-100" : "text-gray-500"
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg rounded-bl-none">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {/* Input Area */}
        <div className="px-6 py-4 bg-white border-t border-gray-200 shadow-lg">
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
            <Button
              onClick={handleSend}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
            >
              {loading ? "..." : "Send"}
            </Button>
          </div>
        </div>
      </div>

      {/* Chat History Sidebar on RIGHT */}
      <div className="w-64 bg-gradient-to-b from-blue-50 to-indigo-50 border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 text-sm">Chat History</h2>
          <p className="text-xs text-gray-500 mt-1">Your recent questions</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className="p-3 rounded-lg hover:bg-blue-100 cursor-pointer transition text-sm group"
            >
              {msg.type === "user" ? (
                <>
                  <p className="text-gray-900 font-semibold line-clamp-2 group-hover:text-blue-700">
                    {msg.content}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-600 line-clamp-2 group-hover:text-blue-700">
                    {msg.content}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Assistant</p>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200 bg-white">
          <button className="w-full px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition border border-blue-200">
            + New Chat
          </button>
        </div>
      </div>
    </div>
  );
}
