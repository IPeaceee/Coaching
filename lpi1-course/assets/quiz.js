/* Trang trắc nghiệm: chọn bộ đề, làm bài, chấm và giải thích. Dữ liệu từ quiz-data.js. */
(function () {
  "use strict";
  var QUIZ = window.QUIZ || [];
  var OBJ = window.QUIZ_OBJECTIVES || {};
  var EXAM_MINUTES = 90;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function norm(s) { return String(s).trim().replace(/\s+/g, " "); }
  function objLabel(o) { return o === "x" ? "Ngoài đề LPIC-1" : "LPI " + o; }

  // ---------- choose a question set from the URL ----------
  var params = new URLSearchParams(location.search);
  var mode = params.get("mode") || (params.get("obj") ? "obj" : "b");
  var b = parseInt(params.get("b") || "1", 10);
  var obj = params.get("obj") || "103.1";
  var questions = [], title = "", setKey = "";

  if (mode === "exam") {
    // Mirror the real exam: for each 101 objective, draw as many questions as its weight (60 total).
    Object.keys(OBJ).forEach(function (o) {
      var w = OBJ[o].w;
      if (!w) return;
      var pool = shuffle(QUIZ.filter(function (q) { return q.o === o; }));
      questions = questions.concat(pool.slice(0, w));
    });
    title = "Thi thử LPI-101 · " + questions.length + " câu · " + EXAM_MINUTES + " phút";
    setKey = "exam";
  } else if (mode === "obj") {
    questions = QUIZ.filter(function (q) { return q.o === obj; });
    title = "Mục tiêu " + objLabel(obj) + (OBJ[obj] ? " — " + OBJ[obj].t : "");
    setKey = "obj-" + obj;
  } else if (mode === "all") {
    questions = shuffle(QUIZ);
    title = "Tất cả " + QUIZ.length + " câu (ngẫu nhiên)";
    setKey = "all";
  } else {
    questions = QUIZ.filter(function (q) { return q.b === b; });
    title = "Trắc nghiệm buổi " + (b < 10 ? "0" + b : b);
    setKey = "b" + b;
  }

  // ---------- selectors ----------
  var selB = $("#selB"), selObj = $("#selObj");
  var ph = document.createElement("option");
  ph.value = ""; ph.textContent = "— chọn mục tiêu —"; ph.disabled = true;
  if (mode !== "obj") ph.selected = true;
  selObj.appendChild(ph);
  if (mode !== "b") {
    var phB = document.createElement("option");
    phB.value = ""; phB.textContent = "— chọn buổi —"; phB.disabled = true; phB.selected = true;
    selB.appendChild(phB);
  }
  for (var i = 1; i <= 14; i++) {
    var n = QUIZ.filter(function (q) { return q.b === i; }).length;
    var opt = document.createElement("option");
    opt.value = i; opt.textContent = "Buổi " + (i < 10 ? "0" + i : i) + " (" + n + " câu)";
    if (mode === "b" && i === b) opt.selected = true;
    selB.appendChild(opt);
  }
  Object.keys(OBJ).forEach(function (o) {
    var n = QUIZ.filter(function (q) { return q.o === o; }).length;
    if (!n) return;
    var opt = document.createElement("option");
    opt.value = o; opt.textContent = objLabel(o) + " · " + OBJ[o].t + " (" + n + ")";
    if (mode === "obj" && o === obj) opt.selected = true;
    selObj.appendChild(opt);
  });
  selB.addEventListener("change", function () { location.search = "?b=" + selB.value; });
  selObj.addEventListener("change", function () { location.search = "?obj=" + encodeURIComponent(selObj.value); });
  var deckLink = $("#deckLink");
  if (mode === "b") { deckLink.href = "buoi-" + (b < 10 ? "0" + b : b) + ".html"; deckLink.hidden = false; }

  $("#setTitle").textContent = title;
  var best = store.get("lpi1-quiz-best-" + setKey);
  $("#setMeta").textContent = questions.length + " câu" + (best ? " · điểm cao nhất của bạn: " + best : "");

  // ---------- render ----------
  var list = $("#qlist");
  questions.forEach(function (q, idx) {
    var multi = q.c && q.c.length > 1;
    var card = document.createElement("article");
    card.className = "qcard";
    var html = '<div class="qhead"><span class="qnum">Câu ' + (idx + 1) + '</span>' +
      '<span class="chip">Buổi ' + q.b + '</span><span class="chip ' + (q.o === "x" ? "" : "a") + '">' + objLabel(q.o) + "</span>" +
      (q.f ? '<span class="chip">Điền đáp án</span>' : multi ? '<span class="chip">Chọn ' + q.c.length + "</span>" : "") + "</div>" +
      '<div class="qtext">' + q.q + "</div>";
    if (q.code) html += '<pre class="qcode">' + esc(q.code) + "</pre>";
    if (q.f) {
      html += '<input class="qfill" type="text" spellcheck="false" autocomplete="off" placeholder="Gõ câu trả lời…" aria-label="Câu trả lời câu ' + (idx + 1) + '">';
    } else {
      // Shuffle displayed options in exam mode only; keep original index for grading.
      var order = q.a.map(function (_, k) { return k; });
      if (mode === "exam") order = shuffle(order);
      html += '<div class="qopts">' + order.map(function (k, pos) {
        return '<label class="qopt"><input type="' + (multi ? "checkbox" : "radio") + '" name="q' + idx + '" value="' + k + '">' +
          '<span class="qletter">' + "ABCDEF".charAt(pos) + "</span><span>" + q.a[k] + "</span></label>";
      }).join("") + "</div>";
    }
    html += '<div class="qexp" hidden></div>';
    card.innerHTML = html;
    list.appendChild(card);
  });

  // ---------- grading ----------
  var submitted = false;
  function grade() {
    if (submitted) return;
    submitted = true;
    stopTimer();
    var score = 0;
    Array.prototype.forEach.call(list.children, function (card, idx) {
      var q = questions[idx], ok = false, right = "";
      if (q.f) {
        var input = card.querySelector(".qfill");
        var val = norm(input.value);
        ok = q.f.some(function (ans) { return norm(ans) === val; });
        input.disabled = true;
        right = "Đáp án chấp nhận: " + q.f.map(function (a) { return "<code>" + esc(a) + "</code>"; }).join(" · ");
      } else {
        var chosen = Array.prototype.map.call(card.querySelectorAll("input:checked"), function (x) { return +x.value; }).sort();
        var correct = q.c.slice().sort();
        ok = chosen.length === correct.length && chosen.every(function (v, k) { return v === correct[k]; });
        Array.prototype.forEach.call(card.querySelectorAll(".qopt"), function (lab) {
          var inp = lab.querySelector("input");
          inp.disabled = true;
          var isRight = q.c.indexOf(+inp.value) !== -1;
          if (isRight) lab.classList.add("right");
          else if (inp.checked) lab.classList.add("wrong");
        });
      }
      if (ok) score++;
      card.classList.add(ok ? "ok" : "bad");
      var exp = card.querySelector(".qexp");
      exp.innerHTML = '<b>' + (ok ? "Đúng." : "Chưa đúng.") + "</b> " + (right ? right + "<br>" : "") + (q.e || "");
      exp.hidden = false;
    });
    var pct = questions.length ? Math.round(score / questions.length * 100) : 0;
    var text = score + "/" + questions.length + " (" + pct + "%)";
    var prev = store.get("lpi1-quiz-best-" + setKey);
    if (!prev || parseInt(prev, 10) < pct) store.set("lpi1-quiz-best-" + setKey, pct + "%");
    var verdict = pct >= 80 ? "Rất tốt – sẵn sàng cho phần tiếp theo."
      : pct >= 65 ? "Khá – xem lại các câu sai và slide liên quan."
      : "Cần ôn lại – mở lại slide của buổi, làm lại lab rồi thử lại.";
    var res = $("#result");
    res.innerHTML = "<b>Kết quả: " + text + "</b> · " + verdict;
    res.hidden = false;
    $("#btnSubmit").hidden = true;
    $("#btnRetry").hidden = false;
    res.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("#btnSubmit").addEventListener("click", grade);
  $("#btnRetry").addEventListener("click", function () { location.reload(); });

  // ---------- exam timer ----------
  var timerEl = $("#timer"), deadline = 0, tick = null;
  function stopTimer() { if (tick) clearInterval(tick); tick = null; }
  if (mode === "exam") {
    deadline = Date.now() + EXAM_MINUTES * 60000;
    timerEl.hidden = false;
    var upd = function () {
      var left = Math.max(0, deadline - Date.now());
      var m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000);
      timerEl.textContent = "⏱ " + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
      timerEl.classList.toggle("low", left < 5 * 60000);
      if (!left) grade();
    };
    upd();
    tick = setInterval(upd, 1000);
  }
})();
