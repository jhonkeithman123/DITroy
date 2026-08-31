-- ==============================================================================
-- DITroy AI Memory Engine: Supabase Database Schema
-- ==============================================================================
-- Run this script in the Supabase Dashboard -> SQL Editor (or via Supabase CLI).
-- It creates the persistent tables required for DITroy AI's cloud memory store.
-- ==============================================================================

-- 1. Create conversation_messages table
CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create conversation_facts table (automated fact extraction & memory inheritance)
CREATE TABLE IF NOT EXISTS public.conversation_facts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    fact TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_conversation_fact UNIQUE (conversation_id, fact)
);

-- 3. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
    ON public.conversation_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_user_conversation 
    ON public.conversation_messages (user_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_facts_conversation_created 
    ON public.conversation_facts (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_facts_user_conversation 
    ON public.conversation_facts (user_id, conversation_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_facts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Service Role (Full Access for DITroy Backend Server)
CREATE POLICY "Service role full access on messages"
    ON public.conversation_messages
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on facts"
    ON public.conversation_facts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. RLS Policies: Authenticated Users (Access their own messages/facts)
CREATE POLICY "Users can view their own messages"
    ON public.conversation_messages
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own messages"
    ON public.conversation_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own facts"
    ON public.conversation_facts
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own facts"
    ON public.conversation_facts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
