# Bunder Bot - Telegram Bot with Mastra AI Integration

This project integrates a Telegram bot with the Mastra AI system, allowing users to interact with advanced AI capabilities through Telegram.

## Installation

1. Make sure you have Node.js 20.9.0 or newer installed.

2. Install the dependencies:
   ```
   npm install
   ```

3. Set up your environment variables by creating a `.env.development` file with:
   ```
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token
   GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
   ```

## Running the Bot

### Using the Interactive Starter

The easiest way to start the bot is using the interactive starter:

```
npm start
```

This will present a menu where you can choose to:
1. Start Mastra Server Only
2. Start Telegram Bridge Only
3. Start Both (Recommended)
4. Start Improved Bot (Fallback option)

### Using Direct Commands

You can also start components directly with a single command:

- Start both Mastra and the bridge at once (recommended):
  ```
  npm run start:both
  ```

- Start just the Mastra server:
  ```
  npm run start:mastra
  ```

- Start just the Telegram bridge:
  ```
  npm run start:bridge
  ```

- Start the improved bot (fallback option):
  ```
  npm run start:improved
  ```

### Using Command Line Arguments

You can also run the bot directly with arguments:

```
node index.js both
```

Available commands: `mastra`, `bridge`, `both`, `improved`

## How It Works

The system consists of three main components:

1. **Mastra Server** - The AI backend that powers the responses.
2. **Telegram Bridge** - Connects Telegram messages to the Mastra AI.
3. **Improved Bot** - A fallback option with simpler intent-based responses.

When a user sends a message to the Telegram bot:
1. The bridge forwards it to the Mastra AI server
2. The Mastra AI generates a response
3. The bridge sends the response back to the user

If the Mastra server is unavailable, the system will try to use Gemini API directly as a fallback.

## Bot Commands

The bot supports the following commands:
- `/start` - Start the bot and get a welcome message
- `/help` - Show available commands and help information
- `/clear` - Clear the conversation history

## Project Structure

The project uses a simplified structure with only essential files:

- `index.js` - Main entry point and starter script
- `telegram-mastra-bridge.js` - Telegram to Mastra AI bridge
- `improved-bot.js` - Fallback bot with basic intent matching

## Development

- To run type checking: `npm run typecheck`
- To build for production: `npm run build`

## Troubleshooting

If you encounter errors:

1. Check that your `.env.development` file has valid API keys
2. Make sure the Mastra server is running before starting the bridge
3. Look at the logs in the `logs` directory for detailed error information

## License

ISC
