-- Run this SQL in your Supabase SQL editor to set up the database schema.
-- Supabase Dashboard > SQL Editor > New Query > paste this > Run

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS magic_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  image_base64 TEXT,
  due_date DATE,
  color_status VARCHAR(50) DEFAULT 'green',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Short-lived session tokens exchanged by the frontend after magic link
CREATE TABLE IF NOT EXISTS session_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Optional: index for faster token lookups
CREATE INDEX IF NOT EXISTS magic_tokens_token_idx ON magic_tokens(token);

-- Optional: index for faster todo queries
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos(user_id);
CREATE INDEX IF NOT EXISTS todos_created_at_idx ON todos(created_at DESC);
