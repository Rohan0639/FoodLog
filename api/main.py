from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
import json
import uuid
import database
import gemini
import re
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

def safe_float(val, default=0.0) -> float:
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().lower()
    for unit in ["kcal", "calories", "g", "grams", "mg", "ml"]:
        s = s.replace(unit, "")
    s = s.strip()
    try:
        return float(s)
    except ValueError:
        matches = re.findall(r"[-+]?\d*\.\d+|\d+", s)
        if matches:
            try:
                return float(matches[0])
            except ValueError:
                pass
        return default

app = FastAPI(title="AI-Powered Conversational Food Logging Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---

class ChatRequest(BaseModel):
    userId: str
    message: str

class LogConfirmRequest(BaseModel):
    userId: str
    draftId: str
    confirm: bool
    items: Optional[List[dict]] = None

# --- Endpoints ---

@app.post("/api/chat")
def chat(request: ChatRequest, db: Session = Depends(database.get_db)):
    # 1. Ensure user exists
    user = db.query(database.User).filter(database.User.id == request.userId).first()
    if not user:
        user = database.User(id=request.userId)
        db.add(user)
        db.commit()

    # 2. Check if this is an "add" operation appending to an existing draft
    mem = db.query(database.SessionMemory).filter(database.SessionMemory.user_id == request.userId).first()
    is_add_operation = False
    existing_items = []
    existing_draft_id = None
    existing_raw_input = ""

    if mem and mem.draft_items:
        try:
            old_draft = json.loads(mem.draft_items)
            if old_draft and isinstance(old_draft, dict) and "items" in old_draft and old_draft["items"]:
                existing_items = old_draft["items"]
                existing_draft_id = old_draft.get("draftId")
                existing_raw_input = old_draft.get("rawInput", "")
                
                # Check if message starts with add keywords
                msg_clean = request.message.strip().lower()
                if re.match(r"^(add|also|and|plus|append)\b", msg_clean):
                    is_add_operation = True
        except Exception:
            pass

    # Fetch recent conversation history
    history_records = db.query(database.ChatMessage).filter(
        database.ChatMessage.user_id == request.userId
    ).order_by(database.ChatMessage.timestamp.asc()).all()
    history = [{"role": h.role, "content": h.content} for h in history_records[-10:]]

    # 3. Classify, extract, and estimate in a single call with history context
    try:
        analysis = gemini.analyze_food_message_with_history(request.message, history)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

    if analysis.get("intent") != "LOG_FOOD":
        # Save user message to database
        user_msg = database.ChatMessage(user_id=request.userId, role="user", content=request.message)
        db.add(user_msg)
        
        # Save model response to database
        model_response_text = analysis.get("response", "Hello! I am your food logging assistant. Tell me what you ate to log it.")
        model_msg = database.ChatMessage(user_id=request.userId, role="model", content=model_response_text)
        db.add(model_msg)
        db.commit()

        return {
            "intent": "OTHER",
            "response": model_response_text
        }

    # Extract draft items from analysis response
    new_items = []
    items_list = analysis.get("items", [])
    if not isinstance(items_list, list):
        items_list = []
        
    for item in items_list:
        if not isinstance(item, dict):
            continue
        food_name = item.get("name", "Unknown")
        qty_val = item.get("quantity", 1)
        
        parsed_qty = safe_float(qty_val, 1.0)
        cals = safe_float(item.get("calories"), 0.0)
        prot = safe_float(item.get("protein"), 0.0)
        carbs = safe_float(item.get("carbs"), 0.0)
        fats = safe_float(item.get("fats"), 0.0)

        new_items.append({
            "name": food_name,
            "quantity": parsed_qty,
            "unit": item.get("unit"),
            "calories": cals,
            "protein": prot,
            "carbs": carbs,
            "fats": fats
        })

    if not new_items and not is_add_operation:
        # Save user message to database
        user_msg = database.ChatMessage(user_id=request.userId, role="user", content=request.message)
        db.add(user_msg)
        
        # Save model response to database
        model_response_text = analysis.get("response", "I couldn't identify any food items. Tell me what you ate to log it.")
        model_msg = database.ChatMessage(user_id=request.userId, role="model", content=model_response_text)
        db.add(model_msg)
        db.commit()

        return {
            "intent": "OTHER",
            "response": model_response_text
        }

    # 4. Merge items if appending, otherwise create new list
    if is_add_operation and new_items:
        draft_items = existing_items + new_items
        raw_input = f"{existing_raw_input} + {request.message}"
        draft_id = existing_draft_id if existing_draft_id else str(uuid.uuid4())
        response_msg_prefix = "Added to draft. "
    else:
        draft_items = new_items
        raw_input = request.message
        draft_id = str(uuid.uuid4())
        response_msg_prefix = ""

    # 5. Store in SessionMemory
    stored_data = {
        "draftId": draft_id,
        "rawInput": raw_input,
        "items": draft_items
    }
    
    if not mem:
        mem = database.SessionMemory(user_id=request.userId, draft_items=json.dumps(stored_data))
        db.add(mem)
    else:
        mem.draft_items = json.dumps(stored_data)

    # Save user message to database
    user_msg = database.ChatMessage(user_id=request.userId, role="user", content=request.message)
    db.add(user_msg)

    # 6. Build response
    total_cals = sum(d["calories"] for d in draft_items)
    food_names = ", ".join([d["name"] for d in draft_items])
    model_response_text = f"{response_msg_prefix}{food_names} ≈ {total_cals:.1f} kcal. Do you want to log this?"

    # Save model response to database
    model_msg = database.ChatMessage(user_id=request.userId, role="model", content=model_response_text)
    db.add(model_msg)
    
    db.commit()

    return {
        "intent": "LOG_FOOD",
        "response": model_response_text,
        "pendingLog": stored_data
    }

@app.post("/api/log/confirm")
def log_confirm(request: LogConfirmRequest, db: Session = Depends(database.get_db)):
    if not request.confirm:
        return {"success": False, "message": "Log canceled."}

    # 1. Retrieve session memory
    mem = db.query(database.SessionMemory).filter(database.SessionMemory.user_id == request.userId).first()
    if not mem or not mem.draft_items:
        raise HTTPException(status_code=400, detail="No pending log found.")

    draft_data = json.loads(mem.draft_items)
    if draft_data.get("draftId") != request.draftId:
        raise HTTPException(status_code=400, detail="Draft ID mismatch.")

    # 2. Create FoodLog
    food_log = database.FoodLog(
        user_id=request.userId,
        raw_input=draft_data.get("rawInput", ""),
        is_confirmed=True
    )
    db.add(food_log)
    db.flush() # get food_log.id

    # 3. Create FoodLogItems & Accumulate Totals
    date_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    daily_total = db.query(database.DailyTotal).filter(
        database.DailyTotal.user_id == request.userId,
        database.DailyTotal.date == date_str
    ).first()

    if not daily_total:
        daily_total = database.DailyTotal(user_id=request.userId, date=date_str)
        db.add(daily_total)
        db.flush()

    # Use client-passed updated items if present, otherwise default to session draft items
    items = request.items if request.items is not None else draft_data.get("items", [])
    for item in items:
        db_item = database.FoodLogItem(
            log_id=food_log.id,
            name=item.get("name"),
            quantity=item.get("quantity"),
            unit=item.get("unit"),
            calories=item.get("calories", 0),
            protein=item.get("protein", 0),
            carbs=item.get("carbs", 0),
            fats=item.get("fats", 0)
        )
        db.add(db_item)

        daily_total.total_calories += item.get("calories", 0)
        daily_total.total_protein += item.get("protein", 0)
        daily_total.total_carbs += item.get("carbs", 0)
        daily_total.total_fats += item.get("fats", 0)

    # Clear memory
    mem.draft_items = ""
    db.commit()

    return {
        "success": True,
        "message": "Intake logged successfully.",
        "loggedItems": items
    }

@app.get("/api/summary/daily")
def summary_daily(userId: str, date: str, db: Session = Depends(database.get_db)):
    daily_total = db.query(database.DailyTotal).filter(
        database.DailyTotal.user_id == userId,
        database.DailyTotal.date == date
    ).first()

    if not daily_total:
        return {
            "userId": userId,
            "date": date,
            "totalCalories": 0.0,
            "totalProtein": 0.0,
            "totalCarbs": 0.0,
            "totalFats": 0.0
        }

    return {
        "userId": userId,
        "date": date,
        "totalCalories": daily_total.total_calories,
        "totalProtein": daily_total.total_protein,
        "totalCarbs": daily_total.total_carbs,
        "totalFats": daily_total.total_fats
    }

@app.get("/api/logs/daily")
def get_daily_logs(userId: str, date: str, db: Session = Depends(database.get_db)):
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    
    logs = db.query(database.FoodLog).filter(
        database.FoodLog.user_id == userId
    ).all()
    
    daily_logs = []
    for log in logs:
        if log.timestamp.date() == target_date:
            items = []
            for item in log.items:
                items.append({
                    "id": item.id,
                    "name": item.name,
                    "quantity": item.quantity,
                    "unit": item.unit,
                    "calories": item.calories,
                    "protein": item.protein,
                    "carbs": item.carbs,
                    "fats": item.fats
                })
            daily_logs.append({
                "id": log.id,
                "rawInput": log.raw_input,
                "timestamp": log.timestamp.isoformat(),
                "items": items
            })
    return daily_logs

