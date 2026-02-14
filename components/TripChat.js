'use client';

/**
 * TripChat — Real-time group chat for a trip.
 * Phase 3 of Collaborative Group Trips.
 * 
 * Features:
 * - User messages with member names
 * - System messages for key events (joins, confirmations, etc.)
 * - Auto-scroll to latest message
 * - Real-time via Supabase Postgres Changes (handled by TripProvider)
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useTripContext } from './TripProvider';
import { sendTripMessage } from '@/lib/trips';

export default function TripChat() {
  const { messages, members, myMembership, tripId } = useTripContext();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom only if user is near the bottom (not scrolled up reading history)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !myMembership || sending) return;

    setSending(true);
    setSendError(null);
    setInput('');
    try {
      await sendTripMessage(tripId, myMembership.id, text);
    } catch (err) {
      console.error('Failed to send message:', err);
      setInput(text); // Restore on failure
      setSendError('Message failed to send. Please try again.');
      // Auto-dismiss error after 5 seconds
      setTimeout(() => setSendError(null), 5000);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const getMemberName = (memberId) => {
    const member = members.find(m => m.id === memberId);
    return member?.display_name || 'Unknown';
  };

  const isMyMessage = (msg) => {
    if (!myMembership) return false;
    return msg.member_id === myMembership.id;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (isToday) return time;
    if (isYesterday) return `Yesterday ${time}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
  };

  // Group messages by date for date separators (memoized)
  const groupedMessages = useMemo(() => {
    const grouped = [];
    let lastDate = null;
    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== lastDate) {
        grouped.push({ type: 'date-separator', date: msgDate, id: `sep-${msgDate}` });
        lastDate = msgDate;
      }
      grouped.push(msg);
    });
    return grouped;
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      {/* Messages area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-1 py-2 space-y-1">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-3xl mb-2">💬</div>
              <div className="text-sm text-gray-500">No messages yet.</div>
              <div className="text-xs text-gray-400 mt-1">Be the first to say something!</div>
            </div>
          </div>
        ) : (
          groupedMessages.map((item) => {
            // Date separator
            if (item.type === 'date-separator') {
              return (
                <div key={item.id} className="flex items-center justify-center py-3">
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-3 py-0.5 rounded-full">
                    {new Date(item.date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              );
            }

            const msg = item;

            // System message
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="flex items-center justify-center py-1">
                  <div className="text-[11px] text-gray-400 bg-gray-50 px-3 py-1 rounded-full max-w-[85%] text-center">
                    {msg.body}
                  </div>
                </div>
              );
            }

            // User message
            const mine = isMyMessage(msg);
            return (
              <div
                key={msg.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] ${mine ? 'order-2' : ''}`}>
                  {/* Sender name (not for own messages) */}
                  {!mine && (
                    <div className="text-[10px] font-medium text-gray-400 mb-0.5 ml-3">
                      {getMemberName(msg.member_id)}
                    </div>
                  )}
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      mine
                        ? 'bg-teal-600 text-white rounded-br-md'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                    }`}
                  >
                    {msg.body}
                  </div>
                  <div className={`text-[10px] text-gray-300 mt-0.5 ${mine ? 'text-right mr-1' : 'ml-3'}`}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error feedback */}
      {sendError && (
        <div className="shrink-0 px-3 py-2 bg-red-50 border-t border-red-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-red-600 font-medium">{sendError}</span>
            <button onClick={() => setSendError(null)} className="text-red-400 hover:text-red-600 text-xs ml-2">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      {myMembership ? (
        <div className="shrink-0 border-t border-gray-200 bg-white p-3">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              maxLength={2000}
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="shrink-0 px-4 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-3 text-center">
          <span className="text-xs text-gray-400">Join this trip to send messages.</span>
        </div>
      )}
    </div>
  );
}
