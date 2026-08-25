import express from 'express';
import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { fallbackStore } from '../data/fallbackStore.js';
import { requireAuth } from '../middleware/auth.js';
import { generateAssistantReply } from '../services/ai.js';
import { runPreprocessor } from '../services/preprocessor.js';
import { cache } from '../services/cache.js';

const router = express.Router();

const makeChatTitle = (message) => {
  const text = message.replace(/\s+/g, ' ').trim();
  return text.length > 40 ? `${text.slice(0, 37)}...` : text || 'New chat';
};

const chatPayload = (chat) => ({
  id: chat.id || chat._id,
  userId: chat.userId,
  title: chat.title,
  createdAt: chat.createdAt || chat.created_at,
  updatedAt: chat.updatedAt || chat.updated_at
});

const messagePayload = (message) => ({
  id: message.id || message._id,
  chatId: message.chatId,
  sender: message.sender,
  content: message.content,
  createdAt: message.createdAt || message.created_at
});

router.get('/chats', requireAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const chats = await Chat.find({ userId: req.user.id }).sort({ updatedAt: -1 });
      return res.json(chats.map(chatPayload));
    }

    const chats = fallbackStore.chats.filter((chat) => chat.userId === req.user.id);
    return res.json(chats.map(chatPayload));
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load chats.', error: error.message });
  }
});

router.get('/messages/:chatId', requireAuth, async (req, res) => {
  try {
    const { chatId } = req.params;

    if (mongoose.connection.readyState === 1) {
      const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
      return res.json(messages.map(messagePayload));
    }

    const messages = fallbackStore.messages.filter((message) => message.chatId === chatId);
    return res.json(messages.map(messagePayload));
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load messages.', error: error.message });
  }
});

router.post('/chat', async (req, res) => {
  try {
    const { message, chatId, userId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const currentUserId = req.user ? req.user.id : userId || 'guest';

    // Build a cache key per-user and normalized message
    const cacheKey = `resp:${currentUserId}:${message.trim().toLowerCase()}`;

    // 1) Quick cache check
    const cached = cache.get(cacheKey);
    if (cached) {
      // Ensure chat exists or create placeholder
      let activeChat = null;
      if (chatId) {
        activeChat = mongoose.connection.readyState === 1
          ? await Chat.findById(chatId)
          : fallbackStore.chats.find((c) => c.id === chatId || c._id === chatId);
      }

      if (!activeChat) {
        const chatData = {
          userId: currentUserId,
          title: (message || '').slice(0, 40) || 'New chat',
          createdAt: new Date(),
          updatedAt: new Date(),
          _id: mongoose.connection.readyState === 1 ? undefined : `chat_${Date.now()}`
        };

        activeChat = mongoose.connection.readyState === 1
          ? await Chat.create(chatData)
          : (() => { const c = { ...chatData, id: chatData._id }; fallbackStore.chats.push(c); return c; })();
      }

      // Save the user message and cached bot message to storage
      const userMessage = {
        chatId: activeChat.id || activeChat._id,
        sender: 'user',
        content: message.trim(),
        createdAt: new Date(),
        id: `msg_${Date.now()}`
      };

      const botMessage = {
        chatId: activeChat.id || activeChat._id,
        sender: 'bot',
        content: cached,
        createdAt: new Date(),
        id: `msg_${Date.now()+1}`
      };

      if (mongoose.connection.readyState === 1) {
        await Message.create(userMessage);
        await Message.create(botMessage);
        await Chat.findByIdAndUpdate(activeChat._id, { updatedAt: new Date(), title: (message || '').slice(0,40) });
      } else {
        fallbackStore.messages.push(userMessage);
        fallbackStore.messages.push(botMessage);
        const storedChat = fallbackStore.chats.find((chat) => (chat.id || chat._id) === (activeChat.id || activeChat._id));
        if (storedChat) {
          storedChat.title = (message || '').slice(0,40);
          storedChat.updatedAt = new Date();
        }
      }

      return res.status(200).json({ chat: chatPayload(activeChat), userMessage: messagePayload(userMessage), response: messagePayload(botMessage) });
    }

    // 2) Preprocessor to quickly answer common patterns
    const pre = runPreprocessor({ message });
    if (pre && pre.handled) {
      const botContent = pre.response;

      // create chat if needed
      let activeChat = null;
      if (chatId) {
        activeChat = mongoose.connection.readyState === 1
          ? await Chat.findById(chatId)
          : fallbackStore.chats.find((chat) => chat.id === chatId || chat._id === chatId);
      }

      if (!activeChat) {
        const chatData = {
          userId: currentUserId,
          title: makeChatTitle(message),
          createdAt: new Date(),
          updatedAt: new Date(),
          _id: mongoose.connection.readyState === 1 ? undefined : `chat_${Date.now()}`
        };

        if (mongoose.connection.readyState === 1) {
          activeChat = await Chat.create(chatData);
        } else {
          activeChat = { ...chatData, id: chatData._id };
          fallbackStore.chats.push(activeChat);
        }
      }

      const userMessage = {
        chatId: activeChat.id || activeChat._id,
        sender: 'user',
        content: message.trim(),
        createdAt: new Date(),
        id: `msg_${Date.now()}`
      };

      const botMessage = {
        chatId: activeChat.id || activeChat._id,
        sender: 'bot',
        content: botContent,
        createdAt: new Date(),
        id: `msg_${Date.now()+1}`
      };

      if (mongoose.connection.readyState === 1) {
        await Message.create(userMessage);
        await Message.create(botMessage);
        await Chat.findByIdAndUpdate(activeChat._id, { updatedAt: new Date(), title: makeChatTitle(message) });
      } else {
        fallbackStore.messages.push(userMessage);
        fallbackStore.messages.push(botMessage);
        const storedChat = fallbackStore.chats.find((chat) => (chat.id || chat._id) === (activeChat.id || activeChat._id));
        if (storedChat) {
          storedChat.title = makeChatTitle(message);
          storedChat.updatedAt = new Date();
        }
      }

      // cache result for 1 hour
      cache.set(cacheKey, botContent, 3600);

      return res.status(201).json({ chat: chatPayload(activeChat), userMessage: messagePayload(userMessage), response: messagePayload(botMessage) });
    }

    // 3) Fallback to AI reply (existing flow)
    let activeChat = null;
    if (chatId) {
      activeChat = mongoose.connection.readyState === 1
        ? await Chat.findById(chatId)
        : fallbackStore.chats.find((chat) => chat.id === chatId || chat._id === chatId);
    }

    if (!activeChat) {
      const chatData = {
        userId: currentUserId,
        title: makeChatTitle(message),
        createdAt: new Date(),
        updatedAt: new Date(),
        _id: mongoose.connection.readyState === 1 ? undefined : `chat_${Date.now()}`
      };

      if (mongoose.connection.readyState === 1) {
        activeChat = await Chat.create(chatData);
      } else {
        activeChat = { ...chatData, id: chatData._id };
        fallbackStore.chats.push(activeChat);
      }
    }

    const userMessage = {
      chatId: activeChat.id || activeChat._id,
      sender: 'user',
      content: message.trim(),
      createdAt: new Date(),
      id: `msg_${Date.now()}`
    };

    if (mongoose.connection.readyState === 1) {
      await Message.create(userMessage);
    } else {
      fallbackStore.messages.push(userMessage);
    }

    const recentMessages = mongoose.connection.readyState === 1
      ? await Message.find({ chatId: userMessage.chatId }).sort({ createdAt: -1 }).limit(6)
      : fallbackStore.messages.filter((entry) => entry.chatId === userMessage.chatId).slice(-6);

    const history = recentMessages
      .slice()
      .reverse()
      .map((entry) => ({ content: entry.content || entry.message || '' }));

    const aiReply = generateAssistantReply({
      message: message.trim(),
      context: history,
      user: req.user ? { name: req.user.name } : { name: 'Guest' }
    });

    const botMessage = {
      chatId: activeChat.id || activeChat._id,
      sender: 'bot',
      content: aiReply,
      createdAt: new Date(),
      id: `msg_${Date.now() + 1}`
    };

    if (mongoose.connection.readyState === 1) {
      await Message.create(botMessage);
    } else {
      fallbackStore.messages.push(botMessage);
    }

    if (mongoose.connection.readyState === 1) {
      await Chat.findByIdAndUpdate(activeChat._id, { updatedAt: new Date(), title: makeChatTitle(message) });
    } else {
      const storedChat = fallbackStore.chats.find((chat) => (chat.id || chat._id) === (activeChat.id || activeChat._id));
      if (storedChat) {
        storedChat.title = makeChatTitle(message);
        storedChat.updatedAt = new Date();
      }
    }

    // cache AI answers for similar queries for a short TTL (300s)
    cache.set(cacheKey, aiReply, 300);

    return res.status(201).json({
      chat: chatPayload(activeChat),
      userMessage: messagePayload(userMessage),
      response: messagePayload(botMessage)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to process chat message.', error: error.message });
  }
});

export default router;
