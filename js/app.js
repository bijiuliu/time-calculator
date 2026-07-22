(()=>{
  "use strict";

  const STORAGE_KEY="timeCalculatorV2State";
  const OLD_TIME_HISTORY_KEY="timeCalculatorHistoryV3";
  const OLD_DATE_HISTORY_KEY="dateCalculatorHistoryV1";
  const OLD_SETTINGS_KEY="calculatorSettingsV1";
  const DEFAULT_SETTINGS={inputMode:"numeric",defaultCalculator:"time",defaultMode:"diff",appearance:"light",accumulation:true,vibration:true,historyLimit:10,compact:false};
  const state={page:"calculator",calculator:"time",mode:"diff",direction:"back",displayMode:"hm",filter:"all",current:null,drafts:{},results:{},history:[],settings:{...DEFAULT_SETTINGS}};
  const $=selector=>document.querySelector(selector);
  const $$=selector=>Array.from(document.querySelectorAll(selector));
  const pad=value=>String(value).padStart(2,"0");
  const escapeHtml=value=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

  function toast(message){
    const node=$("#toast");
    node.textContent=message;
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

  function saveState(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({history:state.history,settings:state.settings,lastCalculator:state.calculator,lastMode:state.mode,drafts:state.drafts,results:state.results}));}catch(error){}
  }

  function readJson(key,fallback){
    try{const value=JSON.parse(localStorage.getItem(key)||"");return value??fallback;}catch(error){return fallback;}
  }

  function migrateOldData(){
    const oldSettings=readJson(OLD_SETTINGS_KEY,{});
    if(oldSettings&&typeof oldSettings==="object"){
      if(["native","numeric"].includes(oldSettings.inputMode))state.settings.inputMode=oldSettings.inputMode;
      if(["time","date","remember"].includes(oldSettings.defaultCalculator))state.settings.defaultCalculator=oldSettings.defaultCalculator;
      if(["diff","shift","remember"].includes(oldSettings.defaultMode))state.settings.defaultMode=oldSettings.defaultMode;
      if(["light","dark","system"].includes(oldSettings.appearance))state.settings.appearance=oldSettings.appearance;
      if(oldSettings.appearance==="crystal")state.settings.appearance="dark";
      if([10,20,30].includes(Number(oldSettings.historyLimit)))state.settings.historyLimit=Number(oldSettings.historyLimit);
      state.settings.accumulation=oldSettings.accumulation!=="off";
      state.settings.vibration=oldSettings.vibration!=="off";
      state.settings.compact=oldSettings.density==="compact";
    }

    const timeHistory=readJson(OLD_TIME_HISTORY_KEY,[]);
    const dateHistory=readJson(OLD_DATE_HISTORY_KEY,[]);
    const migrated=[];
    if(Array.isArray(timeHistory))timeHistory.forEach(item=>{
      if(item.type==="diff")migrated.push({id:item.timestamp||Date.now(),kind:"time",mode:"diff",start:item.start,end:item.end,totalMinutes:Number(item.totalMinutes)||0,crossedDay:!!item.crossedDay});
      if(item.type==="shift")migrated.push({id:item.timestamp||Date.now(),kind:"time",mode:"shift",base:item.baseTime,direction:item.directionText==="前移"?"back":"forward",amountMinutes:Number(item.shiftTotal)||0,result:item.resultTime});
    });
    if(Array.isArray(dateHistory))dateHistory.forEach(item=>{
      if(item.type==="dateDiff")migrated.push({id:item.timestamp||Date.now(),kind:"date",mode:"diff",startText:item.start,endText:item.end,totalDays:Number(item.days)||0,start:chineseDateToIso(item.start),end:chineseDateToIso(item.end)});
      if(item.type==="dateShift")migrated.push({id:item.timestamp||Date.now(),kind:"date",mode:"shift",baseText:item.baseDate,base:chineseDateToIso(item.baseDate),direction:item.directionText==="前移"?"back":"forward",amountDays:Number(item.days)||0,resultText:item.resultDate,result:chineseDateToIso(item.resultDate)});
    });
    state.history=migrated.sort((a,b)=>b.id-a.id).slice(0,state.settings.historyLimit);
  }

  function chineseDateToIso(text){
    const match=String(text||"").match(/(\d+)年(\d+)月(\d+)日/);
    return match?`${String(match[1]).padStart(4,"0")}-${pad(match[2])}-${pad(match[3])}`:"";
  }

  function loadState(){
    const saved=readJson(STORAGE_KEY,null);
    if(saved&&typeof saved==="object"){
      if(saved.settings)state.settings={...DEFAULT_SETTINGS,...saved.settings};
      if(Array.isArray(saved.history))state.history=saved.history;
      if(saved.drafts&&typeof saved.drafts==="object")state.drafts=saved.drafts;
      if(saved.results&&typeof saved.results==="object")state.results=saved.results;
      if(["time","date"].includes(saved.lastCalculator))state.calculator=saved.lastCalculator;
      if(["diff","shift"].includes(saved.lastMode))state.mode=saved.lastMode;
    }else migrateOldData();

    if(state.settings.defaultCalculator==="time"||state.settings.defaultCalculator==="date")state.calculator=state.settings.defaultCalculator;
    if(state.settings.defaultMode==="diff"||state.settings.defaultMode==="shift")state.mode=state.settings.defaultMode;
    trimHistory();
    saveState();
  }

  function trimHistory(){
    const limit=[10,20,30].includes(Number(state.settings.historyLimit))?Number(state.settings.historyLimit):10;
    state.settings.historyLimit=limit;
    state.history=state.history.slice(0,limit);
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
    state.page=page;
    $$(".page").forEach(node=>node.classList.toggle("active",node.id===`${page}Page`));
    $$(".nav-button").forEach(node=>node.classList.toggle("active",node.dataset.page===page));
    if(page==="history")renderHistory();
    if(page==="settings")syncSettingsUI();
    document.querySelector(`#${page}Page`)?.scrollTo(0,0);
  }

  function formHeading(main,detail){return `<div class="form-heading"><span>${main}</span><span>${detail}</span></div>`;}
  function nativeTimeField(id,label){return `<label class="input-card"><small>${label}</small><input id="${id}Native" type="time" aria-label="${label}"></label>`;}
  function numericTimeField(id,label){return `<label class="input-card"><small>${label}</small><span class="numeric-time"><input id="${id}Hour" inputmode="numeric" maxlength="2" placeholder="00" aria-label="${label}小时"><span>:</span><input id="${id}Minute" inputmode="numeric" maxlength="2" placeholder="00" aria-label="${label}分钟"></span></label>`;}
  function nativeDateField(id,label){return `<label class="input-card"><small>${label}</small><input id="${id}Native" type="date" aria-label="${label}"></label>`;}
  function numericDateField(id,label){return `<label class="input-card"><small>${label}</small><span class="numeric-date"><input id="${id}Year" inputmode="numeric" maxlength="4" aria-label="${label}年份"><b>年</b><input id="${id}Month" inputmode="numeric" maxlength="2" aria-label="${label}月份"><b>月</b><input id="${id}Day" inputmode="numeric" maxlength="2" aria-label="${label}日期"><b>日</b></span></label>`;}

  function renderForm(){
    const native=state.settings.inputMode==="native";
    let html="";
    if(state.calculator==="time"&&state.mode==="diff"){
      const start=native?nativeTimeField("start","开始时间"):numericTimeField("start","开始时间");
      const end=native?nativeTimeField("end","结束时间"):numericTimeField("end","结束时间");
      html=formHeading("选择时刻","结束更早时自动按次日")+`<div class="input-pair">${start}<div class="pair-arrow">→</div>${end}</div>`;
    }else if(state.calculator==="time"){
      const base=native?nativeTimeField("base","基准时间"):numericTimeField("base","基准时间");
      html=formHeading("时间推算","支持连续累计")+`<div class="field-stack">${base}<div class="direction"><button class="${state.direction==="back"?"active":""}" data-direction="back" type="button">← 往前推算</button><button class="${state.direction==="forward"?"active":""}" data-direction="forward" type="button">往后推算 →</button></div><div class="duration-grid"><label class="duration-field"><span>小时</span><input id="shiftHours" inputmode="numeric" type="number" min="0" placeholder="0"></label><label class="duration-field"><span>分钟</span><input id="shiftMinutes" inputmode="numeric" type="number" min="0" placeholder="0"></label></div></div>${accumulationHint()}`;
    }else if(state.calculator==="date"&&state.mode==="diff"){
      const start=native?nativeDateField("startDate","开始日期"):numericDateField("startDate","开始日期");
      const end=native?nativeDateField("endDate","结束日期"):numericDateField("endDate","结束日期");
      html=formHeading("选择日期","自动校验有效日期")+`<div class="input-pair">${start}<div class="pair-arrow">→</div>${end}</div>`;
    }else{
      const base=native?nativeDateField("baseDate","基准日期"):numericDateField("baseDate","基准日期");
      html=formHeading("日期推算","支持连续累计")+`<div class="field-stack">${base}<div class="direction"><button class="${state.direction==="back"?"active":""}" data-direction="back" type="button">← 往前推算</button><button class="${state.direction==="forward"?"active":""}" data-direction="forward" type="button">往后推算 →</button></div><div class="duration-grid single"><label class="duration-field"><span>天数</span><input id="shiftDays" inputmode="numeric" type="number" min="1" placeholder="0"></label></div></div>${accumulationHint()}`;
    }
    $("#formCard").innerHTML=html+`<div class="validation-message" id="validationMessage" hidden></div>`;
    bindFormControls();
  }

  function accumulationHint(){
    const message=state.settings.accumulation?"连续累计已开启：结果会成为新的基准":"连续累计已关闭：基准信息保持不变";
    return `<div class="accumulation-hint"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8"></path><path d="M4 4v4h4"></path></svg>${message}</div>`;
  }

  function bindFormControls(){
    $$("[data-direction]").forEach(button=>button.addEventListener("click",()=>{
      state.direction=button.dataset.direction;
      $$("[data-direction]").forEach(node=>node.classList.toggle("active",node===button));
      saveCurrentView();
      saveState();
      haptic();
    }));
    $$("input[maxlength]").forEach(input=>input.addEventListener("input",()=>{
      input.value=input.value.replace(/\D/g,"").slice(0,Number(input.maxLength));
      if(/Hour$/.test(input.id)&&Number(input.value)>23)input.value="23";
      if(/Minute$/.test(input.id)&&Number(input.value)>59)input.value="59";
      if(/Month$/.test(input.id)&&Number(input.value)>12)input.value="12";
      if(/Day$/.test(input.id)&&Number(input.value)>31)input.value="31";
    }));
    $$("#formCard input").forEach(input=>input.addEventListener("input",()=>{
      saveCurrentView();
      saveState();
    }));
  }

  function resetResult(){
    state.current=null;
    state.displayMode="hm";
    $("#resultLabel").textContent=state.calculator==="time"?(state.mode==="diff"?"时间差":"目标时间"):(state.mode==="diff"?"日期差":"目标日期");
    $("#resultStatus").textContent="等待计算";
    $("#resultValue").innerHTML='<span class="placeholder-result">--</span>';
    $("#resultDescription").textContent=state.mode==="diff"?"填写开始与结束信息，结果会显示在这里":"填写基准与推算量，结果会显示在这里";
    $("#resultCopy").hidden=true;
    $("#resultCard").classList.remove("has-result","no-result-animation");
  }

  function viewKey(){return `${state.calculator}:${state.mode}`;}

  // The form is re-created when a calculator or mode is changed. Keep its
  // values separately so switching views never discards work in progress.
  function saveCurrentView(){
    const inputs={};
    $$("#formCard input").forEach(input=>{inputs[input.id]=input.value;});
    state.drafts[viewKey()]={inputs,direction:state.direction,displayMode:state.displayMode};
    if(state.current)state.results[viewKey()]=state.current;
  }

  function restoreCurrentView(){
    const draft=state.drafts[viewKey()];
    if(draft){
      Object.entries(draft.inputs||{}).forEach(([id,value])=>{
        const input=document.getElementById(id);
        if(input)input.value=value;
      });
      if(["back","forward"].includes(draft.direction))state.direction=draft.direction;
      state.displayMode=draft.displayMode==="minutes"?"minutes":"hm";
      $$("[data-direction]").forEach(button=>button.classList.toggle("active",button.dataset.direction===state.direction));
    }else state.displayMode="hm";
    state.current=state.results[viewKey()]||null;
    if(state.current)renderCurrentResult(false);else resetResult();
  }

  function rememberCurrentResult(){
    state.results[viewKey()]=state.current;
    saveCurrentView();
    saveState();
  }

  function renderCalculator(){
    document.body.classList.toggle("date-active",state.calculator==="date");
    $$(".type-button").forEach(button=>button.classList.toggle("active",button.dataset.calculator===state.calculator));
    $$(".mode-button").forEach(button=>button.classList.toggle("active",button.dataset.mode===state.mode));
    renderForm();
    restoreCurrentView();
    saveState();
  }

  function readTime(prefix,label){
    if(state.settings.inputMode==="native"){
      const value=$(`#${prefix}Native`)?.value||"";
      if(!value)return {ok:false,message:`请选择${label}`};
      const [hour,minute]=value.split(":").map(Number);
      if(hour<0||hour>23||minute<0||minute>59)return {ok:false,message:`${label}格式不正确`};
      return {ok:true,text:`${pad(hour)}:${pad(minute)}`,minutes:hour*60+minute};
    }
    const hourText=$(`#${prefix}Hour`)?.value||"",minuteText=$(`#${prefix}Minute`)?.value||"";
    if(hourText===""||minuteText==="")return {ok:false,message:`请输入${label}`};
    const hour=Number(hourText),minute=Number(minuteText);
    if(hour<0||hour>23||minute<0||minute>59)return {ok:false,message:`${label}格式不正确`};
    return {ok:true,text:`${pad(hour)}:${pad(minute)}`,minutes:hour*60+minute};
  }

  function readDate(prefix,label){
    let year,month,day;
    if(state.settings.inputMode==="native"){
      const value=$(`#${prefix}Native`)?.value||"";
      if(!value)return {ok:false,message:`请选择${label}`};
      [year,month,day]=value.split("-").map(Number);
    }else{
      const y=$(`#${prefix}Year`)?.value||"",m=$(`#${prefix}Month`)?.value||"",d=$(`#${prefix}Day`)?.value||"";
      if(!y||!m||!d)return {ok:false,message:`请输入${label}`};
      year=Number(y);month=Number(m);day=Number(d);
    }
    const date=new Date(year,month-1,day);
    if(year<1||month<1||month>12||day<1||day>31||date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return {ok:false,message:`${label}不是有效日期`};
    return {ok:true,date,iso:dateToIso(date),text:formatDate(date)};
  }

  function normalizeMinutes(total){return ((total%1440)+1440)%1440;}
  function minutesToTime(total){const value=normalizeMinutes(total);return `${pad(Math.floor(value/60))}:${pad(value%60)}`;}
  function formatDuration(total){const hours=Math.floor(total/60),minutes=total%60;return `${hours?`${hours}小时`:""}${minutes?`${minutes}分`:""}`||"0分";}
  function dateToIso(date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;}
  function formatDate(date){return `${date.getFullYear()}年${pad(date.getMonth()+1)}月${pad(date.getDate())}日`;}
  function dateDiffDays(start,end){return Math.round((Date.UTC(end.getFullYear(),end.getMonth(),end.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000);}
  function addDays(date,amount){const result=new Date(date.getFullYear(),date.getMonth(),date.getDate());result.setDate(result.getDate()+amount);return result;}

  function showValidation(message){
    const node=$("#validationMessage");
    node.textContent=message;
    node.hidden=false;
    toast(message);
  }

  function clearValidation(){const node=$("#validationMessage");if(node){node.hidden=true;node.textContent="";}}

  function calculate(){
    clearValidation();
    haptic();
    if(state.calculator==="time"&&state.mode==="diff")return calculateTimeDiff();
    if(state.calculator==="time")return calculateTimeShift();
    if(state.mode==="diff")return calculateDateDiff();
    return calculateDateShift();
  }

  function calculateTimeDiff(){
    const start=readTime("start","开始时间"),end=readTime("end","结束时间");
    if(!start.ok)return showValidation(start.message);if(!end.ok)return showValidation(end.message);
    const crossedDay=end.minutes<start.minutes,total=(crossedDay?end.minutes+1440:end.minutes)-start.minutes;
    state.current={kind:"time",mode:"diff",start:start.text,end:end.text,totalMinutes:total,crossedDay};
    rememberCurrentResult();
    addHistory({...state.current,id:Date.now()});
    renderCurrentResult();
  }

  function calculateTimeShift(){
    const base=readTime("base","基准时间");
    if(!base.ok)return showValidation(base.message);
    const hours=Number($("#shiftHours")?.value||0),minutes=Number($("#shiftMinutes")?.value||0);
    if(hours<0||minutes<0)return showValidation("推算时长不能小于0");
    const total=hours*60+minutes;
    if(total===0)return showValidation("请输入往前或往后的时长");
    const raw=state.direction==="back"?base.minutes-total:base.minutes+total,result=minutesToTime(raw),crossedDay=raw<0||raw>=1440;
    state.current={kind:"time",mode:"shift",base:base.text,direction:state.direction,amountMinutes:total,result,crossedDay};
    rememberCurrentResult();
    addHistory({...state.current,id:Date.now()});
    renderCurrentResult();
    if(state.settings.accumulation){setTimeInput("base",result);saveCurrentView();saveState();}
  }

  function calculateDateDiff(){
    const start=readDate("startDate","开始日期"),end=readDate("endDate","结束日期");
    if(!start.ok)return showValidation(start.message);if(!end.ok)return showValidation(end.message);
    const difference=dateDiffDays(start.date,end.date),reverse=difference<0;
    state.current={kind:"date",mode:"diff",start:reverse?end.iso:start.iso,end:reverse?start.iso:end.iso,startText:reverse?end.text:start.text,endText:reverse?start.text:end.text,totalDays:Math.abs(difference)};
    rememberCurrentResult();
    addHistory({...state.current,id:Date.now()});
    renderCurrentResult();
  }

  function calculateDateShift(){
    const base=readDate("baseDate","基准日期");
    if(!base.ok)return showValidation(base.message);
    const days=Number($("#shiftDays")?.value||0);
    if(days<=0)return showValidation("请输入往前或往后的天数");
    const resultDate=addDays(base.date,state.direction==="back"?-days:days);
    state.current={kind:"date",mode:"shift",base:base.iso,baseText:base.text,direction:state.direction,amountDays:days,result:dateToIso(resultDate),resultText:formatDate(resultDate)};
    rememberCurrentResult();
    addHistory({...state.current,id:Date.now()});
    renderCurrentResult();
    if(state.settings.accumulation){setDateInput("baseDate",state.current.result);saveCurrentView();saveState();}
  }

  function renderCurrentResult(animate=true){
    const result=state.current;
    if(!result)return resetResult();
    const card=$("#resultCard");
    if(animate){
      card.classList.remove("no-result-animation","has-result");
      void card.offsetWidth;
      card.classList.add("has-result");
    }else card.classList.add("no-result-animation","has-result");
    $("#resultCopy").hidden=false;
    if(result.kind==="time"&&result.mode==="diff"){
      $("#resultLabel").textContent="时间差";
      $("#resultStatus").textContent=result.crossedDay?"跨天":"当天";
      if(state.displayMode==="hm"){
        const hours=Math.floor(result.totalMinutes/60),minutes=result.totalMinutes%60;
        $("#resultValue").innerHTML=`<span class="time-parts"><span class="time-part"><b>${pad(hours)}</b><small>小时</small></span><span class="time-part"><b>${pad(minutes)}</b><small>分钟</small></span></span>`;
      }else $("#resultValue").innerHTML=`<span class="total-minutes"><b>${result.totalMinutes}</b><small>分钟</small></span>`;
      $("#resultDescription").innerHTML=`${result.start} 到 ${result.end}，共 <b>${result.totalMinutes} 分钟</b> · 点击数字切换单位`;
    }else if(result.kind==="time"){
      const word=result.direction==="back"?"往前推算":"往后推算";
      $("#resultLabel").textContent="目标时间";$("#resultStatus").textContent=result.crossedDay?"跨天":"当天";
      const [hour,minute]=result.result.split(":");
      $("#resultValue").innerHTML=`<span class="time-parts"><span class="time-part"><b>${hour}</b><small>时</small></span><span class="time-part"><b>${minute}</b><small>分</small></span></span>`;
      $("#resultDescription").innerHTML=`${result.base} ${word} <b>${formatDuration(result.amountMinutes)}</b>`;
    }else if(result.mode==="diff"){
      $("#resultLabel").textContent="日期差";$("#resultStatus").textContent="日期间隔";
      $("#resultValue").innerHTML=`<span class="date-result"><b>${result.totalDays}</b><small>天</small></span>`;
      $("#resultDescription").textContent=`${result.startText} 到 ${result.endText}`;
    }else{
      const word=result.direction==="back"?"往前推算":"往后推算";
      $("#resultLabel").textContent="目标日期";$("#resultStatus").textContent="日期推算";
      $("#resultValue").innerHTML=`<span class="date-result"><b>${result.resultText}</b></span>`;
      $("#resultDescription").innerHTML=`${result.baseText} ${word} <b>${result.amountDays}天</b>`;
    }
  }

  function resultCopyText(result){
    if(!result)return "";
    if(result.kind==="time"&&result.mode==="diff")return `${result.start} → ${result.end}\n时间差：${formatDuration(result.totalMinutes)} / ${result.totalMinutes}分钟${result.crossedDay?"（跨天）":""}`;
    if(result.kind==="time"){const word=result.direction==="back"?"往前推算":"往后推算";return `${result.base} ${word} ${formatDuration(result.amountMinutes)}\n结果时间：${result.result}`;}
    if(result.mode==="diff")return `${result.startText} → ${result.endText}\n日期差：${result.totalDays}天`;
    const word=result.direction==="back"?"往前推算":"往后推算";return `${result.baseText} ${word} ${result.amountDays}天\n结果日期：${result.resultText}`;
  }

  function addHistory(record){
    if(state.history.length>=state.settings.historyLimit){
      toast("记录已满，本次结果未保存");
      return false;
    }
    state.history.unshift(record);
    saveState();
    return true;
  }

  function historyPresentation(item){
    if(item.kind==="time"&&item.mode==="diff")return {title:`${item.start} → ${item.end}`,sub:`时间差：${formatDuration(item.totalMinutes)} / ${item.totalMinutes}分钟${item.crossedDay?"（跨天）":""}`};
    if(item.kind==="time"){const word=item.direction==="back"?"往前推算":"往后推算";return {title:`${item.base} ${word} ${formatDuration(item.amountMinutes)}`,sub:`结果时间：${item.result}`};}
    if(item.mode==="diff")return {title:`${item.startText} → ${item.endText}`,sub:`日期差：${item.totalDays}天`};
    const word=item.direction==="back"?"往前推算":"往后推算";return {title:`${item.baseText} ${word} ${item.amountDays}天`,sub:`结果日期：${item.resultText}`};
  }

  function dayGroup(timestamp){
    const date=new Date(timestamp),today=new Date();
    const startToday=new Date(today.getFullYear(),today.getMonth(),today.getDate()).getTime();
    const startDate=new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();
    const difference=Math.round((startToday-startDate)/86400000);
    if(difference===0)return "今天";if(difference===1)return "昨天";return `${pad(date.getMonth()+1)}月${pad(date.getDate())}日`;
  }

  function formatRecordTime(timestamp){const date=new Date(timestamp);return `${pad(date.getHours())}:${pad(date.getMinutes())}`;}

  function renderHistory(){
    const container=$("#historyContainer");
    const items=state.history.filter(item=>state.filter==="all"||item.kind===state.filter);
    if(!items.length){container.innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h10M5 18h7"></path></svg>暂无符合条件的记录</div>';return;}
    const groups=[];
    items.forEach(item=>{const label=dayGroup(item.id);let group=groups.find(entry=>entry.label===label);if(!group){group={label,items:[]};groups.push(group);}group.items.push(item);});
    container.innerHTML=groups.map(group=>`<section class="history-group"><h2 class="history-group-title">${group.label}</h2><div class="history-list">${group.items.map(item=>{
      const view=historyPresentation(item);
      return `<article class="history-item ${item.kind}" data-record="${item.id}"><div class="history-top"><span class="history-kind"><i></i>${item.kind==="time"?"时间计算":"日期计算"}</span><span>${formatRecordTime(item.id)}</span></div><div class="history-main">${escapeHtml(view.title)}</div><div class="history-sub">${escapeHtml(view.sub)}</div><div class="history-actions"><button data-action="reuse" type="button">重新带入</button><button data-action="copy" type="button">复制</button><button class="delete" data-action="delete" type="button">删除</button></div></article>`;
    }).join("")}</div></section>`).join("");
    $$(".history-item").forEach(item=>item.addEventListener("click",event=>{
      const button=event.target.closest("button");
      const record=state.history.find(entry=>String(entry.id)===item.dataset.record);if(!record)return;
      if(!button){reuseRecord(record);return;}
      const action=button.dataset.action;
      if(action==="copy")copyText(resultCopyText(record));
      if(action==="delete"){state.history=state.history.filter(entry=>entry!==record);saveState();renderHistory();toast("记录已删除");}
      if(action==="reuse")reuseRecord(record);
    }));
  }

  function reuseRecord(record){
    state.calculator=record.kind;state.mode=record.mode;state.direction=record.direction||"back";
    setPage("calculator");renderCalculator();
    if(record.kind==="time"&&record.mode==="diff"){setTimeInput("start",record.start);setTimeInput("end",record.end);}
    else if(record.kind==="time"){setTimeInput("base",record.base);$("#shiftHours").value=Math.floor(record.amountMinutes/60);$("#shiftMinutes").value=record.amountMinutes%60;}
    else if(record.mode==="diff"){setDateInput("startDate",record.start);setDateInput("endDate",record.end);}
    else{setDateInput("baseDate",record.base);$("#shiftDays").value=record.amountDays;}
    toast("已重新带入计算");
  }

  function setTimeInput(prefix,value){
    if(!value)return;
    const [hour,minute]=value.split(":");
    if(state.settings.inputMode==="native"){$(`#${prefix}Native`).value=`${pad(hour)}:${pad(minute)}`;}
    else{$(`#${prefix}Hour`).value=pad(hour);$(`#${prefix}Minute`).value=pad(minute);}
  }

  function setDateInput(prefix,value){
    if(!value)return;
    const [year,month,day]=value.split("-");
    if(state.settings.inputMode==="native")$(`#${prefix}Native`).value=value;
    else{$(`#${prefix}Year`).value=year;$(`#${prefix}Month`).value=month;$(`#${prefix}Day`).value=day;}
  }

  function clearCalculator(){
    delete state.drafts[viewKey()];
    delete state.results[viewKey()];
    state.current=null;
    renderForm();
    resetResult();
    saveState();
    toast("输入已清空");
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
    historyLimit:{title:"记录数量",subtitle:"达到上限后不再保存新记录",setting:"historyLimit",options:[[10,"10条"],[20,"20条"],[30,"30条"]]},
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
    $("#sheetTitle").textContent="关于时间计算器";$("#sheetSubtitle").textContent="2.0 Beta 版";
    $("#sheetContent").innerHTML='<div class="about-content"><span class="version-badge">VERSION 2.0.0 · BETA</span><h3>主要功能</h3><ul><li>时间差与自动跨天</li><li>时间往前、往后推算</li><li>日期差与日期推算</li><li>连续累计与两种输入方式</li><li>统一记录、筛选、复制、删除和重新带入</li></ul><h3>数据说明</h3><p>计算记录和设置只保存在当前浏览器。本版本会在首次启动时尝试迁移旧版时间记录、日期记录和常用设置。</p><h3>使用提示</h3><p>时间差结果可以点击数字区域切换“小时＋分钟”和“总分钟”。结束时间早于开始时间时，会自动按次日计算。</p></div>';
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

  initialize();
})();
