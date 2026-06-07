# FoodLog AI Assistant

A full-stack, monochromatic web application designed to log your daily meals and track your nutrition naturally through chat.

## Features
- **AI Food Parser**: Uses Gemini AI to extract food names, quantities, and units from natural text. Supports automatic correction of typos (e.g. `"chcken"` ➔ `"chicken"`).
- **Macronutrient API**: Integrates with the Spoonacular API to fetch accurate calories, protein, carbs, and fat.
- **Monochromatic UI**: Sleek, high-contrast black-and-white theme featuring progress bars and macro tracking.
- **Offline Fallback**: Automatically switches to local parsing logic if the backend server is offline.

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
   SPOONACULAR_API_KEY=your_spoonacular_api_key
   ```

3. **Start both frontend and backend concurrently**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## Deployment

Deploy the project as two separate applications on Vercel:
- **Backend**: Set the root directory to `backend/` and configure `GEMINI_API_KEY` and `SPOONACULAR_API_KEY`.
- **Frontend**: Set the root directory to `frontend/` and configure the environment variable `VITE_API_URL` to point to your deployed backend.
