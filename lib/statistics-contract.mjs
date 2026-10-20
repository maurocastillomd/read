/** Reported article statistics. Number anchoring is a guard, not semantic certification. */
const object = properties => ({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const text = (maxLength=1200,minLength=1) => ({type:'string',minLength,maxLength});
const list = (items,minItems,maxItems) => ({type:'array',items,minItems,maxItems});
const enumeration = values => ({type:'string',enum:values});
const numeric = {type:'number'};
const ref = object({paragraphId:text(100),quote:text(300)});
export const statisticsLabSchema = {anyOf:[{type:'null'},object({
  version:{type:'number',enum:[1]}, scope:text(1200),
  metrics:list(object({
    id:text(80),kind:enumeration(['p-value','effect-size','reliability','association','estimate']),
    label:text(180),measure:text(100),value:numeric,operator:enumeration(['=','<','>','≤','≥','≈']),
    unit:text(80,0),comparison:text(500),timepoint:text(250),context:text(1000),
    interval:{anyOf:[{type:'null'},object({low:numeric,high:numeric,level:{anyOf:[{type:'null'},numeric]},type:enumeration(['confidence','credible','range'])})]},
    sourceRefs:list(ref,1,5),interpretation:text(1400),caution:text(1000),coordinatorQuestion:text(800),
  }),1,12),
})]};

const canonicalOperator = operator => ({'<=':'≤','>=':'≥','~':'≈'}[operator]||operator||'=');

/** Preserve signs, thresholds, decimal values, and common scientific notation. */
export function statisticsNumbers(quote) {
  const normalized=String(quote).replace(/−/g,'-');
  const expression=/(?<![\p{L}\p{N}_.])([+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(?![\p{L}\p{N}_]|\.\d)/gu;
  return [...normalized.matchAll(expression)].map(match=>({value:Number(match[1].replaceAll(',','')),operator:canonicalOperator(normalized.slice(0,match.index).match(/(<=|>=|[=<>≤≥≈~])\s*$/)?.[1]),index:match.index,raw:match[0]}));
}
const sameNumber = (a,b) => Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Number.EPSILON*4*Math.max(Math.abs(a),Math.abs(b),Number.MIN_VALUE);
const hasNumber = (quotes,value,operator) => quotes.some(quote=>statisticsNumbers(quote).some(token=>sameNumber(token.value,value)&&(operator===undefined||token.operator===operator)));
const fail = message => {throw new Error(`Statistics lab: ${message}`);};

/** Structural schema validation runs first in validateGuide; these are evidence checks. */
export function validateStatisticsLab(lab, appraisal, paragraphs) {
  if(lab===null||lab===undefined)return;
  if(!['empirical-study','evidence-review'].includes(appraisal.kind))fail('numeric labs require original research or an attributed evidence review.');
  const ids=new Set();
  for(const metric of lab.metrics){
    if(ids.has(metric.id))fail('metric IDs must be unique.');
    ids.add(metric.id);
    const quotes=metric.sourceRefs.map(ref=>{
      const paragraph=paragraphs.get(ref.paragraphId);
      if(typeof paragraph!=='string')fail(`unknown source paragraph: ${ref.paragraphId}`);
      if(ref.quote.length<Math.min(8,paragraph.length)||!paragraph.includes(ref.quote))fail(`source quote does not match paragraph ${ref.paragraphId}.`);
      return ref.quote;
    });
    if(!hasNumber(quotes,metric.value,metric.operator))fail(`${metric.id} value and comparator must occur in its exact source quote.`);
    if(metric.kind==='p-value'&&(metric.value<0||metric.value>1||(metric.operator==='<'&&metric.value===0)||(metric.operator==='>'&&metric.value===1)))fail(`${metric.id} p value must lie within 0 to 1.`);
    const measure=metric.measure.toLowerCase().replace(/[’']/g,'').trim();
    const evidence=quotes.join(' ');
    if(metric.kind==='p-value'&&!/\bp(?:[ -]?values?)?\s*(?:[=:<>≤≥≈]|(?:was|were|of)\b)/i.test(evidence))fail(`${metric.id} needs a source quote identifying its p value.`);
    const namedMeasures=[
      [/\bicc\b|intraclass/,/\bICC\b|intraclass/i],
      [/\bcv\b|coefficient of variation/,/\bCV\b|coefficient of variation/i],
      [/\bsem\b|standard error of measurement/,/\bSEM\b|standard error of measurement/i],
      [/cohen/,/cohen|\bd\s*[=<>≤≥]/i],
      [/hedges/,/hedges|\bg\s*[=<>≤≥]/i],
      [/^(?:or|odds ratio)$/, /\bOR\b|odds ratio/i],
      [/^(?:rr|risk ratio|relative risk)$/, /\bRR\b|risk ratio|relative risk/i],
      [/^(?:hr|hazard ratio)$/, /\bHR\b|hazard ratio/i],
    ];
    for(const [name,sourceName] of namedMeasures)if(name.test(measure)&&!sourceName.test(evidence))fail(`${metric.id} measure name needs explicit source support.`);
    if(metric.kind==='reliability'){
      if(/\bicc\b|intraclass|\bkappa\b/.test(measure)&&(metric.value < -1||metric.value>1))fail(`${metric.id} reliability coefficient is outside its valid range.`);
      if(/cronbach/.test(measure)&&metric.value>1)fail(`${metric.id} Cronbach alpha must not exceed 1.`);
      if(/\bcv\b|coefficient of variation|\bsem\b|standard error of measurement|typical error/.test(measure)&&metric.value<0)fail(`${metric.id} error or variation must not be negative.`);
    }
    if(metric.kind==='association'&&/^(?:r|rho|ρ|pearson(?:s)?(?: r)?|spearman(?:s)?(?: rho| r)?)$/.test(measure)&&Math.abs(metric.value)>1)fail(`${metric.id} correlation must lie within -1 to 1.`);
    if(/^(?:rr|or|hr|risk ratio|odds ratio|hazard ratio|relative risk)$/.test(measure)&&metric.value<0)fail(`${metric.id} ratio must not be negative.`);
    if(metric.interval){
      const {low,high,level,type}=metric.interval;
      if(low>high)fail(`${metric.id} interval endpoints are reversed.`);
      if(metric.kind==='p-value'&&(low<0||high>1))fail(`${metric.id} probability interval must lie within 0 to 1.`);
      if(metric.kind==='reliability'&&(/\bicc\b|intraclass|\bkappa\b/.test(measure))&&(low < -1||high>1))fail(`${metric.id} reliability interval is outside its valid range.`);
      if(metric.kind==='reliability'&&/cronbach/.test(measure)&&high>1)fail(`${metric.id} Cronbach alpha interval must not exceed 1.`);
      if(metric.kind==='reliability'&&(/\bcv\b|coefficient of variation|\bsem\b|standard error of measurement|typical error/.test(measure))&&low<0)fail(`${metric.id} error or variation interval must not be negative.`);
      if(metric.kind==='association'&&/^(?:r|rho|ρ|pearson(?:s)?(?: r)?|spearman(?:s)?(?: rho| r)?)$/.test(measure)&&(low < -1||high>1))fail(`${metric.id} correlation interval must lie within -1 to 1.`);
      if(/^(?:rr|or|hr|risk ratio|odds ratio|hazard ratio|relative risk)$/.test(measure)&&low<0)fail(`${metric.id} ratio interval must not be negative.`);
      if(!hasNumber(quotes,low)||!hasNumber(quotes,high))fail(`${metric.id} interval endpoints must occur in its source quotes.`);
      if(level!==null&&(!(level>0&&level<100)||!hasNumber(quotes,level)))fail(`${metric.id} interval level must be a reported percentage between 0 and 100.`);
      const supported={confidence:/\bconfidence\b|\bCI(?:s)?\b/i,credible:/\bcredible\b|\bCrI\b|\bHDI\b|highest (?:posterior )?density/i,range:/\brange\b/i}[type];
      if(!supported.test(evidence))fail(`${metric.id} interval type needs explicit source support; SD is not an uncertainty interval.`);
    }
  }
}
