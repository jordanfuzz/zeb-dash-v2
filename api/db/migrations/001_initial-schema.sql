-- Initial schema for Zeb Dash V2
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users (auto-created on ingest)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Repositories (owner/repo, auto-created on ingest)
CREATE TABLE repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  remote_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner, name)
);

-- Branches (per-repository, auto-created on ingest)
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES repositories(id) NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(repository_id, name)
);

-- Conversations (Claude Code session transcripts)
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  branch_id UUID REFERENCES branches(id) NOT NULL,
  git_commit TEXT,
  claude_model TEXT,
  claude_version TEXT,
  transcript TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Documents (plans, markdown files, etc.)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  branch_id UUID REFERENCES branches(id) NOT NULL,
  conversation_id UUID REFERENCES conversations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);