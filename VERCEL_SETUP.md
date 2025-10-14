# 🚀 Quick Vercel Setup

## Step 1: Run SQL Migration

1. Open: https://supabase.com/dashboard/project/uuzoeoukixvunbnkrowi/editor
2. Copy entire file: `migrations/vercel_initial_setup.sql`
3. Paste in SQL Editor → Click **Run**

## Step 2: Set Vercel Environment Variables

Go to: https://vercel.com/settings/environment-variables

Add these 3 variables:

```
VITE_SUPABASE_URL
https://uuzoeoukixvunbnkrowi.supabase.co

VITE_SUPABASE_ANON_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1em9lb3VraXh2dW5ibmtyb3dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNzUzNzYsImV4cCI6MjA3NTk1MTM3Nn0.vFRxQFei_G5QdKqjT1u0ECIcQwi8aSF7M5pbsOjlcnk

VITE_ENVIRONMENT
staging
```

Set for: **Production** environment (Vercel's main deployment branch - this is where your staging app runs)

## Step 3: Redeploy

Vercel will auto-redeploy after saving environment variables.

## Done! ✅

- **Development**: Keep using your current dev database (reset anytime)
- **Vercel**: Now uses separate staging database (persistent)

Full docs: See `docs/vercel_setup_guide.md`

