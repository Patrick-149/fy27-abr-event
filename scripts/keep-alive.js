#!/usr/bin/env node

/**
 * Keep Alive Script for Render Cron Job
 * This script pings the web app to prevent it from spinning down
 */

const APP_URL = process.env.APP_URL || 'https://your-app-url.onrender.com';
const HEALTH_ENDPOINT = '/api/health';

async function pingApp() {
  try {
    const response = await fetch(`${APP_URL}${HEALTH_ENDPOINT}`);
    const data = await response.json();
    
    if (data.status === 'ok') {
      console.log(`[${new Date().toISOString()}] ✅ App is alive: ${APP_URL}`);
    } else {
      console.log(`[${new Date().toISOString()}] ⚠️ App responded but status is not ok`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Failed to ping app:`, error.message);
    process.exit(1);
  }
}

pingApp();
