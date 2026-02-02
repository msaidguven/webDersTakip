"use client";

import Script from "next/script";
import { structuredData, educationalAppData } from "../../metadata";

export function StructuredData() {
  return (
    <>
      <Script
        id="structured-data-website"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <Script
        id="structured-data-app"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(educationalAppData),
        }}
      />
    </>
  );
}
