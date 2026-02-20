import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { GoogleRecaptcha } from '../components/GoogleRecaptcha';
import { Screen } from '../components/Screen';

const HCAPTCHA_SITE_KEY = '9cbad400-df84-4e0c-bda6-e65000be78aa';

type LoginStep = 'credentials' | 'captcha' | 'ip-auth';

export const LoginScreen: React.FC<{ onLoginSuccess: () => void }> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<LoginStep>('credentials');
  const [pollCount, setPollCount] = useState(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { 
    login, 
    register, 
    isLoading, 
    captchaToken, 
    setCaptchaToken,
    ipAuthTicket,
    ipAuthEmail,
    pollIpAuthorization,
    resendIpAuthorization,
  } = useContext(AuthContext);

  // Poll IP authorization
  useEffect(() => {
    if (step !== 'ip-auth' || !ipAuthTicket) return;

    const doPoll = async () => {
      try {
        console.log('[LoginScreen] Polling IP authorization...');
        await pollIpAuthorization(ipAuthTicket);
        console.log('[LoginScreen] IP authorization completed!');
        setError('');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        onLoginSuccess();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Polling failed';
        if (errorMsg === 'IP_AUTHORIZATION_REQUIRED') {
          console.log('[LoginScreen] Still waiting for approval...');
        } else {
          console.warn('[LoginScreen] IP authorization polling error:', errorMsg);
        }
        setPollCount(prev => prev + 1);
      }
    };

    // Poll every 2 seconds, but show a message at different intervals
    pollIntervalRef.current = setInterval(doPoll, 2000);
    
    // Do initial poll immediately
    doPoll();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [step, ipAuthTicket, pollIpAuthorization, onLoginSuccess]);

  const handleSubmitCredentials = async () => {
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      if (isRegister) {
        if (!username) {
          setError('Please enter a username');
          return;
        }
        // For registration, we need captcha
        setStep('captcha');
      } else {
        // For login, try without captcha first
        const result = await login(email, password);

        if (result && 'ip_authorization_required' in result && result.ip_authorization_required) {
          setStep('ip-auth');
          return;
        }

        onLoginSuccess();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';

      if (!isRegister && (errorMsg.includes('CAPTCHA_REQUIRED') || errorMsg.includes('CAPTCHA') || errorMsg.includes('Captcha'))) {
        console.log('[LoginScreen] Detected captcha required, moving to captcha step');
        setStep('captcha');
        setError('');
        return;
      }

      setError(errorMsg);
      console.error('Auth error:', err);
    }
  };

  const handleCaptchaToken = (token: string) => {
    console.log('[LoginScreen] Captcha token received:', token);
    setCaptchaToken(token);
    // Auto-submit login with the captcha token
    setTimeout(() => {
      handleSubmitWithCaptcha(token);
    }, 500);
  };

  const handleSubmitWithCaptcha = async (tokenToUse?: string) => {
    setError('');
    
    const tokenForAuth = tokenToUse || captchaToken;
    if (!tokenForAuth) {
      setError('Please complete the captcha verification');
      return;
    }

    try {
      console.log('[LoginScreen] Submitting login with captcha token');
      const result = await login(email, password, tokenForAuth);
      
      if (result && 'ip_authorization_required' in result && result.ip_authorization_required) {
        // IP authorization needed
        setStep('ip-auth');
        setError('');
      } else {
        // Successful login
        onLoginSuccess();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'An error occurred';
      setError(errMsg);
      console.error('Auth error:', err);
    }
  };

  const handleResendIpEmail = async () => {
    try {
      if (!ipAuthTicket) return;
      await resendIpAuthorization(ipAuthTicket);
      Alert.alert('Email Sent', 'Authorization email has been resent to ' + ipAuthEmail);
      setPollCount(0);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to resend email';
      setError(errorMsg);
    }
  };

  const handleBackToLogin = () => {
    setStep('credentials');
    setError('');
    setPollCount(0);
    setCaptchaToken('');
  };

  const handleDemoMode = async () => {
    try {
      await login('demo@example.com', 'demo');
      onLoginSuccess();
    } catch (err) {
      setError('Demo mode failed');
    }
  };

  // Credentials Step
  if (step === 'credentials') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{isRegister ? 'Create Account' : 'Fluxer Login'}</Text>
        
          {error && <Text style={styles.errorMessage}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          editable={!isLoading}
          keyboardType="email-address"
        />

        {isRegister && (
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#999"
            value={username}
            onChangeText={setUsername}
            editable={!isLoading}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleSubmitCredentials}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isRegister ? 'Create Account' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.demoButton, isLoading && styles.buttonDisabled]}
          onPress={handleDemoMode}
          disabled={isLoading}
        >
          <Text style={styles.demoButtonText}>Try Demo Mode</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setIsRegister(!isRegister);
            setError('');
            setCaptchaToken('');
          }}
          disabled={isLoading}
        >
          <Text style={styles.toggleText}>
            {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
          </Text>
        </TouchableOpacity>

          <Text style={styles.infoText}>Connected to: https://api.fluxer.app</Text>
        </ScrollView>
      </Screen>
    );
  }

  // Captcha Step
  if (step === 'captcha') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Verify Your Identity</Text>

          {error && <Text style={styles.errorMessage}>{error}</Text>}

          <Text style={styles.stepDescription}>
            {isRegister
              ? 'Complete verification to create your account'
              : 'Complete verification to continue'}
          </Text>

          <GoogleRecaptcha
            siteKey={HCAPTCHA_SITE_KEY}
            onTokenReceived={handleCaptchaToken}
            onError={(error) => setError('Captcha error: ' + error)}
          />

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#5865F2" />
              <Text style={styles.loadingText}>Logging you in...</Text>
            </View>
          )}

          <TouchableOpacity style={styles.backButton} onPress={handleBackToLogin} disabled={isLoading}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.infoText}>Powered by hCaptcha</Text>
        </ScrollView>
      </Screen>
    );
  }

  // IP Authorization Step
  if (step === 'ip-auth') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Verify Your Device</Text>

          {error && <Text style={styles.errorMessage}>{error}</Text>}

          <View style={styles.emailIcon}>
            <Text style={styles.emailIconText}>📧</Text>
          </View>

          <Text style={styles.stepDescription}>We sent a verification link to:</Text>

          <View style={styles.emailBox}>
            <Text style={styles.emailText}>{ipAuthEmail}</Text>
          </View>

          <Text style={styles.ipAuthInstructions}>
            {pollCount === 0
              ? '✓ Click the link in your email to authorize this device.'
              : `Checking... (${Math.floor(pollCount / 2)}s)`}
          </Text>

          {pollCount > 30 && (
            <Text style={styles.hint}>
              Still waiting? Check your spam folder or try resending the email.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.resendButton, isLoading && styles.buttonDisabled]}
            onPress={handleResendIpEmail}
            disabled={isLoading}
          >
            <Text style={styles.resendButtonText}>Resend Email</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={handleBackToLogin} disabled={isLoading}>
            <Text style={styles.backButtonText}>← Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.infoText}>
            {isLoading ? 'Waiting for approval...' : 'Connection secure via Fluxer'}
          </Text>
        </ScrollView>
      </Screen>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#36393F',
    minHeight: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#fff',
  },
  stepDescription: {
    fontSize: 14,
    color: '#B9BBBE',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  loadingText: {
    color: '#B9BBBE',
    marginTop: 8,
    fontSize: 12,
  },
  errorMessage: {
    backgroundColor: '#ff6b6b',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#40444B',
    color: '#fff',
  },
  button: {
    backgroundColor: '#5865F2',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: '#999',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  demoButton: {
    backgroundColor: '#43B581',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  demoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resendButton: {
    backgroundColor: '#5865F2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  resendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    alignItems: 'center',
    marginTop: 5,
  },
  backButtonText: {
    color: '#B9BBBE',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleText: {
    marginTop: 15,
    textAlign: 'center',
    color: '#5865F2',
    fontSize: 14,
  },
  infoText: {
    marginTop: 15,
    textAlign: 'center',
    color: '#72767D',
    fontSize: 12,
  },
  emailIcon: {
    alignItems: 'center',
    marginVertical: 20,
  },
  emailIconText: {
    fontSize: 48,
  },
  emailBox: {
    backgroundColor: '#40444B',
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    alignItems: 'center',
  },
  emailText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  ipAuthInstructions: {
    color: '#B9BBBE',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 18,
  },
  hint: {
    color: '#FFA500',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 15,
    marginTop: -10,
    fontStyle: 'italic',
  },
});
