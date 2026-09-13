(()=>{'use strict';
const $=id=>document.getElementById(id),D={},cache={},fmt=x=>Number(x).toLocaleString('en-US');let epoch=0;const hiddenRegions=new Set();
const fetchData=n=>cache[n]||(cache[n]=(async()=>{const compressed=typeof DecompressionStream==='function';const r=await fetch('data/'+n+'.json'+(compressed?'.gz':''));if(!r.ok)throw Error('Data unavailable: '+n);return compressed?new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json():r.json()})().catch(e=>{delete cache[n];throw e}));
const error=e=>{$('error').hidden=false;$('error').textContent=e.message||String(e)};
function legend(id,items){$(id).replaceChildren(...items.map(([label,c])=>{const s=document.createElement('span'),i=document.createElement('i');i.style.borderColor=c;s.append(i,document.createTextNode(label));return s}))}
function makePanel(name){
 const cv=$(name+'-canvas'),ctx=cv.getContext('2d'),tip=$(name+'-tip');
 const p={name,cv,points:[],outlines:[],center:[0,0,0],span:1,yaw:-.5,pitch:.37,zoom:1,axes:['X','Y','AP'],title:'',footer:'',projected:[],breaks:[]};
 p.fit=arr=>{if(!arr.length)return;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const a of arr)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],a[k]);hi[k]=Math.max(hi[k],a[k])}p.center=lo.map((x,k)=>(x+hi[k])/2);p.span=Math.max(.1,...lo.map((x,k)=>hi[k]-x))};
 p.project=(xyz,w,h)=>{const a=xyz[0]-p.center[0],b=xyz[1]-p.center[1],c=xyz[2]-p.center[2],x=a*Math.cos(p.yaw)-b*Math.sin(p.yaw),y=a*Math.sin(p.yaw)+b*Math.cos(p.yaw),z=c*Math.cos(p.pitch)-y*Math.sin(p.pitch),depth=c*Math.sin(p.pitch)+y*Math.cos(p.pitch),s=Math.min(w,h)*.75*p.zoom/p.span;return [w/2+x*s,h/2-z*s,depth]};
 p.draw=()=>{const box=cv.getBoundingClientRect(),w=box.width,h=box.height;if(!w||!h)return;const d=Math.min(2,devicePixelRatio||1);cv.width=Math.round(w*d);cv.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#f5f8fa';ctx.fillRect(0,0,w,h);
  p.projected=p.points.map(a=>({...a,q:p.project(a.xyz,w,h)})).sort((a,b)=>a.q[2]-b.q[2]);
  for(const a of [...p.projected.filter(a=>!a.selected),...p.projected.filter(a=>a.selected)]){ctx.fillStyle=a.bg?'#8fa4af':a.color||'#d5873e';ctx.globalAlpha=a.alpha??(a.bg?.08:.95);ctx.beginPath();ctx.arc(a.q[0],a.q[1],a.radius??(a.bg?.65:4.0),0,2*Math.PI);ctx.fill()}ctx.globalAlpha=1;
  for(const r of p.outlines){ctx.strokeStyle=r.color;ctx.lineWidth=1.0;ctx.setLineDash([6,5]);for(const o of r.outlines){ctx.beginPath();o.xyz.forEach((xyz,i)=>{const a=p.project(xyz,w,h);i?ctx.lineTo(a[0],a[1]):ctx.moveTo(a[0],a[1])});ctx.stroke()}ctx.setLineDash([])}
  for(const br of p.breaks){const q=p.project([p.center[0]-p.span*.32,p.center[1],br.z],w,h);ctx.fillStyle='#b1524e';ctx.font='9px Segoe UI';ctx.fillText('break '+br.label,q[0],q[1])}
  const org=[34,h-62];p.axes.forEach((label,k)=>{let v=[...p.center];v[k]+=p.span*.075;const a=p.project(v,w,h),b=p.project(p.center,w,h),x=org[0]+(a[0]-b[0])/p.zoom,y=org[1]+(a[1]-b[1])/p.zoom;ctx.strokeStyle=['#9c625c','#54867a','#667fa0'][k];ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(...org);ctx.lineTo(x,y);ctx.stroke();ctx.font='9px Segoe UI';ctx.fillText(label,x+2,y)});
  const mm=p.span>8?2:.5,pix=mm*Math.min(w,h)*.75*p.zoom/p.span;ctx.strokeStyle='#536f7b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w-26-pix,h-40);ctx.lineTo(w-26,h-40);ctx.stroke();ctx.fillStyle='#536f7b';ctx.font='10px Segoe UI';ctx.fillText(mm+' mm',w-26-pix,h-47);
  ctx.font='10px Segoe UI';ctx.fillStyle='#54717c';ctx.fillText(p.footer.slice(0,100),12,h-12);
 };
 let pending=false;p.refresh=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;p.draw()})};let drag;
 function rotate(dx,dy){p.yaw+=dx;p.pitch=Math.max(-1.5,Math.min(1.5,p.pitch+dy));p.refresh();if($('link-rotation').checked){const other=panels[name==='mouse'?'primate':'mouse'];other.yaw=p.yaw;other.pitch=p.pitch;other.refresh()}}
 cv.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];cv.setPointerCapture(e.pointerId);tip.hidden=true});cv.addEventListener('pointerup',()=>drag=null);cv.addEventListener('pointercancel',()=>drag=null);
 cv.addEventListener('pointermove',e=>{if(drag){rotate((e.clientX-drag[0])*.009,(e.clientY-drag[1])*.009);drag=[e.clientX,e.clientY];return}const b=cv.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;let best=null,dist=70;for(const a of p.projected){if(a.bg)continue;const v=(a.q[0]-x)**2+(a.q[1]-y)**2;if(v<dist){dist=v;best=a}}tip.hidden=!best;if(best)tip.textContent=best.info});cv.addEventListener('pointerleave',()=>tip.hidden=true);
 cv.addEventListener('wheel',e=>{e.preventDefault();p.zoom=Math.max(.3,Math.min(10,p.zoom*Math.exp(-e.deltaY*.001)));p.refresh()},{passive:false});cv.addEventListener('keydown',e=>{const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];if(keys.includes(e.key)){e.preventDefault();rotate(e.key==='ArrowLeft'?-.1:e.key==='ArrowRight'?.1:0,e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0)}});new ResizeObserver(p.refresh).observe(cv);return p;
}
const panels={mouse:makePanel('mouse'),primate:makePanel('primate')};

Promise.all([fetchData('mouse'),fetchData('review_regions')]).then(([d,regions])=>{
 const hit=i=>d.counts.PTGER3[i]>=2&&d.counts.LEPR[i]>=2,st=i=>d.type[i].startsWith('0520 ');
 const records=[];for(const [name,animal] of [['mouse','ABCA1'],['primate','ABCA2']]){
  const p=panels[name],fit=[],rows=[];let n=0,ns=0;
  for(let i=0;i<d.n;i++){if(d.dataset[i]!==animal)continue;fit.push(d.xyz[i]);const h=hit(i),s=st(i);if(h){n++;if(s)ns++;}rows.push({xyz:d.xyz[i],bg:!h&&!s,selected:h,color:h?(s?'#c05831':'#6653a1'):'#5c8192',radius:h?4.0:s?1.15:.65,alpha:h?1:s?.33:.065,info:d.ids[i]+' · '+d.type[i]+' · Ptger3 '+d.counts.PTGER3[i]+' · Lepr '+d.counts.LEPR[i]})}
  p.points=rows;p.fit(d.xyz);p.axes=['LR','−DV','AP'];p.yaw=-.45;p.pitch=.37;p.zoom=1.12;p.outlines=[];p.footer='Atlas coordinates · equal scale';p.refresh();$(name+'-count').textContent=n+' double-positive cells · '+ns+' assigned to ST0520';records.push({animal,n,ST0520:ns});
 }
 const ids=Array.from({length:d.n},(_,i)=>i).filter(hit),box=$('profile');for(const [gene,label] of [['SLC17A6','Slc17a6 (Vglut2)'],['ADCYAP1','Adcyap1 (PACAP)'],['BDNF','Bdnf'],['GAL','Gal']]){const n=ids.filter(i=>d.counts[gene][i]>=2).length,r=document.createElement('div');r.className='barrow';r.innerHTML='<span>'+label+'</span><div class="track"><i style="width:'+n/38*100+'%"></i></div><b>'+n+'/38</b>';box.append(r)}
 $('mode').onchange=()=>{const background=$('mode').value==='context';for(const p of Object.values(panels)){p.points.forEach(r=>r.alpha=r.selected?1:background?(r.bg?.065:.33):0);p.refresh()}};
 document.body.dataset.ready='true';$('status').textContent='Selection: Ptger3 ≥2 AND Lepr ≥2 raw counts in the same cell.';
}).catch(error);
})();
