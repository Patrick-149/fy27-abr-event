# FY27 ABR Event Details PWA

A mobile-first, installable React + Vite PWA for the FY27 ABR internal event.

## Features

- Responsive home screen with four large navigation buttons.
- Meeting schedule, registration form, dinner restaurant information, and POC contact.
- Separate admin dashboard to edit agenda, restaurant details, POC contacts, and view registrations.
- JWT-protected admin dashboard.
- PWA support with `vite-plugin-pwa` (manifest, icons, service worker).
- Demo Node/Express API with JSON data storage.
- Render deployment guide for public hosting.

## Project Structure

- `web/` – React + Vite frontend
- `api/` – Node/Express demo API
- `deploy/` – IIS `web.config`
- `scripts/` – Icon generation script

## Quick Start

### 1. Install dependencies

```batch
cd /d "C:\Users\Phuoc_Nguyen\fy27-abr-event"
npm install
```

### 2. Configure environment variables

```batch
copy api\.env.example api\.env
copy web\.env.example web\.env
```

Edit `api\.env` and set a strong `JWT_SECRET` plus the admin credentials.

Edit `web\.env` and set the API URL:

```
VITE_API_BASE_URL=http://localhost:3001
```

### 3. Generate PWA icons

```batch
npm run generate-icons
```

This creates `web/public/icons/icon-192x192.png`, `icon-512x512.png`, and `maskable-icon-512x512.png`.

### 4. Start the API

```batch
npm run dev:api
```

### 5. Start the web app

In a second terminal:

```batch
npm run dev:web
```

Open `http://localhost:5173`.

### 6. Access the app

- Attendee: open `http://localhost:5173` and use the app directly (registration, schedule, restaurant, POC contact).
- Admin: navigate to `http://localhost:5173/admin-login` and use the admin credentials from `api\.env` (default `admin` / `admin123`)

## Building for Production

```batch
npm run build
```

The static site is output to `web/dist/`.

## Deploying to Render

1. Push the repo to GitHub from `cmd`:

```batch
cd /d "C:\Users\Phuoc_Nguyen\fy27-abr-event"
git init
git add .
git commit -m "ready for deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/fy27-abr-event.git
git push -u origin main
```

2. Go to [https://render.com](https://render.com) and create a free account.
3. Create a new **Web Service** and connect your GitHub repo.
4. Use these settings:

| Setting | Value |
|---|---|
| Name | `fy27-abr-event` |
| Branch | `main` |
| Runtime | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm run start` |
| Instance Type | Free |

5. Add these environment variables:

```text
JWT_SECRET=any_long_random_string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
WEB_URL=*
MONGODB_URI=your_mongodb_atlas_connection_string
```

6. Click **Create Web Service**. Render will build and deploy and give you a URL like `https://fy27-abr-event.onrender.com`.
7. Open that URL on Safari. On the free plan it may take ~1 minute to wake up if it has been idle.
8. On iPhone, tap **Share → Add to Home Screen** to install it as a PWA.

**Note:** Render's free tier has an ephemeral filesystem, so uploaded menu files or data changes will reset if the service restarts. For a real event you would need a Render Disk or external storage.

## Notes

- The API uses JSON files for data. For a production deployment, replace these with a database and a real identity provider.
- HTTPS is strongly recommended for PWA installation on iOS and Android.
