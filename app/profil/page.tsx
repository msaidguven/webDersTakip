import { Suspense } from 'react';
import ProfilClient from './ProfilClient';

export default function ProfilPage() {
  return (
    <Suspense fallback={null}>
      <ProfilClient />
    </Suspense>
  );
}
