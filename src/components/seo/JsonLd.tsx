// Server component. Inlines a schema.org object as a <script type="application/ld+json">.
// JSON.stringify экранирует кавычки внутри строк; jsonld.ts возвращает только
// plain objects, поэтому </script> внутри значений невозможен.

import type { JsonLd as LdObject } from "@/lib/jsonld";

export function JsonLd({ data }: { data: LdObject }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
