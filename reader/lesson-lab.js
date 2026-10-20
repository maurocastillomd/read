  // Included inside read.'s app closure. These exercises are learning aids,
  // deliberately separate from the author's text and from generated guide facts.
  const lessonLabSessions = new Map(), lessonLabRecords = new Map();
  const labClamp = (n,min,max) => Math.max(min,Math.min(max,n));
  function labKey(rec) { return (rec.bookId || activeBook.id) + '::' + rec.unitId; }
  function labSession(rec) {
    const key=labKey(rec); lessonLabRecords.set(key,rec);
    if(!lessonLabSessions.has(key))lessonLabSessions.set(key,{concept:0,path:0,answer:null,memory:false,level:50,inflow:6,outflow:4,history:[50],feedback:20,gain:50,delay:0,mode:'balance',feedbackHistory:[20],attention:5});
    return lessonLabSessions.get(key);
  }
  function labEnrichment(rec) {
    const book=lessonEnrichment[rec.bookId || activeBook.id];
    const prepared=book && Object.hasOwn(book,rec.unitId) ? book[rec.unitId] : null;
    const mnemonic=roleContextGuide(rec)?.mnemonic || (!coordinatorExamplesEnabled()&&roleContextHasExample(JSON.stringify(prepared?.mnemonic))?null:prepared?.mnemonic);
    return mnemonic ? {...(prepared||{}),mnemonic} : coordinatorExamplesEnabled()?prepared:null;
  }
  function labId(rec,suffix='') {
    let hash=0;for(const c of labKey(rec)+suffix)hash=((hash<<5)-hash+c.charCodeAt(0))|0;
    return 'll-'+(hash>>>0).toString(36);
  }
  function labTextLines(value,x,y,max=23) {
    const words=String(value||'').split(/\s+/),lines=[];let line='';
    for(const word of words){if(line&&line.length+word.length+1>max){lines.push(line);line=word;}else line+=(line?' ':'')+word;}
    if(line)lines.push(line);
    return `<text x="${x}" y="${y}" text-anchor="middle" class="lab-svg-label">${lines.slice(0,4).map((v,i)=>`<tspan x="${x}" dy="${i?20:0}">${esc(v)}</tspan>`).join('')}</text>`;
  }
  function labArrow(x1,y1,x2,y2,id,extra='') { return `<path d="M${x1} ${y1} L${x2} ${y2}" class="lab-svg-line ${extra}" marker-end="url(#${id}-arrow)"/>`; }
  function labSvgStart(rec,suffix,title,desc,box='0 0 480 280') {
    const id=labId(rec,suffix);
    return `<svg class="lab-illustration" viewBox="${box}" role="img" aria-labelledby="${id}-title ${id}-desc"><title id="${id}-title">${esc(title)}</title><desc id="${id}-desc">${esc(desc)}</desc><defs><marker id="${id}-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L6 3 L0 6" fill="none" stroke="currentColor" stroke-width="1.4"/></marker><pattern id="${id}-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="currentColor" opacity=".09"/></pattern></defs><rect width="480" height="280" fill="url(#${id}-dots)"/>`;
  }
  function labIllustration(rec,kind,caption,suffix='idea') {
    const s=labSession(rec),id=labId(rec,suffix);let drawing='',title='See the idea';
    if(kind==='reservoir'){
      title='A stock changes through what comes in and what goes out';
      drawing=`<path d="M145 62V218Q145 230 158 230H322Q335 230 335 218V62" class="lab-svg-heavy"/><rect x="151" y="144" width="178" height="81" rx="6" class="lab-svg-fill"/><path d="M151 189H329M204 144V225M273 144V225" class="lab-svg-line lab-svg-faint"/><path d="M55 84H181V112" class="lab-svg-line" marker-end="url(#${id}-arrow)"/><path d="M305 199H421" class="lab-svg-line" marker-end="url(#${id}-arrow)"/><circle cx="114" cy="84" r="12" class="lab-svg-paper"/><path d="M106 84H122M114 76V92" class="lab-svg-line"/><circle cx="367" cy="199" r="12" class="lab-svg-paper"/><path d="M359 199H375" class="lab-svg-line"/>${labTextLines('Coming in',75,52)}${labTextLines('Going out',403,171)}${labTextLines('STOCK ON HAND',240,176)}${labTextLines('Change = in − out',240,262)}`;
    }else if(kind==='capacity'){
      title='Commitments share a finite calendar';
      drawing=`<rect x="70" y="52" width="340" height="180" rx="12" class="lab-svg-paper"/><path d="M70 97H410M138 97V232M206 97V232M274 97V232M342 97V232" class="lab-svg-line lab-svg-faint"/><rect x="80" y="112" width="116" height="42" rx="6" class="lab-svg-fill"/><rect x="216" y="170" width="184" height="42" rx="6" class="lab-svg-fill"/>${labTextLines('Available hours',240,80)}${labTextLines('One task',137,139)}${labTextLines('Other duties',307,197)}${labTextLines('A new yes needs a tradeoff',240,266)}`;
    }else if(kind==='feedback'){
      title='Trace a response and what comes back';
      drawing=`<path d="M152 72C222 6 384 54 361 141" class="lab-svg-line" marker-end="url(#${id}-arrow)"/><path d="M329 203C258 279 92 227 115 138" class="lab-svg-line" marker-end="url(#${id}-arrow)"/><circle cx="126" cy="107" r="50" class="lab-svg-paper"/><circle cx="353" cy="169" r="50" class="lab-svg-fill"/>${labTextLines('A moment',126,103)}${labTextLines('Next response',353,165)}<circle cx="239" cy="139" r="34" class="lab-svg-ring"/><path d="M226 151A18 18 0 1 1 254 141" class="lab-svg-line" marker-end="url(#${id}-arrow)"/>${labTextLines('Information returns',258,34)}${labTextLines('The next change differs',209,267)}`;
    }else if(kind==='iceberg'){
      title='Look beneath a recurring event';
      drawing=`<path d="M183 103L237 26L289 103Z" class="lab-svg-paper"/><path d="M184 104L120 147L203 229L276 257L354 169L287 104Z" class="lab-svg-fill"/><path d="M199 135L267 226M277 130L197 192M171 162L310 170" class="lab-svg-line lab-svg-faint"/><path d="M20 107Q42 99 64 107T108 107T152 107T196 107T240 107T284 107T328 107T372 107T416 107T460 107" class="lab-svg-line"/>${labTextLines('Visible event',365,57)}<path d="M307 57H285" class="lab-svg-line lab-svg-faint"/>${labTextLines('Context',59,156)}${labTextLines('Possible causes',406,226)}<path d="M330 218H352" class="lab-svg-line lab-svg-faint"/>`;
    }else if(kind==='leverage'){
      title='Choose where to change a process';
      drawing=`<path d="M71 167L395 111" class="lab-svg-heavy"/><path d="M262 220L289 137L320 220Z" class="lab-svg-fill"/><path d="M31 223H448" class="lab-svg-line lab-svg-faint"/><rect x="343" y="60" width="54" height="55" rx="9" class="lab-svg-paper"/><path d="M89 52V143" class="lab-svg-line" marker-end="url(#${id}-arrow)"/><circle cx="290" cy="130" r="7" class="lab-svg-ink"/>${labTextLines('Decision point',115,34)}${labTextLines('Rule, process, or goal?',197,258)}${labTextLines('Response',390,35)}`;
    }else if(kind==='garden'){
      title='A review board keeps the important pieces visible';
      const pieces=(labEnrichment(rec)?.mnemonic?.items||[]).slice(0,3);
      drawing=`<rect x="52" y="45" width="376" height="190" rx="12" class="lab-svg-paper"/><path d="M91 249H389M164 235L151 260M316 235L329 260" class="lab-svg-heavy"/>${pieces.map((piece,i)=>{const x=pieces.length===2?145+i*190:pieces.length===1?240:120+i*120;return `<rect x="${x-51}" y="87" width="102" height="94" rx="8" class="lab-svg-fill"/>${labTextLines(piece.letter,x,127,13)}`;}).join('')}${labTextLines('Review board',240,29)}${labTextLines('Keep the context in view',240,279)}`;
    }else if(kind==='release'){
      title='Review an event and carry its useful lesson';
      drawing=`<rect x="57" y="60" width="160" height="162" rx="10" class="lab-svg-paper"/><rect x="269" y="60" width="157" height="162" rx="10" class="lab-svg-fill"/><path d="M104 58V45H170V58M311 58V45H376V58" class="lab-svg-heavy"/><path d="M81 150H190M81 172H180M294 150H401M294 172H391" class="lab-svg-line lab-svg-faint"/><path d="M225 137H259" class="lab-svg-line" marker-end="url(#${id}-arrow)"/>${labTextLines('Looking back',137,108)}${labTextLines('Useful next step',347,108)}${labTextLines('Keep the lesson and the responsibility',240,260,42)}`;
    }else if(kind==='compass'){
      title='Choose a direction within your influence';
      drawing=`<circle cx="238" cy="140" r="93" class="lab-svg-ring"/><circle cx="238" cy="140" r="70" class="lab-svg-paper"/><path d="M209 169L276 90L252 154Z" class="lab-svg-fill"/><path d="M209 169L224 123L276 90" class="lab-svg-line"/><circle cx="238" cy="140" r="7" class="lab-svg-ink"/><path d="M238 40V29M238 251V240M337 140H349M128 140H138" class="lab-svg-line"/>${labTextLines('Aim',238,19)}${labTextLines('Next decision',238,277)}${labTextLines('Values',65,146)}${labTextLines('Choices',419,146)}`;
    }else if(kind==='attention'){
      title='Attend to the decision in front of you';
      drawing=`<path d="M111 113L414 34V231L111 159Z" class="lab-svg-wash"/><rect x="53" y="112" width="95" height="49" rx="12" class="lab-svg-paper"/><path d="M131 112V161M73 135H102" class="lab-svg-line"/><circle cx="349" cy="131" r="39" class="lab-svg-fill"/><path d="M330 132L343 145L367 119" class="lab-svg-line"/><circle cx="246" cy="66" r="8" class="lab-svg-ring lab-svg-faint"/><circle cx="239" cy="202" r="12" class="lab-svg-ring lab-svg-faint"/><circle cx="421" cy="59" r="7" class="lab-svg-ring lab-svg-faint"/>${labTextLines('Attention',110,208)}${labTextLines('One next action',338,267)}`;
    }else{
      title='Explore the chapter’s concepts';
      const start=Math.floor(s.concept/3)*3,concepts=(rec.guide.concepts||[]).slice(start,start+3);
      drawing=concepts.map((concept,i)=>{const x=concepts.length===1?240:concepts.length===2?135+i*210:85+i*155;return `<circle cx="${x}" cy="117" r="49" class="${i+start===s.concept?'lab-svg-fill':'lab-svg-paper'}"/>${labTextLines(String(i+start+1).padStart(2,'0'),x,124)}${labTextLines(concept.title,x,192,17)}`;}).join('');
    }
    return `${labSvgStart(rec,suffix,title,caption||title)}${drawing}</svg>`;
  }
  function labPrediction(rec,enrich,s) {
    const p=enrich?.prediction;
    if(!p||!Array.isArray(p.choices)||p.choices.length<2||!Number.isInteger(p.correctIndex)||p.correctIndex<0||p.correctIndex>=p.choices.length)return `<div class="lab-prompt"><p class="lab-kicker">Make a prediction</p><h3>What would change if you used this idea?</h3><p>Choose a situation from your work or life. Predict what changes, what stays the same, and why. Keep the book’s claim separate from your own example.</p></div>`;
    const answered=Number.isInteger(s.answer)&&s.answer>=0&&s.answer<p.choices.length;
    return `<div class="lab-prediction"><p class="lab-kicker">Fictional practice · Predict, then check</p><h3>${esc(p.question)}</h3><div class="lab-choices" role="group" aria-label="Choose a prediction">${p.choices.map((choice,i)=>`<button type="button" class="lab-choice ${answered&&s.answer===i?'is-selected':''}" data-action="lab-predict" data-index="${i}" aria-pressed="${answered&&s.answer===i}"><span class="lab-choice-letter" aria-hidden="true">${String.fromCharCode(65+i)}</span><span>${esc(choice.label)}</span>${answered&&s.answer===i?'<span class="lab-choice-mark" aria-hidden="true">↳</span>':''}</button>`).join('')}</div>${answered?`<div class="lab-feedback" role="status"><strong>${s.answer===p.correctIndex?'That fits the idea.':'Look at the distinction.'}</strong><p>${esc(p.choices[s.answer].feedback)}</p><button type="button" class="lab-text-button" data-action="lab-retry">Try again</button></div>`:'<p class="lab-fine">Choose an answer before opening the explanation.</p>'}</div>`;
  }
  function labMemory(rec,enrich,s) {
    const m=enrich?.mnemonic,concepts=roleContextGuide(rec).concepts||[],id=labId(rec,'memory');
    const custom=m&&m.cue, cue=custom?m.cue:'Your memory hook';
    return `<div class="lab-memory"><div class="lab-memory-top"><p class="lab-kicker">Original memory aid</p><span class="lab-pill">Memory practice</span></div><h3 class="lab-memory-cue">${esc(cue)}</h3><p>${custom?'Guess what the cue stands for, then flip the card.':'Recall how the chapter’s main ideas connect, then flip the card.'}</p><button type="button" class="lab-toggle" data-action="lab-memory" aria-expanded="${s.memory}" aria-controls="${id}">${s.memory?'Hide the meaning':'Reveal the meaning'} <span aria-hidden="true">${s.memory?'−':'+'}</span></button><div id="${id}" ${s.memory?'':'hidden'} class="lab-memory-back">${custom?`<p class="lab-memory-meaning">${esc(m.meaning)}</p>${Array.isArray(m.items)&&m.items.length?`<ul class="lab-mnemonic-items">${m.items.map(item=>`<li><span>${esc(item.letter)}</span><p>${esc(item.meaning)}</p></li>`).join('')}</ul>`:''}<p class="lab-fine">${esc(m.caution||'A companion memory aid. Check the chapter for the full argument.')}</p>`:`<ol>${concepts.slice(0,4).map(c=>`<li>${esc(c.title)}</li>`).join('')}</ol><p class="lab-fine">Your cue is a retrieval aid. Keep the distinctions and limits from the chapter.</p>`}</div></div>`;
  }
  function labSparkline(history,id,target=null) {
    const values=history.slice(-25),width=380,height=110;
    const points=values.map((n,i)=>`${40+(values.length===1?0:i/(values.length-1)*width)},${126-labClamp(n,0,100)/100*height}`).join(' ');
    return `<svg viewBox="0 0 460 160" class="lab-chart" role="img" aria-labelledby="${id}-chart-title"><title id="${id}-chart-title">${esc('Illustrative history: '+values.map(n=>Math.round(n)).join(', '))}</title><path d="M40 16V126H420" class="lab-chart-axis"/>${target!==null?`<path d="M40 ${126-target/100*height}H420" class="lab-chart-target"/><text x="415" y="${118-target/100*height}" text-anchor="end" class="lab-chart-text">Target ${target}</text>`:''}<polyline points="${points}" class="lab-chart-series"/><circle cx="${values.length===1?40:420}" cy="${126-values[values.length-1]/100*height}" r="4" class="lab-svg-ink"/><text x="24" y="22" text-anchor="end" class="lab-chart-text">100</text><text x="24" y="131" text-anchor="end" class="lab-chart-text">0</text><text x="40" y="152" class="lab-chart-text">Earlier</text><text x="420" y="152" text-anchor="end" class="lab-chart-text">Now</text></svg>`;
  }
  function labReservoirResult(rec,s) {
    const id=labId(rec,'tank'),net=s.inflow-s.outflow,waterY=220-s.level*1.65;
    return `<div class="lab-tank-display"><svg viewBox="0 0 460 255" class="lab-simulation-svg" role="img" aria-label="The supply shelf holds ${s.level} items. Returns ${s.inflow}; requests ${s.outflow}; requested net change ${net} per round."><path d="M150 40V219Q150 227 159 227H301Q310 227 310 219V40" class="lab-svg-heavy"/><path d="M154 ${waterY}H306V218Q306 223 299 223H161Q154 223 154 216Z" class="lab-svg-fill"/><path d="M36 67H183V103M292 205H421" class="lab-svg-line"/><path d="M175 95L183 104L191 95M413 197L422 205L413 213" class="lab-svg-line"/><text x="230" y="158" text-anchor="middle" class="lab-tank-number">${s.level}</text><text x="230" y="181" text-anchor="middle" class="lab-svg-label">items</text><text x="72" y="46" text-anchor="middle" class="lab-svg-label">+${s.inflow} / round</text><text x="389" y="184" text-anchor="middle" class="lab-svg-label">−${s.outflow} / round</text></svg><div class="lab-sim-reading" role="status"><span class="lab-kicker">Requested net flow</span><strong>${net>0?'+':''}${net}<small> items / round</small></strong><p>${net===0?'Equal flows keep the stock steady.':net>0?'More items return than leave. The shelf count rises toward its capacity.':'More items are requested than return. The shelf count falls toward zero.'}</p></div></div>${labSparkline(s.history,id)}<p class="lab-fine">Fictional example: a team lead reviews a shared supply shelf with room for 100 items. Extra returns go to overflow storage; an empty shelf cannot fill every request. Each step is one round. This demonstrates simple stock accounting, not a model of anyone’s energy, health, or wellbeing.</p>`;
  }
  function labReservoir(rec,s) {
    const id=labId(rec,'tank');
    return `<div class="lab-simulator" data-lab-simulator="reservoir"><div class="lab-section-heading"><div><p class="lab-kicker">Play with the system</p><h3>Manage a shared supply.</h3></div><span class="lab-pill">Stock + flow</span></div><div data-lab-result>${labReservoirResult(rec,s)}</div><div class="lab-slider-grid"><label for="${id}-in"><span>Items returned / round <output data-lab-output="inflow">${s.inflow}</output></span><input id="${id}-in" type="range" min="0" max="12" step="1" value="${s.inflow}" data-lab-control="inflow"></label><label for="${id}-out"><span>Items requested / round <output data-lab-output="outflow">${s.outflow}</output></span><input id="${id}-out" type="range" min="0" max="12" step="1" value="${s.outflow}" data-lab-control="outflow"></label></div><div class="lab-actions"><button type="button" class="lab-button" data-action="lab-tank-step" data-count="1">Advance one step <span aria-hidden="true">→</span></button><button type="button" class="lab-button-secondary" data-action="lab-tank-step" data-count="10">Run 10 steps</button><button type="button" class="lab-text-button" data-action="lab-tank-reset">Reset shelf</button></div><p class="lab-challenge"><strong>Try this:</strong> match returns and requests while 50 items remain on the shelf. Does an unchanged count mean nothing moved?</p></div>`;
  }
  function labFeedbackResult(rec,s) {
    const id=labId(rec,'feedback-sim');
    return `<div class="lab-feedback-values"><div><span>${s.mode==='balance'?'Items on the shelf (toy count)':'Workshop sign-ups (toy count)'}</span><strong>${s.feedback.toFixed(1)}</strong></div><div><span>${s.mode==='balance'?'Target':'Growth rate / step'}</span><strong>${s.mode==='balance'?'50':(s.gain/10).toFixed(1)+'%'}</strong></div><div><span>Information delay</span><strong>${s.delay}<small> steps</small></strong></div></div>${labSparkline(s.feedbackHistory,id,s.mode==='balance'?50:null)}<p class="lab-sim-explanation" role="status">${s.mode==='balance'?'A fictional team lead reviews the shared-supply process: each response adjusts a fraction of the gap between 50 items and the reported count. Delayed count information can make a strong correction overshoot.':'A fictional community organizer opens a workshop; in this toy model, earlier sign-ups produce referrals. This toy model adds a fixed fraction of observed sign-ups each step, so the same percentage adds more as the count grows.'}</p><p class="lab-fine">Illustrative arithmetic only, with a 0–100 display boundary and fractional counts. Balancing: change = response × observed shelf gap. Reinforcing: change = referral rate × observed sign-ups. Real operations have other delays and constraints. These equations are not forecasts for any real person or organization.</p>`;
  }
  function labFeedback(rec,s) {
    const id=labId(rec,'feedback-controls');
    return `<div class="lab-simulator" data-lab-simulator="feedback"><div class="lab-section-heading"><div><p class="lab-kicker">Change the response</p><h3>Review a feedback loop.</h3></div><span class="lab-pill">Feedback lab</span></div><div class="lab-segmented" role="group" aria-label="Feedback type"><button type="button" data-action="lab-loop-mode" data-mode="balance" aria-pressed="${s.mode==='balance'}">Shelf target</button><button type="button" data-action="lab-loop-mode" data-mode="reinforce" aria-pressed="${s.mode==='reinforce'}">Workshop referrals</button></div><div data-lab-result>${labFeedbackResult(rec,s)}</div><div class="lab-slider-grid"><label for="${id}-gain"><span>${s.mode==='balance'?'Response strength':'Growth rate'} <output data-lab-output="gain">${s.mode==='balance'?s.gain:s.gain/10}%</output></span><input id="${id}-gain" type="range" min="0" max="100" step="5" value="${s.gain}" data-lab-control="gain"></label><label for="${id}-delay"><span>Information delay <output data-lab-output="delay">${s.delay} steps</output></span><input id="${id}-delay" type="range" min="0" max="4" step="1" value="${s.delay}" data-lab-control="delay"></label></div><div class="lab-actions"><button type="button" class="lab-button" data-action="lab-loop-step" data-count="1">Advance one step <span aria-hidden="true">→</span></button><button type="button" class="lab-button-secondary" data-action="lab-loop-step" data-count="12">Run 12 steps</button><button type="button" class="lab-text-button" data-action="lab-loop-reset">Reset loop</button></div><p class="lab-challenge"><strong>Try this:</strong> use the shelf target with 80% response and a three-step delay. Compare that trace with zero delay. Change one setting at a time.</p></div>`;
  }
  function labAttentionResult(rec,s) {
    const active=10-s.attention;
    return `<div class="lab-attention-comparison"><div class="lab-attention-past"><div class="lab-recording" aria-hidden="true"><span>▶</span><div></div></div><h4>The recorded event</h4><div class="lab-token-row" aria-label="${s.attention} attention tokens on the past">${Array.from({length:10},(_,i)=>`<span class="lab-token ${i<s.attention?'is-filled':''}" aria-hidden="true"></span>`).join('')}</div><p>The event stays the same.</p></div><div class="lab-attention-next"><div class="lab-next-path" aria-hidden="true">${[0,1,2].map((n)=>`<span class="${active>=n*3+1?'is-filled':''}">${n+1}</span>${n<2?'<i>→</i>':''}`).join('')}</div><h4>Your next response</h4><div class="lab-token-row" aria-label="${active} attention tokens on a next response">${Array.from({length:10},(_,i)=>`<span class="lab-token ${i<active?'is-filled':''}" aria-hidden="true"></span>`).join('')}</div><p>Identify the lesson. Plan a conversation and a follow-up.</p></div></div><p class="lab-sim-explanation" role="status">${s.attention} tokens on replaying; ${active} on a possible response. Moving tokens changes the allocation, not what happened.</p><p class="lab-fine">A fictional reflection exercise, not a model of mental health. Reflection can help you learn; feelings and recurring thoughts have no reliable off switch. There is no ideal token split.</p>`;
  }
  function labAttention(rec,s) {
    const id=labId(rec,'attention');
    return `<div class="lab-simulator" data-lab-simulator="attention"><div class="lab-section-heading"><div><p class="lab-kicker">Try a different allocation</p><h3>The event happened. Your next response is open.</h3></div><span class="lab-pill">10 tokens</span></div><div data-lab-result>${labAttentionResult(rec,s)}</div><label class="lab-attention-slider" for="${id}"><span>Attention on replaying the event <output data-lab-output="attention">${s.attention} / 10</output></span><input id="${id}" type="range" min="0" max="10" step="1" value="${s.attention}" data-lab-control="attention"></label><p class="lab-challenge"><strong>Try this:</strong> move two tokens toward a response. Name the conversation, repair, or decision those tokens would represent. Keep room for the feeling.</p></div>`;
  }
  function labFlow(rec,s) {
    const flow=roleContextGuide(rec).flow||{},nodes=flow.nodes||[],idx=labClamp(s.path,0,Math.max(0,nodes.length-1)),n=nodes[idx];
    if(!n)return '';
    const outgoing=(flow.edges||[]).filter(e=>e.from===n.id);
    return `<div class="lab-connected-flow"><p class="lab-kicker">Trace the relationship</p><h3>One connection at a time.</h3><div class="lab-flow-tabs" role="group" aria-label="Explore flow nodes">${nodes.map((v,i)=>`<button type="button" data-action="lab-path" data-index="${i}" aria-pressed="${i===idx}" aria-label="Step ${i+1}: ${esc(v.label)}">${i+1}</button>`).join('')}</div><div class="lab-flow-focus"><span class="lab-flow-number" aria-hidden="true">${String(idx+1).padStart(2,'0')}</span><h4>${esc(n.label)}</h4><p>${esc(n.detail)}</p></div><div class="lab-flow-outgoing">${outgoing.length?outgoing.map(e=>{const target=nodes.findIndex(v=>v.id===e.to);return target<0?'':`<button type="button" data-action="lab-path" data-index="${target}"><span>${esc(e.label||'Leads to')}</span><span aria-hidden="true">↓</span><strong>${esc(nodes[target].label)}</strong></button>`;}).join(''):'<p>You reached the end of this route. Return to another step and follow a different connection.</p>'}</div><p class="lab-fine">${esc(flow.limit||'A learning map of the guide’s reasoning. Compare the connections with the original chapter.')}</p></div>`;
  }
  function renderLessonLab(rec,stage) {
    if(!rec?.guide)return '';
    const s=labSession(rec),enrich=labEnrichment(rec),g=roleContextGuide(rec),kind=enrich?.visual?.kind||'connections';let body='';
    if(stage==='idea'){
      const concepts=g.concepts||[],i=labClamp(s.concept,0,Math.max(0,concepts.length-1)),c=concepts[i];
      const heroShown=typeof ideaApplies==='function'&&ideaApplies(rec);
      body=`<div class="lab-visual-card"><div class="lab-section-heading"><p class="lab-kicker">${heroShown?'The ideas, one at a time':'See the idea'}</p><span class="lab-pill">${heroShown?`${concepts.length} concepts`:'Visual note'}</span></div>${heroShown?'':`<figure>${typeof chapterArtwork==='function'?chapterArtwork(rec):labIllustration(rec,kind,enrich?.visual?.caption||g.gist)}<figcaption>${esc(typeof chapterSceneCaption==='function'?chapterSceneCaption(rec):g.chapterVisual?.caption||enrich?.visual?.caption||'Follow each concept and the relationship described below.')}</figcaption></figure>`}${c?`<div class="lab-concept-navigation" role="group" aria-label="Explore the chapter’s concepts">${concepts.map((v,j)=>`<button type="button" data-action="lab-concept" data-index="${j}" aria-pressed="${j===i}"><span>${String(j+1).padStart(2,'0')}</span>${esc(v.title)}</button>`).join('')}</div><div class="lab-concept-focus" role="status"><span class="lab-kicker">Concept ${i+1} of ${concepts.length}</span><h3>${esc(c.title)}</h3>${readingProse(c.explanation)}<div class="lab-source-links">${typeof refs==='function'?refs(rec.chapterId,c.sourceRefs||[]):''}</div></div>`:''}</div><details class="lab-concept-reading"><summary>Read all ${concepts.length} concepts in order</summary>${concepts.map((concept,j)=>`<article><span class="connection-label">${j+1} / ${concepts.length}</span><h3>${esc(concept.title)}</h3>${readingProse(concept.explanation)}${typeof refs==='function'?refs(rec.chapterId,concept.sourceRefs||[]):''}</article>`).join('')}</details>`;
    }else if(stage==='flow'){
      // A toy model runs only when prepared enrichment names it for this lesson, never from a metaphor kind alone.
      const simulator=coordinatorExamplesEnabled()?enrich?.simulator:null;
      body=simulator==='reservoir'?labReservoir(rec,s):simulator==='feedback'?labFeedback(rec,s):simulator==='attention'?labAttention(rec,s):labFlow(rec,s);
    }else if(stage==='apply'){
      body=coordinatorExamplesEnabled()?labPrediction(rec,enrich,s):coordinatorExamplesNotice();
    }else if(stage==='recall'){body=labMemory(rec,enrich,s);}
    else if(stage==='analogy'){
      body=`<div class="lab-analogy-prompt"><span class="lab-drawing-symbol" aria-hidden="true">↔</span><div><p class="lab-kicker">Connect the familiar to the new</p><h3>Picture it first. Then test the fit.</h3><p>Which part of this analogy carries the idea? Which part could mislead you?</p></div></div>`;
    }
    return body?`<section class="lesson-lab" data-lesson-lab="${esc(labKey(rec))}" data-lab-stage="${esc(stage)}" aria-label="Interactive learning activity">${body}</section>`:'';
  }
  function labRefresh(section,rec,focusEl=null) {
    if(!section?.isConnected)return;
    const stage=section.dataset.labStage,action=focusEl?.dataset.action,index=focusEl?.dataset.index,mode=focusEl?.dataset.mode,count=focusEl?.dataset.count;
    const holder=document.createElement('div');holder.innerHTML=renderLessonLab(rec,stage);
    const next=holder.firstElementChild;section.replaceWith(next);
    if(action){const target=[...next.querySelectorAll('[data-action]')].find(el=>el.dataset.action===action&&(index===undefined||el.dataset.index===index)&&(mode===undefined||el.dataset.mode===mode)&&(count===undefined||el.dataset.count===count));(target || (action==='lab-retry'?next.querySelector('[data-action="lab-predict"]'):null))?.focus({preventScroll:true});}
  }
  function handleLessonLabAction(action,el) {
    if(!action?.startsWith('lab-'))return false;
    const section=el.closest('[data-lesson-lab]'),rec=lessonLabRecords.get(section?.dataset.lessonLab);if(!rec)return true;
    const s=labSession(rec);let i=Number(el.dataset.index);
    if(action==='lab-concept')s.concept=labClamp(i||0,0,(rec.guide.concepts||[]).length-1);
    else if(action==='lab-path')s.path=labClamp(i||0,0,(roleContextGuide(rec).flow?.nodes||[]).length-1);
    else if(action==='lab-predict'){const p=labEnrichment(rec)?.prediction;if(p&&Number.isInteger(i)&&i>=0&&i<p.choices.length)s.answer=i;}
    else if(action==='lab-retry')s.answer=null;
    else if(action==='lab-memory')s.memory=!s.memory;
    else if(action==='lab-tank-step'){for(let n=0;n<labClamp(Number(el.dataset.count)||1,1,10);n++){s.level=labClamp(s.level+s.inflow-s.outflow,0,100);s.history.push(s.level);}s.history=s.history.slice(-100);}
    else if(action==='lab-tank-reset'){s.level=50;s.history=[50];}
    else if(action==='lab-loop-mode'){s.mode=el.dataset.mode==='reinforce'?'reinforce':'balance';s.feedback=20;s.feedbackHistory=[20];}
    else if(action==='lab-loop-step'){
      for(let n=0;n<labClamp(Number(el.dataset.count)||1,1,12);n++){
        const observed=s.feedbackHistory[Math.max(0,s.feedbackHistory.length-1-s.delay)];
        const change=s.mode==='balance'?(50-observed)*s.gain/100:observed*s.gain/1000;
        s.feedback=labClamp(s.feedback+change,0,100);s.feedbackHistory.push(s.feedback);
      }s.feedbackHistory=s.feedbackHistory.slice(-100);
    }else if(action==='lab-loop-reset'){s.feedback=20;s.feedbackHistory=[20];}
    else return false;
    labRefresh(section,rec,el);return true;
  }
  function handleLessonLabInput(el) {
    const control=el?.dataset?.labControl;if(!control)return false;
    const section=el.closest('[data-lesson-lab]'),rec=lessonLabRecords.get(section?.dataset.lessonLab);if(!rec)return true;
    const s=labSession(rec),limits={inflow:[0,12],outflow:[0,12],gain:[0,100],delay:[0,4],attention:[0,10]};
    if(!Object.hasOwn(limits,control))return false;
    const value=Number(el.value);if(!Number.isFinite(value))return true;
    s[control]=labClamp(value,...limits[control]);
    const output=section.querySelector(`[data-lab-output="${control}"]`);
    if(output)output.textContent=String(control==='gain'&&s.mode==='reinforce'?s.gain/10:s[control])+(control==='gain'?'%':control==='delay'?' steps':control==='attention'?' / 10':'');
    const result=section.querySelector('[data-lab-result]'),type=section.querySelector('[data-lab-simulator]')?.dataset.labSimulator;
    if(result)result.innerHTML=type==='reservoir'?labReservoirResult(rec,s):type==='feedback'?labFeedbackResult(rec,s):labAttentionResult(rec,s);
    return true;
  }
  document.addEventListener('input',event=>handleLessonLabInput(event.target));
