import { NextResponse } from 'next/server';

// Android Trusted Web Activity (TWA) Digital Asset Links doğrulaması.
// Firebase App Hosting'de 2 segmentli /.well-known/assetlinks.json isteği statik public/ yerine
// app/[gradeSlug]/[lessonSlug] dinamik rotasına düşüp HTML ("Ders bulunamadı") döndürdüğü için
// Chrome Custom Tabs üstteki mavi adres çubuğunu gizleyemiyordu (bkz. app/icons/[file]/route.ts ile aynı kök neden).
const ASSET_LINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'net.derstakip.app',
      sha256_cert_fingerprints: [
        '7D:3F:0A:79:09:FD:82:55:E2:88:65:C7:C9:D3:35:D8:49:4D:B2:F9:AA:41:59:BF:ED:6B:E9:36:A4:C6:5E:6C',
        'E3:B7:3B:8F:3A:49:63:4E:2B:79:CA:74:79:2E:13:AA:B3:FB:DB:FA:6B:81:65:1D:A9:85:3E:22:E2:42:AF:17',
      ],
    },
  },
];

export function GET() {
  return NextResponse.json(ASSET_LINKS, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
