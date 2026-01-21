# Supabase Setup Guide for MindfulMe

## Step 1: Create Supabase Project

1. Go to [Supabase](https://supabase.com) and sign up/login
2. Click "New Project" and fill in the details:
   - Name: `mindfulme`
   - Database Password: Generate a strong password
   - Region: Choose closest to your users
3. Wait for the project to be created (2-3 minutes)

## Step 2: Get API Keys

1. Go to Project Settings → API
2. Copy these values:
   - **Project URL** (e.g., `https://xyz123.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
3. Go to Project Settings → Database
4. Copy the **Connection string** (for service role key)

## Step 3: Configure Environment Variables

Create/update `backend/.env`:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# ML Service
ML_SERVICE_URL=http://localhost:8000

# Encryption Keys
JOURNAL_ENCRYPTION_KEY=your-journal-encryption-key
DOCTOR_BRIDGE_KEY=your-doctor-bridge-key

# Server
PORT=3000
CORS_ORIGIN=http://localhost:8081
```

## Step 4: Run Database Migrations

### Option A: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push the schema
supabase db push
```

### Option B: Using SQL Editor

1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `database/schema.sql`
3. Paste and run the SQL

## Step 5: Verify Setup

Run the backend and check the health endpoint:

```bash
cd backend
npm run dev

# In another terminal, test the API
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "mlService": "http://localhost:8000"
  }
}
```

## Step 6: Frontend Configuration

Create `frontend/src/config/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Environment variables for Expo (in app.config.js or .env)
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;
```

Add to `frontend/.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key
```

## Row Level Security (RLS)

The schema includes basic RLS policies. For production, add more restrictive policies:

```sql
-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can only view their own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can only insert their own mood logs"
  ON mood_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- And so on for each table...
```

## Troubleshooting

### Connection Issues
- Verify your IP is allowed in Supabase Network settings
- Check that the connection string is correct
- Ensure the database is not in recovery mode

### Authentication Errors
- Make sure RLS policies are set up correctly
- Check that anon key has proper permissions
- Verify JWT secret matches between frontend and backend

### Migration Failures
- Drop existing tables first: `DROP TABLE IF EXISTS users, mood_logs, ... CASCADE;`
- Run migrations in order
- Check for any conflicting constraints

## Production Deployment

1. **Database**: Supabase handles this automatically
2. **Backend**: Deploy to Vercel or Railway
3. **Environment Variables**: Set all secrets in Vercel dashboard
4. **Domain**: Configure custom domain in Supabase if needed
5. **SSL**: Supabase provides automatic SSL certificates

## Support

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- MindfulMe Issues: GitHub Issues tab
