import { Clerk } from '@clerk/clerk-sdk-node';
import { CONFIG } from '../config';

// Initialize Clerk client
const clerk = Clerk({ secretKey: CONFIG.clerk.secretKey });

/**
 * Authentication service for Clerk integration
 */
export class AuthService {
  /**
   * Generate a one-time authentication link for a user
   * @param userId Unique identifier for the user
   * @returns Authentication URL that can be sent to the user
   */
  static async generateAuthLink(userId: string): Promise<string> {
    try {
      console.log(`Generating authentication link for user with external ID: ${userId}`);

      // Use the specific Clerk authentication URL from config
      const clerkSignInUrl = CONFIG.clerk.signInUrl;
      console.log(`Using Clerk sign-in URL: ${clerkSignInUrl}`);

      // Add the userId as a query parameter for tracking
      // Use a callback URL that will be handled by the bot
      const authUrl = `${clerkSignInUrl}?external_id=${encodeURIComponent(userId)}`;
      console.log(`Generated authentication URL: ${authUrl}`);

      return authUrl;
    } catch (error) {
      console.error(`Error generating auth link for user with external ID ${userId}:`, error);
      throw new Error('Failed to generate authentication link');
    }
  }

  /**
   * Verify a user's authentication status
   * @param userId Unique identifier for the user
   * @returns Boolean indicating if the user is authenticated
   */
  static async verifyUser(userId: string): Promise<boolean> {
    try {
      console.log(`Checking if user exists with external ID: ${userId}`);

      // Check if the user exists in Clerk using getUserList with externalId filter
      const response = await clerk.users.getUserList({
        externalId: [userId]
      });

      console.log(`Clerk API response for external ID ${userId}:`, JSON.stringify(response, null, 2));

      // Make sure data exists and has entries
      if (response && response.data && Array.isArray(response.data)) {
        const found = response.data.length > 0;
        if (found) {
          console.log(`Found ${response.data.length} users with external ID: ${userId}`);
          console.log(`First user ID: ${response.data[0].id}`);
        } else {
          console.log(`No users found with external ID: ${userId}`);
        }
        return found;
      }

      // If we get here, the user wasn't found
      console.log(`No user found with external ID: ${userId} (response format issue)`);
      return false;
    } catch (error) {
      console.error(`Error verifying user with external ID ${userId}:`, error);
      return false;
    }
  }

  /**
   * Create a new user in Clerk
   * @param userId Unique identifier for the user
   * @param metadata Additional user metadata
   * @returns The created user ID
   */
  static async createUser(userId: string, metadata: Record<string, any> = {}): Promise<string> {
    try {
      console.log(`Creating user with external ID: ${userId} and metadata:`, JSON.stringify(metadata, null, 2));

      // Create a random email for the user to ensure uniqueness
      const randomEmail = `telegram-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;

      // Create the user with the external ID and a random email
      const user = await clerk.users.create({
        externalId: userId,
        emailAddress: [randomEmail],
        publicMetadata: metadata,
      });

      console.log(`Successfully created user with ID: ${user.id} and external ID: ${userId}`);
      return user.id;
    } catch (error) {
      console.error(`Error creating user with external ID ${userId}:`, error);
      throw new Error('Failed to create user');
    }
  }

  /**
   * Update user's onboarding data in Clerk
   * @param userId Unique identifier for the user
   * @param onboardingData Onboarding data to store
   * @returns Boolean indicating success
   */
  static async updateUserOnboardingData(userId: string, onboardingData: Record<string, any>): Promise<boolean> {
    try {
      console.log(`Updating onboarding data for user with external ID: ${userId}`);
      console.log(`Onboarding data:`, JSON.stringify(onboardingData, null, 2));

      // Find the user by external ID
      const response = await clerk.users.getUserList({
        externalId: [userId]
      });

      console.log(`Clerk API response for external ID ${userId}:`, JSON.stringify(response, null, 2));

      // Make sure data exists and has entries
      if (!response || !response.data || !Array.isArray(response.data) || response.data.length === 0) {
        console.error(`User not found with external ID: ${userId} when trying to update onboarding data`);

        // Try to create the user if they don't exist
        try {
          console.log(`Attempting to create user with external ID: ${userId} before updating onboarding data`);
          const newUserId = await AuthService.createUser(userId, {});

          // Update the newly created user's metadata
          await clerk.users.updateUserMetadata(newUserId, {
            unsafeMetadata: {
              ...onboardingData,
              onboardingCompleted: true,
            },
          });

          console.log(`Created and updated new user with ID: ${newUserId} and external ID: ${userId}`);
          return true;
        } catch (createError) {
          console.error(`Failed to create user with external ID: ${userId}`, createError);
          return false;
        }
      }

      const user = response.data[0];
      console.log(`Found user with ID: ${user.id} and external ID: ${userId}`);

      // Update the user's unsafeMetadata with onboarding data
      await clerk.users.updateUserMetadata(user.id, {
        unsafeMetadata: {
          ...onboardingData,
          onboardingCompleted: true,
        },
      });

      console.log(`Successfully updated onboarding data for user with ID: ${user.id} and external ID: ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error updating onboarding data for user with external ID ${userId}:`, error);
      return false;
    }
  }
}
