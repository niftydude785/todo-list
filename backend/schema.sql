-- Run this SQL in your Supabase SQL editor to set up the database schema.
-- Supabase Dashboard > SQL Editor > New Query > paste this > Run

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  verification_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  image_base64 TEXT,
  due_date DATE,
  activity VARCHAR(50) DEFAULT 'travail', -- cuisine | sport | social | etudes | travail | maison
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration depuis une installation existante (à exécuter une seule fois) :
-- ALTER TABLE todos RENAME COLUMN color_status TO activity;
-- UPDATE todos SET activity = 'travail' WHERE activity NOT IN ('cuisine','sport','social','etudes','travail','maison');

CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos(user_id);
CREATE INDEX IF NOT EXISTS todos_created_at_idx ON todos(created_at DESC);
