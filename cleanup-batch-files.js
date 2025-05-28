#!/usr/bin/env node

/**
 * Cleanup script to remove all unnecessary files
 * This includes batch files, old bridge files, and other unused JavaScript files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Files to remove
const filesToDelete = [
  // Batch files
  'start-telegram-ai.bat',
  'improved-bot.bat',
  'reset-bot.bat',
  'test-send.bat',
  'fix-bot.bat',
  'get-chat-id.bat',
  'run-simple-bot.bat',
  'clear-webhook.bat',
  'run-mastra-bridge.bat',
  'cleanup.bat',
  'start-all.bat',
  'mastra_bridge_esm.bat',
  'mastra_bridge.bat',
  'start.bat',
  'run.bat',
  'install_deps.bat',
  
  // Old bridge files
  'mastra_bridge.cjs',
  'mastra_bridge.js',
  'mastra_bridge_esm.js',
  
  // Other unused JavaScript files
  'simple-bot.js',
  'fix-bot.js',
  'test-send.js',
  'reset-bot.js',
  'get-chat-id.js',
  'clear-webhook.js',
  
  // Now redundant files that have been replaced by index.js
  'start-bot.js'
];

console.log('Starting cleanup of all unnecessary files...');

let deletedCount = 0;
let errorCount = 0;

// Delete files
filesToDelete.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`✅ Deleted: ${file}`);
      deletedCount++;
    } catch (error) {
      console.error(`❌ Error deleting ${file}: ${error.message}`);
      errorCount++;
    }
  } else {
    console.log(`⚠️ File not found, skipping: ${file}`);
  }
});

console.log('\nCleanup complete!');
console.log(`Successfully deleted: ${deletedCount} files`);
if (errorCount > 0) {
  console.log(`Failed to delete: ${errorCount} files`);
}
console.log('\nThe system now uses only the essential files:');
console.log('- index.js - Main entry point (replaces start-bot.js)');
console.log('- telegram-mastra-bridge.js - Bridge between Telegram and Mastra');
console.log('- improved-bot.js - Fallback bot (only if needed)');
console.log('\nUse "npm start" to run the interactive starter or "npm run start:both" to start everything.'); 