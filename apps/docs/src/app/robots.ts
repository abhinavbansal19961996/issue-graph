import type { MetadataRoute } from "next";
import { canonicalUrl, isPreview } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return isPreview
    ? { rules: { userAgent: "*", disallow: "/" } }
    : {
        rules: { userAgent: "*", allow: "/", disallow: "/api/" },
        sitemap: canonicalUrl("/sitemap.xml"),
      };
}
