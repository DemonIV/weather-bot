import { GoogleGenerativeAI } from '@google/generative-ai';
import { CONFIG } from '../src/config';

// Create a Gemini API client
const genAI = new GoogleGenerativeAI(CONFIG.gemini.apiKey || '');
const model = genAI.getGenerativeModel({ model: CONFIG.gemini.model || 'gemini-pro' });

/**
 * Get a response from the Gemini API for a given message
 * 
 * @param message The user message to process
 * @returns The AI generated response text
 */
export async function getGeminiResponse(message: string): Promise<string> {
  console.log(`Processing message with Gemini: "${message.substring(0, 20)}..."`);
  
  if (!CONFIG.gemini.apiKey) {
    console.warn('No Gemini API key provided in configuration');
    return "API anahtarı eksik. Lütfen sistem yöneticinize başvurun.";
  }
  
  try {
    const prompt = `
    Aşağıdaki kullanıcı mesajına Türkçe yanıt ver. 
    Sen bir iş ortaklığı bulmaya yardımcı olan Bunder Bot adında bir asistansın.
    Cevabın kısa ve net olsun. 150 kelimeyi geçme.
    
    Kullanıcı mesajı: "${message}"
    `;
    
    // Generate content with proper error handling
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    if (text && text.length > 0) {
      console.log(`Gemini response generated (${text.length} chars): "${text.substring(0, 30)}..."`);
      return text;
    }
    
    // Fallback to simple response if API returns empty
    return "Sizinle iletişime geçtiğiniz için teşekkür ederiz. Nasıl yardımcı olabilirim?";
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // Return fallback response instead of throwing error
    return "Şu anda AI sistemimiz yoğun. Basit sorularınıza yanıt verebilirim. Nasıl yardımcı olabilirim?";
  }
} 