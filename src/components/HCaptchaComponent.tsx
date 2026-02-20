import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import HCaptcha from '@hcaptcha/react-native-hcaptcha';

interface HCaptchaComponentProps {
  siteKey: string;
  onTokenReceived: (token: string) => void;
  onError?: (error: string) => void;
}

export const HCaptchaComponent: React.FC<HCaptchaComponentProps> = ({
  siteKey,
  onTokenReceived,
  onError
}) => {
  const captchaRef = useRef<HCaptcha>(null);

  const onMessage = (event: any) => {
    if (event && event.nativeEvent.data) {
      if (['cancel', 'error', 'expired'].includes(event.nativeEvent.data.action)) {
        onError?.(event.nativeEvent.data.action);
      } else if (event.nativeEvent.data.action === 'verify') {
        onTokenReceived(event.nativeEvent.data.token);
      }
    }
  };

  return (
    <View style={styles.container}>
      <HCaptcha
        ref={captchaRef}
        siteKey={siteKey}
        size="normal"
        theme="light"
        onMessage={onMessage}
        baseUrl="https://fluxer.app" // Use the main domain
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});