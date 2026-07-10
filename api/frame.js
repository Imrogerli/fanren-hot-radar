// 素材帧中转：浏览器POST base64帧 → 存Blob → 返回可访问URL
import { put, list } from "@vercel/blob";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.headers["x-token"] !== "fanren2026") return res.status(401).json({ error: "unauthorized" });

  if (req.method === "GET") {
    const { blobs } = await list({ prefix: "frames/" });
    return res.status(200).json(blobs.map(b => ({ path: b.pathname, url: b.url, size: b.size })));
  }

  const { name, data } = req.body || {};
  if (!name || !data) return res.status(400).json({ error: "need name+data" });
  const b64 = data.replace(/^data:image\/\w+;base64,/, "");
  const buf = Buffer.from(b64, "base64");
  const blob = await put("frames/" + name + ".jpg", buf, {
    access: "public",
    contentType: "image/jpeg",
    allowOverwrite: true,
    addRandomSuffix: false,
  });
  res.status(200).json({ url: blob.url, path: blob.pathname, size: buf.length });
}
