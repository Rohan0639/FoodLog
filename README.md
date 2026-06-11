# 🍳 FoodLog

A premium, serverless, monochromatic web application designed to track your nutrition naturally through conversational AI, built with React 19, Vite, Tailwind CSS, Supabase, and Gemini AI.

---

## ✨ Features

- **🧠 Gemini 3.1 Flash Lite Parser**: Send natural language commands (e.g., *"I had 3 eggs, a bowl of oatmeal, and a glass of orange juice for breakfast"*) and get them parsed into detailed individual food items with exact macronutrients (calories, protein, carbs, fats) instantly.
- **🔐 Supabase Serverless Backend**: Comprehensive user authentication (Sign Up / Log In) and cloud data persistence using Supabase's secure API Client and Row-Level Security (RLS).
- **⚡ Interactive Verification**: A verification panel that displays parsed items, allowing you to edit quantities, scale portions, change units, and verify calculations before confirming them to your ledger.
- **📡 Offline-First Mode & Background Sync**:
  - Automatically handles network outages.
  - Queues additions, edits, and deletions in a local sync pipeline.
  - Automatically executes pending synchronization when returning online, passing raw descriptions to Gemini for parsing and updating the remote database.
- **📊 Rich Analytics & Tracker Log**:
  - **Today's Log**: Tracks daily target goals (2000 kcal, 135g protein, 230g carbs, 70g fat) with sleek progress bars and real-time calorie counts.
  - **History & Stats**: A calendar view showing logged days, a visual 7-day calorie chart, weekly averages, and active logging streaks.


---

## 🛠️ Architecture & Tech Stack

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vite.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/)
- **Database & Auth**: [Supabase](https://supabase.com/) (`@supabase/supabase-js`)
- **AI Integration**: Client-side integration with [Google Gemini API](https://ai.google.dev/) (utilizing `gemini-3.1-flash-lite` for high speed and low latency)
- **Icons & Effects**: [Lucide React](https://lucide.dev/), [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti)

---

## 📂 Project Structure

```
foodlog/
├── frontend/               # React Vite frontend application
│   ├── src/
│   │   ├── auth/          # Login & Signup authentication screens
│   │   ├── components/    # Reusable components (Navbar, Calendar, DayLog, Charts, etc.)
│   │   ├── lib/           # Supabase client initializer
│   │   ├── pages/         # Dashboard / Core Workspace
│   │   ├── utils/         # Gemini Client Parser & Unit conversion utilities
│   │   ├── types.ts       # TypeScript type specifications
│   │   └── main.tsx       # Vite entry point
│   ├── tailwind.config.js # Custom monochromatic styling configuration
│   └── package.json       # Dependencies & Scripts
├── vercel.json             # Vercel deployment instructions
└── package.json           # Workspace root scripts
```

---

## ⚙️ Setup & Running Locally

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 2. Clone the Repository
```bash
git clone https://github.com/Rohan0639/FoodLog.git
cd FoodLog
```

### 3. Install Dependencies
Install packages for the frontend workspace using the root helper script:
```bash
npm run install:all
```

### 4. Environment Variables
Create a `.env` file inside the `frontend/` directory:
```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

> **Note**: You can obtain a free Gemini API key from [Google AI Studio](https://aistudio.google.com/).

### 5. Supabase Table Schema
To support the database schema, make sure your Supabase instance has a table named `food_logs` with the following columns:

| Column Name | Data Type | Default / Settings |
|-------------|-----------|--------------------|
| `id`        | `uuid`    | Primary Key, `gen_random_uuid()` |
| `user_id`   | `uuid`    | Foreign Key to `auth.users.id` |
| `name`      | `text`    | - |
| `quantity`  | `numeric` | - |
| `unit`      | `text`    | - |
| `calories`  | `integer` | - |
| `protein`   | `numeric` | - |
| `carbs`     | `numeric` | - |
| `fats`      | `numeric` | - |
| `date`      | `date`    | - |
| `created_at`| `timestamptz` | `now()` |

Enable Row-Level Security (RLS) on `food_logs` with policies allowing users to read, insert, update, and delete only their own records based on `auth.uid() = user_id`.

### 6. Run the Application
Start the development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🚀 Deployment

The project is preconfigured to deploy to [Vercel](https://vercel.com/) with a root `vercel.json` file pointing to the frontend build:

```json
{
  "buildCommand": "npm run build --prefix frontend",
  "installCommand": "npm install --prefix frontend",
  "outputDirectory": "frontend/dist"
}
```

Simply connect this repository to your Vercel account, set the root directory to project root, and configure the Environment Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, and `VITE_GEMINI_API_KEY`) in your Vercel project settings.
