/* 核心状态、基础工具、输入模式与持久化设置。 */
      var STORAGE_KEY = "timeCalculatorHistoryV3";
      var DATE_STORAGE_KEY = "dateCalculatorHistoryV1";
      var INPUT_MODE_KEY = "calculatorInputModeV1";
      var SETTINGS_KEY = "calculatorSettingsV1";
      var APP_VERSION = "v1.5.0";
      var CHANGELOG_SEEN_VERSION_KEY = "calculatorChangelogSeenVersionV1";
      var LAST_CALCULATOR_KEY = "calculatorLastCalculatorV1";
      var LAST_MODE_KEY = "calculatorLastModeV1";
      var systemAppearanceQuery = window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
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
      var historyClearAnimating = { time: false, date: false };
      var mobileActionReady = new WeakMap();

      function el(id) { return document.getElementById(id); }
      function pad(n) { return String(n).padStart(2, "0"); }
      function isMobileLayout() {
        return window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
      }

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
            if (["light", "dark", "system", "crystal"].indexOf(saved.appearance) !== -1) appSettings.appearance = saved.appearance;
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
      var noticeCloseAnimationTimer = null;
      var changelogCloseAnimationTimer = null;
      var currentSettingsPage = "main";
      var lastSettingsPageBeforeClose = "main";
      var lastSettingsClosedAt = 0;
      var lastSettingsStackBeforeClose = null;
      var SETTINGS_RESTORE_WINDOW = 15000;
      var SETTINGS_DEFAULT_TIP = "修改设置后，请点击“应用”生效；点击“恢复默认”只会先填入默认设置，需要再点击“应用”保存。";

