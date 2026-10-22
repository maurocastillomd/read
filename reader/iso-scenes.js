  // SCENES: pictures built from the lesson's own subject. Each object is a real thing
  // from the idea (a sealed jar of coins, a projector, a scoreboard), drawn with the
  // anatomy kit in the machine style. Same signature as a station: (sc,x,y,z,s,v) → {svg,top}.
  const isoFace=(sc,y,t)=>{const [,vy]=isoK.towardViewer(sc.P);return y+Math.sign(vy||1)*t/2;};
  const isoPoly=(sc,pts)=>isoK.pathOf(pts.map(p=>isoK.iso(p,sc.P)));
  // An upright board on two feet, face toward the viewer. Returns the board svg and a
  // face(u,h) helper mapping board coordinates (u across from centre, h up) to 3D.
  function isoBoard(sc,x,y,z,W,H,{T=2.6,lift=7,tone='mid',frame=0}={}){
    const {P}=sc,k=isoK,fy=isoFace(sc,y,T+frame*2);
    let o='';
    for(const fx of [x-W*.36,x+W*.36])o+=isoS(k.slabOf({x:fx-3,y:y-9,w:6,d:18,r:1.4},z,2.4,P,4,.3),{tone:'mid'})+isoS(k.slabOf({x:fx-1.2,y:y-1.2,w:2.4,d:2.4,r:.4},z+2.4,lift,P,2),{tone:'mid',crease:'none'});
    if(frame)o+=isoS(k.slabOf({x:x-W/2-frame,y:y-T/2-frame,w:W+frame*2,d:T+frame*2,r:.6},z+lift-frame,H+frame*2,P,3,.4),{tone});
    else o+=isoS(k.slabOf({x:x-W/2,y:y-T/2,w:W,d:T,r:.5},z+lift,H,P,3,.3),{tone});
    const face=(u,h)=>[x+u,fy+Math.sign(fy-y)*.05,z+lift+h];
    return {svg:o,face,top:z+lift+H};
  }
  const ISO_OBJECTS={
    // A rough sketch: a few loose, broken lines on a board.
    sketch(sc,x,y,z,s,v){
      const W=46*s,H=34*s,b=isoBoard(sc,x,y,z,W,H),f0=b.face,f=v?(u,h)=>f0(-u,h):f0;
      const hill=[[-.42,.18],[-.2,.55],[-.05,.32],[.14,.62],[.4,.2]].map(([u,h])=>f(u*W,h*H));
      let o=b.svg+isoL(isoPoly(sc,hill),{tone:'mid',dashed:true,free:true});
      o+=isoL(isoPoly(sc,Array.from({length:9},(_,i)=>{const a=i/8*Math.PI*1.3+.4;return f(W*.26+Math.cos(a)*W*.08,H*.78+Math.sin(a)*W*.08);})),{tone:'mid',dashed:true,free:true});
      o+=isoL(isoPoly(sc,[f(-W*.42,H*.12),f(W*.42,H*.12)]),{tone:'lo',dashed:true,free:true});
      return {svg:o,top:b.top};
    },
    // A jigsaw tray: most pieces placed, three filled in by the brain (lit).
    jigsaw(sc,x,y,z,s,v){
      const {P,at}=sc,k=isoK,C=13*s,G=1.4,N=3,L=N*C+(N-1)*G,x0=x-L/2,y0=y-L/2,lit=v?[1,5,6]:[2,4,7];
      let o=isoS(k.slabOf({x:x0-5,y:y0-5,w:L+10,d:L+10,r:2},z,4,P,4,.6),{tone:'mid'});
      for(let i=0;i<N*N;i++){const cx=x0+(i%N)*(C+G),cy=y0+Math.floor(i/N)*(C+G),on=lit.includes(i);
        o+=isoS(k.slabOf({x:cx,y:cy,w:C,d:C,r:1.2},z+4,on?3.4:2.2,P,3,.3),{tone:on?'hi':'mid',lit:on});
        if(i%N<N-1)o+=isoS(k.cylinder(cx+C+G/2,cy+C/2,2.2,z+4,on?3.4:2.2,P,14),{tone:on?'hi':'mid',lit:on,crease:'none'});
      }
      return {svg:o,top:z+8};
    },
    // A framed picture on a stand: finished, solid, taken as real.
    picture(sc,x,y,z,s,v){
      const W=44*s,H=34*s,b=isoBoard(sc,x,y,z,W,H,{frame:3.2,tone:'hi'}),f0=b.face,f=v?(u,h)=>f0(-u,h):f0;
      let o=b.svg+isoL(isoPoly(sc,[f(-W/2+3,3),f(W/2-3,3),f(W/2-3,H-3),f(-W/2+3,H-3),f(-W/2+3,3)]),{tone:'lo',free:true});
      o+=isoL(isoPoly(sc,[[-.42,.12],[-.2,.55],[-.05,.32],[.14,.62],[.42,.12]].map(([u,h])=>f(u*W,h*H))),{tone:'hi',free:true});
      o+=isoL(isoPoly(sc,Array.from({length:17},(_,i)=>{const a=i/16*Math.PI*2;return f(W*.26+Math.cos(a)*W*.07,H*.78+Math.sin(a)*W*.07);})),{tone:'lit',free:true});
      return {svg:o,top:b.top+3};
    },
    // A film projector whose lens is tinted: today's feeling colours the picture.
    projector(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,W=30*s,D=20*s,H=16*s,F=IsoL.frameAlong([x+W/2,y,z+6+H*.5],[1,0,0]);
      let o=isoS(k.slabOf({x:x-W/2,y:y-D/2,w:W,d:D,r:2},z+6,H,P,4,.6),{tone:'mid'});
      for(const [fx,fy] of k.corners({x:x-W/2,y:y-D/2,w:W,d:D},3))o+=isoS(k.cylinder(fx,fy,1.4,z,6,P,10),{tone:'mid',crease:'none'});
      for(const dx of v?[0]:[-W*.22,W*.22])o+=isoS(IsoL.lathe([[-1.6,0],[-1.6,(v?12:9)*s],[1.6,(v?12:9)*s],[1.6,0]],IsoL.frameAlong([x+dx,y,z+6+H+(v?12:9)*s],[0,1,0]),P,{rims:'all'}),{tone:'mid'})+isoL(isoK.sideRing([x+dx,y+1.7,z+6+H+(v?12:9)*s],2,'y',P,12),{tone:'lo'});
      o+=isoS(IsoL.lathe([[0,0],[0,5.6*s],[7*s,5.6*s],[7*s,6.6*s],[10*s,6.6*s],[10*s,0]],F,P,{rims:'all'}),{tone:'mid'});
      o+=isoS(IsoL.lathe([[10*s,0],[10*s,5.2*s],[10.6*s,5.2*s],[10.6*s,0]],F,P,{rims:'all'}),{tone:'hi',lit:true});
      return {svg:o,top:z+6+H+(v?24:18)*s,lens:[x+W/2+10.6*s,y,z+6+H*.5]};
    },
    // A screen on two poles showing the imagined event.
    screen(sc,x,y,z,s,v){
      const W=48*s,H=32*s,b=isoBoard(sc,x,y,z,W,H,{lift:14,T:1.6}),f0=b.face,f=v?(u,h)=>f0(-u,h):f0;
      let o=b.svg+isoL(isoPoly(sc,[f(-W/2+3,3),f(W/2-3,3),f(W/2-3,H-3),f(-W/2+3,H-3),f(-W/2+3,3)]),{tone:'lit',free:true});
      o+=isoL(isoPoly(sc,[[-.36,.18],[-.12,.6],[.06,.36],[.22,.52],[.38,.18]].map(([u,h])=>f(u*W,h*H))),{tone:'lit',free:true});
      return {svg:o,top:b.top};
    },
    // A desk calendar: the real day, with today marked.
    calendar(sc,x,y,z,s,v){
      const W=36*s,H=34*s,b=isoBoard(sc,x,y,z,W,H,{lift:4,T:4}),f=b.face;
      let o=b.svg+isoL(isoPoly(sc,[f(-W/2,H*.78),f(W/2,H*.78)]),{tone:'lo',free:true});
      for(const u of [-W*.25,W*.25])o+=isoL(isoK.sideRing(f(u,H+1.6),2.2,'y',sc.P,14),{tone:'hi'});
      const dots=[];for(let r=0;r<3;r++)for(let c=0;c<4;c++)dots.push(f(-W*.33+c*W*.22,H*.58-r*H*.2));
      o+=isoD(dots.map(p=>isoK.iso(p,sc.P)),{size:.9,tone:'mid'});
      o+=isoL(isoK.pathOf(Array.from({length:17},(_,i)=>{const a=i/16*Math.PI*2;return isoK.iso(f(-W*.33+W*.22*(v?3:1)+Math.cos(a)*3.4,H*.58-H*.2*(v?2:1)+Math.sin(a)*3.4),sc.P);}),true),{tone:'lit',free:true});
      return {svg:o,top:b.top+4};
    },
    // A glass jar of coins with its lid locked: effort already spent, not coming back.
    jar(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,R=15*s,H=30*s,[vx,vy]=k.towardViewer(P);
      let o='';
      for(const [dx,dy,n] of v?[[-4,-5,3],[5,-4,8],[0,5,5],[-7,3,6]]:[[-5,-4,7],[5,-3,5],[-1,5,8],[6,5,4],[-7,4,3]])for(let i=0;i<n;i++)o+=isoS(k.cylinder(x+dx*s,y+dy*s,4.4*s,z+2+i*2.6*s,2.6*s,P,20),{tone:'mid',crease:'none'});
      o+=isoS(IsoL.lathe([[0,0],[0,R*.92],[1.4,R],[H*.82,R],[H*.94,R*.7],[H,R*.7],[H,0]],IsoL.frameAlong([x,y,z],ISO_UP),P,{rims:'all'}),{tone:'hi',className:'iso-glass'});
      o+=isoS(k.cylinder(x,y,R*.78,z+H,4.4*s,P,40,.5),{tone:'mid'})+isoL(k.knurl(x,y,R*.78,z+H,z+H+4.4*s,36,P),{tone:'lo'});
      const T=z+H+4.4*s,r=R*.78;
      o+=isoL(k.lineOnTop([x-r,y],[x+r,y],T,P)+k.lineOnTop([x,y-r],[x,y+r],T,P),{tone:'lit'});
      o+=isoL(k.segment([x+Math.sign(vx)*r,y,T],[x+Math.sign(vx)*r,y,z+H-2*s],P)+k.segment([x,y+Math.sign(vy)*r,T],[x,y+Math.sign(vy)*r,z+H-2*s],P),{tone:'lit'});
      o+=isoS(k.cylinder(x,y,3.4*s,T,1.4,P,20,.3),{tone:'hi',lit:true});
      return {svg:o,top:z+H+4.4*s};
    },
    // Coins still in hand on a tray: what it would cost to go on.
    coins(sc,x,y,z,s,v){
      const {P}=sc,k=isoK;
      let o=isoS(k.slabOf({x:x-22*s,y:y-16*s,w:44*s,d:32*s,r:4},z,3,P,4,.6),{tone:'mid'});
      for(const [dx,dy,n] of v?[[-10,-4,2],[3,-5,3],[11,4,6],[-5,7,5]]:[[-11,-5,4],[2,-6,6],[12,3,2],[-4,7,3]])for(let i=0;i<n;i++)o+=isoS(k.cylinder(x+dx*s,y+dy*s,6*s,z+3+i*3*s,3*s,P,28,.3),{tone:'mid'})+(i===n-1?isoL(k.ring(x+dx*s,y+dy*s,3.6*s,z+3+(i+1)*3*s,P,24),{tone:'lo'}):'');
      return {svg:o,top:z+3+18*s};
    },
    // A seedling in a pot: what keeping on could still grow.
    seedling(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,H=20*s;
      let o=isoS(IsoL.lathe([[0,0],[0,10*s],[H*.82,13*s],[H*.82,14.4*s],[H,14.4*s],[H,0]],IsoL.frameAlong([x,y,z],ISO_UP),P,{rims:'all'}),{tone:'mid'});
      o+=isoS(k.cylinder(x,y,12.6*s,z+H-2.4,.1,P,40),{tone:'lo',flat:true});
      o+=isoS(k.cylinder(x,y,.9*s,z+H-2.4,20*s,P,10),{tone:'mid',crease:'none'});
      const leaf=(a,h,L)=>{const pts=Array.from({length:14},(_,i)=>{const t=i/13,w=Math.sin(t*Math.PI)*L*.32;return [t*L,w];}).concat(Array.from({length:12},(_,i)=>{const t=1-(i+1)/13,w=Math.sin(t*Math.PI)*L*.32;return [t*L,-w];}));
        return isoS(k.extrude(pts.map(([u,w])=>[x+Math.cos(a)*u-Math.sin(a)*w,y+Math.sin(a)*u+Math.cos(a)*w]),z+H-2.4+h,.8,P),{tone:'mid'});};
      o+=v?leaf(.6,8*s,18*s)+leaf(2.7,12*s,16*s)+leaf(4.6,16*s,13*s):leaf(-.4,9*s,20*s)+leaf(2.6,14*s,17*s);
      o+=isoS(IsoL.sphereOf([x,y,z+H-2.4+21.6*s],3.4*s,P),{tone:'hi',lit:true});
      return {svg:o,top:z+H+22*s};
    },
    // A scoreboard of tally marks: every favour and offence counted.
    scoreboard(sc,x,y,z,s,v){
      const W=50*s,H=32*s,b=isoBoard(sc,x,y,z,W,H,{lift:10}),f=b.face;
      let o=b.svg+isoL(isoPoly(sc,[f(0,3),f(0,H-3)]),{tone:'lo',free:true})+isoL(isoPoly(sc,[f(-W/2+3,H*.8),f(W/2-3,H*.8)]),{tone:'lo',free:true});
      const tally=(u0,n,lit)=>{let d='';for(let i=0;i<n;i++){const g=Math.floor(i/5),j=i%5,u=u0+g*W*.2+j*W*.032;if(j<4)d+=isoPoly(sc,[f(u,H*.22),f(u,H*.6)]);else d+=isoPoly(sc,[f(u-W*.14,H*.26),f(u+W*.012,H*.56)]);}return isoL(d,{tone:lit?'lit':'hi',free:true});};
      o+=v?tally(-W*.42,6,true)+tally(W*.06,10,false):tally(-W*.42,9,false)+tally(W*.06,7,true);
      return {svg:o,top:b.top};
    },
    // A gift box with a ribbon: what you appreciate.
    gift(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,A=(v?30:24)*s,H=(v?11:17)*s,L=5*s;
      let o=isoS(k.slabOf({x:x-A/2,y:y-A/2,w:A,d:A,r:1},z,H,P,3,.4),{tone:'mid'})+isoS(k.slabOf({x:x-A/2-1.4,y:y-A/2-1.4,w:A+2.8,d:A+2.8,r:1},z+H,L,P,3,.4),{tone:'mid'});
      const T=z+H+L,[vx,vy]=k.towardViewer(P);
      o+=isoL(k.lineOnTop([x-A/2-1.4,y],[x+A/2+1.4,y],T,P)+k.lineOnTop([x,y-A/2-1.4],[x,y+A/2+1.4],T,P),{tone:'lit'});
      o+=isoL(k.segment([x+Math.sign(vx)*(A/2+1.4),y,T],[x+Math.sign(vx)*(A/2+1.4),y,T-L],P)+k.segment([x+Math.sign(vx)*A/2,y,z+H],[x+Math.sign(vx)*A/2,y,z],P)+k.segment([x,y+Math.sign(vy)*(A/2+1.4),T],[x,y+Math.sign(vy)*(A/2+1.4),T-L],P)+k.segment([x,y+Math.sign(vy)*A/2,z+H],[x,y+Math.sign(vy)*A/2,z],P),{tone:'lit'});
      for(const a of [.8,3.94])o+=isoS(IsoL.ringBand(-.8*s,.8*s,2*s,3.6*s,IsoL.frameAlong([x+Math.cos(a)*4*s,y+Math.sin(a)*4*s,T+3.2*s],[Math.cos(a+1.57),Math.sin(a+1.57),0]),P,{hole:[.8*s,2*s]}),{tone:'hi',lit:true});
      return {svg:o,top:T+8*s};
    },
    // Two chairs at a small table: the relationship that carries the weight over years.
    chairs(sc,x,y,z,s,v){
      const {P}=sc,k=isoK;
      let o=isoS(k.cylinder(x,y,7*s,z,1.6,P,28,.3),{tone:'mid'})+isoS(k.cylinder(x,y,1.3*s,z+1.6,18*s,P,10),{tone:'mid',crease:'none'})+isoS(k.cylinder(x,y,11*s,z+1.6+18*s,2,P,40,.4),{tone:'hi'});
      for(const side of [-1,1]){const cx=x+side*(v&&side>0?27:22)*s,S=13*s,seat=11*s;
        let c='';for(const [lx,ly] of k.corners({x:cx-S/2,y:y-S/2,w:S,d:S},1.6))c+=isoS(k.cylinder(lx,ly,.9,z,seat,P,8),{tone:'mid',crease:'none'});
        c+=isoS(k.slabOf({x:cx-S/2,y:y-S/2,w:S,d:S,r:1},z+seat,2.2,P,3,.3),{tone:'mid'});
        const bx=side>0?cx+S/2-2:cx-S/2;c+=isoS(k.slabOf({x:bx,y:y-S/2,w:2,d:S,r:.5},z+seat+2.2,14*s,P,2,.3),{tone:'mid'});
        o=side*k.towardViewer(P)[0]>0?o+c:c+o;}
      return {svg:o,top:z+26*s};
    },
    // Scissors on a cutting mat, a strip of paper cut through: an edit, a cut.
    scissors(sc,x,y,z,s,v){
      const {P}=sc,k=isoK,M=3,x0=x+4*s,open=v?.07:.32;
      let o=isoS(k.slabOf({x:x-26*s,y:y-16*s,w:52*s,d:32*s,r:3},z,M,P,4,.5),{tone:'mid'});
      const pw=7*s,gap=v?3*s:0,px=x0+18*s;
      o+=isoS(k.slabOf({x:px-pw-gap/2-8*s,y:y-11*s,w:8*s+pw,d:22*s,r:.6},z+M,.8,P,2,.2),{tone:'hi'});
      o+=isoS(k.slabOf({x:px+gap/2,y:y-11*s,w:pw,d:22*s,r:.6},z+M,.8,P,2,.2),{tone:'hi',lit:true});
      const rot=(a,pts)=>pts.map(([t,w])=>[x0+Math.cos(a)*t-Math.sin(a)*w,y+Math.sin(a)*t+Math.cos(a)*w]);
      [[open,z+M+1],[-open,z+M+1.9]].forEach(([a,h],i)=>{
        o+=isoS(k.extrude(rot(a,[[-2*s,-1.6*s],[22*s,-.5*s],[24*s,0],[22*s,.6*s],[-2*s,1.6*s]]),h,.8,P),{tone:'mid'});
        o+=isoS(k.extrude(rot(a+Math.PI,[[0,-1.1*s],[8*s,-1.1*s],[8*s,1.1*s],[0,1.1*s]]),h,.8,P),{tone:'mid'});
        const c=rot(a+Math.PI,[[12.4*s,0]])[0];
        o+=isoS(IsoL.ringBand(0,.9,3.2*s,5.2*s,IsoL.frameAlong([c[0],c[1],h],[0,0,1]),P,{hole:[.9,3.2*s]}),{tone:'mid'});});
      o+=isoS(k.cylinder(x0,y,1.6*s,z+M+2.7,.8,P,16,.3),{tone:'hi'});
      return {svg:o,top:z+M+6};
    },
  };
  const ISO_OBJECT_WORDS={sketch:'a rough sketch on a board',jigsaw:'a jigsaw with three pieces filled in',picture:'a framed picture',projector:'a projector with a tinted lens',screen:'a screen',calendar:'a desk calendar with today marked',jar:'a locked jar of coins',coins:'a tray of coins',seedling:'a seedling in a pot',scoreboard:'a scoreboard of tally marks',gift:'a gift box',chairs:'two chairs at a small table',scissors:'a pair of scissors cutting a strip of paper'};
    // Batch A: notes, lenses, doors, reels, hourglasses, cages, targets, tools, cups,
    // books, signposts, thermometers, stepping stones, umbrellas, a boulder.
    // A frame whose axis points at the viewer along y, so its front face is always seen.
    function isoAFront(sc,x,y,z){const [,vy]=isoK.towardViewer(sc.P);return IsoL.frameAlong([x,y,z],[0,Math.sign(vy||1),0]);}
    // An upright panel in the x-z plane: pts are [dx,dz] offsets, T its thickness.
    function isoAPanel(sc,x,y,z,pts,T,style){const F=isoAFront(sc,x,y,z);return isoS(IsoL.prismOf(F,pts.map(([dx,dz])=>[dx*F.u[0],dz]),-T/2,T/2,sc.P),style);}
    // An upright panel in the y-z plane, front face toward +x (seen at both azimuths).
    function isoAPanelX(sc,x,y,z,pts,T,style){const F=IsoL.frameAlong([x,y,z],[1,0,0]);return isoS(IsoL.prismOf(F,pts.map(([dy,dz])=>[dy*F.u[1]+dz*F.u[2],dy*F.v[1]+dz*F.v[2]]),-T/2,T/2,sc.P),style);}
    // A disc standing upright, facing the viewer: thickness T, radius R.
    function isoADisc(sc,x,y,z,R,T,style,opts={}){const F=isoAFront(sc,x,y,z);return {F,svg:isoS(IsoL.lathe([[-T/2,0],[-T/2,R],[T/2,R],[T/2,0]],F,sc.P,{rims:'all',...opts}),style)};}
    function isoATube(sc,route,r,tone='hi'){const ps=isoTubePieces(route,r,sc.P,{maxLength:12});ps.sort((a,b)=>isoK.depthOf(a.mid,sc.P)-isoK.depthOf(b.mid,sc.P));return ps.map(p=>isoTubeSvg(p,{tone})).join('');}
    const isoAView=sc=>{const [vx,vy]=isoK.towardViewer(sc.P);return {vx,vy,sy:Math.sign(vy||1)};};
    Object.assign(ISO_OBJECTS,{
      // A card on a little stand, a few lines of writing, one underlined.
      note(sc,x,y,z,s,v){
        const {P}=sc,k=isoK;
        if(v){const W=34*s,D=24*s;
          let o=isoS(k.slabOf({x:x-W/2,y:y-D/2,w:W,d:D,r:.8},z,.9,P,3,.2),{tone:'mid'});
          o+=isoS(k.slabOf({x:x-W/2,y:y-D/2,w:W,d:D*.42,r:.8},z+.9,1.4,P,3,.2),{tone:'mid'});
          o+=isoL([0,1,2].map(i=>k.lineOnTop([x-W/2+4*s,y+D*.02+i*3.6*s],[x+W/2-(6+i*4)*s,y+D*.02+i*3.6*s],.9+.05,P)).join(''),{tone:'lo'});
          o+=isoL(k.lineOnTop([x-W/2+4*s,y+D*.02+3*3.6*s],[x-2*s,y+D*.02+3*3.6*s],.95,P),{tone:'lit'});
          return {svg:o,top:z+3};}
        const W=30*s,H=22*s,b=isoBoard(sc,x,y,z,W,H,{lift:5,T:1.8}),f=b.face;
        let o=b.svg+isoL([.78,.6,.42].map((h,i)=>isoPoly(sc,[f(-W*.36,H*h),f(W*(.36-i*.08),H*h)])).join(''),{tone:'mid',free:true});
        o+=isoL(isoPoly(sc,[f(-W*.36,H*.2),f(W*.05,H*.2)]),{tone:'lit',free:true});
        return {svg:o,top:b.top};
      },
      // A magnifying glass standing on its handle, the lens tinted.
      magnifier(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,R=10*s;
        if(v){const W=40*s,D=30*s,cx=x-5*s;
          let o=isoS(k.slabOf({x:x-W/2,y:y-D/2,w:W,d:D,r:.8},z,.9,P,3,.2),{tone:'mid'});
          o+=isoL([0,1,2,3,4].map(i=>k.lineOnTop([x-W/2+4*s,y-D/2+5*s+i*4.6*s],[x+W/2-(4+(i%2)*8)*s,y-D/2+5*s+i*4.6*s],.95,P)).join(''),{tone:'lo'});
          const F=IsoL.frameAlong([x+R*.9,y,z+2.4*s],[1,0,0]);
          o+=isoS(IsoL.lathe([[0,0],[0,1.8*s],[16*s,1.8*s],[16*s,0]],F,P,{rims:'all'}),{tone:'mid'});
          o+=isoS(k.cylinder(cx,y,R*.82,z+1,.4,P,40),{tone:'hi',lit:true,crease:'none'});
          o+=isoS(IsoL.ringBand(0,2.6*s,R*.82,R,IsoL.frameAlong([cx,y,z+1],ISO_UP),P),{tone:'hi'});
          return {svg:o,top:z+4*s};}
        const C=z+3*s+9*s+R;
        let o=isoS(k.cylinder(x,y,9*s,z,3*s,P,36,.5),{tone:'mid'})+isoS(k.cylinder(x,y,1.9*s,z+3*s,9*s,P,14),{tone:'mid',crease:'none'})+isoS(k.cylinder(x,y,2.8*s,z+3*s+6*s,3.4*s,P,16,.3),{tone:'mid'});
        const g=isoADisc(sc,x,y,C,R*.8,.6*s,{tone:'hi',lit:true});
        o+=g.svg+isoS(IsoL.ringBand(-1.8*s,1.8*s,R*.78,R,g.F,P),{tone:'hi'});
        o+=isoL(isoPoly(sc,Array.from({length:7},(_,i)=>IsoL.pointOf(g.F,.7*s,R*.52,1.4+i*.17))),{tone:'lit',free:true});
        return {svg:o,top:C+R};
      },
      // A free-standing door frame, the door swung open and light spilling through.
      door(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sy}=isoAView(sc),W=21*s,H=29*s,T=3*s;
        let o=isoS(k.slabOf({x:x-W/2-4*s,y:y-6*s,w:W+8*s,d:12*s,r:1},z,1.6,P,3,.3),{tone:'mid'});
        const post=px=>isoS(k.slabOf({x:px-1.6*s,y:y-T/2,w:3.2*s,d:T,r:.4},z+1.6,H,P,2,.2),{tone:'mid'});
        const lintel=isoS(k.slabOf({x:x-W/2-1.6*s,y:y-T/2,w:W+3.2*s,d:T,r:.4},z+1.6+H,3*s,P,2,.2),{tone:'mid'});
        if(v){
          o+=post(x-W/2)+post(x+W/2)+lintel;
          o+=isoAPanel(sc,x,y,z+1.6,[[-W/2+.4,0],[W/2-.4,0],[W/2-.4,H],[-W/2+.4,H]],1.4*s,{tone:'mid'});
          const F=isoAFront(sc,x,y,z),fy=y+sy*(.7*s+.05),f=(dx,dz)=>[x+dx,fy,z+1.6+dz];
          o+=isoL(isoPoly(sc,[f(-W/2+3*s,4*s),f(W/2-3*s,4*s),f(W/2-3*s,H*.46),f(-W/2+3*s,H*.46),f(-W/2+3*s,4*s)])+isoPoly(sc,[f(-W/2+3*s,H*.54),f(W/2-3*s,H*.54),f(W/2-3*s,H-3*s),f(-W/2+3*s,H-3*s),f(-W/2+3*s,H*.54)]),{tone:'lo',free:true});
          o+=isoL(isoK.pathOf(Array.from({length:13},(_,i)=>{const a=i/12*Math.PI*2;return isoK.iso(f(W/2-5*s+Math.cos(a)*1.4*s,H*.5+1.4*s+Math.sin(a)*1.4*s),P);}),true)+isoPoly(sc,[f(W/2-5.6*s,H*.5),f(W/2-5*s,H*.5-3.6*s),f(W/2-4.4*s,H*.5)]),{tone:'lit',free:true});
          return {svg:o,top:z+H+6*s};}
        // light on the floor through the opening, toward the viewer
        const g=[[x-W/2+2*s,y],[x+W/2,y],[x+W/2+7*s,y+sy*22*s],[x-W/2+8*s,y+sy*22*s]];
        o+=isoS(k.extrude(g,z+1.6,.15,P),{tone:'lit',lit:true,crease:'none'});
        o+=isoL(isoK.pathOf(g.map(([a,b])=>isoK.iso([a,b,z+1.7],P)),true),{tone:'lit',dashed:true});
        const hx=x-W/2+1.6*s,a=1.05,dx=Math.cos(a),dy=sy*Math.sin(a),nx=-dy,ny=dx,Wd=W-1.6*s,t=1.5*s;
        const leaf=[[hx,y],[hx+dx*Wd,y+dy*Wd],[hx+dx*Wd+nx*t,y+dy*Wd+ny*t],[hx+nx*t,y+ny*t]];
        o+=post(x+W/2)+lintel+post(x-W/2);
        o+=isoS(k.extrude(leaf,z+1.6,H-.4,P),{tone:'mid'});
        const kx=hx+dx*(Wd-3*s),ky=y+dy*(Wd-3*s);o+=isoD([isoK.iso([kx+nx*t*1.4,ky+ny*t*1.4,z+1.6+H*.5],P)],{size:1.3,tone:'hi'});
        return {svg:o,top:z+H+6*s};
      },
      // A film reel on a stand, a strip running off it across the bench.
      reel(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sy}=isoAView(sc);
        const one=(cx,R,h,strip)=>{let o=isoS(k.slabOf({x:cx-6*s,y:y-7*s,w:12*s,d:14*s,r:1.4},z,2.4*s,P,4,.4),{tone:'mid'})+isoS(k.slabOf({x:cx-1.2*s,y:y-1.2*s,w:2.4*s,d:2.4*s,r:.4},z+2.4*s,h-2.4*s,P,2),{tone:'mid',crease:'none'});
          const d=isoADisc(sc,cx,y,z+h,R,2.6*s,{tone:'mid'}),F=d.F;o+=d.svg;
          const face=1.3*s+.05;o+=isoL(IsoL.circleOf(F,face,R*.86,P)+IsoL.circleOf(F,face,R*.22,P),{tone:'lo'});
          o+=isoL([0,1,2,3,4].map(i=>{const c=IsoL.pointOf(F,face,R*.54,i/5*Math.PI*2+.3);return isoK.pathOf(Array.from({length:14},(_,j)=>isoK.iso(IsoL.pointOf({...F,o:c},0,R*.18,j/14*Math.PI*2),P)),true);}).join(''),{tone:'mid'});
          o+=isoD([isoK.iso(IsoL.pointOf(F,face,0,0),P)],{size:1,tone:'hi'});
          return o;};
        if(v){const R=11*s,h=14*s;let o=one(x-12*s,R,h)+one(x+12*s,R,h);
          o+=isoL(isoPoly(sc,[[x-12*s,y+sy*1.4*s,z+h-R],[x+12*s,y+sy*1.4*s,z+h-R]])+isoPoly(sc,[[x-12*s,y+sy*1.4*s,z+h+R],[x+12*s,y+sy*1.4*s,z+h+R]]),{tone:'lit'});
          return {svg:o,top:z+h+R};}
        const R=16*s,h=19*s;
        const strip=Array.from({length:16},(_,i)=>{const t=i/15;return [x+R*.7+t*14*s,y+sy*(2*s+Math.sin(t*Math.PI)*12*s),z+Math.max(.3,(h-R*.7)*(1-t)*(1-t))+.3];});
        let o=isoL(isoPoly(sc,strip)+isoPoly(sc,strip.map(([a,b,c])=>[a-1.6*s,b+sy*2.6*s,c])),{tone:'lit'});
        o=one(x-3*s,R,h)+o;
        return {svg:o,top:z+h+R};
      },
      // An hourglass in its frame, sand running through.
      hourglass(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,R=9*s,H=28*s,F=IsoL.frameAlong([x,y,z+3*s],ISO_UP),cap=3*s;
        let o=isoS(k.cylinder(x,y,R+3*s,z,cap,P,36,.5),{tone:'mid'});
        const posts=[0,1,2].map(i=>{const a=i*2.094+.6;return [x+Math.cos(a)*(R+1.4*s),y+Math.sin(a)*(R+1.4*s)];});
        const back=posts.filter(([px,py])=>isoK.depthOf([px,py,0],P)<isoK.depthOf([x,y,0],P)),front=posts.filter(p=>!back.includes(p));
        const postSvg=([px,py])=>isoS(k.cylinder(px,py,1.1*s,z+cap,H,P,10),{tone:'mid',crease:'none'});
        o+=back.map(postSvg).join('');
        const lo=v?.62:.32,hi=v?.08:.36;
        o+=isoS(IsoL.lathe([[0,0],[0,R*.9],[H*.5*lo,R*.9*(1-lo*.6)],[H*.5*lo+H*.08,0]],F,P,{rims:'all'}),{tone:'hi',lit:true});
        if(hi>.1)o+=isoS(IsoL.lathe([[H*(.5+.06),0],[H*.5+H*.5*(1-hi)*.2,R*.22],[H*(.5+.4*hi),R*.7*hi+R*.2],[H*(.5+.42*hi),0]],F,P,{rims:'all'}),{tone:'hi',lit:true});
        if(!v)o+=isoL(isoPoly(sc,[[x,y,z+3*s+H*.5],[x,y,z+3*s+H*.5*lo+H*.08]]),{tone:'lit'});
        o+=isoS(IsoL.lathe([[0,0],[0,R],[H*.12,R*.98],[H*.44,R*.22],[H*.5,R*.12],[H*.56,R*.22],[H*.88,R*.98],[H,R],[H,0]],F,P,{rims:'all'}),{tone:'hi',className:'iso-glass'});
        o+=front.map(postSvg).join('');
        o+=isoS(k.cylinder(x,y,R+3*s,z+cap+H,cap,P,36,.5),{tone:'mid'});
        return {svg:o,top:z+2*cap+H};
      },
      // A round birdcage, its little door swung open.
      cage(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,R=14*s,H=17*s,b=z+4*s,N=16,{vx,vy}=isoAView(sc),fa=Math.atan2(vy,vx);
        let o=isoS(k.cylinder(x,y,R+2.4*s,z,4*s,P,48,.6),{tone:'mid'});
        const door=i=>{const a=i/N*Math.PI*2;let d=Math.abs(((a-fa+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI);return d<Math.PI/N*1.6;};
        const bars=Array.from({length:N},(_,i)=>{const a=i/N*Math.PI*2;return {a,p:[x+Math.cos(a)*R,y+Math.sin(a)*R],d:isoK.depthOf([x+Math.cos(a)*R,y+Math.sin(a)*R,0],P),door:door(i)};}).sort((p,q)=>p.d-q.d);
        const dome=a=>Array.from({length:10},(_,j)=>{const t=j/9*Math.PI/2;return [x+Math.cos(a)*R*Math.cos(t),y+Math.sin(a)*R*Math.cos(t),b+H+R*.7*Math.sin(t)];});
        const mid=isoK.depthOf([x,y,0],P);
        for(const q of bars){if(q.d>mid)break;o+=isoL(isoPoly(sc,[[...q.p,b],[...q.p,b+H]])+isoPoly(sc,dome(q.a)),{tone:'mid'});}
        o+=isoL(isoK.ring(x,y,R,b+H,P,48)+isoK.ring(x,y,R,b+H*.08,P,48),{tone:'hi'});
        for(const q of bars){if(q.d<=mid)continue;const gap=!v&&q.door;o+=isoL((gap?isoPoly(sc,[[...q.p,b+H*.62],[...q.p,b+H]]):isoPoly(sc,[[...q.p,b],[...q.p,b+H]]))+isoPoly(sc,dome(q.a)),{tone:'hi'});}
        o+=isoS(k.cylinder(x,y,2*s,b+H+R*.7,2.4*s,P,14,.3),{tone:'mid'})+isoL(isoK.sideRing([x,y,b+H+R*.7+4.4*s],2*s,'x',P,16),{tone:'hi'});
        const da=Math.PI/N*1.6,p0=[x+Math.cos(fa-da)*R,y+Math.sin(fa-da)*R],p1=[x+Math.cos(fa+da)*R,y+Math.sin(fa+da)*R];
        if(v){o+=isoL(isoPoly(sc,[[...p0,b+H*.12],[...p1,b+H*.12],[...p1,b+H*.62],[...p0,b+H*.62],[...p0,b+H*.12]]),{tone:'lit'});}
        else{const hx=p0,w=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]),ang=Math.atan2(p1[1]-p0[1],p1[0]-p0[0])-1.5*Math.sign(vy||1)*-1,e=[hx[0]+Math.cos(ang)*w,hx[1]+Math.sin(ang)*w];
          o+=isoL(isoPoly(sc,[[...p0,b+H*.08],[...p1,b+H*.08],[...p1,b+H*.62],[...p0,b+H*.62],[...p0,b+H*.08]]),{tone:'lit'});
          o+=isoL(isoPoly(sc,[[...hx,b+H*.12],[...e,b+H*.12],[...e,b+H*.58],[...hx,b+H*.58]])+[.33,.66].map(t=>isoPoly(sc,[[hx[0]+(e[0]-hx[0])*t,hx[1]+(e[1]-hx[1])*t,b+H*.12],[hx[0]+(e[0]-hx[0])*t,hx[1]+(e[1]-hx[1])*t,b+H*.58]])).join(''),{tone:'hi'});}
        return {svg:o,top:b+H+R*.7+6.4*s};
      },
      // An archery target on an easel, an arrow in it.
      target(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sy}=isoAView(sc),R=16*s,C=z+R+4*s;
        let o='';
        for(const dx of [-R*.55,R*.55])o+=isoS(k.slabOf({x:x+dx-1.4*s,y:y-sy*7*s-1.4*s,w:2.8*s,d:2.8*s,r:.4},z,C+R*.4-z,P,2),{tone:'mid',crease:'none'});
        o+=isoS(k.slabOf({x:x-R*.7,y:y-1.6*s,w:R*1.4,d:3.2*s,r:.4},z,3*s,P,2),{tone:'mid'});
        const d=isoADisc(sc,x,y,C,R,5*s,{tone:'mid'}),F=d.F,f=2.5*s+.05;o+=d.svg;
        o+=isoL([.8,.6,.4,.2].map(r=>IsoL.circleOf(F,f,R*r,P)).join(''),{tone:'mid'});
        const hit=v?[R*.42,R*.3]:[0,0],at=[x+hit[0],y+sy*f,C+hit[1]],tail=[at[0]-6*s,at[1]+sy*16*s,at[2]+5*s];
        o+=isoL(isoPoly(sc,[at,tail]),{tone:'lit'});
        for(const q of [[2.2,1.6],[-2.2,1.6],[0,3]])o+=isoL(isoPoly(sc,[[tail[0]+(at[0]-tail[0])*.12,tail[1]+(at[1]-tail[1])*.12,tail[2]+(at[2]-tail[2])*.12],[tail[0]+q[0]*s*.6,tail[1],tail[2]+q[1]*s*.6]]),{tone:'lit'});
        o+=isoD([isoK.iso(at,P)],{size:1.2,tone:'hi'});
        return {svg:o,top:C+R};
      },
      // A toolbox, open, a wrench laid across it.
      toolbox(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,W=34*s,D=18*s,H=13*s,PL={x:x-W/2,y:y-D/2,w:W,d:D,r:1.4};
        let o=isoS(k.slabOf(PL,z,H,P,4,.6),{tone:'mid'})+isoL(k.sideSeam(PL,H*.32,P,4),{tone:'lo'});
        const handle=(zt,lit)=>{const hb=[[x-W*.3,y,zt],[x-W*.3,y,zt+6*s],[x+W*.3,y,zt+6*s],[x+W*.3,y,zt]];return isoATube(sc,hb,1.3*s,lit?'lit':'hi');};
        if(v){o+=isoS(k.slabOf(k.insetPlan(PL,-1),z+H,3.4*s,P,4,.6),{tone:'mid'});o+=isoS(k.slabOf({x:x-3*s,y:y-D/2-1.6,w:6*s,d:2,r:.4},z+H-3*s,4.6*s,P,2),{tone:'hi'});
          const hb=[[x-W*.3,y,z+H+3.4*s],[x-W*.3,y,z+H+9*s],[x+W*.3,y,z+H+9*s],[x+W*.3,y,z+H+3.4*s]];
          o+=isoS(isoK.slabOf({x:x-W*.3-1.4*s,y:y-1.4*s,w:2.8*s,d:2.8*s,r:.6},z+H+3.4*s,5.6*s,P,2),{tone:'mid'})+isoS(isoK.slabOf({x:x+W*.3-1.4*s,y:y-1.4*s,w:2.8*s,d:2.8*s,r:.6},z+H+3.4*s,5.6*s,P,2),{tone:'mid'})+isoS(isoK.slabOf({x:x-W*.3-1.4*s,y:y-1.4*s,w:W*.6+2.8*s,d:2.8*s,r:.6},z+H+9*s,2.4*s,P,2),{tone:'hi',lit:true});
          return {svg:o,top:z+H+12*s};}
        o+=isoS(k.slabOf(k.insetPlan(PL,1.6*s),z+H-.1,.1,P,4),{tone:'lo',flat:true});
        for(const dx of [-W*.3,W*.3])o+=isoS(k.slabOf({x:x+dx-1.2*s,y:y-1.2*s,w:2.4*s,d:2.4*s,r:.4},z+H,7*s,P,2),{tone:'mid'});
        o+=isoS(k.slabOf({x:x-W*.3-1.2*s,y:y-1.2*s,w:W*.6+2.4*s,d:2.4*s,r:.5},z+H+7*s,2*s,P,2),{tone:'mid'});
        // the wrench, lying on the handle bar side of the lid edge
        const wy=y+D*.28,ring=(cx,r)=>Array.from({length:18},(_,i)=>{const a=i/18*Math.PI*2;return [cx+Math.cos(a)*r,wy+Math.sin(a)*r];});
        const L=26*s;o+=isoS(k.slabOf({x:x-L/2,y:wy-1.6*s,w:L,d:3.2*s,r:1},z+H+.3,1.4*s,P,3,.3),{tone:'hi',lit:true});
        o+=isoS(k.extrude(ring(x+L/2,4*s),z+H+.3,1.4*s,P),{tone:'hi',lit:true})+isoS(k.extrude(ring(x-L/2,3.6*s),z+H+.3,1.4*s,P),{tone:'hi',lit:true});
        o+=isoS(k.extrude(ring(x+L/2+2*s,2*s),z+H+1.7*s,.1,P),{tone:'lo',flat:true})+isoS(k.extrude(ring(x-L/2,1.6*s),z+H+1.7*s,.1,P),{tone:'lo',flat:true});
        return {svg:o,top:z+H+9*s};
      },
      // A mug with steam; or cracked, cold and empty.
      cup(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{vx,vy}=isoAView(sc),R=11*s,H=20*s,F=IsoL.frameAlong([x,y,z],ISO_UP);
        let o=isoS(k.cylinder(x,y,R*1.5,z,1.4,P,40,.3),{tone:'lo'});
        const handle=isoATube(sc,Array.from({length:13},(_,i)=>{const a=-Math.PI/2+i/12*Math.PI;return [x+R+Math.cos(a)*6*s-1*s,y,z+H*.5+Math.sin(a)*6*s];}),1.6*s,'hi');
        o+=isoS(IsoL.lathe([[0,0],[0,R*.92],[1.2*s,R],[H,R],[H,R*.86],[H*.9,R*.86],[H*.9,0]],F,P,{rims:'all'}),{tone:'hi'});
        o+=handle;
        if(!v){o+=isoS(k.cylinder(x,y,R*.86,z+H*.8,.1,P,40),{tone:'lo',flat:true});
          for(const [dx,ph] of [[-4,0],[0,1.6],[4,3]])o+=isoL(isoPoly(sc,Array.from({length:12},(_,i)=>[x+dx*s+Math.sin(i/11*Math.PI*2+ph)*1.6*s,y,z+H+3*s+i*1.3*s])),{tone:'lit'});
          return {svg:o,top:z+H+18*s};}
        const fx=x+vx*R*1.01,fy=y+vy*R*1.01,tx=-vy,ty=vx;
        o+=isoL(isoPoly(sc,[[0,H],[1.6,H*.78],[-1.2,H*.6],[1.4,H*.44],[-.4,H*.3]].map(([t,h])=>[fx+tx*t*s,fy+ty*t*s,z+h])),{tone:'lit'});
        return {svg:o,top:z+H};
      },
      // An open book with a ribbon marker; or a little stack of closed books.
      book(sc,x,y,z,s,v){
        const {P}=sc,k=isoK;
        if(v){let o='',zz=z;const books=[[36,24,6,.0,'mid'],[32,22,5,.12,'mid'],[28,20,5,-.1,'hi']];
          for(const [w,d,h,a,t] of books){const W=w*s,D=d*s,c=Math.cos(a),sn=Math.sin(a),pts=[[-W/2,-D/2],[W/2,-D/2],[W/2,D/2],[-W/2,D/2]].map(([px,py])=>[x+px*c-py*sn,y+px*sn+py*c]);
            o+=isoS(k.extrude(pts,zz,h*s,P),{tone:t});zz+=h*s;}
          const last=books[2],W=last[0]*s,D=last[1]*s,a=last[3];
          const bx=x+(W*.15)*Math.cos(a),by=y+(W*.15)*Math.sin(a);
          o+=isoS(k.slabOf({x:bx-1.4*s,y:by-D/2-5*s,w:2.8*s,d:7*s,r:.3},zz-1.4*s,1.4*s+.4,P,2),{tone:'hi',lit:true});
          return {svg:o,top:zz};}
        const W=22*s,D=30*s;
        let o=isoS(k.slabOf({x:x-W-1.4*s,y:y-D/2-1.4*s,w:2*W+2.8*s,d:D+2.8*s,r:1.2},z,1.6*s,P,3,.3),{tone:'mid'});
        const page=(px,dir)=>{const ring=[];for(let i=0;i<=10;i++){const t=i/10;ring.push([px+dir*t*W,y-D/2,0]);}
          return isoS(k.slabOf({x:dir>0?px:px-W,y:y-D/2,w:W,d:D,r:.6},z+1.6*s,2.6*s,P,3,.4),{tone:'hi'});};
        o+=page(x,-1)+page(x,1);
        const T=z+1.6*s+2.6*s+.05;
        o+=isoL([0,1,2,3,4,5].map(i=>k.lineOnTop([x-W+4*s,y-D/2+5*s+i*4*s],[x-3*s-(i%3)*2*s,y-D/2+5*s+i*4*s],T,P)+k.lineOnTop([x+3*s,y-D/2+5*s+i*4*s],[x+W-4*s-(i%2)*4*s,y-D/2+5*s+i*4*s],T,P)).join(''),{tone:'lo'});
        o+=isoL(k.lineOnTop([x,y-D/2],[x,y+D/2],T,P),{tone:'mid'});
        o+=isoL(isoPoly(sc,[[x+1*s,y-D/2+2*s,T+.2],[x+1*s,y+D/2,T],[x+1*s,y+D/2+1.2*s,z+1.6*s],[x+2.4*s,y+D/2+6*s,z+.3]]),{tone:'lit'});
        return {svg:o,top:T};
      },
      // A signpost with arrow boards pointing different ways.
      signpost(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,H=31*s;
        const arrow=(L,h,a)=>[[0,-h/2],[L-a,-h/2],[L,0],[L-a,h/2],[0,h/2]];
        let o=isoS(k.cylinder(x,y,6*s,z,2.4*s,P,24,.4),{tone:'mid'})+isoS(k.slabOf({x:x-1.6*s,y:y-1.6*s,w:3.2*s,d:3.2*s,r:.5},z+2.4*s,H,P,2),{tone:'mid'});
        const along=(L,zz,dir,lit)=>isoAPanel(sc,x,y,z+zz,arrow(L,7*s,5*s).map(([u,w])=>[dir*(u+1.6*s),w]),1.6*s,{tone:lit?'hi':'mid',lit});
        const side=(L,zz,dir,lit)=>isoAPanelX(sc,x,y,z+zz,arrow(L,7*s,5*s).map(([u,w])=>[dir*(u+1.6*s),w]),1.6*s,{tone:lit?'hi':'mid',lit});
        const {vy}=isoAView(sc),sy=Math.sign(vy||1);
        // the board pointing away from the viewer is drawn before the post's front
        o+=along(24*s,H*.9,1,true)+side(20*s,H*.66,sy,false);
        if(v)o+=along(20*s,H*.42,-1,false);
        o+=isoS(k.cylinder(x,y,2.2*s,z+2.4*s+H,1.4*s,P,14,.4),{tone:'mid'});
        return {svg:o,top:z+H+4*s};
      },
      // A thermometer on a stand, its column lit.
      thermometer(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{vx,vy}=isoAView(sc),r=3.4*s,H=28*s,B=6*s,b=z+3*s+B;
        let o=isoS(k.slabOf({x:x-9*s,y:y-9*s,w:18*s,d:18*s,r:3},z,3*s,P,4,.5),{tone:'mid'});
        const lvl=v?.22:.72;
        o+=isoS(k.cylinder(x,y,1.5*s,b,H*lvl,P,12),{tone:'hi',lit:true,crease:'none'});
        o+=isoS(IsoL.lathe([[0,0],[0,r],[H-r,r],[H-r*.3,r*.7],[H,0]],IsoL.frameAlong([x,y,b],ISO_UP),P,{rims:'all'}),{tone:'hi',className:'iso-glass'});
        o+=isoS(IsoL.sphereOf([x,y,z+3*s+B*.95],B,P),{tone:'hi',lit:true});
        const tx=-vy,ty=vx,fx=x+vx*r,fy=y+vy*r;
        o+=isoL(Array.from({length:8},(_,i)=>{const zz=b+H*(.1+i*.11),L=i%2?1.4:2.6;return isoPoly(sc,[[fx+tx*.2*s,fy+ty*.2*s,zz],[fx+tx*L*s,fy+ty*L*s,zz]]);}).join(''),{tone:'mid'});
        return {svg:o,top:b+H};
      },
      // Stepping stones across the bench, the next one lit.
      stones(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sy}=isoAView(sc),n=5;
        const spots=Array.from({length:n},(_,i)=>{const t=i/(n-1);return [x-22*s+t*44*s,y+(v?0:sy*Math.sin(t*Math.PI*1.2-.3)*12*s),5.6*s-(i%2)*.8*s];});
        const shape=(cx,cy,r,seed)=>Array.from({length:9},(_,j)=>{const a=j/9*Math.PI*2,q=r*(.82+.18*Math.sin(j*2.3+seed));return [cx+Math.cos(a)*q*1.15,cy+Math.sin(a)*q*.85];});
        const order=spots.map((p,i)=>({p,i})).sort((a,b)=>isoK.depthOf([...a.p.slice(0,2),0],P)-isoK.depthOf([...b.p.slice(0,2),0],P));
        let o='';
        for(const {p:[cx,cy,r],i} of order)o+=isoS(k.extrude(shape(cx,cy,r,i*1.7),z,(2.2+(i%3)*.5)*s,P),{tone:i===1?'hi':'mid',lit:i===1});
        return {svg:o,top:z+4*s};
      },
      // An open umbrella on its stand; or furled in an umbrella stand.
      umbrella(sc,x,y,z,s,v){
        const {P}=sc,k=isoK;
        if(v){let o=isoS(IsoL.lathe([[0,0],[0,8*s],[16*s,9*s],[16*s,7.6*s],[1.4*s,6.6*s],[1.4*s,0]],IsoL.frameAlong([x,y,z],ISO_UP),P,{rims:'all'}),{tone:'mid'});
          const ax=[.22,0,1],F=IsoL.frameAlong([x-4*s,y,z+2*s],ax),L=27*s;
          o+=isoS(IsoL.lathe([[0,0],[4*s,.6*s],[L*.3,4*s],[L*.8,2.6*s],[L,1*s],[L,0]],F,P,{rims:'all'}),{tone:'mid'});
          const top=IsoL.pointOf(F,L,0,0),hook=Array.from({length:12},(_,i)=>{const a=i/11*Math.PI;return [top[0]+2.6*s-Math.cos(a)*2.6*s,top[1],top[2]+3*s+Math.sin(a)*3.6*s];});
          o+=isoATube(sc,[[top[0],top[1],top[2]],[top[0],top[1],top[2]+3*s],...hook],1*s,'lit');
          o+=isoS(IsoL.lathe([[0,0],[0,8*s],[16*s,9*s],[16*s,0]],IsoL.frameAlong([x,y,z],ISO_UP),P,{rims:'all'}),{tone:'mid',className:'iso-glass'});
          return {svg:o,top:z+L+8*s};}
        const R=22*s,Hc=10*s,Zc=z+24*s;
        let o=isoS(k.cylinder(x,y,6*s,z,2*s,P,24,.4),{tone:'mid'})+isoS(k.cylinder(x,y,.9*s,z+2*s,Zc-z,P,10),{tone:'mid',crease:'none'});
        const F=IsoL.frameAlong([x,y,Zc],ISO_UP);
        o+=isoS(IsoL.lathe([[0,0],[0,R],[Hc*.45,R*.72],[Hc*.8,R*.36],[Hc,0]],F,P,{rims:'all',steps:8}),{tone:'hi'});
        o+=isoL(Array.from({length:8},(_,i)=>{const a=i/8*Math.PI*2;const p=[x+Math.cos(a)*R,y+Math.sin(a)*R,Zc];return isoK.depthOf(p,P)>isoK.depthOf([x,y,Zc],P)-R*.3?isoPoly(sc,[p,[x+Math.cos(a)*R*.72,y+Math.sin(a)*R*.72,Zc+Hc*.45],[x+Math.cos(a)*R*.36,y+Math.sin(a)*R*.36,Zc+Hc*.8],[x,y,Zc+Hc]]):'';}).join(''),{tone:'lo'});
        o+=isoS(IsoL.sphereOf([x,y,Zc+Hc+1.6*s],1.8*s,P),{tone:'hi',lit:true});
        return {svg:o,top:Zc+Hc+3*s};
      },
      // A heavy boulder with a crack; or the same boulder on a little cart.
      stone(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{vx,vy}=isoAView(sc),R=17*s,H=22*s;
        let o='',b=z;
        if(v){const W=40*s,D=26*s;b=z+9*s;
          const wheel=(wx,wy)=>isoS(IsoL.lathe([[-1.4*s,0],[-1.4*s,4*s],[1.4*s,4*s],[1.4*s,0]],IsoL.frameAlong([wx,wy,z+4*s],[0,1,0]),P,{rims:'all'}),{tone:'mid'});
          const wh=[[x-W*.32,y-D/2],[x+W*.32,y-D/2],[x-W*.32,y+D/2],[x+W*.32,y+D/2]].sort((p,q)=>isoK.depthOf([...p,0],P)-isoK.depthOf([...q,0],P));
          o+=wh.slice(0,2).map(([a,c])=>wheel(a,c)).join('');
          o+=isoS(k.slabOf({x:x-W/2,y:y-D/2+1.4*s,w:W,d:D-2.8*s,r:1.4},z+6*s,3*s,P,4,.5),{tone:'mid'});
          o+=wh.slice(2).map(([a,c])=>wheel(a,c)).join('');
          o+=isoATube(sc,[[x-W/2,y,z+9*s],[x-W/2-8*s,y,z+16*s]],.9*s,'mid');}
        const F=IsoL.frameAlong([x,y,b],ISO_UP);
        o+=isoS(IsoL.lathe([[0,0],[0,R*.72],[H*.12,R*.95],[H*.42,R],[H*.72,R*.84],[H*.92,R*.5],[H,0]],F,P,{rims:'all',steps:9}),{tone:'mid'});
        const fx=x+vx*R*.97,fy=y+vy*R*.97,tx=-vy,ty=vx;
        o+=isoL(isoPoly(sc,[[-3.4,H*.86],[-1,H*.66],[-2.6,H*.48],[.4,H*.32],[-.6,H*.14]].map(([t,h])=>{const rr=R*(h<H*.42?.97:.9);return [x+vx*rr+tx*t*s,y+vy*rr+ty*t*s,b+h];})),{tone:'lit'});
        return {svg:o,top:b+H};
      },
    });
    Object.assign(ISO_OBJECT_WORDS,{note:'a note card with one line underlined',magnifier:'a magnifying glass',door:'a door left open with light coming through',reel:'a film reel',hourglass:'an hourglass',cage:'a birdcage with its door open',target:'an archery target with an arrow in it',toolbox:'a toolbox with a wrench',cup:'a mug',book:'an open book with a ribbon marker',signpost:'a signpost pointing different ways',thermometer:'a thermometer',stones:'stepping stones',umbrella:'an umbrella',stone:'a heavy stone with a crack'});

    // Batch B objects: shield, cloud, clock, helm, clipboard, scales, key, tag, envelope,
    // dumbbell, mirror, kettle, compass, telescope. Same signature as a station.
    const isoBView=sc=>{const [vx,vy]=isoK.towardViewer(sc.P);return {vx,vy,sx:Math.sign(vx||1),sy:Math.sign(vy||1)};};
    // A frame whose axis points toward the viewer along y: u runs across, v runs up.
    const isoBFrame=(sc,o)=>IsoL.frameAlong(o,[0,isoBView(sc).sy,0]);
    const isoBAt=(F,s,u,w)=>[0,1,2].map(i=>F.o[i]+F.a[i]*s+F.u[i]*u+F.v[i]*w);
    const isoBRod=(sc,a,b,r,style={tone:'mid',crease:'none'})=>{const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=Math.hypot(...d);return isoS(IsoL.disc(0,L,r,IsoL.frameAlong(a,d),sc.P),style);};
    const isoBOval=(rx,ry,n=40,cy=0)=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2;return [Math.cos(a)*rx,cy+Math.sin(a)*ry];});
    const isoBLine=(sc,pts,style)=>isoL(isoPoly(sc,pts),style);
    const isoBDepth=(sc,p)=>isoK.depthOf(p,sc.P);
    Object.assign(ISO_OBJECTS,{
      // An upright shield on a stand, a lit cross on its face. v1: dented and cracked.
      shield(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sy}=isoBView(sc),W=30*s,H=34*s,T=3*s,z0=z+4*s;
        let o=isoS(k.slabOf({x:x-15*s,y:y-9*s,w:30*s,d:18*s,r:2},z,2.6*s,P,4,.5),{tone:'mid'});
        o+=isoS(k.slabOf({x:x-2*s,y:y-sy*5*s-1.5*s,w:4*s,d:3*s,r:.5},z+2.6*s,H*.7,P,2,.3),{tone:'mid',crease:'none'});
        const side=Array.from({length:10},(_,i)=>{const t=i/9;return [W/2*Math.sqrt(1-t*t),H*.55*(1-t)];});
        const poly=[[-W/2,H],[W/2,H],...side.map(([u,w])=>[u,w]).slice(0),...side.slice(0,-1).reverse().map(([u,w])=>[-u,w])];
        const F=isoBFrame(sc,[x,y-sy*T/2,z0]);
        o+=isoS(IsoL.prismOf(F,poly,0,T,P),{tone:'hi'});
        o+=isoBLine(sc,[...poly,poly[0]].map(([u,w])=>{const c=.84,cu=u*c,cw=H*.08+(w)*c;return isoBAt(F,T+.05,cu,cw);}),{tone:'lo',free:true});
        const b=3.2*s,cross=[[-b,H*.18],[b,H*.18],[b,H*.56],[W*.3,H*.56],[W*.3,H*.56+2*b],[b,H*.56+2*b],[b,H*.86],[-b,H*.86],[-b,H*.56+2*b],[-W*.3,H*.56+2*b],[-W*.3,H*.56],[-b,H*.56]];
        o+=isoS(IsoL.prismOf(F,cross,T,T+1*s,P),{tone:'hi',lit:true});
        if(v)o+=isoBLine(sc,[[W*.36,H*.92],[W*.2,H*.74],[W*.28,H*.62],[W*.12,H*.44],[W*.18,H*.3]].map(([u,w])=>isoBAt(F,T+1.1*s,u,w)),{tone:'hi',free:true})+isoBLine(sc,[[W*.28,H*.62],[W*.38,H*.52]].map(([u,w])=>isoBAt(F,T+1.1*s,u,w)),{tone:'hi',free:true});
        return {svg:o,top:z0+H};
      },
      // A puffy cloud on a thin post, lit rain below. v1: a low flat fog bank with lit wisps.
      cloud(sc,x,y,z,s,v){
        const {P}=sc,k=isoK;
        let o='';
        if(!v){
          const zc=z+26*s;
          const rain=[];for(const [dx,dy] of [[-14,-3],[-7,5],[0,-4],[7,4],[14,-2],[-2,8]])rain.push(k.segment([x+dx*s,y+dy*s,zc-7*s],[x+dx*s-2.4*s,y+dy*s,zc-21*s],P));
          o+=isoL(rain.join(''),{tone:'lit',dashed:true});
          const balls=[[-15,0,-2,7.5],[15,0,-2,7.5],[-7,-3,2,9.5],[7,2,3,10.5],[0,-1,-3,9],[-8,5,-3,7],[9,-6,-2,7]].map(([a,b,c,r])=>[[x+a*s,y+b*s,zc+c*s],r*s]);
          balls.sort((p,q)=>isoBDepth(sc,p[0])-isoBDepth(sc,q[0]));
          for(const [c,r] of balls)o+=isoS(IsoL.sphereOf(c,r,P),{tone:'mid',crease:'none'});
          return {svg:o,top:zc+14*s};
        }
        const zc=z+10*s;
        const balls=[[-16,-4,0,7],[-6,4,1,8],[5,-3,2,8.5],[15,3,0,7],[0,8,-1,6.5],[-10,-8,-1,6],[11,-9,0,6.5]].map(([a,b,c,r])=>[[x+a*s,y+b*s,zc+c*s],r*s]);
        balls.sort((p,q)=>isoBDepth(sc,p[0])-isoBDepth(sc,q[0]));
        for(const [c,r] of balls)o+=isoS(IsoL.sphereOf(c,r,P),{tone:'lo',crease:'none'});
        const wisps=[[-24,-2,6,20],[-18,10,3,14],[8,12,4,16]].map(([a,b,c,L])=>k.segment([x+a*s,y+b*s,zc+c*s],[x+(a+L)*s,y+b*s,zc+c*s],P));
        o+=isoL(wisps.join(''),{tone:'lit',dashed:true});
        return {svg:o,top:zc+10*s};
      },
      // A round desk clock, lit minute hand. v1: an alarm clock with two bells.
      clock(sc,x,y,z,s,v){
        const {P}=sc,{sy}=isoBView(sc),R=14.5*s,T=6*s,zc=z+4*s+R,F=isoBFrame(sc,[x,y-sy*T/2,zc]);
        let o='';
        for(const dx of [-R*.55,R*.55])o+=isoS(isoK.cylinder(x+dx,y,2.4*s,z,4*s+2,P,14,.3),{tone:'mid'});
        if(v){o+=isoBLine(sc,[isoBAt(F,T*.5,-R*.62,R*.95),isoBAt(F,T*.5,0,R*1.22),isoBAt(F,T*.5,R*.62,R*.95)],{tone:'hi'});
          for(const a of [Math.PI*.5-.75,Math.PI*.5+.75])o+=isoS(IsoL.lathe([[0,0],[0,6.5*s],[3.5*s,5.5*s],[6*s,2.5*s],[6.6*s,0]],IsoL.frameAlong(isoBAt(F,T*.5,Math.cos(a)*(R+.5*s),Math.sin(a)*(R+.5*s)),[Math.cos(a)*F.u[0]+Math.sin(a)*F.v[0],Math.cos(a)*F.u[1]+Math.sin(a)*F.v[1],Math.cos(a)*F.u[2]+Math.sin(a)*F.v[2]]),P,{rims:'all'}),{tone:'mid'});}
        o+=isoS(IsoL.lathe([[0,0],[0,R],[T,R],[T,0]],F,P,{rims:'all'}),{tone:'mid'});
        o+=isoS(IsoL.ringBand(T,T+1.2*s,R-2.6*s,R,F,P),{tone:'hi'});
        o+=isoL(IsoL.spokesOf(F,T+.1,R-5.4*s,R-3.4*s,12,P),{tone:'mid'});
        const hand=(a,L)=>[isoBAt(F,T+.2,0,0),isoBAt(F,T+.2,Math.cos(a)*L,Math.sin(a)*L)];
        o+=isoBLine(sc,hand(Math.PI*.5+2.1,R*.48),{tone:'hi'})+isoBLine(sc,hand(Math.PI*.5-.9,R*.74),{tone:'lit'});
        o+=isoD([isoK.iso(isoBAt(F,T+.3,0,0),P)],{size:1.2,tone:'hi'});
        return {svg:o,top:zc+R+(v?7*s:0)};
      },
      // A ship's wheel on a post, lit hub. v1: a car steering wheel on a column.
      helm(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sy}=isoBView(sc);
        let o=isoS(k.slabOf({x:x-14*s,y:y-10*s,w:28*s,d:20*s,r:2},z,3*s,P,4,.5),{tone:'mid'});
        if(!v){
          const R=12*s,zc=z+22*s,F=isoBFrame(sc,[x,y,zc]);
          o+=isoS(k.slabOf({x:x-3*s,y:y-sy*4*s-2.5*s,w:6*s,d:5*s,r:1},z+3*s,zc-z-3*s,P,3,.4),{tone:'mid'});
          o+=isoS(IsoL.disc(-3*s,0,2*s,IsoL.frameAlong([x,y-sy*1.5*s,zc],[0,sy,0]),P),{tone:'mid'});
          o+=isoS(IsoL.ringBand(0,2.4*s,R-2.4*s,R,F,P,{hole:[1.2*s,R-2.4*s]}),{tone:'mid'});
          for(let i=0;i<8;i++){const a=i/8*Math.PI*2+Math.PI/8,d=[Math.cos(a),Math.sin(a)];o+=isoBRod(sc,isoBAt(F,1*s,d[0]*2*s,d[1]*2*s),isoBAt(F,1*s,d[0]*(R+4*s),d[1]*(R+4*s)),1*s,{tone:'mid',crease:'none'});}
          for(let i=0;i<8;i++){const a=i/8*Math.PI*2+Math.PI/8;o+=isoS(IsoL.sphereOf(isoBAt(F,1*s,Math.cos(a)*(R+4.4*s),Math.sin(a)*(R+4.4*s)),1.6*s,P),{tone:'mid',crease:'none'});}
          o+=isoS(IsoL.disc(0,3.4*s,4.4*s,F,P),{tone:'hi',lit:true});
          return {svg:o,top:zc+R+6*s};
        }
        const R=13*s,c=[x,y+sy*4*s,z+26*s],a=[0,sy*.75,.66],F=IsoL.frameAlong(c,a);
        o+=isoBRod(sc,[x,y-sy*8*s,z+3*s],c,2.6*s,{tone:'mid'});
        o+=isoS(IsoL.ringBand(0,2.6*s,R-3*s,R,F,P,{hole:[1.3*s,R-3*s]}),{tone:'mid'});
        for(const ang of [Math.PI*.5,Math.PI*1.17,Math.PI*1.83])o+=isoBRod(sc,isoBAt(F,.6*s,0,0),isoBAt(F,.6*s,Math.cos(ang)*(R-1.5*s),Math.sin(ang)*(R-1.5*s)),1.4*s,{tone:'mid',crease:'none'});
        o+=isoS(IsoL.disc(0,2.4*s,5*s,F,P),{tone:'hi',lit:true});
        return {svg:o,top:z+26*s+R*.75};
      },
      // A clipboard on a stand with a lit check mark. v1: lying flat.
      clipboard(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,W=28*s,H=32*s;
        if(!v){
          const b=isoBoard(sc,x,y,z,W,H,{lift:4*s,T:2.4*s,tone:'mid'}),f=b.face,{sy}=isoBView(sc),fy=isoFace(sc,y,2.4*s);
          let o=b.svg+isoBLine(sc,[f(-W/2+3*s,3*s),f(W/2-3*s,3*s),f(W/2-3*s,H-6*s),f(-W/2+3*s,H-6*s),f(-W/2+3*s,3*s)],{tone:'lo',free:true});
          for(let i=0;i<4;i++)o+=isoBLine(sc,[f(-W*.12,H*.66-i*H*.14),f(W*.36-(i%2)*W*.12,H*.66-i*H*.14)],{tone:'faint',free:true});
          o+=isoBLine(sc,[f(-W*.36,H*.66),f(-W*.29,H*.6),f(-W*.18,H*.74)],{tone:'lit',free:true});
          o+=isoBLine(sc,[f(-W*.36,H*.38),f(-W*.29,H*.32),f(-W*.18,H*.46)],{tone:'mid',free:true});
          const y0=sy>0?fy:fy-2.4*s;
          o+=isoS(k.slabOf({x:x-7*s,y:y0,w:14*s,d:2.4*s,r:1},b.top-7*s,7.5*s,P,3,.4),{tone:'hi'});
          o+=isoL(isoK.sideRing([x,y0+(sy>0?2.4*s:0),b.top+2*s],2.4*s,'y',P,16),{tone:'hi'});
          return {svg:o,top:b.top+4*s};
        }
        const {sy}=isoBView(sc),T=2.4*s,PL={x:x-W/2,y:y-H/2,w:W,d:H,r:1.5};
        let o=isoS(k.slabOf(PL,z,T,P,4,.4),{tone:'mid'});
        const top=z+T,ny=y-sy*H/2,on=(u,w)=>[x+u,y-sy*(H/2)+sy*w];
        o+=isoL(k.planOutline({x:x-W/2+3*s,y:y-H/2+3*s,w:W-6*s,d:H-9*s,r:.5},top,P),{tone:'lo'});
        for(let i=0;i<4;i++)o+=isoL(k.lineOnTop(on(-W*.12,H*.3+i*H*.14),on(W*.36-(i%2)*W*.12,H*.3+i*H*.14),top,P),{tone:'faint'});
        o+=isoL(k.onTop([on(-W*.36,H*.3),on(-W*.29,H*.36),on(-W*.18,H*.22)],top,P),{tone:'lit'});
        const cy=ny+sy*1.5*s;o+=isoS(k.slabOf({x:x-7*s,y:Math.min(cy,cy+sy*7*s),w:14*s,d:7*s,r:1},top,2.4*s,P,3,.4),{tone:'hi'});
        return {svg:o,top:top+2.4*s};
      },
      // A balance: post, beam, two pans, one lower with a weight; lit pivot. v1: level.
      scales(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,H=32*s,L=20*s,tilt=v?0:5*s,pz=z+3*s+H;
        let base=isoS(k.cylinder(x,y,10*s,z,3*s,P,36,.6),{tone:'mid'})+isoS(k.cylinder(x,y,1.6*s,z+3*s,H,P,12),{tone:'mid',crease:'none'});
        const ends=[[x-L,y,pz-tilt],[x+L,y,pz+tilt]];
        base+=isoBRod(sc,[ends[0][0]-1*s,y,ends[0][2]],[ends[1][0]+1*s,y,ends[1][2]],1.3*s,{tone:'hi',crease:'none'});
        base+=isoS(IsoL.sphereOf([x,y,pz],2.8*s,P),{tone:'hi',lit:true});
        const pan=(e,heavy)=>{const drop=14*s,c=[e[0],e[1],e[2]-drop],r=9*s;let p='';
          const back=[0,1,2].map(i=>{const a=i/3*Math.PI*2+.5;return [c[0]+Math.cos(a)*r*.92,c[1]+Math.sin(a)*r*.92,c[2]+2.4*s];});
          p+=isoL(back.map(q=>k.segment(e,q,P)).join(''),{tone:'lo'});
          p+=isoS(IsoL.lathe([[0,0],[0,5*s],[2.4*s,r],[2.4*s,0]],IsoL.frameAlong(c,ISO_UP),P,{rims:'all'}),{tone:'mid'});
          if(heavy)p+=isoS(k.cylinder(c[0],c[1],4*s,c[2]+2.4*s,5*s,P,24,.5),{tone:'hi'})+isoS(k.cylinder(c[0],c[1],1.4*s,c[2]+7.4*s,1.6*s,P,12),{tone:'hi'});
          return p;};
        const pans=[[ends[0],!v,isoBDepth(sc,ends[0])],[ends[1],false,isoBDepth(sc,ends[1])]].sort((a,b)=>a[2]-b[2]);
        if(v)pans[0][1]=false;
        return {svg:pan(pans[0][0],pans[0][1])+base+pan(pans[1][0],pans[1][1]),top:pz+4*s};
      },
      // A big key on a plinth, lit bow. v1: a key in a padlock.
      key(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sx,sy}=isoBView(sc);
        if(!v){
          let o=isoS(k.slabOf({x:x-24*s,y:y-11*s,w:48*s,d:22*s,r:3},z,4*s,P,4,.6),{tone:'mid'});
          const t=z+4*s,bx=x-12*s;
          o+=isoBRod(sc,[bx+7*s,y,t+1.8*s],[bx+30*s,y,t+1.8*s],1.8*s,{tone:'hi',crease:'none'});
          for(const [dx,w,d] of [[18,3,6],[22.5,2.5,4.4],[26,2.6,7]])o+=isoS(k.slabOf({x:bx+dx*s,y:y+1*s,w:w*s,d:d*s,r:.4},t,2.4*s,P,2,.3),{tone:'mid'});
          o+=isoS(IsoL.ringBand(0,2.6*s,4*s,9*s,IsoL.frameAlong([bx,y,t],ISO_UP),P,{hole:[2.6*s,4*s]}),{tone:'hi',lit:true});
          return {svg:o,top:t+2.6*s};
        }
        const W=26*s,H=22*s,T=12*s,zb=z+3*s;
        let o=isoS(k.slabOf({x:x-16*s,y:y-12*s,w:32*s,d:24*s,r:2},z,3*s,P,4,.5),{tone:'mid'});
        const F=isoBFrame(sc,[x,y,zb+H]);
        o+=isoS(IsoL.ringBand(-1.4*s,1.4*s,8.6*s,11*s,F,P,{hole:[0,8.6*s]}),{tone:'mid'});
        o+=isoS(k.slabOf({x:x-W/2,y:y-T/2,w:W,d:T,r:4*s},zb,H,P,8,.8),{tone:'mid'});
        const fy=y+sy*T/2,kz=zb+H*.42;
        o+=isoS(k.cylinder(x,fy,1,kz-3*s,6*s,P,8),{tone:'lo',crease:'none',flat:true});
        const tip=[x,fy,kz],out=[x,fy+sy*9*s,kz];
        o+=isoBRod(sc,tip,out,1.4*s,{tone:'mid'});
        o+=isoS(IsoL.ringBand(-1.3*s,1.3*s,3.4*s,7.4*s,IsoL.frameAlong([x,fy+sy*16*s,kz],[1,0,0]),P,{hole:[0,3.4*s]}),{tone:'hi',lit:true});
        return {svg:o,top:zb+H+11.4*s};
      },
      // A label tag on a string tied to a post, lit eyelet. v1: two tags.
      tag(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sy}=isoBView(sc),px=x-14*s,ph=33*s;
        let o=isoS(k.cylinder(px,y,6*s,z,2.4*s,P,24,.4),{tone:'mid'})+isoS(k.cylinder(px,y,1.4*s,z+2.4*s,ph,P,12),{tone:'mid',crease:'none'})+isoS(k.cylinder(px,y,2.2*s,z+2.4*s+ph,2*s,P,14,.3),{tone:'mid'});
        const card=(cx,cy,ctop,lit,sc2=1)=>{const W=14*s*sc2,H=22*s*sc2,T=1*s,F=isoBFrame(sc,[cx,cy,ctop-H]);
          const poly=[[-W/2,0],[W/2,0],[W/2,H*.74],[W*.24,H],[-W*.24,H],[-W/2,H*.74]];
          let c='';const eye=isoBAt(F,T,0,H*.84);
          c+=isoBLine(sc,(()=>{const a=[px,y,z+2.4*s+ph*.94],b=eye,pts=[];for(let i=0;i<=10;i++){const t=i/10;pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t-Math.sin(t*Math.PI)*5*s]);}return pts;})(),{tone:'mid'});
          c+=isoS(IsoL.prismOf(F,poly,0,T,P),{tone:'hi'});
          for(let i=0;i<2;i++)c+=isoBLine(sc,[isoBAt(F,T+.05,-W*.3,H*(.42-i*.16)),isoBAt(F,T+.05,W*(.3-i*.12),H*(.42-i*.16))],{tone:'faint',free:true});
          c+=isoS(IsoL.ringBand(T,T+.6*s,1.2*s,2.4*s*sc2,IsoL.frameAlong(isoBAt(F,0,0,H*.84),F.a),P,{hole:[T+.6*s,1.2*s]}),{tone:'hi',lit});
          return c;};
        if(v)o+=card(x+12*s,y-sy*6*s,z+30*s,false,.85);
        o+=card(x+4*s,y+sy*2*s,z+33*s,true);
        return {svg:o,top:z+2.4*s+ph+2*s};
      },
      // An envelope lying flat, lit wax seal. v1: open, flap up and a card sticking out.
      envelope(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sy}=isoBView(sc),W=42*s,D=28*s,T=2.4*s,t=z+T,far=y-sy*D/2,near=y+sy*D/2;
        let o='';
        if(!v){
          o+=isoS(k.slabOf({x:x-W/2,y:y-D/2,w:W,d:D,r:1},z,T,P,3,.3),{tone:'mid'});
          const tip=[x,y+sy*D*.12];
          o+=isoL(k.onTop([[x-W/2+.6,far+sy*.6],tip,[x+W/2-.6,far+sy*.6]],t,P),{tone:'hi'});
          o+=isoL(k.lineOnTop([x-W/2+.6,near-sy*.6],[x-W*.12,y+sy*D*.02],t,P)+k.lineOnTop([x+W/2-.6,near-sy*.6],[x+W*.12,y+sy*D*.02],t,P),{tone:'lo'});
          o+=isoS(k.cylinder(tip[0],tip[1],3.6*s,t,1.2*s,P,24,.4),{tone:'hi',lit:true});
          return {svg:o,top:t+1.2*s};
        }
        const F=isoBFrame(sc,[x,far,t]);
        o+=isoS(IsoL.prismOf(F,[[-W/2,0],[W/2,0],[0,D*.5]],-.8*s,0,P),{tone:'mid'});
        o+=isoS(IsoL.disc(0,.8*s,3*s,IsoL.frameAlong(isoBAt(F,0,0,D*.34),F.a),P),{tone:'hi',lit:true});
        o+=isoS(k.slabOf({x:x-W*.38,y:Math.min(far+sy*3*s,far+sy*4.2*s),w:W*.76,d:1.2*s,r:.3},z+1,22*s,P,2,.2),{tone:'hi'});
        o+=isoL(isoPoly(sc,[[x-W*.26,far+sy*4.3*s,z+18*s],[x+W*.2,far+sy*4.3*s,z+18*s]])+isoPoly(sc,[[x-W*.26,far+sy*4.3*s,z+14*s],[x+W*.08,far+sy*4.3*s,z+14*s]]),{tone:'faint',free:true});
        o+=isoS(k.slabOf({x:x-W/2,y:y-D/2,w:W,d:D,r:1},z,T,P,3,.3),{tone:'mid'});
        o+=isoL(k.lineOnTop([x-W/2+.6,near-sy*.6],[x,y],t,P)+k.lineOnTop([x+W/2-.6,near-sy*.6],[x,y],t,P),{tone:'lo'});
        return {svg:o,top:z+22*s};
      },
      // A dumbbell on a small rack, lit plates at one end. v1: a second dumbbell in front.
      dumbbell(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sx,sy}=isoBView(sc);
        const bell=(cx,cy,cz,sz,lit)=>{const L=17*s*sz,F=IsoL.frameAlong([cx-L,cy,cz],[1,0,0]);
          const plates=e=>{const s0=e?2*L-9*s*sz:0,lt=lit&&e===(sx>0?1:0);return isoS(IsoL.lathe([[s0,0],[s0,6*s*sz],[s0+3*s*sz,6*s*sz],[s0+3*s*sz,8.5*s*sz],[s0+9*s*sz,8.5*s*sz],[s0+9*s*sz,0]],F,P,{rims:'all'}),{tone:lt?'hi':'mid',lit:lt});};
          const bar=isoS(IsoL.disc(4*s*sz,2*L-4*s*sz,1.6*s*sz,F,P),{tone:'hi',crease:'none'});
          return sx>0?plates(0)+bar+plates(1):plates(1)+bar+plates(0);};
        let o='';
        const rack=[x-9*s,x+9*s].map(rx=>isoS(k.slabOf({x:rx-3*s,y:y-7*s,w:6*s,d:14*s,r:1},z,6*s,P,3,.4),{tone:'mid'}));
        o+=rack.join('')+bell(x,y,z+6*s+8*s,1,true);
        if(v)o+=bell(x+4*s,y+sy*20*s,z+6*s*.8,.75,false);
        return {svg:o,top:z+22*s};
      },
      // An oval mirror on a yoke stand, lit reflection streaks. v1: a hand mirror lying flat.
      mirror(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sy}=isoBView(sc);
        if(!v){
          const rx=11*s,ry=15*s,zc=z+5*s+ry+1*s,T=2.6*s,F=isoBFrame(sc,[x,y-sy*T/2,zc]);
          let o=isoS(k.slabOf({x:x-rx-6*s,y:y-8*s,w:2*rx+12*s,d:16*s,r:3},z,3*s,P,4,.5),{tone:'mid'});
          for(const dx of [-(rx+2.6*s),rx+2.6*s])o+=isoS(k.slabOf({x:x+dx-1.4*s,y:y-1.4*s,w:2.8*s,d:2.8*s,r:.5},z+3*s,zc-z-3*s,P,2,.3),{tone:'mid',crease:'none'});
          o+=isoS(IsoL.prismOf(F,isoBOval(rx,ry,48),0,T,P),{tone:'hi'});
          o+=isoL(isoK.pathOf(isoBOval(rx-2.2*s,ry-2.2*s,48).map(([u,w])=>isoK.iso(isoBAt(F,T+.05,u,w),P)),true),{tone:'lo'});
          o+=isoBLine(sc,[isoBAt(F,T+.1,-rx*.55,ry*.05),isoBAt(F,T+.1,-rx*.05,ry*.6)],{tone:'lit',free:true})+isoBLine(sc,[isoBAt(F,T+.1,-rx*.45,-ry*.3),isoBAt(F,T+.1,rx*.2,ry*.4)],{tone:'lit',free:true});
          for(const dx of [-(rx+2.6*s),rx+2.6*s])o+=isoS(IsoL.sphereOf([x+dx,y,zc],2*s,P),{tone:'mid',crease:'none'});
          return {svg:o,top:zc+ry};
        }
        const F=IsoL.frameAlong([x+4*s,y,z],ISO_UP),rx=12*s,ry=15*s,T=2.4*s;
        let o=isoS(k.slabOf({x:x-24*s,y:y-2.6*s,w:16*s,d:5.2*s,r:2},z,2.2*s,P,4,.5),{tone:'mid'});
        o+=isoS(IsoL.prismOf(F,isoBOval(ry,rx,48),0,T,P),{tone:'hi'});
        o+=isoL(isoK.pathOf(isoBOval(ry-2.2*s,rx-2.2*s,48).map(([u,w])=>isoK.iso(isoBAt(F,T+.05,u,w),P)),true),{tone:'lo'});
        o+=isoBLine(sc,[isoBAt(F,T+.1,-ry*.5,-rx*.1),isoBAt(F,T+.1,ry*.1,rx*.5)],{tone:'lit',free:true})+isoBLine(sc,[isoBAt(F,T+.1,-ry*.2,-rx*.5),isoBAt(F,T+.1,ry*.4,rx*.15)],{tone:'lit',free:true});
        return {svg:o,top:z+T};
      },
      // A kettle with lit steam from the spout. v1: no steam, sitting on a lit hot plate.
      kettle(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sx}=isoBView(sc);
        let o='',zb=z;
        if(v){o+=isoS(k.cylinder(x,y,17*s,z,5*s,P,48,.6),{tone:'mid'})+isoS(k.cylinder(x,y,13*s,z+5*s,.1,P,40),{tone:'hi',lit:true,flat:true})+isoL(k.ring(x,y,9*s,z+5*s,P,40)+k.ring(x,y,5*s,z+5*s,P,32),{tone:'lit'});zb=z+5.2*s;}
        const H=20*s,Fu=IsoL.frameAlong([x,y,zb],ISO_UP);
        const hR=10*s,hc=[x,y,zb+H+1*s];
        o+=isoS(IsoL.ringBand(-1.2*s,1.2*s,hR-2.2*s,hR,IsoL.frameAlong(hc,[sx,0,0]),P,{hole:[0,hR-2.2*s]}),{tone:'hi'});
        const dir=[sx*.78,0,.62],sp0=[x+sx*11*s,y,zb+6*s];
        const spout=isoS(IsoL.lathe([[0,0],[0,3.4*s],[15*s,1.6*s],[15*s,0]],IsoL.frameAlong(sp0,dir),P,{rims:'all'}),{tone:'mid'});
        o+=isoS(IsoL.lathe([[0,0],[0,12*s],[1.2*s,14.5*s],[H*.62,15*s],[H*.9,10*s],[H,6*s],[H,0]],Fu,P,{rims:'all'}),{tone:'mid'});
        o+=spout;
        o+=isoS(k.cylinder(x,y,4*s,zb+H,1.6*s,P,20,.4),{tone:'hi'})+isoS(IsoL.sphereOf([x,y,zb+H+3.2*s],2*s,P),{tone:'hi',crease:'none'});
        if(!v){const tip=[sp0[0]+dir[0]*15*s,y,sp0[2]+dir[2]*15*s],st=[];
          for(const [dx,ph] of [[0,0],[4,1.6],[-3,3]]){const pts=[];for(let i=0;i<=12;i++){const t=i/12;pts.push([tip[0]+(dx+Math.sin(t*6+ph)*2.4)*s,y,tip[2]+3*s+t*20*s]);}st.push(isoPoly(sc,pts));}
          o+=isoL(st.join(''),{tone:'lit'});}
        return {svg:o,top:zb+H+(v?6:24)*s};
      },
      // A round compass with a lit needle. v1: lid open, needle turned.
      compass(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,{sy}=isoBView(sc),R=15*s,H=5*s,t=z+H;
        let o='';
        if(v){const F=isoBFrame(sc,[x,y-sy*(R+1*s),t+R+1*s]);
          o+=isoS(IsoL.lathe([[-1.6*s,0],[-1.6*s,R],[0,R],[0,0]],F,P,{rims:'all'}),{tone:'mid'})+isoL(IsoL.circleOf(F,0.05,R-3*s,P),{tone:'lo'});}
        o+=isoS(k.cylinder(x,y,R,z,H,P,64,.8),{tone:'mid'});
        if(!v)o+=isoS(IsoL.ringBand(-1*s,1*s,1.6*s,3.2*s,IsoL.frameAlong([x,y-sy*(R+2.4*s),z+H*.55],[1,0,0]),P,{hole:[0,1.6*s]}),{tone:'mid'});
        o+=isoL(k.ring(x,y,R-2.4*s,t,P,64),{tone:'hi'});
        const tk=k.radialTicks(x,y,R-3.4*s,16,4,t,[1.6*s,3.2*s],P);
        o+=isoL(tk.minor,{tone:'lo'})+isoL(tk.major,{tone:'mid'});
        const a=v?-.9:-.25,L=R-6*s,w=2.6*s,d=[Math.sin(a),-Math.cos(a)],n=[-d[1],d[0]];
        const p=(f,g)=>[x+d[0]*f+n[0]*g,y+d[1]*f+n[1]*g];
        o+=isoS(k.extrude([p(0,w),p(-L,0),p(0,-w)],t,.8*s,P),{tone:'mid'});
        o+=isoS(k.extrude([p(0,w),p(L,0),p(0,-w)],t,.8*s,P),{tone:'hi',lit:true});
        o+=isoS(k.cylinder(x,y,1.8*s,t+.8*s,.8*s,P,16,.3),{tone:'hi'});
        return {svg:o,top:v?t+2*R:t+2*s};
      },
      // A telescope on a tripod, up and to the side, lit front ring. v1: pointed level.
      telescope(sc,x,y,z,s,v){
        const {P}=sc,{vx,vy}=isoBView(sc),apex=[x,y,z+20*s];
        const side=[-vy,vx];
        const dir=v?[side[0],side[1],0]:[side[0]*.72-vx*.25,side[1]*.72-vy*.25,.62];
        const legs=[0,1,2].map(i=>{const a=i/3*Math.PI*2+.3;return [x+Math.cos(a)*16*s,y+Math.sin(a)*16*s,z];}).sort((a,b)=>isoBDepth(sc,a)-isoBDepth(sc,b));
        let o='';
        for(const f of legs.slice(0,2))o+=isoBRod(sc,apex,f,1.1*s,{tone:'mid',crease:'none'});
        const F=IsoL.frameAlong([apex[0],apex[1],apex[2]+3*s],dir);
        o+=isoS(IsoL.disc(-3*s,3*s,2.6*s,IsoL.frameAlong(apex,[0,0,1]),P),{tone:'mid'});
        const front=isoS(IsoL.lathe([[14*s,0],[14*s,4.6*s],[18*s,5.2*s],[18*s,0]],F,P,{rims:'all'}),{tone:'hi',lit:true});
        const tube=isoS(IsoL.lathe([[-16*s,0],[-16*s,1.6*s],[-12*s,1.6*s],[-12*s,2.8*s],[14*s,4*s],[14*s,0]],F,P,{rims:'all'}),{tone:'mid'});
        const forward=isoK.depthOf([F.o[0]+dir[0],F.o[1]+dir[1],F.o[2]+dir[2]],P)>isoK.depthOf(F.o,P);
        o+=forward?tube+front:front+tube;
        o+=isoBRod(sc,apex,legs[2],1.1*s,{tone:'mid',crease:'none'});
        return {svg:o,top:z+20*s+(v?8:18)*s};
      },
    });
    Object.assign(ISO_OBJECT_WORDS,{shield:'a shield on a stand',cloud:'a rain cloud',clock:'a desk clock',helm:'a ship\'s wheel',clipboard:'a clipboard with a check mark',scales:'a balance scale',key:'a key',tag:'a label tag on a string',envelope:'an envelope with a seal',dumbbell:'a dumbbell on a rack',mirror:'a mirror on a stand',kettle:'a steaming kettle',compass:'a compass',telescope:'a telescope on a tripod'});

    // Batch C objects: map, trophy, megaphone, balloon, dice, kite, fence, bathtub, faucet,
    // dominoes, tree, honeycomb, ladder, bridge, lightbulb, heart.
    const isoCView=sc=>IsoL.viewOf(sc.P);
    const isoCDot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const isoCAdd=(...vs)=>vs.reduce((a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]);
    const isoCMul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
    // One flat 3D polygon as a shaded solid face.
    function isoCFace(sc,pts,style={}){
      const {P}=sc,k=isoK,d=k.pathOf(pts.map(p=>k.iso(p,P)),true);
      const e1=[pts[1][0]-pts[0][0],pts[1][1]-pts[0][1],pts[1][2]-pts[0][2]],e2=[pts[2][0]-pts[0][0],pts[2][1]-pts[0][1],pts[2][2]-pts[0][2]];
      let n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
      if(isoCDot(n,isoCView(sc))<0)n=isoCMul(n,-1);
      const band=IsoL.toneOf(n,P),shades=['','','',''];if(band<4)shades[band]=d;
      return isoS({fill:d,outline:d,top:band>=4?d:'',shades},{crease:'none',...style});
    }
    // An upright (or tilted) prism of any polygon, concave allowed. U,V span the polygon's
    // plane, N is the thickness direction; poly is [u,v] points; o is the polygon's origin.
    function isoCPrism(sc,o,U,V,N,poly,t,style={}){
      const {P}=sc,k=isoK,view=isoCView(sc);
      let ring=poly.slice();let area=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];area+=a[0]*b[1]-b[0]*a[1];}
      if(area<0)ring.reverse();
      const sgn=isoCDot(N,view)>=0?1:-1,front=isoCMul(N,sgn*t/2),back=isoCMul(N,-sgn*t/2);
      const at=([u,v],off)=>isoCAdd(o,isoCMul(U,u),isoCMul(V,v),off);
      const sides=[];
      for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],du=b[0]-a[0],dv=b[1]-a[1];
        const nrm=isoCAdd(isoCMul(U,dv),isoCMul(V,-du));if(isoCDot(nrm,view)<=1e-6)continue;
        const q=[at(a,back),at(b,back),at(b,front),at(a,front)],mid=isoCAdd(...q.map(p=>isoCMul(p,.25)));sides.push({q,nrm,dep:k.depthOf(mid,P)});}
      sides.sort((a,b)=>a.dep-b.dep);
      let out='';
      for(const sd of sides){const d=k.pathOf(sd.q.map(p=>k.iso(p,P)),true),band=IsoL.toneOf(sd.nrm,P),shades=['','','',''];if(band<4)shades[band]=d;
        out+=isoS({fill:d,outline:'',top:band>=4?d:'',shades},{crease:'none',...style});}
      out+=isoL(k.pathOf(ring.map(p=>k.iso(at(p,back),P)),true),{tone:style.tone||'hi',className:'iso-edge'});
      const fd=k.pathOf(ring.map(p=>k.iso(at(p,front),P)),true),fn=isoCMul(N,sgn),band=IsoL.toneOf(fn,P),shades=['','','',''];if(band<4)shades[band]=fd;
      out+=isoS({fill:fd,outline:fd,top:band>=4?fd:'',shades},{crease:'none',...style});
      return {svg:out,face:([u,v])=>at([u,v],isoCMul(front,1.02))};
    }
    // A rod between two 3D points.
    function isoCRod(sc,a,b,r,style={tone:'mid'}){
      const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],L=Math.hypot(...d);
      return isoS(IsoL.lathe([[0,0],[0,r],[L,r],[L,0]],IsoL.frameAlong(a,d),sc.P,{rims:'ends'}),{crease:'none',...style});
    }
    const isoCX=[1,0,0],isoCY=[0,1,0],isoCZ=[0,0,1];
    Object.assign(ISO_OBJECTS,{
      // A folded paper map with a route and a pin.
      map(sc,x,y,z,s,v){
        const {P}=sc,k=isoK;
        if(v){const W=46*s,H=34*s,b=isoBoard(sc,x,y,z,W,H),f=b.face;
          let o=b.svg+isoL([-.25,0,.25].map(u=>isoPoly(sc,[f(u*W,2),f(u*W,H-2)])).join(''),{tone:'lo',free:true});
          o+=isoL(isoPoly(sc,[[-.4,.2],[-.22,.42],[-.05,.3],[.12,.62],[.32,.7]].map(([u,h])=>f(u*W,h*H))),{tone:'lit',dashed:true,free:true});
          o+=isoD([k.iso(f(.32*W,.7*H),P)],{size:2.2,tone:'hi'});
          return {svg:o,top:b.top};}
        const N=4,W=11*s,D=34*s,x0=x-N*W/2,hz=i=>z+(i%2?5*s:.6);
        const panels=[];for(let i=0;i<N;i++){const xa=x0+i*W,xb=xa+W,za=hz(i),zb=hz(i+1);panels.push({pts:[[xa,y-D/2,za],[xb,y-D/2,zb],[xb,y+D/2,zb],[xa,y+D/2,za]],dep:k.depthOf([xa+W/2,y,(za+zb)/2],P)});}
        let o=isoS(k.slabOf({x:x0-1,y:y-D/2-1,w:N*W+2,d:D+2,r:1},z,.6,P,3),{tone:'lo',crease:'none'});
        for(const p of panels.sort((a,b)=>a.dep-b.dep))o+=isoCFace(sc,p.pts,{tone:'mid'});
        const zAt=xx=>{const i=Math.max(0,Math.min(N-1,Math.floor((xx-x0)/W))),t=(xx-x0-i*W)/W;return hz(i)+(hz(i+1)-hz(i))*t+.3;};
        const route=Array.from({length:25},(_,i)=>{const xx=x0+2+i*(N*W-4)/24;return [xx,y+Math.sin(i/24*Math.PI*2.2)*D*.28,zAt(xx)];});
        o+=isoL(isoPoly(sc,route),{tone:'lit',dashed:true});
        const pin=route[22];
        o+=isoL(k.segment(pin,[pin[0],pin[1],pin[2]+9*s],P),{tone:'hi'})+isoS(IsoL.sphereOf([pin[0],pin[1],pin[2]+10.5*s],2.6*s,P),{tone:'hi'});
        return {svg:o,top:z+16*s};
      },
      // A cup trophy on a plinth; v1 a medal hung on a stand.
      trophy(sc,x,y,z,s,v){
        const {P}=sc,k=isoK;
        let o=isoS(k.slabOf({x:x-13*s,y:y-13*s,w:26*s,d:26*s,r:1.5},z,9*s,P,4,.6),{tone:'mid'})+isoL(k.planOutline(k.insetPlan({x:x-13*s,y:y-13*s,w:26*s,d:26*s,r:1.5},2.5*s),z+9*s,P),{tone:'lo'});
        const zb=z+9*s;
        if(v){const W=24*s,H=26*s,[vx,vy]=k.towardViewer(P),fy=isoFace(sc,y,2);
          for(const px of [x-W/2,x+W/2])o+=isoS(k.cylinder(px,y,1.3*s,zb,H,P,12),{tone:'mid',crease:'none'});
          o+=isoS(k.slabOf({x:x-W/2-2*s,y:y-1.6*s,w:W+4*s,d:3.2*s,r:.6},zb+H,2.4*s,P,3),{tone:'mid'});
          const top=zb+H,mz=zb+H*.42;
          o+=isoL(isoPoly(sc,[[x-6*s,fy,top],[x,fy,mz+7*s],[x+6*s,fy,top]]),{tone:'hi'});
          const F=IsoL.frameAlong([x,fy-Math.sign(fy-y)*1.2,mz],[0,Math.sign(fy-y),0]);
          o+=isoS(IsoL.lathe([[0,0],[0,7.5*s],[2.4*s,7.5*s],[2.4*s,0]],F,P,{rims:'all'}),{tone:'hi',lit:true});
          o+=isoL(k.pathOf(Array.from({length:7},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/5;return k.iso([x+Math.cos(a)*3.6*s,fy+Math.sign(fy-y)*1.4*s,mz+Math.sin(-a)*3.6*s],P);}).slice(0,6),true),{tone:'lit'});
          return {svg:o,top:top+2.4*s};}
        const F=IsoL.frameAlong([x,y,zb],ISO_UP),cupTop=zb+28*s,[vx,vy]=k.towardViewer(P),d=[-vy,vx,0];
        o+=isoS(k.cylinder(x,y,7*s,zb,2.5*s,P,40,.5),{tone:'mid'})+isoS(k.cylinder(x,y,1.8*s,zb+2.5*s,13.5*s,P,16),{tone:'mid',crease:'none'})+isoS(k.cylinder(x,y,3.6*s,zb+10.5*s,3*s,P,24,.6),{tone:'mid'});
        o+=isoS(IsoL.lathe([[0,0],[0,2.4*s],[3*s,8*s],[7*s,11*s],[12*s,12.5*s],[12*s,0]],IsoL.frameAlong([x,y,zb+16*s],ISO_UP),P,{rims:'last'}),{tone:'hi'});
        for(const side of [-1,1]){const pts=Array.from({length:9},(_,i)=>{const a=-Math.PI/2+i*Math.PI/8,r=11.4*s+4.6*s*Math.cos(a);return [x+d[0]*side*r,y+d[1]*side*r,zb+22*s+4.6*s*Math.sin(a)];});
          for(let i=0;i<8;i++)o+=isoCRod(sc,pts[i],pts[i+1],1.1*s,{tone:'mid'});}
        o+=isoL(k.ring(x,y,12.5*s,cupTop,P,48),{tone:'lit'})+isoL(k.ring(x,y,10.6*s,cupTop,P,48),{tone:'lo'});
        return {svg:o,top:cupTop};
      },
      // A megaphone on a stand, sound arcs going out; v1 a horn on a tall pole.
      megaphone(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,pole=v?22*s:16*s,hz=z+3+pole,hx=x-10*s;
        let o=isoS(k.cylinder(x-6*s,y,(v?8:9)*s,z,3,P,32,.4),{tone:'mid'})+isoS(k.cylinder(x-6*s,y,1.6*s,z+3,pole,P,12),{tone:'mid',crease:'none'});
        const dir=v?[1,0,-.25]:[1,0,.12],L=v?20*s:24*s,F=IsoL.frameAlong([hx,y,hz+4*s],dir);
        o+=isoS(IsoL.lathe(v?[[0,0],[0,4*s],[5*s,4.5*s],[L,12*s],[L,10.6*s]]:[[0,0],[0,3.4*s],[6*s,3.8*s],[L,11*s],[L,9.6*s]],F,P,{rims:'all',hole:null}),{tone:'hi'});
        if(!v)o+=isoS(k.slabOf({x:hx+6*s,y:y-1.4*s,w:3*s,d:2.8*s,r:.5},hz-2*s,6*s,P,2),{tone:'mid',crease:'none'});
        const n=Math.hypot(...dir),d=dir.map(c=>c/n),end=[hx+d[0]*L,y,hz+4*s+d[2]*L];
        const arcs=[7,13,19].map(r=>isoPoly(sc,Array.from({length:13},(_,i)=>{const a=-.75+i*1.5/12;return [end[0]+d[0]*r*s*Math.cos(a)-d[2]*0,end[1]+r*s*Math.sin(a)*.9,end[2]+d[2]*r*s+r*s*Math.sin(a)*.25+(r*s*Math.cos(a)-r*s)*0];}))).join('');
        o+=isoL(arcs,{tone:'lit'});
        return {svg:o,top:hz+16*s};
      },
      // A balloon on a string tied to a weight; v1 a small deflated balloon drooping.
      balloon(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,wx=x+10*s,wy=y+4*s;
        let o=isoS(k.cylinder(wx,wy,4.4*s,z,5*s,P,24,.6),{tone:'mid'})+isoS(k.cylinder(wx,wy,1.4*s,z+5*s,1.6*s,P,10),{tone:'mid'});
        const R=v?7*s:11*s,H=v?16*s:25*s,bz=v?z+9*s:z+15*s,bx=v?x-8*s:x-3*s,by=y-2*s;
        const axis=v?[-.8,0,.6]:[0,0,1];
        const meridian=Array.from({length:15},(_,i)=>{const t=i/14,r=R*Math.pow(Math.sin(Math.PI*Math.min(1,t*1.05)),.85)*(1-.25*(1-t)*(1-t));return [t*H,i===0||i===14?0:r,true];});
        const string=v?[[wx,wy,z+6.6*s],[wx-4*s,wy-1*s,z+8*s],[bx+4*s,by+1*s,bz+3*s],[bx,by,bz]]:Array.from({length:9},(_,i)=>{const t=i/8;return [wx+(bx-wx)*t+Math.sin(t*Math.PI*2)*2*s,wy+(by-wy)*t,z+6.6*s+(bz-z-6.6*s)*t];});
        o+=isoL(isoPoly(sc,string),{tone:'mid'});
        o+=isoS(IsoL.lathe([[0,0],[0,1.6*s],[2.4*s,.6*s],[2.4*s,0]],IsoL.frameAlong([bx,by,bz-1.8*s],axis),P,{rims:'none'}),{tone:'mid',crease:'none'});
        o+=isoS(IsoL.lathe(meridian,IsoL.frameAlong([bx,by,bz],axis),P,{rims:'none',smooth:true}),{tone:'hi',lit:true});
        if(v)o+=isoL(isoPoly(sc,[[bx-3*s,by,bz+4*s],[bx-6*s,by,bz+6*s],[bx-8*s,by,bz+6*s]]),{tone:'lo'});
        return {svg:o,top:bz+H};
      },
      // Two dice; v1 three dice stacked.
      dice(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,A=13*s,[vx,vy]=k.towardViewer(P);
        const PIPS={1:[[0,0]],2:[[-.25,-.25],[.25,.25]],3:[[-.27,-.27],[0,0],[.27,.27]],4:[[-.25,-.25],[.25,-.25],[-.25,.25],[.25,.25]],5:[[-.27,-.27],[.27,-.27],[0,0],[-.27,.27],[.27,.27]],6:[[-.27,-.27],[-.27,0],[-.27,.27],[.27,-.27],[.27,0],[.27,.27]]};
        const die=(cx,cy,cz,rot,faces,lit)=>{
          const c=Math.cos(rot),sn=Math.sin(rot),ax=[c,sn],ay=[-sn,c],h=A/2;
          const ring=[[-h,-h],[h,-h],[h,h],[-h,h]].map(([u,w])=>[cx+u*ax[0]+w*ay[0],cy+u*ax[1]+w*ay[1]]);
          let o=isoS(isoK.extrude(ring,cz,A,P,{bevel:.8}),{tone:'hi',lit});
          const dots=[];
          for(const [u,w] of PIPS[faces[0]])dots.push(k.iso([cx+u*A*ax[0]+w*A*ay[0],cy+u*A*ax[1]+w*A*ay[1],cz+A+.1],P));
          // the two side faces turned toward the viewer
          const sides=[[ax,ay],[ay,ax]];
          sides.forEach(([nrm,along],i)=>{const sg=Math.sign(nrm[0]*vx+nrm[1]*vy)||1,fc=[cx+nrm[0]*sg*(h+.15),cy+nrm[1]*sg*(h+.15)];
            for(const [u,w] of PIPS[faces[i+1]])dots.push(k.iso([fc[0]+along[0]*u*A,fc[1]+along[1]*u*A,cz+A/2+w*A],P));});
          return o+isoD(dots,{size:1.7*s,tone:'hi'});
        };
        const list=v?[[x-8*s,y-1*s,z,.25,[5,3,2],false],[x+8*s,y+2*s,z,-.15,[2,6,4],false],[x,y+.5*s,z+A,.6,[6,1,3],true]]:[[x-9*s,y-4*s,z,.35,[6,2,3],true],[x+8*s,y+6*s,z,-.3,[3,5,1],false]];
        const ordered=list.slice().sort((a,b)=>(k.depthOf([a[0],a[1],a[2]],P)+a[2]*0)-(k.depthOf([b[0],b[1],b[2]],P)));
        let o='';for(const d of (v?list:ordered))o+=die(...d);
        return {svg:o,top:z+(v?2:1)*A};
      },
      // A diamond kite up on its string; v1 the kite lying on the bench.
      kite(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,sx=x+12*s,sy=y+6*s;
        const Fs=IsoL.frameAlong([sx,sy-3*s,z+4.5*s],[0,1,0]);
        let o=isoS(k.slabOf({x:sx-5*s,y:sy-5*s,w:10*s,d:10*s,r:1},z,1.5,P,3),{tone:'mid'})+isoS(IsoL.lathe([[0,0],[0,4.4*s],[1,4.4*s],[1,2.6*s],[5*s,2.6*s],[5*s,4.4*s],[6*s,4.4*s],[6*s,0]],Fs,P,{rims:'all'}),{tone:'mid'});
        const poly=[[0,11*s],[8.5*s,0],[0,-16*s],[-8.5*s,0]];
        if(v){const kx=x-10*s,ky=y-4*s,ring=poly.map(([u,w])=>[kx+u*.9-w*.35,ky+u*.35+w*.9]);
          o+=isoS(isoK.extrude(ring,z,1.2,P),{tone:'hi',lit:true})+isoL(isoK.lineOnTop(ring[0],ring[2],z+1.3,P)+isoK.lineOnTop(ring[1],ring[3],z+1.3,P),{tone:'lo'});
          o+=isoL(isoPoly(sc,[[ring[2][0],ring[2][1],z+.4],[ring[2][0]+2*s,ring[2][1]-3*s,z+.4],[ring[2][0]+.5*s,ring[2][1]-6*s,z+.4],[ring[2][0]+3*s,ring[2][1]-9*s,z+.4]]),{tone:'mid'});
          o+=isoL(isoPoly(sc,[[ring[0][0],ring[0][1],z+1],[sx-3*s,sy-1*s,z+4.5*s]]),{tone:'lo'});
          return {svg:o,top:z+10*s};}
        const [tvx,tvy]=k.towardViewer(P),kc=[x-6*s,y-2*s,z+28*s],U=[-tvy,tvx,0],V=[tvx*-.3,tvy*-.3,.95],N=[tvx,tvy,.3];
        const pr=isoCPrism(sc,kc,U,V,N,poly,1.4,{tone:'hi',lit:true}),f=pr.face;
        const tail=Array.from({length:11},(_,i)=>{const t=i/10;return [kc[0]+V[0]*-16*s+t*4*s+Math.sin(t*7)*2.5*s,kc[1]+t*2*s,kc[2]+V[2]*-16*s-t*9*s];});
        o+=isoL(isoPoly(sc,[f([0,-16*s]),[sx-2*s,sy-3*s,z+5*s]]),{tone:'lo'});
        o+=isoL(isoPoly(sc,tail),{tone:'mid'})+isoD([3,6,9].map(i=>k.iso(tail[i],P)),{size:1.3*s,tone:'hi'});
        o+=pr.svg+isoL(isoPoly(sc,[f([0,11*s]),f([0,-16*s])])+isoPoly(sc,[f([-8.5*s,0]),f([8.5*s,0])]),{tone:'lo'});
        return {svg:o,top:kc[2]+11*s};
      },
      // A short picket fence with a gate swung open; v1 the gate shut.
      fence(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,H=20*s,T=1.8*s,pw=3.6*s,gap=1.6*s;
        const items=[];
        const picket=(px)=>{const poly=[[-pw/2,0],[pw/2,0],[pw/2,H-2.4*s],[0,H],[-pw/2,H-2.4*s]];return {dep:k.depthOf([px,y,z],P),svg:isoCPrism(sc,[px,y,z],isoCX,isoCZ,isoCY,poly,T,{tone:'mid'}).svg};};
        const L0=x-24*s,g0=x-6*s,g1=x+10*s,R1=x+24*s;
        for(let px=L0+pw/2;px<g0-pw/2+.01;px+=pw+gap)items.push(picket(px));
        for(let px=g1+pw/2;px<R1-pw/2+.01;px+=pw+gap)items.push(picket(px));
        const rail=(a,b,zz)=>({dep:k.depthOf([(a+b)/2,y-T,z],P)-.5,svg:isoS(k.slabOf({x:a,y:y-T/2-1.6*s,w:b-a,d:1.6*s,r:.3},zz,2.2*s,P,2),{tone:'mid',crease:'none'})});
        const back=Math.sign(k.towardViewer(P)[1])||1;
        const railY=y-back*(T/2+.8*s);
        for(const zz of [z+5*s,z+13*s]){items.push({dep:-1e6,svg:isoS(k.slabOf({x:L0,y:railY-.8*s,w:g0-L0,d:1.6*s,r:.3},zz,2.2*s,P,2),{tone:'mid',crease:'none'})});items.push({dep:-1e6,svg:isoS(k.slabOf({x:g1,y:railY-.8*s,w:R1-g1,d:1.6*s,r:.3},zz,2.2*s,P,2),{tone:'mid',crease:'none'})});}
        for(const px of [g0,g1])items.push({dep:k.depthOf([px,y,z],P)+.1,svg:isoS(k.slabOf({x:px-1.8*s,y:y-1.8*s,w:3.6*s,d:3.6*s,r:.4},z,H+3*s,P,2),{tone:'hi'})});
        // the gate turns on its hinge at g0
        const ang=v?0:-1.05*back,GW=g1-g0-2.6*s,c=Math.cos(ang),sn=Math.sin(ang),hx=g0+1.6*s;
        const U=[c,sn,0],N=[-sn,c,0],gate=[[0,1*s],[GW,1*s],[GW,H-3*s],[GW/2,H-.5*s],[0,H-3*s]];
        const gp=isoCPrism(sc,[hx,y,z],U,isoCZ,N,gate,1.6*s,{tone:'hi',lit:true}),gf=gp.face;
        items.push({dep:k.depthOf([hx+U[0]*GW/2,y+U[1]*GW/2,z],P),svg:gp.svg+isoL(isoPoly(sc,[gf([1.5*s,5*s]),gf([GW-1.5*s,5*s])])+isoPoly(sc,[gf([1.5*s,13*s]),gf([GW-1.5*s,13*s])])+isoPoly(sc,[gf([2*s,5.5*s]),gf([GW-2*s,12.5*s])]),{tone:'lit'})});
        items.sort((a,b)=>a.dep-b.dep);
        return {svg:items.map(i=>i.svg).join(''),top:z+H+3*s};
      },
      // A clawfoot bathtub full of water; v1 the water low, a plug chain hanging in.
      bathtub(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,W=46*s,D=24*s,H=15*s,fz=4*s,plan={x:x-W/2,y:y-D/2,w:W,d:D,r:D/2};
        let o='';
        for(const [fx,fy] of k.corners(plan,6*s))o+=isoS(IsoL.sphereOf([fx,fy,z+2*s],2.4*s,P),{tone:'mid'});
        o+=isoS(k.slabOf(plan,z+fz,H,P,16,1.2),{tone:'hi'});
        const top=z+fz+H,inner=k.insetPlan(plan,2.6*s);
        o+=isoS(k.slabOf(inner,top-.1,.1,P,16),{tone:'lo',flat:true})+isoL(k.planOutline(inner,top,P,16),{tone:'mid'});
        const wz=v?top-8*s:top-2.4*s,water=k.insetPlan(plan,v?5*s:3.2*s);
        if(v)o+=isoS(k.slabOf(inner,wz,top-wz-.2,P,16),{tone:'lo',crease:'none'});
        o+=isoS(k.slabOf(water,wz-.1,.1,P,16),{tone:'hi',lit:true,className:'rv-water',flat:true})+isoL(k.planOutline(water,wz,P,16),{tone:'lit'});
        // tap at one end
        const tx=x-W/2+4*s;
        o+=isoS(k.cylinder(tx,y,1.4*s,top,7*s,P,12),{tone:'mid',crease:'none'})+isoCRod(sc,[tx,y,top+7*s],[tx+6*s,y,top+7*s],1.3*s)+isoS(k.cylinder(tx+6*s,y,1.4*s,top+4*s,3*s,P,12),{tone:'mid',crease:'none'});
        if(v)o+=isoL(isoPoly(sc,[[x+W/2-6*s,y,top],[x+W/2-7*s,y,top-3*s],[x+W/2-9*s,y,wz]]),{tone:'hi',dotted:true});
        return {svg:o,top:top+7*s};
      },
      // A tap on a pipe stand pouring into a basin; v1 shut, one drop.
      faucet(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,px=x-12*s,H=27*s,nx=px+18*s;
        let o=isoS(k.cylinder(px,y,6*s,z,2.4*s,P,24,.4),{tone:'mid'})+isoS(k.cylinder(px,y,2.6*s,z+2.4*s,H,P,20),{tone:'mid',crease:'none'});
        o+=isoS(IsoL.sphereOf([px,y,z+2.4*s+H],3*s,P),{tone:'mid'});
        o+=isoCRod(sc,[px,y,z+2.4*s+H],[nx,y,z+2.4*s+H],2.2*s,{tone:'hi'});
        o+=isoS(k.cylinder(nx,y,2.4*s,z+H-4*s,6.4*s,P,20,.3),{tone:'hi'});
        o+=isoS(k.cylinder(px,y,1.2*s,z+2.4*s+H+2.4*s,4*s,P,10),{tone:'mid',crease:'none'})+isoCRod(sc,[px-5*s,y,z+H+9*s],[px+5*s,y,z+H+9*s],1.2*s)+(v?'':'');
        // basin under the nozzle
        const F=IsoL.frameAlong([nx,y,z],ISO_UP);
        o+=isoS(IsoL.lathe([[0,0],[0,5*s],[2*s,5*s],[9*s,12*s],[9*s,0]],F,P,{rims:'all'}),{tone:'mid'})+isoL(k.ring(nx,y,10.5*s,z+8.6*s,P,40),{tone:'lo'});
        const mouth=z+H-4*s;
        if(v)o+=isoS(IsoL.sphereOf([nx,y,mouth-6*s],1.6*s,P),{tone:'hi',lit:true});
        else o+=isoL(k.segment([nx,y,mouth-.5],[nx,y,z+8.8*s],P)+k.segment([nx-.9*s,y,mouth-.5],[nx-.9*s,y,z+8.8*s],P),{tone:'lit',flow:true})+isoL(k.ring(nx,y,3.2*s,z+8.8*s,P,24),{tone:'lit'});
        return {svg:o,top:z+H+11*s};
      },
      // A row of dominoes, the first falling into the rest; v1 all standing.
      dominoes(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,n=6,gapX=8.4*s,W=11*s,H=20*s,T=3.6*s,x0=x-(n-1)*gapX/2-2*s;
        const angles=v?[0,0,0,0,0,0]:[.95,.62,.28,0,0,0];
        let o='';
        for(let i=0;i<n;i++){const th=angles[i],U=[Math.cos(th),0,-Math.sin(th)],V=[Math.sin(th),0,Math.cos(th)],bx=x0+i*gapX+(i===0?0:0);
          const pr=isoCPrism(sc,[bx,y,z],U,V,isoCY,[[0,0],[T,0],[T,H],[0,H]],W,{tone:'hi',lit:i===0});
          // pips on the face turned to the viewer
          const sg=Math.sign(k.towardViewer(P)[0])||1,fx=sg>0?T+.15:-.15,pt=(w,h)=>[bx+U[0]*fx+V[0]*h,y+w,z+U[2]*fx+V[2]*h];
          let d=pr.svg+isoL(isoPoly(sc,[pt(-W*.38,H/2),pt(W*.38,H/2)]),{tone:'lo'});
          d+=isoD([[0,H*.25],[-W*.22,H*.72],[W*.22,H*.72],[0,H*.86]].map(([w,h])=>k.iso(pt(w,h),P)),{size:.9*s,tone:'hi'});
          o=k.towardViewer(P)[0]>0?o+d:d+o;}
        return {svg:o,top:z+H};
      },
      // A tree in a small bed with lit fruit; v1 a bare branching tree with one lit bud.
      tree(sc,x,y,z,s,v){
        const {P}=sc,k=isoK;
        let o=isoS(k.cylinder(x,y,15*s,z,3*s,P,48,.6),{tone:'mid'})+isoS(k.cylinder(x,y,13*s,z+3*s-.1,.1,P,48),{tone:'lo',flat:true});
        o+=isoS(IsoL.lathe([[0,0],[0,3*s],[8*s,2.2*s],[18*s,1.8*s],[18*s,0]],IsoL.frameAlong([x,y,z+3*s],ISO_UP),P,{rims:'none'}),{tone:'mid'});
        const tz=z+19*s;
        if(v){const br=[[[x,y,z+13*s],[x-10*s,y-2*s,z+27*s]],[[x,y,z+16*s],[x+11*s,y+3*s,z+29*s]],[[x,y,z+20*s],[x+2*s,y-1*s,z+36*s]],[[x-6*s,y-1*s,z+21*s],[x-14*s,y+3*s,z+32*s]],[[x+6*s,y+2*s,z+23*s],[x+15*s,y-3*s,z+28*s]]];
          for(const [a,b] of br)o+=isoCRod(sc,a,b,1.1*s);
          o+=isoS(IsoL.sphereOf([x+2*s,y-1*s,z+37.5*s],2.4*s,P),{tone:'hi',lit:true});
          return {svg:o,top:z+40*s};}
        const blobs=[[0,0,8,10.5],[-8,-3,2,8],[8,3,3,8],[-4,5,7,7.5],[4,-5,6,7.5],[0,0,13,8]].map(([dx,dy,dz,r])=>({c:[x+dx*s,y+dy*s,tz+dz*s],r:r*s}));
        blobs.sort((a,b)=>k.depthOf(a.c,P)-k.depthOf(b.c,P));
        for(const b of blobs)o+=isoS(IsoL.sphereOf(b.c,b.r,P),{tone:'mid'});
        const view=IsoL.viewOf(P);
        for(const [dx,dy,dz] of [[-6,0,3],[5,1,8],[0,-2,13],[7,-4,2]]){const c=[x+dx*s+view[0]*9*s,y+dy*s+view[1]*9*s,tz+dz*s+view[2]*3*s];o+=isoS(IsoL.sphereOf(c,1.8*s,P),{tone:'hi',lit:true});}
        return {svg:o,top:tz+21*s};
      },
      // A slab of honeycomb cells, a few filled; v1 fewer cells with a ragged edge.
      honeycomb(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,R=5.6*s,dx=R*Math.sqrt(3),dy=R*1.5;
        const cells=[];
        for(let r=-2;r<=2;r++)for(let c=-2;c<=2;c++){const cx=x+c*dx+(r&1?dx/2:0)-dx/4,cy=y+r*dy;if(Math.hypot(cx-x,cy-y)>(v?14:19)*s)continue;if(v&&(r+2*c)%5===3)continue;cells.push([cx,cy]);}
        const filled=new Set(v?[1,4]:[3,7,8,12]);
        cells.sort((a,b)=>k.depthOf([a[0],a[1],z],P)-k.depthOf([b[0],b[1],z],P));
        let o=isoS(k.cylinder(x,y,(v?19:24)*s,z,2*s,P,6,.4),{tone:'lo'});
        cells.forEach(([cx,cy],i)=>{const hex=Array.from({length:6},(_,j)=>{const a=Math.PI/6+j*Math.PI/3;return [cx+Math.cos(a)*R*.97,cy+Math.sin(a)*R*.97];});
          const on=filled.has(i),h=(on?7:8)*s;
          o+=isoS(isoK.extrude(hex,z+2*s,h,P),{tone:'mid',lit:on});
          if(!on){const inner=hex.map(([px,py])=>[cx+(px-cx)*.72,cy+(py-cy)*.72]);o+=isoL(k.onTop(inner,z+2*s+h,P,true),{tone:'lo'});}});
        return {svg:o,top:z+10*s};
      },
      // A step ladder with one lit rung; v1 a two-step stool.
      ladder(sc,x,y,z,s,v){
        const {P}=sc,k=isoK;
        if(v){let o='';const legs=[[-9,-8],[9,-8],[-9,8],[9,8]];
          for(const [a,b] of legs)o+=isoCRod(sc,[x+a*s,y+b*s,z],[x+a*.85*s,y+b*.85*s,z+20*s],1.2*s);
          o+=isoS(k.slabOf({x:x-11*s,y:y-10*s,w:22*s,d:12*s,r:1},z+9*s,2.4*s,P,3,.4),{tone:'mid'});
          o+=isoS(k.slabOf({x:x-10*s,y:y-4*s,w:20*s,d:12*s,r:1},z+20*s,2.6*s,P,3,.4),{tone:'hi',lit:true});
          return {svg:o,top:z+22.6*s};}
        const W=16*s,H=36*s,foot=11*s;
        const rail=(sx,top)=>[-1,1].map(sy=>[[x+sx,y+sy*W/2,z],[x+top,y+sy*W/2*.82,z+H]]);
        const front=rail(-foot,-2*s),back=rail(foot,2*s);
        const view=k.towardViewer(P),frontNear=view[0]<0;
        const draw=(pair,rungs)=>{let o='';const sortRails=pair.slice().sort((a,b)=>k.depthOf(a[0],P)-k.depthOf(b[0],P));
          o+=isoCRod(sc,...sortRails[0],1.3*s,{tone:'mid'});
          if(rungs)for(let i=1;i<=5;i++){const t=i/6,a=sortRails[0][0].map((c,j)=>c+(sortRails[0][1][j]-c)*t),b=sortRails[1][0].map((c,j)=>c+(sortRails[1][1][j]-c)*t);o+=isoCRod(sc,a,b,1.1*s,{tone:i===3?'hi':'mid',lit:i===3});}
          o+=isoCRod(sc,...sortRails[1],1.3*s,{tone:'mid'});return o;};
        const fr=draw(front,true),bk=draw(back,false);
        let o=frontNear?bk+fr:fr+bk;
        o+=isoS(k.slabOf({x:x-5*s,y:y-W*.5,w:10*s,d:W,r:1},z+H,2.6*s,P,3,.4),{tone:'hi'});
        return {svg:o,top:z+H+2.6*s};
      },
      // A small arched bridge over a channel; v1 a plank across a gap.
      bridge(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,W=14*s,L=26*s;
        let o=isoS(k.slabOf({x:x-6*s,y:y-22*s,w:12*s,d:44*s,r:1},z-.1,.1,P,3),{tone:'hi',lit:false,className:'rv-water',flat:true})+isoL([-.3,0,.3].map(t=>k.lineOnTop([x-2*s,y+t*36*s-4*s],[x+2*s,y+t*36*s+4*s],z,P)).join(''),{tone:'faint'});
        if(v){for(const sx of [-1,1])o+=isoS(k.slabOf({x:x+sx*(6*s)+(sx<0?-12*s:0),y:y-12*s,w:12*s,d:24*s,r:1},z,6*s,P,3,.5),{tone:'mid'});
          o+=isoS(k.slabOf({x:x-13*s,y:y-4*s,w:26*s,d:8*s,r:.6},z+6*s,1.8*s,P,3,.3),{tone:'hi',lit:true});
          return {svg:o,top:z+8*s};}
        const N=24,top=t=>z+10*s+Math.sin(t*Math.PI)*5*s;
        const outer=Array.from({length:N+1},(_,i)=>{const t=i/N;return [-L+2*L*t,top(t)-z];});
        const inner=Array.from({length:N+1},(_,i)=>{const t=1-i/N,a=t*Math.PI;return [-Math.cos(a)*8*s,Math.sin(a)*8*s];});
        const poly=[[-L,0],...outer.slice(1,-1),[L,0],[8*s,0],...inner.slice(1,-1),[-8*s,0]].map(([u,w])=>[u,w]);
        // reverse outer ordering so it runs left → right on top, then back along the arch
        const ring=[[-L,0],[-8*s,0],...inner.slice(1,-1).reverse(),[8*s,0],[L,0],...outer.slice().reverse()];
        const pr=isoCPrism(sc,[x,y,z],isoCX,isoCZ,isoCY,ring,W,{tone:'hi',lit:true});
        const view=k.towardViewer(P),near=Math.sign(view[1])||1;
        const posts=side=>{let d='';const yy=y+side*(W/2-1*s);for(let i=2;i<=N-2;i+=4){const t=i/N,xx=x-L+2*L*t;d+=isoS(k.cylinder(xx,yy,.8*s,top(t),5*s,P,8),{tone:'mid',crease:'none'});}
          d+=isoL(isoPoly(sc,Array.from({length:N-3},(_,j)=>{const t=(j+2)/N;return [x-L+2*L*t,yy,top(t)+5*s];})),{tone:'mid'});return d;};
        o+=posts(-near)+pr.svg+posts(near);
        return {svg:o,top:z+20*s};
      },
      // A big light bulb on a stand, glowing; v1 unlit glass, the filament lit.
      lightbulb(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,F=IsoL.frameAlong([x,y,z],ISO_UP);
        let o=isoS(k.cylinder(x,y,11*s,z,3*s,P,40,.6),{tone:'mid'});
        o+=isoS(IsoL.lathe([[3*s,0],[3*s,6*s],[11*s,5.4*s],[13*s,4.2*s],[13*s,0]],F,P,{rims:'all'}),{tone:'mid'})+isoL([5,7,9,11].map(h=>k.sideArc(x,y,5.8*s,z+h*s,P,24)).join(''),{tone:'lo'});
        const g=Array.from({length:17},(_,i)=>{const t=i/16,h=13*s+t*25*s,r=t<.35?5.6*s+(t/.35)*5*s:t<.55?10.6*s+Math.sin((t-.35)/.2*Math.PI/2)*3.4*s:14*s*Math.sqrt(Math.max(0,1-Math.pow((t-.55)/.45,2)));return [h,i===16?0:r,true];});
        o+=isoS(IsoL.lathe(g,F,P,{rims:'first',smooth:true}),v?{tone:'hi',className:'iso-glass'}:{tone:'hi',lit:true});
        const fz=z+27*s,fil=Array.from({length:9},(_,i)=>[x-6*s+i*1.5*s,y,fz+(i%2?3:0)*s]);
        o+=isoL(isoPoly(sc,[[x-2.2*s,y,z+14*s],[x-6*s,y,fz]])+isoPoly(sc,[[x+2.2*s,y,z+14*s],[x+6*s,y,fz]]),{tone:'mid'})+isoL(isoPoly(sc,fil),{tone:v?'lit':'hi'});
        return {svg:o,top:z+38*s};
      },
      // An upright heart on a stand; v1 the heart with a mended crack.
      heart(sc,x,y,z,s,v){
        const {P}=sc,k=isoK,R=8*s,cy=26*s;
        let o=isoS(k.slabOf({x:x-11*s,y:y-7*s,w:22*s,d:14*s,r:2},z,3*s,P,4,.6),{tone:'mid'})+isoS(k.cylinder(x,y,1.6*s,z+3*s,6*s,P,12),{tone:'mid',crease:'none'});
        const pts=[];
        const lobe=(cx,from,to)=>{for(let i=0;i<=14;i++){const a=from+(to-from)*i/14;pts.push([cx+Math.cos(a)*R,cy+Math.sin(a)*R]);}};
        pts.push([0,9*s-z*0]);
        lobe(R*.95,-Math.PI*.28,Math.PI);
        lobe(-R*.95,0,Math.PI*1.28);
        const poly=pts.map(([u,h])=>[u,h-z*0]);
        const pr=isoCPrism(sc,[x,y,z],isoCX,isoCZ,isoCY,poly,5*s,{tone:'hi',lit:!v});
        o+=pr.svg;
        if(v){const f=pr.face,crack=[[0,cy+2*s],[-2*s,cy-3*s],[1.5*s,cy-7*s],[-1*s,cy-11*s],[0,14*s]];
          o+=isoL(isoPoly(sc,crack.map(f)),{tone:'hi'})+isoL([1,2,3].map(i=>{const [u,h]=crack[i];return isoPoly(sc,[f([u-2.4*s,h+1*s]),f([u+2.4*s,h-1*s])]);}).join(''),{tone:'lit'});}
        return {svg:o,top:z+cy+R};
      },
    });
    Object.assign(ISO_OBJECT_WORDS,{map:'a folded map with a route and a pin',trophy:'a trophy cup on a plinth',megaphone:'a megaphone sending out sound',balloon:'a balloon tied to a weight',dice:'a pair of dice',kite:'a kite on its string',fence:'a fence with a gate',bathtub:'a bathtub of water',faucet:'a running tap over a basin',dominoes:'a row of falling dominoes',tree:'a tree bearing fruit',honeycomb:'a honeycomb, some cells filled',ladder:'a step ladder',bridge:'a small arched bridge',lightbulb:'a glowing light bulb',heart:'a heart on a stand'});

  // ---------- Drawing a plan ----------
  // Objects come from the set above or from the bench stations (a bell, gears, a lamp…).
  const isoSceneMaker=name=>Object.hasOwn(ISO_OBJECTS,name)?ISO_OBJECTS[name]:Object.hasOwn(ISO_STATIONS,name)?ISO_STATIONS[name]:null;
  const isoSceneWords=name=>ISO_OBJECT_WORDS[name]||ISO_STATION_WORDS[name]||name;
  // A plan the reader can draw for `count` parts, or null: one known object per part, no repeats.
  function isoSceneOk(plan,count){
    const objects=Array.isArray(plan?.objects)?plan.objects:[];
    if(objects.length!==count||objects.some(o=>typeof o!=='string'||!isoSceneMaker(o))||new Set(objects).size!==count)return null;
    return {objects,link:['path','beam','none'].includes(plan.link)?plan.link:'none',vars:objects.map((_,i)=>plan.vars?.[i]?1:0)};
  }
  // How one object leads to the next: a path on the bench, a beam of light, or nothing.
  function isoLink(sc,a,b,kind,from){
    const {P,add,depth}=sc,k=isoK;
    if(kind==='beam'&&from){const [lx,ly,lz]=from,tx=b[0]-4,pts=[[tx,b[1]-18,lz+18],[tx,b[1]+18,lz+18],[tx,b[1]-18,lz-4],[tx,b[1]+18,lz-4]];
      add(depth([(lx+tx)/2,ly,lz])+40,isoL(pts.map(p=>k.segment([lx,ly,lz],p,P)).join(''),{tone:'lit',dashed:true}));return;}
    if(kind==='path'||kind==='beam'){const [p,q]=isoRim(a,b,34),pts=[[p[0],p[1],.2],[q[0],q[1],.2]];
      add(depth([(p[0]+q[0])/2,(p[1]+q[1])/2,0])-60,isoL(k.pathOf(pts.map(p=>k.iso(p,P))),{tone:'lit',flow:true}));
      const ux=Math.sign(q[0]-p[0]);add(depth([q[0],q[1],0])-60,isoL(k.pathOf([[q[0]-ux*5,q[1]-4,.2],[q[0],q[1],.2],[q[0]-ux*5,q[1]+4,.2]].map(p=>k.iso(p,P))),{tone:'lit'}));}
  }
  // Draw a scene: {objects:[name…], link, vars:[0|1…], az}. One object per part, set in a row.
  function isoScenePicture(spec){
    const key='s'+JSON.stringify(spec);
    if(isoCache.has(key))return isoCache.get(key);
    isoStyle();
    const n=spec.objects.length,D=96,L=(n-1)*D,spots=Array.from({length:n},(_,i)=>[-L/2+i*D,0,0,1]);
    const PL={x:-L/2-58,y:-54,w:L+116,d:108,r:8},box=[...isoK.boxCorners(PL,-16,0)];
    for(const [x,y,z] of spots)box.push(...isoK.boxCorners({x:x-40,y:y-36,w:80,d:72},z,z+76));
    const sc=isoScene(680,400,box,{azimuth:spec.az??45});
    isoBenchPlate(sc,PL);
    let prev=null;
    spots.forEach(([x,y,z,s0],i)=>{const s=s0*1.5,r=isoSceneMaker(spec.objects[i])(sc,x,y,z,s,spec.vars?.[i]||0);
      sc.add(sc.depth([x,y,z]),`<path class="iso-halo" d="${isoK.haloOf({x:x-24*s,y:y-22*s,w:48*s,d:44*s,r:20*s},z,.1,sc.P)}" style="filter:blur(3px);opacity:.25"/>`+r.svg,i);
      if(i>0)isoLink(sc,spots[i-1],[x,y,z,1],spec.link||'none',prev);
      prev=r.lens||null;});
    const names=spec.objects.map(isoSceneWords);
    const out=sc.render(`A picture: ${names.slice(0,-1).join(', ')}${n>1?' and ':''}${names[n-1]}.`);
    isoCache.set(key,out);return out;
  }
