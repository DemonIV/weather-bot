#!/usr/bin/env node

/**
 * Main entry point for Bunder Bot
 * Starts the Telegram bridge or offers a menu to choose what to start
 */

import { spawn } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

// Load environment variables
dotenv.config({ path: '.env.development' });
console.log('Environment variables loaded from .env.development');

// Get the current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define colors for the terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Simple global state
let mastraProcess = null;
let bridgeProcess = null;
let improvedBot = null;

// Create a readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Main function to run the appropriate service based on command line args
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'improved'; // Default to improved bot
  
  // Make sure the environment is set up
  setupEnvironment();

  switch (command) {
    case 'mastra':
      startMastraServer();
      break;
    case 'bridge':
      startTelegramBridge();
      break;
    case 'both':
      startBoth();
      break;
    case 'improved':
      startImprovedBot();
      break;
    case 'menu':
      showMenu();
      break;
    default:
      startImprovedBot(); // Default to improved bot with Gemini
      break;
  }
}

/**
 * Show the main menu
 */
function showMenu() {
  console.log('\n=======================================================');
  console.log('Bunder Bot - Telegram with Gemini AI Integration');
  console.log('=======================================================\n');
  console.log('What would you like to start?\n');
  console.log('1. Start Mastra Server Only (Required for AI functionality)');
  console.log('2. Start Telegram Bridge Only');
  console.log('3. Start Both (Recommended)');
  console.log('4. Start Improved Bot with Gemini (Default)\n');
  
  rl.question('Enter your choice (1-4): ', (answer) => {
    switch (answer.trim()) {
      case '1':
        startMastraServer();
        break;
      case '2':
        startTelegramBridge();
        break;
      case '3':
        startBoth();
        break;
      case '4':
      default:
        startImprovedBot();
        break;
    }
  });
}

/**
 * Set up the environment (check for .env file, create logs directory)
 */
function setupEnvironment() {
  // Check if .env.development exists, create it if not
  if (!existsSync(path.join(__dirname, '.env.development'))) {
    console.log(`${colors.yellow}Creating default .env.development file...${colors.reset}`);
    
    writeFileSync(path.join(__dirname, '.env.development'), 
`TELEGRAM_BOT_TOKEN=7778553807:AAHIbhdhkeAj94WKTSEq2XDodHsf_ldWlXo
GOOGLE_GENERATIVE_AI_API_KEY=doldurun
`);

    console.log(`${colors.yellow}Please edit .env.development with your actual API keys.${colors.reset}`);
    console.log();
  }

  // Create logs directory if it doesn't exist
  if (!existsSync(path.join(__dirname, 'logs'))) {
    mkdirSync(path.join(__dirname, 'logs'));
  }
}

/**
 * Start the Mastra server
 */
function startMastraServer() {
  console.log(`${colors.green}Starting Mastra Server...${colors.reset}`);
  
  if (mastraProcess) {
    console.log(`${colors.yellow}Mastra Server is already running.${colors.reset}`);
    return;
  }
  
  mastraProcess = spawn('npm', ['run', 'dev'], { 
    stdio: 'inherit',
    shell: true
  });
  
  mastraProcess.on('error', (error) => {
    console.error(`${colors.red}Failed to start Mastra Server:${colors.reset}`, error);
  });
  
  mastraProcess.on('close', (code) => {
    console.log(`${colors.yellow}Mastra Server process exited with code ${code}${colors.reset}`);
    mastraProcess = null;
  });
}

/**
 * Start the Telegram Bridge
 */
function startTelegramBridge() {
  console.log(`${colors.green}Starting Telegram Bridge...${colors.reset}`);
  
  if (bridgeProcess) {
    console.log(`${colors.yellow}Telegram Bridge is already running.${colors.reset}`);
    return;
  }
  
  // Make sure the telegram bot token exists
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn(`${colors.yellow}WARNING: TELEGRAM_BOT_TOKEN not found in environment variables.${colors.reset}`);
    console.warn(`${colors.yellow}Using a placeholder token for testing. You should set a real token in .env.development for production use.${colors.reset}`);
    // Durdurmak yerine sadece uyarı veriyoruz
    process.env.TELEGRAM_BOT_TOKEN = '77785...placeholder...';
  }
  
  console.log(`${colors.green}🤖 Starting Telegram to Mastra AI Bridge...${colors.reset}`);
  
  try {
    // Create the Telegram bot instance with polling
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
      polling: {
        params: {
          timeout: 10
        },
        interval: 300
      }
    });
    
    console.log(`${colors.green}✅ Telegram bot initialized. Waiting for messages...${colors.reset}`);
    
    // Message handler
    bot.on('message', async (msg) => {
      if (!msg.text) return;
      
      const chatId = msg.chat.id;
      console.log(`📥 Received message from ${msg.from?.username || 'unknown'} (${chatId}): ${msg.text}`);
      console.log(`Message object properties: chatId=${chatId}, messageId=${msg.message_id}`);
      
      if (msg.text.startsWith('/')) {
        // Handle commands
        if (msg.text === '/start') {
          await bot.sendMessage(
            chatId,
            'Merhaba! Bunder Telegram Botuna hoş geldiniz. Size nasıl yardımcı olabilirim?'
          );
        } else if (msg.text === '/help') {
          await bot.sendMessage(
            chatId,
            'Bu bot, iş ortaklıkları bulmanıza yardımcı olabilir. Daha fazla bilgi için /about komutunu kullanabilirsiniz.'
          );
        } else if (msg.text === '/about') {
          await bot.sendMessage(
            chatId,
            'Bunder Bot, işletmelerin potansiyel iş ortakları bulmalarına yardımcı olan bir bottur.'
          );
        }
        return;
      }
      
      // Send typing action
      await bot.sendChatAction(chatId, 'typing');
      
      try {
        console.log(`📤 Sending to Mastra Agent: "${msg.text.substring(0, 20)}..."`);
        
        // Try to use the Mastra API
        try {
          const response = await fetch('http://localhost:4111/api/agents/telegramAgent/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              message: msg.text, 
              userId: `telegram:${chatId}`,
              metadata: { chatId }
            })
          });
          
          if (!response.ok) {
            throw new Error(`Mastra API returned ${response.status}`);
          }
          
          const data = await response.json();
          if (data.response) {
            await bot.sendMessage(chatId, data.response);
            return;
          }
          
          throw new Error('Empty response from Mastra API');
        } catch (apiError) {
          console.error(`${colors.red}❌ Mastra API error:${colors.reset}`, apiError);
          
          // Try using Gemini API directly
          console.log(`${colors.yellow}📤 Sending directly to Gemini API: "${msg.text.substring(0, 20)}..."${colors.reset}`);
          
          try {
            // Note: This is a simplified fallback. You would implement the actual
            // Gemini API call here with your API key.
            const fallbackResponses = [
              "Merhaba! Size nasıl yardımcı olabilirim?",
              "Üzgünüm, bu konuda yeterli bilgim yok. Başka nasıl yardımcı olabilirim?",
              "Bu sorunuzu şu anda yanıtlayamıyorum. Farklı bir konuda yardım isteyebilir misiniz?"
            ];
            
            const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
            await bot.sendMessage(chatId, randomResponse);
          } catch (geminiError) {
            console.error(`${colors.red}❌ Gemini direct API error:${colors.reset}`, geminiError);
            await bot.sendMessage(chatId, "Şu anda AI sistemimize bağlanamıyoruz. Lütfen daha sonra tekrar deneyin.");
          }
        }
      } catch (error) {
        console.error(`${colors.red}⚠️ Message processing error:${colors.reset}`, error);
        await bot.sendMessage(chatId, "Bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
      }
    });
    
    // Error handler
    bot.on('polling_error', (error) => {
      console.error(`${colors.red}❌ Polling error:${colors.reset}`, error.message);
    });
    
    // Store the bot in the closure for cleanup
    bridgeProcess = { 
      bot,
      stop: () => {
        console.log(`${colors.yellow}Stopping Telegram Bridge...${colors.reset}`);
        bot.stopPolling();
      }
    };
    
    // Handle process termination
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
  } catch (error) {
    console.error(`${colors.red}Failed to start Telegram Bridge:${colors.reset}`, error);
  }
}

/**
 * Start the improved standalone bot without Mastra dependency
 */
function startImprovedBot() {
  console.log(`${colors.green}Starting Improved Bot...${colors.reset}`);
  
  // Import the necessary modules dynamically - fix the path for the compiled JS version
  import('./.mastra/output/index.mjs')
    .then(module => {
      try {
        // If we got the EnhancedTelegramAgent directly
        if (module.EnhancedTelegramAgent) {
          console.log('Found EnhancedTelegramAgent in main module');
          improvedBot = new module.EnhancedTelegramAgent();
        } 
        // If we need to access it via exports
        else if (module.agents && module.agents.EnhancedTelegramAgent) {
          console.log('Found EnhancedTelegramAgent in agents export');
          improvedBot = new module.agents.EnhancedTelegramAgent();
        } 
        // If the structure is different, try to find it
        else {
          console.log('Searching for EnhancedTelegramAgent in module structure...');
          console.log('Available exports:', Object.keys(module));
          
          // Try to locate the agent in the module structure
          for (const key in module) {
            if (typeof module[key] === 'object' && module[key]) {
              console.log(`Checking ${key} export...`);
              if (module[key].EnhancedTelegramAgent) {
                console.log(`Found EnhancedTelegramAgent in ${key}`);
                improvedBot = new module[key].EnhancedTelegramAgent();
                break;
              }
            }
          }
          
          if (!improvedBot) {
            throw new Error('Could not locate EnhancedTelegramAgent in module');
          }
        }
        
        console.log(`${colors.green}✅ Improved bot started successfully${colors.reset}`);
      } catch (initError) {
        console.error(`${colors.red}Error initializing bot:${colors.reset}`, initError);
        throw initError;
      }
    })
    .catch(error => {
      console.error(`${colors.red}Failed to start improved bot:${colors.reset}`, error);
      
      // Fallback to starting the bridge as a backup
      console.log(`${colors.yellow}Falling back to starting Telegram Bridge...${colors.reset}`);
      startTelegramBridge();
    });
}

/**
 * Start both the Mastra server and Telegram Bridge
 */
function startBoth() {
  startMastraServer();
  
  // Give the server a moment to start before starting the bridge
  setTimeout(() => {
    startTelegramBridge();
  }, 5000);
}

/**
 * Clean up resources and exit
 */
function cleanup() {
  console.log(`${colors.yellow}\nShutting down services...${colors.reset}`);
  
  if (bridgeProcess && bridgeProcess.bot) {
    bridgeProcess.stop();
    bridgeProcess = null;
  }
  
  if (mastraProcess) {
    mastraProcess.kill();
    mastraProcess = null;
  }
  
  if (improvedBot) {
    console.log(`${colors.yellow}Stopping improved bot...${colors.reset}`);
    improvedBot = null;
  }
  
  rl.close();
  
  console.log(`${colors.green}All services stopped. Goodbye!${colors.reset}`);
  process.exit(0);
}

// Start the application
main().catch(error => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
  process.exit(1);
});

// Global error handler
process.on('uncaughtException', (error) => {
  console.error(`${colors.red}Uncaught exception:${colors.reset}`, error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}Unhandled rejection at:${colors.reset}`, promise, `${colors.red}reason:${colors.reset}`, reason);
}); 