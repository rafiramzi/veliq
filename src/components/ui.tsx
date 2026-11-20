import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseNumber } from '../lib/format';
import { colors, levelColor, levelSoft, levelText, radius } from '../theme';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 20, color = colors.ink }: { name: IconName | string; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name as IconName} size={size} color={color} />;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const content = [padded && { padding: 16 }, { paddingBottom: 32 + insets.bottom }, style];
  if (!scroll) return <View style={[styles.screen, ...content]}>{children}</View>;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  dark,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
  onPress?: () => void;
}) {
  const s = [styles.card, dark && styles.cardDark, style];
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...s, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  return <View style={s}>{children}</View>;
}

type TextProps = { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };
export const Title = ({ children, style, numberOfLines }: TextProps) => (
  <Text numberOfLines={numberOfLines} style={[styles.title, style]}>{children}</Text>
);
export const H2 = ({ children, style, numberOfLines }: TextProps) => (
  <Text numberOfLines={numberOfLines} style={[styles.h2, style]}>{children}</Text>
);
export const Body = ({ children, style, numberOfLines }: TextProps) => (
  <Text numberOfLines={numberOfLines} style={[styles.body, style]}>{children}</Text>
);
export const Muted = ({ children, style, numberOfLines }: TextProps) => (
  <Text numberOfLines={numberOfLines} style={[styles.muted, style]}>{children}</Text>
);
export const Label = ({ children, style }: TextProps) => <Text style={[styles.label, style]}>{children}</Text>;

export function Row({ children, style, gap = 8 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export const Spacer = ({ h = 12 }: { h?: number }) => <View style={{ height: h }} />;

type ButtonVariant = 'primary' | 'dark' | 'outline' | 'danger' | 'ghost';
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  small,
  onLongPress,
  delayLongPress,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName | string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
  onLongPress?: () => void;
  delayLongPress?: number;
}) {
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.accent, fg: '#fff', border: colors.accent },
    dark: { bg: colors.navy, fg: '#fff', border: colors.navy },
    outline: { bg: 'transparent', fg: colors.ink, border: colors.border },
    danger: { bg: colors.bad, fg: '#fff', border: colors.bad },
    ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
  };
  const p = palette[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: p.bg, borderColor: p.border },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <Row gap={6} style={{ justifyContent: 'center' }}>
          {icon ? <Icon name={icon} size={small ? 16 : 18} color={p.fg} /> : null}
          <Text style={[styles.btnText, small && { fontSize: 13 }, { color: p.fg }]}>{title}</Text>
        </Row>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  numeric,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string; numeric?: boolean }) {
  return (
    <View style={[{ marginBottom: 12 }, style as StyleProp<ViewStyle>]}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={colors.faint}
        keyboardType={numeric ? 'numeric' : props.keyboardType}
        {...props}
        style={styles.input}
      />
      {hint ? <Muted style={{ marginTop: 4, fontSize: 12 }}>{hint}</Muted> : null}
    </View>
  );
}

/** Input angka dengan teks lokal (koma desimal tidak hilang saat mengetik). */
export function NumberField({
  label,
  value,
  onCommit,
  hint,
  style,
}: {
  label: string;
  value: number | null;
  onCommit: (n: number | null) => void;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [text, setText] = React.useState(value == null ? '' : String(value).replace('.', ','));
  return (
    <Field
      label={label}
      hint={hint}
      value={text}
      numeric
      style={style}
      onChangeText={(t) => {
        setText(t);
        onCommit(t.trim() === '' ? null : parseNumber(t));
      }}
    />
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={[styles.segItem, active && styles.segActive]}>
            <Text style={[styles.segText, active && { color: '#fff' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ProgressBar({ value, color = colors.accent, height = 8 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function LevelBadge({ level, text }: { level: string; text?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: levelSoft(level) }]}>
      <Text style={[styles.badgeText, { color: levelColor(level) }]}>{text ?? levelText(level)}</Text>
    </View>
  );
}

export function Chip({ text, color = colors.ink2, bg = colors.bg }: { text: string; color?: string; bg?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

export function ListItem({
  icon,
  iconColor = colors.ink2,
  iconBg = colors.bg,
  title,
  subtitle,
  right,
  onPress,
  onLongPress,
  chevron,
}: {
  icon?: IconName | string;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  chevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => [styles.listItem, pressed && { backgroundColor: colors.bg }]}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Icon name={icon} color={iconColor} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Body style={{ fontWeight: '600' }} numberOfLines={1}>{title}</Body>
        {subtitle ? <Muted numberOfLines={2}>{subtitle}</Muted> : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron-right" color={colors.faint} /> : null}
    </Pressable>
  );
}

export function StatTile({ label, value, sub, dark }: { label: string; value: string; sub?: string; dark?: boolean }) {
  return (
    <View style={[styles.stat, dark && { backgroundColor: colors.navy2, borderColor: colors.navy2 }]}>
      <Text style={[styles.label, dark && { color: colors.faint }]}>{label}</Text>
      <Text style={[styles.statValue, dark && { color: '#fff' }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={[styles.muted, { fontSize: 12 }]}>{sub}</Text> : null}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 20, marginBottom: 8 }}>
      <Text style={styles.section}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>{action}</Text>
        </Pressable>
      ) : null}
    </Row>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: IconName | string;
  title: string;
  text?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 }}>
      <View style={[styles.iconWrap, { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft }]}>
        <Icon name={icon} size={30} color={colors.accent} />
      </View>
      <H2 style={{ marginTop: 12, textAlign: 'center' }}>{title}</H2>
      {text ? <Muted style={{ textAlign: 'center', marginTop: 4 }}>{text}</Muted> : null}
      {action ? <Button title={action} onPress={onAction} style={{ marginTop: 16 }} /> : null}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 }} />;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardDark: { backgroundColor: colors.navy, borderColor: colors.navy },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, color: colors.ink },
  muted: { fontSize: 13, color: colors.muted },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  section: { fontSize: 13, fontWeight: '800', color: colors.ink2, textTransform: 'uppercase', letterSpacing: 1 },
  btn: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnSmall: { minHeight: 36, paddingHorizontal: 12, borderRadius: radius.sm },
  btnText: { fontSize: 15, fontWeight: '700' },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  segment: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 3 },
  segItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.sm },
  segActive: { backgroundColor: colors.navy },
  segText: { fontWeight: '700', color: colors.ink2, fontSize: 13 },
  track: { backgroundColor: colors.border, overflow: 'hidden', width: '100%' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.md },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
});
