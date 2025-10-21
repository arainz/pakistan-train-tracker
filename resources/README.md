# App Resources

## Icons and Splash Screens

For a production app, you would need:

### App Icons
- icon.png (1024x1024) - Master icon
- Various sizes will be generated automatically by Capacitor

### Splash Screens  
- splash.png (2732x2732) - Master splash screen
- Various sizes will be generated automatically by Capacitor

## Current Setup

This app is configured with:
- App ID: com.pakrailtracker.app
- App Name: Pakistan Train Tracker
- Theme Color: #667eea

## To Generate Icons

Run: `npx capacitor-assets generate --iconBackgroundColor '#667eea' --splashBackgroundColor '#667eea'`

Note: For now, the app will use default icons. Add proper icon.png and splash.png files to this directory for custom branding.