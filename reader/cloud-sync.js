  // This file is inserted inside the reader IIFE, after its cached state loads.
  // Each field has its own outbox entry. A cloud response never replaces an
  // unsent edit, including an edit made while an older value is being saved.
  const cloudAreas = ['notes','reviewed','last','checks','hiddenBooks','bookmarks'];
  const cloudNested = new Set(['notes','last','checks','bookmarks']);
  const cloudOutboxKey = STORE + ':cloud-outbox-v1';
  const cloudSafeKey = (key, max=500) => typeof key === 'string' && key.length > 0 && key.length <= max && !['__proto__','prototype','constructor'].includes(key) && !/[\u0000-\u001f]/.test(key);
  const cloudRecord = value => value && typeof value === 'object' && !Array.isArray(value);
  const cloudFieldId = field => JSON.stringify([field.area,field.bookId,field.key || '']);
  function cloudFlattenState(value) {
    const fields = new Map();
    for (const area of cloudAreas) {
      if (!cloudRecord(value?.[area])) continue;
      for (const [bookId,entry] of Object.entries(value[area])) {
        if (!cloudSafeKey(bookId)) continue;
        const entries = cloudNested.has(area) ? (cloudRecord(entry) ? Object.entries(entry) : []) : [['',entry]];
        for (const [key,item] of entries) {
          if ((cloudNested.has(area) && !cloudSafeKey(key,700)) || !['string','number','boolean'].includes(typeof item) || (typeof item === 'number' && !Number.isFinite(item))) continue;
          const field = {area,bookId,key,value:item}; fields.set(cloudFieldId(field),field);
        }
      }
    }
    return fields;
  }
  function cloudDiffState(before, after) {
    const oldFields=cloudFlattenState(before), newFields=cloudFlattenState(after), changes=[];
    for (const [id,field] of newFields) if (!oldFields.has(id) || oldFields.get(id).value !== field.value) changes.push(field);
    for (const [id,field] of oldFields) if (!newFields.has(id)) changes.push({...field,value:null});
    return changes;
  }
  function cloudMergeState(remote, pending) {
    const fields=cloudFlattenState(remote), result={notes:{},reviewed:{},last:{},checks:{},hiddenBooks:{},bookmarks:{}};
    for (const entry of pending) {
      const field=entry.change || entry, id=cloudFieldId(field);
      if (field.value === null) fields.delete(id); else fields.set(id,field);
    }
    for (const field of fields.values()) {
      if (!cloudAreas.includes(field.area) || !cloudSafeKey(field.bookId) || (cloudNested.has(field.area) && !cloudSafeKey(field.key,700))) continue;
      if (cloudNested.has(field.area)) { result[field.area][field.bookId] ||= {}; result[field.area][field.bookId][field.key]=field.value; }
      else result[field.area][field.bookId]=field.value;
    }
    return result;
  }
  const cloudCloneState = value => cloudMergeState(value,[]);
  let cloudOutbox = new Map(), cloudSnapshot, cloudStarted=false, cloudBusy=false, cloudReadRequested=false;
  let cloudTimer=null, cloudRetryTimer=null, cloudPollTimer=null, cloudConnected=false, cloudEverRead=false, cloudDeferredRender=false;
  let cloudOutboxDurable=true, cloudStateDurable=true, cloudLastError='', cloudRevision=0;
  const cloudClientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    const saved = JSON.parse(localStorage.getItem(cloudOutboxKey) || 'null');
    if (saved?.version === 1 && Array.isArray(saved.entries)) for (const entry of saved.entries) {
      const field=entry?.change;
      if (!field || !cloudAreas.includes(field.area) || !cloudSafeKey(field.bookId) || (cloudNested.has(field.area) && !cloudSafeKey(field.key,700)) || !['string','number','boolean'].includes(typeof field.value) && field.value !== null || typeof entry.revision !== 'string') continue;
      cloudOutbox.set(cloudFieldId(field),{change:{area:field.area,bookId:field.bookId,key:cloudNested.has(field.area)?field.key:'',value:field.value},revision:entry.revision});
    }
  } catch (_) { cloudOutboxDurable=false; }
  state=cloudMergeState(state,cloudOutbox.values());
  cloudSnapshot=cloudCloneState(state);
  function cloudPersistOutbox() {
    try { localStorage.setItem(cloudOutboxKey,JSON.stringify({version:1,entries:[...cloudOutbox.values()]})); cloudOutboxDurable=true; }
    catch (_) { cloudOutboxDurable=false; }
  }
  function cloudPersistState() {
    try { localStorage.setItem(STORE,JSON.stringify(state)); cloudStateDurable=true; }
    catch (_) { cloudStateDurable=false; }
  }
  function syncLabel() {
    if (cloudOutbox.size) {
      if (!cloudOutboxDurable || !cloudStateDurable) return cloudBusy ? 'Saving to cloud; device backup unavailable' : 'Unsynced changes in this session';
      return cloudBusy ? 'Saving to cloud…' : cloudLastError ? 'Saved on this device · cloud sync will retry' : 'Saved on this device · waiting to sync';
    }
    if (!cloudEverRead) return cloudLastError ? 'Device copy · cloud unavailable' : 'Connecting to your cloud library…';
    if (cloudBusy) return 'Checking cloud library…';
    if (!cloudConnected) return 'Device copy · cloud unavailable';
    return 'Saved to your private cloud';
  }
  function updateCloudSyncStatus() {
    const label=syncLabel();
    document.querySelectorAll('.save-status,[data-cloud-sync]').forEach(el=>{
      el.textContent=label;
      if (cloudLastError) el.title=cloudLastError; else el.removeAttribute('title');
    });
  }
  function cloudCanRepaint() {
    const selection = window.getSelection?.();
    return !document.activeElement?.matches('textarea,input,select,[contenteditable="true"]') && (!selection || selection.isCollapsed);
  }
  function cloudRepaint() {
    if (cloudCanRepaint()) { cloudDeferredRender=false; render(); updateCloudSyncStatus(); }
    else cloudDeferredRender=true;
  }
  function cloudApplyRemote(remote) {
    // Capture changes even if a caller mutated state immediately before a reply.
    queueCloudState(false);
    const next=cloudMergeState(remote,cloudOutbox.values());
    const changed=cloudDiffState(state,next).length>0;
    state=next; cloudSnapshot=cloudCloneState(state); cloudPersistState();
    cloudEverRead=true;
    if (changed) cloudRepaint();
  }
  function queueCloudState(schedule=true) {
    const changes=cloudDiffState(cloudSnapshot,state);
    for (const change of changes) cloudOutbox.set(cloudFieldId(change),{change,revision:cloudClientId+':'+(++cloudRevision)});
    cloudSnapshot=cloudCloneState(state);
    if (changes.length) { cloudPersistOutbox(); cloudPersistState(); cloudLastError=''; }
    updateCloudSyncStatus();
    if (schedule && cloudStarted && changes.length) { clearTimeout(cloudTimer); cloudTimer=setTimeout(()=>cloudRunSync(false),650); }
  }
  async function cloudRunSync(readRemote=true) {
    if (!cloudStarted) return;
    cloudReadRequested ||= readRemote;
    clearTimeout(cloudTimer); clearTimeout(cloudRetryTimer);
    if (cloudBusy) return;
    cloudBusy=true; updateCloudSyncStatus();
    try {
      // One request at a time: an old GET cannot arrive after an acknowledged PATCH.
      do {
        queueCloudState(false);
        if (cloudOutbox.size) {
          const batch=[...cloudOutbox.entries()].slice(0,500);
          const response=await api('/api/state','PATCH',{changes:batch.map(([,entry])=>entry.change)});
          if (!cloudRecord(response?.state)) throw new Error('Cloud sync returned an incomplete response. Your pending edits are kept.');
          for (const [id,sent] of batch) if (cloudOutbox.get(id)?.revision === sent.revision) cloudOutbox.delete(id);
          cloudPersistOutbox(); cloudApplyRemote(response.state);
        } else if (cloudReadRequested || !cloudEverRead) {
          cloudReadRequested=false;
          const response=await api('/api/state');
          if (!cloudRecord(response?.state)) throw new Error('Cloud sync returned an incomplete response. Your device copy is kept.');
          cloudApplyRemote(response.state);
        }
        cloudConnected=true; cloudLastError='';
      } while (cloudOutbox.size || cloudReadRequested);
    } catch (error) {
      cloudConnected=false; cloudLastError=String(error?.message || 'Cloud sync is unavailable.').slice(0,250);
      cloudPersistOutbox();
      cloudRetryTimer=setTimeout(()=>cloudRunSync(true),15000);
    } finally { cloudBusy=false; updateCloudSyncStatus(); }
  }
  async function initializeCloudSync() {
    if (cloudStarted) return cloudRunSync(true);
    cloudStarted=true;
    window.addEventListener('focus',()=>cloudRunSync(true));
    window.addEventListener('online',()=>cloudRunSync(true));
    document.addEventListener('visibilitychange',()=>{ if (document.visibilityState==='visible') cloudRunSync(true); });
    const flushDeferredRender = ()=>{ if(cloudDeferredRender) setTimeout(()=>{ if(cloudDeferredRender&&cloudCanRepaint())cloudRepaint(); },0); };
    document.addEventListener('focusout',flushDeferredRender);
    document.addEventListener('selectionchange',flushDeferredRender);
    cloudPollTimer=setInterval(()=>{ if(document.visibilityState!=='hidden')cloudRunSync(true); },30000);
    await cloudRunSync(true);
  }
