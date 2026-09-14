# GitHub Actions Keep-Alive Setup Instructions

## What Was Created

- `.github/workflows/keep-alive.yml` - GitHub Actions workflow that pings your app every 5 minutes

## Setup Steps

### Step 1: Push the Workflow File

The workflow file has been created. Commit and push it to GitHub:

```bash
git add .github/workflows/keep-alive.yml
git commit -m "Add GitHub Actions keep-alive workflow"
git push
```

### Step 2: Add APP_URL Secret in GitHub

1. Go to your GitHub repository
2. Click on **Settings** tab
3. Click on **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add the following:
   - **Name:** `APP_URL`
   - **Secret:** Your app's URL (e.g., `https://fy27-abr-event.onrender.com`)
6. Click **Add secret**

### Step 3: Verify the Workflow

1. Go to your GitHub repository
2. Click on **Actions** tab
3. You should see the "Keep Alive" workflow
4. Click on it to see the workflow runs
5. The workflow will run automatically every 5 minutes

### Step 4: Manual Test (Optional)

To test the workflow immediately without waiting for the next scheduled run:

1. Go to the **Actions** tab in your GitHub repository
2. Click on the "Keep Alive" workflow
3. Click **Run workflow** button
4. Select the branch (usually `main`)
5. Click **Run workflow**
6. Wait for the workflow to complete
7. Check the logs to see if it successfully pinged your app

## Schedule

The workflow is currently set to run every 5 minutes:
```yaml
schedule:
  - cron: '*/5 * * * *'
```

### To Change the Frequency:

Edit `.github/workflows/keep-alive.yml` and change the cron schedule:

- `*/5 * * * *` - Every 5 minutes (current)
- `*/10 * * * *` - Every 10 minutes
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour
- `0 */6 * * *` - Every 6 hours

After changing, commit and push the changes.

## Verification

### Check Workflow Runs:
1. Go to Actions tab in GitHub
2. Click on "Keep Alive" workflow
3. You should see successful runs with green checkmarks
4. Click on a run to see the logs
5. Look for: `✅ App is alive (HTTP 200)`

### Check App Uptime:
1. Visit your app URL periodically over 15-30 minutes
2. The app should load quickly without cold starts
3. If it stays responsive, the keep-alive is working

## Benefits

- ✅ Free (GitHub Actions is free for public repositories)
- ✅ Reliable (runs on GitHub's infrastructure)
- ✅ Easy to monitor (can see logs in GitHub Actions tab)
- ✅ Manual trigger option (can test anytime)
- ✅ No external dependencies
- ✅ Works with any hosting platform

## Troubleshooting

### Workflow not running:
- Check that the file is in `.github/workflows/` directory
- Verify the file name is `keep-alive.yml`
- Check that the repository is public (GitHub Actions is free for public repos)

### Secret not found error:
- Go to Settings → Secrets and variables → Actions
- Verify `APP_URL` secret exists
- Check that the secret value is correct (your app URL)

### App not responding:
- Check that your app is deployed and running
- Verify the `/api/health` endpoint is accessible
- Check the app logs in your hosting platform
