import { proxyFetch } from "@/lib/proxyFetch";

export default async function handler(req, res) {
  try {
    const result = await proxyFetch(req, "/api/menu");
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("❌ Proxy error:", err);
    return res.status(500).json({ error: "Proxy request failed" });
  }
}
