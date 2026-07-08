// 热点聚合代理：抖音热榜 + B站热门 + B站凡人二创最新投稿
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchJSON(url, opts = {}, timeout = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json", ...(opts.headers || {}) } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function douyinOfficial() {
  const j = await fetchJSON("https://aweme.snssdk.com/aweme/v1/hot/search/list/?detail_list=1&device_platform=android&aid=1128&version_code=880");
  const list = (j && j.data && j.data.word_list) || [];
  if (!list.length) throw new Error("empty");
  return list.map((x, i) => ({ rank: i + 1, title: x.word, hot: x.hot_value || 0,
    url: "https://www.douyin.com/search/" + encodeURIComponent(x.word) }));
}
async function douyinImsyy() {
  const j = await fetchJSON("https://api-hot.imsyy.top/douyin?cache=true");
  const list = (j && j.data) || [];
  if (!list.length) throw new Error("empty");
  return list.map((x, i) => ({ rank: i + 1, title: x.title, hot: x.hot || 0,
    url: x.url || "https://www.douyin.com/search/" + encodeURIComponent(x.title) }));
}
async function douyinVvhan() {
  const j = await fetchJSON("https://api.vvhan.com/api/hotlist/douyinHot");
  const list = (j && j.data) || [];
  if (!list.length) throw new Error("empty");
  return list.map((x, i) => ({ rank: x.index || i + 1, title: x.title, hot: x.hot || 0,
    url: x.url || x.mobil_url || "https://www.douyin.com/search/" + encodeURIComponent(x.title) }));
}

async function weiboOfficial() {
  const j = await fetchJSON("https://weibo.com/ajax/side/hotSearch", { headers: { Referer: "https://weibo.com" } });
  const list = (j && j.data && j.data.realtime) || [];
  if (!list.length) throw new Error("empty");
  return list.filter(x => !x.is_ad).slice(0, 30).map((x, i) => ({ rank: i + 1,
    title: x.word || x.note, hot: x.num || 0,
    url: "https://s.weibo.com/weibo?q=" + encodeURIComponent("#" + (x.word || x.note) + "#") }));
}
async function weiboImsyy() {
  const j = await fetchJSON("https://api-hot.imsyy.top/weibo?cache=true");
  const list = (j && j.data) || [];
  if (!list.length) throw new Error("empty");
  return list.map((x, i) => ({ rank: i + 1, title: x.title, hot: x.hot || 0, url: x.url }));
}

async function biliPopular() {
  const j = await fetchJSON("https://api.bilibili.com/x/web-interface/popular?ps=30", { headers: { Referer: "https://www.bilibili.com" } });
  const list = (j && j.data && j.data.list) || [];
  if (!list.length) throw new Error("empty");
  return list.map((x, i) => ({ rank: i + 1, title: x.title, hot: (x.stat && x.stat.view) || 0,
    author: (x.owner && x.owner.name) || "", url: x.short_link_v2 || "https://www.bilibili.com/video/" + x.bvid }));
}
async function biliImsyy() {
  const j = await fetchJSON("https://api-hot.imsyy.top/bilibili?cache=true");
  const list = (j && j.data) || [];
  if (!list.length) throw new Error("empty");
  return list.map((x, i) => ({ rank: i + 1, title: x.title, hot: x.hot || 0, url: x.url }));
}

async function getBuvid() {
  try {
    const j = await fetchJSON("https://api.bilibili.com/x/frontend/finger/spi", { headers: { Referer: "https://www.bilibili.com" } });
    return (j && j.data && j.data.b_3) || "";
  } catch (e) { return ""; }
}
async function biliFanrenSearch(order) {
  const buvid = await getBuvid();
  const j = await fetchJSON("https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=" +
    encodeURIComponent("凡人修仙传 二创") + "&order=" + order + "&page=1&page_size=20",
    { headers: { Referer: "https://search.bilibili.com", Cookie: buvid ? "buvid3=" + buvid : "" } });
  const list = (j && j.data && j.data.result) || [];
  if (!list.length) throw new Error("empty");
  return list.map((x, i) => ({ rank: i + 1, title: (x.title || "").replace(/<[^>]+>/g, ""),
    hot: x.play || 0, author: x.author || "",
    time: x.pubdate ? new Date(x.pubdate * 1000).toISOString() : "",
    url: x.arcurl || "https://www.bilibili.com/video/" + x.bvid }));
}

async function firstOk(fns) {
  const errors = [];
  for (const fn of fns) {
    try { return { ok: true, list: await fn() }; }
    catch (e) { errors.push(String(e && e.message ? e.message : e)); }
  }
  return { ok: false, list: [], errors };
}

export default async function handler(req, res) {
  const [douyin, weibo, bili, fanrenNew, fanrenHot] = await Promise.all([
    firstOk([douyinOfficial, douyinImsyy, douyinVvhan]),
    firstOk([weiboOfficial, weiboImsyy]),
    firstOk([biliPopular, biliImsyy]),
    firstOk([() => biliFanrenSearch("pubdate")]),
    firstOk([() => biliFanrenSearch("click")]),
  ]);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.status(200).json({ updatedAt: new Date().toISOString(), douyin, weibo, bili, fanrenNew, fanrenHot });
}
