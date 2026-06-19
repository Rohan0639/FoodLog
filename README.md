# FoodLog

A conversational food diary that uses AI to parse natural-language meal descriptions and track your daily macros.



## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| AI | Google Gemini API |
| Database & Auth | Supabase (PostgreSQL + RLS) |
| Deployment | Vercel |

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

## Folder Structure

```
foodlog/
├── frontend/
│   ├── src/
│   │   ├── auth/          # Login & Signup pages
│   │   ├── components/    # Navbar, ChatMessage, NutritionDashboard, …
│   │   ├── pages/         # Dashboard (main app page)
│   │   ├── utils/         # Gemini parser, unit converter
│   │   ├── lib/           # Supabase client
│   │   └── types.ts       # Shared TypeScript types
│   └── index.html
├── vercel.json
└── package.json
```

---

## License

MIT
