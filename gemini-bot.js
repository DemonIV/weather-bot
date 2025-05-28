/**
 * Gemini Bot - Gemini API ile çalışan Telegram botu
 * Bu dosya doğrudan Gemini API'sini kullanır ve tüm mesajlara Gemini ile yanıt verir
 */

import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// .env dosyalarını yükle
dotenv.config({ path: '.env.development' });

// Token'lar - çevre değişkenlerinden al yoksa varsayılan değerler kullan
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

console.log(`${colors.green}Gemini Bot başlatılıyor...${colors.reset}`);
console.log(`Telegram Token: ${TELEGRAM_TOKEN.substring(0, 5)}...`);
console.log(`Gemini API Key: ${GEMINI_API_KEY.substring(0, 5)}...`);

// Kullanıcı durumlarını izle
const userStates = {};

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
  process.exit(1); // Gemini olmadan çalışmayı reddet
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

// Bağlantı testini çalıştır
let geminiAvailable = false;
testGeminiConnectivity().then(result => {
  geminiAvailable = result;
  console.log(`Gemini API durumu: ${geminiAvailable ? 'Aktif ✅' : 'Devre dışı ❌'}`);
  
  if (!geminiAvailable) {
    console.error(`${colors.red}Gemini API bağlantısı başarısız oldu. Bot kapanıyor.${colors.reset}`);
    process.exit(1); // Gemini çalışmıyorsa botu başlatma
  }
});

/**
 * Get a response from the Gemini API for a given message
 */
async function getGeminiResponse(message) {
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
    Sen bir hava durumu bilgisi sunan asistan botusun.
    Cevabın kısa ve net olsun. 150 kelimeyi geçme.
    
    Kullanıcı mesajı: "${message}"
    `;
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    if (text && text.length > 0) {
      console.log(`Gemini yanıtı (${text.length} karakter): "${text.substring(0, 30)}..."`);
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
    
    throw new Error('Gemini boş yanıt döndü');
  } catch (error) {
    console.error('Gemini API hatası:', error);
    throw error; // Hata yönetimini üst seviyeye bırak
  }
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
      'Merhaba! Hava Durumu Bilgi Botuna hoş geldiniz! 👋\n\n' +
      'Bu bot, size güncel hava durumu bilgilerini sunacaktır. ' +
      'Aşağıdaki komutları kullanabilirsiniz:\n\n' +
      '/help - Yardım bilgisi\n' +
      '/about - Bot hakkında bilgi\n\n' +
      'Hangi şehrin hava durumunu öğrenmek istersiniz?'
    );
    
    userStates[chatId] = {
      lastCommand: 'start',
      conversationStage: 'initial'
    };
  });
  
  // /help komutunu işle
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      const helpResponse = await getGeminiResponse("Bunder bot için yardım bilgisi ver");
      await bot.sendMessage(chatId, helpResponse);
    } catch (error) {
      await bot.sendMessage(chatId, "Bot Gemini AI destekli bir asistanıdır. İstediğiniz soruyu sorabilirsiniz.");
    }
    
    userStates[chatId] = { lastCommand: 'help' };
  });
  
  // /about komutunu işle
  bot.onText(/\/about/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      const aboutResponse = await getGeminiResponse("Bunder bot hakkında bilgi ver");
      await bot.sendMessage(chatId, aboutResponse);
    } catch (error) {
      await bot.sendMessage(chatId, "Ben Gemini AI destekli bir Telegram botuyum. Her türlü sorunuza yanıt verebilirim.");
    }
    
    userStates[chatId] = { lastCommand: 'about' };
  });
  
  // Düzenli mesajları işle
  bot.on('message', async (msg) => {
    // Komut değilse işle
    if (!msg.text || msg.text.startsWith('/')) {
      return;
    }
    
    const chatId = msg.chat.id;
    
    console.log(`Mesaj alındı: "${msg.text}" - Chat ID: ${chatId}`);
    
    // Yazıyor... göster
    await bot.sendChatAction(chatId, 'typing');
    
    try {
      // Her mesaj için Gemini AI'dan yanıt al
      const response = await getGeminiResponse(msg.text);
      await bot.sendMessage(chatId, response);
    } catch (error) {
      console.error('Gemini API hatası:', error);
      await bot.sendMessage(
        chatId,
        "Üzgünüm, şu anda Gemini AI servisine bağlanamıyorum. Lütfen daha sonra tekrar deneyin."
      );
    }
    
    // Kullanıcı durumunu güncelle
    userStates[chatId] = { 
      lastCommand: 'general'
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