# 🚀 Deploy Pakistan Train Tracker

Your mobile app is ready! Here's how to deploy the server so your mobile app can access it from anywhere.

## 🔥 Quick Deploy Options

### Option 1: Railway.app (Recommended - FREE)

1. **Go to**: https://railway.app
2. **Sign up** with GitHub
3. **Click "Deploy from GitHub repo"**
4. **Connect** this repository
5. **Deploy** - Railway will automatically detect Node.js
6. **Get your URL** (will be something like: `https://yourapp.railway.app`)

### Option 2: Render.com (FREE)

1. **Go to**: https://render.com
2. **Sign up** with GitHub  
3. **New Web Service**
4. **Connect** this repository
5. **Settings**:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Node Version: 18
6. **Deploy**

### Option 3: Vercel (FREE)

1. **Go to**: https://vercel.com
2. **Sign up** with GitHub
3. **Import Project** from this repository
4. **Deploy** (it will auto-configure)

## 📱 Update Mobile App

After deployment, you'll get a URL like:
- `https://pakistan-train-tracker.railway.app`
- `https://pakistan-train-tracker.onrender.com` 
- `https://yourapp.vercel.app`

**Replace the URL** in `/public/config.js`:

```javascript
// Line 8: Change this URL to your deployed server
return 'https://YOUR-DEPLOYED-URL-HERE';
```

Then rebuild the mobile app:
```bash
npx cap sync android
export JAVA_HOME=/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
cd android && ./gradlew assembleDebug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## ✅ What's Already Done

- ✅ Project is git-ready
- ✅ Package.json configured for deployment  
- ✅ Mobile app configured for remote server
- ✅ CORS enabled for cross-origin requests
- ✅ Environment variables supported

## 🔧 Manual Deployment (Any Host)

If you prefer other hosting:

1. **Upload these files** to your web host:
   - `server.js`
   - `package.json` 
   - `public/` folder
   - `.env` (if needed)

2. **Run on server**:
   ```bash
   npm install
   npm start
   ```

3. **Update mobile config** with your server URL

## 📝 Notes

- The mobile app automatically detects if it's running in the app vs web
- Web version will work from the same deployed URL  
- Free hosting tiers are perfect for this app
- Server supports both HTTP and WebSocket connections

Choose any option above and your mobile app will have live train data! 🚂✨