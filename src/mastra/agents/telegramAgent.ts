import { Agent } from '@mastra/core/agent';
import { AgentConfig as AgentOptions } from '@mastra/core/agent';
import { OnboardingData, UserState } from '../../types';
import { CONFIG } from '../../config';
import { AuthService } from '../../utils/auth';
import { OnboardingService } from '../../utils/onboarding';
import { SessionManager } from '../../utils/session';
import { TelegramService } from '../../utils/telegram';
import { google } from '@ai-sdk/google';

/**
 * Telegram agent for handling user interactions
 */
export class TelegramAgent extends Agent {
  constructor(options?: AgentOptions) {
    // Create a Google AI model instance using the environment variable
    // The SDK will automatically use GOOGLE_GENERATIVE_AI_API_KEY from the environment
    const model = google('gemini-2.0-flash');

    // Ensure we have all required properties for the Agent constructor
    const agentConfig = {
      name: 'TelegramAgent',
      instructions: 'An agent that handles Telegram interactions with authentication and onboarding',
      model: model, // Add the model to the config
      ...options,
    };

    // Pass the config to the parent constructor
    super(agentConfig);

    // Initialize the agent
    this.initialize();
  }

  /**
   * Initialize the agent and set up event handlers
   */
  private initialize(): void {
    console.log('Initializing TelegramAgent...');
    
    // Set up Telegram message handlers
    this.setupMessageHandlers();

    // Set up callback query handlers
    this.setupCallbackHandlers();

    // Test bot connectivity
    const bot = TelegramService.getBot();
    bot.getMe()
      .then(botInfo => {
        console.log('Telegram bot connected successfully:', botInfo.username);
      })
      .catch(error => {
        console.error('Error connecting to Telegram bot:', error);
      });

    console.log('Telegram agent initialized');
  }

  /**
   * Set up Telegram message handlers
   */
  private setupMessageHandlers(): void {
    const bot = TelegramService.getBot();
    console.log('Setting up Telegram message handlers for TelegramAgent');

    // Handle /start command
    bot.on('message', async (msg) => {
      console.log('Received message in TelegramAgent:', msg.text);
      
      if (msg.text && msg.text.match(/^\/start$/)) {
        const chatId = msg.chat.id;
        const userId = `telegram:${chatId}`;
        console.log(`Handling /start command for user ${userId}`);

        // Initialize the user session
        SessionManager.getSession(userId, chatId);

        // Send welcome message
        await TelegramService.sendMessage(
          chatId,
          'Merhaba! Bunder Telegram Bot\'una hoş geldiniz! 👋\n\n' +
          'Bu bot, potansiyel iş ortaklarıyla bağlantı kurmanıza yardımcı olacak. ' +
          'Herhangi bir sorunuz olursa bana sorabilirsiniz.'
        );
        
        // Set session state to onboarding complete to bypass authentication
        SessionManager.updateSession(userId, {
          state: UserState.ONBOARDING_COMPLETE
        });
      }
    });

    // Handle /gemini command for direct API access
    bot.on('message', async (msg) => {
      if (msg.text && msg.text.startsWith('/gemini ')) {
        const chatId = msg.chat.id;
        const userId = `telegram:${chatId}`;
        const prompt = msg.text.substring('/gemini '.length).trim();
        console.log(`Handling /gemini command for user ${userId} with prompt: ${prompt}`);

        // Check if the prompt is provided
        if (prompt) {
          await TelegramService.sendMessage(chatId, 'Gemini API yanıtınız hazırlanıyor...');
          await TelegramService.sendGeminiRequest(chatId, prompt);
        } else {
          await TelegramService.sendMessage(
            chatId,
            'Lütfen bir istek girin. Örnek: /gemini Yapay zeka nasıl çalışır?'
          );
        }

        // Make sure the session exists and is in completed state
        const session = SessionManager.getSession(userId, chatId);
        if (session.state !== UserState.ONBOARDING_COMPLETE) {
          SessionManager.updateSession(userId, {
            state: UserState.ONBOARDING_COMPLETE
          });
        }
      }
    });

    // Handle all other messages
    bot.on('message', async (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        const userId = `telegram:${chatId}`;
        console.log(`Handling regular message for user ${userId}: ${msg.text}`);

        // Get the user session
        const session = SessionManager.getSession(userId, chatId);
        
        // Automatically set session to completed state to bypass auth
        if (session.state !== UserState.ONBOARDING_COMPLETE) {
          SessionManager.updateSession(userId, {
            state: UserState.ONBOARDING_COMPLETE
          });
        }

        // Process all messages as completed user
        await this.handleCompletedUserMessage(userId, msg.text);
      }
    });
  }

  /**
   * Set up Telegram callback query handlers
   */
  private setupCallbackHandlers(): void {
    TelegramService.onCallbackQuery(async (query) => {
      const chatId = query.message?.chat.id;

      if (!chatId) {
        return;
      }

      const userId = `telegram:${chatId}`;
      const data = query.data;

      if (data === 'auth_complete') {
        // User has completed authentication
        await this.handleAuthenticationComplete(userId, chatId);
      }
    });
  }

  /**
   * Start the authentication process for a user
   * @param userId Unique identifier for the user
   * @param chatId Telegram chat ID
   */
  private async startAuthentication(userId: string, chatId: number): Promise<void> {
    try {
      // Update the user's state to authenticating
      SessionManager.updateSession(userId, {
        state: UserState.AUTHENTICATING,
      });

      // Check if the user already exists in Clerk
      const userExists = await AuthService.verifyUser(userId);

      // If the user doesn't exist, create them in Clerk
      if (!userExists) {
        console.log(`Creating new user with external ID: ${userId}`);
        try {
          // Create the user with the external ID
          await AuthService.createUser(userId, {
            telegramId: chatId.toString(),
          });
          console.log(`Successfully created user with external ID: ${userId}`);
        } catch (createError) {
          console.error('Error creating user in Clerk:', createError);
          // Continue with the flow even if user creation fails
          // The user might already exist but not be found due to API issues
        }
      } else {
        console.log(`User with external ID ${userId} already exists in Clerk`);
      }

      // Generate an authentication link with the specific Clerk URL
      const authLink = await AuthService.generateAuthLink(userId);

      // Send the authentication link to the user
      await TelegramService.sendMessage(
        chatId,
        'Please authenticate by clicking the link below to sign in with Clerk:\n\n' +
        authLink + '\n\n' +
        'After authentication, come back here and continue the conversation.'
      );

      // Add a button to confirm authentication
      await TelegramService.sendMessageWithInlineKeyboard(
        chatId,
        `Once you've completed authentication at ${CONFIG.clerk.domain}, click the button below:`,
        [[{ text: 'I\'ve Authenticated', callback_data: 'auth_complete' }]]
      );
    } catch (error) {
      console.error('Error starting authentication:', error);

      // Send error message to the user
      await TelegramService.sendMessage(
        chatId,
        'An error occurred while setting up authentication. Please try again later.'
      );
    }
  }

  /**
   * Handle authentication completion callback
   * @param userId Unique identifier for the user
   * @param chatId Telegram chat ID
   */
  private async handleAuthenticationComplete(userId: string, chatId: number): Promise<void> {
    try {
      // Update the user's state to onboarding complete to bypass onboarding process
      SessionManager.updateSession(userId, {
        state: UserState.ONBOARDING_COMPLETE,
      });

      // Send welcome message
      await TelegramService.sendMessage(
        chatId,
        '✅ Kimlik doğrulama tamamlandı! Artık benimle sohbet edebilirsiniz.'
      );
    } catch (error) {
      console.error('Error handling authentication complete:', error);

      // Send error message to the user
      await TelegramService.sendMessage(
        chatId,
        'Kimlik doğrulama işlemi sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
      );
    }
  }

  /**
   * Handle a message from a user who has completed onboarding
   * @param userId Unique identifier for the user
   * @param message Message content
   */
  private async handleCompletedUserMessage(userId: string, message: string): Promise<void> {
    try {
      // Extract the telegram ID from the user ID (format: "telegram:123456789")
      const telegramId = parseInt(userId.split(':')[1], 10);
      
      // Get the user session
      const session = SessionManager.getSession(userId, telegramId);

      // Generate a response using the model
      let response = `Mesajınızı aldım: "${message}"\nMerhaba! Size nasıl yardımcı olabilirim?`;

      // Send the response
      await TelegramService.sendMessage(telegramId, response);
    } catch (error) {
      console.error('Error handling user message:', error);

      // Get the chat ID from the session if possible
      try {
        // Extract the telegram ID from the user ID
        const telegramId = parseInt(userId.split(':')[1], 10);
        
        // Send error message to the user
        await TelegramService.sendMessage(
          telegramId,
          'Mesajınızı işlerken bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
        );
      } catch (sessionError) {
        console.error('Error retrieving session for error message:', sessionError);
      }
    }
  }

  /**
   * Generate a response to a user message
   * @param message User message
   * @param onboardingData User's onboarding data
   * @returns Generated response
   */
  private async generateResponse(message: string, onboardingData: OnboardingData): Promise<string> {
    try {
      // In a production environment, we would use the AI model
      // For now, return a simple placeholder response
      return `Mesajınızı aldım: "${message}"\nNasıl yardımcı olabilirim?`;
    } catch (error) {
      console.error('Error generating response:', error);
      return 'Üzgünüm, yanıt oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
    }
  }
}

