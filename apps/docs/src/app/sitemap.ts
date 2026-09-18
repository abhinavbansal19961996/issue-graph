import type { MetadataRoute } from "next";
import { documentationPages } from "@/lib/discovery";
import { landingLastModified } from "@/lib/landing-content";
import { canonicalUrl, isPreview } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  if (isPreview) return [];
  return [
    { url: canonicalUrl("/"), lastModified: landingLastModified },
    ...documentationPages().map((page) => {
      const lastModified =
        "lastModified" in page.data && page.data.lastModified instanceof Date
          ? page.data.lastModified
          : undefined;
      return {
        url: canonicalUrl(page.url),
        ...(lastModified ? { lastModified } : {}),
      };
    }),
  ];
}
