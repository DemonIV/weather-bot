/**
 * Standalone Bot - Mastra'ya bağımlı olmadan çalışan Telegram botu
 * Bu dosya doğrudan tokenları içerir ve Mastra framework'ünü kullanmadan çalışır
 */

import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';

// .env dosyalarını yükle
dotenv.config({ path: '.env.development' });

// Token'lar - kodda sabit olmalarını istemiyorsanız bunları .env dosyasına taşıyın
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "7778553807:AAHIbhdhkeAj94WKTSEq2XDodHsf_ldWlXo";
const GEMINI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "doldurun";
const GEMINI_MODEL = "gemini-1.5-flash";

// OpenWeatherMap API anahtarı
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;

// API anahtarı kontrolü
if (!OPENWEATHERMAP_API_KEY) {
  console.error(`${colors.red}HATA: OpenWeatherMap API anahtarı bulunamadı!${colors.reset}`);
  console.error('Lütfen .env dosyasında OPENWEATHERMAP_API_KEY değişkenini tanımlayın.');
  process.exit(1);
}

console.log(`${colors.green}OpenWeatherMap API anahtarı yüklendi: ${OPENWEATHERMAP_API_KEY.substring(0, 5)}...${colors.reset}`);

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
    "Merhaba! Hangi şehrin hava durumunu öğrenmek istersiniz?",
    "Selam! Size hangi şehir için hava durumu bilgisi verebilirim?",
    "Merhaba! Hava Durumu Bot hizmetinizde. Hangi şehir için bilgi almak istersiniz?"
  ],
  help: [
    "Size şu konularda yardımcı olabilirim:\n- Herhangi bir şehir için güncel hava durumu\n- 5 günlük hava durumu tahmini\n- Hava durumu uyarıları\n\nKullanım: /weather [şehir adı]\nÖrnek: /weather İstanbul",
    "Hava Durumu Bot şunları yapabilir:\n- Anlık hava durumu bilgisi\n- Sıcaklık, nem, rüzgar bilgisi\n- Hissedilen sıcaklık\n\nKullanım: /weather [şehir adı]"
  ],
  about: [
    "Ben Hava Durumu Bot, size güncel hava durumu bilgilerini sunmak için geliştirilmiş bir asistanım. OpenWeatherMap API'sini kullanarak doğru ve güncel bilgiler sağlıyorum.",
    "Adım Hava Durumu Bot. Amacım size en doğru ve güncel hava durumu bilgilerini sunmak. İstediğiniz şehir için detaylı hava durumu bilgisi alabilirsiniz."
  ],
  unknown: [
    "Üzgünüm, bu komutu anlayamadım. Hava durumu bilgisi almak için /weather [şehir] komutunu kullanabilirsiniz.",
    "Bu komut şu anda kullanılamıyor. Hava durumu bilgisi almak için /weather [şehir] komutunu deneyin."
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

// İlginç hava gerçekleri
const weatherFacts = [
  "Şimşek, yıldırımdan önce gelir. Çünkü ışık, sesten daha hızlıdır!",
  "Dünya'da her saniye yaklaşık 100 şimşek çakar.",
  "En yüksek sıcaklık 1913'te Death Valley'de 56.7°C olarak ölçülmüştür.",
  "En düşük sıcaklık 1983'te Antarktika'da -89.2°C olarak ölçülmüştür.",
  "Bir yağmur damlası saatte 32 km hızla düşer.",
  "Kar taneleri asla birbirine benzemez, her biri benzersizdir.",
  "Gökkuşağı aslında tam bir daire şeklindedir, ancak yerden sadece yarım daire olarak görünür.",
  "Rüzgar, güneş ışınlarının dünya yüzeyini farklı hızlarda ısıtmasından kaynaklanır.",
  "Bir fırtına bulutu 500.000 ton ağırlığında olabilir.",
  "Dünya'nın en kuru yeri Atacama Çölü'dür, bazı bölgelerinde 400 yıl yağmur yağmamıştır."
];

// Rastgele hava gerçeği seç
function getRandomWeatherFact() {
  return weatherFacts[Math.floor(Math.random() * weatherFacts.length)];
}

// Hava durumuna göre kıyafet tavsiyesi
function getClothingAdvice(temp, description) {
  let advice = '';
  
  // Sıcaklık bazlı tavsiyeler
  if (temp <= 5) {
    advice += '❄️ *Çok soğuk hava:*\n' +
              '• Kalın mont veya kaban\n' +
              '• Bere, atkı ve eldiven\n' +
              '• Kalın kazak veya hırka\n' +
              '• Termal içlik\n' +
              '• Kalın pantolon\n';
  } else if (temp <= 10) {
    advice += '🥶 *Soğuk hava:*\n' +
              '• Mont veya kaban\n' +
              '• Bere ve atkı\n' +
              '• Kalın kazak\n' +
              '• Uzun kollu içlik\n' +
              '• Kalın pantolon\n';
  } else if (temp <= 15) {
    advice += '🌡️ *Serin hava:*\n' +
              '• Hırka veya kazak\n' +
              '• Uzun kollu tişört\n' +
              '• İnce mont\n' +
              '• Uzun pantolon\n';
  } else if (temp <= 20) {
    advice += '🌤️ *Ilık hava:*\n' +
              '• İnce hırka\n' +
              '• Uzun kollu tişört\n' +
              '• Uzun pantolon\n';
  } else if (temp <= 25) {
    advice += '☀️ *Sıcak hava:*\n' +
              '• İnce tişört\n' +
              '• Şort veya ince pantolon\n' +
              '• Açık renkli kıyafetler\n';
  } else {
    advice += '🔥 *Çok sıcak hava:*\n' +
              '• İnce ve açık renkli tişört\n' +
              '• Şort\n' +
              '• Şapka\n' +
              '• Güneş gözlüğü\n';
  }

  // Hava durumu bazlı ek tavsiyeler
  if (description.includes('yağmur') || description.includes('yağmurlu')) {
    advice += '\n🌧️ *Yağmurlu hava için:*\n' +
              '• Yağmurluk veya şemsiye\n' +
              '• Su geçirmez ayakkabı\n' +
              '• Su geçirmez çanta\n';
  } else if (description.includes('kar') || description.includes('karlı')) {
    advice += '\n❄️ *Karlı hava için:*\n' +
              '• Bot veya su geçirmez ayakkabı\n' +
              '• Kalın çorap\n' +
              '• Eldiven\n';
  } else if (description.includes('rüzgar') || description.includes('rüzgarlı')) {
    advice += '\n💨 *Rüzgarlı hava için:*\n' +
              '• Rüzgarlık\n' +
              '• Bere veya şapka\n';
  }

  return advice;
}

// Hava durumu bilgilerini almak için fonksiyon
async function getWeather(city) {
  try {
    console.log(`${colors.blue}Hava durumu bilgisi alınıyor: ${city}${colors.reset}`);
    console.log(`API Anahtarı: ${OPENWEATHERMAP_API_KEY.substring(0, 5)}...`);
    
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
      params: {
        q: city,
        appid: OPENWEATHERMAP_API_KEY,
        units: 'metric',
        lang: 'tr'
      }
    });
    
    console.log(`${colors.green}API yanıtı alındı:${colors.reset}`, response.data);
    
    const weather = response.data;
    
    // Hissedilen sıcaklık hesaplama
    const feelsLike = Math.round(weather.main.feels_like);
    const temp = Math.round(weather.main.temp);
    const humidity = weather.main.humidity;
    const windSpeed = weather.wind.speed;
    const windDeg = weather.wind.deg;
    const description = weather.weather[0].description;
    
    // Rüzgar yönünü hesapla
    const windDirections = ['Kuzey', 'Kuzeydoğu', 'Doğu', 'Güneydoğu', 'Güney', 'Güneybatı', 'Batı', 'Kuzeybatı'];
    const windDirection = windDirections[Math.round(windDeg / 45) % 8];
    
    // Kıyafet tavsiyesi al
    const clothingAdvice = getClothingAdvice(temp, description);
    
    // Rastgele hava gerçeği al
    const weatherFact = getRandomWeatherFact();

    return `🌤️ *${city} için Hava Durumu*\n\n` +
           `*Şu anki durum:*\n` +
           `🌡️ Sıcaklık: ${temp}°C\n` +
           `🌡️ Hissedilen: ${feelsLike}°C\n` +
           `💧 Nem: %${humidity}\n` +
           `💨 Rüzgar: ${windSpeed} km/s (${windDirection})\n` +
           `🌤️ Durum: ${description}\n\n` +
           `*Kıyafet Tavsiyesi:*\n` +
           `${clothingAdvice}\n\n` +
           `*İlginç Hava Bilgisi:*\n` +
           `📚 ${weatherFact}\n\n` +
           `Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}`;
  } catch (error) {
    console.error(`${colors.red}Hava durumu bilgisi alınamadı:${colors.reset}`, error.message);
    if (error.response) {
      console.error('API Yanıt Detayları:', error.response.data);
    }
    return 'Üzgünüm, hava durumu bilgisi alınamadı. Lütfen daha sonra tekrar deneyin.';
  }
}

// 5 günlük hava durumu tahmini için fonksiyon
async function getForecast(city) {
  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/forecast`, {
      params: {
        q: city,
        appid: OPENWEATHERMAP_API_KEY,
        units: 'metric',
        lang: 'tr'
      }
    });

    const forecast = response.data;
    const dailyForecasts = [];
    const seenDates = new Set();

    // Her gün için bir tahmin al
    forecast.list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dateStr = date.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
      
      if (!seenDates.has(dateStr)) {
        seenDates.add(dateStr);
        dailyForecasts.push({
          date: dateStr,
          temp: Math.round(item.main.temp),
          feelsLike: Math.round(item.main.feels_like),
          humidity: item.main.humidity,
          description: item.weather[0].description,
          windSpeed: item.wind.speed,
          windDeg: item.wind.deg
        });
      }
    });

    return `🌤️ *${city} için 5 Günlük Hava Durumu Tahmini*\n\n` +
           dailyForecasts.map(day => 
             `*${day.date}*\n` +
             `🌡️ Sıcaklık: ${day.temp}°C\n` +
             `🌡️ Hissedilen: ${day.feelsLike}°C\n` +
             `💧 Nem: %${day.humidity}\n` +
             `🌤️ Durum: ${day.description}\n` +
             `💨 Rüzgar: ${day.windSpeed} km/s\n\n`
           ).join('') +
           `Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}`;
  } catch (error) {
    console.error('Hava durumu tahmini alınamadı:', error);
    return 'Üzgünüm, hava durumu tahmini alınamadı. Lütfen daha sonra tekrar deneyin.';
  }
}

// Log dosyasına yazma işlevi
function logToFile(message) {
  const logMessage = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFileSync('bot.log', logMessage, 'utf8');
}

// OpenWeatherMap API anahtarını logla
logToFile(`OpenWeatherMap API Key: ${OPENWEATHERMAP_API_KEY}`);

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
  
  console.log(`${colors.green}Hava Durumu Bot başarıyla başlatıldı!${colors.reset}`);
  
  // /start komutunu işle
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`/start komutu alındı, kullanıcı: ${chatId}`);
    
    await bot.sendMessage(
      chatId,
      '🌤️ *Hava Durumu Botuna Hoş Geldiniz!* 👋\n\n' +
      'Ben size güncel hava durumu bilgilerini sunan bir asistanım. İstediğiniz şehir için detaylı hava durumu bilgisi alabilirsiniz.\n\n' +
      '*Nasıl Kullanılır?*\n' +
      '1️⃣ Anlık hava durumu için:\n' +
      '   `/weather [şehir]`\n' +
      '   Örnek: `/weather İstanbul`\n\n' +
      '2️⃣ 5 günlük tahmin için:\n' +
      '   `/forecast [şehir]`\n' +
      '   Örnek: `/forecast İstanbul`\n\n' +
      '*Diğer Komutlar:*\n' +
      'ℹ️ `/help` - Tüm komutları ve kullanımını gösterir\n' +
      '📝 `/about` - Bot hakkında bilgi verir\n\n' +
      'Hangi şehrin hava durumunu öğrenmek istersiniz? 😊',
      { parse_mode: 'Markdown' }
    );
  });
  
  // /help komutunu işle
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, getRandomResponse('help'));
  });
  
  // /about komutunu işle
  bot.onText(/\/about/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, getRandomResponse('about'));
  });
  
  // /weather komutunu işle
  bot.onText(/\/weather (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const city = match[1];
    console.log(`/weather komutu alındı, şehir: ${city}`);

    // Yazıyor... göster
    await bot.sendChatAction(chatId, 'typing');

    // Hava durumu bilgisi al ve gönder
    const weatherInfo = await getWeather(city);
    await bot.sendMessage(chatId, weatherInfo);

    userStates[chatId] = { lastCommand: 'weather' };
  });
  
  // /forecast komutunu işle
  bot.onText(/\/forecast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const city = match[1];
    console.log(`/forecast komutu alındı, şehir: ${city}`);

    // Yazıyor... göster
    await bot.sendChatAction(chatId, 'typing');

    // 5 günlük tahmin bilgisi al ve gönder
    const forecastInfo = await getForecast(city);
    await bot.sendMessage(chatId, forecastInfo, { parse_mode: 'Markdown' });
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
    
    // Hava durumu komutu bekleniyorsa
    if (userState.lastCommand === 'weather') {
      const city = msg.text;
      const weatherInfo = await getWeather(city);
      await bot.sendMessage(chatId, weatherInfo);
      return;
    }
    
    // Diğer mesajlar için niyet analizi yap
    const intent = analyzeMessage(msg.text);
    await bot.sendMessage(chatId, getRandomResponse(intent));
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