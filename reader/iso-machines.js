  // Pictures as machines. Every picture in read. (lesson big ideas, 30-min figures,
  // the article study at a glance) is drawn as a small real object whose working is
  // the idea, with the anatomy kit (reader/vendor/anatomy, MIT). Words stay out of
  // the drawing: the parts are tagged data-p="0|1|2…" and the labels sit beside it.
  // Geometry never depends on the text, so each machine variant is built once and cached.
  const isoK=IsoKit,isoTubePieces=IsoTube.tubePieces,isoTubeSvg=IsoTube.tubeSvg;
  const isoCache=new Map();
  function isoStyle(){
    if(document.getElementById('iso-kit-css'))return;
    const s=document.createElement('style');s.id='iso-kit-css';
    s.textContent=isoK.ISO_CSS.replace(/\.iso\{[^}]*\}\s*\.iso\[data-theme="light"\]\{[^}]*\}/,'');
    document.head.appendChild(s);
  }
  function isoScene(width,height,fit,{azimuth=45,elevation=30}={}){
    const P=isoK.fitProjection(fit,width,height,{pad:18,azimuth,elevation}),items=[];
    const at=p=>isoK.iso(p,P),depth=p=>isoK.depthOf(p,P);
    const add=(key,svg,part)=>items.push({key:typeof key==='number'?key:depth(key),svg,part});
    const tube=(route,r,part,o={})=>{for(const piece of isoTubePieces(route,r,P,{maxLength:o.maxLength??14,...o}))add(piece.mid,isoTubeSvg(piece,{tone:o.tone??'hi'}),part);};
    const render=label=>{
      items.sort((a,b)=>a.key-b.key);
      const body=items.map(it=>it.part===undefined?it.svg:`<g data-p="${it.part}">${it.svg}</g>`).join('');
      return isoK.figureSvg({width,height,label,body});
    };
    return {P,at,depth,add,tube,render};
  }
  const isoS=(paths,style)=>isoK.solidSvg(paths,style),isoL=(d,style)=>isoK.lineSvg(d,style),isoD=(pts,style)=>isoK.dotsSvg(pts,style);
  function isoPlate(sc,PL,h=10,feet=6){
    const {P,at,add}=sc,k=isoK,out=[`<path class="iso-halo" d="${k.haloOf(PL,-h-feet,h,P)}"/>`];
    for(const [x,y] of k.corners(PL,18)){out.push(isoS(k.cylinder(x,y,7,-h-feet,1.6,P,24),{tone:'lo'}));out.push(isoS(k.cylinder(x,y,5.2,-h-feet+1.6,feet-1.6,P,24),{tone:'mid'}));}
    out.push(isoS(k.slabOf(PL,-h,h,P,8,1.4),{tone:'mid'}));
    out.push(isoL(k.planOutline(k.insetPlan(PL,5),0,P),{tone:'lo'}));
    const screws=k.corners(PL,10);
    out.push(isoL(screws.map(([x,y])=>k.ring(x,y,2.2,0,P,16)).join(''),{tone:'lo'}));
    out.push(isoD(screws.map(([x,y])=>at([x,y,0])),{size:.5}));
    const strip={x:PL.x+16,y:PL.y+PL.d-13,w:PL.w-32,d:6,r:1};
    out.push(isoS(k.slabOf(strip,0,.6,P,3),{tone:'lo',crease:'none'}));
    const t=k.topTicks(strip.x+4,strip.x+strip.w-4,4,5,strip.y+.8,.6,[1.8,3.4],P);
    out.push(isoL(t.minor,{tone:'lo'}),isoL(t.major,{tone:'mid'}));
    add(-1e9,out.join(''));
  }
  function isoLabelPlate(sc,x,y,w=30){
    const {P,at,add}=sc,k=isoK;
    add(-1e8,isoS(k.slabOf({x,y,w,d:12,r:1},0,.8,P,3,.3),{tone:'lo'})+isoL([0,1,2].map(i=>k.lineOnTop([x+4,y+3.4+i*2.6],[x+w-4-i*5,y+3.4+i*2.6],.8,P)).join(''),{tone:'faint',free:true})+isoD([[x+1.8,y+1.8],[x+w-1.8,y+1.8],[x+1.8,y+10.2],[x+w-1.8,y+10.2]].map(([a,b])=>at([a,b,.8])),{size:.4}));
  }
  // A knurled knob, a pip row and other small parts reused across machines.
  function isoKnob(sc,x,y,z,r=6,h=4){const {P}=sc,k=isoK;return isoS(k.cylinder(x,y,r,z,h,P,32,.4),{tone:'mid'})+isoL(k.knurl(x,y,r,z,z+h,Math.round(r*5),P),{tone:'lo'})+isoL(k.ring(x,y,r*.4,z+h,P,16),{tone:'mid'});}
  function isoPips(sc,n,from,step,z,axis='x'){const {at}=sc;return isoD(Array.from({length:n},(_,i)=>at(axis==='x'?[from[0]+i*step,from[1],z]:[from[0],from[1]+i*step,z])),{size:.85,tone:'hi'});}

  // LOOP and LIMIT: a stock-and-flow tank. 0 the stock, 1 the flows, 2 the feedback.
  function isoTank({level=.55}={}){
    const k=isoK,PL={x:-135,y:-62,w:270,d:124,r:8},T={x:-38,y:-36,w:92,d:72,r:4},TOP=74,FLOOR=6;
    const W=FLOOR+(TOP-FLOOR-8)*level,TW=[-100,-10];
    const sc=isoScene(640,400,[...k.boxCorners(PL,-16,0),[TW[0],TW[1],132],[T.x+T.w,T.y,TOP+30],[118,30,0]]);
    const {P,at,add,tube,depth}=sc;
    isoPlate(sc,PL);isoLabelPlate(sc,PL.x+16,PL.y+10,34);
    const base=k.insetPlan(T,-5);
    add(-5e7,isoS(k.slabOf(base,0,FLOOR,P,6,.8),{tone:'mid'})+isoD(k.corners(base,4).map(([x,y])=>at([x,y,FLOOR])),{size:.45}));
    const mid=depth([T.x+T.w/2,T.y+T.d/2,0]);
    for(const [x,y] of k.corners(T,0)){const front=depth([x,y,0])>mid;add(front?1e6+depth([x,y,0]):-4e7,isoS(k.cylinder(x,y,3.2,FLOOR,TOP-FLOOR,P,18),{tone:'mid',crease:'none'})+isoL(k.sideArc(x,y,3.2,TOP-6,P,10),{tone:'lo'}));}
    const water=k.insetPlan(T,2);
    add(-3e7,isoS(k.slabOf(water,FLOOR,W-FLOOR,P,6),{tone:'hi',lit:true,className:'rv-water'})+isoL([.35,.6].map(f=>k.ring(water.x+water.w*.62,water.y+water.d*.5,9+f*18,W,P,40)).join(''),{tone:'faint'}),0);
    const sx=T.x+T.w-16,sy=T.y+T.d;let ticks='';
    for(let z=FLOOR+4,i=0;z<TOP-4;z+=4,i++)ticks+=k.segment([sx,sy+1.4,z],[sx+(i%5?3:6),sy+1.4,z],P);
    add(2e6,isoS(k.slabOf({x:sx-2,y:sy,w:10,d:1.4,r:.4},FLOOR+2,TOP-FLOOR-4,P,2),{tone:'lo',crease:'none'})+isoL(ticks,{tone:'mid'})+isoL(k.segment([sx-1.5,sy+1.5,W],[sx+8,sy+1.5,W],P),{tone:'lit'}),0);
    if(level>.8)add(2.1e6,isoL(k.segment([T.x+4,sy+1.5,TOP-8],[sx-4,sy+1.5,TOP-8],P),{tone:'lit',dashed:true}),0);
    const rim=(plan,front)=>add(front?1.5e6:-3.5e7,isoS(k.slabOf(plan,TOP,3,P,2,.3),{tone:'mid'}));
    rim({x:T.x-3,y:T.y-3,w:T.w+6,d:5,r:1},false);rim({x:T.x-3,y:T.y-3,w:5,d:T.d+6,r:1},false);
    rim({x:T.x+T.w-2,y:T.y-3,w:5,d:T.d+6,r:1},true);rim({x:T.x-3,y:T.y+T.d-2,w:T.w+6,d:5,r:1},true);
    add(1.4e6,isoL(k.planOutline(T,FLOOR+1,P,4),{tone:'faint'}));
    const [tx,ty]=TW;
    add(-6e7,isoS(k.cylinder(tx,ty,15,0,6,P,40,.6),{tone:'mid'})+isoS(k.cylinder(tx,ty,11,6,112,P,40),{tone:'mid',crease:'none'})+isoL([30,60,90].map(z=>k.sideArc(tx,ty,11,z,P,24)).join(''),{tone:'lo'})+isoS(k.cylinder(tx,ty,13,118,6,P,40,.6),{tone:'mid'})+isoL(k.ring(tx,ty,8,124,P,32),{tone:'lo'})+isoD([0,1,2,3,4,5].map(i=>at([tx+Math.cos(i)*10.5,ty+Math.sin(i)*10.5,124])),{size:.45}));
    const SX=T.x+26,PZ=104,vx=-54;
    tube([[tx+11,ty,PZ],[-62,ty,PZ],[SX-8,ty,PZ],[SX,ty,PZ-8],[SX,ty,TOP+8]],3.4,1,{gaps:[[34,44]]});
    add(depth([vx,ty,PZ])+.5,isoS(k.cylinder(vx,ty,5.5,PZ-6,12,P,24,.4),{tone:'hi',crease:'lo'})+isoS(k.cylinder(vx,ty,1.4,PZ+6,6,P,12),{tone:'mid'})+isoS(k.cylinder(vx,ty,8,PZ+12,2.4,P,36,.4),{tone:'hi',crease:'lo'})+isoL(k.knurl(vx,ty,8,PZ+12,PZ+14.4,30,P),{tone:'lo'})+isoL(k.ring(vx,ty,3,PZ+14.4,P,16),{tone:'mid'}),1);
    add(depth([SX,ty,TOP+6]),isoS(k.cylinder(SX,ty,4.6,TOP+2,6,P,20,.3),{tone:'hi',crease:'lo'}),1);
    add(depth([SX,ty,W])+.2,isoL(k.segment([SX,ty,TOP+2],[SX,ty,W+.5],P),{tone:'lit',flow:true,className:'rv-stream'})+isoL(k.ring(SX,ty,4,W,P,24),{tone:'lit'}),1);
    const DY=T.y+T.d-20,DZ=FLOOR+8,DX=T.x+T.w+3,TR={x:92,y:DY-18,w:36,d:36,r:3};
    add(depth([TR.x+18,TR.y+18,0])-2,isoS(k.slabOf(TR,0,7,P,4,.5),{tone:'mid'})+isoL(k.planOutline(k.insetPlan(TR,3),7,P,3),{tone:'lo'})+isoS(k.slabOf(k.insetPlan(TR,4),1.5,4,P,3),{tone:'hi',lit:true,className:'rv-water'}),1);
    tube([[DX,DY,DZ],[100,DY,DZ],[108,DY,DZ],[110,DY,14]],2.8,1,{gaps:[[16,22]]});
    add(depth([82,DY,DZ])+.4,isoS(k.slabOf({x:79,y:DY-4,w:6,d:8,r:1},DZ-4,8,P,2,.3),{tone:'hi',crease:'lo'})+isoS(k.slabOf({x:80.5,y:DY-1,w:3,d:2,r:.5},DZ+4,4,P,2),{tone:'mid'})+isoS(k.slabOf({x:76,y:DY-1.4,w:12,d:2.8,r:1.2},DZ+8,1.8,P,3),{tone:'mid'}),1);
    add(depth([110,DY,10])+.3,isoL(k.segment([110,DY,13],[110,DY,6],P),{tone:'lit',flow:true,className:'rv-stream'}),1);
    add(depth([DX,DY,DZ])+.1,isoS(k.slabOf({x:DX-1,y:DY-6,w:2.4,d:12,r:1},DZ-6,12,P,3,.3),{tone:'mid'}),1);
    const FX=T.x+T.w-30,FY=T.y+28;
    add(-2.9e7,isoS(k.cylinder(FX,FY,9,W-2,6,P,36,.5),{tone:'hi',crease:'lo'})+isoL(k.ring(FX,FY,5,W+4,P,24),{tone:'lo'}),2);
    add(-2.85e7,isoS(k.cylinder(FX,FY,1.3,W+4,PZ+18-W-4,P,12),{tone:'mid',crease:'none'}),2);
    add(-2.8e7,isoS(k.slabOf({x:FX-4,y:T.y-4,w:8,d:6,r:1},TOP+3,PZ+14-TOP-3,P,2,.3),{tone:'mid'})+isoD([at([FX,T.y-1,PZ+14])],{size:.6,tone:'hi'}),2);
    tube([[FX,FY,PZ+18],[FX,T.y-1,PZ+18],[vx+3,ty,PZ+18]],1.2,2);
    add(depth([vx,ty,PZ+18])+1,isoD([at([vx+3,ty,PZ+18]),at([FX,FY,PZ+18])],{size:1.3,tone:'hi'})+isoS(k.cylinder(vx+3,ty,1.1,PZ+14.4,3.6,P,10),{tone:'mid',crease:'none'}),2);
    return sc.render('A tank on a bench. Water flows in from a tower through a valve and drains to a tray. A float on the water moves a rod that turns the inlet valve.');
  }

  // TWO SIDES and A CHOICE: a two-pan balance. 0 left pan, 1 right pan, 2 beam and needle.
  function isoBalance({tilt=8}={}){
    const k=isoK,PL={x:-96,y:-96,w:192,d:192,r:10},BZ=128,ARM=92,U=[Math.SQRT1_2,-Math.SQRT1_2],N=[Math.SQRT1_2,Math.SQRT1_2];
    const on=(s,z,n=0)=>[U[0]*s+N[0]*n,U[1]*s+N[1]*n,z];
    const sc=isoScene(640,420,[...k.boxCorners(PL,-16,0),on(0,BZ+40),on(-ARM-30,BZ),on(ARM+30,BZ)]);
    const {P,at,add,tube,depth}=sc;
    isoPlate(sc,PL);isoLabelPlate(sc,PL.x+20,PL.y+PL.d-34,32);
    const rad=tilt*Math.PI/180,endL=on(-ARM*Math.cos(rad),BZ-ARM*Math.sin(rad)),endR=on(ARM*Math.cos(rad),BZ+ARM*Math.sin(rad));
    const quad=(s0,s1,n0,n1)=>[[s0,n0],[s1,n0],[s1,n1],[s0,n1]].map(([s,n])=>[U[0]*s+N[0]*n,U[1]*s+N[1]*n]);
    add(-5e7,isoS(k.cylinder(0,0,22,0,6,P,56,.6),{tone:'mid'})+isoL(k.ring(0,0,16,6,P,48),{tone:'lo'})+isoD([0,1,2,3].map(i=>at([Math.cos(i*1.57+.78)*19,Math.sin(i*1.57+.78)*19,6])),{size:.5})+isoS(k.cylinder(0,0,6,6,BZ-20,P,32),{tone:'mid',crease:'none'})+isoL([34,74,104].map(z=>k.sideArc(0,0,6,z,P,18)).join(''),{tone:'lo'})+isoS(k.extrude(quad(-10,10,-7,7),BZ-20,12,P,{bevel:.4}),{tone:'mid'}));
    const DZ=BZ+6,DR=26;let ticks='';
    for(let a=-36;a<=36;a+=6){const r1=a*Math.PI/180,len=a%18?3:5.5;ticks+=k.segment(on(Math.sin(r1)*DR,DZ+Math.cos(r1)*DR,-5),on(Math.sin(r1)*(DR+len),DZ+Math.cos(r1)*(DR+len),-5),P);}
    add(-4.9e7,isoS(k.cylinder(-N[0]*6.7,-N[1]*6.7,1.6,BZ-8,DZ+12-BZ+8,P,12),{tone:'mid',crease:'none'}));
    add(-4.8e7,isoS(k.extrude(quad(-30,30,-8,-5.4),DZ+12,26,P,{bevel:.4}),{tone:'mid'})+isoL(ticks,{tone:'mid'})+isoD([at(on(-26,DZ+35,-5.2)),at(on(26,DZ+35,-5.2))],{size:.5}));
    add(1e6,isoL(k.segment(on(0,BZ,-3),on(Math.sin(rad)*30,BZ+Math.cos(rad)*30,-3),P),{tone:'lit'}),2);
    tube([endL,on(0,BZ),endR],2.8,2,{maxLength:40});
    add(1.1e6,isoS(k.cylinder(0,0,4.6,BZ-3,5,P,20,.3),{tone:'hi',crease:'lo'})+isoD([at([0,0,BZ+2])],{size:1.2,tone:'hi'}),2);
    const pan=(end,part,loads)=>{
      const [x,y,z]=end,PZ=z-62,hangers=[0,1,2].map(i=>{const a=i*2*Math.PI/3+.4;return [x+Math.cos(a)*22,y+Math.sin(a)*22,PZ+3];});
      const near=h=>depth(h)>depth([x,y,PZ]);
      add(depth([x,y,PZ])-3,isoL(hangers.filter(h=>!near(h)).map(h=>k.segment([x,y,z-4],h,P)).join(''),{tone:'mid'}),part);
      add(depth([x,y,PZ])-2,`<path class="iso-halo" d="${k.haloOf({x:x-24,y:y-24,w:48,d:48,r:24},0,.1,P)}" style="opacity:.22"/>`+isoS(k.cylinder(x,y,28,PZ,3.2,P,64,.5),{tone:'hi',crease:'lo'})+isoL(k.ring(x,y,24,PZ+3.2,P,56),{tone:'faint'}),part);
      for(const [lx,ly,w,d,h,lift=0] of loads){const plan={x:x+lx,y:y+ly,w,d,r:1},zb=PZ+3.2+lift;add(depth([x+lx+w/2,y+ly+d/2,zb])-1,isoS(k.slabOf(plan,zb,h,P,3,.5),{tone:'hi',crease:'lo'})+isoL(k.planOutline(k.insetPlan(plan,2.2),zb+h,P,3),{tone:'faint'}),part);}
      add(depth([x,y,PZ])+50,isoL(hangers.filter(near).map(h=>k.segment([x,y,z-4],h,P)).join(''),{tone:'mid'})+isoD(hangers.map(h=>at(h)),{size:.9,tone:'hi'}),part);
      add(depth([x,y,z])+.5,isoS(k.cylinder(x,y,3,z-5,5,P,16),{tone:'mid'}),part);
    };
    pan(endL,0,[[-15,-12,14,14,12],[1,-10,13,13,11],[-9,3,13,11,10],[-7,-7,12,12,9,12]]);
    pan(endR,1,[[-6,-6,12,12,8]]);
    return sc.render('A two-pan balance. One pan holds a heap of blocks and sinks, the other holds one block and rises, and the needle leans toward the heavier side.');
  }

  // LAYERS, STACK and TERMS: a chest of drawers; the top drawer is the surface.
  function isoDrawers({count=3,open=count-1}={}){
    const k=isoK,PL={x:-110,y:-66,w:220,d:132,r:8},C={x:-48,y:-38,w:96,d:62,r:2},H=count>3?26:34,GAP=4,Z0=8,TOP=Z0+count*(H+GAP)+4;
    const sc=isoScene(560,440,[...k.boxCorners(PL,-16,0),[C.x,C.y,TOP+8],[C.x+C.w,C.y+C.d+40,Z0]]);
    const {P,at,add}=sc;
    isoPlate(sc,PL);isoLabelPlate(sc,PL.x+PL.w-50,PL.y+10,34);
    add(-6e7,`<path class="iso-halo" d="${k.haloOf(C,0,TOP,P)}" style="opacity:.4"/>`+isoS(k.slabOf(k.insetPlan(C,-2),0,Z0,P,3,.6),{tone:'mid'}));
    add(-5.9e7,isoS(k.slabOf({x:C.x,y:C.y,w:C.w,d:4,r:1},Z0,TOP-Z0,P,2),{tone:'mid'}));
    add(-5.9e7+1,isoS(k.slabOf({x:C.x,y:C.y,w:4,d:C.d,r:1},Z0,TOP-Z0,P,2),{tone:'mid'}));
    for(let i=0;i<=count;i++){const z=Z0+i*(H+GAP);add(-5e7+i*200-50,isoS(k.slabOf({x:C.x+2,y:C.y+2,w:C.w-4,d:C.d-2,r:1},z,i===count?4:2.4,P,2,.3),{tone:i===count?'mid':'lo'}));}
    for(let i=count-1;i>=0;i--){
      const level=count-1-i,z=Z0+i*(H+GAP)+2.4,out=level===open?34:4,plan={x:C.x+6,y:C.y+6+out,w:C.w-10,d:C.d-6,r:1};
      const box={x:plan.x+2,y:plan.y,w:plan.w-4,d:plan.d-3,r:1};
      let svg=isoS(k.slabOf(box,z+1.6,H-6,P,2),{tone:'lo',crease:'none'});
      if(out>10){svg+=isoL(k.planOutline(k.insetPlan(box,2.4),z+H-4.4,P,2),{tone:'lo'});for(let c=0;c<7;c++)svg+=isoS(k.slabOf({x:plan.x+8,y:plan.y+6+c*6,w:plan.w-16,d:1.2,r:.4},z+3,H-12+(c%3)*2,P,2),{tone:'hi',crease:'none'});}
      const front={x:plan.x-1,y:plan.y+plan.d-3,w:plan.w+2,d:4,r:1},cx=front.x+front.w/2,fy=front.y+front.d;
      let fs=isoS(k.slabOf(front,z,H,P,3,.6),{tone:'hi',crease:'lo',lit:level===open});
      fs+=isoS(k.slabOf({x:cx-13,y:fy,w:26,d:.8,r:.3},z+H-13,8,P,2),{tone:'mid',crease:'none'});
      fs+=isoL([0,1].map(r=>k.segment([cx-9,fy+.8,z+H-7.5-r*2.6],[cx+9-r*6,fy+.8,z+H-7.5-r*2.6],P)).join(''),{tone:'faint',free:true});
      fs+=isoS(k.slabOf({x:cx-9,y:fy,w:18,d:3.4,r:1.2},z+(H>30?8:5),3.4,P,3,.3),{tone:'mid'});
      fs+=isoD([at([cx-11.5,fy+.2,z+(H>30?9.7:6.7)]),at([cx+11.5,fy+.2,z+(H>30?9.7:6.7)])],{size:.5});
      fs+=isoD(Array.from({length:level+1},(_,n)=>at([front.x+7+n*3.4,fy+.2,z+H-6])),{size:.8,tone:'hi'});
      add(-5e7+i*200,svg+fs,level);
    }
    add(-5e7+1e4,isoS(k.slabOf({x:C.x+C.w-4,y:C.y,w:4,d:C.d+2,r:1},Z0,TOP-Z0,P,2),{tone:'mid'}));
    return sc.render(`A chest of ${count} drawers, top drawer the surface and bottom drawer the deepest, with one drawer pulled out.`);
  }

  // A HANDOFF and A CHAIN: a conveyor with a station per step; parcels pass along it.
  function isoConveyor({n=3}={}){
    const k=isoK,L=60+n*58,PL={x:-L/2-24,y:-56,w:L+48,d:112,r:8},BW=34,BZ=22;
    const sc=isoScene(660,380,[...k.boxCorners(PL,-16,0),[-L/2,0,BZ+70],[L/2,0,BZ+70]]);
    const {P,at,add,tube,depth}=sc;
    isoPlate(sc,PL);isoLabelPlate(sc,PL.x+14,PL.y+10,30);
    const xs=Array.from({length:n},(_,i)=>-L/2+40+i*((L-80)/Math.max(1,n-1)));
    // legs and side rails
    for(const x of [-L/2+10,L/2-10])for(const y of [-BW/2-4,BW/2+1]){add(depth([x,y,0])-1e6,isoS(k.slabOf({x:x-2,y,w:4,d:3,r:.6},0,BZ-4,P,2),{tone:'mid',crease:'none'}));}
    add(-2e6,isoS(k.slabOf({x:-L/2,y:-BW/2-5,w:L,d:4,r:1},BZ-6,8,P,3,.4),{tone:'mid'})+isoD(Array.from({length:Math.floor(L/24)},(_,i)=>at([-L/2+12+i*24,-BW/2-3,BZ+2])),{size:.45}));
    // rollers under the belt ends
    for(const x of [-L/2+4,L/2-4])tube([[x,-BW/2,BZ-2],[x,BW/2,BZ-2]],4,undefined,{maxLength:40,tone:'mid'});
    // belt
    const belt={x:-L/2+4,y:-BW/2,w:L-8,d:BW,r:4};
    let ribs='';for(let x=belt.x+6;x<belt.x+belt.w-4;x+=7)ribs+=k.lineOnTop([x,belt.y+1.5],[x,belt.y+belt.d-1.5],BZ+2,P);
    add(-1.5e6,isoS(k.slabOf(belt,BZ-2,4,P,6),{tone:'lo'})+isoL(ribs,{tone:'faint'})+isoL(k.lineOnTop([belt.x+4,0],[belt.x+belt.w-4,0],BZ+2.01,P),{tone:'lit',flow:true}));
    // near rail
    add(5e6,isoS(k.slabOf({x:-L/2,y:BW/2+1,w:L,d:4,r:1},BZ-6,8,P,3,.4),{tone:'mid'})+isoD(Array.from({length:Math.floor(L/24)},(_,i)=>at([-L/2+12+i*24,BW/2+3,BZ+2])),{size:.45}));
    // drive motor at the end
    add(depth([L/2+6,-BW/2-14,10]),isoS(k.slabOf({x:L/2-14,y:-BW/2-22,w:22,d:16,r:2},0,22,P,3,.6),{tone:'mid'})+isoL([5,10,15].map(z=>k.sideSeam({x:L/2-14,y:-BW/2-22,w:22,d:16,r:2},z,P,3)).join(''),{tone:'lo'})+isoKnob(sc,L/2-3,-BW/2-14,22,4,3));
    xs.forEach((x,i)=>{
      // station gantry behind the belt with a lamp
      add(-3e6+i,isoS(k.slabOf({x:x-3,y:-BW/2-16,w:6,d:6,r:1},0,BZ+46,P,2,.3),{tone:'mid'})+isoS(k.slabOf({x:x-6,y:-BW/2-16,w:12,d:BW/2+12,r:1.5},BZ+46,5,P,2,.4),{tone:'mid'})+isoS(k.cylinder(x,-4,4,BZ+38,8,P,20,.3),{tone:'hi',crease:'lo',lit:true})+isoPips(sc,i+1,[x-5,-BW/2-13],3.2,BZ+51),i);
      // the parcel on the belt
      const w=20,box={x:x-w/2,y:-10,w,d:20,r:1.4};
      add(depth([x,0,BZ+2])+i*.01,`<path class="iso-halo" d="${k.haloOf(box,BZ+2,.1,P)}" style="filter:blur(3px);opacity:.3"/>`+isoS(k.slabOf(box,BZ+2,14+(i%2)*4,P,3,.6),{tone:'hi',crease:'lo'})+isoL(k.lineOnTop([x,box.y],[x,box.y+box.d],BZ+16+(i%2)*4,P),{tone:'faint'})+isoL(k.planOutline({x:x-6,y:-4,w:12,d:8,r:1},BZ+16+(i%2)*4,P,2),{tone:'faint'}),i);
    });
    return sc.render(`A conveyor with ${n} stations. A parcel waits under each station, and the belt carries each one on to the next.`);
  }

  // A CYCLE: a turntable with a station per step; the last feeds the first.
  function isoTurntable({n=4}={}){
    const k=isoK,PL={x:-110,y:-110,w:220,d:220,r:12},R=76,Z=16;
    const sc=isoScene(560,420,[...k.boxCorners(PL,-16,0),[0,0,80]]);
    const {P,at,add,depth}=sc;
    isoPlate(sc,PL);isoLabelPlate(sc,PL.x+16,PL.y+PL.d-34,30);
    add(-5e7,`<path class="iso-halo" d="${k.haloOf({x:-R,y:-R,w:2*R,d:2*R,r:R},0,Z,P)}" style="opacity:.4"/>`+isoS(k.cylinder(0,0,R+8,0,8,P,96,.6),{tone:'mid'})+isoS(k.cylinder(0,0,R,8,Z-8,P,96,.5),{tone:'hi',crease:'lo'}));
    const ticks=k.radialTicks(0,0,R-4,72,6,Z,[2,4],P);
    add(-4.9e7,isoL(ticks.minor,{tone:'lo'})+isoL(ticks.major,{tone:'mid'})+isoL(k.ring(0,0,R-16,Z,P,80),{tone:'faint'})+isoL(k.knurl(0,0,R,8,Z,120,P),{tone:'faint'}));
    // the direction of travel, a lit arc
    const arc=Array.from({length:61},(_,i)=>{const a=-Math.PI/2+i*(Math.PI*1.7/60);return [Math.cos(a)*(R-24),Math.sin(a)*(R-24)];});
    add(-4.85e7,isoL(k.onTop(arc,Z,P),{tone:'lit',flow:true}));
    add(-4.8e7,isoS(k.cylinder(0,0,12,Z,10,P,40,.5),{tone:'mid'})+isoKnob(sc,0,0,Z+10,6,6)+isoD([0,1,2,3,4,5].map(i=>at([Math.cos(i*1.05)*9,Math.sin(i*1.05)*9,Z+10])),{size:.45}));
    for(let i=0;i<n;i++){
      const a=-Math.PI/2+i*2*Math.PI/n,x=Math.cos(a)*(R-42+30),y=Math.sin(a)*(R-42+30),plan={x:x-10,y:y-10,w:20,d:20,r:3};
      add(depth([x,y,Z])+1e3,`<path class="iso-halo" d="${k.haloOf(plan,Z,.1,P)}" style="filter:blur(3px);opacity:.3"/>`+isoS(k.slabOf(plan,Z,14,P,4,.6),{tone:'hi',crease:'lo'})+isoS(k.cylinder(x,y,4,Z+14,6,P,20,.3),{tone:'mid'})+isoPips(sc,i+1,[x-6,y+6],3.2,Z+14),i);
    }
    return sc.render(`A turntable with ${n} stations around its rim. It turns one way, so the last station hands back to the first.`);
  }

  // A SCALE: a long ruler between two ends, a rider at each marked point.
  function isoRuler({marks=[20,60,90]}={}){
    const k=isoK,U=[.94,-.342],N=[.342,.94],LEN=220,Z=18;
    const on=(s,n,z)=>[U[0]*s+N[0]*n,U[1]*s+N[1]*n,z];
    const quad=(s0,s1,n0,n1)=>[[s0,n0],[s1,n0],[s1,n1],[s0,n1]].map(([s,n])=>[U[0]*s+N[0]*n,U[1]*s+N[1]*n]);
    const sc=isoScene(660,300,[on(-LEN/2-24,-26,-10),on(-LEN/2-24,26,-10),on(LEN/2+24,-26,-10),on(LEN/2+24,26,-10),on(-LEN/2-20,0,40),on(LEN/2+20,0,40)]);
    const {P,at,add,depth}=sc;
    add(-1e9,`<path class="iso-halo" d="${k.extrude(quad(-LEN/2-20,LEN/2+20,-24,24),-8,8,P).fill}"/>`+isoS(k.extrude(quad(-LEN/2-20,LEN/2+20,-24,24),-8,8,P,{bevel:1}),{tone:'mid'}));
    for(const s of [-LEN/2-10,LEN/2+10])add(-9e8+s,isoS(k.extrude(quad(s-8,s+8,-14,14),0,Z+8,P,{bevel:.6}),{tone:'mid'})+isoKnob(sc,...on(s,0,0).slice(0,2),Z+8,4,3));
    add(-8e8,isoS(k.extrude(quad(-LEN/2,LEN/2,-8,8),Z-6,6,P,{bevel:.6}),{tone:'hi',crease:'lo'}));
    let minor='',major='';
    for(let i=0;i<=100;i+=2){const s=-LEN/2+LEN*i/100,len=i%10?3:6;(i%10?(m=>minor+=m):(m=>major+=m))(k.segment(on(s,8,Z),on(s,8-len,Z),P));}
    add(-7.9e8,isoL(minor,{tone:'lo'})+isoL(major,{tone:'mid'})+isoL(k.segment(on(-LEN/2,-8,Z),on(LEN/2,-8,Z),P),{tone:'faint'}));
    marks.forEach((m,i)=>{
      const s=-LEN/2+LEN*Math.max(0,Math.min(100,m))/100;
      add(depth(on(s,0,Z))+1e3+i,isoS(k.extrude(quad(s-7,s+7,-12,12),Z-8,14,P,{bevel:.5}),{tone:'hi',crease:'lo'})+isoL(k.segment(on(s,12,Z+2),on(s,12,Z-6),P),{tone:'lit'})+isoS(k.extrude(quad(s-2,s+2,-5,5),Z+6,10,P),{tone:'mid'})+isoPips(sc,i+1,on(s-4,-9,0).slice(0,2),0,Z+6),i);
    });
    return sc.render('A long ruler between two end blocks, with a rider clamped at each marked point.');
  }

  // A DIRECTION, A FADING RESPONSE and A NUMBER: a dial gauge on a stand.
  // 0 the block being measured, 1 the plunger and spring, 2 the dial and needle.
  function isoDial({turn=.18,blocks=[18,12,7]}={}){
    const k=isoK,PL={x:-128,y:-64,w:262,d:128,r:8},POST=[-98,0],POST_TOP=122,CLAMP_Z=100,DIAL=[58,0],DR=22,DZ=82,DH=10,DT=DZ+DH,CT=8;
    const sc=isoScene(600,380,[...k.boxCorners(PL,-16,0),[POST[0],POST[1],POST_TOP+2],[DIAL[0]+DR,0,DT]],{azimuth:42});
    const {P,at,add,depth}=sc;
    isoPlate(sc,PL);isoLabelPlate(sc,PL.x+PL.w-52,PL.y+10,34);
    const MAG={x:-112,y:-20,w:44,d:40,r:3};
    add(-5e7,isoS(k.slabOf(MAG,0,11,P,6,.8),{tone:'mid'})+isoS(k.slabOf(k.insetPlan(MAG,.8),11,13,P,6,.8),{tone:'mid'})+isoKnob(sc,MAG.x+32,MAG.y+28,24)+isoS(k.cylinder(POST[0],0,3.2,24,POST_TOP-24,P,28),{tone:'mid',crease:'none'})+isoL([60,80].map(z=>k.sideArc(POST[0],0,3.2,z,P,16)).join(''),{tone:'faint'})+isoS(k.slabOf({x:POST[0]-7,y:-7,w:14,d:14,r:2.5},CLAMP_Z-4,12,P,4,.6),{tone:'mid'}));
    add(-4.9e7,isoS(k.slabOf({x:POST[0]+7,y:-3,w:DIAL[0]-DR-POST[0]-5,d:6,r:2},CLAMP_Z,4,P,4,.5),{tone:'mid'})+isoD([at([POST[0]+11,0,CLAMP_Z+4]),at([DIAL[0]-DR-2,0,CLAMP_Z+4])],{size:.45}));
    for(const y of [-20,15])add(-4.5e7,isoS(k.slabOf({x:2,y,w:122,d:5,r:1},0,3,P,3,.4),{tone:'mid'}));
    const CAR={x:2,y:-24,w:76,d:48,r:3};
    let car=`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CAR,3),3,.1,P)}" style="filter:blur(4px)"/>`+isoS(k.slabOf(CAR,3,CT-3,P,5,.6),{tone:'mid'});
    blocks.forEach((h,i)=>{const plan={x:CAR.x+CAR.w-24-i*24,y:-12,w:18,d:24,r:1};car+=isoS(k.slabOf(plan,CT,h,P,3,.5),{tone:'hi',crease:'lo',lit:i===0})+isoL(k.planOutline(k.insetPlan(plan,2),CT+h,P,3),{tone:'faint'});});
    add(-4e7,car,0);
    const tip=CT+blocks[0];
    add(-3.9e7,isoS(k.cylinder(DIAL[0],0,2.6,tip,2.4,P,20),{tone:'hi',lit:true})+isoS(k.cylinder(DIAL[0],0,1.4,tip+2.4,DZ-tip-2.4,P,16),{tone:'hi',crease:'none'})+isoL(Array.from({length:9},(_,i)=>k.sideArc(DIAL[0],0,3.4,tip+8+i*(DZ-tip-12)/8,P,14)).join(''),{tone:'mid'}),1);
    add(-3.1e7,isoS(k.slabOf({x:DIAL[0]-DR-6,y:-4,w:8,d:8,r:1.5},DZ+2,CLAMP_Z-DZ-2,P,3,.4),{tone:'mid'}));
    let d=isoS(k.cylinder(DIAL[0],0,DR,DZ,DH,P,64,.8),{tone:'hi',crease:'lo'})+isoL(k.knurl(DIAL[0],0,DR,DT-3.4,DT,84,P,.3),{tone:'lo'})+isoL(k.ring(DIAL[0],0,DR-2.2,DT,P,64),{tone:'lo'});
    const t=k.radialTicks(DIAL[0],0,DR-3,50,5,DT,[1.3,2.8],P);d+=isoL(t.minor,{tone:'lo'})+isoL(t.major,{tone:'mid'});
    const a=turn*Math.PI*2;
    d+=isoL(k.lineOnTop([DIAL[0]-Math.sin(a)*3.4,Math.cos(a)*3.4],[DIAL[0]+Math.sin(a)*(DR-4),-Math.cos(a)*(DR-4)],DT+.2,P),{tone:'lit'})+isoL(k.ring(DIAL[0],0,1.6,DT,P,16),{tone:'mid'});
    add(-3e7,d,2);
    return sc.render('A dial gauge on a stand. Its plunger rests on a gauge block on a sliding carriage, and the needle turns by how far the plunger rises.');
  }

  // A WEB: a pegboard with three hub posts tied together by cords.
  function isoPegboard(){
    const k=isoK,PL={x:-120,y:-90,w:240,d:180,r:10},hubs=[[-60,-35],[60,-35],[0,50]],HZ=58;
    const sc=isoScene(600,400,[...k.boxCorners(PL,-16,0),[0,-35,HZ+20]]);
    const {P,at,add,tube,depth}=sc;
    isoPlate(sc,PL);isoLabelPlate(sc,PL.x+PL.w-48,PL.y+PL.d-30,30);
    const holes=[];for(let x=PL.x+20;x<PL.x+PL.w-10;x+=16)for(let y=PL.y+16;y<PL.y+PL.d-24;y+=16)holes.push(at([x,y,0]));
    add(-9e8,isoD(holes,{size:.7,tone:'lo'}));
    const small=[[-95,-70],[96,-62],[-100,40],[98,30],[-30,-70],[40,64],[-60,64]];
    for(const [x,y] of small)add(depth([x,y,0]),isoS(k.cylinder(x,y,3,0,14,P,16,.3),{tone:'mid'})+isoS(k.cylinder(x,y,4.4,14,2,P,20),{tone:'mid'}));
    for(const [x,y] of small){const h=hubs.reduce((b,h)=>Math.hypot(h[0]-x,h[1]-y)<Math.hypot(b[0]-x,b[1]-y)?h:b);add(depth([(x+h[0])/2,(y+h[1])/2,0])-5,isoL(k.pathOf([[x,y,13],[(x+h[0])/2,(y+h[1])/2,HZ*.42],[h[0],h[1],HZ-14]].map(at)),{tone:'mid'})+isoD([at([x,y,13])],{size:.9,tone:'hi'}));}
    hubs.forEach(([x,y],i)=>{const [nx,ny]=hubs[(i+1)%3];tube([[x,y,HZ-6],[(x+nx)/2,(y+ny)/2,HZ-14],[nx,ny,HZ-6]],1.6,i,{maxLength:12});});
    hubs.forEach(([x,y],i)=>add(depth([x,y,0])+50,`<path class="iso-halo" d="${k.haloOf({x:x-10,y:y-10,w:20,d:20,r:10},0,.1,P)}" style="filter:blur(3px);opacity:.3"/>`+isoS(k.cylinder(x,y,12,0,6,P,40,.5),{tone:'mid'})+isoS(k.cylinder(x,y,4.5,6,HZ-12,P,24),{tone:'hi',crease:'none'})+isoL([20,34].map(z=>k.sideArc(x,y,4.5,z,P,14)).join(''),{tone:'lo'})+isoS(k.cylinder(x,y,9,HZ-8,10,P,36,.5),{tone:'hi',crease:'lo',lit:true})+isoKnob(sc,x,y,HZ+2,4,3)+isoPips(sc,i+1,[x-4,y+6],3.2,HZ+2),i));
    return sc.render('A pegboard with three tall hub posts tied together by cords, and smaller pegs strung to whichever hub is nearest.');
  }

  // THE STUDY AT A GLANCE: a lab bench with a tray per group and a dial for the result.
  function isoBench({groups=2,dir='up'}={}){
    const k=isoK,n=Math.max(1,Math.min(4,groups)),PL={x:-140,y:-60,w:280,d:120,r:8};
    const sc=isoScene(640,340,[...k.boxCorners(PL,-16,0),[90,0,70],[-120,0,40]]);
    const {P,at,add,depth}=sc;
    isoPlate(sc,PL);isoLabelPlate(sc,PL.x+16,PL.y+10,30);
    for(let g=0;g<n;g++){
      const x=-120+g*(150/n),w=150/n-10,tray={x,y:-34,w,d:68,r:3};
      let s=isoS(k.slabOf(tray,0,6,P,4,.6),{tone:'mid'})+isoL(k.planOutline(k.insetPlan(tray,3),6,P,3),{tone:'lo'});
      const cols=Math.max(2,Math.min(6,Math.floor((w-8)/10)));
      for(let r=0;r<4;r++)for(let c=0;c<cols;c++){const px=x+6+c*((w-12)/Math.max(1,cols-1)),py=tray.y+12+r*14;s+=isoS(k.cylinder(px,py,2.6,6,9,P,10),{tone:'hi',crease:'none',lit:g===0})+isoS(k.cylinder(px,py,3.2,15,2.2,P,12),{tone:'mid'});}
      s+=isoPips(sc,g+1,[x+3,tray.y+tray.d-3],3.2,6);
      add(-5e7+g,s,g);
    }
    const D=[96,0],DR=24,DZ=30;
    add(-4e7,isoS(k.slabOf({x:D[0]-30,y:-24,w:60,d:48,r:4},0,DZ,P,4,.8),{tone:'mid'})+isoL([10,20].map(z=>k.sideSeam({x:D[0]-30,y:-24,w:60,d:48,r:4},z,P,4)).join(''),{tone:'lo'})+isoS(k.cylinder(D[0],0,DR,DZ,6,P,64,.6),{tone:'hi',crease:'lo'})+isoL(k.ring(D[0],0,DR-3,DZ+6,P,64),{tone:'lo'}));
    const t=k.radialTicks(D[0],0,DR-4,40,5,DZ+6,[1.5,3],P,-Math.PI*.6,Math.PI*1.2);
    const a={up:.5,down:-.5,flat:0,mixed:.15}[dir]??0;
    add(-3.9e7,isoL(t.minor,{tone:'lo'})+isoL(t.major,{tone:'mid'})+isoL(k.lineOnTop([D[0],0],[D[0]+Math.sin(a)*(DR-6),-Math.cos(a)*(DR-6)],DZ+6.2,P),{tone:'lit'})+isoKnob(sc,D[0],0,DZ+6,3,2),2);
    return sc.render(`A lab bench with ${n} sample tray${n>1?'s':''}, one per group, and a dial that reads the main result.`);
  }

  // Which machine draws which kind of picture.
  const ISO_KIND={handoff:['conveyor',{n:3}],loop:['tank',{}],capacity:['tank',{level:.86}],decision:['balance',{}],layers:['drawers',{count:3,open:2}],compass:['dial',{turn:.12}],release:['dial',{turn:.4,blocks:[7,12,18]}],network:['pegboard',{}]};
  const ISO_MAKERS={tank:isoTank,balance:isoBalance,drawers:isoDrawers,conveyor:isoConveyor,turntable:isoTurntable,ruler:isoRuler,dial:isoDial,pegboard:isoPegboard,bench:isoBench};
  function isoMachine(name,opts={}){
    const key=name+JSON.stringify(opts);
    if(!isoCache.has(key)){isoStyle();isoCache.set(key,(ISO_MAKERS[name]||isoPegboard)(opts));}
    return isoCache.get(key);
  }
  function isoForKind(kind){const [name,opts]=ISO_KIND[kind]||ISO_KIND.network;return isoMachine(name,opts);}
  // Wrap a machine: parts tagged data-p get the selection state. hidden marks the gap
  // in a tap check, selected lights one part, interactive makes parts tappable.
  function isoFigure(svg,{selected=-1,hidden=-1,parts=0,interactive=false,labels=[],cls=''}={}){
    let out=svg;
    if(interactive&&parts)for(let i=0;i<parts;i++)out=out.split(`<g data-p="${i}">`).join(`<g data-p="${i}" data-action="iv-part" data-index="${i}" role="button" aria-label="Part ${i+1}: ${esc(labels[i]||'')}">`);
    return `<div class="ivm${cls?' '+cls:''}"${selected>=0?` data-sel="${selected}"`:''}${hidden>=0?` data-gap="${hidden}"`:''}>${out}</div>`;
  }
  // Small copies (lesson rows, cards, review) are images: one blob per machine and
  // theme, so a book with forty lessons does not put forty drawings in the page.
  const ISO_THEMES={
    day:'--anatomy-paper:#fff;--anatomy-face:#fff;--anatomy-top:#fff;--anatomy-shade-0:#dcdcd9;--anatomy-shade-1:#e6e6e3;--anatomy-shade-2:#eeeeeb;--anatomy-shade-3:#f5f5f2;--anatomy-lit-top:#e6eafb;--anatomy-lit-shade:#d6dcf6;--anatomy-hi:#2b2b2f;--anatomy-mid:#8b8b90;--anatomy-lo:#b6b6ba;--anatomy-faint:#d6d6d8;--anatomy-lit:#2039c4;--anatomy-halo:#8a8a80;--anatomy-halo-opacity:.3;--anatomy-dot:#3a3a3e;--anatomy-weight:.9px',
    night:'--anatomy-paper:#111214;--anatomy-face:#1b1c1f;--anatomy-top:#1d1e21;--anatomy-shade-0:#0e0f10;--anatomy-shade-1:#121315;--anatomy-shade-2:#16171a;--anatomy-shade-3:#1a1b1e;--anatomy-lit-top:#262b45;--anatomy-lit-shade:#1d2136;--anatomy-hi:#d6d5d0;--anatomy-mid:#6c6c6e;--anatomy-lo:#404043;--anatomy-faint:#2b2b2e;--anatomy-lit:#a9b7ff;--anatomy-halo:#000;--anatomy-halo-opacity:.9;--anatomy-dot:#e6e6e6;--anatomy-weight:.9px'};
  const isoBlobs=new Map();
  function isoThumb(svg,label=''){
    if(!isoBlobs.has(svg)){
      const base=isoK.ISO_CSS.replace(/\.iso\{[^}]*\}\s*\.iso\[data-theme="light"\]\{[^}]*\}/,'');
      const make=t=>{const css=`.iso-svg{${ISO_THEMES[t]}}${base}.rv-water>.iso-top{fill:color-mix(in srgb,var(--anatomy-lit) 16%,var(--anatomy-top))}.rv-water>.iso-shade{fill:color-mix(in srgb,var(--anatomy-lit) 22%,var(--anatomy-shade-2))}.iso-line[data-flow]{animation:none}`;
        const doc=svg.replace(/^<svg/,'<svg xmlns:xlink="http://www.w3.org/1999/xlink"').replace(/(<svg[^>]*>)/,`$1<style>${css}</style>`);
        try{return URL.createObjectURL(new Blob([doc],{type:'image/svg+xml'}));}catch{return 'data:image/svg+xml,'+encodeURIComponent(doc);}};
      isoBlobs.set(svg,{day:make('day'),night:make('night')});
    }
    const u=isoBlobs.get(svg);
    return `<img class="ivm-img is-day" src="${u.day}" alt="${esc(label)}" decoding="async"><img class="ivm-img is-night" src="${u.night}" alt="" decoding="async">`;
  }
