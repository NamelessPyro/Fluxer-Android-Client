import React, { useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import HCaptcha from '@hcaptcha/react-native-hcaptcha';

interface GoogleRecaptchaProps {
  siteKey: string;
  onTokenReceived: (token: string) => void;
  onError?: (error: string) => void;
}

export const GoogleRecaptcha: React.FC<GoogleRecaptchaProps> = ({
  siteKey,
  onTokenReceived,
  onError
}) => {
  const hcaptchaRef = useRef<any>(null);

  const handleOpen = () => {
    console.log('[GoogleRecaptcha] Opening captcha');
    if (hcaptchaRef.current?.show) {
      hcaptchaRef.current.show();
    } else if (hcaptchaRef.current?.open) {
      hcaptchaRef.current.open();
    } else {
      console.warn('[GoogleRecaptcha] HCaptcha ref methods not available');
    }
  };

  const handleMessage = (event: any) => {
    try {
      const message = event.nativeEvent.data;
      console.log('[hCaptcha] Raw message:', message, 'Type:', typeof message);
      
      // Try to parse as JSON first
      let data;
      if (typeof message === 'string') {
        try {
          data = JSON.parse(message);
        } catch (e) {
          console.log('[hCaptcha] Not JSON, treating as string:', message);
          // Check if it's a token (usually starts with P or is alphanumeric)
          if (message && message.length > 10 && !message.includes('{')) {
            console.log('[hCaptcha] Token received (string):', message);
            onTokenReceived(message);
            return;
          }
          return;
        }
      } else if (typeof message === 'object') {
        data = message;
      }
      
      if (!data) return;
      
      console.log('[hCaptcha] Parsed message:', data);
      
      if (data.token || data.captcha_token) {
        console.log('[hCaptcha] Token received:', data.token || data.captcha_token);
        onTokenReceived(data.token || data.captcha_token);
      } else if (data.action === 'verify' || data.type === 'token') {
        console.log('[hCaptcha] Token received:', data.token);
        onTokenReceived(data.token);
      } else if (['cancel', 'error', 'expired'].includes(data.action)) {
        console.log('[hCaptcha] Error:', data.action);
        onError?.(data.action);
      }
    } catch (error) {
      console.error('[hCaptcha] Message handling error:', error);
    }
  };

  return (
    <View style={styles.wrapper}>
      <HCaptcha
        ref={hcaptchaRef}
        siteKey={siteKey}
        baseUrl="https://fluxer.app"
        size="normal"
        theme="light"
        onMessage={handleMessage}
      />
      
      <TouchableOpacity 
        style={styles.button}
        onPress={handleOpen}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>Verify with hCaptcha</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 20,
  },
  button: {
    backgroundColor: '#5865F2',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});