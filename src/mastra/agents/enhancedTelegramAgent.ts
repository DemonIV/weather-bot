import { Agent } from '@mastra/core/agent';
import { AgentConfig as AgentOptions } from '@mastra/core/agent';
import { OnboardingData, UserState } from '../../types';
import { CONFIG } from '../../config';
import { AuthService } from '../../utils/auth';
import { SessionManager } from '../../utils/session';
import { TelegramService } from '../../../utils/telegram';
import { getGeminiResponse } from '../../../utils/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from '@ai-sdk/google';
import axios from 'axios';

// Track conversation state for each user
const userStates: Record<string, {
  lastCommand?: string;
  lastIntent?: string;
  conversationStage?: string;
  expectingCompanyName?: boolean;
  expectingConfirmation?: boolean;
  selectedCompany?: string;
}> = {};

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

// Database of example companies for demo purposes
const exampleCompanies = [
  { name: "TechSoft", industry: "Yazılım", region: "İstanbul", size: "Orta", interests: "Teknoloji ortaklıkları" },
  { name: "GreenEnergy", industry: "Enerji", region: "Ankara", size: "Büyük", interests: "Yenilenebilir enerji projeleri" },
  { name: "LogiTrans", industry: "Lojistik", region: "İzmir", size: "Orta", interests: "Tedarik zinciri optimizasyonu" },
  { name: "FinanceHub", industry: "Finans", region: "İstanbul", size: "Küçük", interests: "Fintech çözümleri" },
  { name: "EcoFarm", industry: "Tarım", region: "Antalya", size: "Küçük", interests: "Sürdürülebilir tarım" }
];

// OpenWeatherMap API anahtarı
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;

// API anahtarı kontrolü
if (!OPENWEATHERMAP_API_KEY) {
  console.error('HATA: OpenWeatherMap API anahtarı bulunamadı!');
  console.error('Lütfen .env dosyasında OPENWEATHERMAP_API_KEY değişkenini tanımlayın.');
  process.exit(1);
}

console.log(`OpenWeatherMap API anahtarı yüklendi: ${OPENWEATHERMAP_API_KEY.substring(0, 5)}...`);

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
function getRandomWeatherFact(): string {
  return weatherFacts[Math.floor(Math.random() * weatherFacts.length)];
}

// Hava durumuna göre kıyafet tavsiyesi
function getClothingAdvice(temp: number, description: string): string {
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
async function getWeather(city: string) {
  try {
    console.log(`Hava durumu bilgisi alınıyor: ${city}`);
    console.log(`API Anahtarı: ${OPENWEATHERMAP_API_KEY?.substring(0, 5)}...`);
    
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
      params: {
        q: city,
        appid: OPENWEATHERMAP_API_KEY,
        units: 'metric',
        lang: 'tr'
      }
    });
    
    console.log('API yanıtı alındı:', response.data);
    
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
    console.error('Hava durumu bilgisi alınamadı:', error.message);
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
    interface DailyForecast {
      date: string;
      temp: number;
      feelsLike: number;
      humidity: number;
      description: string;
      windSpeed: number;
      windDeg: number;
    }

    const dailyForecasts: DailyForecast[] = [];
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

/**
 * Enhanced Telegram agent for improved conversation handling
 */
export class EnhancedTelegramAgent extends Agent {
  private retryCount: Record<number, number> = {};
  private maxRetries = 2;
  private genAI: GoogleGenerativeAI;
  private genModel: any;

  constructor(options?: AgentOptions) {
    // Use the actual @ai-sdk/google model as required by Agent
    const aiSdkModel = google(CONFIG.gemini.model || 'gemini-1.5-flash');
    
    // Configure the agent with required model property
    const agentConfig = {
      name: 'EnhancedTelegramAgent',
      instructions: 'An enhanced agent that handles Telegram interactions with improved conversation flow',
      model: aiSdkModel, // This needs to be a real model from the AI SDK
      ...options,
    };

    // Pass the config to the parent constructor
    super(agentConfig);

    // Initialize Gemini directly for our own use
    this.genAI = new GoogleGenerativeAI(CONFIG.gemini.apiKey || '');
    this.genModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Initialize the agent
    this.initialize();
  }

  /**
   * Initialize the agent and set up event handlers
   */
  private initialize(): void {
    console.log('Initializing EnhancedTelegramAgent...');
    
    // Set up Telegram message handlers
    this.setupMessageHandlers();

    // Set up callback query handlers
    this.setupCallbackHandlers();

    // Test bot connectivity
    try {
      const bot = TelegramService.getBot();
      bot.getMe()
        .then(botInfo => {
          console.log('Enhanced Telegram agent connected successfully:', botInfo.username);
        })
        .catch(error => {
          console.error('Error connecting Enhanced Telegram agent:', error);
          console.log('The agent will continue running with limited functionality');
        });
    } catch (error) {
      console.error('Failed to initialize Telegram bot connection:', error);
      console.log('The agent will continue running with limited functionality');
    }

    console.log('Enhanced Telegram agent initialized');
  }

  /**
   * Set up Telegram message handlers with enhanced conversation capabilities
   */
  private setupMessageHandlers(): void {
    const bot = TelegramService.getBot();
    console.log('Setting up enhanced message handlers');

    // Handle /start command
    TelegramService.onMessage(/^\/start$/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = `telegram:${chatId}`;
      console.log(`Handling enhanced /start command for user ${userId}`);

      // Initialize the user session
      SessionManager.getSession(userId, chatId);

      // Send welcome message with commands
      await TelegramService.sendMessage(
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
      
      // Set session state to onboarding complete
      SessionManager.updateSession(userId, {
        state: UserState.ONBOARDING_COMPLETE
      });
    });

    // Handle /help command
    TelegramService.onMessage(/^\/help$/, async (msg) => {
      const chatId = msg.chat.id;
      await TelegramService.sendMessage(chatId, this.getRandomResponse('help'));
    });

    // Handle /about command
    TelegramService.onMessage(/^\/about$/, async (msg) => {
      const chatId = msg.chat.id;
      await TelegramService.sendMessage(chatId, this.getRandomResponse('about'));
    });

    // Handle /weather command
    TelegramService.onMessage(/^\/weather (.+)$/, async (msg) => {
      const chatId = msg.chat.id;
      const city = msg.text ? msg.text.split(' ')[1] : '';
      console.log(`/weather komutu alındı, şehir: ${city}`);

      // Yazıyor... göster
      await TelegramService.sendMessage(chatId, 'Hava durumu bilgisi alınıyor...');

      // Hava durumu bilgisi al ve gönder
      const weatherInfo = await getWeather(city);
      await TelegramService.sendMessage(chatId, weatherInfo);
    });

    // Handle /forecast command
    TelegramService.onMessage(/^\/forecast (.+)$/, async (msg) => {
      const chatId = msg.chat.id;
      const city = msg.text ? msg.text.split(' ')[1] : '';
      console.log(`/forecast komutu alındı, şehir: ${city}`);

      // Yazıyor... göster
      await TelegramService.sendMessage(chatId, '5 günlük hava durumu tahmini alınıyor...');

      // 5 günlük tahmin bilgisi al ve gönder
      const forecastInfo = await getForecast(city);
      await TelegramService.sendMessage(chatId, forecastInfo, { parse_mode: 'Markdown' });
    });

    // Handle regular messages
    bot.on('message', async (msg) => {
      // Skip if not a text message or if it's a command (already handled above)
      if (!msg.text || msg.text.startsWith('/')) {
        return;
      }
      
      const chatId = msg.chat.id;
      const userId = `telegram:${chatId}`;
      
      console.log(`Enhanced agent received message: "${msg.text}" from Chat ID: ${chatId}`);
      
      // Ensure the user has a session and is in completed state
      const session = SessionManager.getSession(userId, chatId);
      if (session.state !== UserState.ONBOARDING_COMPLETE) {
        SessionManager.updateSession(userId, {
          state: UserState.ONBOARDING_COMPLETE
        });
      }
      
      // Niyet analizi yap ve yanıt ver
      const intent = this.analyzeMessage(msg.text);
      await TelegramService.sendMessage(chatId, this.getRandomResponse(intent));
    });
  }

  /**
   * Set up Telegram callback query handlers
   */
  private setupCallbackHandlers(): void {
    TelegramService.onCallbackQuery(async (query) => {
      const chatId = query.message?.chat.id;
      if (!chatId) return;
      
      const userId = `telegram:${chatId}`;
      const data = query.data;
      
      console.log(`Enhanced agent received callback: ${data} from user ${userId}`);
      
      if (data?.startsWith('company_')) {
        const companyName = data.replace('company_', '');
        const company = exampleCompanies.find(c => c.name === companyName);
        
        if (company) {
          await TelegramService.sendMessage(
            chatId,
            `*${company.name}* hakkında detaylı bilgi:\n\n` +
            `🏢 *Şirket*: ${company.name}\n` +
            `🔍 *Sektör*: ${company.industry}\n` +
            `📍 *Konum*: ${company.region}\n` +
            `📊 *Şirket Büyüklüğü*: ${company.size}\n` +
            `🤝 *İşbirliği İlgi Alanları*: ${company.interests}`,
            { parse_mode: 'Markdown' }
          );
        }
      }
    });
  }

  /**
   * Handle AI response using Gemini directly
   */
  private async handleAIResponse(userId: string, chatId: number, message: string): Promise<void> {
    console.log(`Handling AI response for message: "${message.substring(0, 20)}..." (Chat: ${chatId})`);

    try {
      // Always try to use Gemini first
      let response = await this.getGeminiResponse(message);
      console.log(`Got Gemini response (${response.length} chars): "${response.substring(0, 30)}..."`);
      await TelegramService.sendMessage(chatId, response);
      return;
    } catch (error) {
      console.error('Failed to get Gemini response:', error);
      
      // Retry with a simpler prompt
      try {
        const simplePrompt = `Sen bir yardımcı asistansın. Şu soruyu yanıtla: ${message}`;
        const result = await this.genModel.generateContent(simplePrompt);
        const text = result.response.text();
        
        if (text) {
          await TelegramService.sendMessage(chatId, text);
          return;
        }
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
      
      // Fallback to a simple response
      await TelegramService.sendMessage(
        chatId, 
        "Üzgünüm, şu anda AI servisine erişemiyorum. Lütfen daha sonra tekrar deneyin."
      );
    }
  }

  /**
   * Get a random response from the specified category
   */
  private getRandomResponse(category: string): string {
    const options = responses[category as keyof typeof responses] || responses.unknown;
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Analyze a message to determine intent
   */
  private analyzeMessage(text: string): string {
    const lowercaseText = text.toLowerCase();
    
    // Greetings
    if (lowercaseText.match(/merhaba|selam|hey|sa|hello|hi|hola/)) {
      return 'greetings';
    }
    
    // Help requests
    if (lowercaseText.match(/yardım|yardim|help|destek|nasıl|assist/)) {
      return 'help';
    }
    
    // About the bot
    if (lowercaseText.match(/kimsin|nedir|nesin|adın|adin|ismin|hakkında|about|sen/)) {
      return 'about';
    }
    
    // Weather related
    if (lowercaseText.match(/hava|durum|sıcaklık|sicaklik|nem|rüzgar|ruzgar|yağmur|yagmur/)) {
      return 'help';
    }
    
    // Default - unknown intent
    return 'unknown';
  }

  /**
   * Get a response from Gemini
   */
  private async getGeminiResponse(message: string): Promise<string> {
    if (!this.genModel) {
      // Re-initialize if needed
      this.genAI = new GoogleGenerativeAI(CONFIG.gemini.apiKey || '');
      this.genModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }
    
    const prompt = `
    Aşağıdaki kullanıcı mesajına Türkçe yanıt ver. 
    Sen bir iş ortaklığı bulmaya yardımcı olan Bunder Bot adında bir asistansın.
    Cevabın kısa ve net olsun. 150 kelimeyi geçme.
    
    Kullanıcı mesajı: "${message}"
    `;
    
    const result = await this.genModel.generateContent(prompt);
    const text = result.response.text();
    
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from Gemini');
    }
    
    return text;
  }
} 