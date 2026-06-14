

---

## Features

- 🤖 **AI-powered parsing** — describe meals in plain English via Gemini API
- 📊 **Macro tracking** — calories, protein, carbs, fat with daily progress bars
- 📅 **History & calendar** — browse past logs day by day
- ✏️ **Edit / delete entries** — adjust quantity, unit, and macros inline
- 🔌 **Offline support** — saves locally, syncs when back online
- 📱 **Mobile-first UI** — fluid layout that works on any screen size

---

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
cp frontend/.env.example frontend/.env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GEMINI_API_KEY

# 4. Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

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
