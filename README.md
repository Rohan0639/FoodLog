# FoodLog AI Assistant

A full-stack, monochromatic web application designed to log your daily meals and track your nutrition naturally through chat.

## Features
- **Gemini Nutrition Intelligence**: Powered entirely by Gemini 2.5 Flash. Bypasses intermediate parsing steps and fetches food details, quantities, and macronutrients (calories, protein, carbs, fat) in a single LLM request.
- **SQLite Database Ledger**: Automatically records all transaction requests, including raw user messages, stringified Gemini JSON payloads, and timestamps, inside a local SQLite database (using Node's native `node:sqlite`).
- **Monochromatic UI**: Sleek, high-contrast black-and-white theme featuring progress bars and macro tracking.
- **Offline Fallback**: Automatically switches to local mock parsing logic if the backend server is offline, supporting offline-first logging with auto-calculated metrics.
- **Greeting & Clear Triggers**: Handles conversation starters (e.g. "hi", "hello") gracefully, and processes text shortcuts like "clear" or "reset" to clear the logged meal ledger.

## Setup & Running Locally

1. **Install all dependencies**:
   ```bash
   npm run install:all
   ```

2. **Configure environment variables**:
   Create a `.env` file inside the `backend/` directory with:
   ```env
   PORT=5000
   GEMINI_API_KEY=your_gemini_api_key
   ```
   *(Note: Spoonacular API keys are no longer needed).*

3. **Start both frontend and backend concurrently**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## Deployment

Deploy the project as two separate applications on Vercel:
- **Backend**: Set the root directory to `backend/` and configure `GEMINI_API_KEY` in env variables. Database storage will seamlessly fallback to write to Vercel's ephemeral `/tmp` directory.
- **Frontend**: Set the root directory to `frontend/` and configure the environment variable `VITE_API_URL` to point to your deployed backend.

