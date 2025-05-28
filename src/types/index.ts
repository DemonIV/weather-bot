import { z } from 'zod';

// Define the onboarding data schema using Zod
export const OnboardingDataSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  linkedInURL: z.string().url("Please provide a valid LinkedIn URL"),
  headquarters: z.string().min(1, "Headquarters location is required"),
  logo: z.string().optional(), // This could be a URL or file path
  website: z.string().url("Please provide a valid website URL"),
  industry: z.string().min(1, "Industry is required"),
  businessGoal: z.string().min(1, "Business goal is required"),
  partnerType: z.string().min(1, "Partner type is required"),
  companySize: z.string().min(1, "Company size is required"),
  products: z.string().min(1, "Products information is required"),
  regions: z.array(z.string()).min(1, "At least one region is required"),
  businessStage: z.string().min(1, "Business stage is required"),
  collaborationInterests: z.array(z.string()).min(1, "At least one collaboration interest is required"),
});

// Define the type based on the schema
export type OnboardingData = z.infer<typeof OnboardingDataSchema>;

// Define the user state for tracking conversation flow
export enum UserState {
  INITIAL = 'initial',
  AUTHENTICATING = 'authenticating',
  ONBOARDING = 'onboarding',
  ONBOARDING_COMPLETE = 'onboarding_complete',
}

// Define the onboarding field state for tracking which field is being collected
export enum OnboardingField {
  COMPANY_NAME = 'companyName',
  LINKEDIN_URL = 'linkedInURL',
  HEADQUARTERS = 'headquarters',
  LOGO = 'logo',
  WEBSITE = 'website',
  INDUSTRY = 'industry',
  BUSINESS_GOAL = 'businessGoal',
  PARTNER_TYPE = 'partnerType',
  COMPANY_SIZE = 'companySize',
  PRODUCTS = 'products',
  REGIONS = 'regions',
  BUSINESS_STAGE = 'businessStage',
  COLLABORATION_INTERESTS = 'collaborationInterests',
}

// Define the user session type
export interface UserSession {
  userId: string;
  telegramId: number;
  state: UserState;
  currentField?: OnboardingField;
  onboardingData: Partial<OnboardingData>;
  isAuthenticated: boolean;
}
