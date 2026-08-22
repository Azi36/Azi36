/* Azi36 家族站点的访问统计。每个产品站引一行：
     <script src="https://azi36.com/assets/hit.js" data-site="design" defer></script>
   data-site 是后端登记的站点键（design / term / im / chain …）。
   同一会话只记一次，人数按 IP 去重由服务端负责；后端不可达就当没发生，页面不受影响。 */
(function () {
  // Next.js 之类用 next/script 注入的场景里 currentScript 为空，退回按 src 找自己
  var s = document.currentScript || document.querySelector('script[src*="assets/hit.js"][data-site]');
  var site = s && s.dataset.site;
  if (!site) return;
  var key = 'azi-hit-' + site;
  try { if (sessionStorage.getItem(key)) return; } catch (e) { /* 隐私模式等：每次都记，无妨 */ }
  fetch('https://api.azi36.com/sites/' + encodeURIComponent(site) + '/hit', { method: 'POST', keepalive: true })
    .then(function () { try { sessionStorage.setItem(key, '1'); } catch (e) {} })
    .catch(function () {});
})();
