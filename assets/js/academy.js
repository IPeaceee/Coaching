/* Coaching Academy — theme toggle and course catalog rendered from courses.json. No dependencies. */
(function () {
  "use strict";
  var root = document.documentElement;
  var THEME_KEY = "coaching-theme";

  // ---------- theme ----------
  function isDark() {
    if (root.dataset.theme) return root.dataset.theme === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function toggleTheme() {
    var next = isDark() ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-theme]"), function (b) {
    b.addEventListener("click", toggleTheme);
  });

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  var grid = document.getElementById("courseGrid");
  if (!grid) return;

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Course paths must stay relative to the site root so the site works under any base path
  // (e.g. /Coaching/ on GitHub Pages, / on a custom domain, or a local server).
  function safePath(p) {
    p = String(p || "");
    return /^(\/|[a-z][a-z0-9+.-]*:)/i.test(p) ? "" : p;
  }
  // "lpi1-course/" -> "lpi1-course/index.html" so links also open from the file system.
  function entry(p) { return /\/$/.test(p) ? p + "index.html" : p; }
  function safeColor(c) { return /^#[0-9a-f]{3,8}$/i.test(c || "") ? c : ""; }

  var STATUS = {
    "published": { show: true, link: true },
    "coming-soon": { show: true, link: false }
    // anything else (e.g. "draft") is hidden from the catalog
  };

  // ---------- render ----------
  function card(c) {
    var st = STATUS[c.status];
    var href = st.link ? entry(safePath(c.path)) : "";
    var color = safeColor(c.color);
    var meta = [];
    if (c.modules) meta.push("<span><b>" + esc(c.modules) + "</b> module</span>");
    if (c.lessons) meta.push("<span><b>" + esc(c.lessons) + "</b> bài học</span>");
    if (c.duration) meta.push("<span><b>" + esc(c.duration) + "</b></span>");
    if (c.level) meta.push("<span>" + esc(c.level) + "</span>");
    var tags = (c.tags || []).concat(c.highlights || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
    var extra = st.link ? (c.links || []).map(function (l) {
      var p = safePath(l.path);
      return p ? '<a class="btn ghost sm" href="' + esc(p) + '">' + esc(l.label) + "</a>" : "";
    }).join("") : "";
    var thumbInner = (st.link ? "" : '<span class="badge soon">Sắp ra mắt</span>') +
      '<span class="glyph">' + esc(c.glyph || (c.title || "?").charAt(0)) + "</span>";

    return '<article class="card' + (st.link ? "" : " soon") + '"' + (color ? ' style="--c:' + color + '"' : "") + ">" +
      (st.link
        ? '<a class="thumb" href="' + esc(href) + '" tabindex="-1" aria-hidden="true">' + thumbInner + "</a>"
        : '<div class="thumb" aria-hidden="true">' + thumbInner + "</div>") +
      '<div class="card-body">' +
        "<div><h3>" + (st.link ? '<a href="' + esc(href) + '">' + esc(c.title) + "</a>" : esc(c.title)) + "</h3>" +
        (c.subtitle ? '<p class="sub">' + esc(c.subtitle) + "</p>" : "") + "</div>" +
        (c.description ? '<p class="desc">' + esc(c.description) + "</p>" : "") +
        (meta.length ? '<div class="meta">' + meta.join("") + "</div>" : "") +
        (tags ? '<div class="tags">' + tags + "</div>" : "") +
        '<div class="card-actions">' +
          (st.link
            ? '<a class="btn sm" href="' + esc(href) + '">Bắt đầu học <span aria-hidden="true">→</span></a>' + extra
            : '<span class="btn sm ghost" aria-disabled="true">Đang biên soạn</span>') +
        "</div>" +
      "</div></article>";
  }

  function renderStats(list) {
    var pub = list.filter(function (c) { return c.status === "published"; });
    var sum = function (k) { return pub.reduce(function (a, c) { return a + (Number(c[k]) || 0); }, 0); };
    var items = [["Khóa học", pub.length], ["Module", sum("modules")], ["Bài học", sum("lessons")]];
    var dl = document.getElementById("stats");
    dl.innerHTML = items.map(function (it) { return "<div><dt>" + it[0] + "</dt><dd>" + it[1] + "</dd></div>"; }).join("");
    dl.hidden = false;
  }

  function renderTerminal(list) {
    var pre = document.getElementById("termBody");
    if (!pre) return;
    var lines = ['<span class="p">$</span> ls coaching/'];
    lines.push(list.map(function (c) { return '<span class="d">' + esc(c.id) + "/</span>"; }).join("  ") || '<span class="o">(trống)</span>');
    var first = list.filter(function (c) { return c.status === "published"; })[0];
    if (first) {
      lines.push('<span class="p">$</span> cat ' + esc(first.id) + "/README");
      lines.push('<span class="o">' + esc(first.title) + " — " + esc(first.subtitle || "") + "</span>");
      lines.push('<span class="o">' + esc(first.modules) + " module · " + esc(first.lessons) + " bài học · " + esc(first.duration || "") + "</span>");
    }
    lines.push('<span class="c"># sắp có thêm khóa học mới…</span>');
    lines.push('<span class="p">$</span> <span class="cur"></span>');
    pre.innerHTML = lines.join("\n");
  }

  function render(data) {
    var list = (data && data.courses || []).filter(function (c) { return c && STATUS[c.status]; });
    grid.innerHTML = list.length ? list.map(card).join("") : '<p class="notice">Chưa có khóa học nào được xuất bản.</p>';
    var n = list.filter(function (c) { return c.status === "published"; }).length;
    document.getElementById("courseCount").textContent = n + " khóa học đang mở";
    renderStats(list);
    renderTerminal(list);
  }

  function fail() {
    grid.innerHTML = '<p class="notice">Không tải được danh sách khóa học (courses.json). ' +
      "Nếu bạn đang mở file trực tiếp từ ổ đĩa, hãy chạy một web server cục bộ, ví dụ <code>python -m http.server</code>, " +
      'hoặc vào thẳng khóa <a href="lpi1-course/index.html">Linux LPIC-1</a>.</p>';
  }

  if (!window.fetch) { fail(); return; }
  fetch("courses.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(render, fail);
})();
