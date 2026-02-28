# 🌍 Smart Trip Planner

A production-ready full-stack travel application with real-time route planning, hotel search, ride booking, tourist ticketing, live safety tracking, and user authentication — powered by **Google Maps Platform APIs**.

## 🗂️ Project Structure

```
try/
├── backend/          # Node.js + Express REST API (port 5000)
└── frontend/         # Next.js 14 App (port 3000)
```

## 🚀 Quick Start

### 1. Set Up Environment Variables

**Backend** — copy and fill in your values:
```bash
cp backend/.env.example backend/.env
```

**Frontend** — copy and fill in your values:
```bash
cp frontend/.env.local.example frontend/.env.local
```

### 2. Install & Run Backend
```bash
cd backend
npm install
npm run dev
```
Server starts on **http://localhost:5000**

### 3. Install & Run Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
App opens on **http://localhost:3000**

---

## 🔑 Required API Keys

| Key | Where to Get | Required For |
|-----|-------------|-------------|
| `GOOGLE_MAPS_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/) | Maps, Directions, Places, Geocoding, Air Quality |
| `MONGODB_URI` | [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier) | Database |
| `JWT_SECRET` | Any random string (e.g. `openssl rand -hex 32`) | Auth tokens |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google Cloud → OAuth 2.0 | Google Login |

### Google Cloud Console Setup
1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable these APIs:
   - Maps JavaScript API
   - Directions API
   - Places API (New)
   - Geocoding API
   - Air Quality API
3. Create an API Key → restrict to your domain in production
4. For Google OAuth: Credentials → OAuth 2.0 → set callback URL to `http://localhost:5000/api/auth/google/callback`

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗺️ **Route Planner** | Multi-mode routes (driving/transit/walking/cycling), real-time AQI, fuel cost |
| 🏨 **Hotel Search** | Google Places real hotel data with ratings, prices, and filters |
| 🚗 **Driver Ride** | Real distance-based fare calculation, booking confirmation with driver details |
| 🔑 **Vehicle Rental** | Fleet of 2-wheelers and 4-wheelers with hourly/daily pricing |
| 🎟️ **Tourist Tickets** | Attraction search, queue estimates, time slot booking |
| 🛡️ **Safety Tracker** | Live GPS tracking, SOS alerts to emergency contacts |
| 🔐 **Auth System** | Email/password + Google OAuth, JWT sessions, trip history |

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), CSS Modules, Google Maps JS API
- **Backend**: Node.js, Express, MongoDB (Mongoose), Passport.js
- **Auth**: JWT + Google OAuth 2.0
- **APIs**: Google Maps Directions, Places (New), Geocoding, Air Quality
