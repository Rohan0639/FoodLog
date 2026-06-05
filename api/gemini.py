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

SYSTEM_INSTRUCTION = """
You are an AI nutrition assistant for a food logging application named BiteSize.
Your task is to analyze the conversation and the user's latest message.

1. Classify the user's intent:
   - LOG_FOOD: The user is describing foods/drinks they ate, plan to eat, or want to record (e.g., "I ate 2 chapatis", "having rice and chicken", "1 cup coffee").
   - OTHER: The user is asking a question about nutrition/health (e.g., "Is salmon healthy?", "How much protein is in eggs?", "Why should I eat fiber?"), asking for general chat/greetings, or asking anything else.

2. Generate the appropriate output fields:
   - For LOG_FOOD:
     - Extract all food items from the message.
     - Estimate nutritional parameters (calories, protein, carbohydrates, fats) for each item based on its quantity. Ensure the estimates are scientifically reasonable.
     - Set the "response" field to a friendly summary of what you estimated (e.g., "Eggs and toast ≈ 300 kcal. Do you want to log this?").
   - For OTHER:
     - Provide a helpful, friendly, and informative conversational answer to their question in the "response" field.
     - Keep the conversation focused on food, nutrition, health, and wellness. If they ask about unrelated topics, politely steer them back.
     - Set the "items" field to an empty list [].

Return a JSON object with the exact schema:
{
  "intent": "LOG_FOOD" | "OTHER",
  "response": "Your conversational reply or summary message",
  "items": [
    {
      "name": "food item name",
      "quantity": 2.0,
      "unit": "pieces" | "g" | "bowl" | "slice" | etc.,
      "calories": 150.0,
      "protein": 12.0,
      "carbs": 2.0,
      "fats": 10.0
    }
  ]
}
Ensure all nutritional values are floats. If intent is OTHER, "items" should be an empty list.
"""

def generate_chat_content_with_fallback(contents: list, system_instruction: str) -> str:
    client = get_gemini_client()
    last_err = None
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json",
        temperature=0.2,
    )
    for model in MODEL_CANDIDATES:
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
            return response.text
        except Exception as e:
            last_err = e
            print(f"Model {model} failed: {e}. Trying fallback...")
            continue
    raise last_err

def analyze_food_message_with_history(message: str, history: list) -> dict:
    contents = []
    for h in history:
        contents.append(
            types.Content(
                role=h["role"],
                parts=[types.Part.from_text(text=h["content"])]
            )
        )
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=message)]
        )
    )

    res_text = generate_chat_content_with_fallback(
        contents=contents,
        system_instruction=SYSTEM_INSTRUCTION
    )
    return json.loads(res_text)

