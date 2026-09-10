/* English presentation of the saved analysis; coordinates and counts are read unchanged. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), data={}, cache={};
 const fetchData=name=>cache[name]||(cache[name]=fetch(`${name}.json`).then(r=>{if(!r.ok)throw Error(`Could not load ${name} data (${r.status}).`);return r.json();}).catch(e=>{delete cache[name];throw e;}));
 const numeric=p=>p.every(Number.isFinite), fmt=n=>n.toLocaleString('en-US');
 const item=(xyz,color,info,context=false)=>({xyz,color,info,context});
 function option(id,label,value){$(id).add(new Option(label,value));}
 function legend(id,items){$(id).replaceChildren(...items.map(([label,color])=>{const span=document.createElement('span'),dot=document.createElement('i');dot.style.background=color;span.append(dot,document.createTextNode(label));return span;}));}
 function heat(n,max){const t=Math.min(1,Math.log1p(n)/Math.log1p(max||1));return `hsl(${205-185*t} 65% ${75-30*t}%)`;}
 function panel(name){
  const canvas=$(`${name}-canvas`),ctx=canvas.getContext('2d'),tip=$(`${name}-tip`);
  const p={name,canvas,points:[],mesh:null,breaks:[],axes:['X','Y','Z'],center:[0,0,0],span:1,yaw:-.55,pitch:.4,zoom:1,projected:[],queued:false,draws:0};
  p.set=(points,fitPoints,mesh=null,breaks=[])=>{
   p.points=points.filter(x=>numeric(x.xyz));p.mesh=mesh;p.breaks=breaks;
   const fit=(fitPoints?.length?fitPoints:p.points.map(x=>x.xyz)).filter(numeric);
   if(fit.length){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const x of fit)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],x[k]);hi[k]=Math.max(hi[k],x[k]);}p.center=lo.map((v,k)=>(v+hi[k])/2);p.span=Math.max(...lo.map((v,k)=>hi[k]-v),.1);p.zoom=1;}
   tip.hidden=true;p.schedule();
  };
  p.project=(xyz,w,h)=>{const [a,b,c]=xyz.map((v,k)=>v-p.center[k]),x=a*Math.cos(p.yaw)-b*Math.sin(p.yaw),y=a*Math.sin(p.yaw)+b*Math.cos(p.yaw),z=c*Math.cos(p.pitch)-y*Math.sin(p.pitch),depth=c*Math.sin(p.pitch)+y*Math.cos(p.pitch),s=Math.min(w,h)*.76/p.span*p.zoom;return [w/2+x*s,h/2-z*s,depth];};
  const line=(points,color,width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach((a,i)=>i?ctx.lineTo(a[0],a[1]):ctx.moveTo(a[0],a[1]));ctx.stroke();};
  p.draw=()=>{
   p.queued=false;p.draws++;const {width:w,height:h}=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);if(!w||!h)return;
   canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#f5f8fa';ctx.fillRect(0,0,w,h);
   if(p.mesh){ctx.globalAlpha=.15;for(const face of p.mesh.faces){const q=face.map(i=>p.project(p.mesh.vertices[i],w,h));line([...q,q[0]],'#39857b',.6);}ctx.globalAlpha=1;}
   p.projected=p.points.map(v=>({...v,q:p.project(v.xyz,w,h)})).sort((a,b)=>a.q[2]-b.q[2]);
   for(const v of p.projected){ctx.globalAlpha=v.context?.19:.88;ctx.fillStyle=v.color;const r=v.context?1.05:2.15;ctx.beginPath();ctx.arc(v.q[0],v.q[1],r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
   for(const br of p.breaks){const q=p.project([p.center[0]-p.span*.39,p.center[1],br.z],w,h);line([[q[0]-6,q[1]],[q[0]+6,q[1]]],'#c3584c',2);ctx.fillStyle='#a84b40';ctx.font='9px Segoe UI';ctx.fillText(br.label,q[0]+10,q[1]+3);}
   const origin=[42,h-42], colors=['#a56859','#528b80','#7184a6'];p.axes.forEach((label,k)=>{const v=[...p.center];v[k]+=p.span*.11;const a=p.project(v,w,h),b=p.project(p.center,w,h),end=[origin[0]+(a[0]-b[0])/p.zoom,origin[1]+(a[1]-b[1])/p.zoom];line([origin,end],colors[k],1.6);ctx.fillStyle=colors[k];ctx.font='10px Segoe UI';ctx.fillText(label,end[0]+3,end[1]);});
   if(!p.points.some(v=>!v.context)){ctx.fillStyle='#536e7b';ctx.font='12px Segoe UI';ctx.textAlign='center';ctx.fillText('No candidate cells in this selection',w/2,h-24);ctx.textAlign='left';}
  };
  p.schedule=()=>{if(!p.queued){p.queued=true;requestAnimationFrame(p.draw);}};
  let drag;
  canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);tip.hidden=true;});
  canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
  canvas.addEventListener('pointermove',e=>{if(drag){p.yaw+=(e.clientX-drag[0])*.009;p.pitch=Math.max(-1.5,Math.min(1.5,p.pitch+(e.clientY-drag[1])*.009));drag=[e.clientX,e.clientY];p.schedule();return;}const b=canvas.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;let found,dist=81;for(const v of p.projected){if(v.context)continue;const d=(v.q[0]-x)**2+(v.q[1]-y)**2;if(d<dist){dist=d;found=v;}}tip.hidden=!found;if(found)tip.textContent=found.info;});
  canvas.addEventListener('pointerleave',()=>{tip.hidden=true;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();p.zoom=Math.max(.25,Math.min(8,p.zoom*Math.exp(-e.deltaY*.001)));p.schedule();},{passive:false});
  canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')p.yaw-=.1;if(e.key==='ArrowRight')p.yaw+=.1;if(e.key==='ArrowUp')p.pitch-=.1;if(e.key==='ArrowDown')p.pitch+=.1;if(e.key==='+')p.zoom=Math.min(8,p.zoom*1.2);if(e.key==='-')p.zoom=Math.max(.25,p.zoom/1.2);if(e.key==='Home'){p.yaw=-.55;p.pitch=.4;p.zoom=1;}p.schedule();}});
  new ResizeObserver(p.schedule).observe(canvas);return p;
 }
 const mouse=panel('mouse'),primate=panel('primate');
 function selection(){return data.matches?.find(m=>m.mouse_supertype===$('comparison').value);}
 function updateMouse(){
  const d=data.mouse;if(!d)return;const gene=$('mouse-gene').value,gi=d.genes.indexOf(gene),chosen=$('comparison').value;
  const rows=d.points.filter(r=>$('specimen').value==='all'||r[1]===+$('specimen').value),max=gi<0?1:Math.max(1,...rows.map(r=>r[8+gi]));
  let count=0;const points=[];
  for(const r of rows){const type=d.dictionary.supertype[r[2]],candidate=Object.hasOwn(d.type_colors,type)&&(chosen==='all'||type===chosen),context=!candidate;
   if(context&&!$('mouse-context').checked)continue;if(candidate)count++;
   const color=context?'#869eaa':gi<0?d.type_colors[type]:heat(r[8+gi],max);
   points.push(item(r.slice(5,8),color,`${d.dictionary.dataset[r[1]]} · ST${type} · Cell ${r[0]}${gi<0?'':` · ${gene}: ${r[8+gi]} counts`}`,context));}
  mouse.axes=['LR','DV','AP'];mouse.set(points,rows.map(r=>r.slice(5,8)));
  $('mouse-count').textContent=`${fmt(count)} candidate-type neurons · ${fmt(points.length)} cells shown`;
  legend('mouse-legend',gi<0?d.candidate_types.filter(t=>chosen==='all'||t.supertype===chosen).map(t=>[t.display_id,d.type_colors[t.supertype]]):[[`${gene}: 0 → ${max} detected counts`,heat(max,max)]]);
 }
 function updateOfficial(){
  const d=data.official;if(!d)return;const chosen=selection()?.primary_primate_cluster,gi=d.genes.indexOf($('official-gene').value),context=$('official-context').checked;
  const scope=d.cells.filter(r=>$('official-scope').value==='all'||r[9]);const max=gi<0?1:Math.max(1,...scope.map(r=>r[12+gi]));let count=0,alternatives=0;
  const points=[];for(const r of scope){const match=!chosen||r[6]===chosen,primary=r[10]&&match,alt=r[11]&&(!chosen||r[6]===selection()?.validation_top_cluster)&&$('alternatives').checked;
   if(!primary&&!alt&&!(context&&r[9]))continue;const bg=!primary&&!alt;if(primary)count++;if(alt)alternatives++;
   const color=bg?'#879eaa':gi>=0?heat(r[12+gi],max):primary?'#d57942':'#7769a2';
   points.push(item(r.slice(0,3),color,`${r[6]} · Section ${r[7]} · Cell ${r[3]}${gi<0?'':` · ${d.genes[gi]}: ${r[12+gi]} counts`}`,bg));}
  primate.axes=['X','Y','Z'];primate.set(points,[...d.vertices,...scope.map(r=>r.slice(0,3))],context?{vertices:d.vertices,faces:d.faces}:null);
  $('primate-count').textContent=`${fmt(count)} primary + ${fmt(alternatives)} alternative candidates · ${fmt(points.length)} cells shown`;
  $('coordinate-note').textContent='Official atlas coordinates (mm) · HTHpo boundary';
  legend('primate-legend',gi<0?[['Primary candidate','#d57942'],['Alternative match','#7769a2'],['Regional context','#879eaa']]:[[`${d.genes[gi]}: 0 → ${max} detected counts`,heat(max,max)]]);
 }
 function updateRegistered(){
  const d=data.registered;if(!d)return;const layer=$('layer').value,chosen=selection()?.primary_primate_cluster,ci=d.clusters.indexOf(chosen),component=+$('component').value;
  $('component').disabled=layer!=='component';$('variant').disabled=layer!=='full';
  function xyz(r,bg=false){const i=layer==='native'?(bg?1:4):layer==='component'?(bg?11:14):({primary:bg?5:8,mass60:bg?7:10,mass95:bg?9:12}[$('variant').value]);return [r[i],r[i+1],r[bg?3:6]];}
  const context=d.background.filter(r=>layer!=='component'||r[4]===component),rows=d.cells.filter(r=>(layer!=='component'||r[7]===component)&&r[3]>=+$('score').value&&(ci<0||r[2]===ci));
  const points=$('registered-context').checked?context.map(r=>item(xyz(r,true),'#829ba8','',true)):[];
  for(const r of rows)points.push(item(xyz(r),d.colors[r[2]],`${d.clusters[r[2]]} · Section ${r[1]} · RNA label score ${r[3].toFixed(2)} · Cell ${r[0]}`));
  const breaks=layer==='component'?[]:d.qa.hard_breakpoints_reference.map(s=>({z:(d.sections.find(x=>x.section===s).nominal_AP_mm+d.sections.find(x=>x.section===s+1).nominal_AP_mm)/2,label:`${s} / ${s+1}`}));
  primate.axes=['X','Y','AP'];primate.set(points,context.map(r=>xyz(r,true)),null,breaks);
  $('primate-count').textContent=`${fmt(rows.length)} candidate cells · ${new Set(rows.map(r=>r[1])).size} sections`;
  $('coordinate-note').textContent=layer==='component'?`Local component ${component} · coordinates in mm`:layer==='native'?'Original section coordinates · nominal AP spacing (mm)':'47-section reconstruction · six registration breaks marked in red';
  legend('primate-legend',d.clusters.map((c,i)=>[c.replace('cluster_','c'),d.colors[i]]).filter((_,i)=>ci<0||ci===i));
 }
 const updatePrimate=()=>$('primate-model').value==='official'?updateOfficial():updateRegistered();
 function showError(e){$('error').hidden=false;$('error').textContent=`${e.message} Refresh the viewer to try again.`;}
 $('primate-model').addEventListener('change',async()=>{
  const registered=$('primate-model').value==='registered';$('official-controls').hidden=registered;$('registered-controls').hidden=!registered;$('error').hidden=true;
  if(registered&&!data.registered){$('primate-count').textContent='Loading the 47-section reconstruction…';primate.set([],[]);try{data.registered=await fetchData('registered');for(const c of data.registered.components)option('component',`C${c.component_id} · sections ${c.first_section}–${c.last_section}`,c.component_id);$('component').value='4';}catch(e){showError(e);return;}}
  updatePrimate();
 });
 $('comparison').addEventListener('change',()=>{const m=selection();$('match-note').textContent=m?`ST${m.mouse_supertype.slice(0,4)} → ${m.primary_primate_cluster}${m.discovery_validation_top_agree?' · same top match across two gene sets':` · second gene set favors ${m.validation_top_cluster}`}`:'Choose a type to follow its RNA-based candidate match.';updateMouse();updatePrimate();});
 for(const id of ['specimen','mouse-gene','mouse-context'])$(id).addEventListener('change',updateMouse);
 for(const id of ['official-scope','official-gene','official-context','alternatives','layer','component','variant','score','registered-context'])$(id).addEventListener('change',updatePrimate);
 document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{const p=button.dataset.panel==='mouse'?mouse:primate;switch(button.dataset.action){case'in':p.zoom=Math.min(8,p.zoom*1.2);break;case'out':p.zoom=Math.max(.25,p.zoom/1.2);break;case'reset':p.yaw=-.55;p.pitch=.4;p.zoom=1;break;case'save':p.draw();{const a=document.createElement('a');a.href=p.canvas.toDataURL('image/png');a.download=`${p.name}-spatial-view.png`;a.click();}return;}p.schedule();}));
 Promise.all([fetchData('mouse'),fetchData('official'),fetchData('matches')]).then(([m,o,c])=>{data.mouse=m;data.official=o;data.matches=c;for(const t of m.candidate_types)option('comparison',`${t.display_id} · ${t.supertype.replace(/^\d+ /,'')}`,t.supertype);for(const g of m.genes)option('mouse-gene',g,g);for(const g of o.genes)option('official-gene',g,g);updateMouse();updatePrimate();}).catch(showError);
})();
