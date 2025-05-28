#!/usr/bin/env node

/**
 * Telegram to Mastra Bridge (ESM version)
 * Direct integration between Telegram and Mastra AI
 */

// Import required packages
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path from 'path';

// Initialize environment variables from .env.development
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env.development') });

// Startup message
console.log('🤖 Starting Telegram to Mastra AI Bridge...');

// Check for required environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token || token === 'your-telegram-bot-token') {
  console.error('❌ ERROR: TELEGRAM_BOT_TOKEN is not set in environment variables');
  console.error('Please set the TELEGRAM_BOT_TOKEN in your .env.development file');
  process.exit(1);
}

// API endpoints for Mastra integration
const MASTRA_AGENT_URL = 'http://localhost:5173/agents/telegramAgent/chat';
const GEMINI_DIRECT_URL = 'http://localhost:5173/gemini/chat';

// Initialize the Telegram bot with polling
const bot = new TelegramBot(token, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    },
    allowed_updates: ["message", "callback_query"],
  }
});

console.log('✅ Telegram bot initialized. Waiting for messages...');

// Track user sessions
const userSessions = {};

// Handle /start command
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    'Hoşgeldiniz! Ben hava durumu bilgisi botuyum. Size güncel hava durumu bilgilerini sunabilirim.\n\n' +
    'Hangi şehrin hava durumunu öğrenmek istersiniz?'
  );

  // Log user info
  console.log(`👤 New user started: ${msg.from.username || 'Anonymous'} (ID: ${chatId})`);
  
  // Initialize user session
  userSessions[chatId] = {
    userId: `telegram:${chatId}`,
    lastInteraction: Date.now(),
    context: []
  };
});

// Handle /help command
bot.onText(/^\/help$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    'Kullanabileceğiniz komutlar:\n\n' +
    '/start - Botu başlat\n' +
    '/help - Yardım menüsünü göster\n' +
    '/clear - Konuşma geçmişini temizle\n\n' +
    'Herhangi bir soru sorabilir veya benimle sohbet edebilirsiniz. Doğrudan Mastra AI ile bağlantılıyım.'
  );
});

// Handle /clear command
bot.onText(/^\/clear$/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Reset user session context
  if (userSessions[chatId]) {
    userSessions[chatId].context = [];
  }
  
  await bot.sendMessage(
    chatId,
    'Konuşma geçmişiniz temizlendi. Yeni bir sohbete başlayabilirsiniz.'
  );
});

// Handle all messages
bot.on('message', async (msg) => {
  // Skip commands (they're handled separately)
  if (msg.text && (msg.text.startsWith('/start') || msg.text.startsWith('/help') || msg.text.startsWith('/clear'))) {
    return;
  }
  
  if (msg.text) {
    const chatId = msg.chat.id;
    const userId = `telegram:${chatId}`;
    
    // Show typing indicator
    bot.sendChatAction(chatId, 'typing');
    
    // Initialize user session if it doesn't exist
    if (!userSessions[chatId]) {
      userSessions[chatId] = {
        userId: userId,
        lastInteraction: Date.now(),
        context: []
      };
    }
    
    try {
      // Add user message to conversation context
      userSessions[chatId].context.push({
        role: 'user',
        content: msg.text
      });
      
      // Keep only the last 10 messages in context (to prevent token overflow)
      if (userSessions[chatId].context.length > 10) {
        userSessions[chatId].context = userSessions[chatId].context.slice(-10);
      }
      
      // Send message to Mastra AI
      const response = await sendToMastraAgent(msg.text, userId, userSessions[chatId].context);
      
      // Send response to user
      await bot.sendMessage(chatId, response);
      
      // Add AI response to conversation context
      userSessions[chatId].context.push({
        role: 'assistant',
        content: response
      });
      
      // Update last interaction time
      userSessions[chatId].lastInteraction = Date.now();
    } catch (error) {
      console.error('⚠️ Message processing error:', error);
      
      // Create fallback response for errors
      let errorMessage = 'Üzgünüm, mesajınızı işlerken bir hata oluştu.';
      
      // Try using Gemini API directly if Mastra server connection fails
      try {
        if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
          errorMessage += ' Yedek sistemi deniyorum...';
          await bot.sendMessage(chatId, errorMessage);
          
          // Connect to Gemini API directly (fallback)
          const fallbackResponse = await sendToGeminiDirect(msg.text);
          await bot.sendMessage(chatId, fallbackResponse);
          return;
        }
      } catch (fallbackError) {
        console.error('⚠️ Fallback system error:', fallbackError);
      }
      
      // If all fails, send generic error message
      await bot.sendMessage(
        chatId,
        errorMessage + ' Lütfen daha sonra tekrar deneyin.'
      );
    }
  }
});

// Send message to Mastra Agent API
async function sendToMastraAgent(message, userId, context = []) {
  try {
    console.log(`📤 Sending to Mastra Agent: "${message.substring(0, 50)}..."`);
    
    const response = await fetch(MASTRA_AGENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        userId: userId,
        context: context.slice(-5) // Send last 5 messages as context
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.response || 'Mastra yanıt vermedi.';
  } catch (error) {
    console.error('❌ Mastra API error:', error);
    throw error; // Pass error to main handler
  }
}

// Send message directly to Gemini (fallback)
async function sendToGeminiDirect(prompt) {
  try {
    console.log(`📤 Sending directly to Gemini API: "${prompt.substring(0, 50)}..."`);
    
    const response = await fetch(GEMINI_DIRECT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: prompt
      }),
    });
    
    if (!response.ok) {
      return 'Gemini API ile bağlantı kurulamadı. Lütfen daha sonra tekrar deneyin.';
    }
    
    const data = await response.json();
    return data.response || 'Gemini yanıt vermedi.';
  } catch (error) {
    console.error('❌ Gemini direct API error:', error);
    return 'Şu anda AI sistemimize bağlanamıyoruz. Lütfen daha sonra tekrar deneyin.';
  }
}

// Clean up old sessions periodically
setInterval(() => {
  const now = Date.now();
  const timeout = 3600000; // 1 hour
  
  Object.keys(userSessions).forEach(chatId => {
    if (now - userSessions[chatId].lastInteraction > timeout) {
      delete userSessions[chatId];
      console.log(`🧹 Session ${chatId} cleaned up due to inactivity`);
    }
  });
}, 1800000); // Check every 30 minutes

// Log polling errors
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.message);
});

// Handle process shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
}); 