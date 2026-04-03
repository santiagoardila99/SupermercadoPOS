import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import LoginScreen    from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ProductosScreen from './src/screens/ProductosScreen';
import InformesScreen  from './src/screens/InformesScreen';
import { setServerIP } from './src/utils/api';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Tabs principales (gerente) ────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1f2937',
          borderTopColor: '#374151',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
        },
        tabBarActiveTintColor:   '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Dashboard: focused ? 'grid'           : 'grid-outline',
            Productos:  focused ? 'cube'           : 'cube-outline',
            Informes:   focused ? 'bar-chart'      : 'bar-chart-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={24} color={color} />;
        },
      })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen name="Productos" component={ProductosScreen} />
      <Tab.Screen name="Informes"  component={InformesScreen} />
    </Tab.Navigator>
  );
}

// ── App root con verificación de sesión ───────────────────────────────────────
export default function App() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [token, ip] = await Promise.all([
          SecureStore.getItemAsync('pos_token'),
          SecureStore.getItemAsync('server_ip'),
        ]);
        if (ip) setServerIP(ip);
        setLoggedIn(!!token);
      } catch {
        setLoggedIn(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}
        initialRouteName={loggedIn ? 'Main' : 'Login'}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main"  component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
