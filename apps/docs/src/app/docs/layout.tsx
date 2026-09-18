import { GeistdocsDocsLayout } from "@vercel/geistdocs/layout";
import type { ReactNode } from "react";
import { config } from "@/lib/geistdocs/config";
import { geistdocsSource } from "@/lib/geistdocs/source";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <GeistdocsDocsLayout
      config={config}
      tree={geistdocsSource.source.getPageTree("en")}
      containerProps={{ className: "mx-auto max-w-[1448px]" }}
    >
      {children}
    </GeistdocsDocsLayout>
  );
}
