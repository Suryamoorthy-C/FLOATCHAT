# AGROCHAT plan

## Product
A focused farmer chat assistant. The first release answers crop questions in plain language and lets the user review recent questions.

## Architecture
Next.js App Router → Route Handler → server-side AI/provider adapter → Supabase Postgres. Vercel hosts the app. Keep provider keys on the server.

## Data
- `conversations`: `id`, `user_id`, `title`, `created_at`
- `messages`: `id`, `conversation_id`, `role`, `content`, `created_at`
- Optional `profiles`: `id`, `preferred_language`, `created_at`

## API
- `POST /api/chat`: validate question, call provider, return answer and request id.
- `GET /api/conversations`: list the signed-in user’s recent conversations.
- `POST /api/conversations`: create a conversation.

## UI
Single responsive page: brand/header, welcome prompt examples, message list, composer, send state, retry state, and recent conversations.

## Priorities
1. Working chat golden path.
2. Clear agriculture-focused answer format.
3. Loading/error handling.
4. Save and reload recent chat.
5. Mobile layout.
6. Basic login.
7. Language selector.
8. Analytics.

Hard cut after T+180: keep 1–5; cut 6–8 if needed.
