# Vercel Database Setup Guide

## Overview

This project uses **two separate Supabase databases**:

- **Development (Replit/Local)**: Frequently reset for rapid iteration
- **Staging (Vercel)**: Persistent database for testing with stable data

## Vercel Database Details

- **Project ID**: `uuzoeoukixvunbnkrowi`
- **URL**: `https://uuzoeoukixvunbnkrowi.supabase.co`
- **Dashboard**: https://supabase.com/dashboard/project/uuzoeoukixvunbnkrowi

## Environment Terminology Clarification

**Important**: In Vercel, "Production" environment refers to your main deployment branch, not a traditional production environment. This is where your stable code runs for testing and sharing with others. It's different from:

- **Development**: Your local/Replit setup with frequent resets
- **Staging**: Vercel deployment with persistent database
- **Production**: Future real production environment (when you have paying users)

## Setup Steps

### 1. ✅ Create Database Schema (COMPLETED)

Run the SQL migration in your Vercel Supabase:

1. Go to: https://supabase.com/dashboard/project/uuzoeoukixvunbnkrowi/editor
2. Copy contents from: `migrations/vercel_initial_setup.sql`
3. Paste and run in SQL Editor

### 2. Set Vercel Environment Variables

Go to: https://vercel.com/gram12321/winemaker04/settings/environment-variables

Add these variables:

```
VITE_SUPABASE_URL = https://uuzoeoukixvunbnkrowi.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1em9lb3VraXh2dW5ibmtyb3dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNzUzNzYsImV4cCI6MjA3NTk1MTM3Nn0.vFRxQFei_G5QdKqjT1u0ECIcQwi8aSF7M5pbsOjlcnk
VITE_ENVIRONMENT = staging
```

**Important**: Set these for **Production** environment (this is Vercel's main deployment branch, not traditional "production")

### 3. Redeploy Vercel

After setting environment variables:
- Vercel will auto-redeploy, OR
- Go to latest deployment → click "Redeploy"

## Local Development Setup

Your `.env.local` file should have your **dev database** credentials:

```env
VITE_SUPABASE_URL=your-dev-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-dev-anon-key
VITE_ENVIRONMENT=development
```

## How It Works

### Development (Replit/Local)
- Uses `.env.local` → Dev database
- Reset frequently with Admin Dashboard
- Fast iteration on schema changes

### Staging (Vercel)
- Uses Vercel environment variables → Staging database
- Persistent data for testing
- Stable environment for test users

### Database Operations

**Admin Dashboard** will show which environment you're in:
- 🔧 **Development**: Full admin access, reset anytime
- 🧪 **Staging (Vercel)**: Same features, but data persists

## Troubleshooting

### Issue: Vercel still uses old database
- Check environment variables are set correctly
- Redeploy the application
- Clear browser cache

### Issue: Tables not created
- Check SQL Editor for errors
- Ensure UUID extension is enabled
- Run migration script again

### Issue: Can't connect to database
- Verify anon key is correct
- Check project URL matches
- Ensure project is not paused (free tier)

## Maintenance

### Syncing Schema Changes
When you change the schema in dev:

1. Export new schema from dev database
2. Create migration file
3. Apply to Vercel database
4. Test on Vercel deployment

### Backup Vercel Database
Recommended before major changes:

1. Go to: https://supabase.com/dashboard/project/uuzoeoukixvunbnkrowi/database/backups
2. Click "Create backup"
3. Download for safekeeping

