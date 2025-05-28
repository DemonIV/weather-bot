import { OnboardingData, OnboardingDataSchema, OnboardingField, UserSession, UserState } from '../types';
import { AuthService } from './auth';
import { SessionManager } from './session';
import { TelegramService } from './telegram';
import { z } from 'zod';

/**
 * Onboarding service for handling the data collection process
 */
export class OnboardingService {
  /**
   * Start the onboarding process for a user
   * @param userId Unique identifier for the user
   * @param telegramId Telegram user ID
   */
  static async startOnboarding(userId: string, telegramId: number): Promise<void> {
    // Get or create the user session
    const session = SessionManager.getSession(userId, telegramId);

    // Update the session state to onboarding
    SessionManager.updateSession(userId, {
      state: UserState.ONBOARDING,
      currentField: SessionManager.getNextOnboardingField(),
    });

    // Send the first onboarding prompt
    await this.promptForCurrentField(userId);
  }

  /**
   * Process a user's response for the current onboarding field
   * @param userId Unique identifier for the user
   * @param response User's response text
   */
  static async processFieldResponse(userId: string, response: string): Promise<void> {
    // Get the user session
    const session = SessionManager.getSession(userId, 0); // We'll get the telegramId from the session

    if (session.state !== UserState.ONBOARDING || !session.currentField) {
      // User is not in onboarding state or no current field
      return;
    }

    try {
      // Process the response based on the current field
      const updatedData = await this.validateAndUpdateField(
        session.currentField,
        response,
        session.onboardingData
      );

      // Get the next field
      const nextField = SessionManager.getNextOnboardingField(session.currentField);

      if (nextField) {
        // Update session with the new data and move to the next field
        SessionManager.updateSession(userId, {
          onboardingData: updatedData,
          currentField: nextField,
        });

        // Prompt for the next field
        await this.promptForCurrentField(userId);
      } else {
        // Onboarding is complete
        SessionManager.updateSession(userId, {
          onboardingData: updatedData,
          state: UserState.ONBOARDING_COMPLETE,
          currentField: undefined,
        });

        // Store the onboarding data in Clerk
        const success = await AuthService.updateUserOnboardingData(userId, updatedData);

        // Send completion message
        if (success) {
          await TelegramService.sendMessage(
            session.telegramId,
            'Thank you! Your onboarding is complete. All your information has been saved to your Clerk profile.'
          );
        } else {
          await TelegramService.sendMessage(
            session.telegramId,
            'Thank you! Your onboarding is complete. Your information has been saved locally, but there was an issue saving it to your profile.'
          );
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Validation error, prompt again with error message
        const errorMessage = error.errors.map(e => e.message).join('\\n');
        await TelegramService.sendMessage(
          session.telegramId,
          `Invalid input: ${errorMessage}\\n\\nPlease try again.`
        );
        await this.promptForCurrentField(userId);
      } else {
        // Other error
        console.error('Error processing field response:', error);
        await TelegramService.sendMessage(
          session.telegramId,
          'An error occurred while processing your response. Please try again.'
        );
      }
    }
  }

  /**
   * Prompt the user for the current onboarding field
   * @param userId Unique identifier for the user
   */
  static async promptForCurrentField(userId: string): Promise<void> {
    // Get the user session
    const session = SessionManager.getSession(userId, 0); // We'll get the telegramId from the session

    if (session.state !== UserState.ONBOARDING || !session.currentField) {
      // User is not in onboarding state or no current field
      return;
    }

    // Get the prompt for the current field
    const prompt = SessionManager.getFieldPrompt(session.currentField);

    // Send the prompt to the user
    await TelegramService.sendMessage(session.telegramId, prompt);
  }

  /**
   * Validate and update a field in the onboarding data
   * @param field Field to update
   * @param value New value for the field
   * @param currentData Current onboarding data
   * @returns Updated onboarding data
   */
  static async validateAndUpdateField(
    field: OnboardingField,
    value: string,
    currentData: Partial<OnboardingData>
  ): Promise<Partial<OnboardingData>> {
    // Create a schema for just this field
    const fieldSchema = z.object({
      [field]: OnboardingDataSchema.shape[field],
    });

    // Process the value based on the field type
    let processedValue: any = value;

    // Handle array fields
    if (field === OnboardingField.REGIONS || field === OnboardingField.COLLABORATION_INTERESTS) {
      processedValue = value.split(',').map(item => item.trim());
    }

    // Validate the field
    const validatedData = fieldSchema.parse({
      [field]: processedValue,
    });

    // Return the updated data
    return {
      ...currentData,
      ...validatedData,
    };
  }

  /**
   * Get the complete onboarding data for a user
   * @param userId Unique identifier for the user
   * @returns Complete onboarding data or null if incomplete
   */
  static getCompleteOnboardingData(userId: string): OnboardingData | null {
    // Extract the telegramId from the userId (format: "telegram:123456789")
    const telegramId = parseInt(userId.split(':')[1], 10);

    // Get the user session
    const session = SessionManager.getSession(userId, telegramId);

    if (session.state !== UserState.ONBOARDING_COMPLETE) {
      // Onboarding is not complete
      return null;
    }

    try {
      // Validate the complete data
      const validatedData = OnboardingDataSchema.parse(session.onboardingData);
      return validatedData;
    } catch (error) {
      console.error('Error validating complete onboarding data:', error);
      return null;
    }
  }
}
