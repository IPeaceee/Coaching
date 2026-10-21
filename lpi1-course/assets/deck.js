/* LPI-1 course deck — navigation, terminal formatting, presenter helpers. No dependencies. */
(function () {
  "use strict";
  var root = document.documentElement;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // ---------- theme ----------
  var savedTheme = store.get("lpi1-theme");
  if (savedTheme) root.dataset.theme = savedTheme;
  function isDark() {
    if (root.dataset.theme) return root.dataset.theme === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function toggleTheme() {
    var next = isDark() ? "light" : "dark";
    root.dataset.theme = next;
    store.set("lpi1-theme", next);
  }
  window.lpiToggleTheme = toggleTheme;

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // ---------- terminal blocks ----------
  // Line conventions inside <pre class="term">:
  //   "$ cmd" / "# cmd"            -> prompt + command (# = root)
  //   "[user@host dir]$ cmd"       -> custom prompt (also "PS C:\>" and "sftp>")
  //   "## text"                    -> comment line
  //   "\text"                      -> literal output line (escape a leading # or $)
  //   anything else                -> output
  // A trailing "  # comment" on a command line is styled as a comment and not copied.
  function formatTerminals(scope) {
    var pres = (scope || document).querySelectorAll("pre.term");
    Array.prototype.forEach.call(pres, function (pre) {
      if (pre.dataset.done) return;
      pre.dataset.done = "1";
      var raw = pre.innerHTML.replace(/^\n+/, "").replace(/\s+$/, "");
      var cont = false;    // previous command ended with "\" -> this line continues it
      var heredoc = null;  // terminator word of an open "<< EOF" block
      var html = raw.split("\n").map(function (line) {
        if (heredoc) {
          if (line.trim() === heredoc) heredoc = null;
          return '<span class="ln"><span class="cmd">' + line + "</span></span>";
        }
        if (cont) {
          cont = /\\$/.test(line);
          return '<span class="ln"><span class="cmd">' + line + "</span></span>";
        }
        var m = line.match(/^(\[[^\]]*\][$#]|[$#]|PS [A-Z]:[^ ]*?&gt;|sftp&gt;) (.*)$/);
        if (m) {
          cont = /\\$/.test(m[2]);
          var hd = m[2].match(/&lt;&lt;-?\s*'?(\w+)'?\s*$/);
          if (hd) heredoc = hd[1];
          var rootPrompt = m[1].charAt(m[1].length - 1) === "#";
          var cmd = m[2], note = "";
          var c = cmd.match(/^(.*?\S)(\s{2,}#\s.*)$/);
          if (c) { cmd = c[1]; note = '<span class="note">' + c[2] + "</span>"; }
          return '<span class="ln"><span class="pr' + (rootPrompt ? " root" : "") + '">' + m[1] +
            '</span> <span class="cmd">' + cmd + "</span>" + note + "</span>";
        }
        if (/^## /.test(line)) return '<span class="ln note"># ' + line.slice(3) + "</span>";
        if (line.charAt(0) === "\\") line = line.slice(1);
        return '<span class="ln out">' + line + "</span>";
      }).join("");
      pre.innerHTML = html;
      if (pre.querySelector(".cmd")) {
        var btn = document.createElement("button");
        btn.className = "copy"; btn.type = "button"; btn.textContent = "Copy";
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var text = Array.prototype.map.call(pre.querySelectorAll(".cmd"), function (n) { return n.textContent; }).join("\n");
          var done = function () { btn.textContent = "Đã copy"; btn.classList.add("ok"); setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("ok"); }, 1400); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
          else { fallbackCopy(text); done(); }
        });
        pre.appendChild(btn);
      }
    });
    Array.prototype.forEach.call((scope || document).querySelectorAll("pre.file[data-file]"), function (pre) {
      if (pre.parentNode.tagName === "FIGURE") return;
      var fig = document.createElement("figure");
      fig.className = "filebox";
      var cap = document.createElement("figcaption");
      cap.innerHTML = esc(pre.dataset.file);
      pre.parentNode.insertBefore(fig, pre);
      fig.appendChild(cap); fig.appendChild(pre);
    });
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ---------- deck ----------
  function initDeck() {
    var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    if (!slides.length) return;
    document.body.classList.add("deck-body");
    var cur = 0;

    function fit() {
      var s = Math.min(window.innerWidth / 1300, window.innerHeight / 740);
      root.style.setProperty("--scale", s.toFixed(4));
    }

    // HUD
    var progress = document.createElement("div"); progress.id = "progress";
    var hud = document.createElement("div"); hud.id = "hud";
    var home = document.body.dataset.home || "index.html";
    // Previous / next lesson, derived from the "buoi-NN.html" file name.
    var LESSON_COUNT = 14;
    var lesson = parseInt((location.pathname.match(/buoi-(\d+)\.html$/) || [])[1], 10);
    function lessonLink(n, label) {
      if (isNaN(lesson) || n < 1 || n > LESSON_COUNT) return "";
      var nn = (n < 10 ? "0" : "") + n;
      return '<a href="buoi-' + nn + '.html" title="' + label + " (buổi " + nn + ')">' +
        (n < lesson ? "« " + nn : nn + " »") + "</a>";
    }
    hud.innerHTML =
      lessonLink(lesson - 1, "Buổi trước") +
      '<a href="' + home + '" title="Lộ trình khóa học">Lộ trình</a>' +
      lessonLink(lesson + 1, "Buổi sau") +
      '<button type="button" data-act="toc" title="Danh sách slide (M)">☰</button>' +
      '<button type="button" data-act="prev" title="Slide trước (←)">‹</button>' +
      '<span class="count"></span>' +
      '<button type="button" data-act="next" title="Slide sau (→)">›</button>' +
      '<button type="button" data-act="notes" title="Ghi chú giảng viên (N)">N</button>' +
      '<button type="button" data-act="theme" title="Sáng / tối (D)">◐</button>' +
      '<button type="button" data-act="full" title="Toàn màn hình (F)">⛶</button>' +
      '<button type="button" data-act="help" title="Phím tắt (?)">?</button>';
    document.body.appendChild(progress);
    document.body.appendChild(hud);
    var count = hud.querySelector(".count");

    // TOC panel
    var toc = document.createElement("nav"); toc.id = "toc"; toc.className = "panel";
    var ol = document.createElement("ol");
    slides.forEach(function (s, i) {
      var h = s.dataset.title || (s.querySelector("h1,h2") ? s.querySelector("h1,h2").textContent : "Slide " + (i + 1));
      var li = document.createElement("li");
      li.textContent = h.replace(/\s+/g, " ").trim();
      li.addEventListener("click", function () { go(i); toggle(toc, false); });
      ol.appendChild(li);
    });
    toc.innerHTML = "<h4>" + esc(document.title) + "</h4>";
    toc.appendChild(ol);
    document.body.appendChild(toc);

    // notes panel
    var notes = document.createElement("div"); notes.id = "notesPanel"; notes.className = "panel";
    document.body.appendChild(notes);

    // help panel
    var help = document.createElement("div"); help.id = "help"; help.className = "panel";
    help.innerHTML = "<table>" +
      "<tr><td><kbd>→</kbd> <kbd>Space</kbd> <kbd>PgDn</kbd></td><td>Slide sau</td></tr>" +
      "<tr><td><kbd>←</kbd> <kbd>PgUp</kbd></td><td>Slide trước</td></tr>" +
      "<tr><td><kbd>Home</kbd> / <kbd>End</kbd></td><td>Slide đầu / cuối</td></tr>" +
      "<tr><td><kbd>F</kbd></td><td>Toàn màn hình</td></tr>" +
      "<tr><td><kbd>M</kbd></td><td>Danh sách slide</td></tr>" +
      "<tr><td><kbd>N</kbd></td><td>Ghi chú giảng viên</td></tr>" +
      "<tr><td><kbd>A</kbd></td><td>Mở / đóng đáp án trên slide</td></tr>" +
      "<tr><td><kbd>D</kbd></td><td>Giao diện sáng / tối</td></tr>" +
      "<tr><td><kbd>Ctrl</kbd>+<kbd>P</kbd></td><td>In / xuất PDF</td></tr>" +
      "</table>";
    document.body.appendChild(help);

    function toggle(panel, force) {
      var open = typeof force === "boolean" ? force : !panel.classList.contains("open");
      panel.classList.toggle("open", open);
      if (panel === notes && open) renderNotes();
    }
    function renderNotes() {
      var aside = slides[cur].querySelector(".notes");
      notes.innerHTML = "<h4>Ghi chú giảng viên · slide " + (cur + 1) + "</h4>" +
        (aside ? aside.innerHTML : '<span class="muted">Không có ghi chú cho slide này.</span>');
    }

    // Shrink wide code blocks until they fit their column; wrap as a last resort.
    function fitPres(slide) {
      Array.prototype.forEach.call(slide.querySelectorAll("pre"), function (pre) {
        if (pre.dataset.fitted || !pre.clientWidth) return;
        pre.dataset.fitted = "1";
        var fs = parseFloat(getComputedStyle(pre).fontSize);
        while (pre.scrollWidth > pre.clientWidth + 1 && fs > 13) {
          fs -= 0.5;
          pre.style.fontSize = fs + "px";
        }
        if (pre.scrollWidth > pre.clientWidth + 1) pre.style.whiteSpace = "pre-wrap";
      });
    }

    function go(n) {
      cur = Math.max(0, Math.min(slides.length - 1, n));
      slides.forEach(function (s, i) { s.classList.toggle("active", i === cur); });
      fitPres(slides[cur]);
      slides[cur].scrollTop = 0;
      count.textContent = (cur + 1) + " / " + slides.length;
      progress.style.width = ((cur + 1) / slides.length * 100) + "%";
      Array.prototype.forEach.call(ol.children, function (li, i) { li.classList.toggle("cur", i === cur); });
      if (notes.classList.contains("open")) renderNotes();
      try { history.replaceState(null, "", "#" + (cur + 1)); } catch (e) {}
    }
    function fromHash() {
      var n = parseInt((location.hash || "").replace(/[^0-9]/g, ""), 10);
      return isNaN(n) ? 0 : n - 1;
    }
    function fullscreen() {
      if (!document.fullscreenElement) { if (root.requestFullscreen) root.requestFullscreen(); }
      else if (document.exitFullscreen) document.exitFullscreen();
    }
    function toggleAnswers() {
      var ds = slides[cur].querySelectorAll("details");
      if (!ds.length) return;
      var anyClosed = Array.prototype.some.call(ds, function (d) { return !d.open; });
      Array.prototype.forEach.call(ds, function (d) { d.open = anyClosed; });
    }

    hud.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var a = b.dataset.act;
      if (a === "prev") go(cur - 1);
      else if (a === "next") go(cur + 1);
      else if (a === "toc") toggle(toc);
      else if (a === "notes") toggle(notes);
      else if (a === "theme") toggleTheme();
      else if (a === "full") fullscreen();
      else if (a === "help") toggle(help);
    });

    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      var k = e.key;
      if (k === " " && tag === "summary") return;
      if (k === "ArrowRight" || k === "PageDown" || k === " " || k === "ArrowDown") { e.preventDefault(); go(cur + 1); }
      else if (k === "ArrowLeft" || k === "PageUp" || k === "ArrowUp") { e.preventDefault(); go(cur - 1); }
      else if (k === "Home") go(0);
      else if (k === "End") go(slides.length - 1);
      else if (k === "f" || k === "F") fullscreen();
      else if (k === "m" || k === "M") toggle(toc);
      else if (k === "n" || k === "N") toggle(notes);
      else if (k === "d" || k === "D") toggleTheme();
      else if (k === "a" || k === "A") toggleAnswers();
      else if (k === "?") toggle(help);
      else if (k === "Escape") { toggle(toc, false); toggle(notes, false); toggle(help, false); }
    });

    var tx = null;
    document.addEventListener("touchstart", function (e) { tx = e.touches[0].clientX; }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (tx === null) return;
      var dx = e.changedTouches[0].clientX - tx; tx = null;
      if (Math.abs(dx) > 60) go(cur + (dx < 0 ? 1 : -1));
    });

    var idle;
    document.addEventListener("mousemove", function () {
      hud.classList.add("show");
      clearTimeout(idle);
      idle = setTimeout(function () { hud.classList.remove("show"); }, 2200);
    });

    document.addEventListener("toggle", function (e) {
      if (e.target.tagName === "DETAILS") fitPres(slides[cur]);
    }, true);
    window.addEventListener("resize", fit);
    window.addEventListener("hashchange", function () { var n = fromHash(); if (n !== cur) go(n); });
    fit();
    // Authoring aid: open the deck with ?check to list slides whose content overflows.
    if (/[?&]check\b/.test(location.search)) {
      var report = [];
      slides.forEach(function (s, i) {
        go(i);
        var extra = s.scrollHeight - s.clientHeight;
        if (extra > 2) report.push("slide " + (i + 1) + " overflows by " + extra + "px");
        Array.prototype.forEach.call(s.querySelectorAll("pre"), function (p) {
          if (p.style.whiteSpace === "pre-wrap") {
            var longest = p.textContent.split("\n").reduce(function (a, b) { return b.length > a.length ? b : a; }, "");
            report.push("slide " + (i + 1) + " wrapped: " + longest.trim().slice(0, 70).replace(/"/g, "'"));
          }
        });
      });
      document.body.setAttribute("data-check", report.join(" | ") || "ok");
    }
    go(fromHash());
  }

  function init() {
    formatTerminals(document);
    initDeck();
    var tb = document.querySelector("[data-toggle-theme]");
    if (tb) tb.addEventListener("click", toggleTheme);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
