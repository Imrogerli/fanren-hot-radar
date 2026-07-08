// 凡人修仙传专属热点聚合 v2
// 信号源：B站凡人视频（最新/最热）+ 搜索联想热词 + 大盘热榜过滤凡人相关
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FANREN = /凡人修仙|韩立|韩老魔|韩跑跑|南宫婉|紫灵|凌玉灵|厉飞雨|墨大夫|银月|王蝉|董萱儿|陈巧倩|元瑶|火龙|瀚海迷踪|忘语|七玄门|黄枫谷|落云宗|元婴|结婴|青元剑诀|大衍诀/;

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

let BUVID = "";
async function getBuvid() {
  if (BUVID) return BUVID;
  try {
    const j = await fetchJSON("https://api.bilibili.com/x/frontend/finger/spi", { headers: { Referer: "https://www.bilibili.com" } });
    BUVID = (j && j.data && j.data.b_3) || "";
  } catch (e) {}
  return BUVID;
}

async function biliSearch(keyword, order) {
  const buvid = await getBuvid();
  const j = await fetchJSON("https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=" +
    encodeURIComponent(keyword) + "&order=" + order + "&page=1&page_size=42",
    { headers: { Referer: "https://search.bilibili.com", Cookie: buvid ? "buvid3=" + buvid : "" } });
  const list = (j && j.data && j.data.result) || [];
  return list.map(x => ({
    title: (x.title || "").replace(/<[^>]+>/g, ""),
    play: x.play || 0,
    danmaku: x.video_review || 0,
    author: x.author || "",
    tags: x.tag || "",
    pubdate: x.pubdate || 0,
    pic: x.pic || "",
    url: x.arcurl || "https://www.bilibili.com/video/" + x.bvid,
    bvid: x.bvid || ""
  }));
}

async function biliSuggest(term) {
  const j = await fetchJSON("https://s.search.bilibili.com/main/suggest?term=" + encodeURIComponent(term) + "&main_ver=v1",
    { headers: { Referer: "https://www.bilibili.com" } });
  const tags = (j && j.result && j.result.tag) || [];
  return tags.map(t => t.value).filter(Boolean);
}
async function baiduSuggest(term) {
  const j = await fetchJSON("https://www.baidu.com/sugrec?prod=pc&wd=" + encodeURIComponent(term),
    { headers: { Referer: "https://www.baidu.com" } });
  const g = (j && j.g) || [];
  return g.map(x => x.q).filter(Boolean);
}

async function douyinHot() {
  try {
    const j = await fetchJSON("https://aweme.snssdk.com/aweme/v1/hot/search/list/?detail_list=1&device_platform=android&aid=1128&version_code=880");
    return ((j && j.data && j.data.word_list) || []).map((x, i) => ({ rank: i + 1, title: x.word, hot: x.hot_value || 0, src: "抖音热榜" }));
  } catch (e) { return []; }
}
async function weiboHot() {
  try {
    const j = await fetchJSON("https://weibo.com/ajax/side/hotSearch", { headers: { Referer: "https://weibo.com" } });
    return ((j && j.data && j.data.realtime) || []).filter(x => !x.is_ad).map((x, i) => ({ rank: i + 1, title: x.word || x.note, hot: x.num || 0, src: "微博热搜" }));
  } catch (e) { return []; }
}
async function biliHot() {
  try {
    const j = await fetchJSON("https://api.bilibili.com/x/web-interface/popular?ps=30", { headers: { Referer: "https://www.bilibili.com" } });
    return ((j && j.data && j.data.list) || []).map((x, i) => ({ rank: i + 1, title: x.title, hot: (x.stat && x.stat.view) || 0, src: "B站热门" }));
  } catch (e) { return []; }
}

async function safe(p, fallback) { try { return await p; } catch (e) { return fallback; } }

export default async function handler(req, res) {
  const [vNew1, vNew2, vHot, vDm, sg1, sg2, sg3, sg4, dy, wb, bl] = await Promise.all([
    safe(biliSearch("凡人修仙传", "pubdate"), []),
    safe(biliSearch("凡人修仙传 二创", "pubdate"), []),
    safe(biliSearch("凡人修仙传", "click"), []),
    safe(biliSearch("凡人修仙传", "dm"), []),
    safe(biliSuggest("凡人修仙传"), []),
    safe(biliSuggest("韩立"), []),
    safe(baiduSuggest("凡人修仙传"), []),
    safe(baiduSuggest("凡人修仙传 二创"), []),
    douyinHot(), weiboHot(), biliHot()
  ]);

  // 合并去重（最新投稿）
  const seen = new Set();
  const videosNew = [];
  for (const v of [...vNew1, ...vNew2]) {
    if (v.bvid && !seen.has(v.bvid)) { seen.add(v.bvid); videosNew.push(v); }
  }
  videosNew.sort((a, b) => b.pubdate - a.pubdate);

  // 联想热词去重
  const sugSeen = new Set();
  const suggests = [];
  for (const s of [...sg1, ...sg2, ...sg3, ...sg4]) {
    const k = s.trim();
    if (k && !sugSeen.has(k) && k.length <= 20) { sugSeen.add(k); suggests.push(k); }
  }

  // 大盘热榜只保留凡人相关
  const mainstream = [...dy, ...wb, ...bl].filter(x => FANREN.test(x.title));

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  res.status(200).json({
    updatedAt: new Date().toISOString(),
    videosNew: videosNew.slice(0, 60),
    videosHot: vHot.slice(0, 20),
    videosDm: vDm.slice(0, 20),
    suggests: suggests.slice(0, 40),
    mainstream
  });
}
