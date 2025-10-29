# Server Migration Plan - Google Cloud Trial → Oracle Cloud

## 📅 Timeline

### Phase 1: Google Cloud Run (Days 1-180) - **CURRENT**
- **Status**: ✅ Active
- **Cost**: FREE ($300 credit)
- **URL**: https://pakistan-train-tracker-174840179894.us-central1.run.app
- **Trial Expires**: ~180 days from signup
- **Performance**: Excellent (HTTPS, global CDN, auto-scaling)

### Phase 2: Oracle Cloud (After Day 180) - **FUTURE PRIMARY**
- **Status**: ✅ Ready (already set up!)
- **Cost**: FREE Forever (Always Free Tier)
- **URL**: http://138.2.91.18:3000
- **Performance**: Good (1 GB RAM, can upgrade to 24 GB ARM)

### Phase 3: Koyeb (Always Available) - **SAFETY NET**
- **Status**: ✅ Active
- **Cost**: FREE
- **URL**: https://confused-eel-pakrail-7ab69761.koyeb.app
- **Performance**: Good (512 MB RAM, automatic HTTPS)

---

## 🎯 Current Configuration (Optimal!)

Your app is now configured with **triple redundancy**:

```javascript
servers: {
    primary: 'https://pakistan-train-tracker-174840179894.us-central1.run.app', // Google Cloud Run
    fallback: 'http://138.2.91.18:3000',      // Oracle Cloud
    backup: 'https://confused-eel-pakrail-7ab69761.koyeb.app', // Koyeb
}
```

**Automatic failover**: If Google fails → Oracle → Koyeb

---

## 📋 Migration Checklist (Day 170-180)

### Week Before Trial Expires

#### Day 170: Check Google Cloud Billing

1. **Check trial status**:
   - Go to: https://console.cloud.google.com/billing
   - Look for "Free trial status"
   - Note expiration date

2. **Export current metrics** (optional):
   - Requests/day
   - Peak concurrent users
   - Bandwidth usage
   - Error rate

#### Day 175: Test Oracle Cloud Performance

1. **Update config temporarily** to test Oracle:
   ```javascript
   // Temporarily swap for testing
   primary: 'http://138.2.91.18:3000',  // Test Oracle
   fallback: 'https://pakistan-train-tracker-174840179894.us-central1.run.app',
   ```

2. **Monitor for 24 hours**:
   ```bash
   # Check Oracle server health
   ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 status && free -h && uptime'
   ```

3. **If performance is not sufficient**, consider **upgrading to ARM**:
   ```bash
   cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail
   ./create-arm-instance.sh
   ```

4. **Revert config** back to Google as primary

#### Day 178: Prepare Migration

1. **Ensure Oracle server is updated**:
   ```bash
   # Latest deployment
   cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail
   tar --exclude='node_modules' -czf full-deploy.tar.gz server.js package.json package-lock.json public/
   scp -i ~/.ssh/oracle_vm.key full-deploy.tar.gz ubuntu@138.2.91.18:~/
   
   ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'bash -s' << 'ENDSSH'
   tar -xzf full-deploy.tar.gz
   rm full-deploy.tar.gz
   npm install --production
   pm2 restart pakistan-train-tracker
   pm2 status
   ENDSSH
   ```

2. **Create backup of current config**:
   ```bash
   cp public/config.js public/config.js.backup-google
   ```

#### Day 179: Final Testing

1. **Test all Oracle endpoints**:
   ```bash
   # Web interface
   curl -I http://138.2.91.18:3000/
   
   # API
   curl -s http://138.2.91.18:3000/api/live | head -100
   
   # Mobile
   curl -I http://138.2.91.18:3000/mobile.html
   ```

2. **Verify auto-failover works**:
   - Temporarily stop Oracle server
   - Check app switches to Koyeb
   - Restart Oracle server
   - Check app switches back

---

## 🚀 Migration Day (Day 180)

### Step 1: Update Configuration

Edit `public/config.js`:

```javascript
servers: {
    primary: 'http://138.2.91.18:3000',  // Oracle Cloud (FREE Forever!)
    fallback: 'https://confused-eel-pakrail-7ab69761.koyeb.app',  // Koyeb
    backup: 'https://pakistan-train-tracker-174840179894.us-central1.run.app',  // Google (will stop working soon)
}
```

### Step 2: Deploy Updated Config

```bash
# Build and deploy mobile app with new config
# (Your normal deployment process)
```

### Step 3: Monitor for 24 Hours

```bash
# Check Oracle server load
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 monit'

# Check memory usage
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'free -h'

# Check logs for errors
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 logs --lines 100'
```

### Step 4: Remove Google Cloud Billing (Optional)

After confirming Oracle is working perfectly:

1. **Delete Google Cloud Run service** (to avoid charges):
   ```bash
   gcloud run services delete pakistan-train-tracker --region=us-central1
   ```

2. **OR keep it** as a backup (will be charged after trial, but minimal if unused)

3. **Update config** to remove Google Cloud:
   ```javascript
   servers: {
       primary: 'http://138.2.91.18:3000',  // Oracle Cloud
       fallback: 'https://confused-eel-pakrail-7ab69761.koyeb.app',  // Koyeb
   }
   ```

---

## 📊 Server Comparison

| Feature | Google Cloud Run | Oracle Cloud (AMD) | Oracle Cloud (ARM) |
|---------|------------------|-------------------|-------------------|
| **Cost** | FREE (180 days) then ~$5-20/mo | FREE Forever | FREE Forever |
| **RAM** | Up to 4 GB | 1 GB | 24 GB |
| **CPU** | Auto-scale | 1 vCPU | 4 vCPUs |
| **HTTPS** | ✅ Automatic | ❌ Manual | ❌ Manual |
| **Cold Starts** | ⚠️ Yes (if no traffic) | ❌ None | ❌ None |
| **Auto-scaling** | ✅ Yes | ❌ Manual | ❌ Manual |
| **Capacity** | 100-500 users | 50-100 users | 500-1,000+ users |

---

## 🎯 Recommendations

### If Traffic is LOW (< 50 concurrent users):
✅ **Stick with Oracle AMD** (1 GB RAM)
- Free forever
- No cold starts
- Easy to manage
- Sufficient for your needs

### If Traffic is MEDIUM (50-200 concurrent users):
✅ **Upgrade to Oracle ARM** (4 vCPUs + 24 GB RAM)
- Still free forever!
- 30x more powerful
- No cold starts
- Run: `./create-arm-instance.sh`

### If Traffic is HIGH (500+ concurrent users):
✅ **Oracle ARM + Cloudflare CDN**
- Free ARM instance
- Free Cloudflare CDN
- Global edge caching
- DDoS protection
- Can handle 10,000+ users

### If You Want HTTPS (Recommended):
**Option A**: Add domain + Let's Encrypt to Oracle
**Option B**: Use Cloudflare CDN (easier, also gives HTTPS)
**Option C**: Use Koyeb as primary (already has HTTPS)

---

## 💡 Cost After Google Trial Expires

### Option 1: Oracle Only (Current Plan)
- **Cost**: $0/month ✅
- **Capacity**: 50-100 users (AMD) or 500-1,000 users (ARM)
- **Downside**: HTTP only (no HTTPS)

### Option 2: Oracle + Cloudflare
- **Cost**: $0/month ✅
- **Capacity**: 1,000+ users
- **Benefits**: HTTPS, CDN, DDoS protection

### Option 3: Keep Google Cloud Run
- **Cost**: ~$5-20/month 💸
- **Benefits**: Auto-scaling, HTTPS, no maintenance
- **When**: If you have budget and want convenience

### Option 4: Switch to Koyeb Primary
- **Cost**: $0/month ✅ (free tier)
- **Capacity**: 30-50 users
- **Benefits**: HTTPS, easy deployments
- **Downside**: Limited resources (512 MB RAM)

---

## 🔔 Important Reminders

### Before Trial Expires (Day 170):
- [ ] Check Google Cloud billing dashboard
- [ ] Test Oracle Cloud server
- [ ] Consider upgrading to ARM if needed
- [ ] Backup all configurations

### Migration Day (Day 180):
- [ ] Update `public/config.js`
- [ ] Deploy new configuration
- [ ] Monitor Oracle server for 24 hours
- [ ] Verify failover to Koyeb works

### After Migration (Day 181+):
- [ ] Delete/disable Google Cloud Run (optional)
- [ ] Remove Google Cloud from config
- [ ] Set up monitoring for Oracle
- [ ] Consider adding HTTPS (Cloudflare or Let's Encrypt)

---

## 📞 Quick Reference

### Google Cloud Run
```bash
# Check deployment
gcloud run services describe pakistan-train-tracker --region=us-central1

# View logs
gcloud run logs read pakistan-train-tracker --region=us-central1 --limit=100
```

### Oracle Cloud
```bash
# Connect
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18

# Check status
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 status'

# View logs
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 logs --lines 50'

# Restart
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 restart pakistan-train-tracker'
```

### Koyeb
```bash
# View in browser
open https://app.koyeb.com/

# Check logs
# (Use Koyeb dashboard - no CLI access)
```

---

## 🎉 You're All Set!

Current setup is **optimal**:
- ✅ Google Cloud Run (primary) - Fast, HTTPS, free for 180 days
- ✅ Oracle Cloud (fallback) - Free forever, always ready
- ✅ Koyeb (backup) - Free, HTTPS, safety net

**In 180 days**, just swap Oracle to primary in one line of code! 🚀

---

**Questions or need help with migration?** Check `ORACLE_SERVER_GUIDE.md` or `UPGRADE_TO_ARM.md`! 📚

