/* 时间计算器 Pro 逻辑
   从单文件版拆分而来：计算、设置、历史、弹窗、振动和输入模式统一在这里。 */

(function () {
      var STORAGE_KEY = "timeCalculatorHistoryV3";
      var DATE_STORAGE_KEY = "dateCalculatorHistoryV1";
      var INPUT_MODE_KEY = "calculatorInputModeV1";
      var SETTINGS_KEY = "calculatorSettingsV1";
      var APP_VERSION = "v1.3.0";
      var CHANGELOG_SEEN_VERSION_KEY = "calculatorChangelogSeenVersionV1";
      var LAST_CALCULATOR_KEY = "calculatorLastCalculatorV1";
      var LAST_MODE_KEY = "calculatorLastModeV1";
      var currentResult = null;
      var displayMode = "hm";
      var activeTab = "diff";
      var activeCalculator = "time";
      var activeDateTab = "diff";
      var currentDateResult = null;
      var inputMode = "numeric";
      var appSettings = {
        inputMode: "numeric",
        defaultCalculator: "time",
        defaultMode: "diff",
        appearance: "light",
        density: "standard",
        accumulation: "on",
        vibration: "on",
        applyBehavior: "close",
        changelogPopup: "on",
        historyLimit: 10
      };
      var pendingSettings = null;
      var historyToastTimer = null;
      var dateHistoryToastTimer = null;
      var copyFeedbackTimers = new WeakMap();

      function el(id) { return document.getElementById(id); }
      function pad(n) { return String(n).padStart(2, "0"); }

      function timeNativeId(hId) {
        return { startH: "startNative", endH: "endNative", baseH: "baseNative" }[hId];
      }

      function dateNativeId(yId) {
        return { dateStartY: "dateStartNative", dateEndY: "dateEndNative", dateBaseY: "dateBaseNative" }[yId];
      }

      function setTimeValue(hId, mId, timeText) {
        var parts = String(timeText || "").split(":").map(Number);
        if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return;
        el(hId).value = pad(parts[0]);
        el(mId).value = pad(parts[1]);
        var nativeId = timeNativeId(hId);
        if (nativeId && el(nativeId)) el(nativeId).value = pad(parts[0]) + ":" + pad(parts[1]);
      }

      function syncOneTimeToNative(hId, mId) {
        var h = el(hId).value;
        var m = el(mId).value;
        var nativeId = timeNativeId(hId);
        if (!nativeId || !el(nativeId)) return;
        if (h === "" || m === "") return;
        var hn = Number(h), mn = Number(m);
        if (hn >= 0 && hn <= 23 && mn >= 0 && mn <= 59) {
          el(nativeId).value = pad(hn) + ":" + pad(mn);
        }
      }

      function syncOneTimeToNumeric(nativeId, hId, mId) {
        var v = el(nativeId).value;
        if (!v) return;
        var parts = v.split(":").map(Number);
        if (parts.length >= 2) {
          el(hId).value = pad(parts[0]);
          el(mId).value = pad(parts[1]);
        }
      }

      function makeDateValue(y, m, d) {
        return String(y).padStart(4, "0") + "-" + pad(m) + "-" + pad(d);
      }

      function syncOneDateToNative(yId, mId, dId) {
        var nativeId = dateNativeId(yId);
        if (!nativeId || !el(nativeId)) return;
        var yRaw = el(yId).value, mRaw = el(mId).value, dRaw = el(dId).value;
        if (!yRaw || !mRaw || !dRaw) return;
        var y = Number(yRaw), m = Number(mRaw), d = Number(dRaw);
        var dt = new Date(y, m - 1, d);
        if (y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31 && dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
          el(nativeId).value = makeDateValue(y, m, d);
        }
      }

      function syncOneDateToNumeric(nativeId, yId, mId, dId) {
        var v = el(nativeId).value;
        if (!v) return;
        var parts = v.split("-").map(Number);
        if (parts.length === 3) {
          el(yId).value = parts[0];
          el(mId).value = pad(parts[1]);
          el(dId).value = pad(parts[2]);
        }
      }

      function syncNumericToNative() {
        syncOneTimeToNative("startH", "startM");
        syncOneTimeToNative("endH", "endM");
        syncOneTimeToNative("baseH", "baseM");
        syncOneDateToNative("dateStartY", "dateStartM", "dateStartD");
        syncOneDateToNative("dateEndY", "dateEndM", "dateEndD");
        syncOneDateToNative("dateBaseY", "dateBaseM", "dateBaseD");
      }


      function syncNativeToNumeric() {
        syncOneTimeToNumeric("startNative", "startH", "startM");
        syncOneTimeToNumeric("endNative", "endH", "endM");
        syncOneTimeToNumeric("baseNative", "baseH", "baseM");
        syncOneDateToNumeric("dateStartNative", "dateStartY", "dateStartM", "dateStartD");
        syncOneDateToNumeric("dateEndNative", "dateEndY", "dateEndM", "dateEndD");
        syncOneDateToNumeric("dateBaseNative", "dateBaseY", "dateBaseM", "dateBaseD");
      }

      function setInputMode(mode, save) {
        mode = mode === "native" ? "native" : "numeric";
        if (mode === "native") syncNumericToNative();
        if (mode === "numeric") syncNativeToNumeric();
        inputMode = mode;
        appSettings.inputMode = mode;
        document.body.classList.toggle("use-native-pickers", inputMode === "native");
        if (el("inputModeBtn")) el("inputModeBtn").innerText = inputMode === "native" ? "系统选择器" : "数字输入";
        if (save) {
          localStorage.setItem(INPUT_MODE_KEY, inputMode);
          saveSettings();
          syncSettingsForm();
        }
      }

      function loadInputMode() {
        setInputMode(appSettings.inputMode === "native" ? "native" : "numeric", false);
      }

      function loadSettings() {
        try {
          var saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
          if (saved && typeof saved === "object") {
            if (saved.inputMode === "native" || saved.inputMode === "numeric") appSettings.inputMode = saved.inputMode;
            if (["time", "date", "remember"].indexOf(saved.defaultCalculator) !== -1) appSettings.defaultCalculator = saved.defaultCalculator;
            if (["diff", "shift", "remember"].indexOf(saved.defaultMode) !== -1) appSettings.defaultMode = saved.defaultMode;
            if (["light", "dark", "system"].indexOf(saved.appearance) !== -1) appSettings.appearance = saved.appearance;
            if (["standard", "compact"].indexOf(saved.density) !== -1) appSettings.density = saved.density;
            if (["on", "off"].indexOf(saved.accumulation) !== -1) appSettings.accumulation = saved.accumulation;
            if (["on", "off"].indexOf(saved.vibration) !== -1) appSettings.vibration = saved.vibration;
            if (["close", "stay"].indexOf(saved.applyBehavior) !== -1) appSettings.applyBehavior = saved.applyBehavior;
            if (["on", "off"].indexOf(saved.changelogPopup) !== -1) appSettings.changelogPopup = saved.changelogPopup;
            if ([10, 20, 30].indexOf(Number(saved.historyLimit)) !== -1) appSettings.historyLimit = Number(saved.historyLimit);
          }
        } catch (e) {}

        var oldInputMode = localStorage.getItem(INPUT_MODE_KEY);
        if (!localStorage.getItem(SETTINGS_KEY) && (oldInputMode === "native" || oldInputMode === "numeric")) {
          appSettings.inputMode = oldInputMode;
        }
      }

      function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
      }

      function cloneSettings(settings) {
        return JSON.parse(JSON.stringify(settings));
      }

      function getFormSettings() {
        return pendingSettings || appSettings;
      }

      var settingsApplyCloseTimer = null;
      var settingsCloseAnimationTimer = null;
      var settingsResetFeedbackTimer = null;
      var currentSettingsPage = "main";
      var lastSettingsPageBeforeClose = "main";
      var lastSettingsClosedAt = 0;
      var lastSettingsStackBeforeClose = null;
      var SETTINGS_RESTORE_WINDOW = 15000;
      var SETTINGS_DEFAULT_TIP = "修改设置后，请点击“应用”生效；点击“恢复默认”只会先填入默认设置，需要再点击“应用”保存。";

      var currentNoticePage = "main";
      var noticePageStack = [{ page: "main", scrollTop: 0 }];
      var settingsPageStack = [{ page: "main", scrollTop: 0 }];
      var noticePageSwitching = false;
      var settingsPageSwitching = false;

      var NOTICE_PAGES = ["main", "time", "date", "settings", "records", "notes", "version"];
      var SETTINGS_PAGES = ["main", "input", "appearance", "calculation", "interaction"];

      function normalizePage(page, validPages) {
        page = page || "main";
        return validPages.indexOf(page) === -1 ? "main" : page;
      }

      function clonePageStack(stack) {
        return (stack || [{ page: "main", scrollTop: 0 }]).map(function (item) {
          return {
            page: item && item.page ? item.page : "main",
            scrollTop: Math.max(0, Number(item && item.scrollTop) || 0)
          };
        });
      }

      function normalizePageStack(stack, validPages) {
        var cloned = clonePageStack(stack).filter(function (item) {
          return validPages.indexOf(item.page) !== -1;
        });
        if (!cloned.length || cloned[0].page !== "main") {
          cloned.unshift({ page: "main", scrollTop: 0 });
        }
        return cloned;
      }

      function getNoticeContent() {
        return document.querySelector(".notice-content");
      }

      function getSettingsContent() {
        return document.querySelector(".settings-content");
      }

      function lockMomentumScroll(scrollEl) {
        if (!scrollEl) return function () {};
        var y = scrollEl.scrollTop || 0;
        var previousOverflowY = scrollEl.style.overflowY;
        var previousMomentum = scrollEl.style.webkitOverflowScrolling;

        scrollEl.style.webkitOverflowScrolling = "auto";
        scrollEl.style.overflowY = "hidden";
        scrollEl.scrollTop = y;
        scrollEl.offsetHeight;

        return function () {
          scrollEl.style.webkitOverflowScrolling = previousMomentum || "";
          scrollEl.style.overflowY = previousOverflowY || "";
        };
      }

      function stopMomentumScroll(scrollEl) {
        var release = lockMomentumScroll(scrollEl);
        requestAnimationFrame(function () {
          release();
        });
      }

      function restoreScrollStable(getScrollEl, y) {
        var targetY = Math.max(0, Number(y) || 0);
        var scrollEl = getScrollEl();
        if (!scrollEl) return;

        scrollEl.scrollTop = targetY;
        requestAnimationFrame(function () {
          var scrollEl1 = getScrollEl();
          if (scrollEl1) scrollEl1.scrollTop = targetY;
          requestAnimationFrame(function () {
            var scrollEl2 = getScrollEl();
            if (scrollEl2) scrollEl2.scrollTop = targetY;
            setTimeout(function () {
              var scrollEl3 = getScrollEl();
              if (scrollEl3) scrollEl3.scrollTop = targetY;
            }, 60);
          });
        });
      }

      function getNoticeTop() {
        if (!noticePageStack.length) noticePageStack = [{ page: "main", scrollTop: 0 }];
        return noticePageStack[noticePageStack.length - 1];
      }

      function getSettingsTop() {
        if (!settingsPageStack.length) settingsPageStack = [{ page: "main", scrollTop: 0 }];
        return settingsPageStack[settingsPageStack.length - 1];
      }

      function captureNoticeStack() {
        var stack = normalizePageStack(noticePageStack, NOTICE_PAGES);
        var content = getNoticeContent();
        if (content && stack.length) {
          stack[stack.length - 1].scrollTop = content.scrollTop || 0;
        }
        return stack;
      }

      function captureSettingsStack() {
        var stack = normalizePageStack(settingsPageStack, SETTINGS_PAGES);
        var content = getSettingsContent();
        if (content && stack.length) {
          stack[stack.length - 1].scrollTop = content.scrollTop || 0;
        }
        return stack;
      }

      function renderNoticePageDirect(page) {
        page = normalizePage(page, NOTICE_PAGES);

        var titles = {
          main: "使用公告",
          time: "时间计算器说明",
          date: "日期计算器说明",
          settings: "设置功能说明",
          records: "记录与本地保存",
          notes: "注意事项",
          version: "历史更新日志"
        };

        var subtitles = {
          main: "选择要查看的说明内容",
          time: "时间差、前移/后退、连续累计和输入方式",
          date: "日期差、日期前移/后退、连续累计和输入方式",
          settings: "输入设置、外观设置、计算设置和交互设置",
          records: "记录保存、复制、删除、清空和本地存储",
          notes: "跨天规则、有效日期和正式用途提醒",
          version: "查看各版本更新内容"
        };

        currentNoticePage = page;

        ["Main", "Time", "Date", "Settings", "Records", "Notes", "Version"].forEach(function (name) {
          var pageEl = el("noticePage" + name);
          if (pageEl) pageEl.classList.toggle("active", name.toLowerCase() === page);
        });

        el("noticeTitle").innerText = titles[page] || titles.main;
        el("noticeSubtitle").innerText = subtitles[page] || subtitles.main;
        el("noticeBack").classList.toggle("show", page !== "main");
      }

      function renderSettingsPageDirect(page) {
        page = normalizePage(page, SETTINGS_PAGES);

        var labels = {
          main: "选择要调整的设置分类",
          input: "输入方式、默认打开和默认模式",
          appearance: "显示模式和界面密度",
          calculation: "连续累计和记录条数",
          interaction: "应用后行为、震动反馈和更新日志"
        };

        currentSettingsPage = page;

        ["Main", "Input", "Appearance", "Calculation", "Interaction"].forEach(function (name) {
          var pageEl = el("settingsPage" + name);
          if (pageEl) pageEl.classList.toggle("active", name.toLowerCase() === page);
        });

        el("settingsTitle").innerText = page === "main" ? "设置" :
          page === "input" ? "输入设置" :
          page === "appearance" ? "外观设置" :
          page === "calculation" ? "计算设置" : "交互设置";

        el("settingsSubtitle").innerText = labels[page] || labels.main;
        el("settingsBack").classList.toggle("show", page !== "main");
      }

      function switchNoticeStack(nextStack) {
        if (noticePageSwitching) return;
        nextStack = normalizePageStack(nextStack, NOTICE_PAGES);
        var target = nextStack[nextStack.length - 1];
        var content = getNoticeContent();

        noticePageSwitching = true;
        var releaseMomentum = lockMomentumScroll(content);

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            noticePageStack = nextStack;
            renderNoticePageDirect(target.page);
            restoreScrollStable(getNoticeContent, target.scrollTop);

            requestAnimationFrame(function () {
              requestAnimationFrame(function () {
                releaseMomentum();
              });
            });

            setTimeout(function () {
              noticePageSwitching = false;
            }, 150);
          });
        });
      }

      function switchSettingsStack(nextStack) {
        if (settingsPageSwitching) return;
        nextStack = normalizePageStack(nextStack, SETTINGS_PAGES);
        var target = nextStack[nextStack.length - 1];
        var content = getSettingsContent();

        settingsPageSwitching = true;
        var releaseMomentum = lockMomentumScroll(content);

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            settingsPageStack = nextStack;
            renderSettingsPageDirect(target.page);
            restoreScrollStable(getSettingsContent, target.scrollTop);

            requestAnimationFrame(function () {
              requestAnimationFrame(function () {
                releaseMomentum();
              });
            });

            setTimeout(function () {
              settingsPageSwitching = false;
            }, 150);
          });
        });
      }

      function resetNoticePageStack() {
        noticePageStack = [{ page: "main", scrollTop: 0 }];
        currentNoticePage = "main";
      }

      function resetSettingsPageStack() {
        settingsPageStack = [{ page: "main", scrollTop: 0 }];
        currentSettingsPage = "main";
      }

      function openNoticeSubPage(page) {
        page = normalizePage(page, NOTICE_PAGES);
        if (page === "main") return backNoticePage();
        var nextStack = captureNoticeStack();
        nextStack.push({ page: page, scrollTop: 0 });
        switchNoticeStack(nextStack);
      }

      function backNoticePage() {
        var nextStack = captureNoticeStack();
        if (nextStack.length > 1) {
          nextStack.pop();
        } else {
          nextStack = [{ page: "main", scrollTop: 0 }];
        }
        switchNoticeStack(nextStack);
      }

      function openSettingsSubPage(page) {
        page = normalizePage(page, SETTINGS_PAGES);
        if (page === "main") return backSettingsPage();
        var nextStack = captureSettingsStack();
        nextStack.push({ page: page, scrollTop: 0 });
        switchSettingsStack(nextStack);
      }

      function backSettingsPage() {
        var nextStack = captureSettingsStack();
        if (nextStack.length > 1) {
          nextStack.pop();
        } else {
          nextStack = [{ page: "main", scrollTop: 0 }];
        }
        switchSettingsStack(nextStack);
      }

      function resetApplyButtonState() {
        var btn = el("settingsDone");
        if (!btn) return;
        btn.disabled = false;
        btn.classList.remove("settings-applied");
        btn.innerText = "应用";
      }

      function resetRestoreButtonState() {
        var btn = el("settingsReset");
        if (!btn) return;
        btn.disabled = false;
        btn.classList.remove("settings-reset-bounce");
        btn.innerText = "恢复默认";
      }

      function resetSettingsTip() {
        var tip = el("settingsTip");
        if (!tip) return;
        tip.innerText = SETTINGS_DEFAULT_TIP;
      }

      function showResetButtonFeedback() {
        var btn = el("settingsReset");
        if (!btn) return;

        clearTimeout(settingsResetFeedbackTimer);

        // 只做按钮回弹反馈，不改变文字，避免误以为默认设置已经生效。
        btn.classList.remove("settings-reset-bounce");
        void btn.offsetWidth;
        btn.classList.add("settings-reset-bounce");

        settingsResetFeedbackTimer = setTimeout(function () {
          resetRestoreButtonState();
        }, 320);
      }

      function markSettingsChanged() {
        resetApplyButtonState();
        resetRestoreButtonState();
        resetSettingsTip();
      }

      function showApplyButtonSuccessFeedback() {
        var btn = el("settingsDone");
        if (!btn) return;

        clearTimeout(settingsApplyCloseTimer);
        btn.disabled = true;
        btn.classList.add("settings-applied");
        btn.innerText = "✓ 已应用";

        settingsApplyCloseTimer = setTimeout(function () {
          if (appSettings.applyBehavior === "stay") {
            resetApplyButtonState();
            return;
          }

          closeSettings(false);
        }, 420);
      }

      function applySettingsFromPending() {
        if (!pendingSettings) pendingSettings = cloneSettings(appSettings);

        var previousHistoryLimit = getHistoryLimit();

        appSettings = cloneSettings(pendingSettings);

        saveSettings();
        setInputMode(appSettings.inputMode, false);
        applyAppearanceSettings();
        updateAccumulationHints();

        var nextHistoryLimit = getHistoryLimit();
        if (nextHistoryLimit < previousHistoryLimit) {
          trimHistoryToLimit();
        }

        renderHistory();
        renderDateHistory();
        updateHistoryLimitTips();

        // 先把“应用”按钮变成成功状态，再按用户设置决定是否关闭设置界面。
        // 应用时不切换设置页：退出就直接回主界面，不退出就保留当前二级菜单。
        pendingSettings = cloneSettings(appSettings);
        syncSettingsForm();
        showApplyButtonSuccessFeedback();
      }

      function setRadioValue(name, value) {
        var nodes = document.querySelectorAll('input[name="' + name + '"]');
        Array.prototype.forEach.call(nodes, function (node) {
          node.checked = node.value === value;
        });
      }

      function syncSettingsForm() {
        var settings = getFormSettings();
        setRadioValue("settingInputMode", settings.inputMode || "numeric");
        setRadioValue("settingDefaultCalculator", settings.defaultCalculator || "time");
        setRadioValue("settingDefaultMode", settings.defaultMode || "diff");
        setRadioValue("settingAppearance", settings.appearance || "light");
        setRadioValue("settingDensity", settings.density || "standard");
        setRadioValue("settingAccumulation", settings.accumulation || "on");
        setRadioValue("settingVibration", settings.vibration || "on");
        setRadioValue("settingApplyBehavior", settings.applyBehavior || "close");
        setRadioValue("settingChangelogPopup", settings.changelogPopup || "on");
        setRadioValue("settingHistoryLimit", String(settings.historyLimit || 10));
      }

      function isSystemDarkMode() {
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      }

      function updateSystemAppearanceClass() {
        document.body.classList.toggle("system-dark", appSettings.appearance === "system" && isSystemDarkMode());
      }

      function applyAppearanceSettings() {
        document.body.classList.remove("theme-green", "theme-purple", "theme-orange");

        document.body.classList.remove("appearance-light", "appearance-dark", "appearance-system", "system-dark");
        document.body.classList.add("appearance-" + appSettings.appearance);
        updateSystemAppearanceClass();

        document.body.classList.toggle("density-compact", appSettings.density === "compact");
      }

      function updateAccumulationHints() {
        var timeHint = el("shiftAccumHint");
        var dateHint = el("dateAccumHint");
        if (appSettings.accumulation === "off") {
          if (timeHint) timeHint.innerText = "连续累计已关闭：计算后不会自动更新基准时间";
          if (dateHint) dateHint.innerText = "连续累计已关闭：计算后不会自动更新基准日期";
        } else {
          if (timeHint) timeHint.innerText = "连续点“计算”会在上一次结果上继续累计";
          if (dateHint) dateHint.innerText = "连续点“计算”会在上一次结果上继续累计";
        }
      }

      function getHistoryLimit() {
        var limit = Number(appSettings.historyLimit || 10);
        return [10, 20, 30].indexOf(limit) !== -1 ? limit : 10;
      }

      function historyLimitText() {
        return "最多保留 " + getHistoryLimit() + " 条记录";
      }

      function getHistoryArea(listId) {
        var list = el(listId);
        if (!list) return null;
        return list.closest(".history") || list.parentElement;
      }

      function showHistoryToast(type, text) {
        var oldToast = document.querySelector(".history-toast");
        if (oldToast) oldToast.remove();

        var toast = document.createElement("div");
        toast.className = "history-toast";
        toast.innerText = text;
        toast.setAttribute("role", "status");

        document.body.appendChild(toast);

        clearTimeout(historyToastTimer);
        clearTimeout(dateHistoryToastTimer);
        historyToastTimer = setTimeout(function () {
          toast.classList.add("hide");
          setTimeout(function () {
            toast.remove();
          }, 180);
        }, 1600);
      }

      function showCopyButtonFeedback(btn) {
        if (!btn) return;

        if (copyFeedbackTimers.has(btn)) {
          clearTimeout(copyFeedbackTimers.get(btn));
        }

        btn.classList.add("copied");
        btn.innerText = "✓";

        var timer = setTimeout(function () {
          btn.classList.remove("copied");
          btn.innerText = "复制";
          copyFeedbackTimers.delete(btn);
        }, 700);

        copyFeedbackTimers.set(btn, timer);
      }

      function updateHistoryLimitTips() {
        var text = historyLimitText();

        ["historyList", "dateHistoryList"].forEach(function (listId) {
          var area = getHistoryArea(listId);
          if (!area) return;

          var tip = area.nextElementSibling;
          if (!tip || !tip.classList || !tip.classList.contains("history-limit-tip")) {
            tip = document.createElement("div");
            tip.className = "history-limit-tip";
            area.insertAdjacentElement("afterend", tip);
          }

          tip.innerText = text;
        });
      }

      function trimHistoryToLimit() {
        var limit = getHistoryLimit();

        var history = loadHistory();
        if (history.length > limit) {
          saveHistory(history.slice(0, limit));
        }

        var dateHistory = loadDateHistory();
        if (dateHistory.length > limit) {
          saveDateHistory(dateHistory.slice(0, limit));
        }
      }

      function bindSettingsRadios() {
        function ensurePendingSettings() {
          if (!pendingSettings) pendingSettings = cloneSettings(appSettings);
          return pendingSettings;
        }

        document.querySelectorAll('input[name="settingInputMode"]').forEach(function (node) {
          node.addEventListener("change", function () {
            if (!node.checked) return;
            ensurePendingSettings().inputMode = node.value;
            markSettingsChanged();
          });
        });

        document.querySelectorAll('input[name="settingDefaultCalculator"]').forEach(function (node) {
          node.addEventListener("change", function () {
            if (!node.checked) return;
            ensurePendingSettings().defaultCalculator = node.value;
            markSettingsChanged();
          });
        });

        document.querySelectorAll('input[name="settingDefaultMode"]').forEach(function (node) {
          node.addEventListener("change", function () {
            if (!node.checked) return;
            ensurePendingSettings().defaultMode = node.value;
            markSettingsChanged();
          });
        });

        document.querySelectorAll('input[name="settingAppearance"]').forEach(function (node) {
          node.addEventListener("change", function () {
            if (!node.checked) return;
            ensurePendingSettings().appearance = node.value;
            markSettingsChanged();
          });
        });

        document.querySelectorAll('input[name="settingDensity"]').forEach(function (node) {
          node.addEventListener("change", function () {
            if (!node.checked) return;
            ensurePendingSettings().density = node.value;
            markSettingsChanged();
          });
        });

        document.querySelectorAll('input[name="settingAccumulation"]').forEach(function (node) {
          node.addEventListener("change", function () {
            if (!node.checked) return;
            ensurePendingSettings().accumulation = node.value;
            markSettingsChanged();
          });
        });

        document.querySelectorAll('input[name="settingVibration"]').forEach(function (node) {
          node.addEventListener("change", function () {
            if (!node.checked) return;
            ensurePendingSettings().vibration = node.value;
            markSettingsChanged();
          });
        });

        document.querySelectorAll('input[name="settingApplyBehavior"]').forEach(function (node) {
          node.addEventListener("change", function () {
            if (!node.checked) return;
            ensurePendingSettings().applyBehavior = node.value;
            markSettingsChanged();
          });
        });

        document.querySelectorAll('input[name="settingChangelogPopup"]').forEach(function (node) {
          node.addEventListener("change", function () {
            if (!node.checked) return;
            ensurePendingSettings().changelogPopup = node.value;
            markSettingsChanged();
          });
        });

        document.querySelectorAll('input[name="settingHistoryLimit"]').forEach(function (node) {
          node.addEventListener("change", function () {
            if (!node.checked) return;
            ensurePendingSettings().historyLimit = Number(node.value) || 10;
            markSettingsChanged();
          });
        });
      }


      function showSettingsPage(page, options) {
        options = options || {};
        page = normalizePage(page, SETTINGS_PAGES);
        if (options.skipStack) {
          renderSettingsPageDirect(page);
          restoreScrollStable(getSettingsContent, getSettingsTop().scrollTop || 0);
          return;
        }
        if (page === "main") {
          backSettingsPage();
        } else {
          openSettingsSubPage(page);
        }
      }


      function rememberSettingsPageBeforeClose() {
        settingsPageStack = captureSettingsStack();
        currentSettingsPage = getSettingsTop().page || "main";
        lastSettingsPageBeforeClose = currentSettingsPage;
        lastSettingsStackBeforeClose = clonePageStack(settingsPageStack);
        lastSettingsClosedAt = Date.now();
      }

      function clearSettingsPageRestore() {
        lastSettingsPageBeforeClose = "main";
        lastSettingsClosedAt = 0;
        lastSettingsStackBeforeClose = null;
        resetSettingsPageStack();
      }

      function getSettingsStackForOpen() {
        var withinRestoreWindow = lastSettingsClosedAt && Date.now() - lastSettingsClosedAt <= SETTINGS_RESTORE_WINDOW;
        if (withinRestoreWindow && lastSettingsStackBeforeClose && lastSettingsStackBeforeClose.length) {
          return normalizePageStack(lastSettingsStackBeforeClose, SETTINGS_PAGES);
        }
        return [{ page: "main", scrollTop: 0 }];
      }

      function openSettings() {
        clearTimeout(settingsApplyCloseTimer);
        clearTimeout(settingsCloseAnimationTimer);
        clearTimeout(settingsResetFeedbackTimer);
        resetApplyButtonState();
        resetRestoreButtonState();
        resetSettingsTip();

        pendingSettings = cloneSettings(appSettings);

        var overlay = el("settingsOverlay");
        overlay.classList.remove("closing");
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
        document.body.classList.add("notice-lock");

        settingsPageStack = getSettingsStackForOpen();
        var target = getSettingsTop();
        renderSettingsPageDirect(target.page);
        restoreScrollStable(getSettingsContent, target.scrollTop || 0);

        syncSettingsForm();
      }

      function closeSettings(rememberPage) {
        var content = getSettingsContent();
        if (content) {
          settingsPageStack = captureSettingsStack();
          stopMomentumScroll(content);
        }

        if (rememberPage === false) {
          clearSettingsPageRestore();
        } else {
          rememberSettingsPageBeforeClose();
        }
        pendingSettings = null;
        clearTimeout(settingsApplyCloseTimer);
        clearTimeout(settingsCloseAnimationTimer);
        clearTimeout(settingsResetFeedbackTimer);
        resetRestoreButtonState();
        resetSettingsTip();
        syncSettingsForm();

        var overlay = el("settingsOverlay");
        if (!overlay || !overlay.classList.contains("show")) {
          resetApplyButtonState();
          document.body.classList.remove("notice-lock");
          return;
        }

        overlay.classList.add("closing");
        overlay.setAttribute("aria-hidden", "true");

        settingsCloseAnimationTimer = setTimeout(function () {
          overlay.classList.remove("show", "closing");
          document.body.classList.remove("notice-lock");
          resetApplyButtonState();
        }, 180);
      }

      function resetSettings() {
        pendingSettings = {
          inputMode: "numeric",
          defaultCalculator: "time",
          defaultMode: "diff",
          appearance: "light",
          density: "standard",
          accumulation: "on",
          vibration: "on",
          applyBehavior: "close",
          changelogPopup: "on",
          historyLimit: 10
        };

        // 只恢复弹窗里的选中状态，真正生效需要点击“应用”。
        syncSettingsForm();
        resetApplyButtonState();
        showResetButtonFeedback();
      }

      function applyStartupSettings() {
        var calculator = appSettings.defaultCalculator;
        if (calculator === "remember") {
          calculator = localStorage.getItem(LAST_CALCULATOR_KEY) || "time";
        }
        setActiveCalculator(calculator === "date" ? "date" : "time", true);

        var mode = appSettings.defaultMode;
        if (mode === "remember") {
          mode = localStorage.getItem(LAST_MODE_KEY) || "diff";
        }
        setModeSync(mode === "shift" ? "shift" : "diff", true);
      }


      function clampInput(input, max) {
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
          return { ok: false, msg: "请输入" + name + "的小时和分钟" };
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

      function renderResult() {
        if (!currentResult) {
          el("resultValue").innerText = "结果会显示在这里";
          el("resultTip").innerText = activeTab === "diff"
            ? "时间差结果可点击切换：小时+分钟 / 总分钟"
            : "示例：08:30 前移 1小时20分 = 07:10";
          return;
        }

        if (currentResult.type === "diff") {
          el("resultValue").innerText = (
            displayMode === "hm"
              ? formatHM(currentResult.totalMinutes)
              : formatMinutesOnly(currentResult.totalMinutes)
          ) + (currentResult.crossedDay ? "（跨天）" : "");
          el("resultTip").innerText = "点击结果可切换单位";
        } else {
          el("resultValue").innerText = currentResult.resultTime;
          el("resultTip").innerText =
            currentResult.baseTime + " " + currentResult.directionText + " " +
            formatHM(currentResult.shiftTotal) + " = " + currentResult.resultTime + "，再点计算可继续累计";
        }
      }

      function setMessage(main, tip) {
        currentResult = null;
        el("resultValue").innerText = main;
        el("resultTip").innerText = tip || "";
      }

      function setDateMessage(main, tip) {
        currentDateResult = null;
        el("dateResultValue").innerText = main;
        el("dateResultTip").innerText = tip || "";
      }

      function loadHistory() {
        try {
          var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
          return Array.isArray(data) ? data : [];
        } catch (e) {
          return [];
        }
      }

      function saveHistory(history) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      }

      function addHistory(record) {
        var history = loadHistory();
        var limit = getHistoryLimit();
        var willRemoveOldest = history.length >= limit;

        history.unshift(record);
        saveHistory(history.slice(0, limit));
        renderHistory();
        updateHistoryLimitTips();

        if (willRemoveOldest) {
          showHistoryToast("time", "已保留最近 " + limit + " 条，最早记录已移除");
        }
      }

      function copyText(text, btn) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            showCopyButtonFeedback(btn);
          }).catch(function () {
            fallbackCopyText(text, btn);
          });
        } else {
          fallbackCopyText(text, btn);
        }
      }

      function fallbackCopyText(text, btn) {
        var textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
          document.execCommand("copy");
          showCopyButtonFeedback(btn);
        } catch (e) {
          if (activeCalculator === "date") {
            setDateMessage("复制失败", "请手动长按选择文字复制");
          } else {
            setMessage("复制失败", "请手动长按选择文字复制");
          }
        }

        document.body.removeChild(textarea);
      }

      function deleteHistoryItem(index) {
        var history = loadHistory();
        history.splice(index, 1);
        saveHistory(history);
        renderHistory();
        setMessage("已删除该条记录", "历史记录已更新");
      }

      function clearAllHistory() {
        if (!loadHistory().length) {
          setMessage("暂无记录可清空", "先去算一条吧");
          return;
        }
        openClearConfirm("time");
      }

      function doClearHistory() {
        localStorage.removeItem(STORAGE_KEY);
        renderHistory();
        setMessage("已清空全部记录", "历史记录已删除");
      }

      function renderHistory() {
        var history = loadHistory();
        var list = el("historyList");

        if (!history.length) {
          list.innerHTML = '<li class="empty">暂无记录，先去算一条吧</li>';
          return;
        }

        list.innerHTML = history.map(function (item, index) {
          var main = "";
          var sub = "";
          var copyText = "";

          if (item.type === "diff") {
            main = item.start + " → " + item.end;
            sub = "时间差：" + formatHM(item.totalMinutes) + " / " +
              formatMinutesOnly(item.totalMinutes) + (item.crossedDay ? "（跨天）" : "");
            copyText = main + "\n" + sub;
          } else {
            main = item.baseTime + " " + item.directionText + " " + formatHM(item.shiftTotal);
            sub = "结果时间：" + item.resultTime;
            copyText = main + "\n" + sub;
          }

          return '<li class="history-item">' +
            '<div class="history-top"><span>记录 ' + (history.length - index) + '</span><span>' +
            escapeHtml(formatNow(item.timestamp)) + '</span></div>' +
            '<div class="history-main">' + escapeHtml(main) + '</div>' +
            '<div class="history-sub">' + escapeHtml(sub) + '</div>' +
            '<div class="history-actions">' +
              '<button class="history-action-btn history-copy-btn" type="button" data-action="copy" data-text="' + escapeHtml(copyText) + '">复制</button>' +
              '<button class="history-action-btn history-delete-btn" type="button" data-action="delete" data-index="' + index + '">删除</button>' +
            '</div>' +
          '</li>';
        }).join("");
      }


      function setActiveCalculator(type, skipSave){
        activeCalculator=type;
        el("timeCalculatorPanel").classList.toggle("active",type==="time");
        el("dateCalculatorPanel").classList.toggle("active",type==="date");
        el("appSwitchBtn").innerText=type==="time"?"日期计算器":"时间计算器";
        if (!skipSave) localStorage.setItem(LAST_CALCULATOR_KEY, type);
      }
      function setDateTab(tab){activeDateTab=tab;el("dateTabDiff").classList.toggle("active",tab==="diff");el("dateTabShift").classList.toggle("active",tab==="shift");el("datePanelDiff").classList.toggle("active",tab==="diff");el("datePanelShift").classList.toggle("active",tab==="shift");currentDateResult=null;renderDateResult();}
      function setDateDirection(value){el("dateDirection").value=value;var b=value==="back";el("dateDirectionBack").classList.toggle("active",b);el("dateDirectionForward").classList.toggle("active",!b);}
      function clampDateInputs(){
        ["dateStartY","dateEndY","dateBaseY"].forEach(function(id){el(id).addEventListener("input",function(){el(id).value=el(id).value.replace(/[^\d]/g,"").slice(0,4);});});
        ["dateStartM","dateEndM","dateBaseM"].forEach(function(id){el(id).addEventListener("input",function(){var v=el(id).value.replace(/[^\d]/g,"").slice(0,2);if(v!==""&&Number(v)>12)v="12";el(id).value=v;});});
        ["dateStartD","dateEndD","dateBaseD"].forEach(function(id){el(id).addEventListener("input",function(){var v=el(id).value.replace(/[^\d]/g,"").slice(0,2);if(v!==""&&Number(v)>31)v="31";el(id).value=v;});});
        el("dateShiftDays").addEventListener("input",function(){el("dateShiftDays").value=el("dateShiftDays").value.replace(/[^\d]/g,"").slice(0,5);});
      }
      function formatDate(d){return d.getFullYear()+"年"+pad(d.getMonth()+1)+"月"+pad(d.getDate())+"日";}
      function getDateInput(yid, mid, did, name) {
        if (inputMode === "native") {
          var nativeId = dateNativeId(yid);
          var value = nativeId && el(nativeId) ? el(nativeId).value : "";
          if (!value) return { ok: false, msg: "请选择" + name };
          var parts = value.split("-").map(Number);
          var y = parts[0], m = parts[1], d = parts[2];
          var dt = new Date(y, m - 1, d);
          if (!y || !m || !d || dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
            return { ok: false, msg: name + "不是有效日期" };
          }
          syncOneDateToNumeric(nativeId, yid, mid, did);
          return { ok: true, date: dt, text: formatDate(dt) };
        }

        var y = Number(el(yid).value), m = Number(el(mid).value), d = Number(el(did).value);
        if (!el(yid).value || !el(mid).value || !el(did).value) return { ok: false, msg: "请输入" + name + "的年月日" };
        var dt = new Date(y, m - 1, d);
        if (y < 1 || m < 1 || m > 12 || d < 1 || d > 31 || dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return { ok: false, msg: name + "不是有效日期" };
        return { ok: true, date: dt, text: formatDate(dt) };
      }

      function dateToInput(d, yid, mid, did) {
        el(yid).value = d.getFullYear();
        el(mid).value = pad(d.getMonth() + 1);
        el(did).value = pad(d.getDate());
        var nativeId = dateNativeId(yid);
        if (nativeId && el(nativeId)) el(nativeId).value = makeDateValue(d.getFullYear(), d.getMonth() + 1, d.getDate());
      }
      function dateDiffDays(a,b){return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);}
      function addDays(d,days){var r=new Date(d.getFullYear(),d.getMonth(),d.getDate());r.setDate(r.getDate()+days);return r;}
      function renderDateResult(){if(!currentDateResult){el("dateResultValue").innerText="结果会显示在这里";el("dateResultTip").innerText=activeDateTab==="diff"?"日期差会显示相差天数":"示例：2026年6月10日 前移7天 = 2026年6月3日";return;}if(currentDateResult.type==="dateDiff"){el("dateResultValue").innerText=currentDateResult.days+"天";el("dateResultTip").innerText=currentDateResult.start+" 到 "+currentDateResult.end;}else{el("dateResultValue").innerText=currentDateResult.resultDate;el("dateResultTip").innerText=currentDateResult.baseDate+" "+currentDateResult.directionText+currentDateResult.days+"天 = "+currentDateResult.resultDate+"，再点计算可继续累计";}}
      function loadDateHistory(){try{var d=JSON.parse(localStorage.getItem(DATE_STORAGE_KEY)||"[]");return Array.isArray(d)?d:[]}catch(e){return[]}}
      function saveDateHistory(h){localStorage.setItem(DATE_STORAGE_KEY,JSON.stringify(h));}
      function addDateHistory(r){
        var h=loadDateHistory();
        var limit=getHistoryLimit();
        var willRemoveOldest=h.length>=limit;
        h.unshift(r);
        saveDateHistory(h.slice(0,limit));
        renderDateHistory();
        updateHistoryLimitTips();
        if(willRemoveOldest){
          showHistoryToast("date","已保留最近 "+limit+" 条，最早记录已移除");
        }
      }
      function renderDateHistory(){var h=loadDateHistory(),list=el("dateHistoryList");if(!h.length){list.innerHTML='<li class="empty">暂无日期记录，先去算一条吧</li>';return;}list.innerHTML=h.map(function(item,index){var main="",sub="";if(item.type==="dateDiff"){main=item.start+" → "+item.end;sub="日期差："+item.days+"天";}else{main=item.baseDate+" "+item.directionText+item.days+"天";sub="结果日期："+item.resultDate;}var copy=main+"\n"+sub;return '<li class="history-item"><div class="history-top"><span>记录 '+(h.length-index)+'</span><span>'+escapeHtml(formatNow(item.timestamp))+'</span></div><div class="history-main">'+escapeHtml(main)+'</div><div class="history-sub">'+escapeHtml(sub)+'</div><div class="history-actions"><button class="history-action-btn history-copy-btn" type="button" data-action="copy" data-text="'+escapeHtml(copy)+'">复制</button><button class="history-action-btn history-delete-btn" type="button" data-action="delete-date" data-index="'+index+'">删除</button></div></li>';}).join("");}
      function calcDateDiff(){var s=getDateInput("dateStartY","dateStartM","dateStartD","开始日期"),e=getDateInput("dateEndY","dateEndM","dateEndD","结束日期");if(!s.ok)return setDateMessage(s.msg,"例如填写 2026 年 06 月 10 日");if(!e.ok)return setDateMessage(e.msg,"例如填写 2026 年 06 月 20 日");var diff=dateDiffDays(s.date,e.date),rev=diff<0;currentDateResult={type:"dateDiff",start:rev?e.text:s.text,end:rev?s.text:e.text,days:Math.abs(diff),timestamp:Date.now()};renderDateResult();addDateHistory(currentDateResult);}
      function calcDateShift(){var b=getDateInput("dateBaseY","dateBaseM","dateBaseD","基准日期");if(!b.ok)return setDateMessage(b.msg,"例如填写 2026 年 06 月 10 日");var days=Number(el("dateShiftDays").value||0);if(days<=0)return setDateMessage("请输入前移/后退天数","例如 7 天 或 30 天");var dir=el("dateDirection").value,txt=dir==="back"?"前移":"后退",res=addDays(b.date,dir==="back"?-days:days),rt=formatDate(res);currentDateResult={type:"dateShift",baseDate:b.text,directionText:txt,days:days,resultDate:rt,timestamp:Date.now()};renderDateResult();addDateHistory(currentDateResult);var hint=el("dateAccumHint");if(appSettings.accumulation!=="off"){dateToInput(res,"dateBaseY","dateBaseM","dateBaseD");if(hint)hint.innerText="已自动把基准日期更新为 "+rt+"，再点计算会继续累计";}else if(hint){hint.innerText="连续累计已关闭：基准日期保持为 "+b.text;}}
      function resetDateDiff(){["dateStartY","dateStartM","dateStartD","dateEndY","dateEndM","dateEndD","dateStartNative","dateEndNative"].forEach(function(id){el(id).value=""});currentDateResult=null;renderDateResult();}
      function resetDateShift(){["dateBaseY","dateBaseM","dateBaseD","dateShiftDays","dateBaseNative"].forEach(function(id){el(id).value=""});currentDateResult=null;updateAccumulationHints();renderDateResult();}
      function clearAllDateHistory(){if(!loadDateHistory().length)return setDateMessage("暂无日期记录可清空","先去算一条吧");openClearConfirm("date");}
      function doClearDateHistory(){localStorage.removeItem(DATE_STORAGE_KEY);renderDateHistory();setDateMessage("已清空全部日期记录","日期记录已删除");}
      function deleteDateHistoryItem(index){var h=loadDateHistory();h.splice(index,1);saveDateHistory(h);renderDateHistory();setDateMessage("已删除该条日期记录","日期记录已更新");}

      function calcDiff() {
        var start = getTime("startH", "startM", "开始时间");
        var end = getTime("endH", "endM", "结束时间");

        if (!start.ok) return setMessage(start.msg, "例如填写 08 和 30");
        if (!end.ok) return setMessage(end.msg, "例如填写 17 和 45");

        var endMinutes = end.minutes;
        var crossedDay = false;
        if (endMinutes < start.minutes) {
          endMinutes += 24 * 60;
          crossedDay = true;
        }

        currentResult = {
          type: "diff",
          start: start.text,
          end: end.text,
          totalMinutes: endMinutes - start.minutes,
          crossedDay: crossedDay,
          timestamp: Date.now()
        };

        displayMode = "hm";
        renderResult();
        addHistory(currentResult);
      }

      function setDirection(value) {
        el("direction").value = value;

        var isBack = value === "back";
        el("directionBack").classList.toggle("active", isBack);
        el("directionForward").classList.toggle("active", !isBack);
        el("directionBack").setAttribute("aria-pressed", isBack ? "true" : "false");
        el("directionForward").setAttribute("aria-pressed", !isBack ? "true" : "false");
      }

      // 同步时间计算器与日期计算器的前移/后退方向。
      function setDirectionSync(value) {
        setDirection(value);
        setDateDirection(value);
      }

      function calcShift() {
        var base = getTime("baseH", "baseM", "基准时间");
        if (!base.ok) return setMessage(base.msg, "例如填写 08 和 30");

        var sh = Number(el("shiftH").value || 0);
        var sm = Number(el("shiftM").value || 0);

        if (sh < 0 || sm < 0) return setMessage("时长不能小于 0", "请重新输入");
        var shiftTotal = sh * 60 + sm;

        if (shiftTotal === 0) return setMessage("请输入前移/后退时长", "例如 15分钟 或 1小时20分");

        var direction = el("direction").value;
        var directionText = direction === "back" ? "前移" : "后退";
        var result = direction === "back"
          ? base.minutes - shiftTotal
          : base.minutes + shiftTotal;

        var resultTime = minutesToTime(result);

        currentResult = {
          type: "shift",
          baseTime: base.text,
          directionText: directionText,
          shiftTotal: shiftTotal,
          resultTime: resultTime,
          timestamp: Date.now()
        };

        renderResult();
        addHistory(currentResult);

        // 连续计算：开启时把本次结果自动回填为新的基准时间
        var hint = el("shiftAccumHint");
        if (appSettings.accumulation !== "off") {
          setTimeValue("baseH", "baseM", resultTime);
          if (hint) {
            hint.innerText = "已自动把基准时间更新为 " + resultTime + "，再点计算会继续累计";
          }
        } else if (hint) {
          hint.innerText = "连续累计已关闭：基准时间保持为 " + base.text;
        }
      }

      function resetDiff() {
        ["startH", "startM", "endH", "endM", "startNative", "endNative"].forEach(function (id) { el(id).value = ""; });
        currentResult = null;
        displayMode = "hm";
        renderResult();
      }

      function resetShift() {
        ["baseH", "baseM", "shiftH", "shiftM", "baseNative"].forEach(function (id) { el(id).value = ""; });
        currentResult = null;
        var hint = el("shiftAccumHint");
        updateAccumulationHints();
        renderResult();
      }

      function setTab(tab) {
        activeTab = tab;
        el("tabDiff").classList.toggle("active", tab === "diff");
        el("tabShift").classList.toggle("active", tab === "shift");
        el("panelDiff").classList.toggle("active", tab === "diff");
        el("panelShift").classList.toggle("active", tab === "shift");
        currentResult = null;
        displayMode = "hm";
        renderResult();
      }

      // 同步“时间计算器”和“日期计算器”的模式：
      // 时间差 ↔ 日期差，前移/后退 ↔ 前移/后退。
      function setModeSync(tab, skipSave) {
        setTab(tab);
        setDateTab(tab);
        if (!skipSave) localStorage.setItem(LAST_MODE_KEY, tab);
      }


      function shouldShowChangelog() {
        var seenVersion = localStorage.getItem(CHANGELOG_SEEN_VERSION_KEY);

        // 版本更新后必须弹出一次，即使用户关闭了日常弹窗。
        if (seenVersion !== APP_VERSION) return true;

        return appSettings.changelogPopup !== "off";
      }

      function openChangelog() {
        if (!el("changelogOverlay")) return;
        el("changelogVersion").innerText = APP_VERSION;
        el("changelogOverlay").classList.add("show");
        el("changelogOverlay").setAttribute("aria-hidden", "false");
        document.body.classList.add("notice-lock");
      }

      function closeChangelog(markSeen) {
        if (!el("changelogOverlay")) return;
        if (markSeen) {
          localStorage.setItem(CHANGELOG_SEEN_VERSION_KEY, APP_VERSION);
        }
        el("changelogOverlay").classList.remove("show");
        el("changelogOverlay").setAttribute("aria-hidden", "true");
        document.body.classList.remove("notice-lock");
      }

      function disableChangelogPopupFromDialog() {
        appSettings.changelogPopup = "off";
        saveSettings();
        localStorage.setItem(CHANGELOG_SEEN_VERSION_KEY, APP_VERSION);
        syncSettingsForm();
        closeChangelog(false);
      }

      function showChangelogOnStartup() {
        if (shouldShowChangelog()) {
          setTimeout(function () {
            openChangelog();
          }, 260);
        }
      }

      function showNoticePage(page, options) {
        options = options || {};
        page = normalizePage(page, NOTICE_PAGES);
        if (options.skipSave) {
          resetNoticePageStack();
          renderNoticePageDirect(page);
          restoreScrollStable(getNoticeContent, 0);
          return;
        }
        if (page === "main") {
          backNoticePage();
        } else {
          openNoticeSubPage(page);
        }
      }

      function openNotice() {
        resetNoticePageStack();
        var overlay = el("noticeOverlay");
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
        document.body.classList.add("notice-lock");
        renderNoticePageDirect("main");
        restoreScrollStable(getNoticeContent, 0);
      }

      function closeNotice() {
        var content = getNoticeContent();
        if (content) {
          noticePageStack = captureNoticeStack();
          stopMomentumScroll(content);
        }
        resetNoticePageStack();
        renderNoticePageDirect("main");
        restoreScrollStable(getNoticeContent, 0);
        el("noticeOverlay").classList.remove("show");
        el("noticeOverlay").setAttribute("aria-hidden", "true");
        document.body.classList.remove("notice-lock");
      }

      function openClearConfirm(type) {
        el("clearConfirmType").value = type;
        el("clearConfirmTitle").innerText = type === "date" ? "清空日期记录？" : "清空时间记录？";
        el("clearConfirmText").innerText = "清空后无法恢复，请确认是否继续。";
        el("clearConfirmOverlay").classList.add("show");
        el("clearConfirmOverlay").setAttribute("aria-hidden", "false");
        document.body.classList.add("notice-lock");
      }

      function closeClearConfirm() {
        el("clearConfirmOverlay").classList.remove("show");
        el("clearConfirmOverlay").setAttribute("aria-hidden", "true");
        document.body.classList.remove("notice-lock");
      }

      function confirmClearRecords() {
        var type = el("clearConfirmType").value;
        closeClearConfirm();
        if (type === "date") {
          doClearDateHistory();
        } else {
          doClearHistory();
        }
      }

      function vibrateTap() {
        if (appSettings.vibration === "off") return;
        if (navigator.vibrate) {
          try {
            navigator.vibrate(12);
          } catch (e) {}
        }
      }

      function bindUnifiedVibration() {
        document.addEventListener("click", function (e) {
          var target = e.target.closest("button, #resultBox");
          if (!target) return;
          vibrateTap();
        }, true);
      }

      function bindTap(node, fn) {
        var startX = 0;
        var startY = 0;
        var startTime = 0;
        var tracking = false;
        var moved = false;
        var MOVE_LIMIT = 10;
        var TIME_LIMIT = 900;

        node.addEventListener("pointerdown", function (e) {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          startX = e.clientX;
          startY = e.clientY;
          startTime = Date.now();
          tracking = true;
          moved = false;
        });

        node.addEventListener("pointermove", function (e) {
          if (!tracking) return;
          var dx = Math.abs(e.clientX - startX);
          var dy = Math.abs(e.clientY - startY);
          if (dx > MOVE_LIMIT || dy > MOVE_LIMIT) {
            moved = true;
          }
        });

        node.addEventListener("pointercancel", function () {
          tracking = false;
          moved = false;
        });

        node.addEventListener("pointerup", function (e) {
          if (!tracking) return;

          var dx = Math.abs(e.clientX - startX);
          var dy = Math.abs(e.clientY - startY);
          var elapsed = Date.now() - startTime;

          tracking = false;

          if (moved || dx > MOVE_LIMIT || dy > MOVE_LIMIT || elapsed > TIME_LIMIT) {
            return;
          }

          fn();
        });

        // 旧浏览器备用：如果不支持 PointerEvent，就用普通 click。
        node.addEventListener("click", function () {
          if (window.PointerEvent) return;
          fn();
        });
      }

      document.addEventListener("DOMContentLoaded", function () {
        loadSettings();
        applyAppearanceSettings();
        if (window.matchMedia) {
          var systemAppearanceQuery = window.matchMedia("(prefers-color-scheme: dark)");
          var onSystemAppearanceChange = function () { applyAppearanceSettings(); };
          if (systemAppearanceQuery.addEventListener) {
            systemAppearanceQuery.addEventListener("change", onSystemAppearanceChange);
          } else if (systemAppearanceQuery.addListener) {
            systemAppearanceQuery.addListener(onSystemAppearanceChange);
          }
        }
        bindUnifiedVibration();
        ["startH", "endH", "baseH"].forEach(function (id) { clampInput(el(id), 23); });
        ["startM", "endM", "baseM"].forEach(function (id) { clampInput(el(id), 59); });

        bindTap(el("settingsBtn"), openSettings);
        bindTap(el("settingsClose"), closeSettings);
        bindTap(el("settingsDone"), applySettingsFromPending);
        bindTap(el("settingsReset"), resetSettings);
        bindTap(el("settingsBack"), function () { showSettingsPage("main"); });
        document.querySelectorAll("[data-settings-page]").forEach(function (node) {
          bindTap(node, function () {
            showSettingsPage(node.getAttribute("data-settings-page"));
          });
        });
        bindSettingsRadios();
        ["startNative", "endNative", "baseNative"].forEach(function (id) {
          el(id).addEventListener("input", function () {
            if (id === "startNative") syncOneTimeToNumeric(id, "startH", "startM");
            if (id === "endNative") syncOneTimeToNumeric(id, "endH", "endM");
            if (id === "baseNative") syncOneTimeToNumeric(id, "baseH", "baseM");
          });
        });
        ["dateStartNative", "dateEndNative", "dateBaseNative"].forEach(function (id) {
          el(id).addEventListener("input", function () {
            if (id === "dateStartNative") syncOneDateToNumeric(id, "dateStartY", "dateStartM", "dateStartD");
            if (id === "dateEndNative") syncOneDateToNumeric(id, "dateEndY", "dateEndM", "dateEndD");
            if (id === "dateBaseNative") syncOneDateToNumeric(id, "dateBaseY", "dateBaseM", "dateBaseD");
          });
        });

        bindTap(el("appSwitchBtn"), function () { setActiveCalculator(activeCalculator === "time" ? "date" : "time"); });
        bindTap(el("tabDiff"), function () { setModeSync("diff"); });
        bindTap(el("tabShift"), function () { setModeSync("shift"); });
        bindTap(el("dateTabDiff"), function () { setModeSync("diff"); });
        bindTap(el("dateTabShift"), function () { setModeSync("shift"); });
        bindTap(el("dateDirectionBack"), function () { setDirectionSync("back"); });
        bindTap(el("dateDirectionForward"), function () { setDirectionSync("forward"); });
        bindTap(el("calcDateDiffBtn"), calcDateDiff);
        bindTap(el("resetDateDiffBtn"), resetDateDiff);
        bindTap(el("calcDateShiftBtn"), calcDateShift);
        bindTap(el("resetDateShiftBtn"), resetDateShift);
        bindTap(el("clearDateHistoryBtn"), clearAllDateHistory);

        bindTap(el("directionBack"), function () { setDirectionSync("back"); });
        bindTap(el("directionForward"), function () { setDirectionSync("forward"); });

        bindTap(el("calcDiffBtn"), calcDiff);
        bindTap(el("resetDiffBtn"), resetDiff);
        bindTap(el("calcShiftBtn"), calcShift);
        bindTap(el("resetShiftBtn"), resetShift);
        bindTap(el("clearHistoryBtn"), clearAllHistory);
        bindTap(el("clearConfirmCancel"), closeClearConfirm);
        bindTap(el("clearConfirmOk"), confirmClearRecords);

        el("historyList").addEventListener("click", function (e) {
          var btn = e.target.closest(".history-action-btn"); if (!btn) return;
          e.preventDefault(); e.stopPropagation(); var action = btn.getAttribute("data-action");
          if (action === "copy") return copyText(btn.getAttribute("data-text") || "", btn);
          if (action === "delete") deleteHistoryItem(Number(btn.getAttribute("data-index")));
        });
        el("dateHistoryList").addEventListener("click", function (e) {
          var btn = e.target.closest(".history-action-btn"); if (!btn) return;
          e.preventDefault(); e.stopPropagation(); var action = btn.getAttribute("data-action");
          if (action === "copy") return copyText(btn.getAttribute("data-text") || "", btn);
          if (action === "delete-date") deleteDateHistoryItem(Number(btn.getAttribute("data-index")));
        });
bindTap(el("resultBox"), function () {
          if (!currentResult || currentResult.type !== "diff") return;
          displayMode = displayMode === "hm" ? "minutes" : "hm";
          renderResult();
        });

        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape" && el("clearConfirmOverlay").classList.contains("show")) {
            closeClearConfirm();
            return;
          }
          if (e.key === "Escape" && el("settingsOverlay").classList.contains("show")) {
            closeSettings();
            return;
          }
          if (e.key === "Escape" && el("changelogOverlay").classList.contains("show")) {
            closeChangelog(true);
            return;
          }
          if (e.key === "Escape" && el("noticeOverlay").classList.contains("show")) {
            closeNotice();
          }
        });


        el("noticeBtn").onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          openNotice();
        };

        el("noticeClose").onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          closeNotice();
        };

        el("noticeOk").onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          closeNotice();
        };

        bindTap(el("noticeBack"), function () { showNoticePage("main"); });
        document.querySelectorAll("[data-notice-page]").forEach(function (node) {
          bindTap(node, function () {
            showNoticePage(node.getAttribute("data-notice-page"));
          });
        });

        el("changelogOk").onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          closeChangelog(true);
        };

        el("changelogNever").onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          disableChangelogPopupFromDialog();
        };

        el("clearConfirmOverlay").onclick = function (e) {
          if (e.target === el("clearConfirmOverlay")) {
            e.preventDefault();
            e.stopPropagation();
            closeClearConfirm();
          }
        };

        el("settingsOverlay").onclick = function (e) {
          if (e.target === el("settingsOverlay")) {
            e.preventDefault();
            e.stopPropagation();
            closeSettings();
          }
        };

        el("noticeOverlay").onclick = function (e) {
          if (e.target === el("noticeOverlay")) {
            e.preventDefault();
            e.stopPropagation();
            closeNotice();
          }
        };

        el("changelogOverlay").onclick = function (e) {
          if (e.target === el("changelogOverlay")) {
            e.preventDefault();
            e.stopPropagation();
            closeChangelog(true);
          }
        };

        clampDateInputs();
        loadInputMode();
        setDateDirection("back");
        setDirection("back");
        applyStartupSettings();
        syncSettingsForm();
        updateAccumulationHints();
        trimHistoryToLimit();
        renderResult();
        renderHistory();
        renderDateResult();
        renderDateHistory();
        updateHistoryLimitTips();
        showChangelogOnStartup();
      });
    })();
