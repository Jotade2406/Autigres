import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { DriverHomeScreen }        from '../screens/driver/DriverHomeScreen';
import { DriverHistoryScreen }     from '../screens/driver/DriverHistoryScreen';
import { ActiveTripDriverScreen }  from '../screens/driver/ActiveTripDriverScreen';
import { RegisterVehicleScreen }   from '../screens/driver/RegisterVehicleScreen';
import { TripCompletionScreen }    from '../screens/driver/TripCompletionScreen';
import { ProfileScreen }           from '../screens/ProfileScreen';
import { Colors } from '../theme/colors';

export type DriverTabParamList = {
  DriverHomeTab:    undefined;
  DriverHistoryTab: undefined;
  ProfileTab:       undefined;
};

export type DriverStackParamList = {
  Tabs:             undefined;
  ActiveTripDriver: { tripUuid: string };
  RegisterVehicle: {
    vehicleId?: number;
    plateNumber?: string;
    brand?: string;
    model?: string;
    year?: string;
    color?: string;
    capacity?: string;
  } | undefined;
  TripCompletion:   { fare: number; paymentMethod: string; isPooled: boolean; tripUuid?: string; passengerUuid?: string; passengerName?: string };
};

const Tab   = createBottomTabNavigator<DriverTabParamList>();
const Stack = createNativeStackNavigator<DriverStackParamList>();

function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textLow,
        tabBarLabel: ({ color }) => {
          const labels: Record<string, string> = {
            DriverHomeTab:    'Inicio',
            DriverHistoryTab: 'Historial',
            ProfileTab:       'Perfil',
          };
          return <Text style={{ color, fontSize: 11 }}>{labels[route.name]}</Text>;
        },
        tabBarIcon: ({ color }) => {
          const icons: Record<string, string> = {
            DriverHomeTab: '🚗', DriverHistoryTab: '📋', ProfileTab: '👤',
          };
          return <Text style={{ fontSize: 20 }}>{icons[route.name]}</Text>;
        },
      })}
    >
      <Tab.Screen name="DriverHomeTab"    component={DriverHomeScreen} />
      <Tab.Screen name="DriverHistoryTab" component={DriverHistoryScreen} />
      <Tab.Screen name="ProfileTab"       component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function DriverNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bgPrimary },
      }}
    >
      <Stack.Screen name="Tabs"             component={DriverTabs} />
      <Stack.Screen name="ActiveTripDriver" component={ActiveTripDriverScreen} />
      <Stack.Screen name="RegisterVehicle"  component={RegisterVehicleScreen} />
      <Stack.Screen name="TripCompletion"   component={TripCompletionScreen} />
    </Stack.Navigator>
  );
}
