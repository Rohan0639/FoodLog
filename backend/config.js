import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve current directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
  PORT: process.env.PORT || 5000,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  SPOONACULAR_API_KEY: process.env.SPOONACULAR_API_KEY,
};

// Validate crucial parameters
if (!config.GEMINI_API_KEY) {
  console.error('\n================================================================');
  console.error('CRITICAL: GEMINI_API_KEY is not defined in backend/.env file.');
  console.error('Please configure your API key before launching the server.');
  console.error('================================================================\n');
  process.exit(1);
}

if (!config.SPOONACULAR_API_KEY || config.SPOONACULAR_API_KEY === 'your_spoonacular_api_key_here') {
  console.warn('\n================================================================');
  console.warn('WARNING: SPOONACULAR_API_KEY is not configured or uses placeholder.');
  console.warn('The /get-nutrition API will fail until a valid key is set in .env.');
  console.warn('================================================================\n');
}

export default config;
