# Hosting Guide for Pakistan Train Tracker

## Current App Architecture
- **Backend**: Node.js/Express server (server.js)
- **Frontend**: HTML/CSS/JavaScript (public folder)
- **APIs**: Custom endpoints (/api/*)
- **Real-time**: WebSocket connections

## Option 1: Hostinger Shared Hosting (Limited)

### ⚠️ Limitations
- Hostinger shared hosting **does NOT support Node.js**
- Only supports: PHP, HTML, CSS, JavaScript (client-side)
- No server-side JavaScript execution

### Workaround - Static Frontend Only
If you want to use Hostinger shared hosting:

1. **Extract Frontend Files**:
   ```
   public/
   ├── index.html
   ├── train.html
   ├── styles.css
   ├── app.js
   ├── train-new.js
   └── locomotive_1f682.png
   ```

2. **Modify API Calls** (app.js and train-new.js):
   ```javascript
   // Change from:
   const response = await fetch('/api/live');
   
   // To direct API calls:
   const response = await fetch('https://trackyourtrains.com/api/live');
   ```

3. **Upload to Hostinger**:
   - Login to Hostinger cPanel
   - Go to File Manager
   - Upload all files from `public/` folder to `public_html/`

### Issues with This Approach:
- ❌ CORS errors (external API calls blocked)
- ❌ No custom server logic
- ❌ No WebSocket support
- ❌ Limited functionality

## Option 2: Hostinger VPS (Recommended) 💎

### Requirements
- Hostinger VPS plan ($3.99+/month)
- Full Node.js support
- SSH access

### Steps:
1. **Purchase Hostinger VPS**
2. **Connect via SSH**:
   ```bash
   ssh root@your-vps-ip
   ```

3. **Install Node.js**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Upload App**:
   ```bash
   # Using SCP
   scp -r /path/to/Rail root@your-vps-ip:/var/www/
   ```

5. **Install Dependencies**:
   ```bash
   cd /var/www/Rail
   npm install
   ```

6. **Install PM2** (Process Manager):
   ```bash
   npm install -g pm2
   pm2 start server.js --name "train-tracker"
   pm2 startup
   pm2 save
   ```

7. **Configure Nginx**:
   ```bash
   sudo nano /etc/nginx/sites-available/default
   ```
   
   Add:
   ```nginx
   location / {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
   }
   ```

8. **Restart Nginx**:
   ```bash
   sudo systemctl restart nginx
   ```

## Option 3: Alternative Free Hosting 🆓

### Vercel (Recommended)
1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Create vercel.json**:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server.js",
         "use": "@vercel/node"
       },
       {
         "src": "public/**/*",
         "use": "@vercel/static"
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "/server.js"
       },
       {
         "src": "/(.*)",
         "dest": "/public/$1"
       }
     ]
   }
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

### Railway
1. **Connect GitHub repo**
2. **Auto-deploys** on push
3. **Free tier available**

### Render
1. **Connect GitHub**
2. **Free tier** with limitations
3. **Easy deployment**

## Option 4: Hostinger Business Hosting 💼

### Requirements
- Hostinger Business plan ($2.99+/month)
- Node.js support (limited)
- SSH access

### Setup Process:
1. **Enable Node.js** in cPanel
2. **Upload files** via File Manager
3. **Install dependencies** via Terminal
4. **Configure app** for shared environment

## Recommended Approach 🎯

For your train tracking app, I recommend:

1. **Vercel** (Free, easy deployment)
2. **Hostinger VPS** (Full control, $3.99/month)
3. **Railway** (Free tier available)

## Domain Configuration

### If using custom domain:
1. **Update DNS** in domain provider
2. **Point A record** to hosting IP
3. **Configure SSL** certificate

## Environment Variables

Create `.env` file:
```env
PORT=3000
NODE_ENV=production
```

## Security Considerations

1. **Remove localhost restriction** in server.js:
   ```javascript
   // Change from:
   app.listen(PORT, 'localhost', () => {
   
   // To:
   app.listen(PORT, () => {
   ```

2. **Add CORS configuration** for production
3. **Enable HTTPS** for WebSocket connections

## Performance Optimization

1. **Minify CSS/JS** files
2. **Enable gzip** compression
3. **Set up CDN** for static assets
4. **Cache API responses**

Would you like me to help you with any specific hosting option?