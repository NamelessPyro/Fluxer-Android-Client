import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, BackHandler } from 'react-native';
import { useState, useContext, useEffect } from 'react';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { ChannelListScreen } from './src/screens/ChannelListScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ServerListScreen } from './src/screens/ServerListScreen';
import { GuildChannelListScreen } from './src/screens/GuildChannelListScreen';

import type { Channel, Guild } from './src/services/api';

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<
    'login' | 'channels' | 'servers' | 'guildChannels' | 'chat'
  >('login');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [chatOrigin, setChatOrigin] = useState<'channels' | 'guildChannels'>('channels');
  const { user, logout, isInitialized } = useContext(AuthContext);

  // Auto-navigate to channels if user is logged in
  useEffect(() => {
    if (isInitialized) {
      if (user) {
        setCurrentScreen('channels');
      } else {
        setCurrentScreen('login');
      }
    }
  }, [isInitialized, user]);

  const handleLoginSuccess = () => {
    setCurrentScreen('channels');
  };

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
    setChatOrigin('channels');
    setCurrentScreen('chat');
  };

  const handleServersPress = () => {
    setCurrentScreen('servers');
  };

  const handleGuildSelect = (guild: Guild) => {
    setSelectedGuild(guild);
    setCurrentScreen('guildChannels');
  };

  const handleGuildChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
    setChatOrigin('guildChannels');
    setCurrentScreen('chat');
  };

  const handleBack = () => {
    if (currentScreen === 'chat') {
      setSelectedChannel(null);
      setCurrentScreen(chatOrigin);
      return;
    }

    if (currentScreen === 'guildChannels') {
      setSelectedGuild(null);
      setCurrentScreen('servers');
      return;
    }

    if (currentScreen === 'servers') {
      setCurrentScreen('channels');
      return;
    }
  };

  const handleLogout = async () => {
    await logout();
    setCurrentScreen('login');
    setSelectedChannel(null);
    setSelectedGuild(null);
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentScreen === 'chat' || currentScreen === 'guildChannels' || currentScreen === 'servers') {
        handleBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScreen, chatOrigin]);

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#5865F2" />
        </View>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {currentScreen === 'login' && <LoginScreen onLoginSuccess={handleLoginSuccess} />}

      {currentScreen === 'channels' && (
        <ChannelListScreen
          onChannelSelect={handleChannelSelect}
          onServersPress={handleServersPress}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === 'servers' && (
        <ServerListScreen onGuildSelect={handleGuildSelect} onBack={handleBack} />
      )}

      {currentScreen === 'guildChannels' && selectedGuild && (
        <GuildChannelListScreen
          guild={selectedGuild}
          onChannelSelect={handleGuildChannelSelect}
          onBack={handleBack}
        />
      )}

      {currentScreen === 'chat' && selectedChannel && user && (
        <ChatScreen channel={selectedChannel} currentUser={user.username} onBack={handleBack} />
      )}

      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#36393F',
  },
});
