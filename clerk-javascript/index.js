// Botu doğrudan başlatmak için
require('dotenv').config({ path: '.env.development' });
const TelegramBot = require('node-telegram-bot-api');

// Bot token'ını al
const token = process.env.TELEGRAM_BOT_TOKEN;

// Bot olmadığında uyarı ver
if (!token || token === 'your-telegram-bot-token') {
  console.error('HATA: TELEGRAM_BOT_TOKEN değişkeni ayarlanmamış!');
  console.error('Lütfen .env.development dosyasında TELEGRAM_BOT_TOKEN değerini ayarlayın.');
  process.exit(1);
}

// Gemini API anahtarını al
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey || apiKey === 'your-gemini-api-key') {
  console.warn('UYARI: GOOGLE_GENERATIVE_AI_API_KEY değişkeni ayarlanmamış!');
  console.warn('/gemini komutu çalışmayacak.');
}

// Bot örneği oluştur
const bot = new TelegramBot(token, { polling: true });

console.log('Bot başlatılıyor...');

// /start komutunu işle
bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    'Merhaba! Ben Telegram Gemini AI botuyum. Size nasıl yardımcı olabilirim?\n\n' +
    'Gemini AI\'ya soru sormak için: /gemini [soru] şeklinde yazın.'
  );
});

// /gemini komutunu işle
bot.onText(/^\/gemini (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];
  
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    await bot.sendMessage(
      chatId,
      'API anahtarı ayarlanmamış! Lütfen .env.development dosyasında GOOGLE_GENERATIVE_AI_API_KEY değerini ayarlayın.'
    );
    return;
  }
  
  await bot.sendMessage(chatId, 'Gemini API yanıtınız hazırlanıyor...');
  
  try {
    // Send typing indicator
    await bot.sendChatAction(chatId, 'typing');
    
    // Gemini API URL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    // Log that we're making the request
    console.log(`Gemini API isteği gönderiliyor: ${prompt.substring(0, 50)}...`);
    
    // API isteği için Node.js global fetch'i kullan
    const fetch = require('node-fetch');
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
    } else if (data.error) {
      resultText = `API Hatası: ${data.error.message || 'Bilinmeyen hata'}`;
      console.error('API Hatası:', data.error);
    }
    
    // Send the result back to the user
    await bot.sendMessage(chatId, resultText);
  } catch (error) {
    console.error('Gemini API request error:', error);
    await bot.sendMessage(chatId, 'Gemini API isteği sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
  }
});

// Diğer tüm mesajları işle
bot.on('message', async (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    const chatId = msg.chat.id;
    await bot.sendMessage(
      chatId,
      `Mesajınızı aldım: "${msg.text}"\n\nGemini AI'ya soru sormak için: /gemini [soru] şeklinde yazın.`
    );
  }
});

// Bot durumu
console.log('Bot başlatıldı! Ctrl+C ile durdurun.');

// Çıkış sinyalini yakala
process.on('SIGINT', () => {
  console.log('Bot durduruluyor...');
  bot.stopPolling();
  process.exit(0);
}); 