const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),ease=t=>1-Math.pow(1-t,3);
/* 1. INTRO */
(()=>{const pct=$('#pct'),logo=$('#logo'),it=$('#intro'),t0=performance.now(),dur=2800;document.body.style.overflow='hidden';
(function f(n){const p=clamp((n-t0)/dur);pct.textContent=Math.round(p*100)+'%';logo.style.opacity=p;
if(p<1)return requestAnimationFrame(f);
setTimeout(()=>{const r=logo.getBoundingClientRect(),ox=r.left+r.width*.376,oy=r.top+r.height*.578;logo.style.transformOrigin='37.6% 57.8%';logo.style.transition='transform 2s cubic-bezier(.75,0,.25,1)';logo.style.transform=`translate(${innerWidth/2-ox}px,${innerHeight/2-oy}px) scale(110)`;it.classList.add('go');setTimeout(()=>$$('[data-hero]').forEach((e,i)=>setTimeout(()=>e.classList.add('on'),i*200)),1500);setTimeout(()=>{it.remove();document.body.style.overflow=''},2200)},400)})(t0);})();
/* 2. LIQUID BLOBS: merge by goo filter, split into droplets near cursor */
(()=>{const c=$('#balls'),x=c.getContext('2d'),CL=[['#C9D8A4','#9DB36B'],['#F0E1A8','#D6BF6C'],['#EDC49A','#D49A62']],m={x:-999,y:-999,vx:0,vy:0},R=210;let W,H,B=[],t=0;
const mk=()=>{const s=Math.min(W,H);B=Array.from({length:6},(_,i)=>{const r=s*(.2+Math.random()*.1),b={x:r+Math.random()*(W-2*r),y:r+Math.random()*(H-2*r),vx:(Math.random()-.5)*.6,vy:(Math.random()-.5)*.6,r,p:CL[i%3],inf:0,ph:Math.random()*9,s:[]};
for(let k=0;k<8;k++){const a=Math.random()*6.28,d=Math.sqrt(Math.random())*r*.62;b.s.push({ox:Math.cos(a)*d,oy:Math.sin(a)*d,rr:r*(.2+Math.random()*.12),x:b.x+Math.cos(a)*d,y:b.y+Math.sin(a)*d,vx:0,vy:0})}return b})};
const rs=()=>{W=c.clientWidth;H=c.clientHeight;c.width=W;c.height=H;if(!B.length)mk()};rs();addEventListener('resize',rs);
c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect(),nx=e.clientX-r.left,ny=e.clientY-r.top;if(m.x>-900){m.vx=nx-m.x;m.vy=ny-m.y}m.x=nx;m.y=ny});c.addEventListener('pointerleave',()=>m.x=-999);
const dot=(cx,cy,r,p)=>{const g=x.createRadialGradient(cx-r*.3,cy-r*.3,r*.1,cx,cy,r);g.addColorStop(0,p[0]);g.addColorStop(1,p[1]);x.fillStyle=g;x.beginPath();x.arc(cx,cy,Math.max(r,.1),0,7);x.fill()};
(function loop(){t++;x.clearRect(0,0,W,H);m.vx*=.9;m.vy*=.9;
B.forEach((b,i)=>{b.vx+=Math.cos(t*.004+b.ph)*.004;b.vy+=Math.sin(t*.0035+b.ph*2)*.004;const sp=Math.hypot(b.vx,b.vy);if(sp>.9){b.vx*=.97;b.vy*=.97}if(sp<.25){b.vx*=1.02;b.vy*=1.02}
b.x+=b.vx;b.y+=b.vy;const e=b.r*.65;if(b.x<e){b.x=e;b.vx=Math.abs(b.vx)}if(b.x>W-e){b.x=W-e;b.vx=-Math.abs(b.vx)}if(b.y<e){b.y=e;b.vy=Math.abs(b.vy)}if(b.y>H-e){b.y=H-e;b.vy=-Math.abs(b.vy)}
for(let j=i+1;j<B.length;j++){const o=B[j],dx=o.x-b.x,dy=o.y-b.y,d=Math.hypot(dx,dy)||1,mn=(b.r+o.r)*.62;if(d<mn){const f=(mn-d)*.0009;b.vx-=dx/d*f;b.vy-=dy/d*f;o.vx+=dx/d*f;o.vy+=dy/d*f}}
const dm=Math.hypot(b.x-m.x,b.y-m.y)||1,tg=m.x<-900?0:clamp(1-dm/(b.r+R));b.inf+=(tg-b.inf)*.05;if(tg>0){b.vx+=(b.x-m.x)/dm*tg*.03+m.vx*.001;b.vy+=(b.y-m.y)/dm*tg*.03+m.vy*.001}
const k=1+b.inf*1.1;b.s.forEach(p=>{p.vx+=(b.x+p.ox*k-p.x)*.012;p.vy+=(b.y+p.oy*k-p.y)*.012;const dx=p.x-m.x,dy=p.y-m.y,d=Math.hypot(dx,dy)||1;
if(m.x>-900&&d<R){const f=Math.pow(1-d/R,2);p.vx+=dx/d*f*1.4-dy/d*f*.5+m.vx*.02;p.vy+=dy/d*f*1.4+dx/d*f*.5+m.vy*.02}p.vx*=.9;p.vy*=.9;p.x+=p.vx;p.y+=p.vy})});
B.forEach(b=>{b.s.forEach(p=>dot(p.x,p.y,p.rr*(1+b.inf*.5),b.p));dot(b.x,b.y,b.r*(1-.3*b.inf),b.p)});
requestAnimationFrame(loop)})();})();
/* 3. STATEMENT words */
const stm=$('#stm');$$('.ln').forEach(l=>{l.innerHTML=l.textContent.split(' ').map(w=>`<span class="w">${w}</span>`).join(' ')});const words=$$('.w');
/* 4. PERSONA bubble */
(()=>{const T=['동묘시장은 사람이 너무 많고 번잡해서 탈의가 쉽지 않아~','난 단골 손님이니, 그에 걸맞는 서비스를 받고싶어!','옷을 직접 벗는건 불안해'],p=$('#btxt'),bars=$$('#bar i');let k=0;
const show=()=>{p.classList.add('sw');setTimeout(()=>{p.textContent=T[k];p.classList.remove('sw')},250);bars.forEach((b,i)=>b.classList.toggle('on',i<=k))};
const next=()=>{k=(k+1)%T.length;show()};p.textContent=T[0];bars[0].classList.add('on');$('#bubble').onclick=$('#bar').onclick=next;
addEventListener('pointermove',e=>{$('#char').style.transform=`translate(${(e.clientX/innerWidth-.5)*20}px,${(e.clientY/innerHeight-.5)*12}px)`})})();
/* 6. GLB viewer (dependency-free WebGL2) */
let ms=2.6;const model=$('#model'),det=$('.det');
addEventListener('scroll',()=>{const vh=innerHeight,r=$('#statement').getBoundingClientRect(),p=clamp((vh*.8-r.top)/(r.height*.75));words.forEach((w,i)=>w.classList.toggle('on',i/words.length<p*1.1));
const mr=model.getBoundingClientRect(),q=clamp(-mr.top/(mr.height-vh));ms=2.6-1.6*ease(clamp(q/.35));det.classList.toggle('on',q>.4);$('.mtxt').classList.toggle('on',q>.3)},{passive:true});
(async()=>{const cv=$('#gl'),gl=cv.getContext('webgl2',{antialias:true,alpha:true});if(!gl||!window.MIRROR_GLB)return;
const gz=Uint8Array.from(atob(window.MIRROR_GLB),c=>c.charCodeAt(0)),buf=await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),dv=new DataView(buf),jl=dv.getUint32(12,true),J=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,20,jl))),bin=buf.slice(28+jl);
const TA={5126:Float32Array,5123:Uint16Array,5125:Uint32Array,5121:Uint8Array},NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const acc=i=>{const a=J.accessors[i],v=J.bufferViews[a.bufferView];return new TA[a.componentType](bin,(v.byteOffset||0)+(a.byteOffset||0),a.count*NC[a.type])};
const mul=(a,b)=>{const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o};
const local=n=>{if(n.matrix)return n.matrix;const t=n.translation||[0,0,0],q=n.rotation||[0,0,0,1],s=n.scale||[1,1,1],[X,Y,Z,W]=q;
return[(1-2*(Y*Y+Z*Z))*s[0],2*(X*Y+Z*W)*s[0],2*(X*Z-Y*W)*s[0],0,2*(X*Y-Z*W)*s[1],(1-2*(X*X+Z*Z))*s[1],2*(Y*Z+X*W)*s[1],0,2*(X*Z+Y*W)*s[2],2*(Y*Z-X*W)*s[2],(1-2*(X*X+Y*Y))*s[2],0,t[0],t[1],t[2],1]};
const prims=[];const walk=(i,pm)=>{const n=J.nodes[i],m=mul(pm,local(n));if(n.mesh!=null)J.meshes[n.mesh].primitives.forEach(p=>prims.push({p,m}));(n.children||[]).forEach(c=>walk(c,m))};
const I4=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];(J.scenes[J.scene||0].nodes).forEach(n=>walk(n,I4));
const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
const draws=await Promise.all(prims.map(async({p,m})=>{const P=acc(p.attributes.POSITION).slice(),N=p.attributes.NORMAL!=null?acc(p.attributes.NORMAL).slice():new Float32Array(P.length),U=p.attributes.TEXCOORD_0!=null?acc(p.attributes.TEXCOORD_0):new Float32Array(P.length/3*2);
for(let i=0;i<P.length;i+=3){const x=P[i],y=P[i+1],z=P[i+2];P[i]=m[0]*x+m[4]*y+m[8]*z+m[12];P[i+1]=m[1]*x+m[5]*y+m[9]*z+m[13];P[i+2]=m[2]*x+m[6]*y+m[10]*z+m[14];
const a=N[i],b=N[i+1],c=N[i+2];N[i]=m[0]*a+m[4]*b+m[8]*c;N[i+1]=m[1]*a+m[5]*b+m[9]*c;N[i+2]=m[2]*a+m[6]*b+m[10]*c;for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],P[i+k]);mx[k]=Math.max(mx[k],P[i+k])}}
const mat=J.materials?.[p.material]?.pbrMetallicRoughness||{},col=mat.baseColorFactor||[1,1,1,1];let tex=null;
const ti=mat.baseColorTexture?.index;if(ti!=null){const im=J.images[J.textures[ti].source],v=J.bufferViews[im.bufferView],bm=await createImageBitmap(new Blob([new Uint8Array(bin,v.byteOffset||0,v.byteLength)],{type:im.mimeType}));
tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bm);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR)}
const vao=gl.createVertexArray();gl.bindVertexArray(vao);[[P,3],[N,3],[U,2]].forEach(([d,s],i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,s,gl.FLOAT,false,0,0)});
const ia=p.indices!=null?acc(p.indices):null;if(ia){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ia,gl.STATIC_DRAW)}
return{vao,tex,col,n:ia?ia.length:P.length/3,it:ia instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,idx:!!ia}}));
const ctr=mn.map((v,i)=>(v+mx[i])/2),k=2/Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2]);
const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o},pr=gl.createProgram();
gl.attachShader(pr,sh(gl.VERTEX_SHADER,`#version 300 es
layout(location=0)in vec3 p;layout(location=1)in vec3 n;layout(location=2)in vec2 u;uniform mat4 M,V;uniform mat3 R;out vec3 vn;out vec2 vu;void main(){vn=R*n;vu=u;gl_Position=V*M*vec4(p,1);}`));
gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,`#version 300 es
precision mediump float;in vec3 vn;in vec2 vu;uniform sampler2D t;uniform vec4 c;uniform float ht;out vec4 o;void main(){vec3 N=normalize(vn);vec4 b=c*(ht>.5?texture(t,vu):vec4(1));vec3 L=normalize(vec3(.5,.8,.7));
float d=max(dot(N,L),0.),h=.55+.45*N.y,s=pow(max(dot(reflect(-L,N),vec3(0,0,1)),0.),28.)*.45,r=pow(1.-abs(N.z),2.)*.22;o=vec4(b.rgb*(h*.8+d*.6)+s+r*vec3(1,.92,.8),1);}`));
gl.linkProgram(pr);gl.useProgram(pr);gl.enable(gl.DEPTH_TEST);const U=n=>gl.getUniformLocation(pr,n);
let ry=.5,rx=.08,drag=0,lx,ly;cv.onpointerdown=e=>{drag=1;lx=e.clientX;ly=e.clientY;cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing'};
cv.onpointerup=()=>{drag=0;cv.style.cursor='grab'};cv.onpointermove=e=>{if(!drag)return;ry+=(e.clientX-lx)*.01;rx=clamp(rx+(e.clientY-ly)*.006,-.6,.6);lx=e.clientX;ly=e.clientY};
(function draw(){const d=devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;if(cv.width!==w*d|0){cv.width=w*d;cv.height=h*d}gl.viewport(0,0,cv.width,cv.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
if(!drag)ry+=.006;const cy=Math.cos(ry),sy=Math.sin(ry),cx=Math.cos(rx),sx=Math.sin(rx),s=k*ms*1.05;
const Rm=mul([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1],[1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]);
const Mm=mul(Rm,[s,0,0,0,0,s,0,0,0,0,s,0,-ctr[0]*s,-ctr[1]*s,-ctr[2]*s,1]);Mm[14]-=6;
const f=1/Math.tan(.31),a=w/h,zn=.1,zf=50,V=[f/a,0,0,0,0,f,0,0,0,0,(zf+zn)/(zn-zf),-1,0,0,2*zf*zn/(zn-zf),0];
gl.uniformMatrix4fv(U('M'),false,Mm);gl.uniformMatrix4fv(U('V'),false,V);gl.uniformMatrix3fv(U('R'),false,[Rm[0],Rm[1],Rm[2],Rm[4],Rm[5],Rm[6],Rm[8],Rm[9],Rm[10]]);
draws.forEach(o=>{gl.uniform4fv(U('c'),o.col);gl.uniform1f(U('ht'),o.tex?1:0);if(o.tex)gl.bindTexture(gl.TEXTURE_2D,o.tex);gl.bindVertexArray(o.vao);o.idx?gl.drawElements(gl.TRIANGLES,o.n,o.it,0):gl.drawArrays(gl.TRIANGLES,0,o.n)});
requestAnimationFrame(draw)})();})();

const io=new IntersectionObserver((es,o)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('on');o.unobserve(e.target)}}),{threshold:.3});$$('#specs dl div').forEach((d,i)=>{d.style.transitionDelay=i*.15+'s';io.observe(d)});

const rio=new IntersectionObserver((es,o)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('on');o.unobserve(e.target)}}),{threshold:.25});$$('.rv:not([data-hero])').forEach(e=>rio.observe(e));
