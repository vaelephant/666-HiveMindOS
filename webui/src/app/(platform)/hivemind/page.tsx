import { redirect } from 'next/navigation';
import { HIVEMIND_HOME_PATH } from '@/config/navigation';

export default function HiveMindHomePage() {
  redirect(HIVEMIND_HOME_PATH);
}
