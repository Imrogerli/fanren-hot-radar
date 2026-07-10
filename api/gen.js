// 生成端点：接收提示词+可选垫图（base64/URL数组），转发火山方舟 Seedream
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-token");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (req.headers["x-token"] !== "fanren2026") return res.status(401).json({ error: "unauthorized" });
  if (!process.env.ARK_API_KEY) return res.status(500).json({ error: "ARK_API_KEY not set" });

  const b = req.body || {};
  const payload = {
    model: b.model || "doubao-seedream-4-5-251128",
    prompt: b.prompt || "",
    size: b.size || "1440x2560",
    n: b.n || 1,
    response_format: "url",
    watermark: false,
  };
  if (b.images && b.images.length) payload.image = b.images.length === 1 ? b.images[0] : b.images;

  try {
    const r = await fetch("https://ark.cn-beijing.volces.com/api/v3/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.ARK_API_KEY },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    res.status(r.status).json(j);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
