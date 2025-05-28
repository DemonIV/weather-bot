import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import { getGeminiResponse } from './gemini';
import { CONFIG } from '../src/config';

// Single bot instance to prevent polling conflicts
let bot: TelegramBot | null = null;

export class TelegramService {
  /**
   * Get or create the Telegram bot instance
   */
  static getBot(): TelegramBot {
    if (!bot) {
      const token = CONFIG.telegram.token;
      
      if (!token || token.includes('placeholder')) {
        console.warn('WARNING: Invalid Telegram bot token. Using hardcoded token for reliability.');
        // Geçici çözüm olarak doğrudan token kullanıyoruz
        const hardcodedToken = "7778553807:AAHIbhdhkeAj94WKTSEq2XDodHsf_ldWlXo";
        
        try {
          // Hardcoded token ile bot oluşturuyoruz
          bot = new TelegramBot(hardcodedToken, {
            polling: {
              params: {
                timeout: 10
              },
              interval: 300
            }
          });
          
          console.log(`Telegram bot initialized with hardcoded token: ${hardcodedToken.substring(0, 5)}...`);
        } catch (tokenError) {
          console.error('Failed to initialize with hardcoded token:', tokenError);
          bot = createMockBot();
        }
      } else {
        try {
          // Create the bot with webhooks disabled (polling mode)
          // Set polling options to prevent conflicts
          bot = new TelegramBot(token, {
            polling: {
              params: {
                timeout: 10
              },
              interval: 300
            }
          });

          // Log startup info
          console.log(`Telegram bot initialized: ${token ? 'token exists' : 'placeholder token'}`);
          console.log(`Bot token (first 5 chars): ${token.substring(0, 5)}...`);
          
          // Polling hataları için hata yönetimi ekliyoruz
          bot.on('polling_error', (error: any) => {
            // Kritik hatalar için
            if (error.code === 'EFATAL' && error.message?.includes('Token not provided')) {
              console.error('Critical Telegram bot error: Token not working properly');
              console.error('Please set a valid TELEGRAM_BOT_TOKEN in .env.development');
              // Durdurmayacağız, sadece hatayı loglayacağız
            } else {
              console.warn(`Telegram polling error: ${error.message || 'Unknown error'}`);
            }
          });
          
        } catch (error) {
          console.error('Failed to initialize Telegram bot:', error);
          // Hata oluşursa, geçici bir sahte bot oluşturuyoruz
          // Bu, uygulamanın çökmesini önleyerek diğer işlevlerin çalışmasına olanak tanır
          bot = createMockBot();
        }
      }
    }
    return bot;
  }

  /**
   * Send a message to a chat
   */
  static async sendMessage(
    chatId: number | string,
    text: string,
    options?: TelegramBot.SendMessageOptions
  ): Promise<TelegramBot.Message> {
    const telegramBot = this.getBot();
    try {
      const message = await telegramBot.sendMessage(chatId, text, options);
      console.log(`Message sent to ${chatId}: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`);
      return message;
    } catch (error) {
      console.error(`Error sending message to ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Register a message handler for a specific pattern
   */
  static onMessage(
    pattern: RegExp,
    callback: (msg: TelegramBot.Message) => void
  ): void {
    const telegramBot = this.getBot();
    telegramBot.onText(pattern, callback);
  }

  /**
   * Register a callback query handler
   */
  static onCallbackQuery(
    callback: (query: TelegramBot.CallbackQuery) => void
  ): void {
    const telegramBot = this.getBot();
    telegramBot.on('callback_query', callback);
  }

  /**
   * Send a request to the Gemini API
   */
  static async sendGeminiRequest(chatId: number, message: string): Promise<void> {
    try {
      console.log(`📤 Sending message to Gemini API: "${message.substring(0, 20)}..."`);
      
      // First try direct Gemini integration
      try {
        const response = await getGeminiResponse(message);
        if (response) {
          await this.sendMessage(chatId, response);
          return;
        }
      } catch (directError) {
        console.warn("Direct Gemini helper error:", directError);
      }
      
      // Fallback to Mastra API if available
      try {
        // Use the configured port for the API endpoint
        const apiUrl = `http://localhost:${CONFIG.server.port}/api/agents/telegramAgent/chat`;
        console.log(`Attempting to connect to Mastra API at: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message, 
            userId: `telegram:${chatId}`,
            metadata: { chatId }
          })
        });
        
        if (!response.ok) {
          throw new Error(`Mastra API returned ${response.status}`);
        }
        
        // Add proper typing to the response data
        interface MastraResponse {
          response?: string;
          error?: string;
        }
        
        const data = await response.json() as MastraResponse;
        if (data.response) {
          await this.sendMessage(chatId, data.response);
        } else {
          throw new Error('Empty response from Mastra API');
        }
      } catch (apiError) {
        console.error('❌ Mastra API error:', apiError);
        throw apiError;
      }
    } catch (error) {
      console.error('Error sending Gemini request:', error);
      throw error;
    }
  }

  /**
   * Safely stop the bot polling to prevent conflicts
   */
  static stopBot(): void {
    if (bot) {
      try {
        bot.stopPolling();
        console.log('Telegram bot polling stopped');
      } catch (error) {
        console.error('Error stopping Telegram bot:', error);
      }
      bot = null;
    }
  }
}

/**
 * Create a mock bot for testing when real token isn't available
 * This prevents the application from crashing
 */
function createMockBot(): TelegramBot {
  const mockBot = {
    sendMessage: (chatId: number | string, text: string) => {
      console.log(`MOCK BOT - Would send to ${chatId}: ${text.substring(0, 30)}...`);
      return Promise.resolve({} as TelegramBot.Message);
    },
    sendChatAction: () => Promise.resolve(true),
    getMe: () => Promise.resolve({ username: 'mock_bot' } as TelegramBot.User),
    on: () => mockBot,
    onText: () => mockBot,
    stopPolling: () => Promise.resolve()
  } as unknown as TelegramBot;
  
  return mockBot;
} 