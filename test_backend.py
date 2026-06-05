import os
import json
from dotenv import load_dotenv
load_dotenv()

from api.database import SessionLocal, User, ChatMessage, SessionMemory, DailyTotal, FoodLog
from api.gemini import analyze_food_message_with_history

def test_gemini():
    print("Testing Gemini integration...")
    # Turn 1: Log pepperoni pizza
    history = []
    msg1 = "I had a slice of pepperoni pizza"
    print(f"User: {msg1}")
    res1 = analyze_food_message_with_history(msg1, history)
    print("Gemini Response 1:")
    print(json.dumps(res1, indent=2))
    
    # Add to history
    history.append({"role": "user", "content": msg1})
    history.append({"role": "model", "content": res1.get("response", "")})
    
    # Turn 2: Ask question relative to pizza
    msg2 = "Is this healthy?"
    print(f"\nUser: {msg2}")
    res2 = analyze_food_message_with_history(msg2, history)
    print("Gemini Response 2:")
    print(json.dumps(res2, indent=2))

if __name__ == "__main__":
    test_gemini()
