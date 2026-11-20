import { router } from 'expo-router';
import React from 'react';
import { Button, Card, Chip, EmptyState, ListItem, Screen } from '../components/ui';
import { currentOdometer } from '../lib/lifespan';
import { km } from '../lib/format';
import { useVehicleStore } from '../store/vehicles';
import { colors } from '../theme';

export default function VehiclesScreen() {
  const { vehicles, activeId, setActive } = useVehicleStore();

  return (
    <Screen>
      {vehicles.length === 0 ? (
        <EmptyState icon="garage-variant" title="Belum ada kendaraan" />
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {vehicles.map((v) => {
            const active = v.id === (activeId ?? vehicles[0]?.id);
            return (
              <ListItem
                key={v.id}
                icon={v.type === 'motor' ? 'motorbike' : 'car-side'}
                iconColor={active ? colors.accent : colors.ink2}
                iconBg={active ? colors.accentSoft : colors.bg}
                title={v.name}
                subtitle={`${v.plate} · ${km(currentOdometer(v))}`}
                right={active ? <Chip text="Aktif" color={colors.accent} bg={colors.accentSoft} /> : undefined}
                onPress={() => {
                  setActive(v.id);
                  router.back();
                }}
                onLongPress={() => router.push({ pathname: '/vehicle/edit', params: { id: v.id } })}
                chevron
              />
            );
          })}
        </Card>
      )}
      <Button title="Tambah Kendaraan" icon="plus" onPress={() => router.push('/vehicle/edit')} />
      {vehicles.length ? (
        <Button
          title="Edit kendaraan aktif"
          variant="ghost"
          onPress={() => router.push({ pathname: '/vehicle/edit', params: { id: activeId ?? vehicles[0].id } })}
          style={{ marginTop: 8 }}
        />
      ) : null}
    </Screen>
  );
}
