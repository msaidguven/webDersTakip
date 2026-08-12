import { structuredData, educationalAppData } from "../../metadata";

// Sunucuda render edilir (client Script + afterInteractive KULLANMA): arama motorları
// JSON-LD'yi JS çalıştırmadan, ilk HTML yanıtında görebilmeli.
export function StructuredData() {
  return (
    <>
      <script
        id="structured-data-website"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <script
        id="structured-data-app"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(educationalAppData),
        }}
      />
    </>
  );
}