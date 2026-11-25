/*! UTM Heatmap tracker v1 */
(function (w, d) {
  var sc = d.currentScript;
  if (!sc || w.__utmhm || w.top !== w) return;
  w.__utmhm = 1;
  var site = sc.getAttribute("data-site-id");
  if (!site) return;
  var api = new URL(sc.src).origin + "/api/track";
  var ls = w.localStorage, ss = w.sessionStorage;
  var rid = function () { return Math.random().toString(36).slice(2) + Date.now().toString(36); };
  var get = function (s, k) { try { return s.getItem(k); } catch (e) { return null; } };
  var set = function (s, k, v) { try { s.setItem(k, v); } catch (e) {} };

  var vid = get(ls, "_hm_v") || rid(); set(ls, "_hm_v", vid);
  var last = +get(ss, "_hm_t") || 0, sid = get(ss, "_hm_s");
  if (!sid || Date.now() - last > 18e5) { sid = rid(); set(ss, "_hm_s", sid); ss && ss.removeItem && ss.removeItem("_hm_u"); }

  var q = new URLSearchParams(location.search), u = {}, has = 0;
  ["source", "medium", "campaign", "term", "content"].forEach(function (k) {
    var v = q.get("utm_" + k); if (v) { u[k] = v.slice(0, 160); has = 1; }
  });
  if (has) set(ss, "_hm_u", JSON.stringify(u)); else { try { u = JSON.parse(get(ss, "_hm_u") || "{}"); } catch (e) { u = {}; } }

  var ua = navigator.userAgent;
  var dev = /ipad|tablet|android(?!.*mobile)/i.test(ua) ? "tablet" : /mobi|iphone|ipod|android/i.test(ua) ? "mobile" : "desktop";
  var path = function () { return location.pathname; };
  var de = d.documentElement;
  var dw = function () { return Math.max(de.scrollWidth, de.clientWidth, 1); };
  var dh = function () { return Math.max(de.scrollHeight, d.body ? d.body.scrollHeight : 0, 1); };
  var r4 = function (n) { return Math.min(1, Math.max(0, Math.round(n * 1e4) / 1e4)); };

  var buf = [], trail = [], t0 = Date.now(), maxS = 0, lastMove = 0, clicks = [];

  function push(e) { e.p = e.p || path(); buf.push(e); if (buf.length >= 40) flush(); }

  function flush() {
    if (trail.length > 1) { buf.push({ t: "move", p: path(), pts: trail.slice(0, 600) }); }
    trail = []; t0 = Date.now();
    if (!buf.length) return;
    set(ss, "_hm_t", String(Date.now()));
    var body = JSON.stringify({ s: site, v: vid, sid: sid, p: path(), r: d.referrer.slice(0, 1000), d: dev, sc: maxS, u: u, e: buf.splice(0, 200) });
    var blob = new Blob([body], { type: "text/plain" });
    if (!(navigator.sendBeacon && navigator.sendBeacon(api, blob))) {
      fetch(api, { method: "POST", body: body, keepalive: true, mode: "cors", headers: { "Content-Type": "text/plain" } }).catch(function () {});
    }
  }

  function scroll() {
    var s = Math.round(((w.scrollY || de.scrollTop) + w.innerHeight) / dh() * 100);
    if (s > maxS) maxS = Math.min(100, s);
  }

  d.addEventListener("click", function (ev) {
    var x = ev.pageX / dw(), y = ev.pageY / dh(), now = Date.now();
    var el = ev.target && ev.target.closest ? ev.target.closest("a,button,[data-track]") : null;
    var label = el ? (el.getAttribute("data-track") || el.getAttribute("aria-label") || (el.textContent || "").trim()).slice(0, 120) : "";
    clicks = clicks.filter(function (c) { return now - c[2] < 700 && Math.abs(c[0] - ev.pageX) < 30 && Math.abs(c[1] - ev.pageY) < 30; });
    clicks.push([ev.pageX, ev.pageY, now]);
    var rage = clicks.length >= 3;
    if (rage) clicks = [];
    push({ t: rage ? "rage" : "click", x: r4(x), y: r4(y), vw: w.innerWidth, dh: dh(), l: label || undefined });
    var conv = ev.target && ev.target.closest ? ev.target.closest("[data-track-conversion]") : null;
    if (conv) push({ t: "conversion", l: (conv.getAttribute("data-track-conversion") || "conversion").slice(0, 120) });
  }, true);

  d.addEventListener("mousemove", function (ev) {
    var now = Date.now();
    if (now - lastMove < 100) return;
    lastMove = now;
    if (trail.length < 600) trail.push([r4(ev.pageX / dw()), r4(ev.pageY / dh()), now - t0]);
  }, { passive: true });

  w.addEventListener("scroll", scroll, { passive: true });

  d.addEventListener("submit", function (ev) {
    var f = ev.target;
    if (f && f.hasAttribute && f.hasAttribute("data-track-conversion")) push({ t: "conversion", l: f.getAttribute("data-track-conversion") || "form_submit" });
  }, true);

  function leave() { scroll(); push({ t: "scroll", y: r4(maxS / 100) }); flush(); }
  d.addEventListener("visibilitychange", function () { if (d.visibilityState === "hidden") leave(); });
  w.addEventListener("pagehide", leave);

  // utmhm("conversion","signup")
  w.utmhm = function (type, label) { if (type === "conversion") { push({ t: "conversion", l: String(label || "conversion").slice(0, 120) }); flush(); } };

  // SPA navigations
  var hp = history.pushState;
  history.pushState = function () { leave(); hp.apply(this, arguments); maxS = 0; setTimeout(function () { scroll(); push({ t: "pageview" }); }, 0); };
  w.addEventListener("popstate", function () { leave(); maxS = 0; push({ t: "pageview" }); });

  scroll();
  push({ t: "pageview" });
  setInterval(flush, 5000);
})(window, document);
