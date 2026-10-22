import React, { useState, useEffect, useRef } from 'react';
import { Send, Hash, Lock, Users, Plus, Paperclip, Pin, Bell, BellOff, Menu, X, LogOut, Smile, Edit2, Trash2, Download, Image as ImageIcon, FileText, Settings } from 'lucide-react';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function FintechCommunicationApp() {
  const [auth, setAuth] = useState({ token: null, user: null });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState({});
  const [activeView, setActiveView] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [reactions, setReactions] = useState({});
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('public');
  const [showEditChannel, setShowEditChannel] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [editChannelForm, setEditChannelForm] = useState({ name: '', description: '', type: 'public' });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRecentFiles, setShowRecentFiles] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const [dmsCollapsed, setDmsCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('account');
  const [settingsForm, setSettingsForm] = useState({ name: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeView]);

  // Auto-dismiss welcome banner after 10 seconds
  useEffect(() => {
    if (showWelcomeBanner) {
      const timer = setTimeout(() => {
        setShowWelcomeBanner(false);
      }, 10000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [showWelcomeBanner]);

  // Check for saved auth token on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user');
    if (token && user) {
      setAuth({ token, user: JSON.parse(user) });
    }
  }, []);

  // Initialize socket connection when authenticated
  useEffect(() => {
    if (auth.token) {
      socketRef.current = io(API_URL);
      
      socketRef.current.emit('authenticate', auth.token);

      socketRef.current.on('new_message', (message) => {
        const key = `channel-${message.channel_id}`;
        setMessages(prev => ({
          ...prev,
          [key]: [...(prev[key] || []), message]
        }));
      });

      socketRef.current.on('new_direct_message', (message) => {
        const otherUserId = message.user_id === auth.user.id ? message.recipient_id : message.user_id;
        const key = `dm-${otherUserId}`;
        setMessages(prev => ({
          ...prev,
          [key]: [...(prev[key] || []), message]
        }));
      });

      socketRef.current.on('user_status_change', ({ userId, status }) => {
        setUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, status } : u
        ));
      });

      // Load initial data
      loadUsers();
      loadChannels();

      return () => {
        socketRef.current?.disconnect();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  // Load messages when active view changes
  useEffect(() => {
    if (activeView && auth.token) {
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, auth.token]);

  const apiCall = async (endpoint, options = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginForm.email, password: loginForm.password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const data = await response.json();
      
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setAuth({ token: data.token, user: data.user });
      setShowWelcomeBanner(true); // Show banner on fresh login
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setAuth({ token: null, user: null });
    socketRef.current?.disconnect();
  };

  const loadUsers = async () => {
    try {
      const data = await apiCall('/api/users');
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const loadChannels = async () => {
    try {
      const data = await apiCall('/api/channels');
      setChannels(data);
      // Don't auto-select a channel - let user choose or see welcome screen
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  };

  const loadMessages = async () => {
    try {
      if (activeView.startsWith('channel-')) {
        const channelId = activeView.split('-')[1];
        const data = await apiCall(`/api/channels/${channelId}/messages`);
        setMessages(prev => ({ ...prev, [activeView]: data }));
        socketRef.current?.emit('join_channel', parseInt(channelId));
      } else if (activeView.startsWith('dm-')) {
        const userId = activeView.split('-')[1];
        const data = await apiCall(`/api/direct-messages/${userId}`);
        setMessages(prev => ({ ...prev, [activeView]: data }));
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert('File too large. Maximum size is 10MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return null;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
        },
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const sendMessage = async () => {
    if ((!messageInput.trim() && !selectedFile) || !socketRef.current) return;

    let fileData = null;
    if (selectedFile) {
      fileData = await uploadFile();
      if (!fileData) return; // Upload failed
    }

    const messageData = {
      text: messageInput || '',
      ...(fileData && {
        file_url: fileData.file_url,
        file_name: fileData.file_name,
        file_type: fileData.file_type,
        file_size: fileData.file_size
      })
    };

    if (activeView.startsWith('channel-')) {
      const channelId = parseInt(activeView.split('-')[1]);
      socketRef.current.emit('send_channel_message', {
        channelId,
        ...messageData
      });
    } else if (activeView.startsWith('dm-')) {
      const recipientId = parseInt(activeView.split('-')[1]);
      socketRef.current.emit('send_direct_message', {
        recipientId,
        ...messageData
      });
    }

    setMessageInput('');
    setSelectedFile(null);
  };

  const editMessage = async (messageId, newText) => {
    try {
      await apiCall(`/api/messages/${messageId}/edit`, {
        method: 'PATCH',
        body: JSON.stringify({ text: newText })
      });

      setMessages(prev => ({
        ...prev,
        [activeView]: prev[activeView].map(msg =>
          msg.id === messageId ? { ...msg, text: newText, edited: true } : msg
        )
      }));

      setEditingMessage(null);
    } catch (error) {
      console.error('Edit failed:', error);
      alert('Failed to edit message');
    }
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;

    try {
      await apiCall(`/api/messages/${messageId}`, {
        method: 'DELETE'
      });

      setMessages(prev => ({
        ...prev,
        [activeView]: prev[activeView].filter(msg => msg.id !== messageId)
      }));
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete message');
    }
  };

  const addReaction = async (messageId, emoji) => {
    try {
      await apiCall(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji })
      });

      // Add reaction locally
      setReactions(prev => ({
        ...prev,
        [messageId]: [...(prev[messageId] || []), { emoji, user_id: auth.user.id, user_name: auth.user.name }]
      }));

      setShowEmojiPicker(null);
    } catch (error) {
      console.error('Reaction failed:', error);
    }
  };

  const removeReaction = async (messageId, emoji) => {
    try {
      await apiCall(`/api/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
        method: 'DELETE'
      });

      // Remove reaction locally
      setReactions(prev => ({
        ...prev,
        [messageId]: (prev[messageId] || []).filter(r => !(r.emoji === emoji && r.user_id === auth.user.id))
      }));
    } catch (error) {
      console.error('Remove reaction failed:', error);
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) return;

    try {
      const data = await apiCall('/api/channels', {
        method: 'POST',
        body: JSON.stringify({
          name: newChannelName.toLowerCase().replace(/\s+/g, '-'),
          type: newChannelType,
          description: `${newChannelName} channel`
        })
      });

      setChannels(prev => [...prev, data]);
      setNewChannelName('');
      setShowCreateChannel(false);
      setActiveView(`channel-${data.id}`);
    } catch (error) {
      console.error('Create channel failed:', error);
      alert('Failed to create channel');
    }
  };

  const openEditChannel = (channel) => {
    setEditingChannel(channel);
    setEditChannelForm({
      name: channel.name,
      description: channel.description || '',
      type: channel.type
    });
    setShowEditChannel(true);
  };

  const updateChannel = async () => {
    if (!editChannelForm.name.trim()) return;

    try {
      const data = await apiCall(`/api/channels/${editingChannel.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editChannelForm.name.toLowerCase().replace(/\s+/g, '-'),
          description: editChannelForm.description,
          type: editChannelForm.type
        })
      });

      setChannels(prev => prev.map(ch => ch.id === editingChannel.id ? data : ch));
      setShowEditChannel(false);
      setEditingChannel(null);
    } catch (error) {
      console.error('Update channel failed:', error);
      alert('Failed to update channel');
    }
  };

  const deleteChannel = async (channelId) => {
    if (!window.confirm('Delete this channel? All messages will be lost.')) return;

    try {
      await apiCall(`/api/channels/${channelId}`, {
        method: 'DELETE'
      });

      setChannels(prev => prev.filter(ch => ch.id !== channelId));
      if (activeView === `channel-${channelId}`) {
        setActiveView('');
      }
      setShowEditChannel(false);
    } catch (error) {
      console.error('Delete channel failed:', error);
      alert('Failed to delete channel');
    }
  };

  const updateProfile = async () => {
    if (!settingsForm.name.trim() || !settingsForm.email.trim()) {
      alert('Name and email are required');
      return;
    }

    try {
      const data = await apiCall('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: settingsForm.name,
          email: settingsForm.email
        })
      });

      setAuth(prev => ({ ...prev, user: data }));
      localStorage.setItem('user', JSON.stringify(data));
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Update profile error:', error);
      alert('Failed to update profile');
    }
  };

  const changePassword = async () => {
    if (!settingsForm.currentPassword || !settingsForm.newPassword) {
      alert('Please fill in all password fields');
      return;
    }

    if (settingsForm.newPassword !== settingsForm.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (settingsForm.newPassword.length < 8) {
      alert('New password must be at least 8 characters');
      return;
    }

    try {
      await apiCall('/api/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: settingsForm.currentPassword,
          newPassword: settingsForm.newPassword
        })
      });

      setSettingsForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      alert('Password changed successfully!');
    } catch (error) {
      console.error('Change password error:', error);
      alert('Failed to change password. Check your current password.');
    }
  };

  const getOnlineCount = () => {
    return users.filter(u => u.status === 'available').length;
  };

  const getTodayMessageCount = () => {
    const today = new Date().toDateString();
    const allMessages = Object.values(messages).flat();
    return allMessages.filter(msg => 
      new Date(msg.created_at).toDateString() === today
    ).length;
  };

  const getThisWeekFileCount = () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const allMessages = Object.values(messages).flat();
    return allMessages.filter(msg => 
      msg.file_url && new Date(msg.created_at) > weekAgo
    ).length;
  };

  const loadRecentFiles = () => {
    // Get all messages with files from all channels
    const allMessages = Object.values(messages).flat();
    const filesMessages = allMessages
      .filter(msg => msg.file_url)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);
    
    setRecentFiles(filesMessages);
    setShowRecentFiles(true);
  };

  const getUnreadCount = () => {
    // Simple unread count - count messages in all channels/DMs
    const allMessages = Object.values(messages).flat();
    return allMessages.length;
  };

  const togglePin = async (messageId) => {
    try {
      const currentMessage = getActiveMessages().find(m => m.id === messageId);
      await apiCall(`/api/messages/${messageId}/pin`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned: !currentMessage.pinned })
      });
      
      setMessages(prev => ({
        ...prev,
        [activeView]: prev[activeView].map(msg => 
          msg.id === messageId ? { ...msg, pinned: !msg.pinned } : msg
        )
      }));
    } catch (err) {
      console.error('Failed to pin message:', err);
    }
  };

  const getActiveMessages = () => {
    return messages[activeView] || [];
  };

  const getActiveTitle = () => {
    if (activeView.startsWith('channel-')) {
      const channelId = parseInt(activeView.split('-')[1]);
      const channel = channels.find(c => c.id === channelId);
      return channel ? `#${channel.name}` : '';
    } else if (activeView.startsWith('dm-')) {
      const userId = parseInt(activeView.split('-')[1]);
      const user = users.find(u => u.id === userId);
      return user ? user.name : '';
    }
    return '';
  };

  const getActiveDescription = () => {
    if (activeView.startsWith('channel-')) {
      const channelId = parseInt(activeView.split('-')[1]);
      const channel = channels.find(c => c.id === channelId);
      return channel ? channel.description : '';
    }
    return '';
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes < 1 ? 'Just now' : `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'available': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  // Login/Register Screen
  if (!auth.token) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/login-bg.jpg)' }}
        />
        {/* Lighter Overlay - More background visible */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/60 via-purple-900/50 to-indigo-800/60" />
        
        {/* Login Card */}
        <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md backdrop-blur-sm">
          <div className="text-center mb-8">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <svg width="200" height="60" viewBox="0 0 200 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="30" cy="30" r="24" fill="url(#gradient)"/>
                <path d="M20 18 h20 M30 18 v24" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M36 24 Q42 24 42 30 Q42 36 36 36 M36 36 Q30 36 30 42" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
                <text x="62" y="28" fontFamily="Arial, sans-serif" fontSize="24" fontWeight="700" fill="#1e1b4b">
                  Team
                </text>
                <text x="62" y="46" fontFamily="Arial, sans-serif" fontSize="24" fontWeight="700" fill="#4f46e5">
                  Sabi
                </text>
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#6366f1', stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:'#8b5cf6', stopOpacity:1}} />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <p className="text-gray-600">Team Communication Platform</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Please wait...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Access is limited to authorized team members only.</p>
          </div>
        </div>
      </div>
    );
  }

  // Main App Interface (same as before but with real data)
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-indigo-900 text-white transition-all duration-300 overflow-hidden flex flex-col`}>
        <div className="p-4 border-b border-indigo-800">
          <div className="flex items-center justify-between mb-4">
            {/* Logo */}
            <svg width="140" height="32" viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="13" fill="white" fillOpacity="0.15"/>
              <path d="M11 10 h10 M16 10 v12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M19 13 Q22 13 22 16 Q22 19 19 19 M19 19 Q16 19 16 22" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <text x="36" y="21" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="700" fill="white">
                Team Sabi
              </text>
            </svg>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex items-center space-x-3 p-2 rounded bg-indigo-800 hover:bg-indigo-700 cursor-pointer">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-semibold">
                {auth.user.avatar}
              </div>
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-indigo-800 ${getStatusColor(auth.user.status)}`}></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{auth.user.name}</p>
              <p className="text-xs text-indigo-300 truncate">{auth.user.email}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <button 
                onClick={() => setChannelsCollapsed(!channelsCollapsed)}
                className="flex items-center space-x-2 hover:bg-indigo-800 px-2 py-1 rounded flex-1"
              >
                <h3 className="text-xs font-semibold text-indigo-300 uppercase">Channels</h3>
                <span className="text-indigo-300">
                  {channelsCollapsed ? '▶' : '▼'}
                </span>
              </button>
              <button 
                onClick={() => setShowCreateChannel(true)}
                className="hover:bg-indigo-800 p-1 rounded"
                title="Create new channel"
              >
                <Plus size={14} />
              </button>
            </div>
            {!channelsCollapsed && (
              <div className="space-y-1">
                {channels.map(channel => (
                  <div key={channel.id} className="group relative">
                    <button
                      onClick={() => setActiveView(`channel-${channel.id}`)}
                      className={`w-full text-left px-3 py-2 rounded flex items-center space-x-2 ${
                        activeView === `channel-${channel.id}` ? 'bg-indigo-700' : 'hover:bg-indigo-800'
                      }`}
                    >
                      {channel.type === 'private' ? <Lock size={16} /> : <Hash size={16} />}
                      <span className="text-sm flex-1 truncate">{channel.name}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditChannel(channel);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:bg-indigo-600 rounded transition"
                      title="Edit channel"
                    >
                      <Settings size={14} className="text-indigo-200" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <button 
                onClick={() => setDmsCollapsed(!dmsCollapsed)}
                className="flex items-center space-x-2 hover:bg-indigo-800 px-2 py-1 rounded flex-1"
              >
                <h3 className="text-xs font-semibold text-indigo-300 uppercase">Direct Messages</h3>
                <span className="text-indigo-300">
                  {dmsCollapsed ? '▶' : '▼'}
                </span>
              </button>
            </div>
            {!dmsCollapsed && (
              <div className="space-y-1">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setActiveView(`dm-${user.id}`)}
                    className={`w-full text-left px-3 py-2 rounded flex items-center space-x-2 ${
                      activeView === `dm-${user.id}` ? 'bg-indigo-700' : 'hover:bg-indigo-800'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold">
                        {user.avatar}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-indigo-900 ${getStatusColor(user.status)}`}></div>
                    </div>
                    <span className="text-sm flex-1 truncate">{user.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-indigo-800 space-y-2">
          <button 
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded hover:bg-indigo-800 text-sm"
          >
            {notificationsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            <span>Notifications {notificationsEnabled ? 'On' : 'Off'}</span>
          </button>
          <button 
            onClick={() => {
              setSettingsForm({ 
                name: auth.user.name, 
                email: auth.user.email,
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
              });
              setShowSettings(true);
            }}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded hover:bg-indigo-800 text-sm"
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
          <button 
            onClick={logout}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded hover:bg-indigo-800 text-sm"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
                <Menu size={20} />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{getActiveTitle()}</h2>
              {getActiveDescription() && (
                <p className="text-sm text-gray-500 truncate">{getActiveDescription()}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Users size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!activeView ? (
            /* Welcome Screen */
            <div className="h-full overflow-y-auto">
              <div className="flex items-center justify-center min-h-full py-8">
                <div className="max-w-3xl w-full text-center space-y-5 px-4">
                
                {/* Dismissible Welcome Banner */}
                {showWelcomeBanner && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center justify-between animate-slideDown">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">👋</span>
                      <span className="text-indigo-900 font-medium">
                        Welcome back, {auth.user.name.split(' ')[0]}!
                      </span>
                      <span className="text-indigo-400">•</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-indigo-700 text-sm font-medium">
                          {getOnlineCount()} teammate{getOnlineCount() !== 1 ? 's' : ''} online
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowWelcomeBanner(false)}
                      className="text-indigo-400 hover:text-indigo-600 transition"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}

                {/* Tagline & Avatar Cluster */}
                <div className="space-y-3">
                  <p className="text-xl text-gray-600 font-light">One Team. One Vision.</p>
                  
                  {/* Team Avatar Cluster */}
                  <div className="flex justify-center items-center mb-4">
                    <div className="flex -space-x-3">
                      {users.slice(0, 5).map((user, idx) => (
                        <div
                          key={user.id}
                          className="relative group"
                          style={{ zIndex: 10 - idx }}
                          title={user.name}
                        >
                          <div className="w-12 h-12 rounded-full bg-indigo-600 border-4 border-white flex items-center justify-center text-white font-semibold text-sm shadow-lg transform transition-all duration-200 group-hover:scale-110 group-hover:z-50 cursor-pointer">
                            {user.avatar}
                          </div>
                          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(user.status)}`}></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Team Stats Card */}
                <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-xl shadow-md border border-indigo-100 p-6 animate-fadeIn">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center justify-center space-x-2">
                    <span>📊</span>
                    <span>Your Team Today</span>
                  </h2>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center transform hover:scale-105 transition">
                      <div className="text-3xl font-bold text-indigo-600 mb-1">
                        {getOnlineCount()}/{users.length}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">Online Now</div>
                    </div>
                    
                    <div className="text-center transform hover:scale-105 transition">
                      <div className="text-3xl font-bold text-purple-600 mb-1">
                        {getTodayMessageCount()}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">Messages Today</div>
                    </div>
                    
                    <div className="text-center transform hover:scale-105 transition">
                      <div className="text-3xl font-bold text-pink-600 mb-1">
                        {getThisWeekFileCount()}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">Files This Week</div>
                    </div>
                    
                    <div className="text-center transform hover:scale-105 transition">
                      <div className="text-3xl mb-1">🔥</div>
                      <div className="text-xs text-gray-600 font-medium">Most Active<br/>#general</div>
                    </div>
                  </div>
                </div>

                {/* Quick Access Cards */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h2 className="text-base font-semibold text-gray-900 mb-3">Quick Access</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Channels */}
                    <div className="bg-indigo-50 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <Hash className="text-indigo-600" size={20} />
                        <h3 className="font-semibold text-gray-900">Channels</h3>
                      </div>
                      <div className="space-y-2">
                        {channels.slice(0, 3).map(channel => (
                          <button
                            key={channel.id}
                            onClick={() => setActiveView(`channel-${channel.id}`)}
                            className="w-full text-left px-3 py-2 bg-white rounded-lg hover:bg-indigo-100 transition-all text-sm font-medium text-gray-700 hover:text-indigo-600 transform hover:scale-105"
                          >
                            #{channel.name}
                          </button>
                        ))}
                        {channels.length === 0 && (
                          <p className="text-sm text-gray-500">No channels yet</p>
                        )}
                      </div>
                    </div>

                    {/* Team Members */}
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <Users className="text-green-600" size={20} />
                        <h3 className="font-semibold text-gray-900">Team Members</h3>
                      </div>
                      <div className="space-y-2">
                        {users.slice(0, 3).map(user => (
                          <button
                            key={user.id}
                            onClick={() => setActiveView(`dm-${user.id}`)}
                            className="w-full text-left px-3 py-2 bg-white rounded-lg hover:bg-green-100 transition-all text-sm font-medium text-gray-700 hover:text-green-600 flex items-center space-x-2 transform hover:scale-105"
                          >
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(user.status)}`}></div>
                            <span>{user.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA Buttons - Better Hierarchy */}
                <div className="space-y-4">
                  {/* Primary Action - Big and Bold */}
                  <button
                    onClick={() => channels.length > 0 && setActiveView(`channel-${channels[0].id}`)}
                    className="w-full md:w-auto px-10 py-4 bg-indigo-600 text-white text-lg font-bold rounded-xl hover:bg-indigo-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center justify-center space-x-3 mx-auto"
                  >
                    <Hash size={24} />
                    <span>Go to #General</span>
                  </button>
                  
                  {/* Secondary Actions - Smaller and Subtle */}
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => setShowNotifications(true)}
                      className="px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-700 text-sm rounded-lg hover:border-indigo-300 hover:bg-indigo-50 font-medium flex items-center space-x-2 transition-all relative"
                    >
                      <Bell size={18} />
                      <span>Notifications</span>
                      {getUnreadCount() > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                          {getUnreadCount()}
                        </span>
                      )}
                    </button>
                    
                    <button
                      onClick={loadRecentFiles}
                      className="px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-700 text-sm rounded-lg hover:border-indigo-300 hover:bg-indigo-50 font-medium flex items-center space-x-2 transition-all"
                    >
                      <FileText size={18} />
                      <span>Recent Files</span>
                    </button>
                  </div>
                </div>

                {/* Tip */}
                <div className="text-sm text-gray-500 pt-2 pb-4">
                  <p>💡 <strong>Pro tip:</strong> Use channels for team discussions, DMs for quick chats</p>
                </div>
                
              </div>
              </div>
            </div>
          ) : (
            /* Messages Area (existing) */
            <>
              {getActiveMessages().filter(msg => msg.pinned).length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center space-x-2 text-yellow-800 font-medium text-sm mb-2">
                    <Pin size={16} />
                    <span>Pinned Messages</span>
                  </div>
                  {getActiveMessages().filter(msg => msg.pinned).map(msg => (
                    <div key={msg.id} className="text-sm text-gray-700 py-1">
                      <span className="font-medium">{msg.user_name}:</span> {msg.text}
                    </div>
                  ))}
                </div>
              )}

          {getActiveMessages().map((message) => {
            const isCurrentUser = message.user_id === auth.user.id;
            const messageReactions = reactions[message.id] || [];
            const isEditing = editingMessage === message.id;

            return (
              <div key={message.id} className={`flex space-x-3 group ${isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {message.user_avatar}
                </div>
                <div className={`flex-1 ${isCurrentUser ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-baseline space-x-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{message.user_name}</span>
                    <span className="text-xs text-gray-500">{formatTime(message.created_at)}</span>
                    {message.edited && <span className="text-xs text-gray-400 italic">(edited)</span>}
                  </div>
                  
                  <div className={`group/msg relative ${isCurrentUser ? 'ml-auto' : ''}`}>
                    <div className={`${isCurrentUser ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200'} rounded-lg px-4 py-2 max-w-2xl`}>
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            defaultValue={message.text}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                editMessage(message.id, e.target.value);
                              }
                            }}
                            className="flex-1 px-2 py-1 border rounded text-sm text-gray-900"
                            autoFocus
                          />
                          <button onClick={() => setEditingMessage(null)} className="text-xs text-gray-500 hover:text-gray-700">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {message.text && <p className="text-sm break-words">{message.text}</p>}
                          
                          {/* File Attachment */}
                          {message.file_url && (
                            <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                              <div className="flex items-center space-x-2">
                                {message.file_type?.startsWith('image/') ? (
                                  <div className="w-full">
                                    <img src={message.file_url} alt={message.file_name} className="max-w-xs rounded" />
                                    <a href={message.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center mt-1">
                                      <Download size={12} className="mr-1" /> {message.file_name}
                                    </a>
                                  </div>
                                ) : (
                                  <>
                                    <FileText size={20} className="text-gray-500" />
                                    <div className="flex-1">
                                      <a href={message.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline">
                                        {message.file_name}
                                      </a>
                                      <p className="text-xs text-gray-500">{(message.file_size / 1024).toFixed(1)} KB</p>
                                    </div>
                                    <a href={message.file_url} download className="p-1 hover:bg-gray-200 rounded">
                                      <Download size={16} className="text-gray-600" />
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {!isEditing && (
                      <div className="absolute -top-2 -right-2 opacity-0 group-hover/msg:opacity-100 flex space-x-1">
                        {/* Emoji Reaction Button */}
                        <div className="relative">
                          <button
                            onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                            className="bg-white border border-gray-200 rounded-full p-1 shadow-sm hover:bg-gray-50"
                          >
                            <Smile size={14} className="text-gray-600" />
                          </button>
                          
                          {/* Emoji Picker */}
                          {showEmojiPicker === message.id && (
                            <div className="absolute top-8 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 flex space-x-1">
                              {['👍', '❤️', '😂', '🎉', '🔥', '👏'].map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => addReaction(message.id, emoji)}
                                  className="hover:bg-gray-100 p-1 rounded text-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Edit Button (only for own messages) */}
                        {isCurrentUser && (
                          <button
                            onClick={() => setEditingMessage(message.id)}
                            className="bg-white border border-gray-200 rounded-full p-1 shadow-sm hover:bg-gray-50"
                          >
                            <Edit2 size={14} className="text-gray-600" />
                          </button>
                        )}

                        {/* Delete Button (own messages OR admin) */}
                        {(isCurrentUser || auth.user?.is_admin) && (
                          <button
                            onClick={() => deleteMessage(message.id)}
                            className="bg-white border border-gray-200 rounded-full p-1 shadow-sm hover:bg-gray-50"
                            title={auth.user?.is_admin && !isCurrentUser ? "Delete (Admin)" : "Delete"}
                          >
                            <Trash2 size={14} className={auth.user?.is_admin && !isCurrentUser ? "text-orange-600" : "text-red-600"} />
                          </button>
                        )}

                        {/* Pin Button */}
                        <button
                          onClick={() => togglePin(message.id)}
                          className="bg-white border border-gray-200 rounded-full p-1 shadow-sm hover:bg-gray-50"
                        >
                          <Pin size={14} className={message.pinned ? 'text-yellow-600' : 'text-gray-600'} />
                        </button>
                      </div>
                    )}

                    {/* Reactions Display */}
                    {messageReactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(
                          messageReactions.reduce((acc, r) => {
                            acc[r.emoji] = acc[r.emoji] || [];
                            acc[r.emoji].push(r);
                            return acc;
                          }, {})
                        ).map(([emoji, users]) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              const hasReacted = users.some(u => u.user_id === auth.user.id);
                              if (hasReacted) {
                                removeReaction(message.id, emoji);
                              } else {
                                addReaction(message.id, emoji);
                              }
                            }}
                            className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 ${
                              users.some(u => u.user_id === auth.user.id)
                                ? 'bg-indigo-100 border border-indigo-300'
                                : 'bg-gray-100 border border-gray-300'
                            } hover:bg-gray-200`}
                            title={users.map(u => u.user_name).join(', ')}
                          >
                            <span>{emoji}</span>
                            <span>{users.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {activeView && (
          <div className="bg-white border-t border-gray-200 p-4">
          {/* File Preview */}
          {selectedFile && (
            <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {selectedFile.type.startsWith('image/') ? <ImageIcon size={16} /> : <FileText size={16} />}
                <span className="text-sm text-gray-700">{selectedFile.name}</span>
                <span className="text-xs text-gray-500">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button onClick={() => setSelectedFile(null)} className="text-red-600 hover:text-red-800">
                <X size={16} />
              </button>
            </div>
          )}

          <div className="flex items-end space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-gray-100 rounded-lg mb-2"
              title="Attach file"
            >
              <Paperclip size={20} className="text-gray-600" />
            </button>
            <div className="flex-1 relative">
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`Message ${getActiveTitle()}`}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows="1"
                style={{ minHeight: '44px', maxHeight: '120px' }}
                disabled={uploadingFile}
              />
            </div>
            <button 
              onClick={sendMessage}
              disabled={(!messageInput.trim() && !selectedFile) || uploadingFile}
              className="bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed mb-2 flex items-center space-x-2"
            >
              {uploadingFile ? (
                <span className="text-sm">Uploading...</span>
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            <strong>Tip:</strong> Click 📎 to attach files • Press Enter to send • Shift+Enter for new line
          </p>
        </div>
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCreateChannel(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Create New Channel</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Channel Name</label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') createChannel();
                  }}
                  placeholder="e.g., marketing, engineering"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">Use lowercase letters and hyphens</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Channel Type</label>
                <select 
                  value={newChannelType}
                  onChange={(e) => setNewChannelType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="public">Public - Everyone can see and join</option>
                  <option value="private">Private - Invitation only</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button 
                onClick={() => {
                  setShowCreateChannel(false);
                  setNewChannelName('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={createChannel}
                disabled={!newChannelName.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Channel Modal */}
      {showEditChannel && editingChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEditChannel(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Edit Channel</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Channel Name</label>
                <input
                  type="text"
                  value={editChannelForm.name}
                  onChange={(e) => setEditChannelForm({ ...editChannelForm, name: e.target.value })}
                  placeholder="e.g., marketing, engineering"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Use lowercase letters and hyphens</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editChannelForm.description}
                  onChange={(e) => setEditChannelForm({ ...editChannelForm, description: e.target.value })}
                  placeholder="What's this channel for?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows="2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Channel Type</label>
                <select 
                  value={editChannelForm.type}
                  onChange={(e) => setEditChannelForm({ ...editChannelForm, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="public">Public - Everyone can see and join</option>
                  <option value="private">Private - Invitation only</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6 flex justify-between">
              <button 
                onClick={() => deleteChannel(editingChannel.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                title={auth.user?.is_admin ? "Delete channel" : "Admin only"}
                disabled={!auth.user?.is_admin}
              >
                Delete Channel
              </button>
              <div className="flex space-x-3">
                <button 
                  onClick={() => {
                    setShowEditChannel(false);
                    setEditingChannel(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={updateChannel}
                  disabled={!editChannelForm.name.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowNotifications(false)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center space-x-2">
                <Bell size={24} />
                <span>Notifications</span>
              </h3>
              <button onClick={() => setShowNotifications(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-3">
              {Object.entries(messages).map(([view, msgs]) => {
                const viewName = view.startsWith('channel-') 
                  ? channels.find(c => c.id === parseInt(view.split('-')[1]))?.name 
                  : users.find(u => u.id === parseInt(view.split('-')[1]))?.name;
                
                return msgs.slice(-5).reverse().map((msg, idx) => (
                  <div 
                    key={`${view}-${msg.id}`}
                    className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition"
                    onClick={() => {
                      setActiveView(view);
                      setShowNotifications(false);
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {msg.user_avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline space-x-2">
                          <span className="font-semibold text-sm">{msg.user_name}</span>
                          <span className="text-xs text-gray-500">in #{viewName}</span>
                          <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1 line-clamp-2">{msg.text || '📎 Sent a file'}</p>
                      </div>
                    </div>
                  </div>
                ));
              }).flat().slice(0, 20)}
              
              {Object.keys(messages).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Bell size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Files Modal */}
      {showRecentFiles && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowRecentFiles(false)}>
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center space-x-2">
                <FileText size={24} />
                <span>Recent Files</span>
              </h3>
              <button onClick={() => setShowRecentFiles(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-3">
              {recentFiles.map((msg) => (
                <div key={msg.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-start space-x-3">
                    {msg.file_type?.startsWith('image/') ? (
                      <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                        <img src={msg.file_url} alt={msg.file_name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-indigo-100 rounded flex items-center justify-center flex-shrink-0">
                        <FileText size={32} className="text-indigo-600" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <a 
                        href={msg.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium text-indigo-600 hover:underline block truncate"
                      >
                        {msg.file_name}
                      </a>
                      <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                        <span>{msg.user_name}</span>
                        <span>•</span>
                        <span>{formatTime(msg.created_at)}</span>
                        <span>•</span>
                        <span>{(msg.file_size / 1024).toFixed(1)} KB</span>
                      </div>
                      {msg.text && <p className="text-sm text-gray-600 mt-1">{msg.text}</p>}
                    </div>
                    
                    <a 
                      href={msg.file_url} 
                      download 
                      className="p-2 hover:bg-gray-200 rounded-lg flex-shrink-0"
                      title="Download"
                    >
                      <Download size={20} className="text-gray-600" />
                    </a>
                  </div>
                </div>
              ))}
              
              {recentFiles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No files shared yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-2xl font-bold">Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              <button
                onClick={() => setSettingsTab('account')}
                className={`px-6 py-3 font-medium ${settingsTab === 'account' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Account
              </button>
              <button
                onClick={() => setSettingsTab('password')}
                className={`px-6 py-3 font-medium ${settingsTab === 'password' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Password
              </button>
              <button
                onClick={() => setSettingsTab('notifications')}
                className={`px-6 py-3 font-medium ${settingsTab === 'notifications' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Notifications
              </button>
              <button
                onClick={() => setSettingsTab('about')}
                className={`px-6 py-3 font-medium ${settingsTab === 'about' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                About
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 140px)' }}>
              {settingsTab === 'account' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold mb-4">Account Settings</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <input
                      type="text"
                      value={settingsForm.name}
                      onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={settingsForm.email}
                      onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {auth.user?.is_admin && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-sm text-orange-800 font-medium">👑 Admin Account</p>
                    </div>
                  )}
                  <button
                    onClick={updateProfile}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-medium"
                  >
                    Save Changes
                  </button>
                </div>
              )}

              {settingsTab === 'password' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold mb-4">Change Password</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                    <input
                      type="password"
                      value={settingsForm.currentPassword}
                      onChange={(e) => setSettingsForm({ ...settingsForm, currentPassword: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                    <input
                      type="password"
                      value={settingsForm.newPassword}
                      onChange={(e) => setSettingsForm({ ...settingsForm, newPassword: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="At least 8 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={settingsForm.confirmPassword}
                      onChange={(e) => setSettingsForm({ ...settingsForm, confirmPassword: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    onClick={changePassword}
                    className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-medium"
                  >
                    Change Password
                  </button>
                </div>
              )}

              {settingsTab === 'notifications' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold mb-4">Notification Preferences</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">Desktop Notifications</p>
                        <p className="text-sm text-gray-600">Get notified about new messages</p>
                      </div>
                      <button
                        onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${notificationsEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'about' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold mb-4">About Team Sabi</h4>
                  <div className="space-y-3 text-gray-700">
                    <p><strong>Version:</strong> 1.0.0</p>
                    <p><strong>Team:</strong> {users.length + 1} members</p>
                    <p><strong>Channels:</strong> {channels.length}</p>
                    <p className="pt-4 text-sm text-gray-600">
                      Team Sabi is your team's communication platform. Built for collaboration, designed for productivity.
                    </p>
                    <p className="text-sm text-indigo-600 font-medium">
                      One Team. One Vision. 💪
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
