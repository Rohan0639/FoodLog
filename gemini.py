import os
import json
from google import genai
from google.genai import types

def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    return genai.Client(api_key=api_key)

MODEL_CANDIDATES = [
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-2.5-flash"
]

def generate_content_with_fallback(prompt: str, config: types.GenerateContentConfig) -> str:
    client = get_gemini_client()
    last_err = None
    for model in MODEL_CANDIDATES:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=config,
            )
            return response.text
        except Exception as e:
            last_err = e
            print(f"Model {model} failed: {e}. Trying fallback...")
            continue
    raise last_err

def detect_intent(message: str) -> dict:
    prompt = f"""
    You are an intent classifier for a conversational food logging assistant.
    Your task is to classify the user's message into exactly one of these categories:
    - LOG_FOOD: User is describing foods they ate, plan to eat, or want to record (e.g., "I ate 2 chapatis", "having rice and chicken").
    - OTHER: Greetings, generic questions, greetings, or general queries (e.g., "hello", "how are you?", "what is the capital of France?").

    User Message: "{message}"

    Return a JSON object with the exact schema:
    {{ "intent": "LOG_FOOD" | "OTHER", "confidence": 0.99 }}
    """
    
    text = generate_content_with_fallback(
        prompt=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0,
        ),
    )
    return json.loads(text)

def extract_food_items(text: str) -> list:
    prompt = f"""
    Extract all foods and quantities from the text.
    Input text: "{text}"

    Return a JSON array of objects with the exact schema:
    [
      {{ "food": "name of food", "quantity": number or string (e.g., 2 or "1 bowl") }}
    ]
    Only extract items mentioned. Do not add any extra fields.
    """
    
    res_text = generate_content_with_fallback(
        prompt=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0,
        ),
    )
    return json.loads(res_text)

def estimate_nutrition(food_name: str, quantity: str) -> dict:
    prompt = f"""
    Estimate nutritional parameters for this food item:
    Food: {food_name}
    Quantity: {quantity}

    Calculate calories (kcal), protein (g), carbohydrates (g), and fats (g). Ensure estimates are scientifically reasonable.
    Return a JSON object:
    {{
      "foodName": "{food_name}",
      "quantity": "{quantity}",
      "calories": 100,
      "protein": 5,
      "carbohydrates": 10,
      "fats": 2
    }}
    Ensure all nutritional values are numbers.
    """
    
    res_text = generate_content_with_fallback(
        prompt=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0,
        ),
    )
    return json.loads(res_text)

def analyze_food_message(message: str) -> dict:
    prompt = f"""
    You are an AI nutrition assistant for a food logging application.
    Your task is to analyze the user's message: "{message}".
    
    1. First, classify the user's intent:
       - If the user is describing foods/drinks they ate, plan to eat, or want to record (e.g., "I ate 2 chapatis", "having rice and chicken", "1 cup coffee"), set intent to "LOG_FOOD".
       - Otherwise (greetings, general chat, questions like "what is the capital of France?"), set intent to "OTHER".
       
    2. If intent is "LOG_FOOD":
       - Extract all food items from the message.
       - Estimate nutritional parameters (calories, protein, carbohydrates, fats) for each item based on its quantity.
       - Ensure the estimates are scientifically reasonable.
       
    Return a JSON object with the exact schema:
    {{
      "intent": "LOG_FOOD" | "OTHER",
      "response": "A friendly conversational response to the user. For LOG_FOOD, summarize what you estimated (e.g., 'Eggs and toast ≈ 300 kcal. Would you like to log this?').",
      "items": [
        {{
          "name": "food item name",
          "quantity": 2.0,
          "unit": "pieces" | "g" | "bowl" | "slice" | etc.,
          "calories": 150.0,
          "protein": 12.0,
          "carbs": 2.0,
          "fats": 10.0
        }}
      ]
    }}
    Ensure all nutritional values are floats. If intent is OTHER, "items" should be an empty list.
    """
    
    res_text = generate_content_with_fallback(
        prompt=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.0,
        ),
    )
    return json.loads(res_text)

