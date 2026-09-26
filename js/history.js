// History rendering, deletion, undo, and animations.
(()=>{
  "use strict";
  const HISTORY_DELETE_TITLE_LIMIT=20;

  function createHistory({state,$,$$,pad,escapeHtml,toast,saveState,copyText,resultCopyText,formatDuration,formatShiftDuration,setPage,renderCalculator,setTimeInput,setDateInput}){
    const activeHistoryRestoreAnimations=new Map();
    const activeHistoryShiftAnimations=new Map();

    function addHistory(record){
      if(state.history.length>=state.settings.historyLimit){
        state.history.pop();
        toast("记录已满，最早一条已移除");
      }
      state.history.unshift(record);
      saveState();
    }

    function historyPresentation(item){
      if(item.kind==="time"&&item.mode==="diff")return {title:`${item.start} → ${item.end}`,sub:`时间差：${formatDuration(item.totalMinutes)} / ${item.totalMinutes}分钟${item.crossedDay?"（跨天）":""}`};
      if(item.kind==="time"){const word=item.direction==="back"?"往前推算":"往后推算";return {title:`${item.base} ${word} ${formatShiftDuration(item)}`,sub:`结果时间：${item.result}`};}
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
      settleHistoryLayoutAnimations();
      const container=$("#historyContainer");
      const items=state.history.filter(item=>state.filter==="all"||item.kind===state.filter);
      if(!items.length){container.innerHTML='<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h10M5 18h7"></path></svg>暂无符合条件的记录</div>';return;}
      const groups=[];
      items.forEach(item=>{const label=dayGroup(item.id);let group=groups.find(entry=>entry.label===label);if(!group){group={label,items:[]};groups.push(group);}group.items.push(item);});
      container.innerHTML=groups.map(group=>`<section class="history-group"><h2 class="history-group-title">${group.label}</h2><div class="history-list">${group.items.map(item=>{
        const view=historyPresentation(item);
        return `<article class="history-item ${item.kind}" data-record="${item.id}"><div class="history-top"><span class="history-kind"><i></i>${item.kind==="time"?"时间计算":"日期计算"}</span><span>${formatRecordTime(item.id)}</span></div><div class="history-main">${escapeHtml(view.title)}</div><div class="history-sub">${escapeHtml(view.sub)}</div><div class="history-actions"><button data-action="reuse" type="button">重新带入</button><button data-action="copy" type="button">复制</button><button class="delete" data-action="delete" type="button">删除</button></div></article>`;
      }).join("")}</div></section>`).join("");
      $$(".history-item button").forEach(button=>button.addEventListener("click",()=>{
        const item=button.closest(".history-item");
        const record=state.history.find(entry=>String(entry.id)===item.dataset.record);if(!record)return;
        const action=button.dataset.action;
        if(action==="copy")copyText(resultCopyText(record));
        if(action==="delete")deleteHistoryRecord(item,record,button);
        if(action==="reuse")reuseRecord(record);
      }));
    }

    function animateHistoryListShift(previousPositions,excludedRecord){
      $$(".history-item:not(.history-motion-ghost)").forEach(entry=>{
        if(entry.dataset.record===String(excludedRecord.id))return;
        const previousPosition=previousPositions.get(entry.dataset.record);
        if(!previousPosition)return;
        const offsetY=previousPosition.top-entry.getBoundingClientRect().top;
        if(Math.abs(offsetY)<.5)return;
        const animation=entry.animate([{transform:`translateY(${offsetY}px)`},{transform:"translateY(0)"}],{duration:250,easing:"cubic-bezier(.22,1,.36,1)",fill:"both"});
        activeHistoryShiftAnimations.set(entry,animation);
        animation.finished.then(
          ()=>finishHistoryShiftAnimation(entry,animation),
          ()=>{if(activeHistoryShiftAnimations.get(entry)===animation)activeHistoryShiftAnimations.delete(entry);}
        );
      });
    }

    function finishHistoryShiftAnimation(entry,animation,finishFirst=false){
      if(activeHistoryShiftAnimations.get(entry)!==animation)return;
      if(finishFirst){try{animation.finish();}catch(error){}}
      animation.cancel();
      activeHistoryShiftAnimations.delete(entry);
    }

    function settleHistoryShiftAnimations(){
      if(!activeHistoryShiftAnimations.size)return;
      Array.from(activeHistoryShiftAnimations.entries()).forEach(([entry,animation])=>{
        finishHistoryShiftAnimation(entry,animation,true);
      });
    }

    function clearHistoryRestoreStyles(entry){
      entry.style.boxSizing="";
      entry.style.overflow="";
      entry.style.height="";
      entry.style.marginBottom="";
      entry.style.paddingTop="";
      entry.style.paddingBottom="";
      entry.style.borderTopWidth="";
      entry.style.borderBottomWidth="";
      entry.style.opacity="";
      entry.style.transform="";
    }

    function finishHistoryRestoreAnimation(entry,animation,finishFirst=false){
      if(activeHistoryRestoreAnimations.get(entry)!==animation)return;
      if(finishFirst){try{animation.finish();}catch(error){}}
      clearHistoryRestoreStyles(entry);
      animation.cancel();
      activeHistoryRestoreAnimations.delete(entry);
    }

    function settleHistoryRestoreAnimations(){
      if(!activeHistoryRestoreAnimations.size)return;
      Array.from(activeHistoryRestoreAnimations.entries()).forEach(([entry,animation])=>{
        finishHistoryRestoreAnimation(entry,animation,true);
      });
      void $("#historyContainer")?.offsetHeight;
    }

    function settleHistoryLayoutAnimations(){
      settleHistoryRestoreAnimations();
      settleHistoryShiftAnimations();
      void $("#historyContainer")?.offsetHeight;
    }

    function getHistoryDeleteOverlay(){
      let overlay=$("#historyDeleteOverlay");
      if(overlay)return overlay;
      overlay=document.createElement("div");
      overlay.id="historyDeleteOverlay";
      overlay.className="history-delete-overlay";
      overlay.setAttribute("aria-hidden","true");
      document.body.appendChild(overlay);
      return overlay;
    }

    function showHistoryUndo(record,title,originalHistory){
      const node=$("#toast"),messageNode=document.createElement("span"),undoButton=document.createElement("button");
      messageNode.className="toast-message";
      undoButton.type="button";undoButton.className="undo-button";undoButton.textContent="撤销";
      const batch=toast.undo?.type==="history-delete"
        ?toast.undo
        :{type:"history-delete",originalHistory,records:[]};
      batch.records.push(record);
      const titleCharacters=Array.from(title);
      const shortenedTitle=titleCharacters.length>HISTORY_DELETE_TITLE_LIMIT
        ?`${titleCharacters.slice(0,HISTORY_DELETE_TITLE_LIMIT).join("")}…`
        :title;
      messageNode.textContent=batch.records.length===1?`已删除「${shortenedTitle}」`:`已删除 ${batch.records.length} 条记录`;
      node.replaceChildren(messageNode,undoButton);
      node.classList.add("has-undo","show");
      const undo=()=>{
        if(toast.undo!==batch)return;
        const deletedSet=new Set(batch.records);
        const restored=batch.originalHistory.filter(entry=>deletedSet.has(entry)&&!state.history.includes(entry));
        restored.forEach(entry=>{
          const originalIndex=batch.originalHistory.indexOf(entry);
          const next=batch.originalHistory.slice(originalIndex+1).find(candidate=>state.history.includes(candidate));
          if(next){state.history.splice(state.history.indexOf(next),0,entry);return;}
          const previous=batch.originalHistory.slice(0,originalIndex).reverse().find(candidate=>state.history.includes(candidate));
          const insertAt=previous?state.history.indexOf(previous)+1:state.history.length;
          state.history.splice(insertAt,0,entry);
        });
        saveState();
        clearTimeout(toast.timer);toast.undo=null;node.classList.remove("has-undo","show");
        renderHistory();
        const restoredIds=new Set(restored.map(entry=>String(entry.id)));
        const restoredEntries=$$(".history-item:not(.history-motion-ghost)").filter(entry=>restoredIds.has(entry.dataset.record)).map(entry=>{
          const computed=getComputedStyle(entry);
          const expanded={
            height:`${entry.getBoundingClientRect().height}px`,
            marginBottom:computed.marginBottom,
            paddingTop:computed.paddingTop,
            paddingBottom:computed.paddingBottom,
            borderTopWidth:computed.borderTopWidth,
            borderBottomWidth:computed.borderBottomWidth,
            opacity:1,
            transform:"translateX(0) scale(1)"
          };
          const collapsed={
            height:"0px",
            marginBottom:"0px",
            paddingTop:"0px",
            paddingBottom:"0px",
            borderTopWidth:"0px",
            borderBottomWidth:"0px",
            opacity:0,
            transform:"translateX(-20px) scale(.99)"
          };
          return {entry,expanded,collapsed};
        });
        restoredEntries.forEach(({entry,expanded,collapsed})=>{
          Object.assign(entry.style,{boxSizing:"border-box",overflow:"hidden",...collapsed});
          const animation=entry.animate([collapsed,expanded],{duration:300,easing:"cubic-bezier(.22,1,.36,1)",fill:"forwards"});
          activeHistoryRestoreAnimations.set(entry,animation);
          animation.finished.then(
            ()=>finishHistoryRestoreAnimation(entry,animation),
            ()=>{
              if(activeHistoryRestoreAnimations.get(entry)!==animation)return;
              clearHistoryRestoreStyles(entry);
              activeHistoryRestoreAnimations.delete(entry);
            }
          );
        });
      };
      batch.undo=undo;toast.undo=batch;undoButton.addEventListener("click",undo,{once:true});
      clearTimeout(toast.timer);
      toast.timer=setTimeout(()=>{toast.undo=null;node.classList.remove("has-undo","show");},5000);
    }

    async function deleteHistoryRecord(item,record,button){
      if(item.dataset.deleting)return;
      item.dataset.deleting="true";button.disabled=true;
      settleHistoryLayoutAnimations();
      const originalHistory=toast.undo?.type==="history-delete"?toast.undo.originalHistory:state.history.slice();
      const title=historyPresentation(record).title;
      const container=$("#historyContainer");
      const overlay=getHistoryDeleteOverlay();
      const group=item.closest(".history-group");
      const scrollPage=item.closest(".page");
      const previousScrollTop=scrollPage?.scrollTop||0;
      const previousMaxScroll=scrollPage?Math.max(0,scrollPage.scrollHeight-scrollPage.clientHeight):0;
      const wasAtBottom=!!scrollPage&&previousMaxScroll-previousScrollTop<=2;
      const cardPositions=new Map($$(".history-item:not(.history-motion-ghost)").map(entry=>[entry.dataset.record,entry.getBoundingClientRect()]));
      const itemRect=item.getBoundingClientRect();
      const ghost=item.cloneNode(true);
      ghost.classList.add("history-motion-ghost");
      ghost.style.cssText+=`;top:${itemRect.top}px;left:${itemRect.left}px;width:${itemRect.width}px;height:${itemRect.height}px;margin:0`;
      ghost.querySelectorAll("button").forEach(node=>node.disabled=true);
      overlay.appendChild(ghost);
      const exitFrames=[{opacity:1,transform:"translateX(0) scale(1)"},{opacity:0,transform:"translateX(-56px) scale(.985)"}];
      state.history=state.history.filter(entry=>entry!==record);saveState();
      item.remove();
      if(group&&!group.querySelector(".history-item"))group.remove();
      if(!container.querySelector(".history-item"))renderHistory();
      if(scrollPage){
        const nextMaxScroll=Math.max(0,scrollPage.scrollHeight-scrollPage.clientHeight);
        scrollPage.scrollTop=wasAtBottom?nextMaxScroll:Math.min(previousScrollTop,nextMaxScroll);
        void scrollPage.offsetHeight;
      }
      animateHistoryListShift(cardPositions,record);
      showHistoryUndo(record,title,originalHistory);
      const exit=ghost.animate(exitFrames,{duration:250,easing:"cubic-bezier(.4,0,.2,1)",fill:"forwards"});
      await exit.finished.catch(()=>{});
      exit.cancel();
      ghost.remove();
    }

    function reuseRecord(record){
      state.calculator=record.kind;state.mode=record.mode;
      if(record.mode==="shift"&&["back","forward"].includes(record.direction))state.direction=record.direction;
      setPage("calculator");renderCalculator();
      if(record.kind==="time"&&record.mode==="diff"){setTimeInput("start",record.start);setTimeInput("end",record.end);}
      else if(record.kind==="time"){
        setTimeInput("base",record.base);
        $("#shiftHours").value=record.inputHours!==undefined?record.inputHours:Math.floor(record.amountMinutes/60);
        $("#shiftMinutes").value=record.inputMinutes!==undefined?record.inputMinutes:record.amountMinutes%60;
      }
      else if(record.mode==="diff"){setDateInput("startDate",record.start);setDateInput("endDate",record.end);}
      else{setDateInput("baseDate",record.base);$("#shiftDays").value=record.amountDays;}
      toast("已重新带入计算");
    }

    return {addHistory,renderHistory};
  }

  globalThis.TimeCalculatorHistory={createHistory};
})();
