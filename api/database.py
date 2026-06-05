import os
from sqlalchemy import create_engine, Column, String, Float, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime
import uuid

import os

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    if os.getenv("VERCEL"):
        DATABASE_URL = "sqlite:////tmp/dev.db"
        print("WARNING: Running on Vercel with ephemeral SQLite in /tmp. Set DATABASE_URL for persistent storage.")
    else:
        DATABASE_URL = "sqlite:///./dev.db"

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow)

    logs = relationship("FoodLog", back_populates="user")
    totals = relationship("DailyTotal", back_populates="user")
    chat_history = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")

class FoodLog(Base):
    __tablename__ = "food_logs"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"))
    raw_input = Column(String)
    is_confirmed = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="logs")
    items = relationship("FoodLogItem", back_populates="log")

class FoodLogItem(Base):
    __tablename__ = "food_log_items"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    log_id = Column(String, ForeignKey("food_logs.id"))
    name = Column(String)
    quantity = Column(Float)
    unit = Column(String, nullable=True)
    calories = Column(Float)
    protein = Column(Float)
    carbs = Column(Float)
    fats = Column(Float)

    log = relationship("FoodLog", back_populates="items")

class DailyTotal(Base):
    __tablename__ = "daily_totals"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"))
    date = Column(String) # YYYY-MM-DD
    total_calories = Column(Float, default=0.0)
    total_protein = Column(Float, default=0.0)
    total_carbs = Column(Float, default=0.0)
    total_fats = Column(Float, default=0.0)

    user = relationship("User", back_populates="totals")

    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uq_user_date'),
    )

class SessionMemory(Base):
    __tablename__ = "session_memory"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, unique=True)
    draft_items = Column(String) # JSON string
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"))
    role = Column(String) # "user" or "model"
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="chat_history")

# Create tables
Base.metadata.create_all(bind=engine)
