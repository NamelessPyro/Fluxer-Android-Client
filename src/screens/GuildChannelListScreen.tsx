import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { fluxerAPI, Channel, Guild } from '../services/api';
import { Screen } from '../components/Screen';

interface GuildChannelListScreenProps {
  guild: Guild;
  onChannelSelect: (channel: Channel) => void;
  onBack: () => void;
}

export const GuildChannelListScreen: React.FC<GuildChannelListScreenProps> = ({
  guild,
  onChannelSelect,
  onBack,
}) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guild.id]);

  const loadChannels = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fluxerAPI.getGuildChannels(guild.id);
      setChannels(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load channels';
      setError(errorMessage);
      console.error('Error loading guild channels:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderChannel = ({ item }: { item: Channel }) => {
    const displayName = item.name || 'channel';
    return (
      <TouchableOpacity
        style={styles.channelItem}
        onPress={() => onChannelSelect(item)}
        activeOpacity={0.7}
      >
        <View>
          <Text style={styles.channelName}>#{displayName}</Text>
          {item.description && <Text style={styles.channelDesc}>{item.description}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{guild.name || 'Server'}</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#5865F2" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadChannels}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : channels.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No channels available</Text>
        </View>
      ) : (
        <FlatList
          data={channels}
          renderItem={renderChannel}
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
  channelItem: {
    backgroundColor: '#2C2F33',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#5865F2',
  },
  channelName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  channelDesc: {
    color: '#B9BBBE',
    fontSize: 12,
    marginTop: 4,
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
