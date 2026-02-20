import React from 'react';
import { SafeAreaView, Platform, StatusBar, StyleProp, ViewStyle } from 'react-native';

type ScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export const Screen: React.FC<ScreenProps> = ({ children, style }) => {
  const androidTopInset = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
  const androidBottomInset = Platform.OS === 'android' ? 16 : 0;

  return (
    <SafeAreaView
      style={[
        {
          flex: 1,
          backgroundColor: '#36393F',
          paddingTop: androidTopInset,
          paddingBottom: androidBottomInset,
        },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
};
