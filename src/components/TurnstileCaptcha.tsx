import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface CaptchaProps {
  siteKey: string;
  onTokenReceived: (token: string) => void;
  onError?: (error: string) => void;
}

export const TurnstileCaptcha: React.FC<CaptchaProps> = ({ siteKey, onTokenReceived, onError }) => {
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const handleOpenCaptcha = () => {
    setShowCaptcha(true);
    setIsLoading(true);
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[TurnstileCaptcha] WebView message:', data);
      
      if (data.type === 'captcha_token') {
        console.log('[TurnstileCaptcha] Got captcha token');
        setToken(data.token);
        onTokenReceived(data.token);
        setShowCaptcha(false);
      } else if (data.type === 'captcha_error') {
        console.error('[TurnstileCaptcha] Captcha error:', data.error);
        onError?.(data.error);
      } else if (data.type === 'captcha_loaded') {
        console.log('[TurnstileCaptcha] Captcha loaded');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[TurnstileCaptcha] Message parse error:', error);
    }
  };

  const captchaHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html, body {
          width: 100%;
          height: 100%;
        }
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          text-align: center;
          max-width: 100%;
        }
        h1 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 24px;
        }
        p {
          color: #666;
          font-size: 14px;
          margin: 0 0 30px 0;
        }
        #captcha-container {
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 20px 0;
          min-height: 90px;
        }
        .loading {
          color: #999;
          font-size: 14px;
        }
        .error {
          color: #ff6b6b;
          font-size: 12px;
          margin-top: 10px;
        }
        .success {
          color: #43B581;
          font-size: 12px;
          margin-top: 10px;
        }
        #status {
          min-height: 20px;
        }
        iframe {
          border: none;
          width: 100%;
          max-width: 300px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Verify Your Identity</h1>
        <p>Complete the Turnstile captcha to continue</p>
        <div id="captcha-container">
          <p class="loading">Loading captcha...</p>
        </div>
        <div id="status"></div>
      </div>

      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
      <script>
        console.log('[Turnstile] Script loaded, initializing...');
        
        let initialized = false;
        let attempts = 0;
        const maxAttempts = 100; // 10 seconds
        
        function initTurnstile() {
          attempts++;
          console.log('[Turnstile] Attempt ' + attempts + ' to initialize');
          
          if (typeof window.turnstile !== 'undefined') {
            if (!initialized) {
              initialized = true;
              console.log('[Turnstile] API available, rendering widget');
              
              try {
                const container = document.getElementById('captcha-container');
                container.innerHTML = '';
                
                window.turnstile.render('#captcha-container', {
                  sitekey: '${siteKey}',
                  theme: 'light',
                  tabindex: 0,
                  callback: function(token) {
                    console.log('[Turnstile] Token callback:', token);
                    document.getElementById('status').innerHTML = '<div class="success">✓ Verified!</div>';
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'captcha_token',
                      token: token
                    }));
                  },
                  'error-callback': function() {
                    console.error('[Turnstile] Error');
                    document.getElementById('status').innerHTML = '<div class="error">Verification failed</div>';
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'captcha_error',
                      error: 'Captcha failed'
                    }));
                  },
                  'expired-callback': function() {
                    console.log('[Turnstile] Expired');
                  }
                });
                console.log('[Turnstile] Render call completed');
              } catch (e) {
                console.error('[Turnstile] Render error:', e.message);
                document.getElementById('status').innerHTML = '<div class="error">Error: ' + e.message + '</div>';
              }
            }
          } else if (attempts < maxAttempts) {
            console.log('[Turnstile] API not ready, waiting...');
            setTimeout(initTurnstile, 100);
          } else {
            console.error('[Turnstile] Failed to load after ' + attempts + ' attempts');
            document.getElementById('captcha-container').innerHTML = '<p class="error">Failed to load widget (timeout)</p>';
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'captcha_error',
              error: 'Widget timeout'
            }));
          }
        }
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'captcha_loaded'
        }));
        
        // Start initialization immediately
        setTimeout(initTurnstile, 100);
      </script>
    </body>
    </html>
  `;

  if (showCaptcha) {
    return (
      <View style={styles.webviewContainer}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading captcha...</Text>
          </View>
        )}
        <WebView
          source={{ html: captchaHTML }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          startInLoadingState={true}
          javaScriptEnabled={true}
          javaScriptCanOpenWindowsAutomatically={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          mixedContentMode="always"
          onLoadEnd={() => setIsLoading(false)}
          onError={(error) => {
            console.error('[TurnstileCaptcha] WebView error:', error);
            const errorMsg = typeof error === 'string' ? error : 'WebView error';
            onError?.(errorMsg);
          }}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#667eea" />
              <Text style={styles.loadingText}>Loading captcha...</Text>
            </View>
          )}
          scalesPageToFit={true}
        />
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setShowCaptcha(false)}
        >
          <Text style={styles.closeButtonText}>✕ Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show button to open captcha
  return (
    <View style={styles.container}>
      {token ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>✓ Captcha Verified</Text>
          <Text style={styles.tokenPreview}>Token: {token.substring(0, 20)}...</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleOpenCaptcha}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              🔒 Complete Captcha Verification
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            Tap to open the Turnstile captcha widget in-app
          </Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
  },
  button: {
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonDisabled: {
    backgroundColor: '#999',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    color: '#B9BBBE',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  successBox: {
    backgroundColor: '#43B581',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  successText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tokenPreview: {
    color: '#fff',
    fontSize: 11,
    marginTop: 5,
    fontFamily: 'monospace',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
    marginVertical: 15,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    minHeight: 500,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 12,
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    backgroundColor: '#ff6b6b',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
