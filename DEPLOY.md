# Deploy CareerAI to Render (Free Tier)

This guide walks you through deploying both the backend (FastAPI), frontend (React), and PostgreSQL database to Render in about **15 minutes**. Everything fits in Render's free tier.

---

## Architecture on Render

```
┌─────────────────────┐     ┌─────────────────────┐
│  Frontend (Static)  │────►│  Backend (Web)      │
│  React build        │     │  FastAPI + uvicorn  │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │ PostgreSQL          │
                            │ + Persistent Disk   │
                            │   (1GB videos)      │
                            └─────────────────────┘
```

---

## Step 1: Push your code to GitHub

```bash
cd "/Users/ashishbunny/Downloads/Agentic AI/new"
git init
git add .
git commit -m "Initial commit"
git branch -M main

# Create a GitHub repo at https://github.com/new (call it "careerai")
git remote add origin https://github.com/YOUR-USERNAME/careerai.git
git push -u origin main
```

---

## Step 2: Sign up at Render

Go to **https://render.com/** and sign up using your GitHub account (free, no credit card needed for the free tier).

---

## Step 3: Deploy with Blueprint (one-click)

1. From the Render Dashboard, click **"New +"** → **"Blueprint"**
2. Click **"Connect Account"** if needed and authorize Render to read your GitHub repos
3. Pick the **`careerai`** repo
4. Render reads `render.yaml` automatically and shows the services it will create:
   - `careerai-backend` (Web Service, Python)
   - `careerai-frontend` (Static Site)
   - `careerai-db` (PostgreSQL)
5. Click **"Apply"**

Render will start building everything. It takes ~5–10 minutes the first time.

---

## Step 4: Set the secret env vars

After services are created, you need to set 4 secret environment variables that the Blueprint marked as `sync: false`.

### 4a. Backend env vars

Go to **`careerai-backend` → Environment** and click **"Add Environment Variable"** for each:

| Key                | Value                                          |
| ------------------ | ---------------------------------------------- |
| `SMTP_USER`        | `your-email@gmail.com`                         |
| `SMTP_PASSWORD`    | Your Gmail **App Password** (16-char)          |
| `FROM_EMAIL`       | `your-email@gmail.com`                         |
| `CORS_ORIGINS`     | `https://careerai-frontend.onrender.com`       |
| `APP_BASE_URL`     | `https://careerai-frontend.onrender.com`       |
| `OPENAI_API_KEY`   | (optional — for LLM-powered parsing)           |

To get a Gmail App Password:
- Enable 2-Step Verification at https://myaccount.google.com/signinoptions/two-step-verification
- Generate an App Password at https://myaccount.google.com/apppasswords (name it "CareerAI")

### 4b. Frontend env var

Go to **`careerai-frontend` → Environment** and add:

| Key                  | Value                                          |
| -------------------- | ---------------------------------------------- |
| `REACT_APP_API_URL`  | `https://careerai-backend.onrender.com/api/v1` |

### 4c. Save and redeploy

After adding the env vars, click **"Manual Deploy"** → **"Deploy latest commit"** on **both** services.

---

## Step 5: Open the site

Once both services show **"Live"** (green badge):

- **Candidate Portal**: `https://careerai-frontend.onrender.com/portal`
- **Recruiter Login**: `https://careerai-frontend.onrender.com/login`
  - Demo credentials: `admin@demo.example.com` / `admin123`

---

## What's deployed

| Service | What it does | Free tier limit |
| ------- | ------------ | --------------- |
| `careerai-backend` | FastAPI API on uvicorn | Sleeps after 15 min idle (cold-starts in ~30s on first request) |
| `careerai-frontend` | React static site | Always-on, 100 GB bandwidth/mo |
| `careerai-db` | PostgreSQL 16 | 1 GB storage, expires after 90 days unless upgraded |
| Persistent disk | Video pitch storage | 1 GB |

---

## Custom domain (optional)

1. In `careerai-frontend` → **Settings** → **Custom Domains**
2. Add your domain (e.g., `careerai.com`)
3. Add the DNS records Render shows you at your registrar
4. Update the env vars in `careerai-backend`:
   - `CORS_ORIGINS=https://careerai.com`
   - `APP_BASE_URL=https://careerai.com`
5. Redeploy backend

---

## Updating the app

Just push to GitHub:

```bash
git add .
git commit -m "your changes"
git push
```

Render auto-deploys on push.

---

## Troubleshooting

### Backend "Application failed to respond"
- Check **Logs** tab — usually a missing env var or DB connection error
- Make sure `DATABASE_URL` is wired (it should auto-populate from the database)
- The first cold start after sleep takes ~30 seconds

### Frontend blank page
- Check the browser console for `Network Error`
- Verify `REACT_APP_API_URL` matches your backend URL (no trailing slash)
- Verify `CORS_ORIGINS` on backend matches your frontend URL exactly

### Database "free tier expired"
- Render's free PostgreSQL expires after 90 days
- Upgrade to **Starter** ($7/mo) or migrate to a free Supabase/Neon DB

### Videos not playing
- Persistent disk only works on **Starter+** plans for backend (free tier loses files on redeploy)
- Workaround: upload videos to Cloudinary or AWS S3 instead

### Email not sending
- Check `SMTP_USER`, `SMTP_PASSWORD`, `FROM_EMAIL` are all set
- App Password must be exactly 16 chars (with or without spaces — both work)
- Test from Render shell: `python -c "from app.services.email_service import EmailService; EmailService.send('your@email.com', 'test', '<h1>test</h1>')"`

---

## Cost summary

**Total: $0/month** for the free tier setup. If you outgrow it:
- Backend Starter: $7/mo (always-on, no cold starts)
- PostgreSQL Starter: $7/mo (10 GB, never expires)
- Frontend stays free forever

---

## Need help?

The Render docs: https://render.com/docs/deploy-fastapi
