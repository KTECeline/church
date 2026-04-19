# GSLC Carnival System — Setup Guide

## Step 1: Firebase Setup (free)

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it `gslc-carnival` → Create
3. On the left sidebar, click **Build → Realtime Database**
4. Click **Create Database** → choose **Start in test mode** → Enable
5. Copy your **Database URL** (looks like `https://gslc-carnival-default-rtdb.firebaseio.com`)
6. Go to **Project Settings** (gear icon top left) → scroll down to **Your apps**
7. Click the `</>` (Web) icon → Register app → name it anything
8. Copy the `firebaseConfig` values shown — you'll need all of them

### Firebase Security Rules (set after event)
In Realtime Database → Rules, paste this (for now test mode is fine):
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

---

## Step 2: Deploy to Vercel (free)

### Option A — GitHub (recommended)
1. Push this folder to a GitHub repo
2. Go to https://vercel.com → New Project → Import your repo
3. Add these Environment Variables in Vercel dashboard:

| Variable | Value |
|---|---|
| VITE_FIREBASE_API_KEY | from Firebase config |
| VITE_FIREBASE_AUTH_DOMAIN | from Firebase config |
| VITE_FIREBASE_DATABASE_URL | your Realtime DB URL |
| VITE_FIREBASE_PROJECT_ID | from Firebase config |
| VITE_FIREBASE_STORAGE_BUCKET | from Firebase config |
| VITE_FIREBASE_MESSAGING_SENDER_ID | from Firebase config |
| VITE_FIREBASE_APP_ID | from Firebase config |
| VITE_CASHIER_PIN | your chosen cashier PIN (e.g. 9999) |

4. Click **Deploy** — you'll get a URL like `https://gslc-carnival.vercel.app`

### Option B — Vercel CLI (no GitHub needed)
```bash
npm install -g vercel
cd carnival
vercel
# Follow prompts, add env vars when asked
```

---

## Step 3: Before Event Day

1. **Log in as Cashier** using your cashier PIN
2. Go to **Setup tab** → Add all booths with their names and PINs
3. Share the Vercel URL with all booth teams
4. Each booth opens the URL on their phone, selects their booth, enters their PIN
5. Each booth adds their menu items before the event starts

---

## How it works on event day

```
Customer orders at booth
  → Booth creates order in app → Order number appears
  → Customer goes to cashier with order number
  → Cashier looks up order, collects payment
  → Cashier marks paid
  → Booth sees order turn green (paid)
  → Booth fulfils order, marks done
```

---

## Suggested PINs setup
- Cashier: choose something only you know (e.g. 6789)
- Each booth: give each booth their own 4-digit PIN
- Write PINs on a small piece of paper for each booth person

---

## Questions?
Everything is real-time — if something doesn't update, just refresh the page.
All data lives in Firebase and is not lost if the phone screen turns off.
