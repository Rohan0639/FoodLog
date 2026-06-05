# BiteSize: AI-Powered Conversational Food Logging Assistant

BiteSize is a modern, full-stack application designed to make nutrition and food logging as simple as sending a text message. Powered by Google Gemini AI, it automatically detects food items, estimates quantities and nutritional macros (Calories, Protein, Carbs, Fats), and logs them to a local SQLite database.

---

## 🏗️ System Architecture & Stack

BiteSize is built as a decoupled client-server application:

*   **Backend:**
    *   **FastAPI** for a fast, modern web API.
    *   **SQLAlchemy** ORM for relational mapping.
    *   **SQLite** for local database storage (`dev.db`).
    *   **Google Gemini API** (via `google-genai` SDK) for intent classification and macro estimation.
*   **Frontend:**
    *   **React (v19)** with Vite for rapid hot-reloading and high-performance development.
    *   **Vanilla CSS** with a custom dark-mode, glassmorphism design system.

---

## ⚙️ Prerequisites

Ensure you have the following installed on your system:
*   [Python 3.10+](https://www.python.org/downloads/)
*   [Node.js 18+](https://nodejs.org/)
*   A Google Gemini API key (Obtain one from [Google AI Studio](https://aistudio.google.com/))

---

## 🚀 Running the Project

Follow these steps to get both the backend and frontend services running locally.

### 1. Backend Setup (FastAPI)

1.  **Open your terminal** and navigate to the project root directory:
    ```bash
    cd c:\Users\chint\Desktop\foodlog
    ```

2.  **Set up the environment variables:**
    Create a file named `.env` in the root directory (one may already be present) and add your Gemini API key:
    ```env
    GEMINI_API_KEY=your_gemini_api_key_here
    ```

3.  **Activate the Virtual Environment:**
    A pre-configured virtual environment (`venv`) is already created. Activate it using the command appropriate for your OS:
    *   **Windows (PowerShell):**
        ```powershell
        .\venv\Scripts\Activate.ps1
        ```
    *   **Windows (Command Prompt):**
        ```cmd
        .\venv\Scripts\activate.bat
        ```
    *   **macOS / Linux:**
        ```bash
        source venv/bin/activate
        ```

4.  **Install Dependencies:**
    With the virtual environment active, install the backend libraries:
    ```bash
    pip install -r requirements.txt
    ```

5.  **Run the FastAPI Server:**
    Start the development server with hot-reload enabled:
    ```bash
    uvicorn api.main:app --reload
    ```
    The backend will start running at **`http://localhost:8000`**. You can view the interactive API documentation at `http://localhost:8000/docs`.

---

### 2. Frontend Setup (React + Vite)

1.  **Open a new terminal window** (keep the backend server running in the first terminal) and navigate to the `frontend` folder:
    ```bash
    cd c:\Users\chint\Desktop\foodlog\frontend
    ```

2.  **Install Node dependencies:**
    ```bash
    npm install
    ```

3.  **Run the Vite dev server:**
    ```bash
    npm run dev
    ```
    The application will compile and provide a local address (usually **`http://localhost:5173`**). Open this URL in your browser to start using BiteSize.

---

## 💡 How to Use the App

1.  **Input a Log Prompt:** In the chat console on the right, type what you ate (e.g., `"I had 3 scrambled eggs, 2 slices of whole wheat toast, and a glass of orange juice"`).
2.  **Review the AI Estimates:** The assistant will parse the message, estimate the weights and nutritional values of each item, and display a draft card.
3.  **Refine the Details:** 
    *   Change quantities or select different units (e.g., from `pieces` to `grams`). The macros will automatically scale using pre-defined multipliers!
    *   Add custom items to the draft using the **Add Item** button.
    *   Remove misidentified items with the **Delete** (`X`) button.
4.  **Confirm to Log:** Click **Confirm** to commit the intake. The circular energy gauge and daily macros tracking panel on the left will update in real-time.
5.  **Historical Tracking:** Use the date navigation arrows at the top of the dashboard to view logs and telemetry from previous days.

---

## 🛠️ Troubleshooting

> [!IMPORTANT]
> **Gemini API Errors:** If you see "Error connecting to the assistant" or model errors, double-check that your `GEMINI_API_KEY` in the `.env` file is valid and active.
> 
> **Database Reset:** If you need to clear all history and start fresh, stop the backend server, delete the local `dev.db` file, and restart the server. The tables will recreate themselves automatically.

---

## ☁️ Vercel Deployment Guide

Deploying this app to Vercel is simple and leverages Vercel Serverless Functions for the Python backend.

### 1. Vercel Dashboard Settings
When creating the project on Vercel:
*   **Root Directory:** Select the repository root directory (`.`).
*   **Framework Preset:** Select **Vite** or **Other**.
*   **Build Command:** `npm run build` (this runs the root workspace command, building the frontend).
*   **Output Directory:** `frontend/dist`.

### 2. Environment Variables
Add these keys under the **Environment Variables** tab in your Vercel project settings:
1.  `GEMINI_API_KEY`: Your Google Gemini API key.
2.  `DATABASE_URL` (Optional but recommended): A PostgreSQL database string (e.g. from Neon or Supabase) for persistent storage. If not set, the app will run with an ephemeral SQLite database in Vercel's `/tmp` folder, resetting whenever the serverless function scales down.

