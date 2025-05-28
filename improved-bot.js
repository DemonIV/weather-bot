// Import required packages
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Get the bot token from environment or provide a value directly
const botToken = process.env.TELEGRAM_BOT_TOKEN || '7363640416:AAFWeeab1zy9sw-4N_DDf-aSCuNmky9YiL8';

// Gemini configuration
const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || 'doldurun';
const GEMINI_MODEL = "gemini-1.5-flash";

// API endpoints for Mastra integration
const MASTRA_AGENT_URL = 'http://localhost:5173/agents/telegramAgent/chat';
const GEMINI_DIRECT_URL = 'http://localhost:5173/gemini/chat';
const USE_GEMINI = true; // Always use Gemini

console.log('Starting Improved Telegram Bot with Gemini...');
console.log(`Using token (first 5 chars): ${botToken.substring(0, 5)}...`);
console.log(`Using Gemini API Key (first 5 chars): ${GEMINI_API_KEY.substring(0, 5)}...`);

// Initialize Gemini
let genAI, model;
try {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  console.log(`Gemini model initialized: ${GEMINI_MODEL}`);
} catch (error) {
  console.error('Error initializing Gemini:', error);
}

// Initialize the Telegram bot with polling
const bot = new TelegramBot(botToken, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10,
      allowed_updates: ["message", "callback_query"]
    }
  }
});

// Track conversation state for each user
const userStates = {};

// Simple response database
const responses = {
  greetings: [
    "Merhaba! Nasıl yardımcı olabilirim?",
    "Selam! Bugün size nasıl yardımcı olabilirim?",
    "Merhaba! Bunder Bot hizmetinizde. Nasıl yardımcı olabilirim?"
  ],
  help: [
    "Size şu konularda yardımcı olabilirim:\n- İş ortaklarıyla bağlantı kurma\n- Şirket bilgilerinizi yönetme\n- Potansiyel ortaklar hakkında bilgi alma\n\nLütfen ne tür bir yardıma ihtiyacınız olduğunu belirtin.",
    "Bunder Bot şunları yapabilir:\n- İş ortaklarıyla iletişim kurmanıza yardımcı olur\n- Şirket profilinizi yönetir\n- Potansiyel iş ortakları bulur\n\nDaha spesifik bir konuda yardım ister misiniz?"
  ],
  about: [
    "Ben Bunder Bot, işletmenize potansiyel iş ortakları bulmanıza yardımcı olmak için geliştirilmiş bir asistanım. Şirket profilinizi oluşturabilir ve benzer hedeflere sahip firmalarla bağlantı kurmanızı sağlayabilirim.",
    "Adım Bunder Bot. Amacım şirketlerin birbirleriyle iş ortaklığı kurmalarını kolaylaştırmak. Şirket bilgilerinizi kaydetmeme izin verirseniz, size uygun potansiyel iş ortakları önerebilirim."
  ],
  howItWorks: [
    "Sistem şöyle çalışır:\n1. Şirket bilgilerinizi kaydedersiniz\n2. İş hedeflerinizi ve ortak türünü belirtirsiniz\n3. Sistem size uygun eşleşmeleri bulur\n4. İletişime geçmek istediğiniz şirketlerle bağlantı kurarsınız",
    "Bot çalışma prensibi:\n1. Önce şirket profilinizi oluşturursunuz\n2. Hangi sektörde ve ne tür ortaklar aradığınızı belirtirsiniz\n3. Bot size uygun eşleşmeleri gösterir\n4. Beğendiğiniz şirketlerle iletişime geçebilirsiniz"
  ],
  unknown: [
    "Üzgünüm, bu konuda henüz bilgim yok. Size nasıl yardımcı olabilirim?",
    "Bu konuda yeterli bilgim yok maalesef. Başka nasıl yardımcı olabilirim?"
  ]
};

// Function to get response from Gemini
async function getGeminiResponse(message) {
  try {
    console.log(`Sending to Gemini: "${message.substring(0, 30)}..."`);
    
    // Re-initialize if needed
    if (!genAI || !model) {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    }
    
    const prompt = `
    Aşağıdaki kullanıcı mesajına Türkçe yanıt ver. 
    Sen bir iş ortaklığı bulmaya yardımcı olan Bunder Bot adında bir asistansın.
    Cevabın kısa ve net olsun. 150 kelimeyi geçme.
    
    Kullanıcı mesajı: "${message}"
    `;
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    if (text && text.length > 0) {
      console.log(`Gemini response (${text.length} chars): "${text.substring(0, 30)}..."`);
      return text;
    }
    
    console.warn('Gemini returned empty response, retrying...');
    const retryResult = await model.generateContent(prompt);
    const retryText = retryResult.response.text();
    
    if (retryText && retryText.length > 0) {
      return retryText;
    }
    
    throw new Error('Empty response after retry');
  } catch (error) {
    console.error('Gemini API error:', error);
    return getRandomResponse('unknown') + " (Gemini error)";
  }
}

// Function to get a random response from a category
function getRandomResponse(category) {
  const options = responses[category] || responses.unknown;
  return options[Math.floor(Math.random() * options.length)];
}

// Function to analyze user message and determine intent
function analyzeMessage(text) {
  text = text.toLowerCase();
  
  // Greetings
  if (text.match(/merhaba|selam|hey|sa|hello|hi|hola/)) {
    return 'greetings';
  }
  
  // Help requests
  if (text.match(/yardım|yardim|help|destek|nasıl|assist/)) {
    return 'help';
  }
  
  // About the bot
  if (text.match(/kimsin|nedir|nesin|adın|adin|ismin|hakkında|about|sen/)) {
    return 'about';
  }
  
  // How it works
  if (text.match(/nasıl çalış|nasil calis|how|sistem|çalışma|calisma|işleyiş|isleyis/)) {
    return 'howItWorks';
  }
  
  // Default - unknown intent
  return 'unknown';
}

// Try to connect to Mastra AI
async function tryMastraConnection(message, userId, context = []) {
  try {
    console.log(`Attempting to connect to Mastra AI: "${message.substring(0, 30)}..."`);
    
    const response = await fetch(MASTRA_AGENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        userId: userId,
        context: context
      }),
      // Set a timeout to avoid hanging
      timeout: 5000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      success: true,
      response: data.response || 'Mastra yanıt vermedi.'
    };
  } catch (error) {
    console.error('Mastra bağlantı hatası:', error);
    return {
      success: false,
      error: error
    };
  }
}

// Database of example companies for demo purposes
const exampleCompanies = [
  { name: "TechSoft", industry: "Yazılım", region: "İstanbul", size: "Orta", interests: "Teknoloji ortaklıkları" },
  { name: "GreenEnergy", industry: "Enerji", region: "Ankara", size: "Büyük", interests: "Yenilenebilir enerji projeleri" },
  { name: "LogiTrans", industry: "Lojistik", region: "İzmir", size: "Orta", interests: "Tedarik zinciri optimizasyonu" },
  { name: "FinanceHub", industry: "Finans", region: "İstanbul", size: "Küçük", interests: "Fintech çözümleri" },
  { name: "EcoFarm", industry: "Tarım", region: "Antalya", size: "Küçük", interests: "Sürdürülebilir tarım" }
];

// Bot command setup
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`New conversation started with user ${msg.from.id} (Chat ID: ${chatId})`);
  
  bot.sendMessage(
    chatId,
    'Merhaba! Bunder Telegram Bot\'una hoş geldiniz! 👋\n\n' +
    'Bu bot, potansiyel iş ortaklarıyla bağlantı kurmanıza yardımcı olacak. ' +
    'Aşağıdaki komutları kullanabilirsiniz:\n\n' +
    '/help - Yardım bilgisi\n' +
    '/about - Bot hakkında bilgi\n' +
    '/howitworks - Nasıl çalışır\n' +
    '/partners - Örnek iş ortakları'
  );
  
  // Reset user state
  userStates[chatId] = {
    lastCommand: 'start',
    conversationStage: 'initial'
  };
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, getRandomResponse('help'));
  userStates[chatId] = { lastCommand: 'help' };
});

bot.onText(/\/about/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, getRandomResponse('about'));
  userStates[chatId] = { lastCommand: 'about' };
});

bot.onText(/\/howitworks/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, getRandomResponse('howItWorks'));
  userStates[chatId] = { lastCommand: 'howItWorks' };
});

bot.onText(/\/partners/, (msg) => {
  const chatId = msg.chat.id;
  
  let response = "İşte size uygun olabilecek örnek iş ortakları:\n\n";
  
  exampleCompanies.forEach((company, index) => {
    response += `${index + 1}. *${company.name}*\n`;
    response += `   - Sektör: ${company.industry}\n`;
    response += `   - Konum: ${company.region}\n`;
    response += `   - Büyüklük: ${company.size}\n`;
    response += `   - İlgi Alanları: ${company.interests}\n\n`;
  });
  
  response += "Herhangi bir şirket hakkında daha fazla bilgi için şirket adını yazabilirsiniz.";
  
  bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  userStates[chatId] = { 
    lastCommand: 'partners',
    expectingCompanyName: true 
  };
});

// Handle regular messages
bot.on('message', async (msg) => {
  // Skip command messages (they're handled by the command handlers)
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  const chatId = msg.chat.id;
  const userId = `telegram:${chatId}`;
  const userState = userStates[chatId] || { lastCommand: null };
  
  console.log(`Received message: "${msg.text}" from Chat ID: ${chatId}`);
  
  // Show typing indicator
  bot.sendChatAction(chatId, 'typing');
  
  // If user was looking at partner list and might be asking about a company
  if (userState.expectingCompanyName && msg.text) {
    const companyName = msg.text.toLowerCase();
    const company = exampleCompanies.find(c => 
      c.name.toLowerCase().includes(companyName)
    );
    
    if (company) {
      bot.sendMessage(
        chatId,
        `*${company.name}* hakkında detaylı bilgi:\n\n` +
        `🏢 *Şirket*: ${company.name}\n` +
        `🔍 *Sektör*: ${company.industry}\n` +
        `📍 *Konum*: ${company.region}\n` +
        `📊 *Şirket Büyüklüğü*: ${company.size}\n` +
        `🤝 *İşbirliği İlgi Alanları*: ${company.interests}\n\n` +
        `Bu şirketle iletişime geçmek ister misiniz? (Evet/Hayır)`,
        { parse_mode: 'Markdown' }
      );
      
      userStates[chatId] = {
        lastCommand: 'companyDetail',
        selectedCompany: company.name,
        expectingConfirmation: true
      };
      return;
    }
  }
  
  // If expecting confirmation for contacting a company
  if (userState.expectingConfirmation && msg.text) {
    const answer = msg.text.toLowerCase();
    
    if (answer.includes('evet') || answer.includes('yes') || answer === 'e') {
      bot.sendMessage(
        chatId,
        `Harika! *${userState.selectedCompany}* ile iletişim talebiniz iletildi. ` +
        `En kısa sürede sizinle iletişime geçecekler.\n\n` +
        `Başka bir konuda yardıma ihtiyacınız var mı?`,
        { parse_mode: 'Markdown' }
      );
    } else {
      bot.sendMessage(
        chatId,
        `Anlaşıldı. Başka bir şirket hakkında bilgi almak isterseniz, ` +
        `tekrar /partners komutunu kullanabilirsiniz.`
      );
    }
    
    // Reset the expectation
    userStates[chatId] = { lastCommand: 'general' };
    return;
  }
  
  // Always use Gemini for all responses
  try {
    const geminiResponse = await getGeminiResponse(msg.text);
    bot.sendMessage(chatId, geminiResponse);
  } catch (error) {
    console.error('Error getting Gemini response:', error);
    bot.sendMessage(chatId, "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.");
  }
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Bot polling error:', error.message);
});

// Get bot info when connected
bot.getMe().then(botInfo => {
  console.log('Bot connected successfully to Telegram!');
  console.log(`Bot username: @${botInfo.username}`);
  console.log(`Bot name: ${botInfo.first_name}`);
  console.log('Bot is now running. Send a message to interact with it!');
});

// Keep script running
process.on('SIGINT', () => {
  console.log('Stopping bot...');
  bot.stopPolling();
  process.exit(0);
}); 