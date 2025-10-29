# Oracle Cloud Server Management Guide

## ✅ Server Details

- **Provider**: Oracle Cloud (Always Free Tier)
- **IP Address**: `138.2.91.18`
- **Instance Name**: `pakrail-instance-new`
- **Region**: Asia Pacific (Singapore)
- **Shape**: VM.Standard.E2.1.Micro (Always Free-eligible)
- **OS**: Ubuntu 20.04 LTS
- **RAM**: 1 GB
- **Disk**: 45 GB
- **vCPUs**: 1

## 🔐 SSH Access

### Connect to Server

```bash
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18
```

### SSH Key Location
- **Private Key**: `~/.ssh/oracle_vm.key`
- **Downloaded As**: `~/Downloads/ssh-key-2025-10-29.key` (already moved)

## 🚀 API Endpoints

### Base URL
```
http://138.2.91.18:3000
```

### Available Endpoints
- `/api/live` - Live train data (74 trains)
- `/api/trains` - All trains
- `/api/stations` - All stations
- `/api/schedule` - Train schedules
- `/api/train/:identifier` - Single train details
- `/api/search?query=...` - Search trains
- `/api/stations/search?query=...` - Search stations
- `/api/trains/between?from=...&to=...` - Trains between stations

## 📊 Server Management

### Check Server Status

```bash
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 status'
```

### View Live Logs

```bash
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 logs pakistan-train-tracker --lines 50'
```

### Restart Server

```bash
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 restart pakistan-train-tracker'
```

### Stop Server

```bash
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 stop pakistan-train-tracker'
```

### Start Server

```bash
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 start pakistan-train-tracker'
```

### Server Resource Usage

```bash
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 monit'
```

## 🔄 Update Server Code

### 1. Create Updated Deployment Package

```bash
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail
tar --exclude='node_modules' -czf server-deploy.tar.gz server.js package.json package-lock.json
```

### 2. Upload to Server

```bash
scp -i ~/.ssh/oracle_vm.key server-deploy.tar.gz ubuntu@138.2.91.18:~/
```

### 3. Deploy on Server

```bash
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'bash -s' << 'ENDSSH'
# Extract files
tar -xzf server-deploy.tar.gz
rm server-deploy.tar.gz

# Install dependencies
npm install --production

# Restart server
pm2 restart pakistan-train-tracker

# Check status
pm2 status
pm2 logs pakistan-train-tracker --lines 20 --nostream
ENDSSH
```

### Quick Update Command (All-in-One)

```bash
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail && \
tar --exclude='node_modules' -czf server-deploy.tar.gz server.js package.json package-lock.json && \
scp -i ~/.ssh/oracle_vm.key server-deploy.tar.gz ubuntu@138.2.91.18:~/ && \
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'tar -xzf server-deploy.tar.gz && rm server-deploy.tar.gz && npm install --production && pm2 restart pakistan-train-tracker && pm2 status'
```

## 🔥 Firewall (UFW)

### Check Firewall Status

```bash
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'sudo ufw status'
```

### Open Additional Ports

```bash
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'sudo ufw allow <PORT>/tcp && sudo ufw status'
```

## 🌐 Networking (Oracle Cloud Console)

### Security List Rules (Already Configured)
- **Port 22** (SSH): Source `0.0.0.0/0` - TCP
- **Port 3000** (API): Source `0.0.0.0/0` - TCP

### Route Table (Already Configured)
- **Internet Gateway**: `pakrail-igw`
- **Destination**: `0.0.0.0/0` → Internet Gateway

### To Add More Ports:
1. Go to: https://cloud.oracle.com/compute/instances
2. Click on instance → Primary VNIC → Subnet → Security Lists
3. Add Ingress Rule:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: `TCP`
   - Destination Port: `<YOUR_PORT>`

## 💾 Backup & Restore

### Backup Current Server

```bash
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'tar -czf ~/backup-$(date +%Y%m%d).tar.gz ~/server.js ~/package.json ~/.pm2/'
scp -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18:~/backup-*.tar.gz ~/Downloads/
```

### Restore from Backup

```bash
scp -i ~/.ssh/oracle_vm.key ~/Downloads/backup-YYYYMMDD.tar.gz ubuntu@138.2.91.18:~/
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'tar -xzf backup-YYYYMMDD.tar.gz && pm2 restart pakistan-train-tracker'
```

## 🔧 Troubleshooting

### Server Not Responding

1. **Check if server is running**:
   ```bash
   ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 status'
   ```

2. **Check logs for errors**:
   ```bash
   ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 logs pakistan-train-tracker --lines 100'
   ```

3. **Restart server**:
   ```bash
   ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 restart pakistan-train-tracker'
   ```

### SSH Connection Timeout

1. **Check instance status** (via Oracle Cloud Console)
2. **Verify Security List** has port 22 open
3. **Check Internet Gateway** is attached to VCN
4. **Try Serial Console** if SSH completely fails

### High Memory Usage

```bash
# Check memory
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'free -h'

# Restart server to clear memory
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 restart pakistan-train-tracker'
```

### Disk Space Full

```bash
# Check disk usage
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'df -h'

# Clean up logs
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 flush && sudo apt-get clean'
```

## 💰 Cost

**✅ COMPLETELY FREE** - Oracle Cloud Always Free Tier includes:
- 2 AMD Compute VMs (up to 1/8 OCPU and 1 GB RAM each)
- OR 4 Arm-based Ampere A1 cores and 24 GB RAM (as a single VM or distributed)
- 200 GB Block Volume Storage
- 10 GB Object Storage
- 10 TB Outbound Data Transfer per month

**No credit card charges** as long as you stay within the Always Free limits!

## 📱 Mobile App Configuration

Your app is already configured to use Oracle Cloud as primary:

**`public/config.js`**:
```javascript
servers: {
    primary: 'http://138.2.91.18:3000',           // Oracle Cloud (FREE)
    fallback: 'https://confused-eel-pakrail-7ab69761.koyeb.app',  // Koyeb (FREE)
    backup: 'https://pakistan-train-tracker-174840179894.us-central1.run.app', // Google Cloud (Paid)
}
```

The app will automatically switch to fallback if Oracle server is down!

## 🎯 Quick Commands Cheat Sheet

```bash
# Connect
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18

# Status
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 status'

# Logs
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 logs --lines 50'

# Restart
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'pm2 restart pakistan-train-tracker'

# Update (from project root)
cd /Users/abdulnasir/Data/AbdulNasir/Projects/PS/CodeHelp/Rail && \
tar --exclude='node_modules' -czf server-deploy.tar.gz server.js package.json package-lock.json && \
scp -i ~/.ssh/oracle_vm.key server-deploy.tar.gz ubuntu@138.2.91.18:~/ && \
ssh -i ~/.ssh/oracle_vm.key ubuntu@138.2.91.18 'tar -xzf server-deploy.tar.gz && rm server-deploy.tar.gz && npm install --production && pm2 restart pakistan-train-tracker'
```

---

## 🎉 You're All Set!

Your Pakistan Train Tracker API is now running 24/7 on Oracle Cloud for **FREE**! 🚂💨

