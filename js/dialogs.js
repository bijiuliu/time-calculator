/* 更新日志、公告及清空确认弹窗。 */
      function shouldShowChangelog() {
        var seenVersion = localStorage.getItem(CHANGELOG_SEEN_VERSION_KEY);

        // 版本更新后必须弹出一次，即使用户关闭了日常弹窗。
        if (seenVersion !== APP_VERSION) return true;

        return appSettings.changelogPopup !== "off";
      }

      function openChangelog() {
        var overlay = el("changelogOverlay");
        if (!overlay) return;
        clearTimeout(changelogCloseAnimationTimer);
        clearCrystalDialogOpening(overlay);
        el("changelogVersion").innerText = APP_VERSION;
        syncChangelogCrystalButton();
        overlay.classList.remove("closing", "crystal-dialog-closing");
        overlay.classList.add("show");
        if (document.body.classList.contains("appearance-crystal")) {
          prepareCrystalDialogOpening(overlay);
        }
        overlay.setAttribute("aria-hidden", "false");
        document.body.classList.add("notice-lock");
      }

      function closeChangelog(markSeen) {
        var overlay = el("changelogOverlay");
        if (!overlay) return;
        if (markSeen) {
          localStorage.setItem(CHANGELOG_SEEN_VERSION_KEY, APP_VERSION);
        }

        function finishChangelogClose() {
          changelogCloseAnimationTimer = null;
          overlay.classList.remove("show", "closing", "crystal-dialog-closing");
          overlay.setAttribute("aria-hidden", "true");
          document.body.classList.remove("notice-lock");
        }

        clearTimeout(changelogCloseAnimationTimer);
        var reduceMotion = prefersReducedMotion();
        var isCrystalAppearance = document.body.classList.contains("appearance-crystal");
        if (!overlay.classList.contains("show") || reduceMotion) {
          finishChangelogClose();
          return;
        }

        overlay.classList.add("closing");
        overlay.setAttribute("aria-hidden", "true");
        if (isCrystalAppearance) {
          void overlay.offsetWidth;
          overlay.classList.add("crystal-dialog-closing");
        }
        changelogCloseAnimationTimer = window.setTimeout(
          finishChangelogClose,
          isCrystalAppearance ? 180 : 160
        );
      }

      function disableChangelogPopupFromDialog() {
        appSettings.changelogPopup = "off";
        saveSettings();
        localStorage.setItem(CHANGELOG_SEEN_VERSION_KEY, APP_VERSION);
        syncSettingsForm();
        closeChangelog(false);
      }

      function syncChangelogCrystalButton() {
        var button = el("changelogCrystalBtn");
        if (!button) return;
        var enabled = appSettings.appearance === "crystal";
        button.classList.toggle("applied", enabled);
        button.setAttribute("aria-pressed", enabled ? "true" : "false");
        button.innerText = enabled ? "质感已启用" : "质感外观";
      }

      function applyCrystalFromChangelog() {
        appSettings.appearance = "crystal";
        if (pendingSettings) pendingSettings.appearance = "crystal";
        saveSettings();
        applyAppearanceSettings();
        syncSettingsForm();
        syncChangelogCrystalButton();
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
        clearTimeout(noticeCloseAnimationTimer);
        resetNoticePageStack();
        var overlay = el("noticeOverlay");
        overlay.classList.remove("closing", "crystal-dialog-closing");
        overlay.classList.add("show");
        prepareCrystalDialogOpening(overlay);
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

        var overlay = el("noticeOverlay");
        clearCrystalDialogOpening(overlay);

        function finishNoticeClose() {
          resetNoticePageStack();
          renderNoticePageDirect("main");
          restoreScrollStable(getNoticeContent, 0);
          overlay.classList.remove("show", "closing", "crystal-dialog-closing");
          overlay.setAttribute("aria-hidden", "true");
          document.body.classList.remove("notice-lock");
        }

        clearTimeout(noticeCloseAnimationTimer);
        var reduceMotion = prefersReducedMotion();
        var isCrystalAppearance = document.body.classList.contains("appearance-crystal");
        if (!overlay || !overlay.classList.contains("show") || reduceMotion) {
          finishNoticeClose();
          return;
        }

        overlay.classList.add("closing");
        overlay.setAttribute("aria-hidden", "true");
        if (isCrystalAppearance) {
          void overlay.offsetWidth;
          overlay.classList.add("crystal-dialog-closing");
        }
        noticeCloseAnimationTimer = window.setTimeout(
          finishNoticeClose,
          isCrystalAppearance ? 180 : 160
        );
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
        var preservedScrollY = window.scrollY || window.pageYOffset || 0;
        closeClearConfirm();
        window.scrollTo(0, preservedScrollY);
        if (type === "date") {
          animateClearHistory("date", doClearDateHistory);
        } else {
          animateClearHistory("time", doClearHistory);
        }
      }
