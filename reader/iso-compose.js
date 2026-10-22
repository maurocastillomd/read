
  // ONE MACHINE PER PICTURE. No two pictures in read. share a drawing. Each picture is
  // a bench with one station per part, set out in the shape of the idea: a line for a
  // handoff, a closed pipe loop for a loop, a fork for a choice, steps for layers, a
  // hub for a direction. Stations come from a set of small mechanisms (a tank, gears,
  // a spring, a lamp…), and a library-wide register hands every picture a combination
  // that no other picture has. The first picture of each kind keeps the hand-built
  // machine above (the tank, the balance…); every later one is composed.
  const IsoL=IsoLathe;
  const ISO_UP=[0,0,1];
  // Each station draws at (x,y) on a surface at height z, scale s, variant v (0|1),
  // and returns its svg and the height of its top, where connectors can attach.
  const ISO_STATIONS={
    tank(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,r=(v?16:19)*s,h=(v?50:38)*s,lvl=z+6+h*(v?.42:.7);
      let o=isoS(k.cylinder(x,y,r+4,z,4,P,40,.5),{tone:'mid'})+isoS(k.cylinder(x,y,r,z+4,h,P,40),{tone:'mid',crease:'none'});
      o+=isoL([.3,.6].map(f=>k.sideArc(x,y,r,z+4+h*f,P,24)).join(''),{tone:'lo'});
      o+=isoS(k.cylinder(x,y,r-2.2,z+4+h-.1,.1,P,40),{tone:'hi',lit:true,className:'rv-water',flat:true});
      o+=isoL(k.ring(x,y,r,z+4+h,P,40),{tone:'hi'})+isoL(k.ring(x,y,r*.55,lvl,P,32),{tone:'faint'});
      o+=isoS(k.slabOf({x:x+r-3,y:y+r*.2,w:3,d:3,r:.6},z+8,h-6,P,2),{tone:'lo',crease:'none'});
      return {svg:o,top:z+4+h};
    },
    hopper(sc,x,y,z,s,v){
      const {P}=sc,F=IsoL.frameAlong([x,y,z],ISO_UP),R=(v?22:18)*s,H=(v?40:52)*s;
      let o='';
      for(let i=0;i<3;i++){const a=i*2.09+.5;o+=isoS(isoK.cylinder(x+Math.cos(a)*R*.7,y+Math.sin(a)*R*.7,1.6,z,H*.62,P,10),{tone:'mid',crease:'none'});}
      o+=isoS(IsoL.lathe([[H*.34,0],[H*.34,3.4*s],[H*.5,3.4*s],[H*.92,R],[H,R],[H,R-1.6]],F,P,{rims:'all'}),{tone:'hi',crease:'lo'});
      o+=isoL(isoK.ring(x,y,R-1.6,z+H,P,48),{tone:'lo'})+isoD([isoK.iso([x,y,z+H*.3],P)],{size:1,tone:'hi'});
      return {svg:o,top:z+H};
    },
    gears(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,a=(v?15:12)*s,b=(v?9:13)*s,ax=x-b*.9,bx=x+a*.9,z1=z+(v?20:14)*s,z2=z+(v?28:24)*s;
      const gear=(cx,r,zz,n)=>isoS(k.cylinder(cx,y,1.8,z,zz-z,P,12),{tone:'mid',crease:'none'})+isoS(k.cylinder(cx,y,r,zz,4.5,P,n,.4),{tone:'hi',crease:'lo'})+isoL(k.knurl(cx,y,r,zz,zz+4.5,n,P,.3),{tone:'lo'})+isoL(k.ring(cx,y,r*.45,zz+4.5,P,20),{tone:'mid'})+isoD([k.iso([cx,y,zz+4.5],P)],{size:.9,tone:'hi'});
      let o=isoS(k.slabOf({x:x-a-b,y:y-10*s,w:2*(a+b),d:20*s,r:3},z,4,P,4,.5),{tone:'mid'});
      o+=gear(ax,b,z1,Math.round(b*3))+gear(bx,a,z2,Math.round(a*3));
      return {svg:o,top:z2+4.5};
    },
    piston(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,W=(v?30:24)*s,H=(v?20:26)*s,cols=v?2:1;let o=isoS(k.slabOf({x:x-W/2,y:y-W/2,w:W,d:W,r:2},z,H,P,4,.6),{tone:'mid'})+isoL(k.sideSeam({x:x-W/2,y:y-W/2,w:W,d:W,r:2},z+H*.5,P,4),{tone:'lo'});
      for(let c=0;c<cols;c++){const px=cols>1?x+(c?6:-6)*s:x,rise=(c?14:24)*s;o+=isoS(k.cylinder(px,y,5*s,z+H,4,P,24,.3),{tone:'hi'})+isoS(k.cylinder(px,y,1.6,z+H+4,rise,P,12),{tone:'hi',crease:'none'})+isoS(k.cylinder(px,y,4.4*s,z+H+4+rise,3,P,24,.3),{tone:'mid',lit:c===0});}
      return {svg:o,top:z+H+4+24*s+3};
    },
    spring(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,L=(v?26:20)*s,cz=z+16*s,R=(v?7:9)*s;
      const plate=px=>isoS(k.slabOf({x:px-1.6,y:y-12*s,w:3.2,d:24*s,r:1},z,28*s,P,3,.3),{tone:'mid'});
      const c=k.coil(x-L,x+L,[y,cz],R,v?7:5,'x',P,18);
      const o=isoS(k.slabOf({x:x-L-6,y:y-13*s,w:2*L+12,d:26*s,r:3},z,3,P,4,.4),{tone:'lo'})+plate(x-L-2)+isoL(c.back,{tone:'lo'})+isoS(k.cylinder(x-L+2,y,1.2,cz-1,2,P,8),{tone:'mid'})+isoL(c.front,{tone:'hi'})+plate(x+L+2)+isoD([k.iso([x+L+2,y,z+28*s],P)],{size:.8,tone:'hi'});
      return {svg:o,top:z+28*s};
    },
    drum(sc,x,y,z,s,v){
      const {P,tube}=sc,k=isoK,R=(v?11:14)*s,L=(v?40:30)*s,cz=z+R+6;
      let o='';
      for(const px of [x-L/2-4,x+L/2+4])o+=isoS(k.slabOf({x:px-2,y:y-8*s,w:4,d:16*s,r:1},z,cz-z+2,P,3,.3),{tone:'mid'});
      const F=IsoL.frameAlong([x-L/2,y,cz],[1,0,0]);
      o+=isoS(IsoL.lathe([[0,0],[0,R],[L,R],[L,0]],F,P,{rims:'all'}),{tone:'hi',crease:'lo'});
      o+=isoL(k.segment([x-L/2,y,cz+R],[x+L/2,y,cz+R],P),{tone:'lo'});
      return {svg:o,top:cz+R};
    },
    lamp(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,H=(v?46:34)*s,b=(v?7:9)*s;
      const o=isoS(k.cylinder(x,y,10*s,z,4,P,32,.5),{tone:'mid'})+isoS(k.cylinder(x,y,1.8,z+4,H,P,12),{tone:'mid',crease:'none'})+isoS(k.cylinder(x,y,4*s,z+4+H,4,P,20,.3),{tone:'mid'})+isoS(IsoL.sphereOf([x,y,z+8+H+b*.9],b,P),{tone:'hi',lit:true});
      return {svg:o,top:z+8+H+b*1.8};
    },
    gauge(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,W=(v?36:30)*s,H=(v?14:22)*s,R=W*.38;
      let o=isoS(k.slabOf({x:x-W/2,y:y-W/2,w:W,d:W,r:3},z,H,P,4,.6),{tone:'mid'})+isoS(k.cylinder(x,y,R,z+H,3,P,48,.4),{tone:'hi',crease:'lo'});
      const t=k.radialTicks(x,y,R-2,30,5,z+H+3,[1.2,2.4],P,-Math.PI*.7,Math.PI*1.4),a=v?.9:-.5;
      o+=isoL(t.minor,{tone:'lo'})+isoL(t.major,{tone:'mid'})+isoL(k.lineOnTop([x,y],[x+Math.sin(a)*(R-3),y-Math.cos(a)*(R-3)],z+H+3.1,P),{tone:'lit'})+isoD([k.iso([x,y,z+H+3],P)],{size:.8,tone:'hi'});
      return {svg:o,top:z+H+3};
    },
    crates(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,n=v?3:2,W=24*s;let o='',zz=z;
      for(let i=0;i<n;i++){const w=W-i*4*s,off=(i%2?3:-2)*s,plan={x:x-w/2+off,y:y-w/2,w,d:w,r:1.4},h=(13-i*1.5)*s;o+=isoS(k.slabOf(plan,zz,h,P,3,.5),{tone:'hi',crease:'lo',lit:i===n-1})+isoL(k.lineOnTop([plan.x,plan.y+w/2],[plan.x+w,plan.y+w/2],zz+h,P),{tone:'faint'});zz+=h;}
      return {svg:o,top:zz};
    },
    wheel(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,H=(v?30:20)*s,R=(v?15:19)*s,n=v?4:6;
      let o=isoS(k.slabOf({x:x-8*s,y:y-8*s,w:16*s,d:16*s,r:2},z,6,P,3,.5),{tone:'mid'})+isoS(k.cylinder(x,y,2.4,z+6,H,P,14),{tone:'mid',crease:'none'});
      o+=isoS(k.cylinder(x,y,R,z+6+H,3,P,56,.4),{tone:'hi',crease:'lo'})+isoS(k.cylinder(x,y,R-3.4,z+6+H+2.95,.1,P,48),{tone:'mid',flat:true});
      o+=isoL(Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n;return k.lineOnTop([x,y],[x+Math.cos(a)*(R-3),y+Math.sin(a)*(R-3)],z+9+H,P);}).join(''),{tone:'hi'});
      o+=isoKnob(sc,x+Math.cos(.6)*(R-2),y+Math.sin(.6)*(R-2),z+9+H,2.4,5)+isoS(k.cylinder(x,y,3.6,z+9+H,2.4,P,16),{tone:'hi',lit:true});
      return {svg:o,top:z+11+H};
    },
    fan(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,H=(v?34:24)*s,R=(v?20:16)*s,n=v?3:5,hz=z+H;
      let o=isoS(k.cylinder(x,y,9*s,z,5,P,28,.5),{tone:'mid'})+isoS(k.cylinder(x,y,2.2,z+5,H-5,P,12),{tone:'mid',crease:'none'});
      for(let i=0;i<n;i++){const a=i*Math.PI*2/n+.3,w=.42,ring=[[x+Math.cos(a-.12)*3,y+Math.sin(a-.12)*3],[x+Math.cos(a-w)*R,y+Math.sin(a-w)*R],[x+Math.cos(a+.08)*R*1.02,y+Math.sin(a+.08)*R*1.02],[x+Math.cos(a+.2)*3,y+Math.sin(a+.2)*3]];o+=isoS(k.extrude(ring,hz,1.4,P,{bevel:.2}),{tone:'hi',crease:'lo',lit:i===0});}
      o+=isoS(k.cylinder(x,y,4,hz-1,4,P,20,.4),{tone:'mid'});
      return {svg:o,top:hz+3};
    },
    weights(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,n=v?4:3;let o=isoS(k.cylinder(x,y,1.6,z,(n*7+10)*s,P,10),{tone:'mid',crease:'none'}),zz=z;
      const discs=[];for(let i=0;i<n;i++){const r=(v?20-i*3.5:17-i*3)*s,h=(v?5:7)*s;discs.push(isoS(k.cylinder(x,y,r,zz,h,P,48,.5),{tone:i===n-1?'hi':'mid',crease:'lo',lit:i===n-1})+isoL(k.ring(x,y,r*.4,zz+h,P,24),{tone:'lo'}));zz+=h+.6;}
      o=discs[0]+o+discs.slice(1).join('');
      return {svg:o,top:zz};
    },
    lever(sc,x,y,z,s,v){
      const {P,tube}=sc,k=isoK,L=(v?34:26)*s,tilt=v?-.5:.45,pz=z+12*s;
      const end=[x+Math.cos(tilt)*L*.5,y,pz+Math.sin(tilt)*L],st=[x-Math.cos(tilt)*L*.5,y,pz-Math.sin(tilt)*L*.2];
      let o=isoS(k.slabOf({x:x-12*s,y:y-8*s,w:24*s,d:16*s,r:2},z,5,P,3,.5),{tone:'mid'})+isoS(k.slabOf({x:x-3,y:y-5*s,w:6,d:10*s,r:1},z+5,pz-z-3,P,2,.3),{tone:'mid'});
      o+=isoL(k.segment(st,end,P),{tone:'hi'})+isoL(k.segment([st[0],st[1]+1.4,st[2]],[end[0],end[1]+1.4,end[2]],P),{tone:'mid'})+isoS(IsoL.sphereOf(end,4.4*s,P),{tone:'hi',lit:true})+isoD([k.iso([x,y,pz],P)],{size:1,tone:'hi'});
      return {svg:o,top:Math.max(end[2],pz)+4};
    },
    bell(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,W=(v?22:18)*s,H=(v?44:38)*s,F=IsoL.frameAlong([x,y,z+H-4],[0,0,-1]);
      let o='';
      for(const px of [x-W,x+W])o+=isoS(k.slabOf({x:px-2,y:y-2,w:4,d:4,r:1},z,H,P,2,.3),{tone:'mid',crease:'none'});
      o+=isoS(k.slabOf({x:x-W-3,y:y-3,w:2*W+6,d:6,r:1},z+H,3,P,3,.3),{tone:'mid'});
      o+=isoS(IsoL.lathe([[0,0],[0,3*s],[3,4*s],[8*s,7*s,1],[16*s,11*s,1],[19*s,13*s],[20*s,13*s],[20*s,0]],F,P),{tone:'hi',crease:'lo',lit:!!v});
      o+=isoS(IsoL.sphereOf([x,y,z+H-4-21*s],2.2,P),{tone:'mid'});
      return {svg:o,top:z+H+3};
    },
    flask(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,F=IsoL.frameAlong([x,y,z+4],ISO_UP),r=(v?13:11)*s;
      let o=isoS(k.cylinder(x,y,14*s,z,4,P,36,.5),{tone:'mid'});
      const mer=v?[[0,0],[0,r*.5],[2,r*.9,1],[r*.9,r,1],[r*1.6,r*.6,1],[r*1.9,3.4*s],[r*2.9,3.4*s],[r*2.9,4.4*s],[r*3,4.4*s],[r*3,0]]:[[0,0],[0,r],[r*1.1,r],[r*1.5,r*.6],[r*1.7,3.2*s],[r*2.8,3.2*s],[r*2.8,4.2*s],[r*2.9,4.2*s],[r*2.9,0]];
      o+=isoS(IsoL.lathe(mer,F,P),{tone:'hi',crease:'lo'});
      o+=isoS(k.cylinder(x,y,r*.82,z+4+r*.55,.1,P,32),{tone:'hi',lit:true,className:'rv-water',flat:true});
      return {svg:o,top:z+4+r*2.9};
    },
    sieve(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,W=(v?38:30)*s,H=(v?12:20)*s,plan={x:x-W/2,y:y-W/2,w:W,d:W,r:2};
      let o='';
      for(const [cx,cy] of k.corners(plan,3))o+=isoS(k.cylinder(cx,cy,1.4,z,H,P,8),{tone:'mid',crease:'none'});
      o+=isoS(k.slabOf(plan,z+H,4,P,4,.5),{tone:'hi',crease:'lo'});
      const holes=[];for(let i=0;i<(v?5:4);i++)for(let j=0;j<(v?5:4);j++)holes.push(k.iso([plan.x+5+i*(W-10)/((v?5:4)-1),plan.y+5+j*(W-10)/((v?5:4)-1),z+H+4],P));
      o+=isoD(holes,{size:.7,tone:'lo'})+isoS(k.slabOf({x:x-6*s,y:y-6*s,w:12*s,d:12*s,r:1},z+H+4,6*s,P,3,.4),{tone:'hi',lit:true});
      return {svg:o,top:z+H+4+6*s};
    },
    cells(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,n=v?2:1,H=(v?28:36)*s,r=(v?7:9)*s;let o='';
      for(let i=0;i<n;i++){const cx=n>1?x+(i?-8:8)*s:x;o+=isoS(k.cylinder(cx,y,r,z,H,P,32,.6),{tone:'hi',crease:'lo'})+isoL([.25,.75].map(f=>k.sideArc(cx,y,r,z+H*f,P,20)).join(''),{tone:'lo'})+isoS(k.cylinder(cx,y,r*.4,z+H,3,P,16,.3),{tone:'mid',lit:i===0});}
      return {svg:o,top:z+H+3};
    },
    press(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,W=(v?20:16)*s,H=(v?40:32)*s;
      let o=isoS(k.slabOf({x:x-W-4,y:y-10*s,w:2*W+8,d:20*s,r:2},z,6,P,3,.5),{tone:'mid'});
      for(const px of [x-W,x+W])o+=isoS(k.cylinder(px,y,2.2,z+6,H,P,12),{tone:'mid',crease:'none'});
      const pz=z+6+H*(v?.42:.55);
      o+=isoS(k.slabOf({x:x-8*s,y:y-8*s,w:16*s,d:16*s,r:1},z+6,7*s,P,3,.4),{tone:'hi',lit:true});
      o+=isoS(k.slabOf({x:x-W-3,y:y-6*s,w:2*W+6,d:12*s,r:1.4},pz,4,P,3,.4),{tone:'hi',crease:'lo'});
      o+=isoS(k.cylinder(x,y,2,pz+4,z+6+H-pz-4,P,12),{tone:'mid',crease:'none'})+isoS(k.slabOf({x:x-W-4,y:y-7*s,w:2*W+8,d:14*s,r:1.6},z+6+H,5,P,3,.5),{tone:'mid'})+isoS(k.cylinder(x,y,2,z+11+H,5,P,12),{tone:'mid'})+isoL(k.lineOnTop([x-12*s,y],[x+12*s,y],z+16+H,P),{tone:'hi'});
      return {svg:o,top:z+16+H};
    },
  };
  const ISO_STATION_NAMES=Object.keys(ISO_STATIONS);

  // The shape of each kind of idea. Every layout returns station spots [x,y,z,scale]
  // and draws its own bench and connectors.
  const ISO_SHAPE={handoff:'line',chain:'line',loop:'loop',cycle:'loop',capacity:'limit',decision:'fork',contrast:'pair',layers:'steps',stack:'steps',terms:'shelf',compass:'hub',stat:'hub',release:'fade',network:'web',scale:'rail',glance:'study'};
  function isoBenchPlate(sc,PL,round){
    for(const c of isoK.boxCorners(PL,-16,0))sc.at(c);
    if(!round)return isoPlate(sc,PL);
    const {P,add}=sc,k=isoK,R=PL.w/2,cx=PL.x+R,cy=PL.y+R;
    add(-1e9,`<path class="iso-halo" d="${k.haloOf(PL,-16,10,P)}"/>`+isoS(k.cylinder(cx,cy,R-6,-16,6,P,96,.6),{tone:'lo'})+isoS(k.cylinder(cx,cy,R,-10,10,P,120,1.2),{tone:'mid'})+isoL(k.ring(cx,cy,R-6,0,P,120),{tone:'lo'})+isoD(Array.from({length:8},(_,i)=>k.iso([cx+Math.cos(i*.785+.39)*(R-12),cy+Math.sin(i*.785+.39)*(R-12),0],P)),{size:.5}));
  }
  // A pipe between two stations along the bench, lit and moving when it carries something.
  function isoPipe(sc,a,b,{flow=true,z=6,r=2.4,bend=null}={}){
    const {tube,add,depth}=sc,k=isoK,route=bend?[[a[0],a[1],z],[bend[0],bend[1],z],[b[0],b[1],z]]:[[a[0],a[1],z],[b[0],b[1],z]];
    tube(route,r,undefined,{maxLength:16,tone:'mid'});
    if(flow){const top=route.map(([x,y])=>[x,y,z+r+.2]);add(Math.max(...top.map(depth))+.3,isoL(k.pathOf(top.map(p=>k.iso(p,sc.P))),{tone:'lit',flow:true}));}
  }
  // Start and end a pipe at the rim of each station rather than its middle.
  const isoRim=(a,b,gap=30)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;return [[a[0]+dx/L*gap*a[3],a[1]+dy/L*gap*a[3]],[b[0]-dx/L*gap*b[3],b[1]-dy/L*gap*b[3]]];};
  const ISO_LAYOUTS={
    line(sc,n){const D=74,L=(n-1)*D,spots=Array.from({length:n},(_,i)=>[-L/2+i*D,0,0,1]);isoBenchPlate(sc,{x:-L/2-52,y:-48,w:L+104,d:96,r:8});for(let i=0;i<n-1;i++){const [a,b]=isoRim(spots[i],spots[i+1]);isoPipe(sc,a,b);}return spots;},
    fade(sc,n){const spots=[];let x=0;for(let i=0;i<n;i++){const s=1-i*(.5/Math.max(1,n-1));spots.push([x,0,0,s]);x+=44+38*s;}const L=spots[n-1][0];spots.forEach(p=>p[0]-=L/2);isoBenchPlate(sc,{x:-L/2-50,y:-46,w:L+92,d:92,r:8});for(let i=0;i<n-1;i++){const [a,b]=isoRim(spots[i],spots[i+1]);isoPipe(sc,a,b,{r:2.4-i*.5});}return spots;},
    loop(sc,n){const R=n<=3?62:74,s0=n>4?.85:1,spots=Array.from({length:n},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;return [Math.cos(a)*R,Math.sin(a)*R,0,s0];}),{P,add,tube,depth}=sc,k=isoK;isoBenchPlate(sc,{x:-R-50,y:-R-50,w:2*R+100,d:2*R+100,r:R+50},true);
      // one closed pipe through every station, so the last hands back to the first
      const ring=Array.from({length:97},(_,i)=>[Math.cos(-Math.PI/2+i*Math.PI*2/96)*R,Math.sin(-Math.PI/2+i*Math.PI*2/96)*R,6]),C=2*Math.PI*R,half=26*s0;
      const gaps=spots.map((_,i)=>{const at=i*C/n;return [at-half,at+half];});gaps[0]=[0,half];gaps.push([C-half,C]);
      tube(ring,2.4,undefined,{maxLength:16,tone:'mid',gaps});
      for(let i=0;i<n;i++){const a0=-Math.PI/2+i*2*Math.PI/n+half/R,a1=-Math.PI/2+(i+1)*2*Math.PI/n-half/R,arc=Array.from({length:13},(_,j)=>{const a=a0+(a1-a0)*j/12;return [Math.cos(a)*R,Math.sin(a)*R,8.6];});add(Math.max(...arc.map(depth))+.3,isoL(k.pathOf(arc.map(p=>k.iso(p,P))),{tone:'lit',flow:true}));}
      return spots;},
    limit(sc,n){const D=74,L=(n-1)*D,spots=Array.from({length:n},(_,i)=>[-L/2+i*D,0,0,1]),{P,add,depth}=sc,k=isoK;isoBenchPlate(sc,{x:-L/2-52,y:-48,w:L+130,d:96,r:8});for(let i=0;i<n-1;i++){const [a,b]=isoRim(spots[i],spots[i+1]);isoPipe(sc,a,b);}
      // the limit: a gate at the end the flow runs into, with a stop mark
      const gx=L/2+50;add(depth([gx,0,0]),isoS(k.slabOf({x:gx-3,y:-30,w:6,d:6,r:1},0,62,P,2,.3),{tone:'mid'})+isoS(k.slabOf({x:gx-3,y:24,w:6,d:6,r:1},0,62,P,2,.3),{tone:'mid'})+isoS(k.slabOf({x:gx-4,y:-31,w:8,d:62,r:1},58,5,P,3,.3),{tone:'mid'})+isoL(k.segment([gx,-24,40],[gx,24,40],P),{tone:'lit',dashed:true}));
      const [a]=isoRim(spots[n-1],[gx,0,0,0]);isoPipe(sc,a,[gx-6,0]);return spots;},
    fork(sc,n){const rest=n-1,spots=[[-62,0,0,1.1]];for(let i=0;i<rest;i++){const t=rest>1?i/(rest-1):.5;spots.push([58,(-1+2*t)*Math.min(76,36*rest),0,rest>2?.9:1.05]);}const {P,add,depth}=sc,k=isoK;isoBenchPlate(sc,{x:-114,y:-Math.min(76,36*rest)-48,w:226,d:2*Math.min(76,36*rest)+96,r:10});
      const vx=-8;add(depth([vx,0,6])+.5,isoS(k.cylinder(vx,0,6,0,12,P,24,.4),{tone:'mid'})+isoKnob(sc,vx,0,12,4.6,4));isoPipe(sc,isoRim(spots[0],[vx,0,0,0])[0],[vx-6,0]);
      for(let i=1;i<=rest;i++){const [,b]=isoRim([vx,0,0,0],spots[i]);isoPipe(sc,[vx+4,0],b,{bend:[vx+30,spots[i][1]],flow:i===1});}return spots;},
    pair(sc,n){const spots=[[-70,0,0,1],[70,0,0,1]],{P,add,depth}=sc,k=isoK;isoBenchPlate(sc,{x:-128,y:-50,w:256,d:100,r:8});
      add(depth([0,0,0])+.5,isoS(k.extrude([[-8,-10],[8,-10],[3,10],[-3,10]].map(([a,b])=>[b*.4+a*.1,a]),0,1,P),{tone:'lo'})+isoS(k.slabOf({x:-6,y:-6,w:12,d:12,r:2},0,30,P,3,.4),{tone:'mid'})+isoL(k.segment([-44,0,24],[44,0,36],P),{tone:'hi'})+isoD([k.iso([0,0,30],P)],{size:1.4,tone:'hi'})+isoL(k.segment([0,0,32],[6,0,50],P),{tone:'lit'}));
      return spots;},
    steps(sc,n){const {P,add}=sc,k=isoK,D=62,L=(n-1)*D,spots=[];isoBenchPlate(sc,{x:-L/2-48,y:-48,w:L+96,d:96,r:8});
      for(let i=0;i<n;i++){const x=-L/2+i*D,h=i*16;if(h)add(-5e8+i,isoS(k.slabOf({x:x-29,y:-34,w:58,d:68,r:3},0,h,P,4,.6),{tone:'mid'})+isoL(Array.from({length:i},(_,j)=>k.sideSeam({x:x-29,y:-34,w:58,d:68,r:3},(j+1)*16-.1,P,4)).join(''),{tone:'lo'}));spots.push([x,0,h,.9]);}
      return spots;},
    shelf(sc,n){const {P,add}=sc,k=isoK,D=66,L=(n-1)*D,spots=Array.from({length:n},(_,i)=>[-L/2+i*D,0,14,.85]);isoBenchPlate(sc,{x:-L/2-46,y:-44,w:L+92,d:88,r:8});
      add(-5e8,isoS(k.slabOf({x:-L/2-36,y:-30,w:L+72,d:60,r:3},0,14,P,4,.6),{tone:'mid'})+isoL(spots.slice(1).map(([x])=>k.lineOnTop([x-D/2,-30],[x-D/2,30],14,P)).join(''),{tone:'lo'}));return spots;},
    hub(sc,n){const R=74,spots=Array.from({length:n},(_,i)=>{const a=-Math.PI*.85+i*(Math.PI*1.7/Math.max(1,n-1));return [Math.cos(a)*R,Math.sin(a)*R,0,1.05];}),{P,add,depth}=sc,k=isoK;isoBenchPlate(sc,{x:-R-46,y:-R-46,w:2*R+92,d:2*R+92,r:R+46},true);
      const t=k.radialTicks(0,0,20,36,6,8,[1.6,3.2],P);const a=Math.atan2(spots[0][1],spots[0][0]);
      add(depth([0,0,0])+.5,isoS(k.cylinder(0,0,24,0,8,P,56,.6),{tone:'mid'})+isoL(t.minor,{tone:'lo'})+isoL(t.major,{tone:'mid'})+isoL(k.lineOnTop([0,0],[Math.cos(a)*44,Math.sin(a)*44],8.2,P),{tone:'lit'})+isoKnob(sc,0,0,8,4,3));
      for(const p of spots){const [,b]=isoRim([0,0,0,1],p,28);isoPipe(sc,[p[0]*.34,p[1]*.34],b,{flow:false,r:1.4,z:3});}return spots;},
    web(sc,n){const R=60,spots=Array.from({length:n},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;return [Math.cos(a)*R,Math.sin(a)*R*.9,0,1.1];});isoBenchPlate(sc,{x:-R-46,y:-R-42,w:2*R+92,d:2*R+84,r:12});
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const [a,b]=isoRim(spots[i],spots[j]);isoPipe(sc,a,b,{flow:false,r:1.3,z:4});}return spots;},
    rail(sc,n,o){const {P,add}=sc,k=isoK,L=230,marks=(o.marks||[]).slice(0,n),spots=marks.map(m=>[-L/2+L*Math.max(0,Math.min(100,m))/100,0,10,.75]);isoBenchPlate(sc,{x:-L/2-40,y:-44,w:L+80,d:88,r:8});
      add(-5e8,isoS(k.slabOf({x:-L/2-14,y:-10,w:L+28,d:20,r:2},0,10,P,4,.6),{tone:'mid'}));const t=k.topTicks(-L/2,L/2,L/50,5,10,10,[2,4],P);add(-4.9e8,isoL(t.minor,{tone:'lo'})+isoL(t.major,{tone:'mid'}));return spots;},
    study(sc,n,o){const D=62,L=n*D,spots=Array.from({length:n},(_,i)=>[-L/2+i*D,0,0,.85]),{P,add,depth}=sc,k=isoK;isoBenchPlate(sc,{x:-L/2-46,y:-48,w:L+120,d:96,r:8});
      const gx=L/2+20,R=22,dir={up:.5,down:-.5,flat:0,mixed:.15}[o.dir]??0;
      const t=k.radialTicks(gx,0,R-4,40,5,28,[1.5,3],P,-Math.PI*.6,Math.PI*1.2);
      add(depth([gx,0,0]),isoS(k.slabOf({x:gx-26,y:-22,w:52,d:44,r:4},0,22,P,4,.8),{tone:'mid'})+isoS(k.cylinder(gx,0,R,22,6,P,64,.6),{tone:'hi',crease:'lo'})+isoL(t.minor,{tone:'lo'})+isoL(t.major,{tone:'mid'})+isoL(k.lineOnTop([gx,0],[gx+Math.sin(dir)*(R-6),-Math.cos(dir)*(R-6)],28.2,P),{tone:'lit'})+isoKnob(sc,gx,0,28,3,2),n);
      for(const p of spots){const [a]=isoRim(p,[gx,0,0,0]);isoPipe(sc,a,[gx-26,p[1]*.2],{r:1.6});}return spots;},
  };
  // Draw a composed machine from its signature: {shape, n, mods:[name…], vars:[0|1…], az, opts}.
  function isoCompose(sig){
    const key='c'+JSON.stringify(sig);
    if(isoCache.has(key))return isoCache.get(key);
    isoStyle();
    // Fit the camera to a dry run of the layout so every bench fills its frame.
    const box=[],spots=ISO_LAYOUTS[sig.shape](isoProbe(box),sig.n,sig.opts||{});
    for(const [x,y,z,s] of spots)box.push([x-28*s,y-28*s,z],[x+28*s,y+28*s,z+72*s]);
    const sc=isoScene(sig.shape==='line'||sig.shape==='fade'||sig.shape==='rail'||sig.shape==='shelf'||sig.shape==='limit'||sig.shape==='study'?660:600,sig.shape==='rail'?320:400,box,{azimuth:sig.az});
    ISO_LAYOUTS[sig.shape](sc,sig.n,sig.opts||{}).forEach(([x,y,z,s0],i)=>{const s=s0*1.2;
      const st=ISO_STATIONS[sig.mods[i]]||ISO_STATIONS.tank,{svg}=st(sc,x,y,z,s,sig.vars[i]);
      sc.add(sc.depth([x,y,z]),`<path class="iso-halo" d="${isoK.haloOf({x:x-20*s,y:y-20*s,w:40*s,d:40*s,r:20*s},z,.1,sc.P)}" style="filter:blur(3px);opacity:.25"/>`+svg,i)});
    const out=sc.render(isoComposeLabel(sig));
    isoCache.set(key,out);return out;
  }
  // A layout dry run that only records where things go, to size the camera.
  function isoProbe(box){
    const P=isoK.fitProjection([[-1,-1,0],[1,1,1]],100,100,{});
    const rec=p=>{box.push(p);return 0;};
    return {P,at:p=>(rec(p),[0,0]),depth:p=>(rec(p),0),add:()=>{},tube:route=>route.forEach(rec)};
  }
  const ISO_STATION_WORDS={tank:'a tank',hopper:'a hopper',gears:'a pair of gears',piston:'a piston',spring:'a spring',drum:'a drum',lamp:'a lamp',gauge:'a gauge',crates:'a stack of crates',wheel:'a hand wheel',fan:'a fan',weights:'a stack of weights',lever:'a lever',bell:'a bell',flask:'a flask',sieve:'a sieve',cells:'a battery',press:'a press'};
  const ISO_SHAPE_WORDS={line:'in a line, a pipe carrying each on to the next',fade:'in a line, each smaller than the last',loop:'in a ring, the pipe running back to the start',limit:'in a line that ends at a gate',fork:'with one pipe splitting toward the others',pair:'on either side of a tilting beam',steps:'on steps that rise',shelf:'side by side on a shelf',hub:'around a dial that points at the first',web:'each tied to the others',rail:'clamped along a ruler',study:'in a row feeding a dial'};
  function isoComposeLabel(sig){
    const names=sig.mods.slice(0,sig.n).map(m=>ISO_STATION_WORDS[m]||m);
    return `A bench machine: ${names.slice(0,-1).join(', ')}${names.length>1?' and ':''}${names[names.length-1]}, set ${ISO_SHAPE_WORDS[sig.shape]||''}.`;
  }

  // ---------- The register ----------
  // Every picture asks for its machine by a stable key. A picture with a plan is drawn
  // from its own subject; otherwise the first picture of each kind gets the hand-built
  // machine and the rest get a composed one no other picture has.
  // isoKeysHook (set by idea-visual.js) lists the library's pictures in a fixed order
  // so the same picture always gets the same machine.
  let isoKeysHook=null;
  function isoSetKeys(hook){isoKeysHook=hook;isoToken=null;}
  const isoTaken=new Map(),isoExact=new Set(),isoSets=new Set(),isoUse=new Map(),isoFamilies=new Set();
  const ISO_HANDMADE={loop:'tank',capacity:'tank',decision:'balance',contrast:'balance',layers:'drawers',stack:'drawers',terms:'drawers',handoff:'conveyor',chain:'conveyor',cycle:'turntable',scale:'ruler',compass:'dial',release:'dial',stat:'dial',network:'pegboard',glance:'bench'};
  function isoHandmade(kind,n,o){
    const name=ISO_HANDMADE[kind],c=Math.max(2,Math.min(5,n));
    return {handoff:['conveyor',{n:3}],chain:['conveyor',{n:c}],loop:['tank',{}],capacity:['tank',{level:.86}],decision:['balance',{}],contrast:['balance',{}],layers:['drawers',{count:3,open:2}],stack:['drawers',{count:c,open:c-1}],terms:['drawers',{count:c,open:0}],cycle:['turntable',{n:c}],scale:['ruler',{marks:o.marks||[20,60,90]}],compass:['dial',{turn:.12}],release:['dial',{turn:.4,blocks:[7,12,18]}],stat:['dial',{turn:.3}],network:['pegboard',{}],glance:['bench',{groups:n,dir:o.dir||'flat'}]}[kind]||[name,{}];
  }
  function isoRandom(seed){let a=seed>>>0||1;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
  function isoSeed(text){let h=2166136261;for(const c of String(text)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function isoClaim(key,kind,n=3,o={}){
    if(isoTaken.has(key))return isoTaken.get(key);
    let sig;
    const family=ISO_HANDMADE[kind],shape=ISO_SHAPE[kind]||'web',count=shape==='pair'?2:shape==='rail'?Math.max(1,Math.min(5,(o.marks||[]).length||3)):Math.max(1,Math.min(5,n));
    // A picture plan draws the lesson's own subject (reader/iso-scenes.js). Two pictures
    // that name the same things in the same order turn the camera or swap a variant.
    const plan=o.scene&&shape!=='rail'&&kind!=='glance'?isoSceneOk(o.scene,count):null;
    if(plan)scan:for(let m=0;m<(1<<count);m++)for(const az of [45,-45]){
      const vars=plan.vars.map((v,i)=>v^((m>>i)&1)),exact='scene|'+plan.objects.join(',')+'|'+vars.join('')+'|'+az;
      if(!isoExact.has(exact)){isoExact.add(exact);sig={scene:{objects:plan.objects,link:plan.link,vars,az}};break scan;}
    }
    if(sig);
    else if(family&&!isoFamilies.has(family)){isoFamilies.add(family);const [name,opts]=isoHandmade(kind,n,o);sig={hand:name,opts};}
    else{
      const rnd=isoRandom(isoSeed(key));
      let best=null,bestScore=Infinity;
      for(let t=0;t<240;t++){
        const pool=[...ISO_STATION_NAMES],mods=[];
        for(let i=0;i<count;i++)mods.push(pool.splice(Math.floor(rnd()*pool.length),1)[0]);
        const vars=mods.map(()=>rnd()<.5?1:0),az=rnd()<.5?45:-45;
        const exact=shape+'|'+mods.join(',');
        if(isoExact.has(exact))continue;
        const set=[...mods].sort().join(',');
        let score=(isoSets.has(set)?50:0)+rnd()*.5;
        for(const m of mods)score+=(isoUse.get(m)||0);
        if(score<bestScore){bestScore=score;best={shape,n:count,mods,vars,az,opts:shape==='rail'?{marks:o.marks}:shape==='study'?{dir:o.dir}:{}};}
      }
      sig=best;
      isoExact.add(sig.shape+'|'+sig.mods.join(','));isoSets.add([...sig.mods].sort().join(','));
      for(const m of sig.mods)isoUse.set(m,(isoUse.get(m)||0)+1);
    }
    isoTaken.set(key,sig);return sig;
  }
  // The hook gives {token, keys}: when the token changes (a reading joined or left the
  // library) the register is rebuilt from the full list, in the same fixed order.
  let isoToken=null;
  function isoPick(key,kind,n=3,o={}){
    if(isoKeysHook){let t='';try{t=isoKeysHook.token();}catch{}
      if(t!==isoToken){isoResetPicks();isoToken=t;try{for(const [k2,kind2,n2,o2] of isoKeysHook.keys())isoClaim(k2,kind2,n2,o2);}catch{}}}
    const sig=isoClaim(key,kind,n,o);
    // A study's group count and result come from the article itself, not the register.
    if(kind==='glance')return sig.hand?isoMachine('bench',{groups:n,dir:o.dir||'flat'}):isoCompose({...sig,n:Math.min(n,sig.mods.length),mods:sig.mods.slice(0,n),vars:sig.vars.slice(0,n),opts:{dir:o.dir||'flat'}});
    return sig.scene?isoScenePicture(sig.scene):sig.hand?isoMachine(sig.hand,sig.opts):isoCompose(sig);
  }
  function isoResetPicks(){isoTaken.clear();isoExact.clear();isoSets.clear();isoUse.clear();isoFamilies.clear();}
