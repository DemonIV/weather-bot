/**
 * Standalone Bot - Mastra'ya bağımlı olmadan çalışan Telegram botu
 * Bu dosya doğrudan tokenları içerir ve Mastra framework'ünü kullanmadan çalışır
 */

import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// .env dosyalarını yükle
dotenv.config({ path: '.env.development' });

// Token'lar - kodda sabit olmalarını istemiyorsanız bunları .env dosyasına taşıyın
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "7778553807:AAHIbhdhkeAj94WKTSEq2XDodHsf_ldWlXo";
const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "doldurun";
const GEMINI_MODEL = "gemini-1.5-flash";

// Renkli konsol çıktıları için yardımcı işlevler
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m', 
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

console.log(`${colors.green}Bunder Bot başlatılıyor...${colors.reset}`);
console.log(`Telegram Token: ${TELEGRAM_TOKEN.substring(0, 5)}...`);
console.log(`Gemini API Key: ${GEMINI_API_KEY.substring(0, 5)}...`);

// Track conversation state for each user
const userStates = {};

// Simple response database for different intents
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
  ],
  error: [
    "Üzgünüm, bir sorun oluştu. Lütfen tekrar deneyin.",
    "Şu anda sistemde bir yoğunluk var. Kısa bir süre sonra tekrar deneyebilir misiniz?"
  ]
};

// Örnek şirketler
const exampleCompanies = [
  { name: "TechSoft", industry: "Yazılım", region: "İstanbul", size: "Orta", interests: "Teknoloji ortaklıkları" },
  { name: "GreenEnergy", industry: "Enerji", region: "Ankara", size: "Büyük", interests: "Yenilenebilir enerji projeleri" },
  { name: "LogiTrans", industry: "Lojistik", region: "İzmir", size: "Orta", interests: "Tedarik zinciri optimizasyonu" },
  { name: "FinanceHub", industry: "Finans", region: "İstanbul", size: "Küçük", interests: "Fintech çözümleri" },
  { name: "EcoFarm", industry: "Tarım", region: "Antalya", size: "Küçük", interests: "Sürdürülebilir tarım" }
];

// Gemini AI istemcisini oluştur
let genAI, model;
try {
  console.log(`Gemini AI API istemcisi oluşturuluyor... API Anahtarı: ${GEMINI_API_KEY.substring(0, 7)}...`);
  console.log(`Kullanılan model: ${GEMINI_MODEL}`);
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  console.log('Gemini AI istemcisi başarıyla oluşturuldu.');
} catch (initError) {
  console.error('Gemini AI istemcisi oluşturulurken hata:', initError);
  // Continue anyway, we'll handle errors in the getGeminiResponse function
}

// Test Gemini connectivity on startup
async function testGeminiConnectivity() {
  try {
    console.log('Gemini API bağlantısı test ediliyor...');
    const testPrompt = "Merhaba, bu bir test mesajıdır.";
    const result = await model.generateContent(testPrompt);
    const text = result.response.text();
    console.log(`Gemini API bağlantı testi başarılı! Yanıt: "${text.substring(0, 30)}..."`);
    return true;
  } catch (testError) {
    console.error('Gemini API bağlantı testi başarısız:', testError.message);
    if (testError.status) {
      console.error(`HTTP Durum kodu: ${testError.status}`);
    }
    return false;
  }
}

// Run connection test but don't block startup
let geminiAvailable = true; // Changed to true by default
testGeminiConnectivity().then(result => {
  geminiAvailable = result;
  console.log(`Gemini API durumu: ${geminiAvailable ? 'Aktif ✅' : 'Devre dışı ❌'}`);
});

/**
 * Get a response from the Gemini API for a given message
 */
async function getGeminiResponse(message) {
  // Always try to use Gemini regardless of previous availability status
  try {
    console.log(`Gemini API'ye gönderiliyor: "${message.substring(0, 20)}..."`);
    
    // Check if genAI and model were initialized properly
    if (!genAI || !model) {
      console.error('Gemini AI istemcisi düzgün başlatılmadı, yeniden başlatılıyor...');
      // Re-initialize Gemini
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    }
    
    const prompt = `
    Aşağıdaki kullanıcı mesajına Türkçe yanıt ver. 
    Sen bir iş ortaklığı bulmaya yardımcı olan Bunder Bot adında bir asistansın.
    Cevabın kısa ve net olsun. 150 kelimeyi geçme.
    
    Kullanıcı mesajı: "${message}"
    `;
    
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      if (text && text.length > 0) {
        console.log(`Gemini yanıtı (${text.length} karakter): "${text.substring(0, 30)}..."`);
        geminiAvailable = true; // Update status since it's working
        return text;
      }
      
      console.warn('Gemini API boş yanıt döndü, tekrar deneniyor...');
      // Retry once before giving up
      const retryResult = await model.generateContent(prompt);
      const retryText = retryResult.response.text();
      
      if (retryText && retryText.length > 0) {
        console.log(`Gemini yanıtı (retry) (${retryText.length} karakter): "${retryText.substring(0, 30)}..."`);
        return retryText;
      }
      
      throw new Error('Gemini empty response after retry');
    } catch (innerError) {
      console.error('Gemini API iç hata:', innerError);
      
      // Always try again even after errors
      geminiAvailable = true;
      
      return getSimulatedAIResponse(message);
    }
  } catch (error) {
    console.error('Gemini API hatası:', error);
    return getSimulatedAIResponse(message);
  }
}

/**
 * Generate a simulated AI response when Gemini is not available
 */
function getSimulatedAIResponse(message) {
  console.log('Simüle edilmiş AI yanıtı oluşturuluyor...');
  
  // Get the intent to provide more targeted response
  const intent = analyzeMessage(message);
  
  // Common responses based on message content
  if (message.includes('gemini') || message.includes('calismiyor') || message.includes('çalışmıyor')) {
    return "Şu anda Gemini AI servisine erişimde sorun yaşıyoruz. Bu sorunu çözmek için çalışıyoruz. " + 
           "Bu arada size başka nasıl yardımcı olabilirim?";
  }
  
  if (message.includes('merhaba') || message.includes('selam')) {
    return "Merhaba! Ben Bunder asistanı. Gemini AI entegrasyonumuzda şu anda teknik bir sorun var, " +
           "ancak temel sorularınıza yardımcı olabilirim. Nasıl yardımcı olabilirim?";
  }
  
  if (message.includes('yardım') || message.includes('help')) {
    return "Bunder Bot olarak şu hizmetleri sunuyorum:\n" +
           "- İş ortaklarıyla bağlantı kurma\n" +
           "- Şirket bilgilerinizi yönetme\n" +
           "- Potansiyel ortaklar hakkında bilgi sağlama\n\n" +
           "Şu anda AI servisimiz geçici olarak kullanılamıyor, ancak temel isteklerinize yardımcı olabilirim.";
  }
  
  // Standard fallback response
  return "Üzgünüm, şu anda Gemini AI servisine erişemiyorum. " +
         "Temel komutlarımız hala çalışıyor: /help, /about, /partners. " +
         "Bu komutları kullanarak devam etmek ister misiniz?";
}

/**
 * Belirli bir kategoriden rastgele yanıt döndür
 */
function getRandomResponse(category) {
  const options = responses[category] || responses.unknown;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Mesajı analiz ederek niyeti belirle
 */
function analyzeMessage(text) {
  const lowercaseText = text.toLowerCase();
  
  // Selamlaşma
  if (lowercaseText.match(/merhaba|selam|hey|sa|hello|hi|hola/)) {
    return 'greetings';
  }
  
  // Yardım istekleri
  if (lowercaseText.match(/yardım|yardim|help|destek|nasıl|assist/)) {
    return 'help';
  }
  
  // Bot hakkında
  if (lowercaseText.match(/kimsin|nedir|nesin|adın|adin|ismin|hakkında|about|sen/)) {
    return 'about';
  }
  
  // Nasıl çalışır
  if (lowercaseText.match(/nasıl çalış|nasil calis|how|sistem|çalışma|calisma|işleyiş|isleyis/)) {
    return 'howItWorks';
  }
  
  // Varsayılan - bilinmeyen niyet
  return 'unknown';
}

// Telegram botunu başlat
try {
  const bot = new TelegramBot(TELEGRAM_TOKEN, {
    polling: {
      params: {
        timeout: 10
      },
      interval: 300
    }
  });
  
  console.log(`${colors.green}Telegram Bot başarıyla başlatıldı!${colors.reset}`);
  
  // /start komutunu işle
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`/start komutu alındı, kullanıcı: ${chatId}`);
    
    await bot.sendMessage(
      chatId,
      'Merhaba! Bunder Telegram Bot\'una hoş geldiniz! 👋\n\n' +
      'Bu bot, potansiyel iş ortaklarıyla bağlantı kurmanıza yardımcı olacak. ' +
      'Aşağıdaki komutları kullanabilirsiniz:\n\n' +
      '/help - Yardım bilgisi\n' +
      '/about - Bot hakkında bilgi\n' +
      '/howitworks - Nasıl çalışır\n' +
      '/partners - Örnek iş ortakları'
    );
    
    userStates[chatId] = {
      lastCommand: 'start',
      conversationStage: 'initial'
    };
  });
  
  // /help komutunu işle
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, getRandomResponse('help'));
    userStates[chatId] = { lastCommand: 'help' };
  });
  
  // /about komutunu işle
  bot.onText(/\/about/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, getRandomResponse('about'));
    userStates[chatId] = { lastCommand: 'about' };
  });
  
  // /howitworks komutunu işle
  bot.onText(/\/howitworks/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, getRandomResponse('howItWorks'));
    userStates[chatId] = { lastCommand: 'howitworks' };
  });
  
  // /partners komutunu işle
  bot.onText(/\/partners/, async (msg) => {
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
    
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    
    userStates[chatId] = { 
      lastCommand: 'partners',
      expectingCompanyName: true 
    };
  });
  
  // /gemini komutunu işle - doğrudan Gemini AI sorgulama modu
  bot.onText(/\/gemini/, async (msg) => {
    const chatId = msg.chat.id;
    
    await bot.sendMessage(
      chatId, 
      "Gemini AI modundasınız. Sormak istediğiniz soruyu yazabilirsiniz."
    );
    
    userStates[chatId] = {
      lastCommand: 'gemini',
      conversationStage: 'ai_mode'
    };
  });
  
  // Düzenli mesajları işle
  bot.on('message', async (msg) => {
    // Komut değilse işle
    if (!msg.text || msg.text.startsWith('/')) {
      return;
    }
    
    const chatId = msg.chat.id;
    const userState = userStates[chatId] || { lastCommand: null };
    
    console.log(`Mesaj alındı: "${msg.text}" - Chat ID: ${chatId}`);
    
    // Yazıyor... göster
    await bot.sendChatAction(chatId, 'typing');
    
    // Şirket adı bekleniyorsa
    if (userState.expectingCompanyName) {
      const companyName = msg.text.toLowerCase();
      const company = exampleCompanies.find(c => 
        c.name.toLowerCase().includes(companyName)
      );
      
      if (company) {
        await bot.sendMessage(
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
    
    // Onay bekleniyorsa
    if (userState.expectingConfirmation && userState.selectedCompany) {
      const answer = msg.text.toLowerCase();
      
      if (answer.includes('evet') || answer.includes('yes') || answer === 'e') {
        await bot.sendMessage(
          chatId,
          `Harika! *${userState.selectedCompany}* ile iletişim talebiniz iletildi. ` +
          `En kısa sürede sizinle iletişime geçecekler.\n\n` +
          `Başka bir konuda yardıma ihtiyacınız var mı?`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await bot.sendMessage(
          chatId,
          `Anlaşıldı. Başka bir şirket hakkında bilgi almak isterseniz, ` +
          `tekrar /partners komutunu kullanabilirsiniz.`
        );
      }
      
      // Beklentiyi sıfırla
      userStates[chatId] = { lastCommand: 'general' };
      return;
    }
    
    // Always use Gemini for all messages
    try {
      // Gemini AI yanıtı al
      const response = await getGeminiResponse(msg.text);
      await bot.sendMessage(chatId, response);
    } catch (error) {
      console.error('AI yanıtı oluşturma hatası:', error);
      
      // Niyet bazlı yanıta geri dön
      const intent = analyzeMessage(msg.text);
      await bot.sendMessage(chatId, getRandomResponse(intent));
    }
    
    // Kullanıcı durumunu güncelle
    userStates[chatId] = { 
      lastCommand: 'general',
      lastIntent: analyzeMessage(msg.text)
    };
  });
  
  // Polling hataları için dinleyici
  bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
      console.warn(`${colors.yellow}Telegram polling çakışması: ${error.message}${colors.reset}`);
      console.warn('Bu normal olabilir, bot başka bir yerde çalışıyor olabilir');
    } else {
      console.error(`${colors.red}Polling hatası: ${error.message}${colors.reset}`);
    }
  });
  
  // Temiz kapatma
  process.on('SIGINT', async () => {
    console.log(`${colors.yellow}\nBot kapatılıyor...${colors.reset}`);
    
    // Polling'i durdur
    await bot.stopPolling();
    
    console.log(`${colors.green}Bot güvenli bir şekilde durduruldu. Hoşça kalın!${colors.reset}`);
    process.exit(0);
  });
  
} catch (error) {
  console.error(`${colors.red}Bot başlatılamadı:${colors.reset}`, error);
  process.exit(1);
} 