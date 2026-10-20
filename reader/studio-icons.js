  function readIcon(name,filled=false){
    const paths={share:'<path d="M12 3v12M8 7l4-4 4 4"/><path d="M8 10H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1"/>',bookmark:'<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4Z"/>',library:'<path d="M4 4v16M9 4v16M14 4v16M18 5l3 14M3 20h13"/>',book:'<path d="M12 5v15M3 4h4c3 0 5 2 5 2s2-2 5-2h4v15h-4c-3 0-5 2-5 2s-2-2-5-2H3Z"/>',overview:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M9 10h12"/>',compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',notes:'<path d="M14 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-9M9 15l1-4L18 3a2.12 2.12 0 0 1 3 3l-8 8ZM17 4l3 3"/>',source:'<path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',highlighter:'<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',plus:'<path d="M12 5v14M5 12h14"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',back:'<path d="M20 12H4m6-6-6 6 6 6"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',link:'<path d="m10 13 4-4M9 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M15 9l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',practice:'<path d="M7 3H4v4M17 3h3v4M7 21H4v-4M17 21h3v-4"/><circle cx="12" cy="12" r="4"/><path d="m10.5 12 1 1 2-2"/>',check:'<path d="m5 12 4 4L19 6"/>',layers:'<path d="m3 8 9-5 9 5-9 5Zm0 4 9 5 9-5M3 16l9 5 9-5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',focus:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',cloud:'<path d="M7 18H6a4 4 0 0 1-.8-7.9A7 7 0 0 1 19 9a4.5 4.5 0 0 1 0 9h-2M9 16l3-3 3 3m-3-3v8"/>'};
    return `<svg class="read-icon icon-${esc(name)}" viewBox="0 0 24 24" width="21" height="21" fill="${filled?'currentColor':'none'}" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.book}</svg>`;
  }
  function readingProse(value){
    const paragraphs=String(value??'').split(/\n\s*\n/),output=[];
    for(const paragraph of paragraphs){
      // Split at boundaries instead of matching sentence bodies: a match can skip
      // the start of a clause when it encounters a decimal or abbreviation.
      const sentences=paragraph.split(/(?<=[.!?])(?=\s)/);let block='';
      for(const sentence of sentences){if(block&&block.split(/\s+/).length>65){output.push(block.trim());block='';}block+=sentence;}
      if(block.trim())output.push(block.trim());
    }
    return output.map(p=>`<p>${esc(p)}</p>`).join('');
  }
