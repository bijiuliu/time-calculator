// Persistence and migration of the version 2 browser state.
(()=>{
  "use strict";
  const STORAGE_KEY="timeCalculatorV2State";
  const OLD_TIME_HISTORY_KEY="timeCalculatorHistoryV3";
  const OLD_DATE_HISTORY_KEY="dateCalculatorHistoryV1";
  const OLD_SETTINGS_KEY="calculatorSettingsV1";
  const DEFAULT_SETTINGS={inputMode:"numeric",defaultCalculator:"time",defaultMode:"diff",appearance:"light",accumulation:true,vibration:true,historyLimit:10,compact:false};

  function createStorage(state,pad,getStorage=()=>localStorage){
    function saveState(){
      try{getStorage().setItem(STORAGE_KEY,JSON.stringify({history:state.history,settings:state.settings,lastCalculator:state.calculator,lastMode:state.mode,lastDirection:state.direction}));}catch(error){}
    }

    function readJson(key,fallback){
      try{const value=JSON.parse(getStorage().getItem(key)||"");return value??fallback;}catch(error){return fallback;}
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
        if(["time","date"].includes(saved.lastCalculator))state.calculator=saved.lastCalculator;
        if(["diff","shift"].includes(saved.lastMode))state.mode=saved.lastMode;
        if(["back","forward"].includes(saved.lastDirection))state.direction=saved.lastDirection;
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

    return {saveState,loadState,trimHistory};
  }

  globalThis.TimeCalculatorStorage={DEFAULT_SETTINGS,createStorage};
})();
