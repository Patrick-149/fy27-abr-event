# Render Cron Job Setup Instructions

## Files Created

1. **scripts/keep-alive.js** - Script that pings your app's health endpoint
2. **render.yaml** - Render configuration file for cron jobs

## Setup Steps

### Option 1: Using render.yaml (Recommended)

1. **Commit and push the new files:**
   ```bash
   git add scripts/keep-alive.js render.yaml
   git commit -m "Add Render cron job for keep-alive"
   git push
   ```

2. **In Render Dashboard:**
   - Go to your Render dashboard
   - Navigate to your service
   - Click on "Cron Jobs" in the left sidebar
   - Click "Add Cron Job"
   - Render will automatically detect the `render.yaml` file
   - Configure the environment variable `APP_URL` to your app's URL (e.g., `https://fy27-abr-event.onrender.com`)

### Option 2: Manual Setup in Render Dashboard

1. **Go to Render Dashboard**
   - Navigate to your service
   - Click on "Cron Jobs" in the left sidebar
   - Click "Add Cron Job"

2. **Configure the Cron Job:**
   - **Name:** `keep-alive`
   - **Schedule:** `*/10 * * * *` (every 10 minutes)
   - **Command:** `node scripts/keep-alive.js`
   - **Environment Variables:**
     - Key: `APP_URL`
     - Value: Your app's URL (e.g., `https://fy27-abr-event.onrender.com`)

3. **Click "Create Cron Job"**

## Verification

After setup, you can verify the cron job is working by:
1. Going to the "Cron Jobs" section in Render
2. Clicking on the "keep-alive" cron job
3. Checking the "Logs" tab to see the ping results

## Schedule Options

The current schedule is `*/10 * * * *` which means:
- Runs every 10 minutes
- Format: `*/10 * * * *` = every 10 minutes of every hour

You can adjust the schedule:
- `*/5 * * * *` - Every 5 minutes (more frequent)
- `*/15 * * * *` - Every 15 minutes (less frequent)
- `0 * * * *` - Every hour
- `0 */6 * * *` - Every 6 hours

## Notes

- The script pings the `/api/health` endpoint which already exists in your app
- The cron job will run on Render's infrastructure, not on your app
- This is more reliable than external services like UptimeRobot
- Free tier includes cron jobs
- The script will log success/failure messages to Render's cron job logs
