# Fluxer Mobile Client V2

A basic but fully functional Fluxer chat client built with React Native and Expo.

## Features

✅ **Authentication** - Login/Register with demo mode support  
✅ **Channel List** - Browse available channels  
✅ **Real-time Chat** - Send and receive messages  
✅ **User-friendly UI** - Discord-inspired dark theme  
✅ **TypeScript** - Full type safety

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI: `npm install -g expo-cli`

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Run on your platform:**
   - **iOS**: Press `i` to open in iOS Simulator
   - **Android**: Press `a` to open in Android Emulator
   - **Web**: Press `w` to open in browser
   - **Expo Go**: Scan QR code with Expo Go app on your phone

### Demo Credentials

The app currently runs in demo mode. You can login with any email/password combination:

- **Email**: test@example.com
- **Password**: anything

## Project Structure

```
src/
├── config/
│   └── api.ts              # API configuration and endpoints
├── context/
│   └── AuthContext.tsx     # Authentication context & provider
├── screens/
│   ├── LoginScreen.tsx     # Login/Register screen
│   ├── ChannelListScreen.tsx
│   └── ChatScreen.tsx      # Message display & input
```

## Architecture

- **AuthContext**: Manages user authentication state
- **Screen Navigation**: Simple state-based navigation (login → channels → chat)
- **Screens**: Three main screens - Login, Channel List, and Chat
- **Demo Mode**: Currently uses mock data for channels and messages

## Next Steps for Production

1. **Connect to Real Backend**:
   - Update `AuthContext.tsx` with actual API calls
   - Implement WebSocket connection for real-time messages

2. **Add Features**:
   - Server/Guild support
   - User profiles
   - Voice/Video calls (using Fluxer Media Proxy)
   - Message reactions & editing
   - Typing indicators
   - User presence

3. **Performance**:
   - Message pagination
   - Image/file upload support
   - Caching strategy

4. **Testing**:
   - Unit tests for services
   - Component tests
   - E2E tests

## Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser

## Troubleshooting

**Issue**: Metro bundler errors
- **Solution**: Clear cache with `expo start --clear`

**Issue**: Modules not found
- **Solution**: Run `npm install` again and ensure node_modules exists

**Issue**: Port already in use
- **Solution**: Expo will automatically choose a different port

## Resources

- [Fluxer Documentation](https://docs.fluxer.app)
- [Expo Documentation](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)

## License

MIT
