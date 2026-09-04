import type { Metadata } from 'next';
import OgretmenPanelClient from './OgretmenPanelClient';

export const metadata: Metadata = {
  title: 'Öğretmen Paneli',
  robots: { index: false, follow: false },
};

export default function OgretmenPage() {
  return <OgretmenPanelClient />;
}
