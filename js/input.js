/* 时间和日期输入约束、同步、校验及通用格式化工具。 */
      function focusNumericInput(nextId) {
        var next = el(nextId);
        if (!next || next.disabled) return;
        try {
          next.focus({ preventScroll: true });
        } catch (e) {
          next.focus();
        }
      }

      function bindSpaceAdvance(input, nextId) {
        if (!input || !nextId) return;
        input.addEventListener("keydown", function (event) {
          if (event.key !== " " && event.key !== "Spacebar") return;
          event.preventDefault();
          focusNumericInput(nextId);
        });
      }

      function clampInput(input, max, nextId) {
        input.addEventListener("input", function () {
          var v = input.value.replace(/[^\d]/g, "");
          if (v.length > 2 && max <= 59) v = v.slice(0, 2);
          if (v.length > 3 && max > 59) v = v.slice(0, 3);
          if (v !== "" && Number(v) > max) v = String(max);
          input.value = v;
        });
        input.addEventListener("blur", function () {
          if (input.value !== "") input.value = pad(Number(input.value));
        });
        bindSpaceAdvance(input, nextId);
      }

      function getTime(hId, mId, name) {
        if (inputMode === "native") {
          var nativeId = timeNativeId(hId);
          var value = nativeId && el(nativeId) ? el(nativeId).value : "";
          if (!value) return { ok: false, msg: "请选择" + name };
          var parts = value.split(":").map(Number);
          var nh = parts[0];
          var nm = parts[1];
          if (Number.isNaN(nh) || Number.isNaN(nm) || nh < 0 || nh > 23 || nm < 0 || nm > 59) {
            return { ok: false, msg: name + "格式不正确" };
          }
          setTimeValue(hId, mId, pad(nh) + ":" + pad(nm));
          return { ok: true, h: nh, m: nm, text: pad(nh) + ":" + pad(nm), minutes: nh * 60 + nm };
        }

        var hRaw = el(hId).value;
        var mRaw = el(mId).value;
        if (hRaw === "" || mRaw === "") {
          return { ok: false, msg: "请输入" + name + (isMobileLayout() ? "" : "的小时和分钟") };
        }
        var h = Number(hRaw);
        var m = Number(mRaw);
        if (h < 0 || h > 23 || m < 0 || m > 59) {
          return { ok: false, msg: name + "格式不正确" };
        }
        return {
          ok: true,
          h: h,
          m: m,
          text: pad(h) + ":" + pad(m),
          minutes: h * 60 + m
        };
      }

      function normalizeMinutes(total) {
        var day = 24 * 60;
        return ((total % day) + day) % day;
      }

      function minutesToTime(total) {
        var n = normalizeMinutes(total);
        return pad(Math.floor(n / 60)) + ":" + pad(n % 60);
      }

      function formatHM(totalMinutes) {
        return Math.floor(totalMinutes / 60) + "小时" + (totalMinutes % 60) + "分";
      }

      function formatMinutesOnly(totalMinutes) {
        return totalMinutes + "分";
      }

      function formatNow(ts) {
        var d = new Date(ts);
        return pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
      }

      function escapeHtml(str) {
        return String(str)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

