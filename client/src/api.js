const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';

const request = async (url, options = {}, token = null) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Something went wrong.');
  }

  return payload;
};

export const apiRegister = (payload) => request(`${API_URL}/auth/register`, { method: 'POST', body: JSON.stringify(payload) });
export const apiLogin = (payload) => request(`${API_URL}/auth/login`, { method: 'POST', body: JSON.stringify(payload) });
export const apiFetchChats = (token) => request(`${API_URL}/chats`, { method: 'GET' }, token);
export const apiFetchMessages = (chatId, token) => request(`${API_URL}/messages/${chatId}`, { method: 'GET' }, token);
export const apiFetchAdminOverview = (token) => request(`${API_URL}/admin/overview`, { method: 'GET' }, token);
export const apiSendMessage = ({ message, chatId }, token = null) =>
  request(
    `${API_URL}/chat`,
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        chatId,
        userId: token ? undefined : 'guest'
      })
    },
    token
  );
