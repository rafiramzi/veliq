import { Redirect } from 'expo-router';

// Tujuan deep link `veliq://auth-callback`; token diproses di services/auth.ts.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
