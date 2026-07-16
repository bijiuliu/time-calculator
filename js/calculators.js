/* 时间与日期计算、计算器切换、模式切换及结果回填。 */
      function setActiveCalculator(type, skipSave){
        activeCalculator=type;
        el("timeCalculatorPanel").classList.toggle("active",type==="time");
        el("dateCalculatorPanel").classList.toggle("active",type==="date");
        var switchBtn = el("appSwitchBtn");
        var switchLabel = type === "time" ? "切换到日期计算器" : "切换到时间计算器";
        var switchText = type === "time" ? "日期计算器" : "时间计算器";
        var switchTextEl = switchBtn.querySelector(".button-label");
        if (switchTextEl) switchTextEl.textContent = switchText;
        switchBtn.setAttribute("aria-label", switchLabel);
        switchBtn.setAttribute("title", switchLabel);
        if (!skipSave) localStorage.setItem(LAST_CALCULATOR_KEY, type);
      }
      function transitionModePanel(containerId, oldPanelId, newPanelId, shouldAnimate) {
        var container = el(containerId);
        var newPanel = el(newPanelId);
        if (!container || !newPanel) return;
        var token = (container._modeTransitionToken || 0) + 1;
        container._modeTransitionToken = token;
        window.clearTimeout(container._modeTransitionTimer);
        (container._modeAnimations || []).forEach(function (animation) {
          try { animation.cancel(); } catch (e) {}
        });
        container._modeAnimations = [];
        var panels = Array.prototype.slice.call(container.querySelectorAll(".panel"));
        var oldPanel = el(container._modeActivePanelId || oldPanelId) || panels.filter(function (panel) {
          return panel.classList.contains("active") && !panel.classList.contains("mode-panel-outgoing");
        })[0];
        panels.forEach(function (panel) {
          panel.classList.remove("mode-panel-outgoing");
          var action = panel.querySelector(".actions");
          if (action) action.style.visibility = "";
          panel.classList.toggle("active", panel === oldPanel);
        });
        container.classList.remove("mode-panels-transitioning");
        container.style.height = "";
        container.style.transition = "";

        var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        var hidden = container.offsetParent === null;
        if (!oldPanel || !shouldAnimate || reduceMotion || hidden || oldPanel === newPanel || typeof oldPanel.animate !== "function") {
          panels.forEach(function (panel) { panel.classList.toggle("active", panel === newPanel); });
          newPanel.classList.add("active");
          container._modeActivePanelId = newPanelId;
          return;
        }

        var oldHeight = oldPanel.getBoundingClientRect().height;
        var oldAction = oldPanel.querySelector(".actions");
        var oldActionTop = oldAction ? oldAction.getBoundingClientRect().top : 0;
        container.style.height = oldHeight + "px";
        container.classList.add("mode-panels-transitioning");
        oldPanel.classList.add("mode-panel-outgoing");
        newPanel.classList.add("active");
        container._modeActivePanelId = newPanelId;
        var newHeight = newPanel.getBoundingClientRect().height;
        var newAction = newPanel.querySelector(".actions");
        var newActionTop = newAction ? newAction.getBoundingClientRect().top : 0;
        var mobileTransition = isMobileLayout();
        var contentCrossfadeDuration = 200;
        var contentCrossfadeDelay = mobileTransition ? 80 : 60;
        var layoutDuration = mobileTransition ? 380 : 280;
        var layoutEasing = mobileTransition ? "cubic-bezier(0.32, 0, 0.20, 1)" : "cubic-bezier(0.22, 0.72, 0.28, 1)";
        var oldContentFrames = [{ opacity: 1 }, { opacity: 0 }];
        var newContentFrames = [{ opacity: 0 }, { opacity: 1 }];

        if (oldAction) oldAction.style.visibility = "hidden";
        // Animate each panel as one compositor layer. Animating every field separately
        // creates many overlapping layers and can trigger tile corruption on older iOS GPUs.
        container._modeAnimations.push(oldPanel.animate(oldContentFrames, {
          duration: contentCrossfadeDuration,
          delay: contentCrossfadeDelay,
          easing: "linear",
          fill: "both"
        }));
        container._modeAnimations.push(newPanel.animate(newContentFrames, {
          duration: contentCrossfadeDuration,
          delay: contentCrossfadeDelay,
          easing: "linear",
          fill: "both"
        }));
        if (newAction) {
          container._modeAnimations.push(newAction.animate([
            { transform: "translateY(" + (oldActionTop - newActionTop) + "px)" },
            { transform: "translateY(0)" }
          ], { duration: layoutDuration, easing: layoutEasing, fill: "both" }));
        }

        container.style.transition = "height " + layoutDuration + "ms " + layoutEasing;
        void container.offsetHeight;
        container.style.height = newHeight + "px";
        container._modeTransitionTimer = window.setTimeout(function () {
          if (container._modeTransitionToken !== token) return;
          (container._modeAnimations || []).forEach(function (animation) {
            try { animation.cancel(); } catch (e) {}
          });
          container._modeAnimations = [];
          panels.forEach(function (panel) {
            panel.classList.remove("mode-panel-outgoing");
            panel.classList.toggle("active", panel === newPanel);
            var action = panel.querySelector(".actions");
            if (action) action.style.visibility = "";
          });
          container.classList.remove("mode-panels-transitioning");
          container.style.height = "";
          container.style.transition = "";
        }, layoutDuration + 10);
      }

      function setDateTab(tab, shouldAnimate) {
        var previous = activeDateTab;
        activeDateTab = tab;
        el("dateTabDiff").classList.toggle("active", tab === "diff");
        el("dateTabShift").classList.toggle("active", tab === "shift");
        el("dateTabDiff").setAttribute("aria-selected", tab === "diff" ? "true" : "false");
        el("dateTabShift").setAttribute("aria-selected", tab === "shift" ? "true" : "false");
        el("dateTabDiff").parentElement.setAttribute("data-active", tab);
        var anchor = el("dateModeAnchor");
        var anchorLabel = el("dateModeAnchorLabel");
        var startInputs = el("dateModeStartInputs");
        var baseInputs = el("dateModeBaseInputs");
        if (anchor) anchor.setAttribute("data-active", tab);
        if (anchorLabel) anchorLabel.innerText = tab === "diff" ? "开始日期" : "基准日期";
        if (startInputs) {
          startInputs.classList.toggle("active", tab === "diff");
          startInputs.setAttribute("aria-hidden", tab === "diff" ? "false" : "true");
        }
        if (baseInputs) {
          baseInputs.classList.toggle("active", tab === "shift");
          baseInputs.setAttribute("aria-hidden", tab === "shift" ? "false" : "true");
        }
        transitionModePanel(
          "dateModePanels",
          previous === "diff" ? "datePanelDiff" : "datePanelShift",
          tab === "diff" ? "datePanelDiff" : "datePanelShift",
          shouldAnimate !== false
        );
        el("dateAccumHint").hidden = tab !== "shift";
        currentDateResult = null;
        renderDateResult();
      }
      function setDateDirection(value){el("dateDirection").value=value;var b=value==="back";el("dateDirectionBack").classList.toggle("active",b);el("dateDirectionForward").classList.toggle("active",!b);el("dateDirectionBack").setAttribute("aria-pressed",b?"true":"false");el("dateDirectionForward").setAttribute("aria-pressed",b?"false":"true");el("dateDirectionBack").parentElement.setAttribute("data-active",value);}
      function clampDateInputs(){
        var nextDateInput = {
          dateStartY: "dateStartM", dateStartM: "dateStartD", dateStartD: "dateEndY",
          dateEndY: "dateEndM", dateEndM: "dateEndD",
          dateBaseY: "dateBaseM", dateBaseM: "dateBaseD", dateBaseD: "dateShiftDays"
        };
        ["dateStartY","dateEndY","dateBaseY"].forEach(function(id){el(id).addEventListener("input",function(){var v=el(id).value.replace(/[^\d]/g,"").slice(0,4);el(id).value=v;});bindSpaceAdvance(el(id),nextDateInput[id]);});
        ["dateStartM","dateEndM","dateBaseM"].forEach(function(id){el(id).addEventListener("input",function(){var v=el(id).value.replace(/[^\d]/g,"").slice(0,2);if(v!==""&&Number(v)>12)v="12";el(id).value=v;});bindSpaceAdvance(el(id),nextDateInput[id]);});
        ["dateStartD","dateEndD","dateBaseD"].forEach(function(id){el(id).addEventListener("input",function(){var v=el(id).value.replace(/[^\d]/g,"").slice(0,2);if(v!==""&&Number(v)>31)v="31";el(id).value=v;});bindSpaceAdvance(el(id),nextDateInput[id]);});
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
        if (!el(yid).value || !el(mid).value || !el(did).value) return { ok: false, msg: "请输入" + name + (isMobileLayout() ? "" : "的年月日") };
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
      function renderDateResult(skipAnimation){if(!currentDateResult){el("dateResultValue").innerText="结果会显示在这里";el("dateResultTip").innerText=activeDateTab==="diff"?"日期差会显示相差天数":"示例：2026年6月10日 前移7天 = 2026年6月3日";return;}if(currentDateResult.type==="dateDiff"){el("dateResultValue").innerText=currentDateResult.days+"天";el("dateResultTip").innerText=currentDateResult.start+" 到 "+currentDateResult.end;}else{el("dateResultValue").innerText=currentDateResult.resultDate;el("dateResultTip").innerText=currentDateResult.baseDate+" "+currentDateResult.directionText+currentDateResult.days+"天 = "+currentDateResult.resultDate;}if(!skipAnimation)animateResultDisplay("dateResultBox");}
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
      function renderDateHistory(){var h=loadDateHistory(),list=el("dateHistoryList");if(!h.length){list.innerHTML='<li class="empty">暂无日期记录，先去算一条吧</li>';return;}list.innerHTML=h.map(function(item,index){var main="",sub="";if(item.type==="dateDiff"){main=item.start+" → "+item.end;sub="日期差："+item.days+"天";}else{main=item.baseDate+" "+item.directionText+item.days+"天";sub="结果日期："+item.resultDate;}var copy=main+"\n"+sub;return '<li class="history-item" data-history-key="'+escapeHtml(item.timestamp)+'"><div class="history-top"><span>记录 '+(h.length-index)+'</span><span>'+escapeHtml(formatNow(item.timestamp))+'</span></div><div class="history-main">'+escapeHtml(main)+'</div><div class="history-sub">'+escapeHtml(sub)+'</div><div class="history-actions"><button class="history-action-btn history-copy-btn" type="button" data-action="copy" data-text="'+escapeHtml(copy)+'">复制</button><button class="history-action-btn history-delete-btn" type="button" data-action="delete-date" data-index="'+index+'">删除</button></div></li>';}).join("");}
      function calcDateDiff(){var s=getDateInput("dateStartY","dateStartM","dateStartD","开始日期"),e=getDateInput("dateEndY","dateEndM","dateEndD","结束日期");if(!s.ok)return setDateMessage(s.msg,"例如填写 2026 年 06 月 10 日");if(!e.ok)return setDateMessage(e.msg,"例如填写 2026 年 06 月 20 日");var diff=dateDiffDays(s.date,e.date),rev=diff<0;currentDateResult={type:"dateDiff",start:rev?e.text:s.text,end:rev?s.text:e.text,days:Math.abs(diff),timestamp:Date.now()};renderDateResult();addDateHistory(currentDateResult);}
      function calcDateShift(){var b=getDateInput("dateBaseY","dateBaseM","dateBaseD","基准日期");if(!b.ok)return setDateMessage(b.msg,"例如填写 2026 年 06 月 10 日");var days=Number(el("dateShiftDays").value||0);if(days<=0)return setDateMessage("请输入前移/后退天数","例如 7 天 或 30 天");var dir=el("dateDirection").value,txt=dir==="back"?"前移":"后退",res=addDays(b.date,dir==="back"?-days:days),rt=formatDate(res);currentDateResult={type:"dateShift",baseDate:b.text,directionText:txt,days:days,resultDate:rt,timestamp:Date.now()};renderDateResult();addDateHistory(currentDateResult);var hint=el("dateAccumHint");if(appSettings.accumulation!=="off"){dateToInput(res,"dateBaseY","dateBaseM","dateBaseD");if(hint)hint.innerText="已将基准日期更新为 "+rt+"，再点计算会继续累计";}else if(hint){hint.innerText="连续累计已关闭：基准日期保持为 "+b.text;}}
      function resetDateDiff(){["dateStartY","dateStartM","dateStartD","dateEndY","dateEndM","dateEndD","dateStartNative","dateEndNative"].forEach(function(id){el(id).value=""});currentDateResult=null;renderDateResult();}
      function resetDateShift(){["dateBaseY","dateBaseM","dateBaseD","dateShiftDays","dateBaseNative"].forEach(function(id){el(id).value=""});currentDateResult=null;updateAccumulationHints();renderDateResult();}
      function clearAllDateHistory(){if(historyClearAnimating.date)return;if(!loadDateHistory().length)return setDateMessage("暂无记录可清空","先去算一条吧");openClearConfirm("date");}
      function doClearDateHistory(){localStorage.removeItem(DATE_STORAGE_KEY);renderDateHistory();setDateMessage("已清空全部日期记录","日期记录已删除");}
      function deleteDateHistoryItem(index,list){var h=loadDateHistory();if(index<0||index>=h.length){renderDateHistory();return;}h.splice(index,1);saveDateHistory(h);if(list)syncHistoryListAfterRemoval(list,"暂无日期记录，先去算一条吧");else renderDateHistory();setDateMessage("已删除该条日期记录","日期记录已更新");}

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
        el("directionBack").parentElement.setAttribute("data-active", value);
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
            hint.innerText = "已将基准时间更新为 " + resultTime + "，再点计算会继续累计";
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

      function setTab(tab, shouldAnimate) {
        var previous = activeTab;
        activeTab = tab;
        el("tabDiff").classList.toggle("active", tab === "diff");
        el("tabShift").classList.toggle("active", tab === "shift");
        el("tabDiff").setAttribute("aria-selected", tab === "diff" ? "true" : "false");
        el("tabShift").setAttribute("aria-selected", tab === "shift" ? "true" : "false");
        el("tabDiff").parentElement.setAttribute("data-active", tab);
        var anchor = el("timeModeAnchor");
        var anchorLabel = el("timeModeAnchorLabel");
        var startInputs = el("timeModeStartInputs");
        var baseInputs = el("timeModeBaseInputs");
        if (anchor) anchor.setAttribute("data-active", tab);
        if (anchorLabel) anchorLabel.innerText = tab === "diff" ? "开始时间" : "基准时间";
        if (startInputs) {
          startInputs.classList.toggle("active", tab === "diff");
          startInputs.setAttribute("aria-hidden", tab === "diff" ? "false" : "true");
        }
        if (baseInputs) {
          baseInputs.classList.toggle("active", tab === "shift");
          baseInputs.setAttribute("aria-hidden", tab === "shift" ? "false" : "true");
        }
        transitionModePanel(
          "timeModePanels",
          previous === "diff" ? "panelDiff" : "panelShift",
          tab === "diff" ? "panelDiff" : "panelShift",
          shouldAnimate !== false
        );
        el("shiftAccumHint").hidden = tab !== "shift";
        currentResult = null;
        displayMode = "hm";
        renderResult();
      }

      // 同步“时间计算器”和“日期计算器”的模式：
      // 时间差 ↔ 日期差，前移/后退 ↔ 前移/后退。
      function setModeSync(tab, skipSave) {
        setTab(tab, !skipSave);
        setDateTab(tab, !skipSave);
        if (!skipSave) localStorage.setItem(LAST_MODE_KEY, tab);
      }


