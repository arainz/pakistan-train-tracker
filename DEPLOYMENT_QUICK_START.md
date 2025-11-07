# Quick Start Deployment Guide

Deploy Pakistan Train Tracker to all three cloud platforms in minutes.

## Prerequisites

- Git repository set up with your remote
- All three cloud accounts (Google Cloud, Oracle Cloud, Koyeb)
- Required CLI tools installed

## Step-by-Step Deployment

### 1. Initial Setup (First Time Only)

```bash
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail

# Run setup wizard
./scripts/setup-deployment.sh
```

This will:
- ✓ Check all required tools
- ✓ Verify cloud account credentials
- ✓ Test connections to all servers
- ✓ Create deployment configuration

### 2. Deploy to All Platforms

**Option A: Deploy Everything**
```bash
./scripts/deploy-all.sh --all
```

**Option B: Deploy Selectively**
```bash
./scripts/deploy-all.sh --gcp              # Google Cloud only
./scripts/deploy-all.sh --oracle           # Oracle only
./scripts/deploy-all.sh --koyeb            # Koyeb only
./scripts/deploy-all.sh --gcp --oracle     # Two platforms
```

### 3. Get Your URLs

After deployment completes, you'll see URLs for each platform:

```
Google Cloud: https://pakistan-train-tracker-xxxxxxxxx.us-central1.run.app
Oracle Cloud: http://138.2.91.18:3000
Koyeb: https://confused-eel-pakrail-7ab69761.koyeb.app
```

### 4. Update Configuration

Update `public/config.js` with your URLs:

```javascript
servers: {
    primary: 'https://your-gcp-url.run.app',
    fallback: 'http://138.2.91.18:3000',
    backup: 'https://your-koyeb-url.koyeb.app'
}
```

### 5. Verify Deployment

```bash
# Check health of all servers
./scripts/check-health.sh full

# Check specific endpoint
curl -i https://your-gcp-url.run.app/health
curl -i http://138.2.91.18:3000/health
curl -i https://your-koyeb-url.koyeb.app/health
```

---

## Deployment Details by Platform

### Google Cloud Run

**Auto-scaling**: Yes
**Cost**: Free tier (2M requests/month) + pay per request
**Startup**: ~2-3 minutes
**Uptime**: 99.95% SLA

```bash
# Deploy only to GCP
./scripts/deploy-gcp.sh your-project-id us-central1

# View logs
gcloud run services logs read pakistan-train-tracker --limit 50

# View metrics
gcloud run services describe pakistan-train-tracker
```

### Oracle Cloud (Always Free)

**Type**: Compute instance (ARM)
**Cost**: Free (Always Free tier)
**Memory**: 6GB RAM included
**Uptime**: Manual (PM2 process manager)

```bash
# Deploy only to Oracle
./scripts/deploy-oracle.sh ubuntu 138.2.91.18

# SSH to instance
ssh ubuntu@138.2.91.18

# View logs on instance
pm2 logs train-tracker

# Restart if needed
pm2 restart train-tracker
```

### Koyeb

**Auto-scaling**: Yes
**Cost**: Free tier + pay per request
**Startup**: ~1-2 minutes
**Uptime**: 99.9% SLA

```bash
# Deploy only to Koyeb
./scripts/deploy-koyeb.sh pakistan-train-tracker github.com/arainz/pakistan-train-tracker

# View logs
koyeb app logs pakistan-train-tracker

# Redeploy if needed
koyeb app redeploy pakistan-train-tracker
```

---

## Monitoring & Maintenance

### Real-time Monitoring

```bash
# Full health check (all servers)
./scripts/check-health.sh full

# Health endpoints only
./scripts/check-health.sh health

# Live data check
./scripts/check-health.sh live

# Detailed server info
./scripts/check-health.sh info
```

### View Logs

```bash
# Google Cloud Run
gcloud run services logs read pakistan-train-tracker --region us-central1

# Oracle Cloud
ssh ubuntu@138.2.91.18 'pm2 logs train-tracker'

# Koyeb
koyeb app logs pakistan-train-tracker
```

### Restart Services

```bash
# Google Cloud - Auto restart (no action needed)

# Oracle Cloud
ssh ubuntu@138.2.91.18 'pm2 restart train-tracker'

# Koyeb
koyeb app redeploy pakistan-train-tracker
```

---

## Common Tasks

### Update Application Code

```bash
# 1. Push to git
git add .
git commit -m "Update deployment"
git push origin main

# 2. Re-run deployment
./scripts/deploy-all.sh --all
```

### Update Environment Variables

```bash
# Google Cloud
gcloud run deploy pakistan-train-tracker \
  --set-env-vars NODE_ENV=production,PORT=8080,NEW_VAR=value

# Oracle - SSH and edit .env
ssh ubuntu@138.2.91.18 'nano /home/ubuntu/app/.env'
ssh ubuntu@138.2.91.18 'pm2 restart train-tracker'

# Koyeb - Via dashboard or CLI
koyeb app update pakistan-train-tracker --env NEW_VAR=value
```

### Scale Up/Down

```bash
# Google Cloud (auto-scaling configured)
gcloud run services update pakistan-train-tracker \
  --max-instances 20 --min-instances 2

# Oracle - Manual (need to resize instance)
# Contact Oracle support or resize via dashboard

# Koyeb - Via dashboard or CLI
koyeb app update pakistan-train-tracker --instance-type paid
```

---

## Troubleshooting

### Deployment Fails

```bash
# Check if you're logged in to all services
gcloud auth list
koyeb whoami
ssh ubuntu@138.2.91.18 'echo OK'

# Check for uncommitted changes
git status

# Try deploying just one platform
./scripts/deploy-gcp.sh your-project-id
```

### Service Not Responding

```bash
# Check health
curl -v http://your-url/health

# Check logs
# GCP: gcloud run services logs read
# Oracle: ssh and 'pm2 logs'
# Koyeb: koyeb app logs

# For Oracle, check if PM2 is running
ssh ubuntu@138.2.91.18 'pm2 list'
```

### High Latency

```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s your-url/api/live

# Check if it's a cold start (GCP/Koyeb)
# First request after idle time may be slow

# Monitor real-time performance
./scripts/check-health.sh full
```

---

## Environment Setup

### Set Permanent URLs

Add to your shell profile (`~/.zshrc` or `~/.bash_profile`):

```bash
export GCP_URL="https://your-gcp-url.run.app"
export ORACLE_URL="http://138.2.91.18:3000"
export KOYEB_URL="https://your-koyeb-url.koyeb.app"
```

Then use in scripts:
```bash
./scripts/check-health.sh full
```

### Auto-Deploy on Git Push

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to All Platforms

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy
        env:
          GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
          ORACLE_SSH_KEY: ${{ secrets.ORACLE_SSH_KEY }}
        run: ./scripts/deploy-all.sh --all
```

---

## Performance Tips

1. **Cold Starts**: First request after idle may be slow on GCP/Koyeb
2. **Regional Selection**: Keep servers close to users for better latency
3. **Caching**: Enable browser caching for static assets
4. **Database**: Consider using managed databases for scalability
5. **Monitoring**: Set up alerts for downtime using health check scripts

---

## Support & Resources

- [Google Cloud Run Docs](https://cloud.google.com/run/docs)
- [Oracle Cloud Always Free](https://www.oracle.com/cloud/free/)
- [Koyeb Documentation](https://www.koyeb.com/docs)
- [GitHub Repository](https://github.com/arainz/pakistan-train-tracker)

---

## Cost Breakdown (Monthly Estimate)

| Platform | Free Tier | Beyond Free |
|----------|-----------|------------|
| Google Cloud Run | 2M requests | $0.40/1M requests |
| Oracle Cloud | Always Free (6GB RAM) | $0 (Always Free tier) |
| Koyeb | 50GB bandwidth | $0.01/GB + compute |

**Estimated Monthly Cost**: $0-50 (depending on traffic)

