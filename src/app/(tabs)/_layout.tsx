import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import type { ColorValue } from 'react-native';
import { useRecorder } from '../../services/recorder';
import { useTouring } from '../../services/touring/touring';
import { colors } from '../../theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <MaterialCommunityIcons name={name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  const recording = useRecorder((s) => !!s.active);
  const inRoom = useTouring((s) => !!s.roomCode);
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', fontSize: 20 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        headerTintColor: colors.ink,
        tabBarLabelStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda', headerTitle: 'VELIQ', tabBarIcon: icon('home-variant') }} />
      <Tabs.Screen
        name="trip"
        options={{
          title: 'Lacak',
          headerTitle: 'Odometer & Rute',
          tabBarIcon: icon('speedometer'),
          tabBarBadge: recording ? '●' : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.bad, color: '#fff', fontSize: 8 },
        }}
      />
      <Tabs.Screen name="service" options={{ title: 'Servis', headerTitle: 'Kesehatan Kendaraan', tabBarIcon: icon('wrench') }} />
      <Tabs.Screen
        name="touring"
        options={{
          title: 'Touring',
          headerTitle: 'Group Touring Radar',
          tabBarIcon: icon('radar'),
          tabBarBadge: inRoom ? '●' : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.good, color: '#fff', fontSize: 8 },
        }}
      />
      <Tabs.Screen name="more" options={{ title: 'Lainnya', tabBarIcon: icon('dots-grid') }} />
    </Tabs>
  );
}
