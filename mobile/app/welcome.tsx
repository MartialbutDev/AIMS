import { useLocalSearchParams } from 'expo-router';
import WelcomeTour from '../src/components/WelcomeTour';

export default function WelcomeScreen() {
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  return <WelcomeTour replaying={replay === '1'} />;
}
