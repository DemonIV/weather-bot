import TelegramBot from 'node-telegram-bot-api';
import { CONFIG } from '../config';

// Node.js tiplerini ekle
import type { ProcessEnv } from 'node';
declare global {
  namespace NodeJS {
    interface Process {
      env: ProcessEnv;
    }
  }
}

// Global fetch API'sini tanımla
declare global {
  interface Window {
    fetch: (url: string, options?: any) => Promise<any>;
  }
  const fetch: (url: string, options?: any) => Promise<any>;
}

// Check if the bot token is available
if (!CONFIG.telegram.botToken || CONFIG.telegram.botToken === '') {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in environment variables');
  console.error('Please set the TELEGRAM_BOT_TOKEN environment variable in your .env.development file');
}

// Initialize the Telegram bot with proper options
const bot = new TelegramBot(CONFIG.telegram.botToken, { 
  polling: {
    params: {
      timeout: 30,
      allowed_updates: ["message", "callback_query"],
    },
    interval: 1000
  } 
});

// Log when bot is connected
bot.getMe().then(botInfo => {
  console.log('Telegram bot initialized:', botInfo.username);
  console.log('Bot token (first 5 chars):', CONFIG.telegram.botToken.substring(0, 5) + '...');
  
  // Set up debug output for all messages
  bot.on('message', (msg) => {
    console.log(`Debug: Received message from ${msg.from?.username || 'unknown'} (${msg.from?.id || 'unknown ID'}): ${msg.text || '[non-text content]'}`);
    try {
      console.log(`Message object properties: chatId=${msg.chat.id}, messageId=${msg.message_id}`);
    } catch (e) {
      console.log('Error logging message details');
    }
  });
  
  // Set up debug output for polling errors
  bot.on('polling_error', (error) => {
    console.error('Telegram polling error:', error.message);
    console.error('Full error stack:', error.stack);
  });
}).catch(error => {
  console.error('Failed to initialize Telegram bot:', error);
  console.error('Please check your TELEGRAM_BOT_TOKEN in .env.development file');
});

/**
 * Telegram bot service for handling messages
 */
export class TelegramService {
  /**
   * Get the Telegram bot instance
   * @returns Telegram bot instance
   */
  static getBot(): TelegramBot {
    return bot;
  }

  /**
   * Send a text message to a user
   * @param chatId Telegram chat ID
   * @param text Message text
   * @param options Additional message options
   * @returns Promise resolving to the sent message
   */
  static async sendMessage(
    chatId: number, 
    text: string, 
    options?: TelegramBot.SendMessageOptions
  ): Promise<TelegramBot.Message> {
    return bot.sendMessage(chatId, text, options);
  }

  /**
   * Send a message with a custom keyboard
   * @param chatId Telegram chat ID
   * @param text Message text
   * @param buttons Array of button texts
   * @returns Promise resolving to the sent message
   */
  static async sendMessageWithKeyboard(
    chatId: number,
    text: string,
    buttons: string[][]
  ): Promise<TelegramBot.Message> {
    const keyboard = {
      keyboard: buttons.map(row => row.map(button => ({ text: button }))),
      resize_keyboard: true,
      one_time_keyboard: true,
    };
    
    return bot.sendMessage(chatId, text, {
      reply_markup: keyboard,
    });
  }

  /**
   * Send a message with inline buttons
   * @param chatId Telegram chat ID
   * @param text Message text
   * @param buttons Array of button objects with text and callback_data
   * @returns Promise resolving to the sent message
   */
  static async sendMessageWithInlineKeyboard(
    chatId: number,
    text: string,
    buttons: Array<Array<{ text: string; callback_data: string }>>
  ): Promise<TelegramBot.Message> {
    return bot.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  }

  /**
   * Register a message handler
   * @param regex Regular expression to match messages
   * @param callback Function to handle matching messages
   */
  static onMessage(
    regex: RegExp,
    callback: (msg: TelegramBot.Message, match: RegExpExecArray | null) => void
  ): void {
    bot.onText(regex, callback);
  }

  /**
   * Register a callback query handler
   * @param callback Function to handle callback queries
   */
  static onCallbackQuery(
    callback: (query: TelegramBot.CallbackQuery) => void
  ): void {
    bot.on('callback_query', callback);
  }

  /**
   * Send a request to Gemini API
   * @param chatId Telegram chat ID
   * @param prompt User's prompt for Gemini API
   * @returns Promise resolving to API response
   */
  static async sendGeminiRequest(
    chatId: number,
    prompt: string
  ): Promise<void> {
    try {
      // Send typing indicator
      await bot.sendChatAction(chatId, 'typing');
      
      // Create request to Gemini API
      const apiKey = CONFIG.google.apiKey;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      
      // Log that we're making the request
      console.log(`Sending request to Gemini API with prompt: ${prompt.substring(0, 50)}...`);
      
      try {
        // Make the API request using global fetch
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }]
          }),
        });
        
        // Parse the response
        const data = await response.json();
        
        // Extract the text from the response
        let resultText = 'API yanıtı alınamadı.';
        
        if (data && data.candidates && data.candidates[0] && data.candidates[0].content) {
          resultText = data.candidates[0].content.parts[0].text || 'Yanıt metni bulunamadı.';
        }
        
        // Send the result back to the user
        await bot.sendMessage(chatId, resultText);
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        await bot.sendMessage(chatId, 'API isteği sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
      }
    } catch (error) {
      console.error('Gemini API request error:', error);
      await bot.sendMessage(chatId, 'Gemini API isteği sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
    }
  }
}
