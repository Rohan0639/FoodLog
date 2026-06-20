# FoodLog

A conversational food diary that uses AI to parse natural-language meal descriptions and track your daily macros.

Designed to simplify daily diet logging through natural language processing. Instead of manually searching static databases for individual food items, users simply type their meals in plain English. The application processes inputs through a hybrid parsing pipeline that checks a local serverless cache and rules-based logic before utilizing the Google Gemini API to parse natural language, scale quantities, and calculate exact macronutrient values. Built with React, TypeScript, and Tailwind CSS on the frontend and backed by Supabase for database storage and secure session authentication. 




---

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/Rohan0639/FoodLog.git
cd FoodLog

# 2. Install dependencies
npm run install:all

# 3. Add environment variables
# Copy frontend environment variables and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
cp frontend/.env.example frontend/.env

# Create a root .env file for backend environment variables and fill in GEMINI_API_KEY
# (Never commit this file or expose GEMINI_API_KEY on the client!)
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env

# 4. Start local development server (Vercel CLI simulates serverless environment)
# Install Vercel CLI globally if you haven't: npm i -g vercel
vercel dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port Vercel dev provides)

---



---

## License

MIT
