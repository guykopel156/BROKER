import React, { useState, useRef, useEffect, useCallback, type ReactElement } from 'react';

import { authFetch } from '../services/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function ChatWidget(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(async (): Promise<void> => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('broker-token');
      const response = await authFetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-10),
        }),
      });

      const data = await response.json();
      const reply = data.data?.reply ?? data.error?.message ?? 'No response';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I could not connect to the server.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 h-[500px] bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-profit animate-pulse" />
              <span className="text-sm font-semibold">Claude Assistant</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="text-3xl">🤖</div>
                <p className="text-sm text-text-muted dark:text-dark-text-muted text-center">
                  Your AI trading assistant
                </p>
                <div className="flex flex-col gap-2 w-full">
                  {[
                    { label: '📊 What should I buy now?', msg: 'What stocks should I buy right now with my current budget? Answer in bullet points.' },
                    { label: '🎯 Explain your strategy', msg: 'Explain your current trading strategy in clear bullet points: what are you looking for, why these stocks, what signals matter, and what is your plan for my portfolio?' },
                    { label: '💰 Show my portfolio', msg: 'Show me my current portfolio and positions in bullet points with numbers.' },
                    { label: '🔍 Run new analysis', msg: 'Run a new analysis cycle now' },
                    { label: '📈 Best growth stocks?', msg: 'What are the best growth stocks I can afford right now? List each one in bullet points with price, why its good, and how many shares I can buy.' },
                    { label: '🧠 Explain recommendations', msg: 'Explain each of your current recommendations in bullet points: stock name, price, why you picked it, what strategy, and what is the expected outcome.' },
                  ].map((option) => (
                    <button
                      key={option.label}
                      onClick={() => { setInput(option.msg); }}
                      className="w-full text-left px-3 py-2 text-xs rounded-lg border border-border dark:border-dark-border bg-surface dark:bg-dark-surface hover:bg-surface-tertiary dark:hover:bg-dark-surface-tertiary text-text-secondary dark:text-dark-text-secondary transition-colors"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-sm'
                      : 'bg-surface-tertiary dark:bg-dark-surface-tertiary text-text-primary dark:text-dark-text-primary rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div
                      className="chat-content whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: msg.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
                          .replace(/^[•-] (.+)$/gm, '<div class="flex gap-1.5 ml-1"><span class="text-primary">•</span><span>$1</span></div>')
                          .replace(/^#{1,3} (.+)$/gm, '<div class="font-bold text-text-primary dark:text-dark-text-primary mt-2 mb-1">$1</div>')
                      }}
                    />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-surface-tertiary dark:bg-dark-surface-tertiary px-3 py-2 rounded-xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-border dark:border-dark-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about stocks, portfolio..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-border dark:border-dark-border bg-surface dark:bg-dark-surface text-text-primary dark:text-dark-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-dark-surface-tertiary text-dark-text-primary rotate-0'
            : 'bg-primary text-white hover:bg-primary-hover hover:scale-110'
        }`}
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
        )}
      </button>
    </>
  );
}

export default ChatWidget;
