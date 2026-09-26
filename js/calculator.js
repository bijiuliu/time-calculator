// Calculator forms, validation, computation flow, and result rendering.
(()=>{
  "use strict";

  function createCalculator({state,$,$$,pad,escapeHtml,saveState,toast,haptic,addHistory,logic}){
    const {minutesToTime,formatDuration,formatShiftDuration,dateToIso,formatDate,dateDiffDays,addDays}=logic;

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
      state.drafts[viewKey()]={inputs,displayMode:state.displayMode};
      if(state.current)state.results[viewKey()]=state.current;
    }

    function restoreCurrentView(){
      const draft=state.drafts[viewKey()];
      if(draft){
        Object.entries(draft.inputs||{}).forEach(([id,value])=>{
          const input=document.getElementById(id);
          if(input)input.value=value;
        });
        state.displayMode=draft.displayMode==="minutes"?"minutes":"hm";
      }else state.displayMode="hm";
      $$("[data-direction]").forEach(button=>button.classList.toggle("active",button.dataset.direction===state.direction));
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
      const inputHours=$("#shiftHours")?.value||"",inputMinutes=$("#shiftMinutes")?.value||"";
      const hours=Number(inputHours||0),minutes=Number(inputMinutes||0);
      if(hours<0||minutes<0)return showValidation("推算时长不能小于0");
      const total=hours*60+minutes;
      if(total===0)return showValidation("请输入往前或往后的时长");
      const raw=state.direction==="back"?base.minutes-total:base.minutes+total,result=minutesToTime(raw),crossedDay=raw<0||raw>=1440;
      state.current={kind:"time",mode:"shift",base:base.text,direction:state.direction,inputHours,inputMinutes,amountMinutes:total,result,crossedDay};
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
        $("#resultDescription").innerHTML=`${result.base} ${word} <b>${escapeHtml(formatShiftDuration(result))}</b>`;
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
      if(result.kind==="time"){const word=result.direction==="back"?"往前推算":"往后推算";return `${result.base} ${word} ${formatShiftDuration(result)}\n结果时间：${result.result}`;}
      if(result.mode==="diff")return `${result.startText} → ${result.endText}\n日期差：${result.totalDays}天`;
      const word=result.direction==="back"?"往前推算":"往后推算";return `${result.baseText} ${word} ${result.amountDays}天\n结果日期：${result.resultText}`;
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

    return {saveCurrentView,renderCalculator,calculate,renderCurrentResult,resultCopyText,setTimeInput,setDateInput,clearCalculator};
  }

  globalThis.TimeCalculatorCalculator={createCalculator};
})();
