import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { fluxerAPI, Message } from '../services/api';
import { Screen } from '../components/Screen';
import * as ImagePicker from 'expo-image-picker';

interface ChatScreenProps {
  channel: { id: string; name?: string };
  currentUser: string;
  onBack: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ channel, currentUser, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const pollIntervalMs = 3500;
  const bottomThresholdPx = 80;

  const formatMessageTimestamp = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAvatarUri = (author?: { id: string; avatar?: string }) => {
    const avatar = author?.avatar;
    if (!author?.id || !avatar) return null;
    if (/^https?:\/\//i.test(avatar)) return avatar;

    const filename = avatar.includes('.') ? avatar : `${avatar}.png`;
    return `https://fluxerusercontent.com/avatars/${author.id}/${filename}?size=64&format=png`;
  };

  const isImageAttachment = (att: NonNullable<Message['attachments']>[number]) => {
    const ct = att.content_type?.toLowerCase();
    if (ct?.startsWith('image/')) return true;
    const url = (att.proxy_url || att.url || '').toLowerCase();
    return /\.(png|jpe?g|gif|webp)(\?|$)/.test(url);
  };

  const getAttachmentImageUri = (att: NonNullable<Message['attachments']>[number]) => {
    const raw = att.proxy_url || att.url;
    if (!raw) return null;

    // If this is a fluxerusercontent attachment, request a reasonable size.
    if (raw.includes('fluxerusercontent.com/attachments/') && !raw.includes('?')) {
      return `${raw}?size=512&format=png&quality=high`;
    }

    return raw;
  };

  const mergeMessages = useMemo(() => {
    return (prev: Message[], incoming: Message[]) => {
      const byId = new Map<string, Message>();
      for (const msg of prev) byId.set(msg.id, msg);
      for (const msg of incoming) byId.set(msg.id, msg);

      const toTime = (m: Message) => {
        const t = Date.parse(m.created_at || '');
        return Number.isFinite(t) ? t : null;
      };

      const toSnowflake = (m: Message) => {
        try {
          return BigInt(m.id);
        } catch {
          return null;
        }
      };

      return Array.from(byId.values()).sort((a, b) => {
        const ta = toTime(a);
        const tb = toTime(b);
        if (ta !== null && tb !== null && ta !== tb) return ta - tb;
        if (ta !== null && tb === null) return -1;
        if (ta === null && tb !== null) return 1;

        const sa = toSnowflake(a);
        const sb = toSnowflake(b);
        if (sa !== null && sb !== null && sa !== sb) return sa < sb ? -1 : 1;
        return 0;
      });
    };
  }, []);

  useEffect(() => {
    loadMessages();
  }, [channel.id]);

  useEffect(() => {
    let isCancelled = false;
    const intervalId = setInterval(async () => {
      try {
        const latest = await fluxerAPI.getMessages(channel.id, 50);
        if (isCancelled) return;
        setMessages((prev) => mergeMessages(prev, latest));
      } catch {
        // Avoid spamming UI with errors while polling.
      }
    }, pollIntervalMs);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [channel.id, mergeMessages]);

  const loadMessages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fluxerAPI.getMessages(channel.id, 50);
      setMessages(() => mergeMessages([], data));
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
      console.error('Error loading messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (inputText.trim() === '') return;

    const messageContent = inputText;
    setInputText('');
    setIsSending(true);

    try {
      const newMessage = await fluxerAPI.sendMessage(channel.id, messageContent);
      setMessages((prev) => mergeMessages(prev, [newMessage]));
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      console.error('Error sending message:', err);
      setInputText(messageContent); // Restore input on error
    } finally {
      setIsSending(false);
    }
  };

  const handlePickAndSendImage = async () => {
    if (isSending) return;

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Please allow photo access to send images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsMultipleSelection: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        setError('No image selected.');
        return;
      }

      const caption = inputText;
      setInputText('');
      setIsSending(true);

      const fileName = asset.fileName || `image_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';

      const newMessage = await fluxerAPI.sendMessageWithImage(channel.id, caption, {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      });

      setMessages((prev) => mergeMessages(prev, [newMessage]));
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send image';
      setError(errorMessage);
      console.error('Error sending image:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setIsAtBottom(distanceFromBottom < bottomThresholdPx);
  };

  useEffect(() => {
    if (!isAtBottom) return;
    const id = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 50);
    return () => clearTimeout(id);
  }, [messages, isAtBottom]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.author?.username === currentUser || item.author_id === currentUser;
    const authorName = isOwn ? 'You' : item.author?.username || 'Unknown';
    const timestamp = formatMessageTimestamp(item.created_at);
    const avatarUri = getAvatarUri(item.author);
    const initials = authorName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');

    const attachments = Array.isArray(item.attachments) ? item.attachments : [];
    const imageAttachments = attachments.filter(isImageAttachment);

    return (
      <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
        <View style={[styles.avatarWrap, isOwn && styles.avatarWrapOwn]}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials || '?'}</Text>
            </View>
          )}
        </View>

        <View style={styles.messageMain}>
          <View style={styles.messageHeaderLine}>
            <Text style={styles.senderName}>{authorName}</Text>
            {!!timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
          </View>

          <View
            style={[
              styles.messageBubble,
              isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
            ]}
          >
            {!!item.content && <Text style={styles.messageText}>{item.content}</Text>}
          </View>

          {imageAttachments.length > 0 && (
            <View style={styles.attachmentsWrap}>
              {imageAttachments.map((att) => {
                const uri = getAttachmentImageUri(att);
                if (!uri) return null;

                const w = typeof att.width === 'number' ? att.width : undefined;
                const h = typeof att.height === 'number' ? att.height : undefined;
                const aspectRatio = w && h && h > 0 ? w / h : undefined;

                return (
                  <Image
                    key={att.id || att.filename}
                    source={{ uri }}
                    style={[
                      styles.attachmentImage,
                      aspectRatio ? { aspectRatio, height: undefined } : null,
                      { marginBottom: 8 },
                    ]}
                    resizeMode="cover"
                  />
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Screen style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.channelTitle}>#{channel.name || 'Direct Message'}</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Messages or Loading/Error */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#5865F2" />
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadMessages}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        )}

        {/* Input Area */}
        {!isLoading && !error && (
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={[styles.attachButton, isSending && styles.attachButtonDisabled]}
              onPress={handlePickAndSendImage}
              disabled={isSending}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.attachButtonText}>＋</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Send a message..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!isSending}
            />
            <TouchableOpacity
              style={[styles.sendButton, (isSending || !inputText.trim()) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={isSending || !inputText.trim()}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#36393F',
  },
  flex: {
    flex: 1,
  },
  header: {
    backgroundColor: '#2C2F33',
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#202225',
    zIndex: 10,
    elevation: 10,
  },
  backButton: {
    color: '#5865F2',
    fontSize: 14,
    fontWeight: 'bold',
  },
  channelTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messagesList: {
    padding: 10,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatarWrap: {
    width: 40,
    alignItems: 'center',
    marginRight: 8,
  },
  avatarWrapOwn: {
    marginRight: 0,
    marginLeft: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#202225',
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#40444B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messageMain: {
    flex: 1,
    maxWidth: '86%',
  },
  messageHeaderLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  messageBubbleOther: {
    backgroundColor: '#2C2F33',
  },
  messageBubbleOwn: {
    backgroundColor: '#5865F2',
  },
  senderName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  messageText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },
  timestamp: {
    color: '#72767D',
    fontSize: 10,
    marginLeft: 8,
  },
  attachmentsWrap: {
    marginTop: 8,
  },
  attachmentImage: {
    width: '100%',
    maxWidth: 420,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#202225',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 22 : 10,
    borderTopWidth: 1,
    borderTopColor: '#202225',
    alignItems: 'flex-end',
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#40444B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  attachButtonDisabled: {
    opacity: 0.6,
  },
  attachButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  input: {
    flex: 1,
    backgroundColor: '#40444B',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#5865F2',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#4752C4',
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
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
});
