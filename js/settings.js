/* 设置表单、外观应用、启动偏好与历史条数设置。 */
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
        renderResult(true);
        renderDateResult(true);

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
        return !!(systemAppearanceQuery && systemAppearanceQuery.matches);
      }

      function updateSystemAppearanceClass() {
        document.body.classList.toggle("system-dark", appSettings.appearance === "system" && isSystemDarkMode());
      }

      function updateBrowserAppearance() {
        var effectiveDark = appSettings.appearance === "dark" ||
          (appSettings.appearance === "system" && isSystemDarkMode());
        var themeColor = appSettings.appearance === "crystal"
          ? "#eef6ff"
          : effectiveDark
          ? "#0f172a"
          : "#eef6ff";
        var themeMeta = document.querySelector('meta[name="theme-color"]');

        if (themeMeta) themeMeta.setAttribute("content", themeColor);
        document.documentElement.style.colorScheme = effectiveDark ? "dark" : "light";
      }

      function applyAppearanceSettings() {
        document.body.classList.remove("theme-green", "theme-purple", "theme-orange");

        document.body.classList.remove("appearance-light", "appearance-dark", "appearance-system", "appearance-crystal", "system-dark");
        document.body.classList.add("appearance-" + appSettings.appearance);
        updateSystemAppearanceClass();
        updateBrowserAppearance();

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
        var toastVisibleDuration = document.body.classList.contains("appearance-crystal") ? 2200 : 1600;
        historyToastTimer = setTimeout(function () {
          toast.classList.add("hide");
          setTimeout(function () {
            toast.remove();
          }, 180);
        }, toastVisibleDuration);
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
        overlay.classList.remove("closing", "crystal-dialog-closing");
        overlay.classList.add("show");
        prepareCrystalDialogOpening(overlay);
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
        clearCrystalDialogOpening(overlay);
        if (!overlay || !overlay.classList.contains("show")) {
          resetApplyButtonState();
          document.body.classList.remove("notice-lock");
          return;
        }

        overlay.classList.add("closing");
        overlay.setAttribute("aria-hidden", "true");

        var reduceMotion = prefersReducedMotion();
        var isCrystalAppearance = document.body.classList.contains("appearance-crystal");
        if (isCrystalAppearance && !reduceMotion) {
          void overlay.offsetWidth;
          overlay.classList.add("crystal-dialog-closing");
        }
        settingsCloseAnimationTimer = setTimeout(function () {
          overlay.classList.remove("show", "closing", "crystal-dialog-closing");
          document.body.classList.remove("notice-lock");
          resetApplyButtonState();
        }, reduceMotion ? 0 : (isCrystalAppearance ? 180 : 160));
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

