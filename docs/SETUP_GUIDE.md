# Amrut Drishti — Local Supabase Setup & Developer Guide

## Prerequisites
- Node.js 18+ & npm
- Free Supabase Account ([https://supabase.com](https://supabase.com))
- Supabase CLI (optional for local migration testing)

---

## 1. Supabase Project Setup
1. Log in to [https://supabase.com/dashboard](https://supabase.com/dashboard) and click **New Project**.
2. Set Project Name to `Amrut Drishti-Pilot`, assign a secure database password, and select region `South Asia (Mumbai) - ap-south-1`.
3. Under **Project Settings -> API**:
   - Copy **Project URL** -> paste as `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`.
   - Copy **anon / public** key -> paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
   - Copy **service_role** key -> paste as `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (*Server-side only! Never expose to client*).

---

## 2. Environment Variables (.env.local)
Create a `.env.local` file in `D:\Projects\Amrut Drishti` copying from `.env.example`:

```env
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

---

## 3. Database Migration Execution
In the Supabase Dashboard, navigate to **SQL Editor**:
1. Open [`supabase/migrations/20261010000000_init_schema.sql`](file:///D:/Projects/Amrut Drishti/supabase/migrations/20261010000000_init_schema.sql).
2. Paste and run the DDL script to create `postgis` extensions, administrative unit tables, derived indicators, proposals, notification logs, and RLS policies.

---

## 4. Local Verification & Running
```bash
# Start development server
npm run dev

# Run production build check
npm run build
```
