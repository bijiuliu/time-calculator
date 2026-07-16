/* 应用启动与 DOM 事件绑定。依赖其余脚本先加载。 */
      function bindDialogClickAction(node, action) {
        if (!node) return;
        node.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          runAfterMobilePressFeedback(node, action);
        };
      }

      document.addEventListener("DOMContentLoaded", function () {
        loadSettings();
        applyAppearanceSettings();
        bindMobilePressFeedback();
        if (systemAppearanceQuery) {
          var onSystemAppearanceChange = function () {
            if (appSettings.appearance !== "system") return;
            updateSystemAppearanceClass();
            updateBrowserAppearance();
          };
          if (systemAppearanceQuery.addEventListener) {
            systemAppearanceQuery.addEventListener("change", onSystemAppearanceChange);
          } else if (systemAppearanceQuery.addListener) {
            systemAppearanceQuery.addListener(onSystemAppearanceChange);
          }
        }
        bindUnifiedVibration();
        clampInput(el("startH"), 23, "startM");
        clampInput(el("startM"), 59, "endH");
        clampInput(el("endH"), 23, "endM");
        clampInput(el("endM"), 59);
        clampInput(el("baseH"), 23, "baseM");
        clampInput(el("baseM"), 59, "shiftH");
        bindSpaceAdvance(el("shiftH"), "shiftM");

        bindDialogClickAction(el("settingsBtn"), openSettings);
        bindDialogClickAction(el("settingsClose"), closeSettings);
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
        bindTap(el("calcDateModeBtn"), function () { activeDateTab === "diff" ? calcDateDiff() : calcDateShift(); });
        bindTap(el("resetDateModeBtn"), function () { activeDateTab === "diff" ? resetDateDiff() : resetDateShift(); });
        bindTap(el("clearDateHistoryBtn"), clearAllDateHistory);

        bindTap(el("directionBack"), function () { setDirectionSync("back"); });
        bindTap(el("directionForward"), function () { setDirectionSync("forward"); });

        bindDraggableSegmentedSlider(el("tabDiff").parentElement, ["diff", "shift"], setModeSync);
        bindDraggableSegmentedSlider(el("dateTabDiff").parentElement, ["diff", "shift"], setModeSync);
        bindDraggableSegmentedSlider(el("directionBack").parentElement, ["back", "forward"], setDirectionSync);
        bindDraggableSegmentedSlider(el("dateDirectionBack").parentElement, ["back", "forward"], setDirectionSync);

        bindTap(el("calcModeBtn"), function () { activeTab === "diff" ? calcDiff() : calcShift(); });
        bindTap(el("resetModeBtn"), function () { activeTab === "diff" ? resetDiff() : resetShift(); });
        bindTap(el("clearHistoryBtn"), clearAllHistory);
        bindTap(el("clearConfirmCancel"), closeClearConfirm);
        bindTap(el("clearConfirmOk"), confirmClearRecords);

        el("historyList").addEventListener("click", function (e) {
          var btn = e.target.closest(".history-action-btn"); if (!btn) return;
          if (btn.disabled) return;
          e.preventDefault(); e.stopPropagation(); var action = btn.getAttribute("data-action");
          if (action === "copy") return copyText(btn.getAttribute("data-text") || "", btn);
          if (action === "delete") {
            var historyItem = btn.closest(".history-item");
            var timestamp = historyItem ? historyItem.getAttribute("data-timestamp") : "";
            animateHistoryRemoval(btn, function (list) {
              deleteHistoryItem(Number(btn.getAttribute("data-index")), timestamp, list);
            });
          }
        });
        el("dateHistoryList").addEventListener("click", function (e) {
          var btn = e.target.closest(".history-action-btn"); if (!btn) return;
          if (btn.disabled) return;
          e.preventDefault(); e.stopPropagation(); var action = btn.getAttribute("data-action");
          if (action === "copy") return copyText(btn.getAttribute("data-text") || "", btn);
          if (action === "delete-date") {
            animateHistoryRemoval(btn, function (list) {
              deleteDateHistoryItem(Number(btn.getAttribute("data-index")), list);
            });
          }
        });
bindTap(el("resultBox"), function () {
          switchResultDisplayMode();
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

        document.addEventListener("click", function (e) {
          if (!document.body.classList.contains("appearance-crystal")) return;
          var button = e.target.closest("button");
          if (!button || button.disabled) return;
          var isMobileViewport = window.matchMedia &&
            window.matchMedia("(max-width: 640px)").matches;
          if (button.matches(".changelog-never") && !isMobileViewport) {
            button.classList.remove("stereo-secondary-clicked");
            void button.offsetWidth;
            button.classList.add("stereo-secondary-clicked");
            window.setTimeout(function () {
              button.classList.remove("stereo-secondary-clicked");
            }, 240);
            return;
          }
          if (!button.matches(".btn-primary, .changelog-ok, .notice-ok, .confirm-ok, #settingsDone")) return;
          button.classList.remove("stereo-clicked");
          void button.offsetWidth;
          button.classList.add("stereo-clicked");
          window.setTimeout(function () {
            button.classList.remove("stereo-clicked");
          }, 420);
        }, true);


        bindDialogClickAction(el("noticeBtn"), openNotice);
        bindDialogClickAction(el("noticeClose"), closeNotice);

        bindDialogClickAction(el("noticeOk"), closeNotice);

        bindTap(el("noticeBack"), function () { showNoticePage("main"); });
        document.querySelectorAll("[data-notice-page]").forEach(function (node) {
          bindTap(node, function () {
            showNoticePage(node.getAttribute("data-notice-page"));
          });
        });

        bindDialogClickAction(el("changelogOk"), function () {
          closeChangelog(true);
        });

        bindDialogClickAction(el("changelogNever"), disableChangelogPopupFromDialog);

        bindTap(el("changelogCrystalBtn"), applyCrystalFromChangelog);

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
