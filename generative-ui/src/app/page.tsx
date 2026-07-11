import { redirect } from 'next/navigation';
import { MuslimBotEcosystem } from '../page-components/MuslimBotEcosystem';

export default function RootPage() {
  // Automatically redirect authenticated sessions to the Command Center
  redirect('/command-center');
}
