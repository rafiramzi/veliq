import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { parseISODate, toISODate } from '../lib/dates';
import { dateID } from '../lib/format';
import { colors } from '../theme';
import { Icon, Label, Muted, styles } from './ui';

export function DateField({
  label,
  value,
  onChange,
  hint,
  optional,
}: {
  label: string;
  value?: string;
  onChange: (iso: string | undefined) => void;
  hint?: string;
  optional?: boolean;
}) {
  const [showIOS, setShowIOS] = useState(false);
  const date = value ? parseISODate(value) : new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        onValueChange: (_e, d) => onChange(toISODate(d)),
      });
    } else {
      setShowIOS((s) => !s);
    }
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      <Pressable onPress={open} style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <Text style={{ fontSize: 16, color: value ? colors.ink : colors.faint }}>{value ? dateID(value) : 'Pilih tanggal'}</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {optional && value ? (
            <Pressable hitSlop={10} onPress={() => onChange(undefined)}>
              <Icon name="close-circle" color={colors.faint} />
            </Pressable>
          ) : null}
          <Icon name="calendar" color={colors.muted} />
        </View>
      </Pressable>
      {hint ? <Muted style={{ marginTop: 4, fontSize: 12 }}>{hint}</Muted> : null}
      {showIOS && Platform.OS === 'ios' ? (
        <DateTimePicker value={date} mode="date" display="inline" onValueChange={(_e, d) => onChange(toISODate(d))} />
      ) : null}
    </View>
  );
}
