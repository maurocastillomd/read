  const articleStatsSessions=new Map();
  function statsCoordinatorEnabled(){return typeof coordinatorExamplesEnabled==='function'&&coordinatorExamplesEnabled();}
  function articleStatsSession(rec){
    const key=rec.bookId+'/'+rec.unitId;
    if(!articleStatsSessions.has(key))articleStatsSessions.set(key,{tab:'p',visited:new Set(['p'])});
    return articleStatsSessions.get(key);
  }
  function statsMetricNumber(value){return String(value);}
  function statsMetricValue(metric){return `${metric.measure} ${metric.operator} ${statsMetricNumber(metric.value)}${metric.unit?' '+metric.unit:''}`;}
  function statsMetricsForTab(profile,tab){const kind={p:'p-value',effect:'effect-size',reliability:'reliability',association:'association',estimate:'estimate'}[tab];return profile.metrics.filter(metric=>metric.kind===kind);}
  function statsCurrentMetric(profile,session){const metrics=statsMetricsForTab(profile,session.tab);return metrics.find(m=>m.id===session.genericMetrics?.[session.tab])||metrics[0];}
  function statsMetricReference(metric){return metric.flavor==='ratio'?1:['correlation','standardized','difference'].includes(metric.flavor)?0:null;}
  function statsMetricAxis(metric){
    const values=[metric.value,...(metric.interval?[metric.interval.low,metric.interval.high]:[])],reference=statsMetricReference(metric);
    if(metric.flavor==='p')return {min:0,max:1,reference:null};
    if(['correlation','icc'].includes(metric.flavor))return {min:-1,max:1,reference:metric.flavor==='correlation'?0:null};
    if(reference!==null)values.push(reference);
    let min=Math.min(...values),max=Math.max(...values),pad=Math.max((max-min)*.2,Math.abs(metric.value)*.2,.01);
    min-=pad;max+=pad;
    if(['ratio','error','cv'].includes(metric.flavor))min=Math.max(0,min);
    return {min,max,reference};
  }
  function statsMetricChart(metric){
    const axis=statsMetricAxis(metric),left=55,right=625,base=93,x=v=>left+(v-axis.min)/(axis.max-axis.min)*(right-left),bounded=['<','>','≤','≥'].includes(metric.operator),lower=['>','≥'].includes(metric.operator),plot=x(metric.value),ci=metric.interval;
    const ticks=[axis.min,(axis.min+axis.max)/2,axis.max],range=bounded?`<rect class="stats-bound-area" x="${lower?plot:left}" y="64" width="${lower?right-plot:plot-left}" height="58"/><line class="stats-study-line" x1="${plot}" x2="${plot}" y1="59" y2="128"/>`:'';
    const interval=ci?`<line class="stats-interval-line" x1="${x(ci.low)}" x2="${x(ci.high)}" y1="${base}" y2="${base}"/><line class="stats-selected-line" x1="${x(ci.low)}" x2="${x(ci.low)}" y1="${base-8}" y2="${base+8}"/><line class="stats-selected-line" x1="${x(ci.high)}" x2="${x(ci.high)}" y1="${base-8}" y2="${base+8}"/>`:'';
    const reference=axis.reference!==null?`<line class="stats-threshold-line" x1="${x(axis.reference)}" x2="${x(axis.reference)}" y1="38" y2="130"/>`:'';
    const referenceLabel=axis.reference===1?'Ratio of 1':axis.reference===0?'Zero reference':'';
    return `<div class="stats-value-visual">${referenceLabel?`<div class="stats-reference-key"><span aria-hidden="true"></span>${referenceLabel}</div>`:''}<svg class="stats-value-chart" viewBox="0 0 680 150" role="img" aria-label="${esc(statsMetricValue(metric))}${ci?', interval '+statsMetricNumber(ci.low)+' to '+statsMetricNumber(ci.high):', no interval reported in this extracted result'}${referenceLabel?'. Dashed line: '+referenceLabel:''}"><line class="stats-chart-guide" x1="${left}" x2="${right}" y1="${base}" y2="${base}"/>${reference}${range}${interval}${bounded?'':`<circle class="stats-selected-dot" cx="${plot}" cy="${base}" r="7"/>`}<line class="stats-chart-axis" x1="${left}" x2="${right}" y1="140" y2="140"/>${ticks.map(t=>`<line class="stats-chart-axis" x1="${x(t)}" x2="${x(t)}" y1="140" y2="146"/>`).join('')}</svg><div class="stats-value-ticks" aria-hidden="true">${ticks.map(t=>`<span>${esc(Number(t.toPrecision(4)).toString())}</span>`).join('')}</div></div>`;
  }
  function statsMetricMeaning(metric){
    const flavor=metric.flavor;
    if(flavor==='p')return ['Compatibility with a statistical model','The p value describes how unusual the tested result, or a more extreme one, would be under the null model and its assumptions. It does not give the probability that the null hypothesis is true. It does not measure the size or usefulness of an effect.'];
    if(flavor==='ratio')return ['A relative comparison','A ratio of 1 represents equal quantities for the specified comparison. Values below and above 1 point in opposite directions. Odds, risks, rates, and hazards have different meanings; keep the reported measure and reference group attached. A ratio does not supply the absolute difference by itself.'];
    if(flavor==='icc')return ['Relative measurement reliability','ICC describes variation between people relative to variation in repeated measurements under a particular model and protocol. Its value depends on the sample and design. It is not percent accuracy, and it does not provide an error margin in the original units.'];
    if(flavor==='agreement')return ['Agreement beyond a reference model','Kappa describes agreement relative to the agreement expected under its reference model. Its value depends on the categories, sample, and method. It is not percent agreement or an error margin in the original units.'];
    if(flavor==='consistency')return ['Internal consistency of a scale','This coefficient concerns how the items in a scale relate under its measurement model. It does not establish validity, a single underlying construct, or stability across days. Read the items, sample, and model before using the coefficient.'];
    if(flavor==='precision')return ['Precision of an estimated mean','The standard error of the mean describes the estimated sampling variability of the mean under the analysis. It is not the spread of individual observations, the standard error of measurement, or an individual detectable-change threshold. Keep the sample and analysis method attached.'];
    if(flavor==='error')return ['Error in the measurement units','This estimate describes measurement error under the reported method. Read the units and protocol before comparing it with a change. SEM is not an ICC, and an error estimate by itself is not an individual detectable-change threshold.'];
    if(flavor==='cv')return ['Relative variability','CV expresses variability relative to a mean, often as a percentage. Whether it describes repeatability or variation between observations depends on the calculation in this source. It is not percent accuracy, and a percentage CV is not an error margin in the original units.'];
    if(flavor==='correlation')return ['Direction and strength of association','The sign tells you the direction of the reported association, using the variables as coded. The magnitude describes the association for this sample and method. Correlation does not establish causation or agreement between two measurement methods.'];
    if(flavor==='variance')return ['A proportion on its own scale','This statistic describes variance accounted for under its particular definition and model. Keep the exact reported measure attached: R², eta-squared, and related measures are not interchangeable. It is not a percentage improvement or proof of a causal effect.'];
    if(flavor==='standardized')return ['A change or contrast on a standardized scale','A standardized effect uses a reference variability or model scale. Preserve its sign and comparison direction. The number is not a percentage change. The relevant magnitude depends on the measure, uncertainty, and question; this lab does not apply universal size labels.'];
    if(flavor==='difference')return ['A difference in context','A difference expresses a contrast or change on the reported scale. Zero is a reference for no difference, but direction depends on the comparison order. Practical importance requires context and uncertainty, not only the point estimate.'];
    if(metric.kind==='effect-size')return ['The reported effect size','Read this effect on the scale defined in the article. The label ES alone does not identify its calculation or denominator. Preserve its sign, comparison, and uncertainty; do not turn it into a percent change or apply universal magnitude cutoffs.'];
    return ['The reported estimate','Keep this number attached to its measure, units, sample, comparison, and time point. Its meaning comes from the method used in the article. The figure does not add a decision threshold or an uncertainty interval that the source did not report.'];
  }
  function statsMetricCheck(metric){
    const common='Keep the measure, comparison, uncertainty, and study design attached to the result.';
    if(metric.flavor==='p')return {question:'What can this p value tell you?',options:['Compatibility of the tested data with the null model and its assumptions.','The probability that there was no effect.'],answer:'The first interpretation fits a p value. It cannot tell you the probability of no effect, the size of an effect, or whether two conditions are equivalent.'};
    if(metric.flavor==='ratio')return {question:'What else do you need to judge the practical size?',options:['The absolute baseline risk or quantity and the exact comparison.','The ratio alone is enough to know how many outcomes would change.'],answer:'The first interpretation fits. A relative measure needs a baseline quantity to describe an absolute change, and an observational association does not establish an intervention effect.'};
    if(metric.flavor==='icc')return {question:'Does this ICC provide an individual error margin?',options:['No. I need the appropriate error estimate and testing protocol.','Yes. I can read ICC as the percentage of measurements that are correct.'],answer:'The first interpretation fits. ICC concerns relative reliability under a model. It is not percent accuracy, a day-to-day guarantee, or a threshold for a real change.'};
    if(['error','cv'].includes(metric.flavor))return {question:'How should you use this measurement result?',options:['Check its units, calculation, and protocol before interpreting a change.','Treat the value as the probability that a test result is correct.'],answer:'The first interpretation fits. This describes variability or error under a specified method. It is not a probability of being correct, and it does not automatically establish a detectable or worthwhile change.'};
    if(metric.flavor==='correlation')return {question:'What does the association establish?',options:['An association under the reported analysis, with causal limits.','Changing one variable will necessarily change the other by this amount.'],answer:'The first interpretation fits. Association alone cannot separate causation from confounding, selection, or other explanations.'};
    if(metric.flavor==='standardized')return {question:'Is this standardized effect a percentage change?',options:['No. It uses a reference variability or model scale.','Yes. Multiplying it by 100 gives the percent improvement.'],answer:'The first interpretation fits. Standardized effect and percent change use different scales. '+common};
    return {question:'What is the defensible next reading step?',options:['Read the estimate with its method, context, and reported uncertainty.','Treat the point estimate alone as a certain effect for each person.'],answer:'The first interpretation fits. A point estimate is not a guarantee for an individual. '+common};
  }
  function statsMetricSources(rec,metric){return `<details class="stats-source-evidence"><summary>See the quoted evidence</summary>${metric.sourceRefs.map(ref=>`<blockquote>${esc(ref.quote)}</blockquote>`).join('')}</details><div class="stats-passage-actions">${refs(rec.chapterId,metric.sourceRefs)}</div>`;}
  function statsGenericDecision(rec,profile){
    return `<div class="stats-panel-heading"><span class="eyebrow">Optional · Apply it</span><h3>Turn the findings into questions for your work or life.</h3><p>These prompts are companion interpretations. They do not add outcomes to the study or assume the findings transfer directly to your situation.</p></div><div class="stats-role-questions">${profile.metrics.map(metric=>`<article><h4>${esc(metric.label)}</h4><p class="stats-small">${esc(statsMetricValue(metric))}${metric.comparison?' · '+esc(metric.comparison):''}</p><p>${esc(metric.coordinatorQuestion||'How closely do the sample, task, measure, and conditions match the question you need to answer?')}</p>${refs(rec.chapterId,metric.sourceRefs)}</article>`).join('')}</div><p class="stats-small">This optional application stays separate from the article’s reported results.</p>`;
  }
  function statsGenericPanel(rec,profile,session){
    if(session.tab==='decision')return statsCoordinatorEnabled()?statsGenericDecision(rec,profile):'';
    const metrics=statsMetricsForTab(profile,session.tab),metric=statsCurrentMetric(profile,session);if(!metric)return '';
    const [title,meaning]=statsMetricMeaning(metric),bounded=['<','>','≤','≥'].includes(metric.operator),ci=metric.interval,check=statsMetricCheck(metric),selected=session.genericAnswers?.[metric.id];
    const intervalLabel=ci?`${ci.level===null?'':statsMetricNumber(ci.level)+'% '}${ci.type==='range'?'reported range':ci.type+' interval'}: ${statsMetricNumber(ci.low)} to ${statsMetricNumber(ci.high)}${metric.unit?' '+metric.unit:''}`:'No uncertainty interval is supplied for this extracted result.';
    return `<div class="stats-panel-heading"><span class="eyebrow">Read the actual result</span><h3>${esc(title)}</h3><p>${esc(meaning)}</p></div>${metrics.length>1?`<div class="stats-controls stats-generic-controls"><label>Reported result<select data-action="stats-generic-metric" aria-label="Choose a reported statistic">${metrics.map(m=>`<option value="${esc(m.id)}" ${m.id===metric.id?'selected':''}>${esc(m.label)}${m.timepoint?' · '+esc(m.timepoint):''}</option>`).join('')}</select></label></div>`:''}<div class="stats-generic-grid"><div class="stats-figure-card"><h4>${esc(metric.label)}</h4><div class="stats-actual-value"><strong class="stats-reported-number">${esc(metric.measure)} ${esc(metric.operator)} ${esc(statsMetricNumber(metric.value))}</strong>${metric.unit?` <span class="stats-reported-unit">${esc(metric.unit)}</span>`:''}</div>${statsMetricChart(metric)}<p class="stats-chart-caption">${bounded?'Shading marks values allowed by the reported bound within the displayed scale. The exact value is unknown.':metric.operator==='≈'?'The dot marks the reported approximate value. It is not an exact estimate.':'The dot marks the reported value.'} ${ci?'The horizontal line shows the reported interval or range.':'No uncertainty interval has been invented.'} ${metric.flavor==='p'?'This 0–1 scale is not a null distribution or the probability of a hypothesis.':'Axis limits organize the figure; they are not decision thresholds.'}</p><p class="stats-interval-label">${esc(intervalLabel)}</p>${ci?.type==='confidence'?'<p class="stats-small">A confidence interval describes the uncertainty produced by the statistical procedure under its assumptions. It is not a range containing that percentage of participants or a probability assigned to this fixed parameter.</p>':''}${metric.flavor==='p'&&metric.value===0?'<p class="stats-small">A displayed p value of 0 can reflect rounding. It should not be interpreted as a literal zero probability.</p>':''}</div><div class="stats-generic-context"><dl class="stats-result-context">${[['Comparison',metric.comparison],['Time point',metric.timepoint],['Reported context',metric.context]].filter(([,value])=>value).map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><div class="stats-interpretation"><span class="stats-model-label">Companion interpretation</span><p>${esc(metric.interpretation)}</p></div><div class="stats-method-note"><h4>Keep this limitation attached</h4><p>${esc(metric.caution)}</p></div></div></div><section class="stats-knowledge-check" aria-label="Interpretation check"><h4>${esc(check.question)}</h4><div class="stats-decision-options">${check.options.map((option,index)=>`<button type="button" data-action="stats-answer" data-index="${index}" aria-pressed="${selected===index}"><span class="stats-choice-index">${index+1}</span><span>${esc(option)}</span></button>`).join('')}</div>${selected===0||selected===1?`<div class="stats-decision-feedback" role="status"><span class="eyebrow">${selected===0?'That preserves the distinction':'Revisit the interpretation'}</span><p>${esc(check.answer)}</p></div>`:''}</section>${statsCoordinatorEnabled()?`<div class="stats-apply-note"><span class="eyebrow">Optional · Apply it</span><p>${esc(metric.coordinatorQuestion||'What would need to match between this study and your situation before this result could inform a decision?')}</p></div>`:''}${statsMetricSources(rec,metric)}`;
  }
  function articleStatsPanel(rec,profile,session){return statsGenericPanel(rec,profile,session);}
  function statsAvailableTabs(profile){
    const options=[
      ['p','P values','overview','p-value'],['effect','Effect sizes','layers','effect-size'],
      ['reliability','Reliability','focus','reliability'],['association','Associations','layers','association'],['estimate','Estimates','overview','estimate']
    ].filter(([, , ,kind])=>profile.metrics.some(metric=>metric.kind===kind));
    if(statsCoordinatorEnabled())options.push(['decision','Apply it','practice']);
    return options;
  }
  function statsSessionTabs(profile,session){
    const tabs=statsAvailableTabs(profile);
    if(!tabs.some(([id])=>id===session.tab))session.tab=tabs[0][0];
    session.visited.add(session.tab);
    return tabs;
  }
  function statsExplored(tabs,session){return tabs.filter(([id])=>session.visited.has(id)).length;}
  function articleStatisticsLab(rec){
    const profile=statsArticleProfile(activeBook,rec);if(!profile)return '';
    const session=articleStatsSession(rec),tabs=statsSessionTabs(profile,session),explored=statsExplored(tabs,session);
    return `<section class="statistics-lab" id="article-statistics-lab" aria-labelledby="stats-lab-title"><header class="stats-lab-header"><div><span class="eyebrow">Interactive statistics · This source</span><h2 id="stats-lab-title">Understand what the numbers can tell you.</h2><p>${esc(profile.scope)}</p></div><div class="stats-progress"><span id="stats-progress-label">${explored} of ${tabs.length} explored</span><progress id="stats-progress-bar" value="${explored}" max="${tabs.length}" aria-labelledby="stats-progress-label"></progress></div></header><nav class="stats-tabs" aria-label="Explore the study statistics">${tabs.map(([id,label,icon])=>`<button type="button" data-action="stats-tab" data-tab="${id}" aria-pressed="${session.tab===id}" aria-controls="stats-lab-panel">${readIcon(icon)}<span>${label}</span><span class="stats-tab-visited ${session.visited.has(id)?'is-visited':''}" aria-label="${session.visited.has(id)?'Explored':'Not yet explored'}"></span></button>`).join('')}</nav><div class="stats-lab-panel" id="stats-lab-panel">${articleStatsPanel(rec,profile,session)}</div><footer class="stats-lab-footer"><p>Only statistics anchored to quoted numbers in this imported section appear here. Explanations are companion interpretations. Check the passage to confirm the measure, comparison, and context.</p></footer></section>`;
  }
  function statsActiveRecord(){return bookGuides().find(r=>r.unitId===selectedUnit);}
  function statsRefreshPanel(rec,profile,focus){
    const lab=document.querySelector('#article-statistics-lab');if(!lab)return;
    const session=articleStatsSession(rec),tabs=statsSessionTabs(profile,session);lab.querySelector('#stats-lab-panel').innerHTML=articleStatsPanel(rec,profile,session);
    lab.querySelectorAll('[data-action="stats-tab"]').forEach(button=>{const id=button.dataset.tab;button.setAttribute('aria-pressed',String(id===session.tab));const dot=button.querySelector('.stats-tab-visited');dot.classList.toggle('is-visited',session.visited.has(id));dot.setAttribute('aria-label',session.visited.has(id)?'Explored':'Not yet explored');});
    lab.querySelector('#stats-progress-label').textContent=statsExplored(tabs,session)+' of '+tabs.length+' explored';lab.querySelector('#stats-progress-bar').value=statsExplored(tabs,session);lab.querySelector('#stats-progress-bar').max=tabs.length;
    if(focus)lab.querySelector(focus)?.focus({preventScroll:true});
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]'),action=button?.dataset.action;if(!action?.startsWith('stats-'))return;
    const rec=statsActiveRecord();if(!rec)return;const profile=statsArticleProfile(activeBook,rec);if(!profile)return;const session=articleStatsSession(rec);
    if(action==='stats-tab'){
      if(!statsAvailableTabs(profile).some(([id])=>id===button.dataset.tab))return;
      session.tab=button.dataset.tab;session.visited.add(session.tab);statsRefreshPanel(rec,profile,'[data-action="stats-tab"][data-tab="'+session.tab+'"]');return;
    }
    if(action==='stats-answer'){const index=Number(button.dataset.index);if(index!==0&&index!==1)return;const metric=statsCurrentMetric(profile,session);if(!metric)return;session.genericAnswers??={};session.genericAnswers[metric.id]=index;statsRefreshPanel(rec,profile,'[data-action="stats-answer"][data-index="'+index+'"]');}
  });
  document.addEventListener('change',event=>{
    if(event.target.dataset.action!=='stats-generic-metric')return;
    const rec=statsActiveRecord();if(!rec)return;const profile=statsArticleProfile(activeBook,rec);if(!profile)return;
    const session=articleStatsSession(rec),metrics=statsMetricsForTab(profile,session.tab);if(!metrics.some(m=>m.id===event.target.value))return;
    session.genericMetrics??={};session.genericMetrics[session.tab]=event.target.value;statsRefreshPanel(rec,profile,'[data-action="stats-generic-metric"]');
  });
