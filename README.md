# FoodLog

A conversational food diary that uses AI to parse natural-language meal descriptions and track your daily macros.

Designed to simplify daily diet logging through natural language processing. Instead of manually searching static databases for individual food items, users simply type their meals in plain English. The application processes inputs through a hybrid parsing pipeline that checks a local serverless cache and rules-based logic before utilizing the Google Gemini API to parse natural language, scale quantities, and calculate exact macronutrient values. Built with React, TypeScript, and Tailwind CSS on the frontend and backed by Supabase for database storage and secure session authentication. 
