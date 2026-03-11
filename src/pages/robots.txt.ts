import type { APIRoute } from "astro";
import { absoluteUrl } from "../lib/site-config";

export const GET: APIRoute = () => {
  const body = [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${absoluteUrl("/sitemap-index.xml")}`
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
};
