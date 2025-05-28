import { Mastra } from '@mastra/core';
import { TelegramAgent } from './agents/telegramAgent';
import { EnhancedTelegramAgent } from './agents/enhancedTelegramAgent';
import { CONFIG } from '../config';

// Create the agents
const telegramAgent = new TelegramAgent();
const enhancedTelegramAgent = new EnhancedTelegramAgent();

// Initialize Mastra with both agents
export const mastra = new Mastra({
  agents: {
    telegramAgent: telegramAgent,
    enhancedTelegramAgent: enhancedTelegramAgent
  }
});

// Log initialization
console.log('Mastra initialized with Telegram agents (standard and enhanced)');