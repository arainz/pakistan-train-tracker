# Deployment Scripts

Complete automation for deploying Pakistan Train Tracker to Google Cloud Run, Oracle Cloud, and Koyeb.

## Quick Start

```bash
# 1. First time setup
./setup-deployment.sh

# 2. Deploy to all platforms
./deploy-all.sh --all

# 3. Check health
./check-health.sh full
```

## Scripts Overview

### 🚀 `deploy-all.sh` - Master Deployment

Deploy to all three platforms with one command.

```bash
./deploy-all.sh --all              # Deploy to all platforms
./deploy-all.sh --gcp              # Google Cloud only
./deploy-all.sh --oracle           # Oracle Cloud only
./deploy-all.sh --koyeb            # Koyeb only
./deploy-all.sh --gcp --oracle     # Multiple platforms
./deploy-all.sh --help             # Show help
```

**What it does:**
- ✓ Commits code to git
- ✓ Pushes to remote
- ✓ Deploys to selected platforms
- ✓ Shows final URLs
- ✓ Provides next steps

**Time**: ~5-10 minutes for all platforms

---

### ⚙️ `setup-deployment.sh` - Initial Setup

Run this first time to prepare your environment.

```bash
./setup-deployment.sh
```

**What it does:**
- ✓ Checks for required tools (git, node, npm, gcloud, koyeb)
- ✓ Verifies cloud credentials
- ✓ Tests SSH to Oracle instance
- ✓ Creates deployment configuration
- ✓ Shows diagnostic information

**When to run**: First time only, or when adding new platforms

---

### 🌍 `deploy-gcp.sh` - Google Cloud Run

Deploy directly to Google Cloud Run.

```bash
./deploy-gcp.sh your-project-id us-central1
./deploy-gcp.sh                           # Uses defaults from config
```

**What it does:**
- ✓ Enables required GCP APIs
- ✓ Builds Docker image
- ✓ Deploys to Cloud Run
- ✓ Configures auto-scaling
- ✓ Returns service URL

**Time**: ~3-5 minutes

**Cost**: Free tier (2M requests/month) + $0.40 per 1M additional requests

---

### 🏔️ `deploy-oracle.sh` - Oracle Cloud

Deploy to Oracle Cloud compute instance.

```bash
./deploy-oracle.sh ubuntu 138.2.91.18
./deploy-oracle.sh                      # Uses defaults from config
```

**What it does:**
- ✓ Syncs files to instance
- ✓ Installs dependencies
- ✓ Manages app with PM2
- ✓ Configures clustering
- ✓ Sets up auto-restart

**Time**: ~2-3 minutes

**Cost**: Free (Always Free tier)

---

### ☁️ `deploy-koyeb.sh` - Koyeb

Deploy to Koyeb serverless platform.

```bash
./deploy-koyeb.sh pakistan-train-tracker github.com/arainz/pakistan-train-tracker
./deploy-koyeb.sh                       # Uses defaults from config
```

**What it does:**
- ✓ Creates or updates Koyeb app
- ✓ Configures auto-scaling
- ✓ Sets environment variables
- ✓ Returns deployment status
- ✓ Shows app URL

**Time**: ~2-3 minutes

**Cost**: Free tier (50GB bandwidth) + $0.01/GB additional

---

### 🏥 `check-health.sh` - Health Monitoring

Monitor health of all deployed instances.

```bash
./check-health.sh full              # Complete check (default)
./check-health.sh health            # Health endpoints only
./check-health.sh live              # Live data check
./check-health.sh info              # Detailed information
./check-health.sh help              # Show help

# With custom URLs
GCP_URL=https://new-url ./check-health.sh full
```

**Features:**
- ✓ Health endpoint check
- ✓ Live data verification
- ✓ Response time monitoring
- ✓ Colorized output
- ✓ Summary report

---

## Configuration

### Environment Variables

Set these to customize deployments:

```bash
# Google Cloud
export GCP_PROJECT_ID="your-project"
export GCP_REGION="us-central1"

# Oracle Cloud
export ORACLE_IP="138.2.91.18"
export ORACLE_USER="ubuntu"

# Koyeb
export KOYEB_APP="pakistan-train-tracker"
export KOYEB_REPO="github.com/arainz/pakistan-train-tracker"

# URLs for health checks
export GCP_URL="https://your-gcp-url.run.app"
export ORACLE_URL="http://138.2.91.18:3000"
export KOYEB_URL="https://your-koyeb-url.koyeb.app"
```

### Configuration File

After running `setup-deployment.sh`, a `.deploy-config` file is created:

```bash
# .deploy-config
GCP_PROJECT_ID=your-project
ORACLE_IP=138.2.91.18
ORACLE_USER=ubuntu
KOYEB_APP=pakistan-train-tracker
KOYEB_REPO=github.com/arainz/pakistan-train-tracker
```

---

## Common Workflows

### Initial Deployment (First Time)

```bash
# 1. Setup environment
./setup-deployment.sh

# 2. Deploy to all platforms
./deploy-all.sh --all

# 3. Monitor deployment
./check-health.sh full

# 4. Update config.js with URLs
# Edit public/config.js
```

### Regular Updates

```bash
# 1. Make changes and commit
git add .
git commit -m "Update features"

# 2. Deploy updated code
./deploy-all.sh --all

# 3. Verify deployment
./check-health.sh full
```

### Deploy to Single Platform

```bash
# Deploy only to GCP
./deploy-all.sh --gcp

# Or use specific script
./deploy-gcp.sh your-project-id

# Verify
./check-health.sh health
```

### Emergency Restart

```bash
# Restart specific service
ssh ubuntu@138.2.91.18 'pm2 restart train-tracker'     # Oracle

# Redeploy to Koyeb
koyeb app redeploy pakistan-train-tracker

# Redeploy to GCP
gcloud run deploy pakistan-train-tracker --source .
```

### Monitor Logs

```bash
# Google Cloud
gcloud run services logs read pakistan-train-tracker --limit 50

# Oracle Cloud
ssh ubuntu@138.2.91.18 'pm2 logs train-tracker'

# Koyeb
koyeb app logs pakistan-train-tracker

# Real-time check
./check-health.sh live
```

---

## Troubleshooting

### "Command not found" errors

```bash
# Make sure scripts are executable
chmod +x *.sh

# Or run with bash
bash deploy-all.sh --all
```

### SSH connection to Oracle fails

```bash
# Verify SSH key
ls ~/.ssh/

# Test connection directly
ssh -v ubuntu@138.2.91.18 echo OK

# Check security rules in Oracle dashboard
```

### GCP deployment fails

```bash
# Verify authentication
gcloud auth list

# Check project
gcloud config get-value project

# Enable required APIs
gcloud services enable run.googleapis.com

# Re-login if needed
gcloud auth login
```

### Koyeb connection issues

```bash
# Check authentication
koyeb whoami

# Re-login if needed
koyeb auth login

# Check app status
koyeb app get pakistan-train-tracker
```

### Services not responding after deployment

```bash
# Run full health check
./check-health.sh full

# Check logs
./check-health.sh info

# For Oracle, verify PM2
ssh ubuntu@138.2.91.18 'pm2 list'
```

---

## Advanced Usage

### Deploy with Custom Environment

```bash
# Set custom URLs before deploying
export GCP_PROJECT_ID="my-project"
export ORACLE_IP="192.168.1.100"
./deploy-all.sh --all
```

### Schedule Regular Deployments

```bash
# Add to crontab for daily deployment
0 2 * * * cd /path/to/Rail && ./deploy-all.sh --all >> /tmp/deploy.log 2>&1
```

### Monitor Multiple Instances

```bash
# Create monitoring script
while true; do
  ./check-health.sh health
  sleep 300  # Check every 5 minutes
done
```

### Backup Before Deployment

```bash
# Create git tag
git tag deployment-$(date +%Y%m%d)
git push origin deployment-$(date +%Y%m%d)

# Then deploy
./deploy-all.sh --all
```

---

## Performance Tips

1. **Cold Starts**: GCP and Koyeb have cold starts. First request after idle (~15 min) takes 2-3 seconds
2. **Connection Pooling**: Uses PM2 clustering on Oracle for better performance
3. **Caching**: Static assets cached in browser
4. **Regional Selection**: All servers optimized for Asian traffic
5. **Health Checks**: Run regularly to detect issues early

---

## Security Notes

- ✓ All scripts verify authentication before running
- ✓ SSH keys used for Oracle (no passwords)
- ✓ Environment variables used for secrets
- ✓ Git commits signed (optional)
- ✓ Production deployments use NODE_ENV=production

**Never commit**:
- `.env` files with secrets
- SSH private keys
- API credentials
- Database passwords

---

## Support

### Documentation
- [Complete Deployment Guide](../DEPLOYMENT_GUIDE.md)
- [Quick Start](../DEPLOYMENT_QUICK_START.md)
- [Summary](../DEPLOYMENT_SUMMARY.md)

### External Resources
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)
- [Oracle Cloud Documentation](https://docs.oracle.com/en-us/iaas/Content/home.htm)
- [Koyeb Docs](https://www.koyeb.com/docs)
- [PM2 Documentation](https://pm2.keymetrics.io/)

### Troubleshooting
- Check logs: `./check-health.sh info`
- Test connectivity: `./check-health.sh health`
- Review guides above for common issues

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Nov 8, 2025 | Initial release |

---

## License

Same as parent project (ISC)

---

**Last Updated**: November 8, 2025
**Maintained By**: Deployment Team
**Status**: Production Ready

