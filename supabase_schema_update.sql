-- 📁 FoodLog — Production Database Reorganization & Streaks Migration
-- Run these scripts in the SQL Editor of your Supabase Console.

-- 1. Create B-Tree Indexes for Optimizing Queries
CREATE INDEX IF NOT EXISTS idx_food_logs_user_id_date ON food_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_food_logs_date ON food_logs(date);

-- 2. Create user_profiles table for Precomputed Streaks
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  last_logged_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for user_profiles access control
CREATE POLICY "Users can read own profile" 
  ON user_profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON user_profiles FOR UPDATE 
  USING (auth.uid() = user_id);

-- 3. Create Streak Update Trigger Function
CREATE OR REPLACE FUNCTION update_user_streak_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  prev_last_date DATE;
  curr_streak INTEGER;
BEGIN
  -- Select streak details
  SELECT last_logged_date, current_streak 
  INTO prev_last_date, curr_streak
  FROM user_profiles 
  WHERE user_id = NEW.user_id;

  -- Create profile if missing
  IF NOT FOUND THEN
    INSERT INTO user_profiles (user_id, current_streak, last_logged_date)
    VALUES (NEW.user_id, 1, NEW.date)
    ON CONFLICT (user_id) DO UPDATE
    SET current_streak = 1, last_logged_date = NEW.date;
    RETURN NEW;
  END IF;

  -- Apply streak interval checks
  IF NEW.date = prev_last_date THEN
    RETURN NEW; -- Already logged today
  ELSIF NEW.date = prev_last_date + INTERVAL '1 day' THEN
    UPDATE user_profiles
    SET current_streak = current_streak + 1, last_logged_date = NEW.date
    WHERE user_id = NEW.user_id;
  ELSIF NEW.date > prev_last_date + INTERVAL '1 day' THEN
    UPDATE user_profiles
    SET current_streak = 1, last_logged_date = NEW.date
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind Trigger to food_logs Table
CREATE OR REPLACE TRIGGER tr_food_logs_insert_streak
AFTER INSERT ON food_logs
FOR EACH ROW
EXECUTE FUNCTION update_user_streak_on_insert();
