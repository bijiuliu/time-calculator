/* 设置与公告的页面栈、滚动恢复及通用弹窗开场动效。 */
      function prefersReducedMotion() {
        return window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      }

      function clearCrystalDialogOpening(overlay) {
        if (!overlay) return;
        if (overlay._crystalOpenFrame) {
          window.cancelAnimationFrame(overlay._crystalOpenFrame);
          overlay._crystalOpenFrame = 0;
        }
        if (overlay._crystalOpenTimer) {
          window.clearTimeout(overlay._crystalOpenTimer);
          overlay._crystalOpenTimer = 0;
        }
        overlay.classList.remove("crystal-dialog-entering", "crystal-dialog-entered");
      }

      function prepareCrystalDialogOpening(overlay) {
        clearCrystalDialogOpening(overlay);
        overlay.classList.remove("crystal-dialog-closing");
        if (prefersReducedMotion()) return;

        overlay.classList.add("crystal-dialog-entering");
        /* Commit the hidden starting state while the overlay is mounted, then
           start the transition on the next frame. One frame is sufficient and
           avoids the previous double-rAF interaction delay. */
        void overlay.offsetWidth;
        var activate = function () {
          overlay.classList.add("crystal-dialog-entered");
          var cleanupDelay = document.body.classList.contains("appearance-crystal") ? 340 : 240;
          overlay._crystalOpenTimer = window.setTimeout(function () {
            overlay._crystalOpenTimer = 0;
            overlay.classList.remove("crystal-dialog-entering", "crystal-dialog-entered");
          }, cleanupDelay);
        };

        if (typeof window.requestAnimationFrame !== "function") {
          overlay._crystalOpenTimer = window.setTimeout(activate, 0);
          return;
        }
        overlay._crystalOpenFrame = window.requestAnimationFrame(function () {
          overlay._crystalOpenFrame = 0;
          activate();
        });
      }

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

      function capturePageStack(stack, validPages, getContent) {
        stack = normalizePageStack(stack, validPages);
        var content = getContent();
        if (content && stack.length) {
          stack[stack.length - 1].scrollTop = content.scrollTop || 0;
        }
        return stack;
      }

      function captureNoticeStack() {
        return capturePageStack(noticePageStack, NOTICE_PAGES, getNoticeContent);
      }

      function captureSettingsStack() {
        return capturePageStack(settingsPageStack, SETTINGS_PAGES, getSettingsContent);
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
          date: "日期差、前移/后退、连续累计和输入方式",
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

      function switchPageStack(config, nextStack) {
        if (config.isSwitching()) return;
        nextStack = normalizePageStack(nextStack, config.validPages);
        var target = nextStack[nextStack.length - 1];
        var currentStack = config.getStack();
        var direction = nextStack.length < currentStack.length ? "back" : "forward";
        var content = config.getContent();
        var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        var outDuration = reduceMotion ? 0 : 100;
        var inDuration = reduceMotion ? 0 : 160;

        config.setSwitching(true);
        var releaseMomentum = lockMomentumScroll(content);
        if (content && !reduceMotion) content.classList.add("page-nav-out-" + direction);

        setTimeout(function () {
          if (content) content.classList.remove("page-nav-out-forward", "page-nav-out-back");
          config.setStack(nextStack);
          config.render(target.page);
          restoreScrollStable(config.getContent, target.scrollTop);

          content = config.getContent();
          if (content && !reduceMotion) {
            content.classList.add("page-nav-in-" + direction);
            content.offsetHeight;
          }

          setTimeout(function () {
            if (content) content.classList.remove("page-nav-in-forward", "page-nav-in-back");
            releaseMomentum();
            config.setSwitching(false);
          }, inDuration);
        }, outDuration);
      }

      function switchNoticeStack(nextStack) {
        switchPageStack({
          validPages: NOTICE_PAGES,
          getContent: getNoticeContent,
          getStack: function () { return noticePageStack; },
          setStack: function (stack) { noticePageStack = stack; },
          isSwitching: function () { return noticePageSwitching; },
          setSwitching: function (value) { noticePageSwitching = value; },
          render: renderNoticePageDirect
        }, nextStack);
      }


      function switchSettingsStack(nextStack) {
        switchPageStack({
          validPages: SETTINGS_PAGES,
          getContent: getSettingsContent,
          getStack: function () { return settingsPageStack; },
          setStack: function (stack) { settingsPageStack = stack; },
          isSwitching: function () { return settingsPageSwitching; },
          setSwitching: function (value) { settingsPageSwitching = value; },
          render: renderSettingsPageDirect
        }, nextStack);
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
