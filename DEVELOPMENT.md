# CipherDuel — Development & Deployment Guide

This document covers everything from setting up your local development environment
to deploying a production build on Render (backend) and Vercel (frontend).
This is the private, detailed technical guide. The README covers the quick public steps.

---

## Table of Contents

1. [Local Development Setup](#1-local-development-setup)
2. [Running Both Services Concurrently](#2-running-both-services-concurrently)
3. [Testing the Backend](#3-testing-the-backend)
4. [Testing the Frontend](#4-testing-the-frontend)
5. [Environment Variable Management](#5-environment-variable-management)
6. [Deploying the Backend to Render](#6-deploying-the-backend-to-render)
7. [Deploying the Frontend to Vercel](#7-deploying-the-frontend-to-vercel)
8. [Updating a Deployment After Code Changes](#8-updating-a-deployment-after-code-changes)
9. [Monitoring and Logs](#9-monitoring-and-logs)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Local Development Setup

### System Requirements

- macOS, Linux, or Windows (WSL2 recommended on Windows)
- Python 3.11 or later
- Node.js 18 or later
- Git

### Step 1.1 — Clone the repo

```bash
git clone https://github.com/vehutech/ecc-elgamal.git
cd ecc-elgamal
```

### Step 1.2 — Backend setup

```bash
cd backend

# Create a virtual environment (keep project dependencies isolated)
python -m venv venv

# Activate it
source venv/bin/activate          # macOS / Linux
# venv\Scripts\activate.bat       # Windows CMD
# venv\Scripts\Activate.ps1       # Windows PowerShell

# Confirm Python version
python --version
# Should show: Python 3.11.x

# Install all Python dependencies
pip install -r requirements.txt

# Verify installation
python -c "from cryptography.hazmat.primitives.asymmetric.ec import SECP256R1; print('ECC OK')"
python -c "from Crypto.Util.number import getPrime; print('ElGamal OK')"
```

### Step 1.3 — Frontend setup

```bash
cd ../frontend

# Install Node dependencies
npm install

# Copy the environment variable template
cp .env.local.example .env.local

# Verify .env.local contains:
# NEXT_PUBLIC_API_URL=http://localhost:8000
cat .env.local
```

---

## 2. Running Both Services Concurrently

You need two terminal windows (or tabs) open simultaneously.

### Terminal 1 — Backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000 --log-level info
```

Expected output:
```
INFO:     Started server process [XXXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

The `--reload` flag watches for file changes and restarts automatically.

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

Expected output:
```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Environments: .env.local
  Ready in 2.1s
```

### Verify everything works

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs
- ReDoc docs: http://localhost:8000/redoc

Test the API directly from your terminal:
```bash
# Health check
curl http://localhost:8000/health

# ECC key generation
curl -X POST http://localhost:8000/ecc/keygen \
  -H "Content-Type: application/json" \
  -d '{}'

# ElGamal key generation
curl -X POST http://localhost:8000/elgamal/keygen \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 3. Testing the Backend

### Manual API testing with curl

#### Full ECC encrypt/decrypt flow

```bash
# 1. Generate keys
KEYS=$(curl -s -X POST http://localhost:8000/ecc/keygen -H "Content-Type: application/json" -d '{}')
echo $KEYS | python3 -m json.tool

# 2. Extract public key (requires jq — install with: brew install jq)
PUB=$(echo $KEYS | jq -r '.public_key_pem')
PRIV=$(echo $KEYS | jq -r '.private_key_pem')

# 3. Encrypt
CIPHER=$(curl -s -X POST http://localhost:8000/ecc/encrypt \
  -H "Content-Type: application/json" \
  -d "{\"plaintext\": \"Hello CipherDuel\", \"public_key_pem\": \"$PUB\"}")
echo $CIPHER | python3 -m json.tool

# 4. Decrypt
curl -s -X POST http://localhost:8000/ecc/decrypt \
  -H "Content-Type: application/json" \
  -d "{
    \"ciphertext\": $(echo $CIPHER | jq '.ciphertext'),
    \"nonce\": $(echo $CIPHER | jq '.nonce'),
    \"ephemeral_public_key\": $(echo $CIPHER | jq '.ephemeral_public_key'),
    \"private_key_pem\": \"$PRIV\"
  }" | python3 -m json.tool
```

#### Transmission simulation

```bash
curl -X POST http://localhost:8000/transmit \
  -H "Content-Type: application/json" \
  -d '{"message": "Secure data transmission test", "algorithm": "ecc"}' \
  | python3 -m json.tool
```

#### Benchmark (small, fast test)

```bash
curl -X POST http://localhost:8000/benchmark \
  -H "Content-Type: application/json" \
  -d '{"payload_size_bytes": 1024, "iterations": 10}' \
  | python3 -m json.tool
```

### Running pytest (unit tests)

If you write pytest tests, run them with:

```bash
cd backend
source venv/bin/activate
pip install pytest
pytest tests/ -v
```

A basic test file to verify correctness:

```bash
mkdir -p tests
cat > tests/test_roundtrip.py << 'EOF'
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ecc_module import generate_keypair as ecc_keygen, encrypt as ecc_enc, decrypt as ecc_dec
from elgamal_module import generate_keypair as elg_keygen, encrypt as elg_enc, decrypt as elg_dec

def test_ecc_roundtrip():
    kp = ecc_keygen()
    msg = b"CipherDuel ECC test message"
    ct = ecc_enc(msg, kp["public_key_pem"])
    recovered = ecc_dec(ct["ciphertext"], ct["nonce"], ct["ephemeral_public_key"], kp["private_key_pem"])
    assert recovered == msg

def test_elgamal_roundtrip():
    kp = elg_keygen()
    msg = b"CipherDuel ElGamal test message"
    ct = elg_enc(msg, kp["public_key"])
    recovered = elg_dec(ct, kp["private_key"])
    assert recovered == msg
EOF

pytest tests/ -v
```

---

## 4. Testing the Frontend

### Type checking

```bash
cd frontend
npm run type-check
```

### Linting

```bash
npm run lint
```

### Production build test (catch Next.js build errors before deploying)

```bash
npm run build
npm run start
# Visit http://localhost:3000 to verify the production build
```

---

## 5. Environment Variable Management

### Development

`frontend/.env.local` — never commit this file (it's in .gitignore)

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Production (set in Vercel dashboard)

```
NEXT_PUBLIC_API_URL=https://ecc-elgamal-api.onrender.com
```

### Backend (no secrets needed)

The backend has no secret environment variables. Render automatically provides `$PORT`.
If you add secrets in future (e.g., a database URL), add them in the Render dashboard
under Settings → Variables, never in code.

---

## 6. Deploying the Backend to Render

### Step 6.1 — Create a Render account

1. Go to https://onrender.com
2. Sign up with your GitHub account

### Step 6.2 — Create a new project

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Authorise Render to access your GitHub account
4. Select `vehutech/ecc-elgamal`

### Step 6.3 — Configure the service

1. Render will detect the repository. Click **Add Service** → **GitHub Repo**
2. In the service settings, set the **Root Directory** to `backend`
3. Render will automatically detect the `Procfile` and use:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

### Step 6.4 — Deploy

1. Click **Deploy**
2. Watch the build logs — Render installs from `requirements.txt` automatically
3. Once deployed, click **Settings** → **Networking** → **Generate Domain**
4. Your API will be live at something like: `https://ecc-elgamal-api.onrender.com`

### Step 6.5 — Verify

```bash
curl https://ecc-elgamal-api.onrender.com/health
# Expected: {"status": "ok"}
```

Visit `https://ecc-elgamal-api.onrender.com/docs` for the live Swagger UI.

### Important notes

- Render free tier provides 500 hours/month — sufficient for a project demo
- The service sleeps after inactivity on the free tier. First request after sleep
  takes ~5–10 seconds (cold start). This is normal.
- If you hit the free tier limit, upgrade to the Hobby plan ($5/month)

---

## 7. Deploying the Frontend to Vercel

### Step 7.1 — Create a Vercel account

1. Go to https://vercel.com
2. Sign up with your GitHub account

### Step 7.2 — Import the project

1. Click **Add New** → **Project**
2. Select `vehutech/ecc-elgamal` from your GitHub repositories
3. Vercel will prompt you to configure the project

### Step 7.3 — Configure

In the project configuration screen:
- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: Click **Edit** → type `frontend`
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

### Step 7.4 — Set environment variables

Under **Environment Variables**, add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://ecc-elgamal-api.onrender.com` |

### Step 7.5 — Deploy

1. Click **Deploy**
2. Vercel builds and deploys — typically takes 60–90 seconds
3. You'll get a live URL: `https://ecc-elgamal.vercel.app`
   (or a generated subdomain — you can set a custom domain in Settings)

### Step 7.6 — Verify

1. Visit https://ecc-elgamal.vercel.app
2. Click **Key Generation** → **Generate Key Pair** — if keys appear, the backend connection works
3. Test the Transmission and Benchmark tabs

---

## 8. Updating a Deployment After Code Changes

Both Render and Vercel are connected to your GitHub repo and redeploy automatically
on every push to the `main` branch.

### Workflow

```bash
# Make your changes locally
# Test locally (both services running)

# Stage and commit
git add .
git commit -m "feat: describe your change"

# Push to main
git push origin main
```

After the push:
- **Render** detects the push, rebuilds the backend, and redeploys (≈60–120 seconds)
- **Vercel** detects the push, rebuilds the frontend, and redeploys (≈60–90 seconds)

You can monitor both deployments in their respective dashboards in real time.

### Deploying only the backend

Render and Vercel redeploy on any push. To avoid unnecessary frontend rebuilds
while working only on the backend, you can use Vercel's ignored build step:

In Vercel → Settings → Git → Ignored Build Step, enter:
```
git diff HEAD^ HEAD --quiet -- frontend/
```
This tells Vercel to skip rebuilding if no frontend files changed.

---

## 9. Monitoring and Logs

### Render (backend)

1. Open your Render project
2. Click the service → **Logs** tab
3. Live logs stream in real time
4. To see request logs, look for lines like:
   ```
   INFO: 123.45.67.89:0 - "POST /benchmark HTTP/1.1" 200 OK
   ```

### Vercel (frontend)

1. Open your Vercel project dashboard
2. Click **Functions** to see serverless function logs
3. Click **Deployments** to see build history and status

### Checking API health programmatically

```bash
# From your terminal, check if the production API is up
curl -s https://ecc-elgamal-api.onrender.com/health | python3 -m json.tool
```

---

## 10. Troubleshooting

### Backend won't start locally

**Symptom:** `ModuleNotFoundError: No module named 'cryptography'`  
**Fix:** Your virtual environment is not activated.
```bash
source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

**Symptom:** `Address already in use`  
**Fix:** Port 8000 is taken. Either kill the process or use a different port:
```bash
lsof -ti:8000 | xargs kill -9   # macOS/Linux — kill whatever is on port 8000
uvicorn main:app --reload --port 8001
# Then update .env.local: NEXT_PUBLIC_API_URL=http://localhost:8001
```

### Frontend can't connect to backend

**Symptom:** API calls fail, network error in browser console  
**Check 1:** Is the backend running? Visit http://localhost:8000/health in your browser  
**Check 2:** Is `NEXT_PUBLIC_API_URL` set correctly in `frontend/.env.local`?  
**Check 3:** After changing `.env.local`, restart `npm run dev`

### Render deployment fails

**Symptom:** Build fails in Render logs  
**Common cause:** Missing package in `requirements.txt` or Python version mismatch  
**Fix:** Check the Render build logs for the exact error line, fix it locally, push again

**Symptom:** App crashes after deployment (Render shows "Crashed")  
**Fix:** Check Render logs. Most common cause is a missing `$PORT` binding —
ensure `Procfile` uses `--port $PORT` not `--port 8000`

### Vercel deployment fails

**Symptom:** Build error in Vercel  
**Fix 1:** Run `npm run build` locally first — if it fails locally, fix it before pushing  
**Fix 2:** Ensure the Root Directory is set to `frontend` in Vercel project settings  
**Fix 3:** Ensure `NEXT_PUBLIC_API_URL` is set in Vercel environment variables

### Benchmark endpoint times out

**Symptom:** Benchmark requests fail after 30 seconds  
**Cause:** Render's free tier has a 30-second request timeout  
**Fix:** Reduce `iterations` to 20–30 in the benchmark panel to keep requests fast  
For larger benchmarks, upgrade to Render Hobby plan (no timeout limit)

### Cold start delay

**Symptom:** First API request after inactivity takes 5–15 seconds  
**Cause:** Render free tier sleeps inactive services  
**This is normal** — subsequent requests are fast. If you need zero cold start,
upgrade to Render Hobby plan which keeps the service always-on.

---

*For questions or issues, open a GitHub issue at https://github.com/vehutech/ecc-elgamal/issues*