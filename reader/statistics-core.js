  /*STATISTICS_CONTRACT*/
  // The generic lab accepts source-anchored numbers, never inferred missing statistics.
  function statsSourceUnit(book,rec){
    const chapter=book?.chapters?.find(c=>c.id===rec.chapterId);
    if(typeof chapter?.text!=='string')return [];
    const paragraphs=chapter.text.replace(/\r\n?/g,'\n').split(/\n+/).map(t=>EpubStructure.structuredLine(t.replace(/[\t \f\v\u00a0]+/g,' ').trim())).filter(b=>b.kind!=='figure').map(b=>b.text).filter(Boolean).map((text,i)=>({id:'p'+(i+1),text}));
    const groups=[];let group=[],length=0;
    for(const paragraph of paragraphs){
      let start=0,part=0;
      while(start<paragraph.text.length){
        let end=Math.min(start+40000,paragraph.text.length);
        if(end<paragraph.text.length){const space=paragraph.text.lastIndexOf(' ',end-1);if(space>=start+20000)end=space+1;if(end>start&&/[\uD800-\uDBFF]/.test(paragraph.text[end-1])&&/[\uDC00-\uDFFF]/.test(paragraph.text[end]))end--;}
        const piece={id:paragraph.text.length>40000?paragraph.id+'.'+(++part):paragraph.id,text:paragraph.text.slice(start,end)};
        const addition=piece.text.length+(group.length?2:0);
        if(group.length&&length+addition>40000){groups.push(group);group=[];length=0;}
        length+=piece.text.length+(group.length?2:0);group.push(piece);start=end;
      }
    }
    if(group.length)groups.push(group);
    const index=Number(String(rec.unitId||'').match(/:u([1-9]\d*)$/)?.[1])-1;
    return Number.isInteger(index)&&index>=0?groups[index]||[]:[];
  }
  function statsMetricFlavor(metric){
    const measure=String(metric.measure||'').toLowerCase().replace(/[’']/g,'');
    if(metric.kind==='p-value')return 'p';
    if(/standard error of (?:the )?mean\b/.test(measure))return 'precision';
    if(/\b(?:odds ratio|risk ratio|rate ratio|hazard ratio|relative risk|or|rr|hr|irr)\b/.test(measure))return 'ratio';
    if(/\b(?:icc|intraclass)\b/.test(measure))return 'icc';
    if(metric.kind==='reliability'&&/kappa|κ/.test(measure))return 'agreement';
    if(metric.kind==='reliability'&&/cronbach|mcdonald|internal consistency|^omega$|^alpha$|^[αω]$/.test(measure))return 'consistency';
    if(/\b(?:standard error of measurement|typical error|te|mae|rmse)\b/.test(measure)||(metric.kind==='reliability'&&/\bsem\b/.test(measure)))return 'error';
    if(/\b(?:cv|coefficient of variation)\b/.test(measure))return 'cv';
    if(/\br(?:2|\^2)\b|r²|(?:eta|η|omega|ω)[ _-]*(?:squared|\^?2|²)|coefficient of determination/.test(measure))return 'variance';
    if(metric.kind==='association'&&/\b(?:r|rho|pearson|spearman|kendall|tau|correlation)\b/.test(measure))return 'correlation';
    if(/\b(?:cohen|hedges|glass|standardized|standardised|smd)\b/.test(measure)||(metric.kind==='effect-size'&&/standardized|standardised/i.test(metric.unit)))return 'standardized';
    if(/\b(?:difference|change)\b/.test(measure))return 'difference';
    return 'estimate';
  }
  function statsGenericProfile(book,rec){
    const lab=rec?.guide?.articleAnalysis?.statisticsLab;
    if(!lab||lab.version!==1||typeof lab.scope!=='string'||!Array.isArray(lab.metrics))return null;
    const paragraphs=new Map(statsSourceUnit(book,rec).map(p=>[p.id,p.text])),ids=new Set(),kinds=new Set(['p-value','effect-size','reliability','association','estimate']);
    const metrics=[];
    for(const item of lab.metrics.slice(0,12)){
      if(!item||!kinds.has(item.kind)||typeof item.value!=='number'||!Number.isFinite(item.value)||!['=','<','>','≤','≥','≈'].includes(item.operator))continue;
      if(['id','label','measure','unit','comparison','timepoint','context','interpretation','caution','coordinatorQuestion'].some(key=>typeof item[key]!=='string')||!item.id||!item.label||!item.measure||ids.has(item.id))continue;
      if(!Array.isArray(item.sourceRefs)||!item.sourceRefs.length||item.sourceRefs.length>5||item.sourceRefs.some(ref=>typeof ref?.quote!=='string'||ref.quote.length<Math.min(8,paragraphs.get(ref.paragraphId)?.length||8)||ref.quote.length>300||!paragraphs.get(ref.paragraphId)?.includes(ref.quote)))continue;
      try{StatisticsContract.validateStatisticsLab({metrics:[item]},rec.guide.articleAnalysis,paragraphs);}catch{continue;}
      const flavor=statsMetricFlavor(item);
      if(flavor==='p'&&(item.value<0||item.value>1)||['icc','correlation'].includes(flavor)&&(item.value< -1||item.value>1)||['cv','error','ratio'].includes(flavor)&&item.value<0)continue;
      if(item.interval!==null){
        const ci=item.interval;
        if(!ci||!['confidence','credible','range'].includes(ci.type)||!Number.isFinite(ci.low)||!Number.isFinite(ci.high)||ci.low>ci.high||!(ci.level===null||Number.isFinite(ci.level)&&ci.level>0&&ci.level<100))continue;
        if(['icc','correlation'].includes(flavor)&&(ci.low< -1||ci.high>1)||['cv','error','ratio','p'].includes(flavor)&&ci.low<0||flavor==='p'&&ci.high>1)continue;
      }
      metrics.push({...item,flavor,sourceRefs:item.sourceRefs.map(ref=>({...ref}))});ids.add(item.id);
    }
    return metrics.length?{generic:true,title:book.title||'This article',scope:lab.scope,metrics}:null;
  }
  function statsArticleProfile(book,rec){
    if(book?.sourceType!=='article'||rec?.bookId!==book.id||!['empirical-study','evidence-review'].includes(rec?.guide?.articleAnalysis?.kind))return null;
    // Only statistics the guide anchored to quoted numbers in this source appear; nothing is hand-built per paper.
    return statsGenericProfile(book,rec);
  }
