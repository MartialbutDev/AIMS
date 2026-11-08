import TermsScreen from '../(student)/settings/terms';
import { goBackFromLegal, PublicLegalPage } from '../../src/components/auth/AuthLegalLinks';

export default function PublicTermsScreen() {
  return <PublicLegalPage><TermsScreen publicAccess onBack={goBackFromLegal} /></PublicLegalPage>;
}
