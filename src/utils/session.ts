import { OnboardingField, UserSession, UserState } from '../types';
import { CONFIG } from '../config';

// In-memory session storage (in a production app, you'd use a database)
const sessions: Map<string, UserSession> = new Map();

/**
 * Session management utility for tracking user state
 */
export class SessionManager {
  /**
   * Get a user session by ID, creating one if it doesn't exist
   * @param userId Unique identifier for the user
   * @param telegramId Telegram user ID
   * @returns User session object
   */
  static getSession(userId: string, telegramId: number): UserSession {
    if (!sessions.has(userId)) {
      // Create a new session if one doesn't exist
      const newSession: UserSession = {
        userId,
        telegramId,
        state: UserState.INITIAL,
        onboardingData: {},
        isAuthenticated: false,
      };
      sessions.set(userId, newSession);
    }
    
    return sessions.get(userId)!;
  }

  /**
   * Update a user's session state
   * @param userId Unique identifier for the user
   * @param updates Partial session updates to apply
   * @returns Updated user session
   */
  static updateSession(userId: string, updates: Partial<UserSession>): UserSession {
    const session = sessions.get(userId);
    
    if (!session) {
      throw new Error(`Session not found for user: ${userId}`);
    }
    
    // Apply updates to the session
    const updatedSession = {
      ...session,
      ...updates,
    };
    
    sessions.set(userId, updatedSession);
    return updatedSession;
  }

  /**
   * Get the next onboarding field based on the current field
   * @param currentField Current onboarding field
   * @returns Next onboarding field or undefined if complete
   */
  static getNextOnboardingField(currentField?: OnboardingField): OnboardingField | undefined {
    const fieldOrder = CONFIG.onboarding.fieldOrder;
    
    if (!currentField) {
      // If no current field, return the first field
      return fieldOrder[0] as OnboardingField;
    }
    
    const currentIndex = fieldOrder.indexOf(currentField);
    
    if (currentIndex === -1 || currentIndex === fieldOrder.length - 1) {
      // If current field is not found or is the last field, return undefined
      return undefined;
    }
    
    return fieldOrder[currentIndex + 1] as OnboardingField;
  }

  /**
   * Get the prompt for a specific onboarding field
   * @param field Onboarding field
   * @returns Prompt text for the field
   */
  static getFieldPrompt(field: OnboardingField): string {
    return CONFIG.onboarding.fieldPrompts[field] || `Please provide your ${field}:`;
  }

  /**
   * Clear a user's session
   * @param userId Unique identifier for the user
   */
  static clearSession(userId: string): void {
    sessions.delete(userId);
  }
}
