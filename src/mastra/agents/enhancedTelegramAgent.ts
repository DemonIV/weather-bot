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

// Database of example companies for demo purposes
const exampleCompanies = [
  { name: "TechSoft", industry: "Yazılım", region: "İstanbul", size: "Orta", interests: "Teknoloji ortaklıkları" },
  { name: "GreenEnergy", industry: "Enerji", region: "Ankara", size: "Büyük", interests: "Yenilenebilir enerji projeleri" },
  { name: "LogiTrans", industry: "Lojistik", region: "İzmir", size: "Orta", interests: "Tedarik zinciri optimizasyonu" },
  { name: "FinanceHub", industry: "Finans", region: "İstanbul", size: "Küçük", interests: "Fintech çözümleri" },
  { name: "EcoFarm", industry: "Tarım", region: "Antalya", size: "Küçük", interests: "Sürdürülebilir tarım" }
];

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
        'Merhaba! Bunder Telegram Bot\'una hoş geldiniz! 👋\n\n' +
        'Bu bot, potansiyel iş ortaklarıyla bağlantı kurmanıza yardımcı olacak. ' +
        'Aşağıdaki komutları kullanabilirsiniz:\n\n' +
        '/help - Yardım bilgisi\n' +
        '/about - Bot hakkında bilgi\n' +
        '/howitworks - Nasıl çalışır\n' +
        '/partners - Örnek iş ortakları'
      );
      
      // Set session state to onboarding complete
      SessionManager.updateSession(userId, {
        state: UserState.ONBOARDING_COMPLETE
      });
      
      // Track user conversation state
      userStates[chatId] = {
        lastCommand: 'start',
        conversationStage: 'initial'
      };
    });

    // Handle /help command
    TelegramService.onMessage(/^\/help$/, async (msg) => {
      const chatId = msg.chat.id;
      await TelegramService.sendMessage(chatId, this.getRandomResponse('help'));
      userStates[chatId] = { lastCommand: 'help' };
    });

    // Handle /about command
    TelegramService.onMessage(/^\/about$/, async (msg) => {
      const chatId = msg.chat.id;
      await TelegramService.sendMessage(chatId, this.getRandomResponse('about'));
      userStates[chatId] = { lastCommand: 'about' };
    });

    // Handle /howitworks command
    TelegramService.onMessage(/^\/howitworks$/, async (msg) => {
      const chatId = msg.chat.id;
      await TelegramService.sendMessage(chatId, this.getRandomResponse('howItWorks'));
      userStates[chatId] = { lastCommand: 'howitworks' };
    });

    // Handle /partners command
    TelegramService.onMessage(/^\/partners$/, async (msg) => {
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
      
      await TelegramService.sendMessage(chatId, response, { parse_mode: 'Markdown' });
      
      userStates[chatId] = { 
        lastCommand: 'partners',
        expectingCompanyName: true 
      };
    });

    // Handle /gemini command to force AI response
    TelegramService.onMessage(/^\/gemini$/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = `telegram:${chatId}`;
      
      await TelegramService.sendMessage(
        chatId, 
        "Gemini AI modundasınız. Sormak istediğiniz soruyu yazabilirsiniz."
      );
      
      userStates[chatId] = {
        lastCommand: 'gemini',
        conversationStage: 'ai_mode'
      };
    });

    // Handle regular messages with more sophisticated conversation flow
    bot.on('message', async (msg) => {
      // Skip if not a text message or if it's a command (already handled above)
      if (!msg.text || msg.text.startsWith('/')) {
        return;
      }
      
      const chatId = msg.chat.id;
      const userId = `telegram:${chatId}`;
      const userState = userStates[chatId] || { lastCommand: null };
      
      console.log(`Enhanced agent received message: "${msg.text}" from Chat ID: ${chatId}`);
      
      // Ensure the user has a session and is in completed state
      const session = SessionManager.getSession(userId, chatId);
      if (session.state !== UserState.ONBOARDING_COMPLETE) {
        SessionManager.updateSession(userId, {
          state: UserState.ONBOARDING_COMPLETE
        });
      }
      
      // If user was looking at partner list and might be asking about a company
      if (userState.expectingCompanyName) {
        const companyName = msg.text.toLowerCase();
        const company = exampleCompanies.find(c => 
          c.name.toLowerCase().includes(companyName)
        );
        
        if (company) {
          await TelegramService.sendMessage(
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
      if (userState.expectingConfirmation && userState.selectedCompany) {
        const answer = msg.text.toLowerCase();
        
        if (answer.includes('evet') || answer.includes('yes') || answer === 'e') {
          await TelegramService.sendMessage(
            chatId,
            `Harika! *${userState.selectedCompany}* ile iletişim talebiniz iletildi. ` +
            `En kısa sürede sizinle iletişime geçecekler.\n\n` +
            `Başka bir konuda yardıma ihtiyacınız var mı?`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await TelegramService.sendMessage(
            chatId,
            `Anlaşıldı. Başka bir şirket hakkında bilgi almak isterseniz, ` +
            `tekrar /partners komutunu kullanabilirsiniz.`
          );
        }
        
        // Reset the expectation
        userStates[chatId] = { lastCommand: 'general' };
        return;
      }
      
      // For more complex AI-driven responses, use Mastra's agent capabilities
      if (msg.text.length > 20 || msg.text.includes('?') || userState.lastCommand === 'gemini') {
        // Use AI model for complex queries
        await this.handleAIResponse(userId, chatId, msg.text);
      } else {
        // For simpler messages, use intent-based responses
        const intent = this.analyzeMessage(msg.text);
        await TelegramService.sendMessage(chatId, this.getRandomResponse(intent));
      }
      
      // Update user state
      userStates[chatId] = { 
        lastCommand: 'general',
        lastIntent: this.analyzeMessage(msg.text)
      };
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
    
    // How it works
    if (lowercaseText.match(/nasıl çalış|nasil calis|how|sistem|çalışma|calisma|işleyiş|isleyis/)) {
      return 'howItWorks';
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