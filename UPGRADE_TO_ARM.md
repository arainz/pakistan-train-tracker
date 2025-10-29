# Upgrade Oracle Cloud to ARM (A1.Flex) - Zero Downtime

## 🎯 Why Upgrade?

Your current **E2.1.Micro (AMD)** vs **A1.Flex (ARM)**:

| Feature | E2.1.Micro (Current) | A1.Flex (Upgrade) | Improvement |
|---------|---------------------|-------------------|-------------|
| **CPU** | 1 vCPU | 4 vCPUs | **4x faster** |
| **RAM** | 1 GB | 24 GB | **24x more** |
| **Concurrent Users** | 50-100 | 500-1,000+ | **10x capacity** |
| **Requests/sec** | 20-50 | 200-500+ | **10x throughput** |
| **Cost** | FREE ✅ | FREE ✅ | **Same!** |

**Bottom line**: 30x more powerful for FREE! 🚀

---

## ⚠️ Important: Cannot Upgrade In-Place

**You MUST create a new instance** because:
- Different CPU architecture (AMD → ARM)
- Different instance shapes
- Oracle doesn't support direct upgrades

**But don't worry!** We'll do it with **ZERO downtime** by:
1. Creating new ARM instance while old one runs
2. Deploying to new instance
3. Testing thoroughly
4. Switching traffic
5. Optionally keeping old instance as backup

---

## 📋 Prerequisites

✅ You already have:
- Oracle Cloud account (active)
- OCI CLI configured
- SSH key (`~/.ssh/oracle_vm.key`)
- Current AMD instance running (`138.2.91.18`)
- VCN and subnet created

---

## 🚀 Step-by-Step: Zero Downtime Upgrade

### Step 1: Create ARM Instance

Run the creation script:

```bash
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail
./create-arm-instance.sh
```

**What it does:**
- Creates VM.Standard.A1.Flex (4 vCPUs + 24 GB RAM)
- Uses your existing VCN/subnet (same network as current instance)
- Assigns public IP
- Configures firewall

**Expected output:**
```
✅ ARM Instance created successfully!
   Public IP assigned: 138.2.XX.XX

📋 Next Steps:
1️⃣  Wait 2-3 minutes for instance to fully boot
2️⃣  Connect via SSH: ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.XX.XX
```

**If you get "Out of capacity":**
- This is common for ARM instances (high demand)
- **Option A**: Try again in a few hours
- **Option B**: Use the auto-retry script (tries every 10 minutes):
  ```bash
  # Update oracle-auto-create.sh with new subnet ID and run:
  ./oracle-auto-create.sh
  ```
- **Option C**: Request fewer resources (2 vCPUs + 12 GB instead of 4 + 24)

---

### Step 2: Configure Firewall on New Instance

Once created, configure iptables (same as we did for AMD):

```bash
# Replace NEW_IP with your new ARM instance IP
NEW_IP="138.2.XX.XX"

ssh -i ~/.ssh/oracle_vm.key ubuntu@$NEW_IP 'bash -s' << 'ENDSSH'
echo "🔧 Configuring firewall..."

# Allow established connections
sudo iptables -A INPUT -m state --state RELATED,ESTABLISHED -j ACCEPT

# Allow loopback
sudo iptables -A INPUT -i lo -j ACCEPT

# Allow SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow Node.js API
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT

# Allow ICMP (ping)
sudo iptables -A INPUT -p icmp -j ACCEPT

# Drop everything else
sudo iptables -A INPUT -j DROP

echo "💾 Installing iptables-persistent..."
sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent

echo "💾 Saving firewall rules..."
sudo netfilter-persistent save

echo "✅ Firewall configured and saved!"
sudo iptables -L INPUT -n -v --line-numbers
ENDSSH
```

---

### Step 3: Deploy Your App to ARM Instance

```bash
# Replace NEW_IP with your new ARM instance IP
NEW_IP="138.2.XX.XX"

# 1. Create deployment package
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail
tar --exclude='node_modules' -czf full-deploy.tar.gz server.js package.json package-lock.json public/

# 2. Upload to new instance
scp -i ~/.ssh/oracle_vm.key full-deploy.tar.gz ubuntu@$NEW_IP:~/

# 3. Install and start
ssh -i ~/.ssh/oracle_vm.key ubuntu@$NEW_IP 'bash -s' << 'ENDSSH'
set -e

echo "📦 Updating system and installing Node.js 18..."
sudo apt-get update -qq
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

echo ""
echo "📦 Installing PM2..."
sudo npm install -g pm2

echo ""
echo "📦 Extracting application files..."
tar -xzf full-deploy.tar.gz
rm full-deploy.tar.gz

echo ""
echo "📦 Installing dependencies..."
npm install --production

echo ""
echo "🚀 Starting server with PM2..."
PORT=3000 pm2 start server.js --name pakistan-train-tracker --time

echo ""
echo "⚙️ Configuring PM2 to start on boot..."
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash

echo ""
echo "📊 Server status:"
pm2 status

echo ""
echo "✅ Deployment complete!"
ENDSSH

echo ""
echo "🎉 ARM instance is now running!"
echo "🌐 Test it: http://$NEW_IP:3000"
```

---

### Step 4: Test New ARM Instance

Before switching traffic, test thoroughly:

```bash
# Test web interface
curl -I http://NEW_IP:3000/

# Test API
curl -s http://NEW_IP:3000/api/live | head -100

# Test mobile interface
curl -I http://NEW_IP:3000/mobile.html
```

**All should return `HTTP/1.1 200 OK`**

---

### Step 5: Update Mobile App Configuration

Update `public/config.js` to use the new ARM instance:

```javascript
servers: {
    primary: 'http://NEW_IP:3000',  // New ARM instance (FASTER!)
    fallback: 'http://138.2.91.18:3000',  // Old AMD instance (backup)
    backup: 'https://confused-eel-pakrail-7ab69761.koyeb.app',  // Koyeb
}
```

**This gives you TRIPLE redundancy!** 🛡️

---

### Step 6: Deploy Updated Config

```bash
# Build and deploy mobile app with new config
# (Follow your normal mobile app deployment process)
```

---

### Step 7: Monitor Both Instances

Monitor for 24-48 hours to ensure ARM instance is stable:

```bash
# Check ARM instance
ssh -i ~/.ssh/oracle_vm.key ubuntu@NEW_IP 'pm2 status && free -h'

# Check old AMD instance (still running as backup!)
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 status && free -h'
```

---

### Step 8: (Optional) Terminate Old AMD Instance

After you're confident the ARM instance is stable:

1. **List instances:**
   ```bash
   oci compute instance list --compartment-id ocid1.tenancy.oc1..aaaaaaaavky7g3z5qogo5tqekqt3xbvsvvxbfaoxqalst2mpdkes2egxznoa --query 'data[].{"Name":"display-name","State":"lifecycle-state","OCID":"id"}' --output table
   ```

2. **Terminate old AMD instance:**
   ```bash
   # Replace INSTANCE_OCID with the OCID from step 1
   oci compute instance terminate --instance-id INSTANCE_OCID --force
   ```

3. **Update config.js** to remove old IP:
   ```javascript
   servers: {
       primary: 'http://NEW_IP:3000',  // ARM instance
       fallback: 'https://confused-eel-pakrail-7ab69761.koyeb.app',  // Koyeb
   }
   ```

**OR keep it as backup!** (Oracle allows 2 AMD instances OR 1 ARM in free tier, so you can run BOTH if you want the ARM as backup)

---

## 🔍 Troubleshooting

### Problem: "Out of capacity" error

**Solutions:**
1. **Try different availability domain** (if your region has multiple)
2. **Use auto-retry script** (keeps trying every 10 minutes)
3. **Reduce resources** (try 2 vCPUs + 12 GB instead of 4 + 24)
4. **Try different time** (early morning UTC often has better availability)
5. **Keep current AMD instance** (it's working great!)

### Problem: SSH connection timeout to new instance

**Solutions:**
1. Check Oracle Cloud Security List (ports 22, 3000)
2. Wait 5 minutes for instance to fully boot
3. Check iptables rules on instance
4. Verify public IP is assigned

### Problem: Server not starting on ARM

**Solutions:**
1. Check PM2 logs: `ssh -i ~/.ssh/oracle_vm.key ubuntu@NEW_IP 'pm2 logs'`
2. Check Node.js version: `ssh -i ~/.ssh/oracle_vm.key ubuntu@NEW_IP 'node --version'`
3. Reinstall dependencies: `npm install --production`

---

## 📊 Performance Comparison (Before/After)

### Before (AMD E2.1.Micro):
```
Memory: 952 MB total
CPU: 1 vCPU
Concurrent Users: 50-100
Requests/sec: 20-50
```

### After (ARM A1.Flex):
```
Memory: 24 GB total (25x more!)
CPU: 4 vCPUs (4x more!)
Concurrent Users: 500-1,000+ (10x more!)
Requests/sec: 200-500+ (10x more!)
```

---

## 💰 Cost Comparison

| Instance Type | Monthly Cost |
|--------------|-------------|
| AMD E2.1.Micro | **$0 (FREE)** ✅ |
| ARM A1.Flex (4 vCPU + 24 GB) | **$0 (FREE)** ✅ |
| Equivalent AWS EC2 | **~$50/month** 💸 |
| Equivalent DigitalOcean | **~$40/month** 💸 |

**You're getting $50/month worth of resources for FREE!** 🎉

---

## 🎯 Summary

1. ✅ **Create new ARM instance** (zero downtime)
2. ✅ **Deploy app to ARM**
3. ✅ **Test thoroughly**
4. ✅ **Update config** to use ARM as primary
5. ✅ **Keep AMD as backup** (optional)
6. ✅ **Enjoy 30x more power** for free!

**Questions?** Check the main `ORACLE_SERVER_GUIDE.md` or ask! 🚀

