import { useEffect, useState } from 'react';
import { apiFetchAdminOverview, apiFetchChats, apiFetchMessages, apiLogin, apiRegister, apiSendMessage } from './api';

const guestLimit = 5;

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('chat-user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getStoredToken = () => localStorage.getItem('chat-token');
const getGuestCount = () => Number(localStorage.getItem('guest-message-count') || 0);

const formatTimestamp = (value) => {
  if (!value) return 'just now';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const renderMarkdown = (text = '') => {
  let source = escapeHtml(text);
  source = source.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  source = source.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  source = source.replace(/\*(.+?)\*/g, '<em>$1</em>');
  source = source.replace(/`([^`]+)`/g, '<code>$1</code>');
  source = source.replace(/\n\n/g, '<br /><br />');
  source = source.replace(/\n/g, '<br />');
  source = source.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
  source = source.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  source = source.replace(/###\s*(.+)/g, '<h3>$1</h3>');
  source = source.replace(/##\s*(.+)/g, '<h2>$1</h2>');
  return source;
};

function App() {
  const [currentUser, setCurrentUser] = useState(getStoredUser());
  const [token, setToken] = useState(getStoredToken());
  const [guestMode, setGuestMode] = useState(!getStoredUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [chatList, setChatList] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [guestCount, setGuestCount] = useState(getGuestCount());

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!currentUser && !guestMode) {
        setIsAuthModalOpen(true);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentUser, guestMode]);

  useEffect(() => {
    if (!currentUser || !token) return;

    const loadChats = async () => {
      try {
        const data = await apiFetchChats(token);
        setChatList(data || []);
        if (data?.length && !activeChatId) {
          setActiveChatId(data[0].id || data[0]._id);
        }
      } catch (error) {
        console.error('Unable to fetch chats', error);
      }
    };

    loadChats();
  }, [currentUser, token, activeChatId]);

  useEffect(() => {
    if (!currentUser || !token || currentUser.role !== 'admin') return;

    const loadAdminStats = async () => {
      try {
        const data = await apiFetchAdminOverview(token);
        setAdminStats(data);
      } catch (error) {
        console.error('Unable to load admin stats', error);
      }
    };

    loadAdminStats();
  }, [currentUser, token]);

  useEffect(() => {
    if (!activeChatId || !token) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const data = await apiFetchMessages(activeChatId, token);
        setMessages(data || []);
      } catch (error) {
        console.error('Unable to fetch messages', error);
      }
    };

    loadMessages();
  }, [activeChatId, token]);

  useEffect(() => {
    if (!isAuthModalOpen || currentUser) return;

    const timer = setTimeout(() => {
      setIsAuthModalOpen(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [isAuthModalOpen, currentUser]);

  const saveSession = (user, jwt) => {
    localStorage.setItem('chat-user', JSON.stringify(user));
    localStorage.setItem('chat-token', jwt);
    setCurrentUser(user);
    setToken(jwt);
    setGuestMode(false);
    setIsAuthModalOpen(false);
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    const { name, email, password } = authForm;

    if (!email || !password || (authMode === 'register' && !name)) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      const request = authMode === 'login'
        ? apiLogin({ email, password })
        : apiRegister({ name, email, password });

      const result = await request;
      saveSession(result.user, result.token);
      setAuthForm({ name: '', email: '', password: '' });
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSkip = () => {
    setGuestMode(true);
    setCurrentUser(null);
    localStorage.removeItem('chat-user');
    localStorage.removeItem('chat-token');
    setToken(null);
    setIsAuthModalOpen(false);
  };

  const handleSend = async () => {
    const trimmedMessage = input.trim();
    if (!trimmedMessage) return;

    if (!currentUser && guestCount >= guestLimit) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    setIsBotTyping(true);

    try {
      const result = await apiSendMessage({ message: trimmedMessage, chatId: activeChatId }, token);
      const chatId = result.chat?.id || result.chat?._id || activeChatId;

      if (!currentUser && result.chat) {
        setChatList((previous) => {
          const exists = previous.some((chat) => (chat.id || chat._id) === chatId);
          if (exists) return previous;
          return [{ ...result.chat, title: result.chat.title || trimmedMessage.slice(0, 30) }, ...previous];
        });
      }

      if (!currentUser) {
        const nextCount = guestCount + 1;
        setGuestCount(nextCount);
        localStorage.setItem('guest-message-count', String(nextCount));
      }

      const nextMessages = [
        ...(Array.isArray(result.userMessage) ? result.userMessage : [result.userMessage]),
        ...(Array.isArray(result.response) ? result.response : [result.response])
      ].filter(Boolean);

      setMessages((previous) => {
        const next = [
          ...previous,
          ...nextMessages.map((entry) => ({
            id: entry.id || entry._id,
            sender: entry.sender,
            content: entry.content,
            createdAt: entry.createdAt || new Date().toISOString()
          }))
        ];
        return next;
      });

      setActiveChatId(chatId);
      setInput('');
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
      setIsBotTyping(false);
    }
  };

  const handleCopy = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      console.warn('Clipboard copy unavailable.');
    }
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">Assistant</p>
            <h2>Finance + Study</h2>
          </div>
          <button className="new-chat-button" onClick={handleNewChat}>New chat</button>
        </div>

        <div className="chat-list">
          {chatList.length ? (
            chatList.map((chat) => (
              <button
                key={chat.id || chat._id}
                className={`chat-item ${activeChatId === (chat.id || chat._id) ? 'active' : ''}`}
                onClick={() => setActiveChatId(chat.id || chat._id)}
              >
                <span>{chat.title || 'Untitled chat'}</span>
                <small>{formatTimestamp(chat.updatedAt || chat.createdAt)}</small>
              </button>
            ))
          ) : (
            <div className="chat-item placeholder">
              {!currentUser ? 'Guest mode enabled' : 'Start a conversation'}
            </div>
          )}
        </div>

        <div className="user-badge">
          <span className="status-dot" />
          {currentUser ? currentUser.name : 'Guest user'}
        </div>

        {currentUser?.role === 'admin' && adminStats && (
          <div className="admin-panel">
            <h3>Owner access</h3>
            <div className="admin-stat">
              <span>Total users</span>
              <strong>{adminStats.totalUsers}</strong>
            </div>
            <div className="admin-stat">
              <span>Total logins</span>
              <strong>{adminStats.totalLogins}</strong>
            </div>
          </div>
        )}
      </aside>

      <main className="chat-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">AI mentor</p>
            <h1>Smart study & finance copilot</h1>
          </div>
          {!currentUser && (
            <div className="guest-limit">
              Guest messages: {guestCount}/{guestLimit}
            </div>
          )}
        </header>

        <div className="messages-panel">
          {messages.length ? (
            messages.map((message) => (
              <div key={message.id || `${message.sender}-${message.createdAt}`} className={`message-row ${message.sender === 'user' ? 'user' : 'bot'}`}>
                <div className="message-bubble">
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => handleCopy(message.content || '')}
                    aria-label="Copy message"
                  >
                    Copy
                  </button>
                  <div
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content || '') }}
                  />
                  <span className="timestamp">{formatTimestamp(message.createdAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <h3>How can I help today?</h3>
              <p>Try: “I spent $500 on food” or “Explain binary search for interview prep.”</p>
            </div>
          )}

          {isBotTyping && (
            <div className="message-row bot typing-row">
              <div className="message-bubble typing-bubble">
                <div className="typing-indicator" aria-label="Assistant typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="composer">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about budgeting, coding, or study plans..."
            rows={1}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <button className="send-button" onClick={handleSend} disabled={isSubmitting || !input.trim()}>
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
        </div>
      </main>

      {isAuthModalOpen && (
        <div className="auth-modal-backdrop">
          <div className="auth-modal">
            <h2>Welcome! Login or continue as guest</h2>
            <p>This popup stays visible for a few seconds so you can sign in or skip.</p>

            <div className="mode-tabs">
              <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Login</button>
              <button className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>Sign up</button>
            </div>

            <form onSubmit={handleAuthSubmit} className="auth-form">
              {authMode === 'register' && (
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Full name"
                />
              )}
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email address"
              />
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Password"
              />

              <div className="auth-actions">
                <button type="submit" className="primary-button">
                  {authMode === 'login' ? 'Login' : 'Create account'}
                </button>
                <button type="button" className="secondary-button" onClick={handleSkip}>Skip</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
