/* 结果渲染、历史记录、复制、删除与清空动画。 */
      function animateResultDisplay(boxId, valueOnly) {
        var box = el(boxId);
        if (!box || !document.body.classList.contains("appearance-crystal")) return;
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        var animationClass = valueOnly ? "result-value-updating" : "result-animating";
        box.classList.remove("result-animating", "result-value-updating");
        void box.offsetWidth;
        box.classList.add(animationClass);
        window.clearTimeout(box._resultAnimationTimer);
        box._resultAnimationTimer = window.setTimeout(function () {
          box.classList.remove("result-animating", "result-value-updating");
        }, valueOnly ? 210 : 380);
      }

      function renderResult(valueOnly) {
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
            formatHM(currentResult.shiftTotal) + " = " + currentResult.resultTime;
        }
        if (!valueOnly) animateResultDisplay("resultBox", false);
      }

      function switchResultDisplayMode() {
        if (!currentResult || currentResult.type !== "diff") return;
        var value = el("resultValue");
        var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!value || reduceMotion) {
          displayMode = displayMode === "hm" ? "minutes" : "hm";
          renderResult(true);
          return;
        }
        if (value._unitSwitchBusy) return;
        var sourceResult = currentResult;
        value._unitSwitchBusy = true;
        value.classList.remove("result-unit-entering");
        value.classList.add("result-unit-leaving");
        window.clearTimeout(value._unitSwitchTimer);
        value._unitSwitchTimer = window.setTimeout(function () {
          if (currentResult !== sourceResult) {
            value.classList.remove("result-unit-leaving", "result-unit-entering");
            value._unitSwitchBusy = false;
            return;
          }
          displayMode = displayMode === "hm" ? "minutes" : "hm";
          renderResult(true);
          value.classList.remove("result-unit-leaving");
          void value.offsetWidth;
          value.classList.add("result-unit-entering");
          value._unitSwitchTimer = window.setTimeout(function () {
            value.classList.remove("result-unit-entering");
            value._unitSwitchBusy = false;
          }, 80);
        }, 50);
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

      function animateHistoryRemoval(btn, onDone) {
        var item = btn && btn.closest(".history-item");
        if (!item || item.classList.contains("history-removing")) return;

        var list = item.parentElement;
        var listButtons = list ? list.querySelectorAll(".history-action-btn") : [];
        listButtons.forEach(function (node) { node.disabled = true; });

        var reduceMotion = window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        var isCrystal = document.body.classList.contains("appearance-crystal");
        var duration = reduceMotion ? 120 : (isCrystal ? 420 : 380);
        var finished = false;
        var fallbackTimer = 0;

        function finish() {
          if (finished) return;
          finished = true;
          if (fallbackTimer) window.clearTimeout(fallbackTimer);
          item.removeEventListener("transitionend", handleTransitionEnd);
          if (item.parentElement) item.remove();
          onDone(list);
        }

        function handleTransitionEnd(event) {
          if (event.target !== item || event.propertyName !== "height") return;
          finish();
        }

        item.style.height = item.offsetHeight + "px";
        item.style.boxSizing = "border-box";
        item.classList.add("history-removing");
        void item.offsetHeight;

        requestAnimationFrame(function () {
          item.classList.add("history-removing-active");
          item.classList.add("history-collapsing");
          item.style.height = "0px";
          if (item.previousElementSibling) {
            item.style.marginTop = "0px";
          } else if (item.nextElementSibling) {
            item.style.marginBottom = "-10px";
          }
        });

        item.addEventListener("transitionend", handleTransitionEnd);
        fallbackTimer = window.setTimeout(finish, duration + 100);
      }

      function syncHistoryListAfterRemoval(list, emptyText) {
        if (!list) return;
        var items = Array.prototype.slice.call(list.querySelectorAll(".history-item"));
        if (!items.length) {
          list.innerHTML = '<li class="empty">' + emptyText + '</li>';
          return;
        }

        items.forEach(function (item, index) {
          var label = item.querySelector(".history-top span:first-child");
          var deleteButton = item.querySelector(".history-delete-btn");
          if (label) label.textContent = "记录 " + (items.length - index);
          if (deleteButton) deleteButton.setAttribute("data-index", String(index));
          item.querySelectorAll(".history-action-btn").forEach(function (button) {
            button.disabled = false;
          });
        });
      }

      function deleteHistoryItem(index, timestamp, list) {
        var history = loadHistory();
        if (timestamp) {
          var matchedIndex = history.findIndex(function (item) {
            return String(item.timestamp) === String(timestamp);
          });
          if (matchedIndex !== -1) index = matchedIndex;
        }
        if (index < 0 || index >= history.length) {
          renderHistory();
          return;
        }
        history.splice(index, 1);
        saveHistory(history);
        if (list) syncHistoryListAfterRemoval(list, "暂无记录，先去算一条吧");
        else renderHistory();
        setMessage("已删除该条记录", "历史记录已更新");
      }

      function animateClearHistory(type, onDone) {
        if (historyClearAnimating[type]) return;

        var list = el(type === "date" ? "dateHistoryList" : "historyList");
        var items = list ? Array.prototype.slice.call(list.querySelectorAll(".history-item")) : [];
        var reduceMotion = window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (!items.length || reduceMotion) {
          onDone();
          return;
        }

        historyClearAnimating[type] = true;
        var isCrystal = document.body.classList.contains("appearance-crystal");
        var duration = isCrystal ? 370 : 340;
        var stagger = 52;
        var lockedListHeight = list.offsetHeight;
        var snapshotLayer = document.createElement("div");
        var snapshots = [];

        snapshotLayer.className = "history-clear-snapshot-layer";
        snapshotLayer.setAttribute("aria-hidden", "true");
        list.classList.add("history-clear-layout-locked");
        list.style.height = lockedListHeight + "px";

        items.forEach(function (item, index) {
          var rect = item.getBoundingClientRect();
          var snapshot = item.cloneNode(true);

          item.querySelectorAll(".history-action-btn").forEach(function (button) {
            button.disabled = true;
          });

          snapshot.classList.add("history-clear-snapshot");
          snapshot.querySelectorAll("button").forEach(function (button) {
            button.disabled = true;
            button.tabIndex = -1;
          });
          snapshot.style.left = rect.left + "px";
          snapshot.style.top = rect.top + "px";
          snapshot.style.width = rect.width + "px";
          snapshot.style.height = rect.height + "px";
          snapshot.style.setProperty("--history-clear-duration", duration + "ms");
          snapshotLayer.appendChild(snapshot);
          snapshots.push(snapshot);
        });

        document.body.appendChild(snapshotLayer);
        onDone();

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            snapshots.forEach(function (snapshot, index) {
              window.setTimeout(function () {
                snapshot.classList.add("history-clear-snapshot-active");
              }, index * stagger);
            });
          });
        });

        var lastSnapshotStart = (items.length - 1) * stagger;
        var settleLead = 90;

        window.setTimeout(function () {
          var emptyItem = list.querySelector(".empty");
          list.style.height = "auto";
          var settledHeight = list.offsetHeight;
          list.style.height = lockedListHeight + "px";
          void list.offsetHeight;
          list.classList.add("history-clear-settling");

          requestAnimationFrame(function () {
            list.style.height = settledHeight + "px";
            if (emptyItem) emptyItem.classList.add("history-clear-empty-visible");
          });

          window.setTimeout(function () {
            list.classList.remove("history-clear-layout-locked", "history-clear-settling");
            list.style.removeProperty("height");
            historyClearAnimating[type] = false;
          }, 275);
        }, lastSnapshotStart + duration - settleLead);

        window.setTimeout(function () {
          if (snapshotLayer.parentElement) snapshotLayer.remove();
        }, lastSnapshotStart + duration + 20);
      }

      function clearAllHistory() {
        if (historyClearAnimating.time) return;
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

          return '<li class="history-item" data-history-key="' + escapeHtml(item.timestamp) + '" data-timestamp="' + escapeHtml(item.timestamp) + '">' +
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


