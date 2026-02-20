import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { fluxerAPI, Guild } from '../services/api';
import { Screen } from '../components/Screen';

interface ServerListScreenProps {
  onGuildSelect: (guild: Guild) => void;
  onBack: () => void;
}

export const ServerListScreen: React.FC<ServerListScreenProps> = ({ onGuildSelect, onBack }) => {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGuilds();
  }, []);

  const loadGuilds = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fluxerAPI.getGuilds();
      setGuilds(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load servers';
      setError(errorMessage);
      console.error('Error loading servers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderGuild = ({ item }: { item: Guild }) => {
    return (
      <TouchableOpacity
        style={styles.guildItem}
        onPress={() => onGuildSelect(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.guildName}>{item.name || 'Server'}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Servers</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#5865F2" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadGuilds}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : guilds.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No servers available</Text>
        </View>
      ) : (
        <FlatList
          data={guilds}
          renderItem={renderGuild}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#2C2F33',
    paddingVertical: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backText: {
    color: '#5865F2',
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 10,
  },
  guildItem: {
    backgroundColor: '#2C2F33',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#5865F2',
  },
  guildName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryBtn: {
    backgroundColor: '#5865F2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#B9BBBE',
    fontSize: 14,
  },
});
