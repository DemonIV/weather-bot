import { TelegramService } from './utils/telegram';

// Check for required environment variables
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
];

// Check for missing environment variables but don't exit
for (const varName of requiredEnvVars) {
  if (!process.env[varName] || process.env[varName] === 'your-api-key') {
    console.warn(`Missing environment variable: ${varName}`);
  }
}

// Initialize the application
async function init() {
  try {
    console.log('Starting Telegram agent...');
    
    // Get the Telegram bot
    const bot = TelegramService.getBot();
    
    // Test message to verify bot is working
    console.log('Testing Telegram bot...');
    try {
      const testResult = await bot.getMe();
      console.log('Bot info:', testResult);
      console.log('Bot is working correctly!');
    } catch (error) {
      console.error('Error testing bot:', error);
    }
    
    // Register message handlers
    bot.on('message', async (msg) => {
      console.log('Received message:', msg.text, 'from:', msg.from?.username);
      
      try {
        // Handle start command
        if (msg.text?.startsWith('/start')) {
          await TelegramService.sendMessage(
            msg.chat.id,
            'Merhaba! Ben Mastra ERP botuyum. Size nasıl yardımcı olabilirim?'
          );
          return;
        }
        
        // Handle Gemini API command
        if (msg.text?.startsWith('/gemini ')) {
          const prompt = msg.text.substring('/gemini '.length).trim();
          if (prompt) {
            await TelegramService.sendMessage(msg.chat.id, 'Gemini API yanıtınız hazırlanıyor...');
            await TelegramService.sendGeminiRequest(msg.chat.id, prompt);
          } else {
            await TelegramService.sendMessage(
              msg.chat.id,
              'Lütfen bir istek girin. Örnek: /gemini Yapay zeka nasıl çalışır?'
            );
          }
          return;
        }
        
        // Handle other messages
        if (msg.text) {
          await TelegramService.sendMessage(
            msg.chat.id,
            `Mesajınızı aldım: "${msg.text}"\nNasıl yardımcı olabilirim?`
          );
        }
      } catch (error) {
        console.error('Error handling message:', error);
        try {
          await TelegramService.sendMessage(
            msg.chat.id,
            'Mesajınızı işlerken bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
          );
        } catch (sendError) {
          console.error('Error sending error message:', sendError);
        }
      }
    });
    
    // Log successful initialization
    console.log(`Telegram bot initialized with username: ${(await bot.getMe()).username}`);
    console.log('Bot is now listening for messages');
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log('Stopping bot...');
      bot.stopPolling();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error initializing application:', error);
    console.error('Please make sure your environment variables are set correctly in .env.development file');
  }
}

// Start the application
init().catch(error => {
  console.error('Unhandled error during initialization:', error);
});
