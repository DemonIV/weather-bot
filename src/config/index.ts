import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('UYARI: TELEGRAM_BOT_TOKEN environment variable bulunamadı.');
  console.error('Bu olmadan Telegram botu çalışmayacaktır. Lütfen .env veya .env.development dosyasında tanımlayın.');
  // process.exit(1); // Çıkış yapmak yerine uyarı vererek devam ediyoruz
}

// Doğrudan token değerini tanımlıyoruz (sorunu çözmek için geçici bir çözüm)
const TELEGRAM_TOKEN = "7778553807:AAHIbhdhkeAj94WKTSEq2XDodHsf_ldWlXo";
const GEMINI_API_KEY = "doldurun";

// Token değerini çevreden almaya çalış, alabildiysen kullan yoksa sabit değerleri kullan
const telegramToken = process.env.TELEGRAM_BOT_TOKEN || TELEGRAM_TOKEN;
const geminiApiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || GEMINI_API_KEY;

console.log(`Telegram token: ${telegramToken.substring(0, 5)}...`);
console.log(`Gemini API key: ${geminiApiKey.substring(0, 5)}...`);

// Default API key değerini alalım - eğer ortam değişkeni yoksa varsayılan değeri kullanılacak
const getApiKeyFromEnv = () => {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key || key === 'your-api-key') {
    console.warn('UYARI: Google API anahtarı bulunamadı veya geçersiz. Varsayılan değer kullanılıyor.');
    return '';
  }
  return key;
};

// Export configuration variables
export const CONFIG = {
  // Telegram configuration
  telegram: {
    token: telegramToken,
  },

  // Clerk authentication configuration
  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY || '',
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
    domain: 'musical-koi-3.accounts.dev',
    signInUrl: 'https://musical-koi-3.accounts.dev/sign-in',
  },

  // Google AI configuration
  google: {
    apiKey: getApiKeyFromEnv(),
  },

  // Onboarding configuration
  onboarding: {
    // Define the order of onboarding fields
    fieldOrder: [
      'companyName',
      'linkedInURL',
      'headquarters',
      'logo',
      'website',
      'industry',
      'businessGoal',
      'partnerType',
      'companySize',
      'products',
      'regions',
      'businessStage',
      'collaborationInterests',
    ],

    // Field prompts for each onboarding field
    fieldPrompts: {
      companyName: 'Please enter your company name:',
      linkedInURL: 'Please enter your company\'s LinkedIn URL:',
      headquarters: 'Where is your company headquartered?',
      logo: 'Please upload your company logo or provide a URL to your logo:',
      website: 'What is your company\'s website URL?',
      industry: 'What industry does your company operate in?',
      businessGoal: 'What are your primary business goals?',
      partnerType: 'What type of partners are you looking for?',
      companySize: 'What is the size of your company (number of employees)?',
      products: 'Please describe your main products or services:',
      regions: 'Which regions do you operate in? (You can list multiple regions)',
      businessStage: 'What stage is your business in? (e.g., startup, growth, mature)',
      collaborationInterests: 'What are your collaboration interests? (You can list multiple interests)',
    },
  },

  gemini: {
    apiKey: geminiApiKey,
    model: 'gemini-1.5-flash',
  },

  server: {
    port: parseInt(process.env.PORT || '4111', 10),
  }
};
