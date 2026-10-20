  // Articles imported from journal PDFs can carry page furniture and broken
  // paragraphs. This tidies the text for reading only; the saved text, its
  // paragraph numbers and the lessons that quote it stay as they are.
  const ARTICLE_SECTION_CAPS=/^(ABSTRACT|INTRODUCTION|BACKGROUND|PURPOSE|METHODS?|MATERIALS AND METHODS|METHODOLOGY|EXPERIMENTAL APPROACH TO THE PROBLEM|SUBJECTS|PARTICIPANTS|PROCEDURES?|STATISTICAL ANALYS[EI]S|RESULTS|DISCUSSION|LIMITATIONS|CONCLUSIONS?|PRACTICAL APPLICATIONS|REFERENCES|ACKNOWLEDG(?:E)?MENTS?)\s+(?=[A-Z“"(])/;
  const ARTICLE_SECTION_RUNIN=/^(Experimental Approach to the Problem|Subjects|Participants|Procedures|Testing Procedures|Statistical Analyses|Statistical Analysis|Data Analysis|Study Design|Experimental Design|Familiarization|Instrumentation|Measurements)\s+(?=[A-Z][a-z]|[A-Z]\s|\d)/;
  function articleDisplayText(text,book={}){
    const caps=ARTICLE_SECTION_CAPS.source.slice(2,-1).replace(/\\s\+\(\?=.*$/,''),runin=ARTICLE_SECTION_RUNIN.source.slice(2).replace(/\\s\+\(\?=.*$/,'');
    // Headings a PDF ran into the middle of a paragraph start their own section.
    const inner=new RegExp('([.?!]["”’)]?)\\s+((?:'+caps.slice(1,-1)+')|(?:'+runin.slice(1,-1)+'))\\s+(?=[A-Z][a-z]|\\d)','g');
    const lines=String(text||'').replace(inner,'$1\n$2 ').split(/\n+/).map(l=>l.trim()).filter(Boolean);
    const key=l=>l.toLowerCase().replace(/\d+/g,'#').replace(/\s+/g,' ');
    const counts=new Map();for(const l of lines)if(l.length<=160&&!/^## /.test(l))counts.set(key(l),(counts.get(key(l))||0)+1);
    const same=(a,b)=>!!b&&a.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()===String(b).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const furniture=l=>/^[A-Z]{2,8}[-_ ]?\d{2}[-_ ]?\d{3,6}\s+\d+\.\.\d+$/.test(l)||/^(?:page\s*)?\d{1,4}$/i.test(l)||/^VOLUME\s+\d+\s*\|\s*NUMBER\s+\d+/i.test(l)||/unauthorized reproduction of this article is prohibited\.?$/i.test(l)||(l.length<=160&&!/[.?!]$/.test(l)&&counts.get(key(l))>=2&&!/^(?:\[Table|~ |> )/.test(l)&&!l.includes(' | '));
    const out=[];let started=false;
    for(let l of lines){
      if(furniture(l))continue;
      // The title and authors already sit above the text.
      if(!started&&(same(l,book.title)||same(l,book.author)))continue;
      started=true;
      let m=l.match(ARTICLE_SECTION_CAPS);
      if(m){out.push('## '+m[1]);l=l.slice(m[0].length);}
      else if((m=l.match(ARTICLE_SECTION_RUNIN))){out.push('## '+m[1]);l=l.slice(m[0].length);}
      const prev=out[out.length-1];
      // A paragraph cut by a page or column break continues where it left off.
      if(prev&&!/^(?:## |> |~ |\[Table|• )/.test(prev)&&!prev.includes(' | ')&&!/[.?!:"”’)\]]$/.test(prev)&&/^[a-z(]/.test(l)&&!l.includes(' | ')){out[out.length-1]=prev+(/[A-Za-z]-$/.test(prev)?'':' ')+l;continue;}
      out.push(l);
    }
    // A word split at a line end: "intermit- tent" reads "intermit-tent".
    return out.map(l=>/^(?:## |\[Table)/.test(l)||l.includes(' | ')?l:articleSplitLong(l.replace(/([a-z]{2,})- (?!(?:and|or|to|nor|versus|vs)\b)([a-z])/g,'$1-$2'))).join('\n\n');
  }
  // Very long blocks (often several paragraphs a PDF ran together) break at
  // sentence ends into readable paragraphs.
  function articleSplitLong(p){
    if(p.length<1400||/^(?:> |~ )/.test(p))return p;
    const parts=[];let rest=p;
    while(rest.length>1100){
      const re=/(?<!\b(?:et al|Fig|Figs|Eq|vs|e\.g|i\.e|No|Dr|Mr|Ms|approx|ca|cf|resp|Ref|Refs|Vol))[.?!]["”’)]?\s+(?=[A-Z“"(])/g;let cut=-1,m;
      while((m=re.exec(rest))){const at=m.index+m[0].length;if(at<550)continue;cut=at;if(at>=750)break;}
      if(cut<0||rest.length-cut<250)break;
      parts.push(rest.slice(0,cut).trim());rest=rest.slice(cut);
    }
    parts.push(rest.trim());return parts.join('\n\n');
  }
