# Fluxer Mobile Client

A React Native chat client for Fluxer built with Expo. Feature-complete mobile app with login, channels, servers, direct messages, and image sharing.

## Quick Start

### Prerequisites
- Node.js v18+
- npm

### Installation & Running

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on:
# - Android emulator: Press 'a'
# - iOS simulator: Press 'i'
# - Web browser: Press 'w'
# - Expo Go app: Scan QR code
```

## Build for Android APK

### Cloud Build (Recommended - Works on Windows/Mac/Linux)

```bash
# Log in to Expo
npx eas login

# Build APK via EAS (cloud)
npm run build:android-apk

# Follow prompts. When done, download the APK from the Expo dashboard or the CLI output link.
```

### Local Build (macOS/Linux only)

```bash
npx eas build --platform android --profile production --local
```


## Features

- ✅ **Authentication** – Login/register with email & password, IP verification support
- ✅ **Channels** – Browse and chat in channels  
- ✅ **Direct Messages** – 1-on-1 messaging
- ✅ **Servers/Guilds** – Browse guild channels
- ✅ **Image Sharing** – Send images from camera roll
- ✅ **Dark Theme** – Discord-inspired dark UI
- ✅ **Type-Safe** – Full TypeScript support
- ✅ **Real-Time** – Message polling with live updates

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── Screen.tsx        # Safe area wrapper
│   ├── GoogleRecaptcha.tsx
│   └── HCaptchaComponent.tsx
├── config/
│   └── api.ts            # API base URL configuration
├── context/
│   └── AuthContext.tsx   # Auth state management
├── screens/              # App screens
│   ├── LoginScreen.tsx   # Login/register
│   ├── ChannelListScreen.tsx
│   ├── ChatScreen.tsx    # Message display & input
│   ├── ServerListScreen.tsx
│   └── GuildChannelListScreen.tsx
└── services/
    └── api.ts            # API client (login, channels, messages, etc.)
```

## Recent Changes & Fixes

✅ **Dependencies Fixed**
- Resolved npm peer dependency conflicts (react-native-modal, @hcaptcha)
- Removed unused react-native-google-recaptcha-v2 package

✅ **TypeScript Compilation**
- All source files compile without errors (`npx tsc --noEmit`)
- Unified Channel type usage across app
- Proper type inference for API responses

✅ **EAS Build Configuration**
- eas.json configured for Android APK builds
- Added `npm run build:android-apk` script

## Configuration

### API Endpoint
Default: `https://api.fluxer.app`

Update in `src/config/api.ts`:
```typescript
export const FLUXER_API_BASE_URL = 'https://your-api-url.com';
```

### Captcha
Current: hCaptcha (site key in LoginScreen.tsx)

## Available Scripts

```bash
npm start              # Start dev server
npm run android        # Run on Android emulator
npm run ios            # Run on iOS simulator
npm run web            # Run in browser
npm run build:android-apk   # Build APK via EAS cloud
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Metro bundler errors | `npm start --clear` |
| Modules not found | `npm install` and verify node_modules |
| Port already in use | Expo auto-selects a new port |
| Build fails on Windows | Use EAS cloud build (`npm run build:android-apk`), not local |

## Documentation

- [Fluxer Docs](https://docs.fluxer.app)
- [Expo Docs](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)

## License

MIT

