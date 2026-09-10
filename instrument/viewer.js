import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const $ = id => document.getElementById(id);
const parts = [
  {id:'Cage',title:'The observation space',role:'Housing',description:'A transparent Type II cage sits below the two cameras. A sealed warm-water target stands in for an animal during the first coverage checks.',specs:[['Body envelope','268 × 215 × 141 mm'],['Reference','Tecniplast 1264C'],['Floor area','370 cm²']],limit:'The body envelope is sourced. Wall taper, molded details, and 2.5 mm wall thickness are modeling assumptions.'},
  {id:'Thermal camera',title:'Surface temperature',role:'Thermal channel',description:'The Lepton core and PureThermal carrier record a thermal image from above. The optical path is open; there is no plastic window in front of the sensor.',specs:[['Array','160 × 120 pixels'],['Horizontal field','57°'],['Full-frame rate','<9 Hz'],['Carrier PCB','25.8 × 28.9 mm']],limit:'This measures surface radiation, not core temperature. The wire lid can obscure part of the image.'},
  {id:'Activity camera',title:'Movement in the same scene',role:'Activity channel',description:'A Camera Module 3 Wide NoIR provides the activity view. Its flat adapter cable runs outside the cage to the Raspberry Pi.',specs:[['Horizontal / vertical field','102° / 67°'],['PCB','25 × 23.862 mm'],['Hole centers','21 × 12.5 mm'],['Adapter cable','500 mm specified']],limit:'NoIR is a visible/near-infrared camera, not a thermal camera. Any activity measure would need its own validation.'},
  {id:'Ambient sensor',title:'Keep the surroundings in view',role:'Environmental context',description:'An external SHT45 board records temperature and relative humidity. Its ventilated mount is separated from the acquisition electronics.',specs:[['Sensor','SHT45'],['Signals','Temperature · humidity'],['Location','Outside the cage']],limit:'Ambient readings provide context. They do not measure conditions at every point inside the cage.'},
  {id:'Electronics_Assembly',title:'One recording system',role:'Acquisition',description:'The Raspberry Pi, powered USB hub, real-time clock, and two USB flash drives sit together beside the cage. Their cables remain outside the observation space.',specs:[['Host','Raspberry Pi 5 · 4 GB'],['Clock','DS3231'],['Storage','2 × 256 GB USB flash'],['Camera link','USB + CSI']],limit:'The enclosure and routing are proposed. Clock alignment, sustained recording, and recovery after interruption still need bench testing.'},
  {id:'EL_APC_BE600M1_UPS',title:'Keep a power interruption visible',role:'Power',description:'A separate UPS supplies the small acquisition devices through their power adapters. The enclosure is placed on the bench beside the base.',specs:[['UPS','APC BE600M1'],['Rating','600 VA'],['Pi supply','27 W USB-C adapter']],limit:'The UPS does not power a heater or cooling system. Runtime has not been measured for this proposed load.'},
  {id:'Camera mounts',title:'A common mechanical reference',role:'Mounting',description:'Two adjustable arms share a rigid support. Camera height and angle can be set independently while the cage stays in a repeatable position.',specs:[['Arms','2 × SmallRig 4862'],['Plate envelope','155 × 80 × 10 mm'],['Support','Proposed frame']],limit:'Joint geometry, clamps, and the overall frame are a proposed arrangement, not manufacturer-certified CAD.'},
  {id:'Grid lid',title:'Inspect the obstruction',role:'Removable lid',description:'The selected lid is a flat wire grid without a feed hopper. Lifting it in the model makes it easier to compare the optical path and inspect the target.',specs:[['Reference','1264C025'],['Material','Stainless steel'],['Hopper','None']],limit:'Wire pitch and clips are illustrative. “Camera fields” shows ideal geometric coverage, before grid obstruction and other optical losses.'},
  {id:'Optional piezo',title:'An optional extra signal',role:'Conditional module',description:'Two piezo elements and a separate ADC are shown on an external support. I would add this channel only if it provides a useful signal in preliminary tests.',specs:[['Elements','2 × piezo film'],['ADC','ADS1115'],['Status','Optional']],limit:'This is not a validated respiration measurement. The plate, mounting, and readout arrangement remain provisional.'}
];
const calibrationInfo={title:'A separate calibration bench',role:'Calibration accessories',description:'A water bath, contact reference probe, and matte targets support bench checks. This kit is separate from the observation cage and is not part of an automatic control loop.',specs:[['Bath','12 qt container + circulator'],['Reference','PT100 · MAX31865'],['Target','Matte surface + four marks']],limit:'Illustrative calibration arrangement. The probe contact, emissivity, stability, and uncertainty would need to be checked in the physical setup.'};
$('component-select').innerHTML=parts.map((p,i)=>`<option value="${p.id}">${String(i+1).padStart(2,'0')} · ${p.role}</option>`).join('');
function showInfo(p,index){$('component-role').textContent=p.role;$('component-title').textContent=p.title;$('component-description').textContent=p.description;$('component-limit').textContent=p.limit;$('component-specs').innerHTML=p.specs.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');$('part-number').textContent=index===undefined?'KIT':`${String(index+1).padStart(2,'0')} / 09`;}
showInfo(parts[0],0);
let renderer,scene,camera,controls,model,calibration,activeModel,selection,selectionBox,ground,fieldGroup,dimensionGroup;
let running=false,visible=true,framePending=false,explode=0,lidRaised=false,fields=false,dimensions=false,calibrating=false;
let tween=null,lastFrame=performance.now(),time=0,quality='clear',lastState='',selectionKey='Cage',renderCount=0,renderDirty=true,cameraInspection=false;
let coverage=false,coveragePoints,coverageResult;
const homes=new Map(),dimensionLabels=[],viewport=$('viewport'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const loader=new GLTFLoader(),mouse=new THREE.Vector2(),raycaster=new THREE.Raycaster();
const convert=(x,y,z)=>new THREE.Vector3(x,z,-y);
const find=(root,id)=>{let found;root?.traverse(o=>{if(!found&&!o.isMesh&&(o.userData.component_id===id||o.name===id||o.name===id.replaceAll(' ','_')))found=o;});return found;};
function controlsEnabled(value){document.querySelectorAll('.model-tools button,.model-tools input,.view-buttons button,.assembly-switch button,.zoom-tools button').forEach(b=>b.disabled=!value);}
controlsEnabled(false);
function failure(message){$('loading').hidden=false;$('loading').classList.add('error');$('loading').textContent=message;$('poster').hidden=false;controlsEnabled(false);window.instrumentDiagnostics={...(window.instrumentDiagnostics||{}),error:message};}
function setupModel(root){root.traverse(o=>{homes.set(o,o.position.clone());if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(m.transmission>0){o.castShadow=false;m.envMapIntensity=1.15;}else m.envMapIntensity=.8;}}});}
// Replay can schedule its DOM updates without dirtying an unchanged 3D scene.
function requestRender(mark3D=true){if(mark3D!==false)renderDirty=true;if(!framePending&&!document.hidden&&(visible||running)&&(renderer||running)){framePending=true;requestAnimationFrame(frame);}}
// Camera inspection may look upward at a lens, while the eye stays above the bench.
function limitOrbit(){if(!controls||!camera)return;const distance=camera.position.distanceTo(controls.target),clearance=controls.target.y-.008;controls.maxPolarAngle=cameraInspection?Math.min(Math.PI*.66,Math.acos(THREE.MathUtils.clamp(-clearance/Math.max(distance,.001),-1,1))):Math.PI*.49;}
function frame(now){framePending=false;if(document.hidden){lastFrame=now;return;}const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
  if(tween){const t=Math.min((now-tween.start)/tween.duration,1),e=t*t*(3-2*t);camera.position.lerpVectors(tween.from,tween.to,e);controls.target.lerpVectors(tween.targetFrom,tween.targetTo,e);renderDirty=true;if(t>=1)tween=null;}
  limitOrbit();
  const damping=controls?.update();
  if(cameraInspection&&camera.position.y<.008-1e-8){camera.position.y=.008;limitOrbit();controls.update();renderDirty=true;}
  if(running){time=Math.min(120,time+dt*5);updateSignals();if(time>=120)setPlaying(false);}
  dimensionLabels.forEach(({el,point})=>{const p=point.clone().project(camera);el.style.left=`${(p.x+1)*viewport.clientWidth/2}px`;el.style.top=`${(-p.y+1)*viewport.clientHeight/2}px`;el.hidden=!dimensions||calibrating||explode>.005||p.z>1||p.z< -1;});
  if(visible&&renderer&&scene&&camera&&renderDirty){renderer.render(scene,camera);renderDirty=false;renderCount++;}
  window.instrumentDiagnostics={ready:!!model,error:model?null:window.instrumentDiagnostics?.error,renderCount,renderDirty,cameraInspection,cameraPosition:camera?.position.toArray(),cameraTarget:controls?.target.toArray(),maxPolarAngle:controls?.maxPolarAngle,meshes:renderer?.info.memory.geometries,drawCalls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,modelVisible:!!activeModel?.visible,calibration:calibrating,explode,lidRaised,fields,dimensions,coverage:coverage?coverageResult:null,selected:selectionKey,simulated:true,time,quality,pixelRatio:renderer?.getPixelRatio(),canvas:renderer?[renderer.domElement.width,renderer.domElement.height]:null};
  if(tween||damping||running)requestRender(false);
}
function resize(){if(!renderer)return;const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();requestRender();}
function bounds(root=activeModel){return new THREE.Box3().setFromObject(root);}
function goView(view='perspective',targetObject=null){if(!model)return;const box=bounds(targetObject||activeModel),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());const radius=size.length()/2;
  const limitingFov=2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.min(camera.aspect,1));
  let distance=radius/Math.sin(limitingFov/2);
  if(view==='detail'&&!targetObject){const part=find(activeModel,selectionKey)||activeModel;return goView('detail',part);}
  distance=Math.max(distance,.11);
  cameraInspection=view==='detail'&&!calibrating&&['Thermal camera','Activity camera'].some(id=>targetObject===find(model,id));
  controls.maxPolarAngle=cameraInspection?Math.PI*.66:Math.PI*.49;
  const direction=({front:new THREE.Vector3(0,.22,1),top:new THREE.Vector3(0,1,.0001),detail:cameraInspection?new THREE.Vector3(1,-.65,1.3):new THREE.Vector3(1,.75,1.3)})[view]||new THREE.Vector3(1.15,.82,1.6);
  direction.normalize();const right=new THREE.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right).normalize();
  const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*camera.aspect;distance=.055;
  const fitPoints=[];(targetObject||activeModel).traverse(o=>{if(!o.isMesh)return;let parent=o;while(parent){if(!parent.visible)return;parent=parent.parent;}o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])fitPoints.push(new THREE.Vector3(x,y,z).applyMatrix4(o.matrixWorld));});
  const xs=fitPoints.map(p=>p.clone().sub(center).dot(right)),ys=fitPoints.map(p=>p.clone().sub(center).dot(up));center.addScaledVector(right,(Math.min(...xs)+Math.max(...xs))/2).addScaledVector(up,(Math.min(...ys)+Math.max(...ys))/2);
  for(const point of fitPoints){const p=point.clone().sub(center),depth=p.dot(direction);distance=Math.max(distance,depth+Math.abs(p.dot(right))/tanH*1.12,depth+Math.abs(p.dot(up))/tanV*1.25);}
  const destination=center.clone().addScaledVector(direction,distance);if(cameraInspection)destination.y=Math.max(.008,destination.y);
  tween={start:performance.now(),duration:reduced?1:550,from:camera.position.clone(),to:destination,targetFrom:controls.target.clone(),targetTo:center};
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));requestRender();
}
function selectPart(id,zoom=false){selectionKey=id;if(!['Thermal camera','Activity camera'].includes(id)){cameraInspection=false;if(controls)controls.maxPolarAngle=Math.PI*.49;}const index=parts.findIndex(p=>p.id===id);if(index>=0){$('component-select').value=id;showInfo(parts[index],index);}selection=find(model,id);if(selectionBox){selectionBox.visible=!!selection&&!calibrating;if(selection)selectionBox.setFromObject(selection);}
  if(zoom)goView('detail',selection);requestRender();
}
function offsetObject(obj,v){if(!obj)return;const local=v.clone().transformDirection(obj.parent.matrixWorld.clone().invert()).multiplyScalar(v.length());obj.position.copy(homes.get(obj)).add(local);}
function pose(){if(!model)return;for(const [obj,home]of homes)obj.position.copy(home);model.updateMatrixWorld(true);
  const moves={'Grid lid':[0,.13,0],'Cage':[0,.035,0],'Bench target':[0,.055,0],'Thermal camera':[-.045,.10,0],'Activity camera':[.045,.10,0],'Camera mounts':[0,.055,-.025],'Ambient sensor':[-.055,.02,0],'Optional piezo':[0,.008,0],'EL_Pi5_Case_Lid':[0,.12,0],'EL_Pi5_Board':[0,.045,0],'EL_Pi5_Fan_Cooler':[0,.078,0],'EL_DS3231_RTC':[.04,.025,0],'EL_Flash_Drive_A':[0,0,.04],'EL_Flash_Drive_B':[0,0,.04]};
  for(const[id,v]of Object.entries(moves)){const delta=new THREE.Vector3(...v).multiplyScalar(explode);if(id==='Grid lid'&&lidRaised)delta.y+=.12;offsetObject(find(model,id),delta);}
  // Keep flexible leads in their assembled route; hide them during mechanical separation.
  for(const id of ['Signal routing','EL_Acquisition_Leads','EL_Power_Cables']){const o=find(model,id);if(o)o.visible=explode<.005;}
  fieldGroup.visible=fields&&!calibrating&&explode<.005;dimensionGroup.visible=dimensions&&!calibrating&&explode<.005;
  if(coveragePoints)coveragePoints.visible=coverage&&!calibrating&&explode<.005&&!lidRaised;
  dimensionLabels.forEach(({el})=>el.hidden=!dimensionGroup.visible);model.updateMatrixWorld(true);if(selection)selectionBox.setFromObject(selection);
  $('view-hint').textContent=calibrating?'Separate calibration accessories · Drag to inspect':explode>.005?'Exploded inspection view · Flexible leads are hidden while parts are separated':coverage&&coverageResult&&!lidRaised?`Illustrative grid: ${coverageResult.blocked} / ${coverageResult.total} rays blocked (${coverageResult.percent}%). Orange = blocked; teal = clear. Geometry only.`:fields?'Ideal camera fields · Wire-grid obstruction is still present': 'Drag to rotate · Scroll / pinch to zoom · Select a part to inspect it';requestRender();
}
function sampleCoverage(){
  if(coveragePoints)return;
  const lid=find(model,'Grid lid'),origin=convert(-.151,-.005,.3156),positions=[],colors=[],clear=new THREE.Color(0x1b9284),blockedColor=new THREE.Color(0xe28c4c);let blocked=0;
  model.updateMatrixWorld(true);const rays=new THREE.Raycaster();
  for(let iy=0;iy<31;iy++)for(let ix=0;ix<41;ix++){const p=convert(-.116-.109+ix*.218/40,-.015-.081+iy*.162/30,.0322),v=p.clone().sub(origin);rays.set(origin,v.clone().normalize());rays.far=v.length();const hit=rays.intersectObject(lid,true).length>0;blocked+=Number(hit);positions.push(...p.toArray());colors.push(...(hit?blockedColor:clear).toArray());}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));coveragePoints=new THREE.Points(geometry,new THREE.PointsMaterial({size:.0028,vertexColors:true,depthTest:false,transparent:true,opacity:.85}));coveragePoints.renderOrder=10;scene.add(coveragePoints);coverageResult={blocked,total:1271,percent:(blocked/1271*100).toFixed(1),basis:'Illustrative geometry, not measured optical performance'};
}
function makeFields(){fieldGroup=new THREE.Group();scene.add(fieldGroup);fieldGroup.visible=false;
  for(const[x,cy,lens,h,v,color]of [[-.151,-.005,.3156,57,44,0xc97944],[-.081,-.002531,.3123,102,67,0x21776f]]){
    const origin=convert(x,cy,lens),height=lens-.032,w=height*Math.tan(THREE.MathUtils.degToRad(h/2)),d=height*Math.tan(THREE.MathUtils.degToRad(v/2));
    const corners=[convert(x-w,cy-d,.032),convert(x+w,cy-d,.032),convert(x+w,cy+d,.032),convert(x-w,cy+d,.032)],points=[];
    for(let i=0;i<4;i++)points.push(origin,corners[i],corners[i],corners[(i+1)%4]);
    fieldGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity:.65,depthTest:true})));
  }
}
function makeDimensions(){dimensionGroup=new THREE.Group();scene.add(dimensionGroup);dimensionGroup.visible=false;
  const defs=[['268 mm',convert(-.25,-.143,.06),convert(.018,-.143,.06)],['215 mm',convert(-.282,-.1225,.06),convert(-.282,.0925,.06)],['141 mm',convert(-.269,-.131,.028),convert(-.269,-.131,.169)]];
  for(const[text,a,b]of defs){const geometry=new THREE.BufferGeometry().setFromPoints([a,b]);dimensionGroup.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0x48646b})));for(const p of[a,b]){const ball=new THREE.Mesh(new THREE.SphereGeometry(.0016,8,6),new THREE.MeshBasicMaterial({color:0x48646b}));ball.position.copy(p);dimensionGroup.add(ball);}const el=document.createElement('span');el.className='dimension-label';el.textContent=text;el.hidden=true;viewport.appendChild(el);dimensionLabels.push({el,point:a.clone().lerp(b,.5)});}
}
async function init(){try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<760?1.35:1.75));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.transmissionResolutionScale=.6;
  viewport.prepend(renderer.domElement);scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(36,1,.005,20);camera.position.set(1,.8,1.4);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=.035;controls.maxDistance=3;controls.maxPolarAngle=Math.PI*.49;controls.target.set(.1,.18,0);controls.addEventListener('change',requestRender);controls.addEventListener('start',()=>{tween=null;requestRender();});
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.8;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe8f5ff,0xabb9ad,.55));
  const key=new THREE.DirectionalLight(0xfff3de,1.4);key.position.set(-.4,.9,.6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-.8,right:.8,top:.8,bottom:-.8,near:.1,far:3});key.shadow.bias=-.0003;key.shadow.normalBias=.0004;scene.add(key);
  ground=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({opacity:.18}));ground.rotation.x=-Math.PI/2;ground.position.y=.0002;ground.receiveShadow=true;scene.add(ground);
  const gltf=await loader.loadAsync('assets/instrument.glb',e=>{if(e.total)$('loading').textContent=`Loading the assembly… ${Math.round(e.loaded/e.total*100)}%`;});model=gltf.scene;scene.add(model);setupModel(model);activeModel=model;
  selectionBox=new THREE.BoxHelper(model,0x739a9b);selectionBox.material.transparent=true;selectionBox.material.opacity=.45;selectionBox.visible=false;scene.add(selectionBox);
  makeFields();makeDimensions();resize();$('poster').hidden=true;$('loading').hidden=true;controlsEnabled(true);selectPart('Cage');goView();
  window.instrumentAudit=()=>Object.fromEntries(['EL_Pi5_Case_Lid','EL_Pi5_Board','EL_Pi5_Fan_Cooler','EL_Flash_Drive_A','EL_APC_BE600M1_UPS','Grid lid','Signal routing','EL_Power_Cables'].map(id=>{const o=find(model,id);return[id,o?{mesh:!!o.isMesh,children:o.children.length,position:o.position.toArray(),home:homes.get(o).toArray(),visible:o.visible}:null];}));
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();setPlaying(false);failure('The 3D session was interrupted. Reload this page to try again; the design notes and model download remain available.');});
  let down;renderer.domElement.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||calibrating)return;const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObject(model,true).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});if(!hit)return;let o=hit.object;while(o){const p=parts.find(p=>o.userData.component_id===p.id||o.name===p.id||o.name===p.id.replaceAll(' ','_'));if(p){selectPart(p.id);break;}o=o.parent;}});
  new ResizeObserver(resize).observe(viewport);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;lastFrame=performance.now();if(visible)requestRender();},{rootMargin:'100px'}).observe(viewport);
}catch(e){console.error(e);failure('3D is unavailable in this browser. You can still inspect the rendered view, read the design notes, or download the model.');}}

async function switchAssembly(toCalibration){if(!model||calibrating===toCalibration)return;setPlaying(false);$('calibration-assembly').disabled=true;
  try{if(toCalibration&&!calibration){const result=await loader.loadAsync('assets/calibration.glb');calibration=result.scene;setupModel(calibration);scene.add(calibration);}calibrating=toCalibration;activeModel=calibrating?calibration:model;model.visible=!calibrating;if(calibration)calibration.visible=calibrating;selectionBox.visible=!calibrating;fieldGroup.visible=false;dimensionGroup.visible=false;dimensionLabels.forEach(({el})=>el.hidden=true);
    if(coveragePoints)coveragePoints.visible=false;
    $('scene-label').textContent=calibrating?'02 / CALIBRATION ACCESSORIES':'01 / MONITORING ASSEMBLY';$('main-assembly').setAttribute('aria-pressed',String(!calibrating));$('calibration-assembly').setAttribute('aria-pressed',String(calibrating));$('component-select').disabled=calibrating;document.querySelectorAll('.model-tools input,.model-tools button:not(#reset-view)').forEach(el=>el.disabled=calibrating);
    if(calibrating){showInfo(calibrationInfo);$('view-hint').textContent='Separate calibration accessories · Drag to inspect';}else{selectPart(selectionKey);pose();}goView();
  }catch(e){$('view-hint').textContent='Calibration model could not be loaded. The monitoring assembly is still available.';console.error(e);}finally{$('calibration-assembly').disabled=false;}}
$('component-select').addEventListener('change',e=>selectPart(e.target.value));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));
$('explode').addEventListener('input',e=>{explode=Number(e.target.value)/100;pose();});
$('lid-toggle').addEventListener('click',()=>{lidRaised=!lidRaised;$('lid-toggle').setAttribute('aria-pressed',String(lidRaised));pose();});
$('fov-toggle').addEventListener('click',()=>{fields=!fields;$('fov-toggle').setAttribute('aria-pressed',String(fields));pose();});
$('dimension-toggle').addEventListener('click',()=>{dimensions=!dimensions;$('dimension-toggle').setAttribute('aria-pressed',String(dimensions));pose();});
$('coverage-toggle').addEventListener('click',()=>{coverage=!coverage;if(coverage){explode=0;lidRaised=false;$('explode').value=0;$('lid-toggle').setAttribute('aria-pressed','false');pose();sampleCoverage();goView('top',find(model,'Cage'));}$('coverage-toggle').setAttribute('aria-pressed',String(coverage));pose();});
$('reset-view').addEventListener('click',()=>{explode=0;lidRaised=false;fields=false;dimensions=false;coverage=false;$('explode').value=0;['lid-toggle','fov-toggle','dimension-toggle','coverage-toggle'].forEach(id=>$(id).setAttribute('aria-pressed','false'));pose();goView();});
for(const[id,factor]of[['zoom-in',.8],['zoom-out',1.25]])$(id).addEventListener('click',()=>{tween=null;camera.position.copy(controls.target.clone().add(camera.position.clone().sub(controls.target).multiplyScalar(factor)));controls.update();requestRender();});
$('main-assembly').addEventListener('click',()=>switchAssembly(false));$('calibration-assembly').addEventListener('click',()=>switchAssembly(true));
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();if(!document.hidden)requestRender();});
// Scripted pedagogical sequence: no fitted model, physiological threshold, or acquired data.
function signals(t){const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};const cooling=smooth((t-18)/38),recovery=smooth((t-85)/30);return{surface:34-10.3*cooling+10.0*recovery+Math.sin(t*.16)*.12,activity:Math.max(.025,.82-.78*cooling+.7*recovery+Math.sin(t*.32)*.02),ambient:22+Math.sin(t*.06)*.25,humidity:45+Math.sin(t*.04)*1.3};}
let plotWidth=680;const sx=t=>35+t/120*(plotWidth-59),sy=t=>149-(t-20)/16*128;
function drawGrid(){plotWidth=Math.max(220,$('trace').clientWidth);$('trace').setAttribute('viewBox',`0 0 ${plotWidth} 180`);const grid=$('trace-grid');grid.innerHTML='';for(const value of[20,24,28,32,36])grid.innerHTML+=`<line x1="35" x2="${plotWidth-24}" y1="${sy(value)}" y2="${sy(value)}" stroke="#e6ebea" stroke-width="1"/><text x="24" y="${sy(value)+3}" text-anchor="end" fill="#7a8b8d" font-size="10">${value}</text>`;for(const t of(plotWidth<400?[0,60,120]:[0,30,60,90,120]))grid.innerHTML+=`<text x="${sx(t)}" y="171" text-anchor="middle" fill="#7a8b8d" font-size="10">${t} min</text>`;
  const traceD=Array.from({length:241},(_,i)=>`${i?'L':'M'}${sx(i/2).toFixed(2)},${sy(signals(i/2).surface).toFixed(2)}`).join(' ');$('trace-path').setAttribute('d',traceD);updateSignals();}
function setPlaying(value){running=value;$('play').textContent=value?'Pause replay':'Play replay';$('play').setAttribute('aria-pressed',String(value));lastFrame=performance.now();if(value)requestRender(false);}
function updateSignals(){const s=signals(time),fault=quality!=='clear';$('time').value=time;$('time-label').textContent=`${Math.floor(time)}:${String(Math.floor(time%1*60)).padStart(2,'0')} / 120 min`;
  $('surface').innerHTML=fault?'—':`${s.surface.toFixed(1)} <small>°C</small>`;$('activity').textContent=quality==='dropout'?'—':s.activity.toFixed(2);$('ambient').innerHTML=`${s.ambient.toFixed(1)} <small>°C</small>`;$('humidity').innerHTML=`${s.humidity.toFixed(0)} <small>%</small>`;
  const phase=fault?'UNKNOWN':time<18?'NORMAL':time<45?'WATCH':time<85?'PROBABLE_TORPOR':'RECOVERY';if(phase!==lastState){$('state').textContent=phase;lastState=phase;}$('state').classList.toggle('unknown',fault);
  $('signal-note').textContent=quality==='occlusion'?'Thermal values are withheld when the view is obstructed. The phase is UNKNOWN; a missing value is not evidence of cooling.':quality==='dropout'?'Both camera readouts are withheld. Ambient sensing remains available, but the phase is UNKNOWN.':'Illustrative phase labels follow the scripted sequence; they are not a validated classifier.';
  const count=Math.floor(time*2);$('trace-progress').setAttribute('d',fault?'':Array.from({length:count+1},(_,i)=>`${i?'L':'M'}${sx(i/2)},${sy(signals(i/2).surface)}`).join(' '));$('trace-path').style.visibility=fault?'hidden':'visible';for(const id of['trace-cursor','trace-dot']){const el=$(id);el.setAttribute(id==='trace-dot'?'cx':'x1',sx(time));if(id==='trace-cursor')el.setAttribute('x2',sx(time));else{el.setAttribute('cy',sy(s.surface));el.style.opacity=fault?0:1;}}
  requestRender(false);}
$('play').addEventListener('click',()=>{if(time>=120)time=0;setPlaying(!running);});$('time').addEventListener('input',e=>{time=Number(e.target.value);setPlaying(false);updateSignals();});$('fault').addEventListener('change',e=>{quality=e.target.value;updateSignals();});
new ResizeObserver(drawGrid).observe($('trace'));drawGrid();init();
