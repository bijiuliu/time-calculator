// Pure time and date calculations and result formatting.
(()=>{
  "use strict";
  const pad=value=>String(value).padStart(2,"0");

  function normalizeMinutes(total){return ((total%1440)+1440)%1440;}
  function minutesToTime(total){const value=normalizeMinutes(total);return `${pad(Math.floor(value/60))}:${pad(value%60)}`;}
  function formatDuration(total){const hours=Math.floor(total/60),minutes=total%60;return `${hours?`${hours}小时`:""}${minutes?`${minutes}分`:""}`||"0分";}
  function formatShiftDuration(result){
    const hasOriginalInput=result.inputHours!==undefined||result.inputMinutes!==undefined;
    if(!hasOriginalInput)return formatDuration(result.amountMinutes);
    const hours=String(result.inputHours??"").trim(),minutes=String(result.inputMinutes??"").trim();
    return `${hours!==""?`${hours}小时`:""}${minutes!==""?`${minutes}分钟`:""}`||formatDuration(result.amountMinutes);
  }
  function dateToIso(date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;}
  function formatDate(date){return `${date.getFullYear()}年${pad(date.getMonth()+1)}月${pad(date.getDate())}日`;}
  function dateDiffDays(start,end){return Math.round((Date.UTC(end.getFullYear(),end.getMonth(),end.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000);}
  function addDays(date,amount){const result=new Date(date.getFullYear(),date.getMonth(),date.getDate());result.setDate(result.getDate()+amount);return result;}

  globalThis.TimeCalculatorLogic={normalizeMinutes,minutesToTime,formatDuration,formatShiftDuration,dateToIso,formatDate,dateDiffDays,addDays};
})();
