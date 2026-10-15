'use client';

import React, { useEffect, useState, useRef, useTransition } from 'react';
import type { PresenceChannel } from 'pusher-js';
import {
  Smartphone,
  Laptop,
  Tablet,
  Monitor,
  Wifi,
  WifiOff,
  Send,
  Users,
  Edit2,
  Radio,
  Sparkles,
  X,
  MessageSquare,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { getPusherClient } from '@/lib/pusher-client';
import {
  getOrCreateSessionId,
  detectDeviceDetails,
  getStoredDeviceName,
  setStoredDeviceName,
} from '@/lib/device-helper';
import { IMessage, PresenceMemberInfo } from '@/types';

interface MemberEntry {
  id: string;
  info: PresenceMemberInfo;
}

export default function ChatApp() {
  const [sessionId, setSessionId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [deviceType, setDeviceType] = useState<string>('Desktop');
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [tempNameInput, setTempNameInput] = useState<string>('');

  const [onlineMembers, setOnlineMembers] = useState<MemberEntry[]>([]);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'unavailable' | 'disconnected'
  >('connecting');
  const [isMobileDevicesOpen, setIsMobileDevicesOpen] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<PresenceChannel | null>(null);

  // Initialize session and device details on client mount
  useEffect(() => {
    const sId = getOrCreateSessionId();
    const { deviceType: detectedType, suggestedName } = detectDeviceDetails();
    const storedName = getStoredDeviceName();
    const finalName = storedName || suggestedName;

    setSessionId(sId);
    setDeviceType(detectedType);
    setDeviceName(finalName);
    setTempNameInput(finalName);
  }, []);

  // Fetch initial chat message history
  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/messages?roomId=general');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        }
      } catch (err) {
        console.error('Failed to load message history:', err);
      }
    }
    fetchHistory();
  }, []);

  // Subscribe to Pusher Presence Channel
  useEffect(() => {
    if (!sessionId || !deviceName) return;

    const pusher = getPusherClient(sessionId, deviceName, deviceType);

    pusher.connection.bind('state_change', (states: { current: string }) => {
      if (states.current === 'connected') {
        setConnectionStatus('connected');
      } else if (states.current === 'connecting') {
        setConnectionStatus('connecting');
      } else if (states.current === 'unavailable') {
        setConnectionStatus('unavailable');
      } else {
        setConnectionStatus('disconnected');
      }
    });

    const channelName = 'presence-devices-general';
    const channel = pusher.subscribe(channelName) as PresenceChannel;
    channelRef.current = channel;

    // Triggered once client has successfully subscribed and received initial member list
    channel.bind('pusher:subscription_succeeded', (members: {
      count: number;
      each: (callback: (member: MemberEntry) => void) => void;
      me: MemberEntry;
    }) => {
      const activeList: MemberEntry[] = [];
      members.each((member: MemberEntry) => {
        activeList.push({
          id: member.id,
          info: member.info || {
            name: 'Anonymous Device',
            deviceType: 'Browser',
          },
        });
      });
      setOnlineMembers(activeList);
      setConnectionStatus('connected');
    });

    // Triggered when a new device connects
    channel.bind('pusher:member_added', (member: MemberEntry) => {
      setOnlineMembers((prev) => {
        if (prev.some((m) => m.id === member.id)) return prev;
        return [
          ...prev,
          {
            id: member.id,
            info: member.info || {
              name: 'Connected Device',
              deviceType: 'Browser',
            },
          },
        ];
      });
    });

    // Triggered when a device closes tab, navigates away, or disconnects
    channel.bind('pusher:member_removed', (member: MemberEntry) => {
      setOnlineMembers((prev) => prev.filter((m) => m.id !== member.id));
    });

    // Real-time chat messages
    channel.bind('chat-message', (incomingMessage: IMessage) => {
      setMessages((prev) => {
        // Prevent duplicate if already added via optimistic update
        if (incomingMessage._id && prev.some((m) => m._id === incomingMessage._id)) {
          return prev;
        }
        return [...prev, incomingMessage];
      });
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [sessionId, deviceName, deviceType]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle message sending
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputMessage.trim();
    if (!content) return;

    setInputMessage('');

    // Optimistic message placeholder
    const optimisticMessage: IMessage = {
      _id: `temp_${Date.now()}`,
      sender: deviceName,
      senderSessionId: sessionId,
      deviceType: deviceType,
      content: content,
      roomId: 'general',
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    startTransition(async () => {
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            sender: deviceName,
            senderSessionId: sessionId,
            deviceType,
            roomId: 'general',
          }),
        });

        if (!response.ok) {
          console.error('Failed to broadcast message');
        } else {
          const saved = await response.json();
          // Update temp ID with MongoDB _id
          setMessages((prev) =>
            prev.map((msg) => (msg._id === optimisticMessage._id ? saved : msg))
          );
        }
      } catch (err) {
        console.error('Error posting message:', err);
      }
    });
  };

  // Update device display name
  const handleSaveName = () => {
    if (!tempNameInput.trim()) return;
    const newName = tempNameInput.trim();
    setStoredDeviceName(newName);
    setDeviceName(newName);
    setIsEditingName(false);
  };

  const getDeviceIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'tablet':
        return <Tablet className="w-4 h-4" />;
      case 'desktop':
      case 'mac':
      case 'windows pc':
        return <Laptop className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const formatTimestamp = (dateVal: string | Date) => {
    try {
      const d = new Date(dateVal);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-900/90 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-base sm:text-lg tracking-tight text-white">
                LiveDevice Sync
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-950 text-indigo-300 border border-indigo-800">
                <ShieldCheck className="w-3 h-3" /> Pusher + MongoDB
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Open this URL on another device or tab to see real-time sync
            </p>
          </div>
        </div>

        {/* Connection & Device Identity Quick Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Connection Status Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              connectionStatus === 'connected'
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                : connectionStatus === 'connecting'
                ? 'bg-amber-950/80 text-amber-400 border border-amber-800/80 animate-pulse'
                : 'bg-rose-950/80 text-rose-400 border border-rose-800/80'
            }`}
            title={`Real-Time Engine: ${connectionStatus}`}
          >
            {connectionStatus === 'connected' ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="hidden sm:inline">Connected</span>
              </>
            ) : connectionStatus === 'connecting' ? (
              <>
                <Wifi className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Connecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Offline</span>
              </>
            )}
          </div>

          {/* Current Device Pill / Edit Trigger */}
          <button
            onClick={() => setIsEditingName(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Edit device display name"
          >
            {getDeviceIcon(deviceType)}
            <span className="max-w-[90px] sm:max-w-[140px] truncate">{deviceName || 'This Device'}</span>
            <Edit2 className="w-3 h-3 text-slate-400" />
          </button>

          {/* Mobile Drawer Toggle */}
          <button
            onClick={() => setIsMobileDevicesOpen(!isMobileDevicesOpen)}
            className="sm:hidden flex items-center justify-center p-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
            aria-label="Toggle active devices"
          >
            <div className="relative">
              <Users className="w-4 h-4" />
              {onlineMembers.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                  {onlineMembers.length}
                </span>
              )}
            </div>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR: Active Online Devices (Desktop: static, Mobile: slide-out overlay) */}
        <aside
          className={`
            fixed sm:static inset-y-0 left-0 z-30 sm:z-10
            w-72 sm:w-80 flex flex-col bg-slate-900 border-r border-slate-800
            transform transition-transform duration-300 ease-in-out
            ${isMobileDevicesOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
          `}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <h2 className="font-medium text-sm text-slate-200">Connected Devices</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                {onlineMembers.length}
              </span>
            </div>
            <button
              onClick={() => setIsMobileDevicesOpen(false)}
              className="sm:hidden p-1 rounded-md text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active Devices List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {onlineMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <WifiOff className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs">Connecting to presence channel...</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Ensure Pusher credentials are set in .env.local
                </p>
              </div>
            ) : (
              onlineMembers.map((member) => {
                const isMe = member.id === sessionId;
                return (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition ${
                      isMe
                        ? 'bg-indigo-950/40 border-indigo-800/80'
                        : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-lg ${
                            isMe ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {getDeviceIcon(member.info?.deviceType)}
                        </div>
                        {/* Green Presence Dot */}
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-2 ring-slate-900"></span>
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-medium text-slate-200 truncate">
                            {member.info?.name || 'Unnamed Device'}
                          </p>
                          {isMe && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {member.info?.deviceType || 'Web Device'} • ID: {member.id.slice(-6)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer Info */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/80">
            <div className="rounded-lg bg-slate-800/70 p-2.5 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Multi-Device Sync</span>
              </div>
              <p>
                Open this app in an Incognito window, another browser, or scan with your mobile device to watch devices discover each other instantly.
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {isMobileDevicesOpen && (
          <div
            onClick={() => setIsMobileDevicesOpen(false)}
            className="sm:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm"
          />
        )}

        {/* MAIN VIEW: Live Chat Window */}
        <main className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
          {/* Chat Messages Scrollable Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 mb-3">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-medium text-slate-300">No messages yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Send a message below. It will appear simultaneously across all connected devices in real time and persist to MongoDB Atlas.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.senderSessionId === sessionId;
                return (
                  <div
                    key={msg._id || idx}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    {/* Sender Identity & Device Type */}
                    <div className="flex items-center gap-1.5 px-1 text-[11px] text-slate-400">
                      <span>{isMe ? 'You' : msg.sender}</span>
                      {msg.deviceType && (
                        <span className="flex items-center gap-0.5 text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">
                          {getDeviceIcon(msg.deviceType)}
                          {msg.deviceType}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm break-words ${
                        isMe
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/80'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Broadcast a real-time message to all devices..."
                className="flex-1 bg-slate-950 border border-slate-700 text-slate-100 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isPending}
                className="flex items-center justify-center h-11 w-11 sm:w-auto sm:px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20"
                aria-label="Send message"
              >
                <Send className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </main>
      </div>

      {/* Edit Device Name Modal */}
      {isEditingName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-slate-100 text-base">Device Profile</h3>
              </div>
              <button
                onClick={() => setIsEditingName(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Device Display Name
                </label>
                <input
                  type="text"
                  value={tempNameInput}
                  onChange={(e) => setTempNameInput(e.target.value)}
                  placeholder="e.g. iPhone 15 Pro, Living Room Laptop..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="text-xs text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <p>
                  <strong className="text-slate-300">Device Platform:</strong> {deviceType}
                </p>
                <p>
                  <strong className="text-slate-300">Session ID:</strong> {sessionId}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsEditingName(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveName}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/20"
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

