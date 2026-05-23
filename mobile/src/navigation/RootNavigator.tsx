import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../store/auth.store';
import { AuthNavigator }      from './AuthNavigator';
import { PassengerNavigator } from './PassengerNavigator';
import { DriverNavigator }    from './DriverNavigator';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Text style={styles.logo}>AUTIGRES</Text>
      <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
    </View>
  );
}

export function RootNavigator() {
  const { isAuthenticated, isRestoring, user, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (isRestoring) return <SplashScreen />;

  let Navigator: React.ComponentType;
  if (!isAuthenticated) {
    Navigator = AuthNavigator;
  } else if (user?.role === 'driver') {
    Navigator = DriverNavigator;
  } else {
    Navigator = PassengerNavigator;
  }

  return (
    <NavigationContainer>
      <Navigator />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    ...Typography.h1,
    color: Colors.primary,
    letterSpacing: 4,
    fontSize: 36,
  },
});
