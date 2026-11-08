import PrivacyPolicyScreen from '../(student)/settings/privacy-policy';
import { goBackFromLegal, PublicLegalPage } from '../../src/components/auth/AuthLegalLinks';

export default function PublicPrivacyScreen() {
  return <PublicLegalPage><PrivacyPolicyScreen onBack={goBackFromLegal} /></PublicLegalPage>;
}
