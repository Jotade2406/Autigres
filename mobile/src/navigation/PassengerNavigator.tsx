import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { HomeScreen }         from '../screens/passenger/HomeScreen';
import { SearchScreen }       from '../screens/passenger/SearchScreen';
import { MapPickerScreen }    from '../screens/passenger/MapPickerScreen';
import { HistoryScreen }      from '../screens/passenger/HistoryScreen';
import { ConfirmTripScreen }  from '../screens/passenger/ConfirmTripScreen';
import { MatchingScreen }     from '../screens/passenger/MatchingScreen';
import { ActiveTripScreen }   from '../screens/passenger/ActiveTripScreen';
import { RatingScreen }         from '../screens/passenger/RatingScreen';
import { CancelledTripScreen }  from '../screens/passenger/CancelledTripScreen';
import { ProfileScreen }        from '../screens/ProfileScreen';
import { Colors } from '../theme/colors';

export type PassengerTabParamList = {
  HomeTab:    undefined;
  HistoryTab: undefined;
  ProfileTab: undefined;
};

export type RoutePoint = { latitude: number; longitude: number };

export type PassengerStackParamList = {
  Tabs:   undefined;
  Search: { originLat: number; originLng: number; originAddress: string };
  MapPicker: { field: 'origin' | 'dest'; initialLat: number; initialLng: number };
  ConfirmTrip: {
    originLat: number; originLng: number; originAddress: string;
    destLat: number;   destLng: number;   destAddress: string;
  };
  Matching: {
    requestUuid:    string;
    routePolyline?: RoutePoint[];
    originAddress?: string;
    destAddress?:   string;
    estimatedFare?: number;
    isShared?:      boolean;
  };
  ActiveTrip:    { tripUuid: string; routePolyline?: RoutePoint[] };
  Rating:        { tripUuid: string; driverUuid: string; driverName?: string; fare?: number; paymentMethod?: string };
  CancelledTrip: {
    routePolyline?: RoutePoint[];
    originAddress?: string;
    destAddress?:   string;
    estimatedFare?: number;
  };
};

const Tab   = createBottomTabNavigator<PassengerTabParamList>();
const Stack = createNativeStackNavigator<PassengerStackParamList>();

function PassengerTabs() {
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
            HomeTab:    'Inicio',
            HistoryTab: 'Historial',
            ProfileTab: 'Perfil',
          };
          return <Text style={{ color, fontSize: 11 }}>{labels[route.name]}</Text>;
        },
        tabBarIcon: ({ color }) => {
          const icons: Record<string, string> = {
            HomeTab: '🗺', HistoryTab: '📋', ProfileTab: '👤',
          };
          return <Text style={{ fontSize: 20 }}>{icons[route.name]}</Text>;
        },
      })}
    >
      <Tab.Screen name="HomeTab"    component={HomeScreen} />
      <Tab.Screen name="HistoryTab" component={HistoryScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function PassengerNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bgPrimary },
      }}
    >
      <Stack.Screen name="Tabs"        component={PassengerTabs} />
      <Stack.Screen name="Search"      component={SearchScreen} />
      <Stack.Screen name="MapPicker"   component={MapPickerScreen} />
      <Stack.Screen name="ConfirmTrip" component={ConfirmTripScreen} />
      <Stack.Screen name="Matching"    component={MatchingScreen} />
      <Stack.Screen name="ActiveTrip"    component={ActiveTripScreen} />
      <Stack.Screen name="Rating"        component={RatingScreen} />
      <Stack.Screen name="CancelledTrip" component={CancelledTripScreen} />
    </Stack.Navigator>
  );
}
