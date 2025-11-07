# Deployment Checklist

Complete preparation checklist before deploying to all three platforms.

## Pre-Deployment (Do Before Running Scripts)

- [ ] **Git Repository**
  - [ ] All changes committed: `git status` shows clean
  - [ ] Remote configured: `git remote -v` shows origin
  - [ ] Latest code pushed: `git log --oneline -5`

- [ ] **Code Quality**
  - [ ] No console.error messages in production code
  - [ ] Environment variables properly configured
  - [ ] API endpoints tested locally: `npm start`
  - [ ] Admin panel accessible: `http://localhost:3000/admin-data-manager.html`

- [ ] **Dependencies**
  - [ ] `package.json` updated with correct versions
  - [ ] `npm ci` works: `npm ci --only=production`
  - [ ] No security vulnerabilities: `npm audit`

- [ ] **Configuration**
  - [ ] `public/config.js` has correct backup URLs
  - [ ] `app.yaml` (GCP) configured correctly
  - [ ] `Dockerfile` includes all necessary files
  - [ ] `.env.example` is updated

- [ ] **Data**
  - [ ] `public/data/trains.json` up to date
  - [ ] `public/data/stations.json` up to date
  - [ ] `public/data/schedules.json` up to date
  - [ ] All data files are valid JSON: `npm run validate-data`

## Cloud Account Setup

- [ ] **Google Cloud**
  - [ ] Account created and verified
  - [ ] Billing enabled
  - [ ] Project created: `gcloud config list`
  - [ ] `gcloud` CLI installed: `gcloud --version`
  - [ ] Authenticated: `gcloud auth list`

- [ ] **Oracle Cloud**
  - [ ] Account created (Always Free tier)
  - [ ] Compute instance created and running
  - [ ] IP address noted: `138.2.91.18`
  - [ ] SSH key configured in `~/.ssh/`
  - [ ] Security rules allow SSH (port 22) and HTTP (port 3000)
  - [ ] Can SSH to instance: `ssh ubuntu@138.2.91.18 echo OK`

- [ ] **Koyeb**
  - [ ] Account created
  - [ ] GitHub account connected (if using GitHub integration)
  - [ ] `koyeb` CLI installed: `koyeb --version`
  - [ ] Authenticated: `koyeb whoami`

## Local Environment

- [ ] **Required Tools**
  - [ ] Node.js 18+: `node --version`
  - [ ] npm 8+: `npm --version`
  - [ ] git: `git --version`
  - [ ] Docker (optional, for testing): `docker --version`
  - [ ] `gcloud` CLI: `gcloud --version`
  - [ ] `koyeb` CLI: `koyeb --version`

- [ ] **SSH Configuration**
  - [ ] SSH key exists: `ls ~/.ssh/id_rsa`
  - [ ] SSH key added to oracle instance
  - [ ] Can connect without password: `ssh ubuntu@138.2.91.18 echo OK`

- [ ] **Terminal Setup**
  - [ ] Working directory correct: `pwd`
  - [ ] Scripts are executable: `ls -l scripts/*.sh`
  - [ ] Make scripts executable if needed: `chmod +x scripts/*.sh`

## Pre-Deployment Testing

- [ ] **Local Testing**
  - [ ] Start server: `npm start`
  - [ ] Health check works: `curl http://localhost:3000/health`
  - [ ] API endpoints work: `curl http://localhost:3000/api/live`
  - [ ] Admin panel loads: Open `http://localhost:3000/admin-data-manager.html`
  - [ ] No errors in browser console
  - [ ] Stop server: `Ctrl+C`

- [ ] **Git Status**
  - [ ] No uncommitted changes: `git status`
  - [ ] Can push changes: `git push origin main`

## Deployment Execution

### Step 1: Setup
- [ ] Run setup script: `./scripts/setup-deployment.sh`
- [ ] Verify all checks pass
- [ ] Review `.deploy-config` file created

### Step 2: Choose Deployment Strategy
- [ ] Deploy to all platforms: `./scripts/deploy-all.sh --all`
  - OR
- [ ] Deploy to specific platforms:
  - [ ] GCP only: `./scripts/deploy-all.sh --gcp`
  - [ ] Oracle only: `./scripts/deploy-all.sh --oracle`
  - [ ] Koyeb only: `./scripts/deploy-all.sh --koyeb`

### Step 3: Monitoring During Deployment
- [ ] Watch for error messages
- [ ] Note returned URLs
  - [ ] GCP URL: `https://pakistan-train-tracker-xxxx.us-central1.run.app`
  - [ ] Oracle URL: `http://138.2.91.18:3000`
  - [ ] Koyeb URL: `https://pakistan-train-tracker-xxxx.koyeb.app`
- [ ] Wait for all deployments to complete (~10 minutes)

## Post-Deployment Verification

- [ ] **Collect URLs**
  - [ ] GCP URL: ___________________________
  - [ ] Oracle URL: ___________________________
  - [ ] Koyeb URL: ___________________________

- [ ] **Health Checks**
  - [ ] GCP: `curl -i https://your-gcp-url/health`
  - [ ] Oracle: `curl -i http://138.2.91.18:3000/health`
  - [ ] Koyeb: `curl -i https://your-koyeb-url/health`
  - [ ] All return 200 OK

- [ ] **Live Data**
  - [ ] GCP: `curl https://your-gcp-url/api/live | jq .count`
  - [ ] Oracle: `curl http://138.2.91.18:3000/api/live | jq .count`
  - [ ] Koyeb: `curl https://your-koyeb-url/api/live | jq .count`
  - [ ] All return train data with count > 0

- [ ] **Automated Check**
  - [ ] Run full health check: `./scripts/check-health.sh full`
  - [ ] All three servers show ✓ OK
  - [ ] All three show live data count

- [ ] **API Endpoints**
  - [ ] Schedule API works: `curl https://your-gcp-url/api/schedule`
  - [ ] Train search works: `curl https://your-gcp-url/api/search?query=1`
  - [ ] All servers have same endpoints

- [ ] **Logs Review**
  - [ ] GCP logs: `gcloud run services logs read pakistan-train-tracker --limit 10`
  - [ ] No ERROR messages
  - [ ] Oracle logs: `ssh ubuntu@138.2.91.18 'pm2 logs --lines 10'`
  - [ ] Koyeb logs: `koyeb app logs pakistan-train-tracker --lines 10`

## Configuration Update

- [ ] **Update public/config.js**
  - [ ] Set GCP URL as primary:
    ```javascript
    primary: 'https://your-gcp-url.run.app'
    ```
  - [ ] Set Oracle URL as fallback:
    ```javascript
    fallback: 'http://138.2.91.18:3000'
    ```
  - [ ] Set Koyeb URL as backup:
    ```javascript
    backup: 'https://your-koyeb-url.koyeb.app'
    ```

- [ ] **Commit Configuration Update**
  - [ ] Git add: `git add public/config.js`
  - [ ] Git commit: `git commit -m "Update production URLs"`
  - [ ] Git push: `git push origin main`

## Mobile App Testing (If Applicable)

- [ ] **Test on iOS** (if you have device)
  - [ ] App loads without errors
  - [ ] Data loads from correct servers
  - [ ] Fallback works if primary down
  - [ ] No console errors in debug console

- [ ] **Test on Android** (if you have device)
  - [ ] App loads without errors
  - [ ] Data loads from correct servers
  - [ ] Fallback works if primary down
  - [ ] No console errors in debug console

## Ongoing Monitoring

- [ ] **Set Up Monitoring**
  - [ ] Bookmark health check: `./scripts/check-health.sh full`
  - [ ] Add to cron job for daily checks
  - [ ] Set up alerts if possible

- [ ] **Document URLs**
  - [ ] Add to team documentation
  - [ ] Share with team members
  - [ ] Update README if needed

- [ ] **First Week Checks**
  - [ ] Day 1: Run full health check
  - [ ] Day 3: Review logs for errors
  - [ ] Day 7: Performance review

## Rollback Plan (If Issues Found)

- [ ] **Immediate Issues**
  - [ ] Revert config.js to previous URL
  - [ ] Commit and push changes
  - [ ] Stop app if necessary

- [ ] **Google Cloud Rollback**
  - [ ] Deploy previous version: `gcloud run deploy ... --source .`
  - [ ] Or revert service entirely

- [ ] **Oracle Rollback**
  - [ ] SSH and restart: `ssh ubuntu@138.2.91.18 'pm2 restart all'`
  - [ ] Or redeploy previous version

- [ ] **Koyeb Rollback**
  - [ ] Redeploy: `koyeb app redeploy pakistan-train-tracker`
  - [ ] Or use previous deployment from dashboard

## Documentation

- [ ] **Update Records**
  - [ ] Document deployment date
  - [ ] Record all three URLs
  - [ ] Note any issues encountered
  - [ ] Update deployment log

- [ ] **Team Communication**
  - [ ] Notify team of deployment
  - [ ] Share new URLs
  - [ ] Provide health check command

- [ ] **Maintenance Tasks**
  - [ ] Schedule next review
  - [ ] Set up monitoring
  - [ ] Plan for updates

---

## Quick Reference

### Files Created/Updated
- [ ] `.deploy-config` - Configuration file
- [ ] `public/config.js` - Server URLs
- [ ] Deployment script logs
- [ ] Git commits with deployment

### Commands to Run
```bash
# Setup
./scripts/setup-deployment.sh

# Deploy
./scripts/deploy-all.sh --all

# Verify
./scripts/check-health.sh full

# View Logs
gcloud run services logs read pakistan-train-tracker --limit 50
ssh ubuntu@138.2.91.18 'pm2 logs train-tracker'
koyeb app logs pakistan-train-tracker
```

### Contact Information
- GCP Support: https://cloud.google.com/support
- Oracle Support: https://www.oracle.com/cloud/support/
- Koyeb Support: https://www.koyeb.com/support

---

## Sign-Off

- [ ] All checks completed
- [ ] Deployment successful
- [ ] All servers responding
- [ ] Configuration updated
- [ ] Team notified

**Deployment Completed By**: _______________
**Date**: _______________
**Time**: _______________
**Notes**: 
```
_________________________________
_________________________________
_________________________________
```

---

**Print this checklist and check off each item as you go!**

