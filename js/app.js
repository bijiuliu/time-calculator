(()=>{
  "use strict";

  const {DEFAULT_SETTINGS,createStorage}=globalThis.TimeCalculatorStorage;
  const state={calculator:"time",mode:"diff",direction:"back",displayMode:"hm",filter:"all",current:null,drafts:{},results:{},history:[],settings:{...DEFAULT_SETTINGS}};
  const $=selector=>document.querySelector(selector);
  const $$=selector=>Array.from(document.querySelectorAll(selector));
  const pad=value=>String(value).padStart(2,"0");
  const escapeHtml=value=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const {saveState,loadState,trimHistory}=createStorage(state,pad);
  const logic=globalThis.TimeCalculatorLogic;

  function toast(message){
    const node=$("#toast");
    node.textContent=message;
    node.classList.remove("has-undo");
    toast.undo=null;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer=setTimeout(()=>node.classList.remove("show"),1750);
  }

  function haptic(){
    if(state.settings.vibration&&navigator.vibrate)navigator.vibrate(12);
  }

  function copyText(text){
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(()=>toast("已复制到剪贴板")).catch(()=>fallbackCopy(text));
    }else fallbackCopy(text);
  }

  function fallbackCopy(text){
    const area=document.createElement("textarea");
    area.value=text;
    area.style.position="fixed";
    area.style.opacity="0";
    document.body.appendChild(area);
    area.select();
    try{document.execCommand("copy");toast("已复制到剪贴板");}catch(error){toast("复制失败，请手动复制");}
    area.remove();
  }

  function applyAppearance(){
    document.body.classList.add("theme-switching");
    const systemDark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;
    const light=state.settings.appearance==="light"||(state.settings.appearance==="system"&&!systemDark);
    document.body.classList.toggle("theme-light",light);
    document.body.classList.toggle("density-compact",!!state.settings.compact);
    document.documentElement.style.colorScheme=light?"light":"dark";
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=light?"#f8fafc":"#0c0e0f";
    syncThemeToggle();
    requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.remove("theme-switching")));
  }

  function syncThemeToggle(){
    const button=$("#headerThemeToggle");
    if(!button)return;
    const light=document.body.classList.contains("theme-light");
    button.setAttribute("aria-label",light?"切换到深色模式":"切换到浅色模式");
    button.innerHTML=light
      ?'<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.8"></circle><path d="M12 2.8v2.1M12 19.1v2.1M21.2 12h-2.1M4.9 12H2.8M18.5 5.5 17 7M7 17l-1.5 1.5M18.5 18.5 17 17M7 7 5.5 5.5"></path></svg>'
      :'<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.1 15.2A8.35 8.35 0 0 1 8.8 3.9 8.35 8.35 0 1 0 20.1 15.2Z"></path></svg>';
  }

  function setPage(page){
    $$(".page").forEach(node=>node.classList.toggle("active",node.id===`${page}Page`));
    $$(".nav-button").forEach(node=>node.classList.toggle("active",node.dataset.page===page));
    if(page==="history")renderHistory();
    if(page==="settings")syncSettingsUI();
    document.querySelector(`#${page}Page`)?.scrollTo(0,0);
  }

  function syncSettingsUI(){
    $$("#inputModeSetting button").forEach(button=>{const active=button.dataset.value===state.settings.inputMode;button.classList.toggle("active",active);button.setAttribute("aria-checked",active);});
    $("#accumulationSetting").checked=state.settings.accumulation;
    $("#vibrationSetting").checked=state.settings.vibration;
    $("#compactSetting").checked=state.settings.compact;
    const calculatorLabels={time:"时间计算器",date:"日期计算器",remember:"记住上次使用"};
    const modeLabels={diff:"计算间隔",shift:"往前 / 往后推算",remember:"记住上次模式"};
    const appearanceLabels={dark:"深色",light:"浅色",system:"跟随系统"};
    $("#defaultCalculatorSummary").textContent=calculatorLabels[state.settings.defaultCalculator];
    $("#defaultModeSummary").textContent=modeLabels[state.settings.defaultMode];
    $("#historyLimitSummary").textContent=`最多保留${state.settings.historyLimit}条`;
    $("#appearanceSummary").textContent=appearanceLabels[state.settings.appearance];
  }

  const sheetDefinitions={
    defaultCalculator:{title:"默认计算器",subtitle:"选择应用打开时优先显示的页面",setting:"defaultCalculator",options:[["time","时间计算器"],["date","日期计算器"],["remember","记住上次使用"]]},
    defaultMode:{title:"默认模式",subtitle:"选择应用打开时优先显示的计算方式",setting:"defaultMode",options:[["diff","计算间隔"],["shift","往前 / 往后推算"],["remember","记住上次模式"]]},
    historyLimit:{title:"记录数量",subtitle:"达到上限后自动移除最早记录",setting:"historyLimit",options:[[10,"10条"],[20,"20条"],[30,"30条"]]},
    appearance:{title:"显示模式",subtitle:"切换后立即应用",setting:"appearance",options:[["light","浅色"],["dark","深色"],["system","跟随系统"]]}
  };

  function openSheet(name){
    if(name==="about")return openAboutSheet();
    const definition=sheetDefinitions[name];if(!definition)return;
    $("#sheetTitle").textContent=definition.title;$("#sheetSubtitle").textContent=definition.subtitle;
    $("#sheetContent").innerHTML=`<div class="option-list">${definition.options.map(([value,label])=>`<button class="option-button ${String(state.settings[definition.setting])===String(value)?"active":""}" data-setting="${definition.setting}" data-value="${value}" type="button"><span>${label}</span><i></i></button>`).join("")}</div>`;
    showSheet();
    $$(".option-button").forEach(button=>button.addEventListener("click",()=>{
      const key=button.dataset.setting;let value=button.dataset.value;if(key==="historyLimit")value=Number(value);
      state.settings[key]=value;
      if(key==="historyLimit")trimHistory();
      if(key==="appearance")applyAppearance();
      saveState();syncSettingsUI();closeSheet();toast("设置已更新");
    }));
  }

  function openAboutSheet(){
    $("#sheetTitle").textContent="关于时间计算器";$("#sheetSubtitle").textContent="时间计算器 2.0";
    $("#sheetContent").innerHTML='<div class="about-content"><span class="version-badge">VERSION 2.0</span><h3>主要功能</h3><ul><li>时间差与自动跨天</li><li>时间往前、往后推算</li><li>日期差与日期推算</li><li>连续累计与两种输入方式</li><li>统一记录、筛选、复制、删除和重新带入</li></ul><h3>数据说明</h3><p>计算记录和设置只保存在当前浏览器。本版本会在首次启动时尝试迁移旧版时间记录、日期记录和常用设置。</p><h3>使用提示</h3><p>时间差结果可以点击数字区域切换“小时＋分钟”和“总分钟”。结束时间早于开始时间时，会自动按次日计算。</p></div>';
    showSheet();
  }

  function showSheet(){$("#sheetOverlay").classList.add("show");$("#sheetOverlay").setAttribute("aria-hidden","false");}
  function closeSheet(){$("#sheetOverlay").classList.remove("show");$("#sheetOverlay").setAttribute("aria-hidden","true");}
  function openConfirm(){$("#confirmOverlay").classList.add("show");$("#confirmOverlay").setAttribute("aria-hidden","false");}
  function closeConfirm(){$("#confirmOverlay").classList.remove("show");$("#confirmOverlay").setAttribute("aria-hidden","true");}

  function bindEvents(){
    $$(".type-button").forEach(button=>button.addEventListener("click",()=>{saveCurrentView();state.calculator=button.dataset.calculator;renderCalculator();haptic();}));
    $$(".mode-button").forEach(button=>button.addEventListener("click",()=>{saveCurrentView();state.mode=button.dataset.mode;renderCalculator();haptic();}));
    $("#calculateButton").addEventListener("click",calculate);
    $("#clearButton").addEventListener("click",clearCalculator);
    $("#resultValue").addEventListener("click",()=>{if(state.current?.kind==="time"&&state.current.mode==="diff"){state.displayMode=state.displayMode==="hm"?"minutes":"hm";renderCurrentResult(false);haptic();}});
    $("#resultCopy").addEventListener("click",()=>copyText(resultCopyText(state.current)));
    $$(".nav-button").forEach(button=>button.addEventListener("click",()=>setPage(button.dataset.page)));
    $("#headerThemeToggle").addEventListener("click",()=>{
      const light=document.body.classList.contains("theme-light");
      state.settings.appearance=light?"dark":"light";
      saveState();applyAppearance();syncSettingsUI();haptic();toast(light?"已切换为深色模式":"已切换为浅色模式");
    });
    $$(".filter-button").forEach(button=>button.addEventListener("click",()=>{state.filter=button.dataset.filter;$$('.filter-button').forEach(node=>node.classList.toggle("active",node===button));renderHistory();}));
    $("#clearAllHistory").addEventListener("click",()=>{if(state.history.length)openConfirm();else toast("暂无记录可清空");});
    $("#confirmCancel").addEventListener("click",closeConfirm);
    $("#confirmOk").addEventListener("click",()=>{state.history=[];saveState();renderHistory();closeConfirm();toast("全部记录已清空");});
    $("#confirmOverlay").addEventListener("click",event=>{if(event.target===$("#confirmOverlay"))closeConfirm();});
    $("#sheetClose").addEventListener("click",closeSheet);
    $("#sheetOverlay").addEventListener("click",event=>{if(event.target===$("#sheetOverlay"))closeSheet();});
    $$("[data-setting-page]").forEach(row=>row.addEventListener("click",()=>openSheet(row.dataset.settingPage)));
    $$("#inputModeSetting button").forEach(button=>button.addEventListener("click",()=>{state.settings.inputMode=button.dataset.value;saveState();syncSettingsUI();renderCalculator();toast("输入方式已切换");}));
    $("#accumulationSetting").addEventListener("change",event=>{state.settings.accumulation=event.target.checked;saveState();syncSettingsUI();renderCalculator();toast(state.settings.accumulation?"连续累计已开启":"连续累计已关闭");});
    $("#vibrationSetting").addEventListener("change",event=>{state.settings.vibration=event.target.checked;saveState();syncSettingsUI();haptic();toast(state.settings.vibration?"震动反馈已开启":"震动反馈已关闭");});
    $("#compactSetting").addEventListener("change",event=>{state.settings.compact=event.target.checked;saveState();syncSettingsUI();applyAppearance();toast(state.settings.compact?"已切换为紧凑布局":"已切换为标准布局");});
    $("#restoreSettings").addEventListener("click",()=>{state.settings={...DEFAULT_SETTINGS};trimHistory();saveState();applyAppearance();syncSettingsUI();renderCalculator();toast("设置已恢复默认");});
    document.addEventListener("keydown",event=>{if(event.key!=="Escape")return;if($("#sheetOverlay").classList.contains("show"))closeSheet();if($("#confirmOverlay").classList.contains("show"))closeConfirm();});
    if(window.matchMedia){window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{if(state.settings.appearance==="system")applyAppearance();});}
  }

  function initialize(){
    loadState();applyAppearance();bindEvents();renderCalculator();renderHistory();syncSettingsUI();
    if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }

  // Calculations create records; history can reopen a calculation. Connect both before startup.
  let history;
  const calculator=globalThis.TimeCalculatorCalculator.createCalculator({
    state,$,$$,pad,escapeHtml,saveState,toast,haptic,logic,
    addHistory:record=>history.addHistory(record)
  });
  const {saveCurrentView,renderCalculator,calculate,renderCurrentResult,resultCopyText,setTimeInput,setDateInput,clearCalculator}=calculator;
  history=globalThis.TimeCalculatorHistory.createHistory({
    state,$,$$,pad,escapeHtml,toast,saveState,copyText,resultCopyText,
    formatDuration:logic.formatDuration,formatShiftDuration:logic.formatShiftDuration,
    setPage,renderCalculator,setTimeInput,setDateInput
  });
  const {renderHistory}=history;
  initialize();
})();
