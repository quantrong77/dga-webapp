/* boot-guard.js — Chống "trang trắng" khi mở app trong trình duyệt nhúng (Zalo...).
 *
 * Vì sao cần: màn hình đăng nhập (#authOverlay) để ẨN sẵn trong index.html và chỉ hiện khi JS
 * khởi động xong (init() ở ui-auth.js). Trình duyệt nhúng của Zalo (Android lẫn iPhone) có khi
 * không chạy được app — người dùng chỉ thấy trang trắng, không có thông báo gì, trong khi CÙNG
 * link đó mở bằng Chrome/Safari thì bình thường. File này:
 *   1. Nhận ra đang mở trong Zalo → hiện thanh nhắc "Mở bằng trình duyệt" (Android: mở thẳng
 *      Chrome qua intent://; iPhone: hướng dẫn bấm ⋯ → Mở bằng trình duyệt + nút sao chép link).
 *   2. Ghi lại lỗi JS / lỗi tải file xảy ra lúc khởi động; nếu sau BOOT_TIMEOUT_MS app vẫn chưa
 *      báo khởi động xong (window.DGA_BOOT.done(), gọi trong init() ở ui-auth.js) thì hiện màn
 *      hình báo lỗi kèm nút "Tải lại" (xóa cache Service Worker) thay cho trang trắng.
 *
 * Nạp bằng <script> ĐỒNG BỘ trong <head>, TRƯỚC mọi thư viện khác, để bắt được cả lỗi của chúng.
 * CHỦ Ý viết bằng ES5 (var/function, không arrow, không template string, không ?.) để chạy được
 * cả trên WebView đời cũ — chính là trường hợp mà phần còn lại của app có thể không chạy nổi.
 * Không phụ thuộc file nào khác; chỉ lộ ra 1 biến toàn cục window.DGA_BOOT.
 * tests/boot-guard.test.js khóa yêu cầu ES5 này — đừng chạy `eslint --fix` đổi var -> let/const. */
/* eslint-disable no-var */
(function () {
  "use strict";

  var BOOT_TIMEOUT_MS = 12000; // mạng 4G chậm vẫn đủ tải ~1,3 MB thư viện trong <head>
  var EARLY_FAIL_DELAY_MS = 1500; // đã có lỗi + đã "load" xong mà chưa khởi động -> báo sớm
  var MAX_ERRORS = 6;
  var BANNER_DISMISS_KEY = "dga_inapp_banner_dismissed";

  var ua = navigator.userAgent || "";
  var IS_ZALO = /Zalo/i.test(ua);
  var IS_ANDROID = /Android/i.test(ua);
  var IS_IOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  var errors = [];
  var booted = false;
  var panelEl = null;

  // Bước 6: trong lúc khởi động CHƯA biết đã đăng nhập hay chưa → chỉ hiện nền xanh (cùng nền màn hình đăng nhập),
  // ẩn header/tab/nội dung (style-auth.css). Trước đây giao diện nhập liệu hiện ~4 giây (mạng 4G) rồi màn hình đăng
  // nhập mới đè lên — giật hình, và trình duyệt phải dựng bố cục cả trang lớn phía sau. Bỏ class: appShellReady()
  // (ui-auth.js) khi vào app; màn hình lỗi khởi động bên dưới cũng bỏ. Gắn bằng JS (không viết sẵn trong HTML) để
  // trình duyệt tắt JS không bị kẹt ở nền trống.
  if (document.documentElement) document.documentElement.className += " app-booting";

  function pushError(msg) {
    if (booted || !msg || errors.length >= MAX_ERRORS) return;
    msg = String(msg);
    for (var i = 0; i < errors.length; i++) if (errors[i] === msg) return;
    errors.push(msg);
  }

  // Pha capture (tham số true) để bắt cả lỗi TẢI file (<script>/<link> 404, mất mạng) — loại lỗi
  // này không nổi bọt lên window nên ui-errors.js không thấy.
  window.addEventListener(
    "error",
    function (e) {
      var t = e && e.target;
      if (t && t !== window && (t.src || t.href)) {
        pushError("Không tải được: " + (t.src || t.href));
      } else if (e) {
        pushError((e.message || "Lỗi JavaScript") + (e.filename ? " (" + e.filename.split("/").pop() + ":" + e.lineno + ")" : ""));
      }
    },
    true
  );
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    pushError("Lỗi (Promise): " + ((r && r.message) || r || "không rõ"));
  });

  /** Link hiện tại, bỏ các tham số theo dõi Zalo tự gắn (zarsrc, utm_*) và tham số tải lại _r. */
  function cleanUrl() {
    var base = location.origin + location.pathname;
    var q = (location.search || "").replace(/^\?/, "").split("&").filter(function (p) {
      return p && !/^(zarsrc|utm_[a-z]+|_r)=/i.test(p);
    });
    return base + (q.length ? "?" + q.join("&") : "") + (location.hash || "");
  }

  /** Android: intent:// mở thẳng Chrome; máy không có Chrome thì Android tự mở browser_fallback_url. */
  function chromeIntentUrl() {
    var u = cleanUrl();
    return "intent://" + u.replace(/^https?:\/\//, "") + "#Intent;scheme=" + location.protocol.replace(":", "") + ";package=com.android.chrome;S.browser_fallback_url=" + encodeURIComponent(u) + ";end";
  }

  function copyLink(btn) {
    var url = cleanUrl();
    var done = function () {
      btn.textContent = "Đã sao chép ✓";
    };
    var fallback = function () {
      try {
        var ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, url.length);
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) done();
        else btn.textContent = url;
      } catch (err) {
        btn.textContent = url;
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, fallback);
    } else {
      fallback();
    }
  }

  function el(tag, styles, text) {
    var n = document.createElement(tag);
    if (styles) n.style.cssText = styles;
    if (text) n.textContent = text;
    return n;
  }

  var BTN = "display:inline-block;margin:4px 6px 0 0;padding:8px 14px;border-radius:8px;border:1px solid #1d4ed8;font:600 14px/1.2 system-ui,sans-serif;cursor:pointer;text-decoration:none;";
  var BTN_PRIMARY = BTN + "background:#1d4ed8;color:#fff;";
  var BTN_GHOST = BTN + "background:#fff;color:#1d4ed8;";

  /** Các nút "mở bằng trình duyệt" phù hợp với máy đang dùng (dùng chung cho thanh nhắc và màn hình lỗi). */
  function openExternalControls(container) {
    if (IS_ANDROID) {
      var a = el("a", BTN_PRIMARY, "Mở bằng Chrome");
      a.href = chromeIntentUrl();
      container.appendChild(a);
    } else if (IS_IOS) {
      container.appendChild(el("div", "margin:2px 0 4px;font-size:13px;", "Bấm nút ⋯ ở góc trên bên phải → chọn “Mở bằng trình duyệt” (Safari)."));
    }
    var c = el("button", IS_ANDROID ? BTN_GHOST : BTN_PRIMARY, "Sao chép link");
    c.type = "button";
    c.onclick = function () {
      copyLink(c);
    };
    container.appendChild(c);
  }

  function showInAppBanner() {
    try {
      if (sessionStorage.getItem(BANNER_DISMISS_KEY) === "1") return;
    } catch (e) {
      /* sessionStorage bị chặn — vẫn hiện thanh nhắc */
    }
    var bar = el("div", "position:fixed;left:0;right:0;top:0;z-index:2147483646;background:#fffbeb;color:#78350f;border-bottom:1px solid #fcd34d;padding:10px 40px 10px 14px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.12);");
    bar.id = "dgaInAppBanner";
    bar.setAttribute("role", "status");
    bar.appendChild(el("div", "font-weight:600;", "Bạn đang mở app trong Zalo"));
    bar.appendChild(el("div", "", "Trình duyệt của Zalo có thể không chạy được app (trang trắng). Nên mở bằng trình duyệt của máy để dùng đầy đủ."));
    openExternalControls(bar);
    var x = el("button", "position:absolute;top:6px;right:6px;width:32px;height:32px;border:0;background:transparent;color:#78350f;font-size:22px;line-height:1;cursor:pointer;", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Đóng");
    x.onclick = function () {
      bar.parentNode.removeChild(bar);
      try {
        sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
      } catch (e) {
        /* bỏ qua */
      }
    };
    bar.appendChild(x);
    document.body.appendChild(bar);
  }

  /** Tải lại "sạch": gỡ Service Worker + xóa Cache Storage (tránh lẫn file JS cũ với HTML mới),
   *  rồi tải lại với tham số _r để trình duyệt nhúng không trả nguyên trang cũ trong bộ đệm. */
  function hardReload() {
    var go = function () {
      var u = cleanUrl();
      var hashIdx = u.indexOf("#");
      var hash = hashIdx >= 0 ? u.slice(hashIdx) : "";
      if (hashIdx >= 0) u = u.slice(0, hashIdx);
      location.replace(u + (u.indexOf("?") >= 0 ? "&" : "?") + "_r=" + Date.now() + hash);
    };
    var jobs = [];
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        jobs.push(
          navigator.serviceWorker.getRegistrations().then(function (regs) {
            return Promise.all(regs.map(function (r) { return r.unregister(); }));
          })
        );
      }
      if (window.caches && caches.keys) {
        jobs.push(
          caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) { return caches.delete(k); }));
          })
        );
      }
    } catch (e) {
      /* bỏ qua — vẫn tải lại */
    }
    if (jobs.length && window.Promise) {
      Promise.all(jobs).then(go, go);
      setTimeout(go, 3000); // phòng khi promise treo
    } else {
      go();
    }
  }

  function showBootFailure() {
    if (booted || panelEl || !document.body) return;
    document.documentElement.className = document.documentElement.className.replace(/\s*app-booting/g, "");
    panelEl = el("div", "position:fixed;inset:0;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:#f8fafc;color:#0f172a;overflow:auto;padding:24px 16px;font:15px/1.5 system-ui,sans-serif;");
    panelEl.id = "dgaBootFailure";
    panelEl.setAttribute("role", "alert");
    var card = el("div", "max-width:440px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 4px 16px rgba(15,23,42,.08);");
    card.appendChild(el("div", "font-size:18px;font-weight:700;margin-bottom:6px;", errors.length ? "Ứng dụng chưa khởi động được" : "Ứng dụng tải lâu hơn bình thường"));
    card.appendChild(
      el(
        "div",
        "margin-bottom:12px;color:#334155;",
        IS_ZALO
          ? "Trình duyệt của Zalo không chạy được app trên một số máy. Hãy mở link bằng trình duyệt của máy (Chrome/Safari) — cách này luôn chạy được."
          : errors.length
            ? "Có lỗi khi tải ứng dụng. Thử tải lại; nếu vẫn lỗi, gửi ảnh chụp màn hình này cho quản trị viên."
            : "Mạng có thể đang chậm. Chờ thêm hoặc bấm Tải lại."
      )
    );
    var actions = el("div", "margin-bottom:8px;");
    if (IS_ZALO) openExternalControls(actions);
    var reload = el("button", IS_ZALO ? BTN_GHOST : BTN_PRIMARY, "Tải lại");
    reload.type = "button";
    reload.onclick = hardReload;
    actions.appendChild(reload);
    card.appendChild(actions);
    if (errors.length) {
      var det = el("details", "margin-top:10px;font-size:12px;color:#475569;");
      det.appendChild(el("summary", "cursor:pointer;", "Chi tiết lỗi (" + errors.length + ")"));
      var pre = el("pre", "white-space:pre-wrap;word-break:break-all;background:#f1f5f9;border-radius:6px;padding:8px;margin:6px 0 0;", errors.join("\n") + "\n\n" + ua);
      det.appendChild(pre);
      card.appendChild(det);
    }
    panelEl.appendChild(card);
    document.body.appendChild(panelEl);
  }

  window.DGA_BOOT = {
    isZalo: IS_ZALO,
    /** Gọi khi app đã khởi động xong phần giao diện (init() ở ui-auth.js) — tắt màn hình lỗi nếu đã hiện. */
    done: function () {
      booted = true;
      if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
      panelEl = null;
    },
    errors: errors,
  };

  if (IS_ZALO) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showInAppBanner);
    else showInAppBanner();
  }
  setTimeout(showBootFailure, BOOT_TIMEOUT_MS);
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (!booted && errors.length) showBootFailure();
    }, EARLY_FAIL_DELAY_MS);
  });
})();
