(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))i(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function e(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function i(r){if(r.ep)return;r.ep=!0;const s=e(r);fetch(r.href,s)}})();/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Lc="170",Xp=0,cu=1,Yp=2,Qd=1,qp=2,Rn=3,ii=0,Fe=1,an=2,ei=0,dr=1,Uo=2,uu=3,fu=4,Zp=5,vi=100,$p=101,Kp=102,jp=103,Jp=104,Qp=200,tm=201,em=202,nm=203,cl=204,ul=205,im=206,rm=207,sm=208,om=209,am=210,lm=211,cm=212,um=213,fm=214,fl=0,dl=1,hl=2,gr=3,pl=4,ml=5,_l=6,gl=7,th=0,dm=1,hm=2,ni=0,pm=1,mm=2,_m=3,gm=4,vm=5,xm=6,Em=7,eh=300,vr=301,xr=302,vl=303,xl=304,Xo=306,bi=1e3,cn=1001,El=1002,Xe=1003,Sm=1004,Rs=1005,vn=1006,Qo=1007,Si=1008,Nn=1009,nh=1010,ih=1011,ms=1012,Pc=1013,Ai=1014,xn=1015,Ms=1016,Ic=1017,Dc=1018,Er=1020,rh=35902,sh=1021,oh=1022,un=1023,ah=1024,lh=1025,hr=1026,Sr=1027,Nc=1028,Uc=1029,ch=1030,Oc=1031,Fc=1033,So=33776,Mo=33777,yo=33778,To=33779,Sl=35840,Ml=35841,yl=35842,Tl=35843,bl=36196,Al=37492,wl=37496,Rl=37808,Cl=37809,Ll=37810,Pl=37811,Il=37812,Dl=37813,Nl=37814,Ul=37815,Ol=37816,Fl=37817,Bl=37818,Hl=37819,zl=37820,kl=37821,bo=36492,Gl=36494,Vl=36495,uh=36283,Wl=36284,Xl=36285,Yl=36286,Mm=3200,ym=3201,Tm=0,bm=1,jn="",Ve="srgb",Ar="srgb-linear",Yo="linear",ne="srgb",Oi=7680,du=519,Am=512,wm=513,Rm=514,fh=515,Cm=516,Lm=517,Pm=518,Im=519,ql=35044,Dm=35048,hu="300 es",Ln=2e3,Oo=2001;class wr{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const i=this._listeners;i[t]===void 0&&(i[t]=[]),i[t].indexOf(e)===-1&&i[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const i=this._listeners;return i[t]!==void 0&&i[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const r=this._listeners[t];if(r!==void 0){const s=r.indexOf(e);s!==-1&&r.splice(s,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const i=this._listeners[t.type];if(i!==void 0){t.target=this;const r=i.slice(0);for(let s=0,o=r.length;s<o;s++)r[s].call(this,t);t.target=null}}}const be=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let pu=1234567;const os=Math.PI/180,_s=180/Math.PI;function Pn(){const n=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(be[n&255]+be[n>>8&255]+be[n>>16&255]+be[n>>24&255]+"-"+be[t&255]+be[t>>8&255]+"-"+be[t>>16&15|64]+be[t>>24&255]+"-"+be[e&63|128]+be[e>>8&255]+"-"+be[e>>16&255]+be[e>>24&255]+be[i&255]+be[i>>8&255]+be[i>>16&255]+be[i>>24&255]).toLowerCase()}function Ie(n,t,e){return Math.max(t,Math.min(e,n))}function Bc(n,t){return(n%t+t)%t}function Nm(n,t,e,i,r){return i+(n-t)*(r-i)/(e-t)}function Um(n,t,e){return n!==t?(e-n)/(t-n):0}function as(n,t,e){return(1-e)*n+e*t}function Om(n,t,e,i){return as(n,t,1-Math.exp(-e*i))}function Fm(n,t=1){return t-Math.abs(Bc(n,t*2)-t)}function Bm(n,t,e){return n<=t?0:n>=e?1:(n=(n-t)/(e-t),n*n*(3-2*n))}function Hm(n,t,e){return n<=t?0:n>=e?1:(n=(n-t)/(e-t),n*n*n*(n*(n*6-15)+10))}function zm(n,t){return n+Math.floor(Math.random()*(t-n+1))}function km(n,t){return n+Math.random()*(t-n)}function Gm(n){return n*(.5-Math.random())}function Vm(n){n!==void 0&&(pu=n);let t=pu+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Wm(n){return n*os}function Xm(n){return n*_s}function Ym(n){return(n&n-1)===0&&n!==0}function qm(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function Zm(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function $m(n,t,e,i,r){const s=Math.cos,o=Math.sin,a=s(e/2),l=o(e/2),c=s((t+i)/2),u=o((t+i)/2),d=s((t-i)/2),h=o((t-i)/2),m=s((i-t)/2),g=o((i-t)/2);switch(r){case"XYX":n.set(a*u,l*d,l*h,a*c);break;case"YZY":n.set(l*h,a*u,l*d,a*c);break;case"ZXZ":n.set(l*d,l*h,a*u,a*c);break;case"XZX":n.set(a*u,l*g,l*m,a*c);break;case"YXY":n.set(l*m,a*u,l*g,a*c);break;case"ZYZ":n.set(l*g,l*m,a*u,a*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function ln(n,t){switch(t.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("Invalid component type.")}}function te(n,t){switch(t.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("Invalid component type.")}}const Km={DEG2RAD:os,RAD2DEG:_s,generateUUID:Pn,clamp:Ie,euclideanModulo:Bc,mapLinear:Nm,inverseLerp:Um,lerp:as,damp:Om,pingpong:Fm,smoothstep:Bm,smootherstep:Hm,randInt:zm,randFloat:km,randFloatSpread:Gm,seededRandom:Vm,degToRad:Wm,radToDeg:Xm,isPowerOfTwo:Ym,ceilPowerOfTwo:qm,floorPowerOfTwo:Zm,setQuaternionFromProperEuler:$m,normalize:te,denormalize:ln};class Wt{constructor(t=0,e=0){Wt.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,i=this.y,r=t.elements;return this.x=r[0]*e+r[3]*i+r[6],this.y=r[1]*e+r[4]*i+r[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const i=this.dot(t)/e;return Math.acos(Ie(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,i=this.y-t.y;return e*e+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const i=Math.cos(e),r=Math.sin(e),s=this.x-t.x,o=this.y-t.y;return this.x=s*i-o*r+t.x,this.y=s*r+o*i+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Nt{constructor(t,e,i,r,s,o,a,l,c){Nt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,i,r,s,o,a,l,c)}set(t,e,i,r,s,o,a,l,c){const u=this.elements;return u[0]=t,u[1]=r,u[2]=a,u[3]=e,u[4]=s,u[5]=l,u[6]=i,u[7]=o,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],this}extractBasis(t,e,i){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const i=t.elements,r=e.elements,s=this.elements,o=i[0],a=i[3],l=i[6],c=i[1],u=i[4],d=i[7],h=i[2],m=i[5],g=i[8],_=r[0],p=r[3],f=r[6],T=r[1],y=r[4],E=r[7],N=r[2],A=r[5],w=r[8];return s[0]=o*_+a*T+l*N,s[3]=o*p+a*y+l*A,s[6]=o*f+a*E+l*w,s[1]=c*_+u*T+d*N,s[4]=c*p+u*y+d*A,s[7]=c*f+u*E+d*w,s[2]=h*_+m*T+g*N,s[5]=h*p+m*y+g*A,s[8]=h*f+m*E+g*w,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],i=t[1],r=t[2],s=t[3],o=t[4],a=t[5],l=t[6],c=t[7],u=t[8];return e*o*u-e*a*c-i*s*u+i*a*l+r*s*c-r*o*l}invert(){const t=this.elements,e=t[0],i=t[1],r=t[2],s=t[3],o=t[4],a=t[5],l=t[6],c=t[7],u=t[8],d=u*o-a*c,h=a*l-u*s,m=c*s-o*l,g=e*d+i*h+r*m;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const _=1/g;return t[0]=d*_,t[1]=(r*c-u*i)*_,t[2]=(a*i-r*o)*_,t[3]=h*_,t[4]=(u*e-r*l)*_,t[5]=(r*s-a*e)*_,t[6]=m*_,t[7]=(i*l-c*e)*_,t[8]=(o*e-i*s)*_,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,i,r,s,o,a){const l=Math.cos(s),c=Math.sin(s);return this.set(i*l,i*c,-i*(l*o+c*a)+o+t,-r*c,r*l,-r*(-c*o+l*a)+a+e,0,0,1),this}scale(t,e){return this.premultiply(ta.makeScale(t,e)),this}rotate(t){return this.premultiply(ta.makeRotation(-t)),this}translate(t,e){return this.premultiply(ta.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,i,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,i=t.elements;for(let r=0;r<9;r++)if(e[r]!==i[r])return!1;return!0}fromArray(t,e=0){for(let i=0;i<9;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){const i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const ta=new Nt;function dh(n){for(let t=n.length-1;t>=0;--t)if(n[t]>=65535)return!0;return!1}function gs(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function jm(){const n=gs("canvas");return n.style.display="block",n}const mu={};function Qr(n){n in mu||(mu[n]=!0,console.warn(n))}function Jm(n,t,e){return new Promise(function(i,r){function s(){switch(n.clientWaitSync(t,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:r();break;case n.TIMEOUT_EXPIRED:setTimeout(s,e);break;default:i()}}setTimeout(s,e)})}function Qm(n){const t=n.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function t_(n){const t=n.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}const Yt={enabled:!0,workingColorSpace:Ar,spaces:{},convert:function(n,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===ne&&(n.r=In(n.r),n.g=In(n.g),n.b=In(n.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(n.applyMatrix3(this.spaces[t].toXYZ),n.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===ne&&(n.r=pr(n.r),n.g=pr(n.g),n.b=pr(n.b))),n},fromWorkingColorSpace:function(n,t){return this.convert(n,this.workingColorSpace,t)},toWorkingColorSpace:function(n,t){return this.convert(n,t,this.workingColorSpace)},getPrimaries:function(n){return this.spaces[n].primaries},getTransfer:function(n){return n===jn?Yo:this.spaces[n].transfer},getLuminanceCoefficients:function(n,t=this.workingColorSpace){return n.fromArray(this.spaces[t].luminanceCoefficients)},define:function(n){Object.assign(this.spaces,n)},_getMatrix:function(n,t,e){return n.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(n){return this.spaces[n].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(n=this.workingColorSpace){return this.spaces[n].workingColorSpaceConfig.unpackColorSpace}};function In(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function pr(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}const _u=[.64,.33,.3,.6,.15,.06],gu=[.2126,.7152,.0722],vu=[.3127,.329],xu=new Nt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Eu=new Nt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);Yt.define({[Ar]:{primaries:_u,whitePoint:vu,transfer:Yo,toXYZ:xu,fromXYZ:Eu,luminanceCoefficients:gu,workingColorSpaceConfig:{unpackColorSpace:Ve},outputColorSpaceConfig:{drawingBufferColorSpace:Ve}},[Ve]:{primaries:_u,whitePoint:vu,transfer:ne,toXYZ:xu,fromXYZ:Eu,luminanceCoefficients:gu,outputColorSpaceConfig:{drawingBufferColorSpace:Ve}}});let Fi;class e_{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{Fi===void 0&&(Fi=gs("canvas")),Fi.width=t.width,Fi.height=t.height;const i=Fi.getContext("2d");t instanceof ImageData?i.putImageData(t,0,0):i.drawImage(t,0,0,t.width,t.height),e=Fi}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=gs("canvas");e.width=t.width,e.height=t.height;const i=e.getContext("2d");i.drawImage(t,0,0,t.width,t.height);const r=i.getImageData(0,0,t.width,t.height),s=r.data;for(let o=0;o<s.length;o++)s[o]=In(s[o]/255)*255;return i.putImageData(r,0,0),e}else if(t.data){const e=t.data.slice(0);for(let i=0;i<e.length;i++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[i]=Math.floor(In(e[i]/255)*255):e[i]=In(e[i]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let n_=0;class hh{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:n_++}),this.uuid=Pn(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const i={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let o=0,a=r.length;o<a;o++)r[o].isDataTexture?s.push(ea(r[o].image)):s.push(ea(r[o]))}else s=ea(r);i.url=s}return e||(t.images[this.uuid]=i),i}}function ea(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?e_.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let i_=0;class ye extends wr{constructor(t=ye.DEFAULT_IMAGE,e=ye.DEFAULT_MAPPING,i=cn,r=cn,s=vn,o=Si,a=un,l=Nn,c=ye.DEFAULT_ANISOTROPY,u=jn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:i_++}),this.uuid=Pn(),this.name="",this.source=new hh(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=i,this.wrapT=r,this.magFilter=s,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new Wt(0,0),this.repeat=new Wt(1,1),this.center=new Wt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Nt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const i={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),e||(t.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==eh)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case bi:t.x=t.x-Math.floor(t.x);break;case cn:t.x=t.x<0?0:1;break;case El:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case bi:t.y=t.y-Math.floor(t.y);break;case cn:t.y=t.y<0?0:1;break;case El:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}ye.DEFAULT_IMAGE=null;ye.DEFAULT_MAPPING=eh;ye.DEFAULT_ANISOTROPY=1;class de{constructor(t=0,e=0,i=0,r=1){de.prototype.isVector4=!0,this.x=t,this.y=e,this.z=i,this.w=r}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,i,r){return this.x=t,this.y=e,this.z=i,this.w=r,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,i=this.y,r=this.z,s=this.w,o=t.elements;return this.x=o[0]*e+o[4]*i+o[8]*r+o[12]*s,this.y=o[1]*e+o[5]*i+o[9]*r+o[13]*s,this.z=o[2]*e+o[6]*i+o[10]*r+o[14]*s,this.w=o[3]*e+o[7]*i+o[11]*r+o[15]*s,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,i,r,s;const l=t.elements,c=l[0],u=l[4],d=l[8],h=l[1],m=l[5],g=l[9],_=l[2],p=l[6],f=l[10];if(Math.abs(u-h)<.01&&Math.abs(d-_)<.01&&Math.abs(g-p)<.01){if(Math.abs(u+h)<.1&&Math.abs(d+_)<.1&&Math.abs(g+p)<.1&&Math.abs(c+m+f-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const y=(c+1)/2,E=(m+1)/2,N=(f+1)/2,A=(u+h)/4,w=(d+_)/4,P=(g+p)/4;return y>E&&y>N?y<.01?(i=0,r=.707106781,s=.707106781):(i=Math.sqrt(y),r=A/i,s=w/i):E>N?E<.01?(i=.707106781,r=0,s=.707106781):(r=Math.sqrt(E),i=A/r,s=P/r):N<.01?(i=.707106781,r=.707106781,s=0):(s=Math.sqrt(N),i=w/s,r=P/s),this.set(i,r,s,e),this}let T=Math.sqrt((p-g)*(p-g)+(d-_)*(d-_)+(h-u)*(h-u));return Math.abs(T)<.001&&(T=1),this.x=(p-g)/T,this.y=(d-_)/T,this.z=(h-u)/T,this.w=Math.acos((c+m+f-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this.w=t.w+(e.w-t.w)*i,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class r_ extends wr{constructor(t=1,e=1,i={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new de(0,0,t,e),this.scissorTest=!1,this.viewport=new de(0,0,t,e);const r={width:t,height:e,depth:1};i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:vn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},i);const s=new ye(r,i.mapping,i.wrapS,i.wrapT,i.magFilter,i.minFilter,i.format,i.type,i.anisotropy,i.colorSpace);s.flipY=!1,s.generateMipmaps=i.generateMipmaps,s.internalFormat=i.internalFormat,this.textures=[];const o=i.count;for(let a=0;a<o;a++)this.textures[a]=s.clone(),this.textures[a].isRenderTargetTexture=!0;this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this.depthTexture=i.depthTexture,this.samples=i.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,i=1){if(this.width!==t||this.height!==e||this.depth!==i){this.width=t,this.height=e,this.depth=i;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=t,this.textures[r].image.height=e,this.textures[r].image.depth=i;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let i=0,r=t.textures.length;i<r;i++)this.textures[i]=t.textures[i].clone(),this.textures[i].isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new hh(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class wi extends r_{constructor(t=1,e=1,i={}){super(t,e,i),this.isWebGLRenderTarget=!0}}class ph extends ye{constructor(t=null,e=1,i=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:i,depth:r},this.magFilter=Xe,this.minFilter=Xe,this.wrapR=cn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class s_ extends ye{constructor(t=null,e=1,i=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:i,depth:r},this.magFilter=Xe,this.minFilter=Xe,this.wrapR=cn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class ys{constructor(t=0,e=0,i=0,r=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=i,this._w=r}static slerpFlat(t,e,i,r,s,o,a){let l=i[r+0],c=i[r+1],u=i[r+2],d=i[r+3];const h=s[o+0],m=s[o+1],g=s[o+2],_=s[o+3];if(a===0){t[e+0]=l,t[e+1]=c,t[e+2]=u,t[e+3]=d;return}if(a===1){t[e+0]=h,t[e+1]=m,t[e+2]=g,t[e+3]=_;return}if(d!==_||l!==h||c!==m||u!==g){let p=1-a;const f=l*h+c*m+u*g+d*_,T=f>=0?1:-1,y=1-f*f;if(y>Number.EPSILON){const N=Math.sqrt(y),A=Math.atan2(N,f*T);p=Math.sin(p*A)/N,a=Math.sin(a*A)/N}const E=a*T;if(l=l*p+h*E,c=c*p+m*E,u=u*p+g*E,d=d*p+_*E,p===1-a){const N=1/Math.sqrt(l*l+c*c+u*u+d*d);l*=N,c*=N,u*=N,d*=N}}t[e]=l,t[e+1]=c,t[e+2]=u,t[e+3]=d}static multiplyQuaternionsFlat(t,e,i,r,s,o){const a=i[r],l=i[r+1],c=i[r+2],u=i[r+3],d=s[o],h=s[o+1],m=s[o+2],g=s[o+3];return t[e]=a*g+u*d+l*m-c*h,t[e+1]=l*g+u*h+c*d-a*m,t[e+2]=c*g+u*m+a*h-l*d,t[e+3]=u*g-a*d-l*h-c*m,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,i,r){return this._x=t,this._y=e,this._z=i,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const i=t._x,r=t._y,s=t._z,o=t._order,a=Math.cos,l=Math.sin,c=a(i/2),u=a(r/2),d=a(s/2),h=l(i/2),m=l(r/2),g=l(s/2);switch(o){case"XYZ":this._x=h*u*d+c*m*g,this._y=c*m*d-h*u*g,this._z=c*u*g+h*m*d,this._w=c*u*d-h*m*g;break;case"YXZ":this._x=h*u*d+c*m*g,this._y=c*m*d-h*u*g,this._z=c*u*g-h*m*d,this._w=c*u*d+h*m*g;break;case"ZXY":this._x=h*u*d-c*m*g,this._y=c*m*d+h*u*g,this._z=c*u*g+h*m*d,this._w=c*u*d-h*m*g;break;case"ZYX":this._x=h*u*d-c*m*g,this._y=c*m*d+h*u*g,this._z=c*u*g-h*m*d,this._w=c*u*d+h*m*g;break;case"YZX":this._x=h*u*d+c*m*g,this._y=c*m*d+h*u*g,this._z=c*u*g-h*m*d,this._w=c*u*d-h*m*g;break;case"XZY":this._x=h*u*d-c*m*g,this._y=c*m*d-h*u*g,this._z=c*u*g+h*m*d,this._w=c*u*d+h*m*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const i=e/2,r=Math.sin(i);return this._x=t.x*r,this._y=t.y*r,this._z=t.z*r,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,i=e[0],r=e[4],s=e[8],o=e[1],a=e[5],l=e[9],c=e[2],u=e[6],d=e[10],h=i+a+d;if(h>0){const m=.5/Math.sqrt(h+1);this._w=.25/m,this._x=(u-l)*m,this._y=(s-c)*m,this._z=(o-r)*m}else if(i>a&&i>d){const m=2*Math.sqrt(1+i-a-d);this._w=(u-l)/m,this._x=.25*m,this._y=(r+o)/m,this._z=(s+c)/m}else if(a>d){const m=2*Math.sqrt(1+a-i-d);this._w=(s-c)/m,this._x=(r+o)/m,this._y=.25*m,this._z=(l+u)/m}else{const m=2*Math.sqrt(1+d-i-a);this._w=(o-r)/m,this._x=(s+c)/m,this._y=(l+u)/m,this._z=.25*m}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let i=t.dot(e)+1;return i<Number.EPSILON?(i=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=i):(this._x=0,this._y=-t.z,this._z=t.y,this._w=i)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=i),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Ie(this.dot(t),-1,1)))}rotateTowards(t,e){const i=this.angleTo(t);if(i===0)return this;const r=Math.min(1,e/i);return this.slerp(t,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const i=t._x,r=t._y,s=t._z,o=t._w,a=e._x,l=e._y,c=e._z,u=e._w;return this._x=i*u+o*a+r*c-s*l,this._y=r*u+o*l+s*a-i*c,this._z=s*u+o*c+i*l-r*a,this._w=o*u-i*a-r*l-s*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const i=this._x,r=this._y,s=this._z,o=this._w;let a=o*t._w+i*t._x+r*t._y+s*t._z;if(a<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,a=-a):this.copy(t),a>=1)return this._w=o,this._x=i,this._y=r,this._z=s,this;const l=1-a*a;if(l<=Number.EPSILON){const m=1-e;return this._w=m*o+e*this._w,this._x=m*i+e*this._x,this._y=m*r+e*this._y,this._z=m*s+e*this._z,this.normalize(),this}const c=Math.sqrt(l),u=Math.atan2(c,a),d=Math.sin((1-e)*u)/c,h=Math.sin(e*u)/c;return this._w=o*d+this._w*h,this._x=i*d+this._x*h,this._y=r*d+this._y*h,this._z=s*d+this._z*h,this._onChangeCallback(),this}slerpQuaternions(t,e,i){return this.copy(t).slerp(e,i)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),i=Math.random(),r=Math.sqrt(1-i),s=Math.sqrt(i);return this.set(r*Math.sin(t),r*Math.cos(t),s*Math.sin(e),s*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class B{constructor(t=0,e=0,i=0){B.prototype.isVector3=!0,this.x=t,this.y=e,this.z=i}set(t,e,i){return i===void 0&&(i=this.z),this.x=t,this.y=e,this.z=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Su.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Su.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,i=this.y,r=this.z,s=t.elements;return this.x=s[0]*e+s[3]*i+s[6]*r,this.y=s[1]*e+s[4]*i+s[7]*r,this.z=s[2]*e+s[5]*i+s[8]*r,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,i=this.y,r=this.z,s=t.elements,o=1/(s[3]*e+s[7]*i+s[11]*r+s[15]);return this.x=(s[0]*e+s[4]*i+s[8]*r+s[12])*o,this.y=(s[1]*e+s[5]*i+s[9]*r+s[13])*o,this.z=(s[2]*e+s[6]*i+s[10]*r+s[14])*o,this}applyQuaternion(t){const e=this.x,i=this.y,r=this.z,s=t.x,o=t.y,a=t.z,l=t.w,c=2*(o*r-a*i),u=2*(a*e-s*r),d=2*(s*i-o*e);return this.x=e+l*c+o*d-a*u,this.y=i+l*u+a*c-s*d,this.z=r+l*d+s*u-o*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,i=this.y,r=this.z,s=t.elements;return this.x=s[0]*e+s[4]*i+s[8]*r,this.y=s[1]*e+s[5]*i+s[9]*r,this.z=s[2]*e+s[6]*i+s[10]*r,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const i=this.length();return this.divideScalar(i||1).multiplyScalar(Math.max(t,Math.min(e,i)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const i=t.x,r=t.y,s=t.z,o=e.x,a=e.y,l=e.z;return this.x=r*l-s*a,this.y=s*o-i*l,this.z=i*a-r*o,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const i=t.dot(this)/e;return this.copy(t).multiplyScalar(i)}projectOnPlane(t){return na.copy(this).projectOnVector(t),this.sub(na)}reflect(t){return this.sub(na.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const i=this.dot(t)/e;return Math.acos(Ie(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,i=this.y-t.y,r=this.z-t.z;return e*e+i*i+r*r}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,i){const r=Math.sin(e)*t;return this.x=r*Math.sin(i),this.y=Math.cos(e)*t,this.z=r*Math.cos(i),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,i){return this.x=t*Math.sin(e),this.y=i,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),i=this.setFromMatrixColumn(t,1).length(),r=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=i,this.z=r,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,i=Math.sqrt(1-e*e);return this.x=i*Math.cos(t),this.y=e,this.z=i*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const na=new B,Su=new ys;class Ci{constructor(t=new B(1/0,1/0,1/0),e=new B(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,i=t.length;e<i;e+=3)this.expandByPoint(nn.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,i=t.count;e<i;e++)this.expandByPoint(nn.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,i=t.length;e<i;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const i=nn.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(i),this.max.copy(t).add(i),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const i=t.geometry;if(i!==void 0){const s=i.getAttribute("position");if(e===!0&&s!==void 0&&t.isInstancedMesh!==!0)for(let o=0,a=s.count;o<a;o++)t.isMesh===!0?t.getVertexPosition(o,nn):nn.fromBufferAttribute(s,o),nn.applyMatrix4(t.matrixWorld),this.expandByPoint(nn);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Cs.copy(t.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),Cs.copy(i.boundingBox)),Cs.applyMatrix4(t.matrixWorld),this.union(Cs)}const r=t.children;for(let s=0,o=r.length;s<o;s++)this.expandByObject(r[s],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,nn),nn.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,i;return t.normal.x>0?(e=t.normal.x*this.min.x,i=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,i=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,i+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,i+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,i+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,i+=t.normal.z*this.min.z),e<=-t.constant&&i>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Or),Ls.subVectors(this.max,Or),Bi.subVectors(t.a,Or),Hi.subVectors(t.b,Or),zi.subVectors(t.c,Or),zn.subVectors(Hi,Bi),kn.subVectors(zi,Hi),oi.subVectors(Bi,zi);let e=[0,-zn.z,zn.y,0,-kn.z,kn.y,0,-oi.z,oi.y,zn.z,0,-zn.x,kn.z,0,-kn.x,oi.z,0,-oi.x,-zn.y,zn.x,0,-kn.y,kn.x,0,-oi.y,oi.x,0];return!ia(e,Bi,Hi,zi,Ls)||(e=[1,0,0,0,1,0,0,0,1],!ia(e,Bi,Hi,zi,Ls))?!1:(Ps.crossVectors(zn,kn),e=[Ps.x,Ps.y,Ps.z],ia(e,Bi,Hi,zi,Ls))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,nn).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(nn).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(yn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),yn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),yn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),yn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),yn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),yn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),yn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),yn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(yn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const yn=[new B,new B,new B,new B,new B,new B,new B,new B],nn=new B,Cs=new Ci,Bi=new B,Hi=new B,zi=new B,zn=new B,kn=new B,oi=new B,Or=new B,Ls=new B,Ps=new B,ai=new B;function ia(n,t,e,i,r){for(let s=0,o=n.length-3;s<=o;s+=3){ai.fromArray(n,s);const a=r.x*Math.abs(ai.x)+r.y*Math.abs(ai.y)+r.z*Math.abs(ai.z),l=t.dot(ai),c=e.dot(ai),u=i.dot(ai);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>a)return!1}return!0}const o_=new Ci,Fr=new B,ra=new B;class Rr{constructor(t=new B,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const i=this.center;e!==void 0?i.copy(e):o_.setFromPoints(t).getCenter(i);let r=0;for(let s=0,o=t.length;s<o;s++)r=Math.max(r,i.distanceToSquared(t[s]));return this.radius=Math.sqrt(r),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const i=this.center.distanceToSquared(t);return e.copy(t),i>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Fr.subVectors(t,this.center);const e=Fr.lengthSq();if(e>this.radius*this.radius){const i=Math.sqrt(e),r=(i-this.radius)*.5;this.center.addScaledVector(Fr,r/i),this.radius+=r}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(ra.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Fr.copy(t.center).add(ra)),this.expandByPoint(Fr.copy(t.center).sub(ra))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const Tn=new B,sa=new B,Is=new B,Gn=new B,oa=new B,Ds=new B,aa=new B;class mh{constructor(t=new B,e=new B(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Tn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const i=e.dot(this.direction);return i<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=Tn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(Tn.copy(this.origin).addScaledVector(this.direction,e),Tn.distanceToSquared(t))}distanceSqToSegment(t,e,i,r){sa.copy(t).add(e).multiplyScalar(.5),Is.copy(e).sub(t).normalize(),Gn.copy(this.origin).sub(sa);const s=t.distanceTo(e)*.5,o=-this.direction.dot(Is),a=Gn.dot(this.direction),l=-Gn.dot(Is),c=Gn.lengthSq(),u=Math.abs(1-o*o);let d,h,m,g;if(u>0)if(d=o*l-a,h=o*a-l,g=s*u,d>=0)if(h>=-g)if(h<=g){const _=1/u;d*=_,h*=_,m=d*(d+o*h+2*a)+h*(o*d+h+2*l)+c}else h=s,d=Math.max(0,-(o*h+a)),m=-d*d+h*(h+2*l)+c;else h=-s,d=Math.max(0,-(o*h+a)),m=-d*d+h*(h+2*l)+c;else h<=-g?(d=Math.max(0,-(-o*s+a)),h=d>0?-s:Math.min(Math.max(-s,-l),s),m=-d*d+h*(h+2*l)+c):h<=g?(d=0,h=Math.min(Math.max(-s,-l),s),m=h*(h+2*l)+c):(d=Math.max(0,-(o*s+a)),h=d>0?s:Math.min(Math.max(-s,-l),s),m=-d*d+h*(h+2*l)+c);else h=o>0?-s:s,d=Math.max(0,-(o*h+a)),m=-d*d+h*(h+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,d),r&&r.copy(sa).addScaledVector(Is,h),m}intersectSphere(t,e){Tn.subVectors(t.center,this.origin);const i=Tn.dot(this.direction),r=Tn.dot(Tn)-i*i,s=t.radius*t.radius;if(r>s)return null;const o=Math.sqrt(s-r),a=i-o,l=i+o;return l<0?null:a<0?this.at(l,e):this.at(a,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const i=-(this.origin.dot(t.normal)+t.constant)/e;return i>=0?i:null}intersectPlane(t,e){const i=this.distanceToPlane(t);return i===null?null:this.at(i,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let i,r,s,o,a,l;const c=1/this.direction.x,u=1/this.direction.y,d=1/this.direction.z,h=this.origin;return c>=0?(i=(t.min.x-h.x)*c,r=(t.max.x-h.x)*c):(i=(t.max.x-h.x)*c,r=(t.min.x-h.x)*c),u>=0?(s=(t.min.y-h.y)*u,o=(t.max.y-h.y)*u):(s=(t.max.y-h.y)*u,o=(t.min.y-h.y)*u),i>o||s>r||((s>i||isNaN(i))&&(i=s),(o<r||isNaN(r))&&(r=o),d>=0?(a=(t.min.z-h.z)*d,l=(t.max.z-h.z)*d):(a=(t.max.z-h.z)*d,l=(t.min.z-h.z)*d),i>l||a>r)||((a>i||i!==i)&&(i=a),(l<r||r!==r)&&(r=l),r<0)?null:this.at(i>=0?i:r,e)}intersectsBox(t){return this.intersectBox(t,Tn)!==null}intersectTriangle(t,e,i,r,s){oa.subVectors(e,t),Ds.subVectors(i,t),aa.crossVectors(oa,Ds);let o=this.direction.dot(aa),a;if(o>0){if(r)return null;a=1}else if(o<0)a=-1,o=-o;else return null;Gn.subVectors(this.origin,t);const l=a*this.direction.dot(Ds.crossVectors(Gn,Ds));if(l<0)return null;const c=a*this.direction.dot(oa.cross(Gn));if(c<0||l+c>o)return null;const u=-a*Gn.dot(aa);return u<0?null:this.at(u/o,s)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class ae{constructor(t,e,i,r,s,o,a,l,c,u,d,h,m,g,_,p){ae.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,i,r,s,o,a,l,c,u,d,h,m,g,_,p)}set(t,e,i,r,s,o,a,l,c,u,d,h,m,g,_,p){const f=this.elements;return f[0]=t,f[4]=e,f[8]=i,f[12]=r,f[1]=s,f[5]=o,f[9]=a,f[13]=l,f[2]=c,f[6]=u,f[10]=d,f[14]=h,f[3]=m,f[7]=g,f[11]=_,f[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ae().fromArray(this.elements)}copy(t){const e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],e[9]=i[9],e[10]=i[10],e[11]=i[11],e[12]=i[12],e[13]=i[13],e[14]=i[14],e[15]=i[15],this}copyPosition(t){const e=this.elements,i=t.elements;return e[12]=i[12],e[13]=i[13],e[14]=i[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,i){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(t,e,i){return this.set(t.x,e.x,i.x,0,t.y,e.y,i.y,0,t.z,e.z,i.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,i=t.elements,r=1/ki.setFromMatrixColumn(t,0).length(),s=1/ki.setFromMatrixColumn(t,1).length(),o=1/ki.setFromMatrixColumn(t,2).length();return e[0]=i[0]*r,e[1]=i[1]*r,e[2]=i[2]*r,e[3]=0,e[4]=i[4]*s,e[5]=i[5]*s,e[6]=i[6]*s,e[7]=0,e[8]=i[8]*o,e[9]=i[9]*o,e[10]=i[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,i=t.x,r=t.y,s=t.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(r),c=Math.sin(r),u=Math.cos(s),d=Math.sin(s);if(t.order==="XYZ"){const h=o*u,m=o*d,g=a*u,_=a*d;e[0]=l*u,e[4]=-l*d,e[8]=c,e[1]=m+g*c,e[5]=h-_*c,e[9]=-a*l,e[2]=_-h*c,e[6]=g+m*c,e[10]=o*l}else if(t.order==="YXZ"){const h=l*u,m=l*d,g=c*u,_=c*d;e[0]=h+_*a,e[4]=g*a-m,e[8]=o*c,e[1]=o*d,e[5]=o*u,e[9]=-a,e[2]=m*a-g,e[6]=_+h*a,e[10]=o*l}else if(t.order==="ZXY"){const h=l*u,m=l*d,g=c*u,_=c*d;e[0]=h-_*a,e[4]=-o*d,e[8]=g+m*a,e[1]=m+g*a,e[5]=o*u,e[9]=_-h*a,e[2]=-o*c,e[6]=a,e[10]=o*l}else if(t.order==="ZYX"){const h=o*u,m=o*d,g=a*u,_=a*d;e[0]=l*u,e[4]=g*c-m,e[8]=h*c+_,e[1]=l*d,e[5]=_*c+h,e[9]=m*c-g,e[2]=-c,e[6]=a*l,e[10]=o*l}else if(t.order==="YZX"){const h=o*l,m=o*c,g=a*l,_=a*c;e[0]=l*u,e[4]=_-h*d,e[8]=g*d+m,e[1]=d,e[5]=o*u,e[9]=-a*u,e[2]=-c*u,e[6]=m*d+g,e[10]=h-_*d}else if(t.order==="XZY"){const h=o*l,m=o*c,g=a*l,_=a*c;e[0]=l*u,e[4]=-d,e[8]=c*u,e[1]=h*d+_,e[5]=o*u,e[9]=m*d-g,e[2]=g*d-m,e[6]=a*u,e[10]=_*d+h}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(a_,t,l_)}lookAt(t,e,i){const r=this.elements;return ke.subVectors(t,e),ke.lengthSq()===0&&(ke.z=1),ke.normalize(),Vn.crossVectors(i,ke),Vn.lengthSq()===0&&(Math.abs(i.z)===1?ke.x+=1e-4:ke.z+=1e-4,ke.normalize(),Vn.crossVectors(i,ke)),Vn.normalize(),Ns.crossVectors(ke,Vn),r[0]=Vn.x,r[4]=Ns.x,r[8]=ke.x,r[1]=Vn.y,r[5]=Ns.y,r[9]=ke.y,r[2]=Vn.z,r[6]=Ns.z,r[10]=ke.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const i=t.elements,r=e.elements,s=this.elements,o=i[0],a=i[4],l=i[8],c=i[12],u=i[1],d=i[5],h=i[9],m=i[13],g=i[2],_=i[6],p=i[10],f=i[14],T=i[3],y=i[7],E=i[11],N=i[15],A=r[0],w=r[4],P=r[8],M=r[12],S=r[1],C=r[5],W=r[9],U=r[13],X=r[2],K=r[6],V=r[10],J=r[14],G=r[3],it=r[7],ut=r[11],Et=r[15];return s[0]=o*A+a*S+l*X+c*G,s[4]=o*w+a*C+l*K+c*it,s[8]=o*P+a*W+l*V+c*ut,s[12]=o*M+a*U+l*J+c*Et,s[1]=u*A+d*S+h*X+m*G,s[5]=u*w+d*C+h*K+m*it,s[9]=u*P+d*W+h*V+m*ut,s[13]=u*M+d*U+h*J+m*Et,s[2]=g*A+_*S+p*X+f*G,s[6]=g*w+_*C+p*K+f*it,s[10]=g*P+_*W+p*V+f*ut,s[14]=g*M+_*U+p*J+f*Et,s[3]=T*A+y*S+E*X+N*G,s[7]=T*w+y*C+E*K+N*it,s[11]=T*P+y*W+E*V+N*ut,s[15]=T*M+y*U+E*J+N*Et,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],i=t[4],r=t[8],s=t[12],o=t[1],a=t[5],l=t[9],c=t[13],u=t[2],d=t[6],h=t[10],m=t[14],g=t[3],_=t[7],p=t[11],f=t[15];return g*(+s*l*d-r*c*d-s*a*h+i*c*h+r*a*m-i*l*m)+_*(+e*l*m-e*c*h+s*o*h-r*o*m+r*c*u-s*l*u)+p*(+e*c*d-e*a*m-s*o*d+i*o*m+s*a*u-i*c*u)+f*(-r*a*u-e*l*d+e*a*h+r*o*d-i*o*h+i*l*u)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,i){const r=this.elements;return t.isVector3?(r[12]=t.x,r[13]=t.y,r[14]=t.z):(r[12]=t,r[13]=e,r[14]=i),this}invert(){const t=this.elements,e=t[0],i=t[1],r=t[2],s=t[3],o=t[4],a=t[5],l=t[6],c=t[7],u=t[8],d=t[9],h=t[10],m=t[11],g=t[12],_=t[13],p=t[14],f=t[15],T=d*p*c-_*h*c+_*l*m-a*p*m-d*l*f+a*h*f,y=g*h*c-u*p*c-g*l*m+o*p*m+u*l*f-o*h*f,E=u*_*c-g*d*c+g*a*m-o*_*m-u*a*f+o*d*f,N=g*d*l-u*_*l-g*a*h+o*_*h+u*a*p-o*d*p,A=e*T+i*y+r*E+s*N;if(A===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const w=1/A;return t[0]=T*w,t[1]=(_*h*s-d*p*s-_*r*m+i*p*m+d*r*f-i*h*f)*w,t[2]=(a*p*s-_*l*s+_*r*c-i*p*c-a*r*f+i*l*f)*w,t[3]=(d*l*s-a*h*s-d*r*c+i*h*c+a*r*m-i*l*m)*w,t[4]=y*w,t[5]=(u*p*s-g*h*s+g*r*m-e*p*m-u*r*f+e*h*f)*w,t[6]=(g*l*s-o*p*s-g*r*c+e*p*c+o*r*f-e*l*f)*w,t[7]=(o*h*s-u*l*s+u*r*c-e*h*c-o*r*m+e*l*m)*w,t[8]=E*w,t[9]=(g*d*s-u*_*s-g*i*m+e*_*m+u*i*f-e*d*f)*w,t[10]=(o*_*s-g*a*s+g*i*c-e*_*c-o*i*f+e*a*f)*w,t[11]=(u*a*s-o*d*s-u*i*c+e*d*c+o*i*m-e*a*m)*w,t[12]=N*w,t[13]=(u*_*r-g*d*r+g*i*h-e*_*h-u*i*p+e*d*p)*w,t[14]=(g*a*r-o*_*r-g*i*l+e*_*l+o*i*p-e*a*p)*w,t[15]=(o*d*r-u*a*r+u*i*l-e*d*l-o*i*h+e*a*h)*w,this}scale(t){const e=this.elements,i=t.x,r=t.y,s=t.z;return e[0]*=i,e[4]*=r,e[8]*=s,e[1]*=i,e[5]*=r,e[9]*=s,e[2]*=i,e[6]*=r,e[10]*=s,e[3]*=i,e[7]*=r,e[11]*=s,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],i=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],r=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,i,r))}makeTranslation(t,e,i){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,i,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),i=Math.sin(t);return this.set(1,0,0,0,0,e,-i,0,0,i,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),i=Math.sin(t);return this.set(e,0,i,0,0,1,0,0,-i,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,0,i,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const i=Math.cos(e),r=Math.sin(e),s=1-i,o=t.x,a=t.y,l=t.z,c=s*o,u=s*a;return this.set(c*o+i,c*a-r*l,c*l+r*a,0,c*a+r*l,u*a+i,u*l-r*o,0,c*l-r*a,u*l+r*o,s*l*l+i,0,0,0,0,1),this}makeScale(t,e,i){return this.set(t,0,0,0,0,e,0,0,0,0,i,0,0,0,0,1),this}makeShear(t,e,i,r,s,o){return this.set(1,i,s,0,t,1,o,0,e,r,1,0,0,0,0,1),this}compose(t,e,i){const r=this.elements,s=e._x,o=e._y,a=e._z,l=e._w,c=s+s,u=o+o,d=a+a,h=s*c,m=s*u,g=s*d,_=o*u,p=o*d,f=a*d,T=l*c,y=l*u,E=l*d,N=i.x,A=i.y,w=i.z;return r[0]=(1-(_+f))*N,r[1]=(m+E)*N,r[2]=(g-y)*N,r[3]=0,r[4]=(m-E)*A,r[5]=(1-(h+f))*A,r[6]=(p+T)*A,r[7]=0,r[8]=(g+y)*w,r[9]=(p-T)*w,r[10]=(1-(h+_))*w,r[11]=0,r[12]=t.x,r[13]=t.y,r[14]=t.z,r[15]=1,this}decompose(t,e,i){const r=this.elements;let s=ki.set(r[0],r[1],r[2]).length();const o=ki.set(r[4],r[5],r[6]).length(),a=ki.set(r[8],r[9],r[10]).length();this.determinant()<0&&(s=-s),t.x=r[12],t.y=r[13],t.z=r[14],rn.copy(this);const c=1/s,u=1/o,d=1/a;return rn.elements[0]*=c,rn.elements[1]*=c,rn.elements[2]*=c,rn.elements[4]*=u,rn.elements[5]*=u,rn.elements[6]*=u,rn.elements[8]*=d,rn.elements[9]*=d,rn.elements[10]*=d,e.setFromRotationMatrix(rn),i.x=s,i.y=o,i.z=a,this}makePerspective(t,e,i,r,s,o,a=Ln){const l=this.elements,c=2*s/(e-t),u=2*s/(i-r),d=(e+t)/(e-t),h=(i+r)/(i-r);let m,g;if(a===Ln)m=-(o+s)/(o-s),g=-2*o*s/(o-s);else if(a===Oo)m=-o/(o-s),g=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return l[0]=c,l[4]=0,l[8]=d,l[12]=0,l[1]=0,l[5]=u,l[9]=h,l[13]=0,l[2]=0,l[6]=0,l[10]=m,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,i,r,s,o,a=Ln){const l=this.elements,c=1/(e-t),u=1/(i-r),d=1/(o-s),h=(e+t)*c,m=(i+r)*u;let g,_;if(a===Ln)g=(o+s)*d,_=-2*d;else if(a===Oo)g=s*d,_=-1*d;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-h,l[1]=0,l[5]=2*u,l[9]=0,l[13]=-m,l[2]=0,l[6]=0,l[10]=_,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){const e=this.elements,i=t.elements;for(let r=0;r<16;r++)if(e[r]!==i[r])return!1;return!0}fromArray(t,e=0){for(let i=0;i<16;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){const i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t[e+9]=i[9],t[e+10]=i[10],t[e+11]=i[11],t[e+12]=i[12],t[e+13]=i[13],t[e+14]=i[14],t[e+15]=i[15],t}}const ki=new B,rn=new ae,a_=new B(0,0,0),l_=new B(1,1,1),Vn=new B,Ns=new B,ke=new B,Mu=new ae,yu=new ys;class Un{constructor(t=0,e=0,i=0,r=Un.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=i,this._order=r}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,i,r=this._order){return this._x=t,this._y=e,this._z=i,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,i=!0){const r=t.elements,s=r[0],o=r[4],a=r[8],l=r[1],c=r[5],u=r[9],d=r[2],h=r[6],m=r[10];switch(e){case"XYZ":this._y=Math.asin(Ie(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-u,m),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(h,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Ie(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(a,m),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-d,s),this._z=0);break;case"ZXY":this._x=Math.asin(Ie(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(-d,m),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-Ie(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(h,m),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(Ie(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-d,s)):(this._x=0,this._y=Math.atan2(a,m));break;case"XZY":this._z=Math.asin(-Ie(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(h,c),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-u,m),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,i===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,i){return Mu.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Mu,e,i)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return yu.setFromEuler(this),this.setFromQuaternion(yu,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Un.DEFAULT_ORDER="XYZ";class _h{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let c_=0;const Tu=new B,Gi=new ys,bn=new ae,Us=new B,Br=new B,u_=new B,f_=new ys,bu=new B(1,0,0),Au=new B(0,1,0),wu=new B(0,0,1),Ru={type:"added"},d_={type:"removed"},Vi={type:"childadded",child:null},la={type:"childremoved",child:null};class Re extends wr{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:c_++}),this.uuid=Pn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Re.DEFAULT_UP.clone();const t=new B,e=new Un,i=new ys,r=new B(1,1,1);function s(){i.setFromEuler(e,!1)}function o(){e.setFromQuaternion(i,void 0,!1)}e._onChange(s),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new ae},normalMatrix:{value:new Nt}}),this.matrix=new ae,this.matrixWorld=new ae,this.matrixAutoUpdate=Re.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Re.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new _h,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Gi.setFromAxisAngle(t,e),this.quaternion.multiply(Gi),this}rotateOnWorldAxis(t,e){return Gi.setFromAxisAngle(t,e),this.quaternion.premultiply(Gi),this}rotateX(t){return this.rotateOnAxis(bu,t)}rotateY(t){return this.rotateOnAxis(Au,t)}rotateZ(t){return this.rotateOnAxis(wu,t)}translateOnAxis(t,e){return Tu.copy(t).applyQuaternion(this.quaternion),this.position.add(Tu.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(bu,t)}translateY(t){return this.translateOnAxis(Au,t)}translateZ(t){return this.translateOnAxis(wu,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(bn.copy(this.matrixWorld).invert())}lookAt(t,e,i){t.isVector3?Us.copy(t):Us.set(t,e,i);const r=this.parent;this.updateWorldMatrix(!0,!1),Br.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?bn.lookAt(Br,Us,this.up):bn.lookAt(Us,Br,this.up),this.quaternion.setFromRotationMatrix(bn),r&&(bn.extractRotation(r.matrixWorld),Gi.setFromRotationMatrix(bn),this.quaternion.premultiply(Gi.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Ru),Vi.child=t,this.dispatchEvent(Vi),Vi.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(d_),la.child=t,this.dispatchEvent(la),la.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),bn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),bn.multiply(t.parent.matrixWorld)),t.applyMatrix4(bn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Ru),Vi.child=t,this.dispatchEvent(Vi),Vi.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let i=0,r=this.children.length;i<r;i++){const o=this.children[i].getObjectByProperty(t,e);if(o!==void 0)return o}}getObjectsByProperty(t,e,i=[]){this[t]===e&&i.push(this);const r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].getObjectsByProperty(t,e,i);return i}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Br,t,u_),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Br,f_,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let i=0,r=e.length;i<r;i++)e[i].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let i=0,r=e.length;i<r;i++)e[i].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let i=0,r=e.length;i<r;i++)e[i].updateMatrixWorld(t)}updateWorldMatrix(t,e){const i=this.parent;if(t===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const r=this.children;for(let s=0,o=r.length;s<o;s++)r[s].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",i={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const r={};r.uuid=this.uuid,r.type=this.type,this.name!==""&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.visibility=this._visibility,r.active=this._active,r.bounds=this._bounds.map(a=>({boxInitialized:a.boxInitialized,boxMin:a.box.min.toArray(),boxMax:a.box.max.toArray(),sphereInitialized:a.sphereInitialized,sphereRadius:a.sphere.radius,sphereCenter:a.sphere.center.toArray()})),r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.geometryCount=this._geometryCount,r.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(r.boundingSphere={center:r.boundingSphere.center.toArray(),radius:r.boundingSphere.radius}),this.boundingBox!==null&&(r.boundingBox={min:r.boundingBox.min.toArray(),max:r.boundingBox.max.toArray()}));function s(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(t.geometries,this.geometry);const a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){const l=a.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){const d=l[c];s(t.shapes,d)}else s(t.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(t.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(s(t.materials,this.material[l]));r.material=a}else r.material=s(t.materials,this.material);if(this.children.length>0){r.children=[];for(let a=0;a<this.children.length;a++)r.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){r.animations=[];for(let a=0;a<this.animations.length;a++){const l=this.animations[a];r.animations.push(s(t.animations,l))}}if(e){const a=o(t.geometries),l=o(t.materials),c=o(t.textures),u=o(t.images),d=o(t.shapes),h=o(t.skeletons),m=o(t.animations),g=o(t.nodes);a.length>0&&(i.geometries=a),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),u.length>0&&(i.images=u),d.length>0&&(i.shapes=d),h.length>0&&(i.skeletons=h),m.length>0&&(i.animations=m),g.length>0&&(i.nodes=g)}return i.object=r,i;function o(a){const l=[];for(const c in a){const u=a[c];delete u.metadata,l.push(u)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let i=0;i<t.children.length;i++){const r=t.children[i];this.add(r.clone())}return this}}Re.DEFAULT_UP=new B(0,1,0);Re.DEFAULT_MATRIX_AUTO_UPDATE=!0;Re.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const sn=new B,An=new B,ca=new B,wn=new B,Wi=new B,Xi=new B,Cu=new B,ua=new B,fa=new B,da=new B,ha=new de,pa=new de,ma=new de;class Je{constructor(t=new B,e=new B,i=new B){this.a=t,this.b=e,this.c=i}static getNormal(t,e,i,r){r.subVectors(i,e),sn.subVectors(t,e),r.cross(sn);const s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(t,e,i,r,s){sn.subVectors(r,e),An.subVectors(i,e),ca.subVectors(t,e);const o=sn.dot(sn),a=sn.dot(An),l=sn.dot(ca),c=An.dot(An),u=An.dot(ca),d=o*c-a*a;if(d===0)return s.set(0,0,0),null;const h=1/d,m=(c*l-a*u)*h,g=(o*u-a*l)*h;return s.set(1-m-g,g,m)}static containsPoint(t,e,i,r){return this.getBarycoord(t,e,i,r,wn)===null?!1:wn.x>=0&&wn.y>=0&&wn.x+wn.y<=1}static getInterpolation(t,e,i,r,s,o,a,l){return this.getBarycoord(t,e,i,r,wn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,wn.x),l.addScaledVector(o,wn.y),l.addScaledVector(a,wn.z),l)}static getInterpolatedAttribute(t,e,i,r,s,o){return ha.setScalar(0),pa.setScalar(0),ma.setScalar(0),ha.fromBufferAttribute(t,e),pa.fromBufferAttribute(t,i),ma.fromBufferAttribute(t,r),o.setScalar(0),o.addScaledVector(ha,s.x),o.addScaledVector(pa,s.y),o.addScaledVector(ma,s.z),o}static isFrontFacing(t,e,i,r){return sn.subVectors(i,e),An.subVectors(t,e),sn.cross(An).dot(r)<0}set(t,e,i){return this.a.copy(t),this.b.copy(e),this.c.copy(i),this}setFromPointsAndIndices(t,e,i,r){return this.a.copy(t[e]),this.b.copy(t[i]),this.c.copy(t[r]),this}setFromAttributeAndIndices(t,e,i,r){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,i),this.c.fromBufferAttribute(t,r),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return sn.subVectors(this.c,this.b),An.subVectors(this.a,this.b),sn.cross(An).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Je.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return Je.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,i,r,s){return Je.getInterpolation(t,this.a,this.b,this.c,e,i,r,s)}containsPoint(t){return Je.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Je.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const i=this.a,r=this.b,s=this.c;let o,a;Wi.subVectors(r,i),Xi.subVectors(s,i),ua.subVectors(t,i);const l=Wi.dot(ua),c=Xi.dot(ua);if(l<=0&&c<=0)return e.copy(i);fa.subVectors(t,r);const u=Wi.dot(fa),d=Xi.dot(fa);if(u>=0&&d<=u)return e.copy(r);const h=l*d-u*c;if(h<=0&&l>=0&&u<=0)return o=l/(l-u),e.copy(i).addScaledVector(Wi,o);da.subVectors(t,s);const m=Wi.dot(da),g=Xi.dot(da);if(g>=0&&m<=g)return e.copy(s);const _=m*c-l*g;if(_<=0&&c>=0&&g<=0)return a=c/(c-g),e.copy(i).addScaledVector(Xi,a);const p=u*g-m*d;if(p<=0&&d-u>=0&&m-g>=0)return Cu.subVectors(s,r),a=(d-u)/(d-u+(m-g)),e.copy(r).addScaledVector(Cu,a);const f=1/(p+_+h);return o=_*f,a=h*f,e.copy(i).addScaledVector(Wi,o).addScaledVector(Xi,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const gh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Wn={h:0,s:0,l:0},Os={h:0,s:0,l:0};function _a(n,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?n+(t-n)*6*e:e<1/2?t:e<2/3?n+(t-n)*6*(2/3-e):n}class Vt{constructor(t,e,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,i)}set(t,e,i){if(e===void 0&&i===void 0){const r=t;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(t,e,i);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Ve){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Yt.toWorkingColorSpace(this,e),this}setRGB(t,e,i,r=Yt.workingColorSpace){return this.r=t,this.g=e,this.b=i,Yt.toWorkingColorSpace(this,r),this}setHSL(t,e,i,r=Yt.workingColorSpace){if(t=Bc(t,1),e=Ie(e,0,1),i=Ie(i,0,1),e===0)this.r=this.g=this.b=i;else{const s=i<=.5?i*(1+e):i+e-i*e,o=2*i-s;this.r=_a(o,s,t+1/3),this.g=_a(o,s,t),this.b=_a(o,s,t-1/3)}return Yt.toWorkingColorSpace(this,r),this}setStyle(t,e=Ve){function i(s){s!==void 0&&parseFloat(s)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(t)){let s;const o=r[1],a=r[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,e);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,e);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(t)){const s=r[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,e);if(o===6)return this.setHex(parseInt(s,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Ve){const i=gh[t.toLowerCase()];return i!==void 0?this.setHex(i,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=In(t.r),this.g=In(t.g),this.b=In(t.b),this}copyLinearToSRGB(t){return this.r=pr(t.r),this.g=pr(t.g),this.b=pr(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Ve){return Yt.fromWorkingColorSpace(Ae.copy(this),t),Math.round(Ie(Ae.r*255,0,255))*65536+Math.round(Ie(Ae.g*255,0,255))*256+Math.round(Ie(Ae.b*255,0,255))}getHexString(t=Ve){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Yt.workingColorSpace){Yt.fromWorkingColorSpace(Ae.copy(this),e);const i=Ae.r,r=Ae.g,s=Ae.b,o=Math.max(i,r,s),a=Math.min(i,r,s);let l,c;const u=(a+o)/2;if(a===o)l=0,c=0;else{const d=o-a;switch(c=u<=.5?d/(o+a):d/(2-o-a),o){case i:l=(r-s)/d+(r<s?6:0);break;case r:l=(s-i)/d+2;break;case s:l=(i-r)/d+4;break}l/=6}return t.h=l,t.s=c,t.l=u,t}getRGB(t,e=Yt.workingColorSpace){return Yt.fromWorkingColorSpace(Ae.copy(this),e),t.r=Ae.r,t.g=Ae.g,t.b=Ae.b,t}getStyle(t=Ve){Yt.fromWorkingColorSpace(Ae.copy(this),t);const e=Ae.r,i=Ae.g,r=Ae.b;return t!==Ve?`color(${t} ${e.toFixed(3)} ${i.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(i*255)},${Math.round(r*255)})`}offsetHSL(t,e,i){return this.getHSL(Wn),this.setHSL(Wn.h+t,Wn.s+e,Wn.l+i)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,i){return this.r=t.r+(e.r-t.r)*i,this.g=t.g+(e.g-t.g)*i,this.b=t.b+(e.b-t.b)*i,this}lerpHSL(t,e){this.getHSL(Wn),t.getHSL(Os);const i=as(Wn.h,Os.h,e),r=as(Wn.s,Os.s,e),s=as(Wn.l,Os.l,e);return this.setHSL(i,r,s),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,i=this.g,r=this.b,s=t.elements;return this.r=s[0]*e+s[3]*i+s[6]*r,this.g=s[1]*e+s[4]*i+s[7]*r,this.b=s[2]*e+s[5]*i+s[8]*r,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Ae=new Vt;Vt.NAMES=gh;let h_=0;class Cr extends wr{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:h_++}),this.uuid=Pn(),this.name="",this.blending=dr,this.side=ii,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=cl,this.blendDst=ul,this.blendEquation=vi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Vt(0,0,0),this.blendAlpha=0,this.depthFunc=gr,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=du,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Oi,this.stencilZFail=Oi,this.stencilZPass=Oi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const i=t[e];if(i===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const r=this[e];if(r===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(i):r&&r.isVector3&&i&&i.isVector3?r.copy(i):this[e]=i}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const i={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(t).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(t).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(t).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(t).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(t).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==dr&&(i.blending=this.blending),this.side!==ii&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==cl&&(i.blendSrc=this.blendSrc),this.blendDst!==ul&&(i.blendDst=this.blendDst),this.blendEquation!==vi&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==gr&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==du&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Oi&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Oi&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Oi&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function r(s){const o=[];for(const a in s){const l=s[a];delete l.metadata,o.push(l)}return o}if(e){const s=r(t.textures),o=r(t.images);s.length>0&&(i.textures=s),o.length>0&&(i.images=o)}return i}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let i=null;if(e!==null){const r=e.length;i=new Array(r);for(let s=0;s!==r;++s)i[s]=e[s].clone()}return this.clippingPlanes=i,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class we extends Cr{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new Vt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Un,this.combine=th,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const he=new B,Fs=new Wt;class Ce{constructor(t,e,i=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=i,this.usage=ql,this.updateRanges=[],this.gpuType=xn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,i){t*=this.itemSize,i*=e.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[t+r]=e.array[i+r];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,i=this.count;e<i;e++)Fs.fromBufferAttribute(this,e),Fs.applyMatrix3(t),this.setXY(e,Fs.x,Fs.y);else if(this.itemSize===3)for(let e=0,i=this.count;e<i;e++)he.fromBufferAttribute(this,e),he.applyMatrix3(t),this.setXYZ(e,he.x,he.y,he.z);return this}applyMatrix4(t){for(let e=0,i=this.count;e<i;e++)he.fromBufferAttribute(this,e),he.applyMatrix4(t),this.setXYZ(e,he.x,he.y,he.z);return this}applyNormalMatrix(t){for(let e=0,i=this.count;e<i;e++)he.fromBufferAttribute(this,e),he.applyNormalMatrix(t),this.setXYZ(e,he.x,he.y,he.z);return this}transformDirection(t){for(let e=0,i=this.count;e<i;e++)he.fromBufferAttribute(this,e),he.transformDirection(t),this.setXYZ(e,he.x,he.y,he.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let i=this.array[t*this.itemSize+e];return this.normalized&&(i=ln(i,this.array)),i}setComponent(t,e,i){return this.normalized&&(i=te(i,this.array)),this.array[t*this.itemSize+e]=i,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=ln(e,this.array)),e}setX(t,e){return this.normalized&&(e=te(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=ln(e,this.array)),e}setY(t,e){return this.normalized&&(e=te(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=ln(e,this.array)),e}setZ(t,e){return this.normalized&&(e=te(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=ln(e,this.array)),e}setW(t,e){return this.normalized&&(e=te(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,i){return t*=this.itemSize,this.normalized&&(e=te(e,this.array),i=te(i,this.array)),this.array[t+0]=e,this.array[t+1]=i,this}setXYZ(t,e,i,r){return t*=this.itemSize,this.normalized&&(e=te(e,this.array),i=te(i,this.array),r=te(r,this.array)),this.array[t+0]=e,this.array[t+1]=i,this.array[t+2]=r,this}setXYZW(t,e,i,r,s){return t*=this.itemSize,this.normalized&&(e=te(e,this.array),i=te(i,this.array),r=te(r,this.array),s=te(s,this.array)),this.array[t+0]=e,this.array[t+1]=i,this.array[t+2]=r,this.array[t+3]=s,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==ql&&(t.usage=this.usage),t}}class vh extends Ce{constructor(t,e,i){super(new Uint16Array(t),e,i)}}class xh extends Ce{constructor(t,e,i){super(new Uint32Array(t),e,i)}}class yi extends Ce{constructor(t,e,i){super(new Float32Array(t),e,i)}}let p_=0;const Ze=new ae,ga=new Re,Yi=new B,Ge=new Ci,Hr=new Ci,xe=new B;class hn extends wr{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:p_++}),this.uuid=Pn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(dh(t)?xh:vh)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,i=0){this.groups.push({start:t,count:e,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const i=this.attributes.normal;if(i!==void 0){const s=new Nt().getNormalMatrix(t);i.applyNormalMatrix(s),i.needsUpdate=!0}const r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(t),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return Ze.makeRotationFromQuaternion(t),this.applyMatrix4(Ze),this}rotateX(t){return Ze.makeRotationX(t),this.applyMatrix4(Ze),this}rotateY(t){return Ze.makeRotationY(t),this.applyMatrix4(Ze),this}rotateZ(t){return Ze.makeRotationZ(t),this.applyMatrix4(Ze),this}translate(t,e,i){return Ze.makeTranslation(t,e,i),this.applyMatrix4(Ze),this}scale(t,e,i){return Ze.makeScale(t,e,i),this.applyMatrix4(Ze),this}lookAt(t){return ga.lookAt(t),ga.updateMatrix(),this.applyMatrix4(ga.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Yi).negate(),this.translate(Yi.x,Yi.y,Yi.z),this}setFromPoints(t){const e=this.getAttribute("position");if(e===void 0){const i=[];for(let r=0,s=t.length;r<s;r++){const o=t[r];i.push(o.x,o.y,o.z||0)}this.setAttribute("position",new yi(i,3))}else{for(let i=0,r=e.count;i<r;i++){const s=t[i];e.setXYZ(i,s.x,s.y,s.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Ci);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new B(-1/0,-1/0,-1/0),new B(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let i=0,r=e.length;i<r;i++){const s=e[i];Ge.setFromBufferAttribute(s),this.morphTargetsRelative?(xe.addVectors(this.boundingBox.min,Ge.min),this.boundingBox.expandByPoint(xe),xe.addVectors(this.boundingBox.max,Ge.max),this.boundingBox.expandByPoint(xe)):(this.boundingBox.expandByPoint(Ge.min),this.boundingBox.expandByPoint(Ge.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Rr);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new B,1/0);return}if(t){const i=this.boundingSphere.center;if(Ge.setFromBufferAttribute(t),e)for(let s=0,o=e.length;s<o;s++){const a=e[s];Hr.setFromBufferAttribute(a),this.morphTargetsRelative?(xe.addVectors(Ge.min,Hr.min),Ge.expandByPoint(xe),xe.addVectors(Ge.max,Hr.max),Ge.expandByPoint(xe)):(Ge.expandByPoint(Hr.min),Ge.expandByPoint(Hr.max))}Ge.getCenter(i);let r=0;for(let s=0,o=t.count;s<o;s++)xe.fromBufferAttribute(t,s),r=Math.max(r,i.distanceToSquared(xe));if(e)for(let s=0,o=e.length;s<o;s++){const a=e[s],l=this.morphTargetsRelative;for(let c=0,u=a.count;c<u;c++)xe.fromBufferAttribute(a,c),l&&(Yi.fromBufferAttribute(t,c),xe.add(Yi)),r=Math.max(r,i.distanceToSquared(xe))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const i=e.position,r=e.normal,s=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Ce(new Float32Array(4*i.count),4));const o=this.getAttribute("tangent"),a=[],l=[];for(let P=0;P<i.count;P++)a[P]=new B,l[P]=new B;const c=new B,u=new B,d=new B,h=new Wt,m=new Wt,g=new Wt,_=new B,p=new B;function f(P,M,S){c.fromBufferAttribute(i,P),u.fromBufferAttribute(i,M),d.fromBufferAttribute(i,S),h.fromBufferAttribute(s,P),m.fromBufferAttribute(s,M),g.fromBufferAttribute(s,S),u.sub(c),d.sub(c),m.sub(h),g.sub(h);const C=1/(m.x*g.y-g.x*m.y);isFinite(C)&&(_.copy(u).multiplyScalar(g.y).addScaledVector(d,-m.y).multiplyScalar(C),p.copy(d).multiplyScalar(m.x).addScaledVector(u,-g.x).multiplyScalar(C),a[P].add(_),a[M].add(_),a[S].add(_),l[P].add(p),l[M].add(p),l[S].add(p))}let T=this.groups;T.length===0&&(T=[{start:0,count:t.count}]);for(let P=0,M=T.length;P<M;++P){const S=T[P],C=S.start,W=S.count;for(let U=C,X=C+W;U<X;U+=3)f(t.getX(U+0),t.getX(U+1),t.getX(U+2))}const y=new B,E=new B,N=new B,A=new B;function w(P){N.fromBufferAttribute(r,P),A.copy(N);const M=a[P];y.copy(M),y.sub(N.multiplyScalar(N.dot(M))).normalize(),E.crossVectors(A,M);const C=E.dot(l[P])<0?-1:1;o.setXYZW(P,y.x,y.y,y.z,C)}for(let P=0,M=T.length;P<M;++P){const S=T[P],C=S.start,W=S.count;for(let U=C,X=C+W;U<X;U+=3)w(t.getX(U+0)),w(t.getX(U+1)),w(t.getX(U+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let i=this.getAttribute("normal");if(i===void 0)i=new Ce(new Float32Array(e.count*3),3),this.setAttribute("normal",i);else for(let h=0,m=i.count;h<m;h++)i.setXYZ(h,0,0,0);const r=new B,s=new B,o=new B,a=new B,l=new B,c=new B,u=new B,d=new B;if(t)for(let h=0,m=t.count;h<m;h+=3){const g=t.getX(h+0),_=t.getX(h+1),p=t.getX(h+2);r.fromBufferAttribute(e,g),s.fromBufferAttribute(e,_),o.fromBufferAttribute(e,p),u.subVectors(o,s),d.subVectors(r,s),u.cross(d),a.fromBufferAttribute(i,g),l.fromBufferAttribute(i,_),c.fromBufferAttribute(i,p),a.add(u),l.add(u),c.add(u),i.setXYZ(g,a.x,a.y,a.z),i.setXYZ(_,l.x,l.y,l.z),i.setXYZ(p,c.x,c.y,c.z)}else for(let h=0,m=e.count;h<m;h+=3)r.fromBufferAttribute(e,h+0),s.fromBufferAttribute(e,h+1),o.fromBufferAttribute(e,h+2),u.subVectors(o,s),d.subVectors(r,s),u.cross(d),i.setXYZ(h+0,u.x,u.y,u.z),i.setXYZ(h+1,u.x,u.y,u.z),i.setXYZ(h+2,u.x,u.y,u.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,i=t.count;e<i;e++)xe.fromBufferAttribute(t,e),xe.normalize(),t.setXYZ(e,xe.x,xe.y,xe.z)}toNonIndexed(){function t(a,l){const c=a.array,u=a.itemSize,d=a.normalized,h=new c.constructor(l.length*u);let m=0,g=0;for(let _=0,p=l.length;_<p;_++){a.isInterleavedBufferAttribute?m=l[_]*a.data.stride+a.offset:m=l[_]*u;for(let f=0;f<u;f++)h[g++]=c[m++]}return new Ce(h,u,d)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new hn,i=this.index.array,r=this.attributes;for(const a in r){const l=r[a],c=t(l,i);e.setAttribute(a,c)}const s=this.morphAttributes;for(const a in s){const l=[],c=s[a];for(let u=0,d=c.length;u<d;u++){const h=c[u],m=t(h,i);l.push(m)}e.morphAttributes[a]=l}e.morphTargetsRelative=this.morphTargetsRelative;const o=this.groups;for(let a=0,l=o.length;a<l;a++){const c=o[a];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const i=this.attributes;for(const l in i){const c=i[l];t.data.attributes[l]=c.toJSON(t.data)}const r={};let s=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],u=[];for(let d=0,h=c.length;d<h;d++){const m=c[d];u.push(m.toJSON(t.data))}u.length>0&&(r[l]=u,s=!0)}s&&(t.data.morphAttributes=r,t.data.morphTargetsRelative=this.morphTargetsRelative);const o=this.groups;o.length>0&&(t.data.groups=JSON.parse(JSON.stringify(o)));const a=this.boundingSphere;return a!==null&&(t.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const i=t.index;i!==null&&this.setIndex(i.clone(e));const r=t.attributes;for(const c in r){const u=r[c];this.setAttribute(c,u.clone(e))}const s=t.morphAttributes;for(const c in s){const u=[],d=s[c];for(let h=0,m=d.length;h<m;h++)u.push(d[h].clone(e));this.morphAttributes[c]=u}this.morphTargetsRelative=t.morphTargetsRelative;const o=t.groups;for(let c=0,u=o.length;c<u;c++){const d=o[c];this.addGroup(d.start,d.count,d.materialIndex)}const a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Lu=new ae,li=new mh,Bs=new Rr,Pu=new B,Hs=new B,zs=new B,ks=new B,va=new B,Gs=new B,Iu=new B,Vs=new B;class ue extends Re{constructor(t=new hn,e=new we){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,i=Object.keys(e);if(i.length>0){const r=e[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){const a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}getVertexPosition(t,e){const i=this.geometry,r=i.attributes.position,s=i.morphAttributes.position,o=i.morphTargetsRelative;e.fromBufferAttribute(r,t);const a=this.morphTargetInfluences;if(s&&a){Gs.set(0,0,0);for(let l=0,c=s.length;l<c;l++){const u=a[l],d=s[l];u!==0&&(va.fromBufferAttribute(d,t),o?Gs.addScaledVector(va,u):Gs.addScaledVector(va.sub(e),u))}e.add(Gs)}return e}raycast(t,e){const i=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),Bs.copy(i.boundingSphere),Bs.applyMatrix4(s),li.copy(t.ray).recast(t.near),!(Bs.containsPoint(li.origin)===!1&&(li.intersectSphere(Bs,Pu)===null||li.origin.distanceToSquared(Pu)>(t.far-t.near)**2))&&(Lu.copy(s).invert(),li.copy(t.ray).applyMatrix4(Lu),!(i.boundingBox!==null&&li.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(t,e,li)))}_computeIntersections(t,e,i){let r;const s=this.geometry,o=this.material,a=s.index,l=s.attributes.position,c=s.attributes.uv,u=s.attributes.uv1,d=s.attributes.normal,h=s.groups,m=s.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,_=h.length;g<_;g++){const p=h[g],f=o[p.materialIndex],T=Math.max(p.start,m.start),y=Math.min(a.count,Math.min(p.start+p.count,m.start+m.count));for(let E=T,N=y;E<N;E+=3){const A=a.getX(E),w=a.getX(E+1),P=a.getX(E+2);r=Ws(this,f,t,i,c,u,d,A,w,P),r&&(r.faceIndex=Math.floor(E/3),r.face.materialIndex=p.materialIndex,e.push(r))}}else{const g=Math.max(0,m.start),_=Math.min(a.count,m.start+m.count);for(let p=g,f=_;p<f;p+=3){const T=a.getX(p),y=a.getX(p+1),E=a.getX(p+2);r=Ws(this,o,t,i,c,u,d,T,y,E),r&&(r.faceIndex=Math.floor(p/3),e.push(r))}}else if(l!==void 0)if(Array.isArray(o))for(let g=0,_=h.length;g<_;g++){const p=h[g],f=o[p.materialIndex],T=Math.max(p.start,m.start),y=Math.min(l.count,Math.min(p.start+p.count,m.start+m.count));for(let E=T,N=y;E<N;E+=3){const A=E,w=E+1,P=E+2;r=Ws(this,f,t,i,c,u,d,A,w,P),r&&(r.faceIndex=Math.floor(E/3),r.face.materialIndex=p.materialIndex,e.push(r))}}else{const g=Math.max(0,m.start),_=Math.min(l.count,m.start+m.count);for(let p=g,f=_;p<f;p+=3){const T=p,y=p+1,E=p+2;r=Ws(this,o,t,i,c,u,d,T,y,E),r&&(r.faceIndex=Math.floor(p/3),e.push(r))}}}}function m_(n,t,e,i,r,s,o,a){let l;if(t.side===Fe?l=i.intersectTriangle(o,s,r,!0,a):l=i.intersectTriangle(r,s,o,t.side===ii,a),l===null)return null;Vs.copy(a),Vs.applyMatrix4(n.matrixWorld);const c=e.ray.origin.distanceTo(Vs);return c<e.near||c>e.far?null:{distance:c,point:Vs.clone(),object:n}}function Ws(n,t,e,i,r,s,o,a,l,c){n.getVertexPosition(a,Hs),n.getVertexPosition(l,zs),n.getVertexPosition(c,ks);const u=m_(n,t,e,i,Hs,zs,ks,Iu);if(u){const d=new B;Je.getBarycoord(Iu,Hs,zs,ks,d),r&&(u.uv=Je.getInterpolatedAttribute(r,a,l,c,d,new Wt)),s&&(u.uv1=Je.getInterpolatedAttribute(s,a,l,c,d,new Wt)),o&&(u.normal=Je.getInterpolatedAttribute(o,a,l,c,d,new B),u.normal.dot(i.direction)>0&&u.normal.multiplyScalar(-1));const h={a,b:l,c,normal:new B,materialIndex:0};Je.getNormal(Hs,zs,ks,h.normal),u.face=h,u.barycoord=d}return u}class On extends hn{constructor(t=1,e=1,i=1,r=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:i,widthSegments:r,heightSegments:s,depthSegments:o};const a=this;r=Math.floor(r),s=Math.floor(s),o=Math.floor(o);const l=[],c=[],u=[],d=[];let h=0,m=0;g("z","y","x",-1,-1,i,e,t,o,s,0),g("z","y","x",1,-1,i,e,-t,o,s,1),g("x","z","y",1,1,t,i,e,r,o,2),g("x","z","y",1,-1,t,i,-e,r,o,3),g("x","y","z",1,-1,t,e,i,r,s,4),g("x","y","z",-1,-1,t,e,-i,r,s,5),this.setIndex(l),this.setAttribute("position",new yi(c,3)),this.setAttribute("normal",new yi(u,3)),this.setAttribute("uv",new yi(d,2));function g(_,p,f,T,y,E,N,A,w,P,M){const S=E/w,C=N/P,W=E/2,U=N/2,X=A/2,K=w+1,V=P+1;let J=0,G=0;const it=new B;for(let ut=0;ut<V;ut++){const Et=ut*C-U;for(let Ft=0;Ft<K;Ft++){const $t=Ft*S-W;it[_]=$t*T,it[p]=Et*y,it[f]=X,c.push(it.x,it.y,it.z),it[_]=0,it[p]=0,it[f]=A>0?1:-1,u.push(it.x,it.y,it.z),d.push(Ft/w),d.push(1-ut/P),J+=1}}for(let ut=0;ut<P;ut++)for(let Et=0;Et<w;Et++){const Ft=h+Et+K*ut,$t=h+Et+K*(ut+1),k=h+(Et+1)+K*(ut+1),et=h+(Et+1)+K*ut;l.push(Ft,$t,et),l.push($t,k,et),G+=6}a.addGroup(m,G,M),m+=G,h+=J}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new On(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function Mr(n){const t={};for(const e in n){t[e]={};for(const i in n[e]){const r=n[e][i];r&&(r.isColor||r.isMatrix3||r.isMatrix4||r.isVector2||r.isVector3||r.isVector4||r.isTexture||r.isQuaternion)?r.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][i]=null):t[e][i]=r.clone():Array.isArray(r)?t[e][i]=r.slice():t[e][i]=r}}return t}function Pe(n){const t={};for(let e=0;e<n.length;e++){const i=Mr(n[e]);for(const r in i)t[r]=i[r]}return t}function __(n){const t=[];for(let e=0;e<n.length;e++)t.push(n[e].clone());return t}function Eh(n){const t=n.getRenderTarget();return t===null?n.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Yt.workingColorSpace}const g_={clone:Mr,merge:Pe};var v_=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,x_=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class ri extends Cr{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=v_,this.fragmentShader=x_,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Mr(t.uniforms),this.uniformsGroups=__(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const r in this.uniforms){const o=this.uniforms[r].value;o&&o.isTexture?e.uniforms[r]={type:"t",value:o.toJSON(t).uuid}:o&&o.isColor?e.uniforms[r]={type:"c",value:o.getHex()}:o&&o.isVector2?e.uniforms[r]={type:"v2",value:o.toArray()}:o&&o.isVector3?e.uniforms[r]={type:"v3",value:o.toArray()}:o&&o.isVector4?e.uniforms[r]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?e.uniforms[r]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?e.uniforms[r]={type:"m4",value:o.toArray()}:e.uniforms[r]={value:o}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const i={};for(const r in this.extensions)this.extensions[r]===!0&&(i[r]=!0);return Object.keys(i).length>0&&(e.extensions=i),e}}class Sh extends Re{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new ae,this.projectionMatrix=new ae,this.projectionMatrixInverse=new ae,this.coordinateSystem=Ln}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const Xn=new B,Du=new Wt,Nu=new Wt;class je extends Sh{constructor(t=50,e=1,i=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=i,this.far=r,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=_s*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(os*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return _s*2*Math.atan(Math.tan(os*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,i){Xn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(Xn.x,Xn.y).multiplyScalar(-t/Xn.z),Xn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(Xn.x,Xn.y).multiplyScalar(-t/Xn.z)}getViewSize(t,e){return this.getViewBounds(t,Du,Nu),e.subVectors(Nu,Du)}setViewOffset(t,e,i,r,s,o){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(os*.5*this.fov)/this.zoom,i=2*e,r=this.aspect*i,s=-.5*r;const o=this.view;if(this.view!==null&&this.view.enabled){const l=o.fullWidth,c=o.fullHeight;s+=o.offsetX*r/l,e-=o.offsetY*i/c,r*=o.width/l,i*=o.height/c}const a=this.filmOffset;a!==0&&(s+=t*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,e,e-i,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const qi=-90,Zi=1;class E_ extends Re{constructor(t,e,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;const r=new je(qi,Zi,t,e);r.layers=this.layers,this.add(r);const s=new je(qi,Zi,t,e);s.layers=this.layers,this.add(s);const o=new je(qi,Zi,t,e);o.layers=this.layers,this.add(o);const a=new je(qi,Zi,t,e);a.layers=this.layers,this.add(a);const l=new je(qi,Zi,t,e);l.layers=this.layers,this.add(l);const c=new je(qi,Zi,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[i,r,s,o,a,l]=e;for(const c of e)this.remove(c);if(t===Ln)i.up.set(0,1,0),i.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===Oo)i.up.set(0,-1,0),i.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:i,activeMipmapLevel:r}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[s,o,a,l,c,u]=this.children,d=t.getRenderTarget(),h=t.getActiveCubeFace(),m=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;const _=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,t.setRenderTarget(i,0,r),t.render(e,s),t.setRenderTarget(i,1,r),t.render(e,o),t.setRenderTarget(i,2,r),t.render(e,a),t.setRenderTarget(i,3,r),t.render(e,l),t.setRenderTarget(i,4,r),t.render(e,c),i.texture.generateMipmaps=_,t.setRenderTarget(i,5,r),t.render(e,u),t.setRenderTarget(d,h,m),t.xr.enabled=g,i.texture.needsPMREMUpdate=!0}}class Mh extends ye{constructor(t,e,i,r,s,o,a,l,c,u){t=t!==void 0?t:[],e=e!==void 0?e:vr,super(t,e,i,r,s,o,a,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class S_ extends wi{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const i={width:t,height:t,depth:1},r=[i,i,i,i,i,i];this.texture=new Mh(r,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:vn}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new On(5,5,5),s=new ri({name:"CubemapFromEquirect",uniforms:Mr(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Fe,blending:ei});s.uniforms.tEquirect.value=e;const o=new ue(r,s),a=e.minFilter;return e.minFilter===Si&&(e.minFilter=vn),new E_(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e,i,r){const s=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,i,r);t.setRenderTarget(s)}}const xa=new B,M_=new B,y_=new Nt;class pi{constructor(t=new B(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,i,r){return this.normal.set(t,e,i),this.constant=r,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,i){const r=xa.subVectors(i,e).cross(M_.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(r,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const i=t.delta(xa),r=this.normal.dot(i);if(r===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const s=-(t.start.dot(this.normal)+this.constant)/r;return s<0||s>1?null:e.copy(t.start).addScaledVector(i,s)}intersectsLine(t){const e=this.distanceToPoint(t.start),i=this.distanceToPoint(t.end);return e<0&&i>0||i<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const i=e||y_.getNormalMatrix(t),r=this.coplanarPoint(xa).applyMatrix4(t),s=this.normal.applyMatrix3(i).normalize();return this.constant=-r.dot(s),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const ci=new Rr,Xs=new B;class yh{constructor(t=new pi,e=new pi,i=new pi,r=new pi,s=new pi,o=new pi){this.planes=[t,e,i,r,s,o]}set(t,e,i,r,s,o){const a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(i),a[3].copy(r),a[4].copy(s),a[5].copy(o),this}copy(t){const e=this.planes;for(let i=0;i<6;i++)e[i].copy(t.planes[i]);return this}setFromProjectionMatrix(t,e=Ln){const i=this.planes,r=t.elements,s=r[0],o=r[1],a=r[2],l=r[3],c=r[4],u=r[5],d=r[6],h=r[7],m=r[8],g=r[9],_=r[10],p=r[11],f=r[12],T=r[13],y=r[14],E=r[15];if(i[0].setComponents(l-s,h-c,p-m,E-f).normalize(),i[1].setComponents(l+s,h+c,p+m,E+f).normalize(),i[2].setComponents(l+o,h+u,p+g,E+T).normalize(),i[3].setComponents(l-o,h-u,p-g,E-T).normalize(),i[4].setComponents(l-a,h-d,p-_,E-y).normalize(),e===Ln)i[5].setComponents(l+a,h+d,p+_,E+y).normalize();else if(e===Oo)i[5].setComponents(a,d,_,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),ci.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),ci.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(ci)}intersectsSprite(t){return ci.center.set(0,0,0),ci.radius=.7071067811865476,ci.applyMatrix4(t.matrixWorld),this.intersectsSphere(ci)}intersectsSphere(t){const e=this.planes,i=t.center,r=-t.radius;for(let s=0;s<6;s++)if(e[s].distanceToPoint(i)<r)return!1;return!0}intersectsBox(t){const e=this.planes;for(let i=0;i<6;i++){const r=e[i];if(Xs.x=r.normal.x>0?t.max.x:t.min.x,Xs.y=r.normal.y>0?t.max.y:t.min.y,Xs.z=r.normal.z>0?t.max.z:t.min.z,r.distanceToPoint(Xs)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let i=0;i<6;i++)if(e[i].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Th(){let n=null,t=!1,e=null,i=null;function r(s,o){e(s,o),i=n.requestAnimationFrame(r)}return{start:function(){t!==!0&&e!==null&&(i=n.requestAnimationFrame(r),t=!0)},stop:function(){n.cancelAnimationFrame(i),t=!1},setAnimationLoop:function(s){e=s},setContext:function(s){n=s}}}function T_(n){const t=new WeakMap;function e(a,l){const c=a.array,u=a.usage,d=c.byteLength,h=n.createBuffer();n.bindBuffer(l,h),n.bufferData(l,c,u),a.onUploadCallback();let m;if(c instanceof Float32Array)m=n.FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?m=n.HALF_FLOAT:m=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)m=n.SHORT;else if(c instanceof Uint32Array)m=n.UNSIGNED_INT;else if(c instanceof Int32Array)m=n.INT;else if(c instanceof Int8Array)m=n.BYTE;else if(c instanceof Uint8Array)m=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)m=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:h,type:m,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:d}}function i(a,l,c){const u=l.array,d=l.updateRanges;if(n.bindBuffer(c,a),d.length===0)n.bufferSubData(c,0,u);else{d.sort((m,g)=>m.start-g.start);let h=0;for(let m=1;m<d.length;m++){const g=d[h],_=d[m];_.start<=g.start+g.count+1?g.count=Math.max(g.count,_.start+_.count-g.start):(++h,d[h]=_)}d.length=h+1;for(let m=0,g=d.length;m<g;m++){const _=d[m];n.bufferSubData(c,_.start*u.BYTES_PER_ELEMENT,u,_.start,_.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(a){return a.isInterleavedBufferAttribute&&(a=a.data),t.get(a)}function s(a){a.isInterleavedBufferAttribute&&(a=a.data);const l=t.get(a);l&&(n.deleteBuffer(l.buffer),t.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){const u=t.get(a);(!u||u.version<a.version)&&t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}const c=t.get(a);if(c===void 0)t.set(a,e(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:r,remove:s,update:o}}class fn extends hn{constructor(t=1,e=1,i=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:i,heightSegments:r};const s=t/2,o=e/2,a=Math.floor(i),l=Math.floor(r),c=a+1,u=l+1,d=t/a,h=e/l,m=[],g=[],_=[],p=[];for(let f=0;f<u;f++){const T=f*h-o;for(let y=0;y<c;y++){const E=y*d-s;g.push(E,-T,0),_.push(0,0,1),p.push(y/a),p.push(1-f/l)}}for(let f=0;f<l;f++)for(let T=0;T<a;T++){const y=T+c*f,E=T+c*(f+1),N=T+1+c*(f+1),A=T+1+c*f;m.push(y,E,A),m.push(E,N,A)}this.setIndex(m),this.setAttribute("position",new yi(g,3)),this.setAttribute("normal",new yi(_,3)),this.setAttribute("uv",new yi(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new fn(t.width,t.height,t.widthSegments,t.heightSegments)}}var b_=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,A_=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,w_=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,R_=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,C_=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,L_=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,P_=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,I_=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,D_=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,N_=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,U_=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,O_=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,F_=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,B_=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,H_=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,z_=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,k_=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,G_=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,V_=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,W_=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,X_=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Y_=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,q_=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,Z_=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,$_=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,K_=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,j_=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,J_=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Q_=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,tg=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,eg="gl_FragColor = linearToOutputTexel( gl_FragColor );",ng=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,ig=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,rg=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,sg=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,og=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,ag=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,lg=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,cg=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,ug=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fg=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,dg=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,hg=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,pg=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,mg=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,_g=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,gg=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,vg=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,xg=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Eg=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Sg=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Mg=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,yg=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Tg=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,bg=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Ag=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,wg=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Rg=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Cg=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Lg=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Pg=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Ig=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Dg=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Ng=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Ug=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Og=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Fg=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Bg=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Hg=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,zg=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,kg=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Gg=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Vg=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Wg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Xg=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Yg=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,qg=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Zg=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,$g=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Kg=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,jg=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Jg=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Qg=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,t0=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,e0=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,n0=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,i0=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,r0=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,s0=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,o0=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,a0=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,l0=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,c0=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,u0=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,f0=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,d0=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,h0=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,p0=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,m0=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,_0=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,g0=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,v0=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,x0=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,E0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,S0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,M0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,y0=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const T0=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,b0=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,A0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,w0=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,R0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,C0=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,L0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,P0=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,I0=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,D0=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,N0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,U0=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,O0=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,F0=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,B0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,H0=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,z0=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,k0=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,G0=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,V0=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,W0=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,X0=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Y0=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,q0=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Z0=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,$0=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,K0=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,j0=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,J0=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Q0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,tv=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,ev=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,nv=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,iv=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ot={alphahash_fragment:b_,alphahash_pars_fragment:A_,alphamap_fragment:w_,alphamap_pars_fragment:R_,alphatest_fragment:C_,alphatest_pars_fragment:L_,aomap_fragment:P_,aomap_pars_fragment:I_,batching_pars_vertex:D_,batching_vertex:N_,begin_vertex:U_,beginnormal_vertex:O_,bsdfs:F_,iridescence_fragment:B_,bumpmap_pars_fragment:H_,clipping_planes_fragment:z_,clipping_planes_pars_fragment:k_,clipping_planes_pars_vertex:G_,clipping_planes_vertex:V_,color_fragment:W_,color_pars_fragment:X_,color_pars_vertex:Y_,color_vertex:q_,common:Z_,cube_uv_reflection_fragment:$_,defaultnormal_vertex:K_,displacementmap_pars_vertex:j_,displacementmap_vertex:J_,emissivemap_fragment:Q_,emissivemap_pars_fragment:tg,colorspace_fragment:eg,colorspace_pars_fragment:ng,envmap_fragment:ig,envmap_common_pars_fragment:rg,envmap_pars_fragment:sg,envmap_pars_vertex:og,envmap_physical_pars_fragment:gg,envmap_vertex:ag,fog_vertex:lg,fog_pars_vertex:cg,fog_fragment:ug,fog_pars_fragment:fg,gradientmap_pars_fragment:dg,lightmap_pars_fragment:hg,lights_lambert_fragment:pg,lights_lambert_pars_fragment:mg,lights_pars_begin:_g,lights_toon_fragment:vg,lights_toon_pars_fragment:xg,lights_phong_fragment:Eg,lights_phong_pars_fragment:Sg,lights_physical_fragment:Mg,lights_physical_pars_fragment:yg,lights_fragment_begin:Tg,lights_fragment_maps:bg,lights_fragment_end:Ag,logdepthbuf_fragment:wg,logdepthbuf_pars_fragment:Rg,logdepthbuf_pars_vertex:Cg,logdepthbuf_vertex:Lg,map_fragment:Pg,map_pars_fragment:Ig,map_particle_fragment:Dg,map_particle_pars_fragment:Ng,metalnessmap_fragment:Ug,metalnessmap_pars_fragment:Og,morphinstance_vertex:Fg,morphcolor_vertex:Bg,morphnormal_vertex:Hg,morphtarget_pars_vertex:zg,morphtarget_vertex:kg,normal_fragment_begin:Gg,normal_fragment_maps:Vg,normal_pars_fragment:Wg,normal_pars_vertex:Xg,normal_vertex:Yg,normalmap_pars_fragment:qg,clearcoat_normal_fragment_begin:Zg,clearcoat_normal_fragment_maps:$g,clearcoat_pars_fragment:Kg,iridescence_pars_fragment:jg,opaque_fragment:Jg,packing:Qg,premultiplied_alpha_fragment:t0,project_vertex:e0,dithering_fragment:n0,dithering_pars_fragment:i0,roughnessmap_fragment:r0,roughnessmap_pars_fragment:s0,shadowmap_pars_fragment:o0,shadowmap_pars_vertex:a0,shadowmap_vertex:l0,shadowmask_pars_fragment:c0,skinbase_vertex:u0,skinning_pars_vertex:f0,skinning_vertex:d0,skinnormal_vertex:h0,specularmap_fragment:p0,specularmap_pars_fragment:m0,tonemapping_fragment:_0,tonemapping_pars_fragment:g0,transmission_fragment:v0,transmission_pars_fragment:x0,uv_pars_fragment:E0,uv_pars_vertex:S0,uv_vertex:M0,worldpos_vertex:y0,background_vert:T0,background_frag:b0,backgroundCube_vert:A0,backgroundCube_frag:w0,cube_vert:R0,cube_frag:C0,depth_vert:L0,depth_frag:P0,distanceRGBA_vert:I0,distanceRGBA_frag:D0,equirect_vert:N0,equirect_frag:U0,linedashed_vert:O0,linedashed_frag:F0,meshbasic_vert:B0,meshbasic_frag:H0,meshlambert_vert:z0,meshlambert_frag:k0,meshmatcap_vert:G0,meshmatcap_frag:V0,meshnormal_vert:W0,meshnormal_frag:X0,meshphong_vert:Y0,meshphong_frag:q0,meshphysical_vert:Z0,meshphysical_frag:$0,meshtoon_vert:K0,meshtoon_frag:j0,points_vert:J0,points_frag:Q0,shadow_vert:tv,shadow_frag:ev,sprite_vert:nv,sprite_frag:iv},st={common:{diffuse:{value:new Vt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Nt},alphaMap:{value:null},alphaMapTransform:{value:new Nt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Nt}},envmap:{envMap:{value:null},envMapRotation:{value:new Nt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Nt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Nt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Nt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Nt},normalScale:{value:new Wt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Nt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Nt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Nt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Nt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Vt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Vt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Nt},alphaTest:{value:0},uvTransform:{value:new Nt}},sprite:{diffuse:{value:new Vt(16777215)},opacity:{value:1},center:{value:new Wt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Nt},alphaMap:{value:null},alphaMapTransform:{value:new Nt},alphaTest:{value:0}}},_n={basic:{uniforms:Pe([st.common,st.specularmap,st.envmap,st.aomap,st.lightmap,st.fog]),vertexShader:Ot.meshbasic_vert,fragmentShader:Ot.meshbasic_frag},lambert:{uniforms:Pe([st.common,st.specularmap,st.envmap,st.aomap,st.lightmap,st.emissivemap,st.bumpmap,st.normalmap,st.displacementmap,st.fog,st.lights,{emissive:{value:new Vt(0)}}]),vertexShader:Ot.meshlambert_vert,fragmentShader:Ot.meshlambert_frag},phong:{uniforms:Pe([st.common,st.specularmap,st.envmap,st.aomap,st.lightmap,st.emissivemap,st.bumpmap,st.normalmap,st.displacementmap,st.fog,st.lights,{emissive:{value:new Vt(0)},specular:{value:new Vt(1118481)},shininess:{value:30}}]),vertexShader:Ot.meshphong_vert,fragmentShader:Ot.meshphong_frag},standard:{uniforms:Pe([st.common,st.envmap,st.aomap,st.lightmap,st.emissivemap,st.bumpmap,st.normalmap,st.displacementmap,st.roughnessmap,st.metalnessmap,st.fog,st.lights,{emissive:{value:new Vt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ot.meshphysical_vert,fragmentShader:Ot.meshphysical_frag},toon:{uniforms:Pe([st.common,st.aomap,st.lightmap,st.emissivemap,st.bumpmap,st.normalmap,st.displacementmap,st.gradientmap,st.fog,st.lights,{emissive:{value:new Vt(0)}}]),vertexShader:Ot.meshtoon_vert,fragmentShader:Ot.meshtoon_frag},matcap:{uniforms:Pe([st.common,st.bumpmap,st.normalmap,st.displacementmap,st.fog,{matcap:{value:null}}]),vertexShader:Ot.meshmatcap_vert,fragmentShader:Ot.meshmatcap_frag},points:{uniforms:Pe([st.points,st.fog]),vertexShader:Ot.points_vert,fragmentShader:Ot.points_frag},dashed:{uniforms:Pe([st.common,st.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ot.linedashed_vert,fragmentShader:Ot.linedashed_frag},depth:{uniforms:Pe([st.common,st.displacementmap]),vertexShader:Ot.depth_vert,fragmentShader:Ot.depth_frag},normal:{uniforms:Pe([st.common,st.bumpmap,st.normalmap,st.displacementmap,{opacity:{value:1}}]),vertexShader:Ot.meshnormal_vert,fragmentShader:Ot.meshnormal_frag},sprite:{uniforms:Pe([st.sprite,st.fog]),vertexShader:Ot.sprite_vert,fragmentShader:Ot.sprite_frag},background:{uniforms:{uvTransform:{value:new Nt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ot.background_vert,fragmentShader:Ot.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Nt}},vertexShader:Ot.backgroundCube_vert,fragmentShader:Ot.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ot.cube_vert,fragmentShader:Ot.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ot.equirect_vert,fragmentShader:Ot.equirect_frag},distanceRGBA:{uniforms:Pe([st.common,st.displacementmap,{referencePosition:{value:new B},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ot.distanceRGBA_vert,fragmentShader:Ot.distanceRGBA_frag},shadow:{uniforms:Pe([st.lights,st.fog,{color:{value:new Vt(0)},opacity:{value:1}}]),vertexShader:Ot.shadow_vert,fragmentShader:Ot.shadow_frag}};_n.physical={uniforms:Pe([_n.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Nt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Nt},clearcoatNormalScale:{value:new Wt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Nt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Nt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Nt},sheen:{value:0},sheenColor:{value:new Vt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Nt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Nt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Nt},transmissionSamplerSize:{value:new Wt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Nt},attenuationDistance:{value:0},attenuationColor:{value:new Vt(0)},specularColor:{value:new Vt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Nt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Nt},anisotropyVector:{value:new Wt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Nt}}]),vertexShader:Ot.meshphysical_vert,fragmentShader:Ot.meshphysical_frag};const Ys={r:0,b:0,g:0},ui=new Un,rv=new ae;function sv(n,t,e,i,r,s,o){const a=new Vt(0);let l=s===!0?0:1,c,u,d=null,h=0,m=null;function g(T){let y=T.isScene===!0?T.background:null;return y&&y.isTexture&&(y=(T.backgroundBlurriness>0?e:t).get(y)),y}function _(T){let y=!1;const E=g(T);E===null?f(a,l):E&&E.isColor&&(f(E,1),y=!0);const N=n.xr.getEnvironmentBlendMode();N==="additive"?i.buffers.color.setClear(0,0,0,1,o):N==="alpha-blend"&&i.buffers.color.setClear(0,0,0,0,o),(n.autoClear||y)&&(i.buffers.depth.setTest(!0),i.buffers.depth.setMask(!0),i.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function p(T,y){const E=g(y);E&&(E.isCubeTexture||E.mapping===Xo)?(u===void 0&&(u=new ue(new On(1,1,1),new ri({name:"BackgroundCubeMaterial",uniforms:Mr(_n.backgroundCube.uniforms),vertexShader:_n.backgroundCube.vertexShader,fragmentShader:_n.backgroundCube.fragmentShader,side:Fe,depthTest:!1,depthWrite:!1,fog:!1})),u.geometry.deleteAttribute("normal"),u.geometry.deleteAttribute("uv"),u.onBeforeRender=function(N,A,w){this.matrixWorld.copyPosition(w.matrixWorld)},Object.defineProperty(u.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(u)),ui.copy(y.backgroundRotation),ui.x*=-1,ui.y*=-1,ui.z*=-1,E.isCubeTexture&&E.isRenderTargetTexture===!1&&(ui.y*=-1,ui.z*=-1),u.material.uniforms.envMap.value=E,u.material.uniforms.flipEnvMap.value=E.isCubeTexture&&E.isRenderTargetTexture===!1?-1:1,u.material.uniforms.backgroundBlurriness.value=y.backgroundBlurriness,u.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,u.material.uniforms.backgroundRotation.value.setFromMatrix4(rv.makeRotationFromEuler(ui)),u.material.toneMapped=Yt.getTransfer(E.colorSpace)!==ne,(d!==E||h!==E.version||m!==n.toneMapping)&&(u.material.needsUpdate=!0,d=E,h=E.version,m=n.toneMapping),u.layers.enableAll(),T.unshift(u,u.geometry,u.material,0,0,null)):E&&E.isTexture&&(c===void 0&&(c=new ue(new fn(2,2),new ri({name:"BackgroundMaterial",uniforms:Mr(_n.background.uniforms),vertexShader:_n.background.vertexShader,fragmentShader:_n.background.fragmentShader,side:ii,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=E,c.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,c.material.toneMapped=Yt.getTransfer(E.colorSpace)!==ne,E.matrixAutoUpdate===!0&&E.updateMatrix(),c.material.uniforms.uvTransform.value.copy(E.matrix),(d!==E||h!==E.version||m!==n.toneMapping)&&(c.material.needsUpdate=!0,d=E,h=E.version,m=n.toneMapping),c.layers.enableAll(),T.unshift(c,c.geometry,c.material,0,0,null))}function f(T,y){T.getRGB(Ys,Eh(n)),i.buffers.color.setClear(Ys.r,Ys.g,Ys.b,y,o)}return{getClearColor:function(){return a},setClearColor:function(T,y=1){a.set(T),l=y,f(a,l)},getClearAlpha:function(){return l},setClearAlpha:function(T){l=T,f(a,l)},render:_,addToRenderList:p}}function ov(n,t){const e=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},r=h(null);let s=r,o=!1;function a(S,C,W,U,X){let K=!1;const V=d(U,W,C);s!==V&&(s=V,c(s.object)),K=m(S,U,W,X),K&&g(S,U,W,X),X!==null&&t.update(X,n.ELEMENT_ARRAY_BUFFER),(K||o)&&(o=!1,E(S,C,W,U),X!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,t.get(X).buffer))}function l(){return n.createVertexArray()}function c(S){return n.bindVertexArray(S)}function u(S){return n.deleteVertexArray(S)}function d(S,C,W){const U=W.wireframe===!0;let X=i[S.id];X===void 0&&(X={},i[S.id]=X);let K=X[C.id];K===void 0&&(K={},X[C.id]=K);let V=K[U];return V===void 0&&(V=h(l()),K[U]=V),V}function h(S){const C=[],W=[],U=[];for(let X=0;X<e;X++)C[X]=0,W[X]=0,U[X]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:C,enabledAttributes:W,attributeDivisors:U,object:S,attributes:{},index:null}}function m(S,C,W,U){const X=s.attributes,K=C.attributes;let V=0;const J=W.getAttributes();for(const G in J)if(J[G].location>=0){const ut=X[G];let Et=K[G];if(Et===void 0&&(G==="instanceMatrix"&&S.instanceMatrix&&(Et=S.instanceMatrix),G==="instanceColor"&&S.instanceColor&&(Et=S.instanceColor)),ut===void 0||ut.attribute!==Et||Et&&ut.data!==Et.data)return!0;V++}return s.attributesNum!==V||s.index!==U}function g(S,C,W,U){const X={},K=C.attributes;let V=0;const J=W.getAttributes();for(const G in J)if(J[G].location>=0){let ut=K[G];ut===void 0&&(G==="instanceMatrix"&&S.instanceMatrix&&(ut=S.instanceMatrix),G==="instanceColor"&&S.instanceColor&&(ut=S.instanceColor));const Et={};Et.attribute=ut,ut&&ut.data&&(Et.data=ut.data),X[G]=Et,V++}s.attributes=X,s.attributesNum=V,s.index=U}function _(){const S=s.newAttributes;for(let C=0,W=S.length;C<W;C++)S[C]=0}function p(S){f(S,0)}function f(S,C){const W=s.newAttributes,U=s.enabledAttributes,X=s.attributeDivisors;W[S]=1,U[S]===0&&(n.enableVertexAttribArray(S),U[S]=1),X[S]!==C&&(n.vertexAttribDivisor(S,C),X[S]=C)}function T(){const S=s.newAttributes,C=s.enabledAttributes;for(let W=0,U=C.length;W<U;W++)C[W]!==S[W]&&(n.disableVertexAttribArray(W),C[W]=0)}function y(S,C,W,U,X,K,V){V===!0?n.vertexAttribIPointer(S,C,W,X,K):n.vertexAttribPointer(S,C,W,U,X,K)}function E(S,C,W,U){_();const X=U.attributes,K=W.getAttributes(),V=C.defaultAttributeValues;for(const J in K){const G=K[J];if(G.location>=0){let it=X[J];if(it===void 0&&(J==="instanceMatrix"&&S.instanceMatrix&&(it=S.instanceMatrix),J==="instanceColor"&&S.instanceColor&&(it=S.instanceColor)),it!==void 0){const ut=it.normalized,Et=it.itemSize,Ft=t.get(it);if(Ft===void 0)continue;const $t=Ft.buffer,k=Ft.type,et=Ft.bytesPerElement,pt=k===n.INT||k===n.UNSIGNED_INT||it.gpuType===Pc;if(it.isInterleavedBufferAttribute){const nt=it.data,yt=nt.stride,Tt=it.offset;if(nt.isInstancedInterleavedBuffer){for(let Pt=0;Pt<G.locationSize;Pt++)f(G.location+Pt,nt.meshPerAttribute);S.isInstancedMesh!==!0&&U._maxInstanceCount===void 0&&(U._maxInstanceCount=nt.meshPerAttribute*nt.count)}else for(let Pt=0;Pt<G.locationSize;Pt++)p(G.location+Pt);n.bindBuffer(n.ARRAY_BUFFER,$t);for(let Pt=0;Pt<G.locationSize;Pt++)y(G.location+Pt,Et/G.locationSize,k,ut,yt*et,(Tt+Et/G.locationSize*Pt)*et,pt)}else{if(it.isInstancedBufferAttribute){for(let nt=0;nt<G.locationSize;nt++)f(G.location+nt,it.meshPerAttribute);S.isInstancedMesh!==!0&&U._maxInstanceCount===void 0&&(U._maxInstanceCount=it.meshPerAttribute*it.count)}else for(let nt=0;nt<G.locationSize;nt++)p(G.location+nt);n.bindBuffer(n.ARRAY_BUFFER,$t);for(let nt=0;nt<G.locationSize;nt++)y(G.location+nt,Et/G.locationSize,k,ut,Et*et,Et/G.locationSize*nt*et,pt)}}else if(V!==void 0){const ut=V[J];if(ut!==void 0)switch(ut.length){case 2:n.vertexAttrib2fv(G.location,ut);break;case 3:n.vertexAttrib3fv(G.location,ut);break;case 4:n.vertexAttrib4fv(G.location,ut);break;default:n.vertexAttrib1fv(G.location,ut)}}}}T()}function N(){P();for(const S in i){const C=i[S];for(const W in C){const U=C[W];for(const X in U)u(U[X].object),delete U[X];delete C[W]}delete i[S]}}function A(S){if(i[S.id]===void 0)return;const C=i[S.id];for(const W in C){const U=C[W];for(const X in U)u(U[X].object),delete U[X];delete C[W]}delete i[S.id]}function w(S){for(const C in i){const W=i[C];if(W[S.id]===void 0)continue;const U=W[S.id];for(const X in U)u(U[X].object),delete U[X];delete W[S.id]}}function P(){M(),o=!0,s!==r&&(s=r,c(s.object))}function M(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:a,reset:P,resetDefaultState:M,dispose:N,releaseStatesOfGeometry:A,releaseStatesOfProgram:w,initAttributes:_,enableAttribute:p,disableUnusedAttributes:T}}function av(n,t,e){let i;function r(c){i=c}function s(c,u){n.drawArrays(i,c,u),e.update(u,i,1)}function o(c,u,d){d!==0&&(n.drawArraysInstanced(i,c,u,d),e.update(u,i,d))}function a(c,u,d){if(d===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,c,0,u,0,d);let m=0;for(let g=0;g<d;g++)m+=u[g];e.update(m,i,1)}function l(c,u,d,h){if(d===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let g=0;g<c.length;g++)o(c[g],u[g],h[g]);else{m.multiDrawArraysInstancedWEBGL(i,c,0,u,0,h,0,d);let g=0;for(let _=0;_<d;_++)g+=u[_]*h[_];e.update(g,i,1)}}this.setMode=r,this.render=s,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=l}function lv(n,t,e,i){let r;function s(){if(r!==void 0)return r;if(t.has("EXT_texture_filter_anisotropic")===!0){const w=t.get("EXT_texture_filter_anisotropic");r=n.getParameter(w.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function o(w){return!(w!==un&&i.convert(w)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(w){const P=w===Ms&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(w!==Nn&&i.convert(w)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&w!==xn&&!P)}function l(w){if(w==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";w="mediump"}return w==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp";const u=l(c);u!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",u,"instead."),c=u);const d=e.logarithmicDepthBuffer===!0,h=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control"),m=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),g=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=n.getParameter(n.MAX_TEXTURE_SIZE),p=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),f=n.getParameter(n.MAX_VERTEX_ATTRIBS),T=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),y=n.getParameter(n.MAX_VARYING_VECTORS),E=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),N=g>0,A=n.getParameter(n.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:d,reverseDepthBuffer:h,maxTextures:m,maxVertexTextures:g,maxTextureSize:_,maxCubemapSize:p,maxAttributes:f,maxVertexUniforms:T,maxVaryings:y,maxFragmentUniforms:E,vertexTextures:N,maxSamples:A}}function cv(n){const t=this;let e=null,i=0,r=!1,s=!1;const o=new pi,a=new Nt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(d,h){const m=d.length!==0||h||i!==0||r;return r=h,i=d.length,m},this.beginShadows=function(){s=!0,u(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(d,h){e=u(d,h,0)},this.setState=function(d,h,m){const g=d.clippingPlanes,_=d.clipIntersection,p=d.clipShadows,f=n.get(d);if(!r||g===null||g.length===0||s&&!p)s?u(null):c();else{const T=s?0:i,y=T*4;let E=f.clippingState||null;l.value=E,E=u(g,h,y,m);for(let N=0;N!==y;++N)E[N]=e[N];f.clippingState=E,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=T}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=i>0),t.numPlanes=i,t.numIntersection=0}function u(d,h,m,g){const _=d!==null?d.length:0;let p=null;if(_!==0){if(p=l.value,g!==!0||p===null){const f=m+_*4,T=h.matrixWorldInverse;a.getNormalMatrix(T),(p===null||p.length<f)&&(p=new Float32Array(f));for(let y=0,E=m;y!==_;++y,E+=4)o.copy(d[y]).applyMatrix4(T,a),o.normal.toArray(p,E),p[E+3]=o.constant}l.value=p,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,p}}function uv(n){let t=new WeakMap;function e(o,a){return a===vl?o.mapping=vr:a===xl&&(o.mapping=xr),o}function i(o){if(o&&o.isTexture){const a=o.mapping;if(a===vl||a===xl)if(t.has(o)){const l=t.get(o).texture;return e(l,o.mapping)}else{const l=o.image;if(l&&l.height>0){const c=new S_(l.height);return c.fromEquirectangularTexture(n,o),t.set(o,c),o.addEventListener("dispose",r),e(c.texture,o.mapping)}else return null}}return o}function r(o){const a=o.target;a.removeEventListener("dispose",r);const l=t.get(a);l!==void 0&&(t.delete(a),l.dispose())}function s(){t=new WeakMap}return{get:i,dispose:s}}class fv extends Sh{constructor(t=-1,e=1,i=1,r=-1,s=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=i,this.bottom=r,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,i,r,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=i,this.view.offsetY=r,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,r=(this.top+this.bottom)/2;let s=i-t,o=i+t,a=r+e,l=r-e;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,o=s+c*this.view.width,a-=u*this.view.offsetY,l=a-u*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const ar=4,Uu=[.125,.215,.35,.446,.526,.582],xi=20,Ea=new fv,Ou=new Vt;let Sa=null,Ma=0,ya=0,Ta=!1;const mi=(1+Math.sqrt(5))/2,$i=1/mi,Fu=[new B(-mi,$i,0),new B(mi,$i,0),new B(-$i,0,mi),new B($i,0,mi),new B(0,mi,-$i),new B(0,mi,$i),new B(-1,1,-1),new B(1,1,-1),new B(-1,1,1),new B(1,1,1)];class Bu{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,i=.1,r=100){Sa=this._renderer.getRenderTarget(),Ma=this._renderer.getActiveCubeFace(),ya=this._renderer.getActiveMipmapLevel(),Ta=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(t,i,r,s),e>0&&this._blur(s,0,0,e),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ku(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=zu(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(Sa,Ma,ya),this._renderer.xr.enabled=Ta,t.scissorTest=!1,qs(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===vr||t.mapping===xr?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Sa=this._renderer.getRenderTarget(),Ma=this._renderer.getActiveCubeFace(),ya=this._renderer.getActiveMipmapLevel(),Ta=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=e||this._allocateTargets();return this._textureToCubeUV(t,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,i={magFilter:vn,minFilter:vn,generateMipmaps:!1,type:Ms,format:un,colorSpace:Ar,depthBuffer:!1},r=Hu(t,e,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Hu(t,e,i);const{_lodMax:s}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=dv(s)),this._blurMaterial=hv(s,t,e)}return r}_compileMaterial(t){const e=new ue(this._lodPlanes[0],t);this._renderer.compile(e,Ea)}_sceneToCubeUV(t,e,i,r){const a=new je(90,1,e,i),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],u=this._renderer,d=u.autoClear,h=u.toneMapping;u.getClearColor(Ou),u.toneMapping=ni,u.autoClear=!1;const m=new we({name:"PMREM.Background",side:Fe,depthWrite:!1,depthTest:!1}),g=new ue(new On,m);let _=!1;const p=t.background;p?p.isColor&&(m.color.copy(p),t.background=null,_=!0):(m.color.copy(Ou),_=!0);for(let f=0;f<6;f++){const T=f%3;T===0?(a.up.set(0,l[f],0),a.lookAt(c[f],0,0)):T===1?(a.up.set(0,0,l[f]),a.lookAt(0,c[f],0)):(a.up.set(0,l[f],0),a.lookAt(0,0,c[f]));const y=this._cubeSize;qs(r,T*y,f>2?y:0,y,y),u.setRenderTarget(r),_&&u.render(g,a),u.render(t,a)}g.geometry.dispose(),g.material.dispose(),u.toneMapping=h,u.autoClear=d,t.background=p}_textureToCubeUV(t,e){const i=this._renderer,r=t.mapping===vr||t.mapping===xr;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=ku()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=zu());const s=r?this._cubemapMaterial:this._equirectMaterial,o=new ue(this._lodPlanes[0],s),a=s.uniforms;a.envMap.value=t;const l=this._cubeSize;qs(e,0,0,3*l,2*l),i.setRenderTarget(e),i.render(o,Ea)}_applyPMREM(t){const e=this._renderer,i=e.autoClear;e.autoClear=!1;const r=this._lodPlanes.length;for(let s=1;s<r;s++){const o=Math.sqrt(this._sigmas[s]*this._sigmas[s]-this._sigmas[s-1]*this._sigmas[s-1]),a=Fu[(r-s-1)%Fu.length];this._blur(t,s-1,s,o,a)}e.autoClear=i}_blur(t,e,i,r,s){const o=this._pingPongRenderTarget;this._halfBlur(t,o,e,i,r,"latitudinal",s),this._halfBlur(o,t,i,i,r,"longitudinal",s)}_halfBlur(t,e,i,r,s,o,a){const l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const u=3,d=new ue(this._lodPlanes[r],c),h=c.uniforms,m=this._sizeLods[i]-1,g=isFinite(s)?Math.PI/(2*m):2*Math.PI/(2*xi-1),_=s/g,p=isFinite(s)?1+Math.floor(u*_):xi;p>xi&&console.warn(`sigmaRadians, ${s}, is too large and will clip, as it requested ${p} samples when the maximum is set to ${xi}`);const f=[];let T=0;for(let w=0;w<xi;++w){const P=w/_,M=Math.exp(-P*P/2);f.push(M),w===0?T+=M:w<p&&(T+=2*M)}for(let w=0;w<f.length;w++)f[w]=f[w]/T;h.envMap.value=t.texture,h.samples.value=p,h.weights.value=f,h.latitudinal.value=o==="latitudinal",a&&(h.poleAxis.value=a);const{_lodMax:y}=this;h.dTheta.value=g,h.mipInt.value=y-i;const E=this._sizeLods[r],N=3*E*(r>y-ar?r-y+ar:0),A=4*(this._cubeSize-E);qs(e,N,A,3*E,2*E),l.setRenderTarget(e),l.render(d,Ea)}}function dv(n){const t=[],e=[],i=[];let r=n;const s=n-ar+1+Uu.length;for(let o=0;o<s;o++){const a=Math.pow(2,r);e.push(a);let l=1/a;o>n-ar?l=Uu[o-n+ar-1]:o===0&&(l=0),i.push(l);const c=1/(a-2),u=-c,d=1+c,h=[u,u,d,u,d,d,u,u,d,d,u,d],m=6,g=6,_=3,p=2,f=1,T=new Float32Array(_*g*m),y=new Float32Array(p*g*m),E=new Float32Array(f*g*m);for(let A=0;A<m;A++){const w=A%3*2/3-1,P=A>2?0:-1,M=[w,P,0,w+2/3,P,0,w+2/3,P+1,0,w,P,0,w+2/3,P+1,0,w,P+1,0];T.set(M,_*g*A),y.set(h,p*g*A);const S=[A,A,A,A,A,A];E.set(S,f*g*A)}const N=new hn;N.setAttribute("position",new Ce(T,_)),N.setAttribute("uv",new Ce(y,p)),N.setAttribute("faceIndex",new Ce(E,f)),t.push(N),r>ar&&r--}return{lodPlanes:t,sizeLods:e,sigmas:i}}function Hu(n,t,e){const i=new wi(n,t,e);return i.texture.mapping=Xo,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function qs(n,t,e,i,r){n.viewport.set(t,e,i,r),n.scissor.set(t,e,i,r)}function hv(n,t,e){const i=new Float32Array(xi),r=new B(0,1,0);return new ri({name:"SphericalGaussianBlur",defines:{n:xi,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:r}},vertexShader:Hc(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:ei,depthTest:!1,depthWrite:!1})}function zu(){return new ri({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Hc(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:ei,depthTest:!1,depthWrite:!1})}function ku(){return new ri({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Hc(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:ei,depthTest:!1,depthWrite:!1})}function Hc(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function pv(n){let t=new WeakMap,e=null;function i(a){if(a&&a.isTexture){const l=a.mapping,c=l===vl||l===xl,u=l===vr||l===xr;if(c||u){let d=t.get(a);const h=d!==void 0?d.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==h)return e===null&&(e=new Bu(n)),d=c?e.fromEquirectangular(a,d):e.fromCubemap(a,d),d.texture.pmremVersion=a.pmremVersion,t.set(a,d),d.texture;if(d!==void 0)return d.texture;{const m=a.image;return c&&m&&m.height>0||u&&m&&r(m)?(e===null&&(e=new Bu(n)),d=c?e.fromEquirectangular(a):e.fromCubemap(a),d.texture.pmremVersion=a.pmremVersion,t.set(a,d),a.addEventListener("dispose",s),d.texture):null}}}return a}function r(a){let l=0;const c=6;for(let u=0;u<c;u++)a[u]!==void 0&&l++;return l===c}function s(a){const l=a.target;l.removeEventListener("dispose",s);const c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function o(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:i,dispose:o}}function mv(n){const t={};function e(i){if(t[i]!==void 0)return t[i];let r;switch(i){case"WEBGL_depth_texture":r=n.getExtension("WEBGL_depth_texture")||n.getExtension("MOZ_WEBGL_depth_texture")||n.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":r=n.getExtension("EXT_texture_filter_anisotropic")||n.getExtension("MOZ_EXT_texture_filter_anisotropic")||n.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":r=n.getExtension("WEBGL_compressed_texture_s3tc")||n.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":r=n.getExtension("WEBGL_compressed_texture_pvrtc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:r=n.getExtension(i)}return t[i]=r,r}return{has:function(i){return e(i)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(i){const r=e(i);return r===null&&Qr("THREE.WebGLRenderer: "+i+" extension not supported."),r}}}function _v(n,t,e,i){const r={},s=new WeakMap;function o(d){const h=d.target;h.index!==null&&t.remove(h.index);for(const g in h.attributes)t.remove(h.attributes[g]);for(const g in h.morphAttributes){const _=h.morphAttributes[g];for(let p=0,f=_.length;p<f;p++)t.remove(_[p])}h.removeEventListener("dispose",o),delete r[h.id];const m=s.get(h);m&&(t.remove(m),s.delete(h)),i.releaseStatesOfGeometry(h),h.isInstancedBufferGeometry===!0&&delete h._maxInstanceCount,e.memory.geometries--}function a(d,h){return r[h.id]===!0||(h.addEventListener("dispose",o),r[h.id]=!0,e.memory.geometries++),h}function l(d){const h=d.attributes;for(const g in h)t.update(h[g],n.ARRAY_BUFFER);const m=d.morphAttributes;for(const g in m){const _=m[g];for(let p=0,f=_.length;p<f;p++)t.update(_[p],n.ARRAY_BUFFER)}}function c(d){const h=[],m=d.index,g=d.attributes.position;let _=0;if(m!==null){const T=m.array;_=m.version;for(let y=0,E=T.length;y<E;y+=3){const N=T[y+0],A=T[y+1],w=T[y+2];h.push(N,A,A,w,w,N)}}else if(g!==void 0){const T=g.array;_=g.version;for(let y=0,E=T.length/3-1;y<E;y+=3){const N=y+0,A=y+1,w=y+2;h.push(N,A,A,w,w,N)}}else return;const p=new(dh(h)?xh:vh)(h,1);p.version=_;const f=s.get(d);f&&t.remove(f),s.set(d,p)}function u(d){const h=s.get(d);if(h){const m=d.index;m!==null&&h.version<m.version&&c(d)}else c(d);return s.get(d)}return{get:a,update:l,getWireframeAttribute:u}}function gv(n,t,e){let i;function r(h){i=h}let s,o;function a(h){s=h.type,o=h.bytesPerElement}function l(h,m){n.drawElements(i,m,s,h*o),e.update(m,i,1)}function c(h,m,g){g!==0&&(n.drawElementsInstanced(i,m,s,h*o,g),e.update(m,i,g))}function u(h,m,g){if(g===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,m,0,s,h,0,g);let p=0;for(let f=0;f<g;f++)p+=m[f];e.update(p,i,1)}function d(h,m,g,_){if(g===0)return;const p=t.get("WEBGL_multi_draw");if(p===null)for(let f=0;f<h.length;f++)c(h[f]/o,m[f],_[f]);else{p.multiDrawElementsInstancedWEBGL(i,m,0,s,h,0,_,0,g);let f=0;for(let T=0;T<g;T++)f+=m[T]*_[T];e.update(f,i,1)}}this.setMode=r,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=u,this.renderMultiDrawInstances=d}function vv(n){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function i(s,o,a){switch(e.calls++,o){case n.TRIANGLES:e.triangles+=a*(s/3);break;case n.LINES:e.lines+=a*(s/2);break;case n.LINE_STRIP:e.lines+=a*(s-1);break;case n.LINE_LOOP:e.lines+=a*s;break;case n.POINTS:e.points+=a*s;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function r(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:r,update:i}}function xv(n,t,e){const i=new WeakMap,r=new de;function s(o,a,l){const c=o.morphTargetInfluences,u=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,d=u!==void 0?u.length:0;let h=i.get(a);if(h===void 0||h.count!==d){let M=function(){w.dispose(),i.delete(a),a.removeEventListener("dispose",M)};h!==void 0&&h.texture.dispose();const m=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,_=a.morphAttributes.color!==void 0,p=a.morphAttributes.position||[],f=a.morphAttributes.normal||[],T=a.morphAttributes.color||[];let y=0;m===!0&&(y=1),g===!0&&(y=2),_===!0&&(y=3);let E=a.attributes.position.count*y,N=1;E>t.maxTextureSize&&(N=Math.ceil(E/t.maxTextureSize),E=t.maxTextureSize);const A=new Float32Array(E*N*4*d),w=new ph(A,E,N,d);w.type=xn,w.needsUpdate=!0;const P=y*4;for(let S=0;S<d;S++){const C=p[S],W=f[S],U=T[S],X=E*N*4*S;for(let K=0;K<C.count;K++){const V=K*P;m===!0&&(r.fromBufferAttribute(C,K),A[X+V+0]=r.x,A[X+V+1]=r.y,A[X+V+2]=r.z,A[X+V+3]=0),g===!0&&(r.fromBufferAttribute(W,K),A[X+V+4]=r.x,A[X+V+5]=r.y,A[X+V+6]=r.z,A[X+V+7]=0),_===!0&&(r.fromBufferAttribute(U,K),A[X+V+8]=r.x,A[X+V+9]=r.y,A[X+V+10]=r.z,A[X+V+11]=U.itemSize===4?r.w:1)}}h={count:d,texture:w,size:new Wt(E,N)},i.set(a,h),a.addEventListener("dispose",M)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",o.morphTexture,e);else{let m=0;for(let _=0;_<c.length;_++)m+=c[_];const g=a.morphTargetsRelative?1:1-m;l.getUniforms().setValue(n,"morphTargetBaseInfluence",g),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",h.texture,e),l.getUniforms().setValue(n,"morphTargetsTextureSize",h.size)}return{update:s}}function Ev(n,t,e,i){let r=new WeakMap;function s(l){const c=i.render.frame,u=l.geometry,d=t.get(l,u);if(r.get(d)!==c&&(t.update(d),r.set(d,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),r.get(l)!==c&&(e.update(l.instanceMatrix,n.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,n.ARRAY_BUFFER),r.set(l,c))),l.isSkinnedMesh){const h=l.skeleton;r.get(h)!==c&&(h.update(),r.set(h,c))}return d}function o(){r=new WeakMap}function a(l){const c=l.target;c.removeEventListener("dispose",a),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:s,dispose:o}}class bh extends ye{constructor(t,e,i,r,s,o,a,l,c,u=hr){if(u!==hr&&u!==Sr)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");i===void 0&&u===hr&&(i=Ai),i===void 0&&u===Sr&&(i=Er),super(null,r,s,o,a,l,u,i,c),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=a!==void 0?a:Xe,this.minFilter=l!==void 0?l:Xe,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const Ah=new ye,Gu=new bh(1,1),wh=new ph,Rh=new s_,Ch=new Mh,Vu=[],Wu=[],Xu=new Float32Array(16),Yu=new Float32Array(9),qu=new Float32Array(4);function Lr(n,t,e){const i=n[0];if(i<=0||i>0)return n;const r=t*e;let s=Vu[r];if(s===void 0&&(s=new Float32Array(r),Vu[r]=s),t!==0){i.toArray(s,0);for(let o=1,a=0;o!==t;++o)a+=e,n[o].toArray(s,a)}return s}function _e(n,t){if(n.length!==t.length)return!1;for(let e=0,i=n.length;e<i;e++)if(n[e]!==t[e])return!1;return!0}function ge(n,t){for(let e=0,i=t.length;e<i;e++)n[e]=t[e]}function qo(n,t){let e=Wu[t];e===void 0&&(e=new Int32Array(t),Wu[t]=e);for(let i=0;i!==t;++i)e[i]=n.allocateTextureUnit();return e}function Sv(n,t){const e=this.cache;e[0]!==t&&(n.uniform1f(this.addr,t),e[0]=t)}function Mv(n,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(n.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(_e(e,t))return;n.uniform2fv(this.addr,t),ge(e,t)}}function yv(n,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(n.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(n.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(_e(e,t))return;n.uniform3fv(this.addr,t),ge(e,t)}}function Tv(n,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(n.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(_e(e,t))return;n.uniform4fv(this.addr,t),ge(e,t)}}function bv(n,t){const e=this.cache,i=t.elements;if(i===void 0){if(_e(e,t))return;n.uniformMatrix2fv(this.addr,!1,t),ge(e,t)}else{if(_e(e,i))return;qu.set(i),n.uniformMatrix2fv(this.addr,!1,qu),ge(e,i)}}function Av(n,t){const e=this.cache,i=t.elements;if(i===void 0){if(_e(e,t))return;n.uniformMatrix3fv(this.addr,!1,t),ge(e,t)}else{if(_e(e,i))return;Yu.set(i),n.uniformMatrix3fv(this.addr,!1,Yu),ge(e,i)}}function wv(n,t){const e=this.cache,i=t.elements;if(i===void 0){if(_e(e,t))return;n.uniformMatrix4fv(this.addr,!1,t),ge(e,t)}else{if(_e(e,i))return;Xu.set(i),n.uniformMatrix4fv(this.addr,!1,Xu),ge(e,i)}}function Rv(n,t){const e=this.cache;e[0]!==t&&(n.uniform1i(this.addr,t),e[0]=t)}function Cv(n,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(n.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(_e(e,t))return;n.uniform2iv(this.addr,t),ge(e,t)}}function Lv(n,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(n.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(_e(e,t))return;n.uniform3iv(this.addr,t),ge(e,t)}}function Pv(n,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(n.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(_e(e,t))return;n.uniform4iv(this.addr,t),ge(e,t)}}function Iv(n,t){const e=this.cache;e[0]!==t&&(n.uniform1ui(this.addr,t),e[0]=t)}function Dv(n,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(n.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(_e(e,t))return;n.uniform2uiv(this.addr,t),ge(e,t)}}function Nv(n,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(n.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(_e(e,t))return;n.uniform3uiv(this.addr,t),ge(e,t)}}function Uv(n,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(n.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(_e(e,t))return;n.uniform4uiv(this.addr,t),ge(e,t)}}function Ov(n,t,e){const i=this.cache,r=e.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r);let s;this.type===n.SAMPLER_2D_SHADOW?(Gu.compareFunction=fh,s=Gu):s=Ah,e.setTexture2D(t||s,r)}function Fv(n,t,e){const i=this.cache,r=e.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),e.setTexture3D(t||Rh,r)}function Bv(n,t,e){const i=this.cache,r=e.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),e.setTextureCube(t||Ch,r)}function Hv(n,t,e){const i=this.cache,r=e.allocateTextureUnit();i[0]!==r&&(n.uniform1i(this.addr,r),i[0]=r),e.setTexture2DArray(t||wh,r)}function zv(n){switch(n){case 5126:return Sv;case 35664:return Mv;case 35665:return yv;case 35666:return Tv;case 35674:return bv;case 35675:return Av;case 35676:return wv;case 5124:case 35670:return Rv;case 35667:case 35671:return Cv;case 35668:case 35672:return Lv;case 35669:case 35673:return Pv;case 5125:return Iv;case 36294:return Dv;case 36295:return Nv;case 36296:return Uv;case 35678:case 36198:case 36298:case 36306:case 35682:return Ov;case 35679:case 36299:case 36307:return Fv;case 35680:case 36300:case 36308:case 36293:return Bv;case 36289:case 36303:case 36311:case 36292:return Hv}}function kv(n,t){n.uniform1fv(this.addr,t)}function Gv(n,t){const e=Lr(t,this.size,2);n.uniform2fv(this.addr,e)}function Vv(n,t){const e=Lr(t,this.size,3);n.uniform3fv(this.addr,e)}function Wv(n,t){const e=Lr(t,this.size,4);n.uniform4fv(this.addr,e)}function Xv(n,t){const e=Lr(t,this.size,4);n.uniformMatrix2fv(this.addr,!1,e)}function Yv(n,t){const e=Lr(t,this.size,9);n.uniformMatrix3fv(this.addr,!1,e)}function qv(n,t){const e=Lr(t,this.size,16);n.uniformMatrix4fv(this.addr,!1,e)}function Zv(n,t){n.uniform1iv(this.addr,t)}function $v(n,t){n.uniform2iv(this.addr,t)}function Kv(n,t){n.uniform3iv(this.addr,t)}function jv(n,t){n.uniform4iv(this.addr,t)}function Jv(n,t){n.uniform1uiv(this.addr,t)}function Qv(n,t){n.uniform2uiv(this.addr,t)}function tx(n,t){n.uniform3uiv(this.addr,t)}function ex(n,t){n.uniform4uiv(this.addr,t)}function nx(n,t,e){const i=this.cache,r=t.length,s=qo(e,r);_e(i,s)||(n.uniform1iv(this.addr,s),ge(i,s));for(let o=0;o!==r;++o)e.setTexture2D(t[o]||Ah,s[o])}function ix(n,t,e){const i=this.cache,r=t.length,s=qo(e,r);_e(i,s)||(n.uniform1iv(this.addr,s),ge(i,s));for(let o=0;o!==r;++o)e.setTexture3D(t[o]||Rh,s[o])}function rx(n,t,e){const i=this.cache,r=t.length,s=qo(e,r);_e(i,s)||(n.uniform1iv(this.addr,s),ge(i,s));for(let o=0;o!==r;++o)e.setTextureCube(t[o]||Ch,s[o])}function sx(n,t,e){const i=this.cache,r=t.length,s=qo(e,r);_e(i,s)||(n.uniform1iv(this.addr,s),ge(i,s));for(let o=0;o!==r;++o)e.setTexture2DArray(t[o]||wh,s[o])}function ox(n){switch(n){case 5126:return kv;case 35664:return Gv;case 35665:return Vv;case 35666:return Wv;case 35674:return Xv;case 35675:return Yv;case 35676:return qv;case 5124:case 35670:return Zv;case 35667:case 35671:return $v;case 35668:case 35672:return Kv;case 35669:case 35673:return jv;case 5125:return Jv;case 36294:return Qv;case 36295:return tx;case 36296:return ex;case 35678:case 36198:case 36298:case 36306:case 35682:return nx;case 35679:case 36299:case 36307:return ix;case 35680:case 36300:case 36308:case 36293:return rx;case 36289:case 36303:case 36311:case 36292:return sx}}class ax{constructor(t,e,i){this.id=t,this.addr=i,this.cache=[],this.type=e.type,this.setValue=zv(e.type)}}class lx{constructor(t,e,i){this.id=t,this.addr=i,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=ox(e.type)}}class cx{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,i){const r=this.seq;for(let s=0,o=r.length;s!==o;++s){const a=r[s];a.setValue(t,e[a.id],i)}}}const ba=/(\w+)(\])?(\[|\.)?/g;function Zu(n,t){n.seq.push(t),n.map[t.id]=t}function ux(n,t,e){const i=n.name,r=i.length;for(ba.lastIndex=0;;){const s=ba.exec(i),o=ba.lastIndex;let a=s[1];const l=s[2]==="]",c=s[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===r){Zu(e,c===void 0?new ax(a,n,t):new lx(a,n,t));break}else{let d=e.map[a];d===void 0&&(d=new cx(a),Zu(e,d)),e=d}}}class Ao{constructor(t,e){this.seq=[],this.map={};const i=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let r=0;r<i;++r){const s=t.getActiveUniform(e,r),o=t.getUniformLocation(e,s.name);ux(s,o,this)}}setValue(t,e,i,r){const s=this.map[e];s!==void 0&&s.setValue(t,i,r)}setOptional(t,e,i){const r=e[i];r!==void 0&&this.setValue(t,i,r)}static upload(t,e,i,r){for(let s=0,o=e.length;s!==o;++s){const a=e[s],l=i[a.id];l.needsUpdate!==!1&&a.setValue(t,l.value,r)}}static seqWithValue(t,e){const i=[];for(let r=0,s=t.length;r!==s;++r){const o=t[r];o.id in e&&i.push(o)}return i}}function $u(n,t,e){const i=n.createShader(t);return n.shaderSource(i,e),n.compileShader(i),i}const fx=37297;let dx=0;function hx(n,t){const e=n.split(`
`),i=[],r=Math.max(t-6,0),s=Math.min(t+6,e.length);for(let o=r;o<s;o++){const a=o+1;i.push(`${a===t?">":" "} ${a}: ${e[o]}`)}return i.join(`
`)}const Ku=new Nt;function px(n){Yt._getMatrix(Ku,Yt.workingColorSpace,n);const t=`mat3( ${Ku.elements.map(e=>e.toFixed(4))} )`;switch(Yt.getTransfer(n)){case Yo:return[t,"LinearTransferOETF"];case ne:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",n),[t,"LinearTransferOETF"]}}function ju(n,t,e){const i=n.getShaderParameter(t,n.COMPILE_STATUS),r=n.getShaderInfoLog(t).trim();if(i&&r==="")return"";const s=/ERROR: 0:(\d+)/.exec(r);if(s){const o=parseInt(s[1]);return e.toUpperCase()+`

`+r+`

`+hx(n.getShaderSource(t),o)}else return r}function mx(n,t){const e=px(t);return[`vec4 ${n}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function _x(n,t){let e;switch(t){case pm:e="Linear";break;case mm:e="Reinhard";break;case _m:e="Cineon";break;case gm:e="ACESFilmic";break;case xm:e="AgX";break;case Em:e="Neutral";break;case vm:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+n+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const Zs=new B;function gx(){Yt.getLuminanceCoefficients(Zs);const n=Zs.x.toFixed(4),t=Zs.y.toFixed(4),e=Zs.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function vx(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ts).join(`
`)}function xx(n){const t=[];for(const e in n){const i=n[e];i!==!1&&t.push("#define "+e+" "+i)}return t.join(`
`)}function Ex(n,t){const e={},i=n.getProgramParameter(t,n.ACTIVE_ATTRIBUTES);for(let r=0;r<i;r++){const s=n.getActiveAttrib(t,r),o=s.name;let a=1;s.type===n.FLOAT_MAT2&&(a=2),s.type===n.FLOAT_MAT3&&(a=3),s.type===n.FLOAT_MAT4&&(a=4),e[o]={type:s.type,location:n.getAttribLocation(t,o),locationSize:a}}return e}function ts(n){return n!==""}function Ju(n,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Qu(n,t){return n.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const Sx=/^[ \t]*#include +<([\w\d./]+)>/gm;function Zl(n){return n.replace(Sx,yx)}const Mx=new Map;function yx(n,t){let e=Ot[t];if(e===void 0){const i=Mx.get(t);if(i!==void 0)e=Ot[i],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw new Error("Can not resolve #include <"+t+">")}return Zl(e)}const Tx=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function tf(n){return n.replace(Tx,bx)}function bx(n,t,e,i){let r="";for(let s=parseInt(t);s<parseInt(e);s++)r+=i.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function ef(n){let t=`precision ${n.precision} float;
	precision ${n.precision} int;
	precision ${n.precision} sampler2D;
	precision ${n.precision} samplerCube;
	precision ${n.precision} sampler3D;
	precision ${n.precision} sampler2DArray;
	precision ${n.precision} sampler2DShadow;
	precision ${n.precision} samplerCubeShadow;
	precision ${n.precision} sampler2DArrayShadow;
	precision ${n.precision} isampler2D;
	precision ${n.precision} isampler3D;
	precision ${n.precision} isamplerCube;
	precision ${n.precision} isampler2DArray;
	precision ${n.precision} usampler2D;
	precision ${n.precision} usampler3D;
	precision ${n.precision} usamplerCube;
	precision ${n.precision} usampler2DArray;
	`;return n.precision==="highp"?t+=`
#define HIGH_PRECISION`:n.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function Ax(n){let t="SHADOWMAP_TYPE_BASIC";return n.shadowMapType===Qd?t="SHADOWMAP_TYPE_PCF":n.shadowMapType===qp?t="SHADOWMAP_TYPE_PCF_SOFT":n.shadowMapType===Rn&&(t="SHADOWMAP_TYPE_VSM"),t}function wx(n){let t="ENVMAP_TYPE_CUBE";if(n.envMap)switch(n.envMapMode){case vr:case xr:t="ENVMAP_TYPE_CUBE";break;case Xo:t="ENVMAP_TYPE_CUBE_UV";break}return t}function Rx(n){let t="ENVMAP_MODE_REFLECTION";if(n.envMap)switch(n.envMapMode){case xr:t="ENVMAP_MODE_REFRACTION";break}return t}function Cx(n){let t="ENVMAP_BLENDING_NONE";if(n.envMap)switch(n.combine){case th:t="ENVMAP_BLENDING_MULTIPLY";break;case dm:t="ENVMAP_BLENDING_MIX";break;case hm:t="ENVMAP_BLENDING_ADD";break}return t}function Lx(n){const t=n.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:i,maxMip:e}}function Px(n,t,e,i){const r=n.getContext(),s=e.defines;let o=e.vertexShader,a=e.fragmentShader;const l=Ax(e),c=wx(e),u=Rx(e),d=Cx(e),h=Lx(e),m=vx(e),g=xx(s),_=r.createProgram();let p,f,T=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(ts).join(`
`),p.length>0&&(p+=`
`),f=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(ts).join(`
`),f.length>0&&(f+=`
`)):(p=[ef(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+u:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ts).join(`
`),f=[ef(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+u:"",e.envMap?"#define "+d:"",h?"#define CUBEUV_TEXEL_WIDTH "+h.texelWidth:"",h?"#define CUBEUV_TEXEL_HEIGHT "+h.texelHeight:"",h?"#define CUBEUV_MAX_MIP "+h.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==ni?"#define TONE_MAPPING":"",e.toneMapping!==ni?Ot.tonemapping_pars_fragment:"",e.toneMapping!==ni?_x("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Ot.colorspace_pars_fragment,mx("linearToOutputTexel",e.outputColorSpace),gx(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(ts).join(`
`)),o=Zl(o),o=Ju(o,e),o=Qu(o,e),a=Zl(a),a=Ju(a,e),a=Qu(a,e),o=tf(o),a=tf(a),e.isRawShaderMaterial!==!0&&(T=`#version 300 es
`,p=[m,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+p,f=["#define varying in",e.glslVersion===hu?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===hu?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);const y=T+p+o,E=T+f+a,N=$u(r,r.VERTEX_SHADER,y),A=$u(r,r.FRAGMENT_SHADER,E);r.attachShader(_,N),r.attachShader(_,A),e.index0AttributeName!==void 0?r.bindAttribLocation(_,0,e.index0AttributeName):e.morphTargets===!0&&r.bindAttribLocation(_,0,"position"),r.linkProgram(_);function w(C){if(n.debug.checkShaderErrors){const W=r.getProgramInfoLog(_).trim(),U=r.getShaderInfoLog(N).trim(),X=r.getShaderInfoLog(A).trim();let K=!0,V=!0;if(r.getProgramParameter(_,r.LINK_STATUS)===!1)if(K=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(r,_,N,A);else{const J=ju(r,N,"vertex"),G=ju(r,A,"fragment");console.error("THREE.WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(_,r.VALIDATE_STATUS)+`

Material Name: `+C.name+`
Material Type: `+C.type+`

Program Info Log: `+W+`
`+J+`
`+G)}else W!==""?console.warn("THREE.WebGLProgram: Program Info Log:",W):(U===""||X==="")&&(V=!1);V&&(C.diagnostics={runnable:K,programLog:W,vertexShader:{log:U,prefix:p},fragmentShader:{log:X,prefix:f}})}r.deleteShader(N),r.deleteShader(A),P=new Ao(r,_),M=Ex(r,_)}let P;this.getUniforms=function(){return P===void 0&&w(this),P};let M;this.getAttributes=function(){return M===void 0&&w(this),M};let S=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return S===!1&&(S=r.getProgramParameter(_,fx)),S},this.destroy=function(){i.releaseStatesOfProgram(this),r.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=dx++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=N,this.fragmentShader=A,this}let Ix=0;class Dx{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,i=t.fragmentShader,r=this._getShaderStage(e),s=this._getShaderStage(i),o=this._getShaderCacheForMaterial(t);return o.has(r)===!1&&(o.add(r),r.usedTimes++),o.has(s)===!1&&(o.add(s),s.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const i of e)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let i=e.get(t);return i===void 0&&(i=new Set,e.set(t,i)),i}_getShaderStage(t){const e=this.shaderCache;let i=e.get(t);return i===void 0&&(i=new Nx(t),e.set(t,i)),i}}class Nx{constructor(t){this.id=Ix++,this.code=t,this.usedTimes=0}}function Ux(n,t,e,i,r,s,o){const a=new _h,l=new Dx,c=new Set,u=[],d=r.logarithmicDepthBuffer,h=r.vertexTextures;let m=r.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(M){return c.add(M),M===0?"uv":`uv${M}`}function p(M,S,C,W,U){const X=W.fog,K=U.geometry,V=M.isMeshStandardMaterial?W.environment:null,J=(M.isMeshStandardMaterial?e:t).get(M.envMap||V),G=J&&J.mapping===Xo?J.image.height:null,it=g[M.type];M.precision!==null&&(m=r.getMaxPrecision(M.precision),m!==M.precision&&console.warn("THREE.WebGLProgram.getParameters:",M.precision,"not supported, using",m,"instead."));const ut=K.morphAttributes.position||K.morphAttributes.normal||K.morphAttributes.color,Et=ut!==void 0?ut.length:0;let Ft=0;K.morphAttributes.position!==void 0&&(Ft=1),K.morphAttributes.normal!==void 0&&(Ft=2),K.morphAttributes.color!==void 0&&(Ft=3);let $t,k,et,pt;if(it){const Xt=_n[it];$t=Xt.vertexShader,k=Xt.fragmentShader}else $t=M.vertexShader,k=M.fragmentShader,l.update(M),et=l.getVertexShaderID(M),pt=l.getFragmentShaderID(M);const nt=n.getRenderTarget(),yt=n.state.buffers.depth.getReversed(),Tt=U.isInstancedMesh===!0,Pt=U.isBatchedMesh===!0,Jt=!!M.map,zt=!!M.matcap,ee=!!J,I=!!M.aoMap,Me=!!M.lightMap,Bt=!!M.bumpMap,Ht=!!M.normalMap,Mt=!!M.displacementMap,qt=!!M.emissiveMap,St=!!M.metalnessMap,b=!!M.roughnessMap,v=M.anisotropy>0,F=M.clearcoat>0,q=M.dispersion>0,j=M.iridescence>0,Y=M.sheen>0,mt=M.transmission>0,ot=v&&!!M.anisotropyMap,dt=F&&!!M.clearcoatMap,kt=F&&!!M.clearcoatNormalMap,Q=F&&!!M.clearcoatRoughnessMap,ht=j&&!!M.iridescenceMap,bt=j&&!!M.iridescenceThicknessMap,wt=Y&&!!M.sheenColorMap,ft=Y&&!!M.sheenRoughnessMap,Gt=!!M.specularMap,Ct=!!M.specularColorMap,Ut=!!M.specularIntensityMap,L=mt&&!!M.transmissionMap,rt=mt&&!!M.thicknessMap,z=!!M.gradientMap,Z=!!M.alphaMap,lt=M.alphaTest>0,at=!!M.alphaHash,Rt=!!M.extensions;let re=ni;M.toneMapped&&(nt===null||nt.isXRRenderTarget===!0)&&(re=n.toneMapping);const ve={shaderID:it,shaderType:M.type,shaderName:M.name,vertexShader:$t,fragmentShader:k,defines:M.defines,customVertexShaderID:et,customFragmentShaderID:pt,isRawShaderMaterial:M.isRawShaderMaterial===!0,glslVersion:M.glslVersion,precision:m,batching:Pt,batchingColor:Pt&&U._colorsTexture!==null,instancing:Tt,instancingColor:Tt&&U.instanceColor!==null,instancingMorph:Tt&&U.morphTexture!==null,supportsVertexTextures:h,outputColorSpace:nt===null?n.outputColorSpace:nt.isXRRenderTarget===!0?nt.texture.colorSpace:Ar,alphaToCoverage:!!M.alphaToCoverage,map:Jt,matcap:zt,envMap:ee,envMapMode:ee&&J.mapping,envMapCubeUVHeight:G,aoMap:I,lightMap:Me,bumpMap:Bt,normalMap:Ht,displacementMap:h&&Mt,emissiveMap:qt,normalMapObjectSpace:Ht&&M.normalMapType===bm,normalMapTangentSpace:Ht&&M.normalMapType===Tm,metalnessMap:St,roughnessMap:b,anisotropy:v,anisotropyMap:ot,clearcoat:F,clearcoatMap:dt,clearcoatNormalMap:kt,clearcoatRoughnessMap:Q,dispersion:q,iridescence:j,iridescenceMap:ht,iridescenceThicknessMap:bt,sheen:Y,sheenColorMap:wt,sheenRoughnessMap:ft,specularMap:Gt,specularColorMap:Ct,specularIntensityMap:Ut,transmission:mt,transmissionMap:L,thicknessMap:rt,gradientMap:z,opaque:M.transparent===!1&&M.blending===dr&&M.alphaToCoverage===!1,alphaMap:Z,alphaTest:lt,alphaHash:at,combine:M.combine,mapUv:Jt&&_(M.map.channel),aoMapUv:I&&_(M.aoMap.channel),lightMapUv:Me&&_(M.lightMap.channel),bumpMapUv:Bt&&_(M.bumpMap.channel),normalMapUv:Ht&&_(M.normalMap.channel),displacementMapUv:Mt&&_(M.displacementMap.channel),emissiveMapUv:qt&&_(M.emissiveMap.channel),metalnessMapUv:St&&_(M.metalnessMap.channel),roughnessMapUv:b&&_(M.roughnessMap.channel),anisotropyMapUv:ot&&_(M.anisotropyMap.channel),clearcoatMapUv:dt&&_(M.clearcoatMap.channel),clearcoatNormalMapUv:kt&&_(M.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Q&&_(M.clearcoatRoughnessMap.channel),iridescenceMapUv:ht&&_(M.iridescenceMap.channel),iridescenceThicknessMapUv:bt&&_(M.iridescenceThicknessMap.channel),sheenColorMapUv:wt&&_(M.sheenColorMap.channel),sheenRoughnessMapUv:ft&&_(M.sheenRoughnessMap.channel),specularMapUv:Gt&&_(M.specularMap.channel),specularColorMapUv:Ct&&_(M.specularColorMap.channel),specularIntensityMapUv:Ut&&_(M.specularIntensityMap.channel),transmissionMapUv:L&&_(M.transmissionMap.channel),thicknessMapUv:rt&&_(M.thicknessMap.channel),alphaMapUv:Z&&_(M.alphaMap.channel),vertexTangents:!!K.attributes.tangent&&(Ht||v),vertexColors:M.vertexColors,vertexAlphas:M.vertexColors===!0&&!!K.attributes.color&&K.attributes.color.itemSize===4,pointsUvs:U.isPoints===!0&&!!K.attributes.uv&&(Jt||Z),fog:!!X,useFog:M.fog===!0,fogExp2:!!X&&X.isFogExp2,flatShading:M.flatShading===!0,sizeAttenuation:M.sizeAttenuation===!0,logarithmicDepthBuffer:d,reverseDepthBuffer:yt,skinning:U.isSkinnedMesh===!0,morphTargets:K.morphAttributes.position!==void 0,morphNormals:K.morphAttributes.normal!==void 0,morphColors:K.morphAttributes.color!==void 0,morphTargetsCount:Et,morphTextureStride:Ft,numDirLights:S.directional.length,numPointLights:S.point.length,numSpotLights:S.spot.length,numSpotLightMaps:S.spotLightMap.length,numRectAreaLights:S.rectArea.length,numHemiLights:S.hemi.length,numDirLightShadows:S.directionalShadowMap.length,numPointLightShadows:S.pointShadowMap.length,numSpotLightShadows:S.spotShadowMap.length,numSpotLightShadowsWithMaps:S.numSpotLightShadowsWithMaps,numLightProbes:S.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:M.dithering,shadowMapEnabled:n.shadowMap.enabled&&C.length>0,shadowMapType:n.shadowMap.type,toneMapping:re,decodeVideoTexture:Jt&&M.map.isVideoTexture===!0&&Yt.getTransfer(M.map.colorSpace)===ne,decodeVideoTextureEmissive:qt&&M.emissiveMap.isVideoTexture===!0&&Yt.getTransfer(M.emissiveMap.colorSpace)===ne,premultipliedAlpha:M.premultipliedAlpha,doubleSided:M.side===an,flipSided:M.side===Fe,useDepthPacking:M.depthPacking>=0,depthPacking:M.depthPacking||0,index0AttributeName:M.index0AttributeName,extensionClipCullDistance:Rt&&M.extensions.clipCullDistance===!0&&i.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Rt&&M.extensions.multiDraw===!0||Pt)&&i.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:i.has("KHR_parallel_shader_compile"),customProgramCacheKey:M.customProgramCacheKey()};return ve.vertexUv1s=c.has(1),ve.vertexUv2s=c.has(2),ve.vertexUv3s=c.has(3),c.clear(),ve}function f(M){const S=[];if(M.shaderID?S.push(M.shaderID):(S.push(M.customVertexShaderID),S.push(M.customFragmentShaderID)),M.defines!==void 0)for(const C in M.defines)S.push(C),S.push(M.defines[C]);return M.isRawShaderMaterial===!1&&(T(S,M),y(S,M),S.push(n.outputColorSpace)),S.push(M.customProgramCacheKey),S.join()}function T(M,S){M.push(S.precision),M.push(S.outputColorSpace),M.push(S.envMapMode),M.push(S.envMapCubeUVHeight),M.push(S.mapUv),M.push(S.alphaMapUv),M.push(S.lightMapUv),M.push(S.aoMapUv),M.push(S.bumpMapUv),M.push(S.normalMapUv),M.push(S.displacementMapUv),M.push(S.emissiveMapUv),M.push(S.metalnessMapUv),M.push(S.roughnessMapUv),M.push(S.anisotropyMapUv),M.push(S.clearcoatMapUv),M.push(S.clearcoatNormalMapUv),M.push(S.clearcoatRoughnessMapUv),M.push(S.iridescenceMapUv),M.push(S.iridescenceThicknessMapUv),M.push(S.sheenColorMapUv),M.push(S.sheenRoughnessMapUv),M.push(S.specularMapUv),M.push(S.specularColorMapUv),M.push(S.specularIntensityMapUv),M.push(S.transmissionMapUv),M.push(S.thicknessMapUv),M.push(S.combine),M.push(S.fogExp2),M.push(S.sizeAttenuation),M.push(S.morphTargetsCount),M.push(S.morphAttributeCount),M.push(S.numDirLights),M.push(S.numPointLights),M.push(S.numSpotLights),M.push(S.numSpotLightMaps),M.push(S.numHemiLights),M.push(S.numRectAreaLights),M.push(S.numDirLightShadows),M.push(S.numPointLightShadows),M.push(S.numSpotLightShadows),M.push(S.numSpotLightShadowsWithMaps),M.push(S.numLightProbes),M.push(S.shadowMapType),M.push(S.toneMapping),M.push(S.numClippingPlanes),M.push(S.numClipIntersection),M.push(S.depthPacking)}function y(M,S){a.disableAll(),S.supportsVertexTextures&&a.enable(0),S.instancing&&a.enable(1),S.instancingColor&&a.enable(2),S.instancingMorph&&a.enable(3),S.matcap&&a.enable(4),S.envMap&&a.enable(5),S.normalMapObjectSpace&&a.enable(6),S.normalMapTangentSpace&&a.enable(7),S.clearcoat&&a.enable(8),S.iridescence&&a.enable(9),S.alphaTest&&a.enable(10),S.vertexColors&&a.enable(11),S.vertexAlphas&&a.enable(12),S.vertexUv1s&&a.enable(13),S.vertexUv2s&&a.enable(14),S.vertexUv3s&&a.enable(15),S.vertexTangents&&a.enable(16),S.anisotropy&&a.enable(17),S.alphaHash&&a.enable(18),S.batching&&a.enable(19),S.dispersion&&a.enable(20),S.batchingColor&&a.enable(21),M.push(a.mask),a.disableAll(),S.fog&&a.enable(0),S.useFog&&a.enable(1),S.flatShading&&a.enable(2),S.logarithmicDepthBuffer&&a.enable(3),S.reverseDepthBuffer&&a.enable(4),S.skinning&&a.enable(5),S.morphTargets&&a.enable(6),S.morphNormals&&a.enable(7),S.morphColors&&a.enable(8),S.premultipliedAlpha&&a.enable(9),S.shadowMapEnabled&&a.enable(10),S.doubleSided&&a.enable(11),S.flipSided&&a.enable(12),S.useDepthPacking&&a.enable(13),S.dithering&&a.enable(14),S.transmission&&a.enable(15),S.sheen&&a.enable(16),S.opaque&&a.enable(17),S.pointsUvs&&a.enable(18),S.decodeVideoTexture&&a.enable(19),S.decodeVideoTextureEmissive&&a.enable(20),S.alphaToCoverage&&a.enable(21),M.push(a.mask)}function E(M){const S=g[M.type];let C;if(S){const W=_n[S];C=g_.clone(W.uniforms)}else C=M.uniforms;return C}function N(M,S){let C;for(let W=0,U=u.length;W<U;W++){const X=u[W];if(X.cacheKey===S){C=X,++C.usedTimes;break}}return C===void 0&&(C=new Px(n,S,M,s),u.push(C)),C}function A(M){if(--M.usedTimes===0){const S=u.indexOf(M);u[S]=u[u.length-1],u.pop(),M.destroy()}}function w(M){l.remove(M)}function P(){l.dispose()}return{getParameters:p,getProgramCacheKey:f,getUniforms:E,acquireProgram:N,releaseProgram:A,releaseShaderCache:w,programs:u,dispose:P}}function Ox(){let n=new WeakMap;function t(o){return n.has(o)}function e(o){let a=n.get(o);return a===void 0&&(a={},n.set(o,a)),a}function i(o){n.delete(o)}function r(o,a,l){n.get(o)[a]=l}function s(){n=new WeakMap}return{has:t,get:e,remove:i,update:r,dispose:s}}function Fx(n,t){return n.groupOrder!==t.groupOrder?n.groupOrder-t.groupOrder:n.renderOrder!==t.renderOrder?n.renderOrder-t.renderOrder:n.material.id!==t.material.id?n.material.id-t.material.id:n.z!==t.z?n.z-t.z:n.id-t.id}function nf(n,t){return n.groupOrder!==t.groupOrder?n.groupOrder-t.groupOrder:n.renderOrder!==t.renderOrder?n.renderOrder-t.renderOrder:n.z!==t.z?t.z-n.z:n.id-t.id}function rf(){const n=[];let t=0;const e=[],i=[],r=[];function s(){t=0,e.length=0,i.length=0,r.length=0}function o(d,h,m,g,_,p){let f=n[t];return f===void 0?(f={id:d.id,object:d,geometry:h,material:m,groupOrder:g,renderOrder:d.renderOrder,z:_,group:p},n[t]=f):(f.id=d.id,f.object=d,f.geometry=h,f.material=m,f.groupOrder=g,f.renderOrder=d.renderOrder,f.z=_,f.group=p),t++,f}function a(d,h,m,g,_,p){const f=o(d,h,m,g,_,p);m.transmission>0?i.push(f):m.transparent===!0?r.push(f):e.push(f)}function l(d,h,m,g,_,p){const f=o(d,h,m,g,_,p);m.transmission>0?i.unshift(f):m.transparent===!0?r.unshift(f):e.unshift(f)}function c(d,h){e.length>1&&e.sort(d||Fx),i.length>1&&i.sort(h||nf),r.length>1&&r.sort(h||nf)}function u(){for(let d=t,h=n.length;d<h;d++){const m=n[d];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:e,transmissive:i,transparent:r,init:s,push:a,unshift:l,finish:u,sort:c}}function Bx(){let n=new WeakMap;function t(i,r){const s=n.get(i);let o;return s===void 0?(o=new rf,n.set(i,[o])):r>=s.length?(o=new rf,s.push(o)):o=s[r],o}function e(){n=new WeakMap}return{get:t,dispose:e}}function Hx(){const n={};return{get:function(t){if(n[t.id]!==void 0)return n[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new B,color:new Vt};break;case"SpotLight":e={position:new B,direction:new B,color:new Vt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new B,color:new Vt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new B,skyColor:new Vt,groundColor:new Vt};break;case"RectAreaLight":e={color:new Vt,position:new B,halfWidth:new B,halfHeight:new B};break}return n[t.id]=e,e}}}function zx(){const n={};return{get:function(t){if(n[t.id]!==void 0)return n[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Wt};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Wt};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Wt,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[t.id]=e,e}}}let kx=0;function Gx(n,t){return(t.castShadow?2:0)-(n.castShadow?2:0)+(t.map?1:0)-(n.map?1:0)}function Vx(n){const t=new Hx,e=zx(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new B);const r=new B,s=new ae,o=new ae;function a(c){let u=0,d=0,h=0;for(let M=0;M<9;M++)i.probe[M].set(0,0,0);let m=0,g=0,_=0,p=0,f=0,T=0,y=0,E=0,N=0,A=0,w=0;c.sort(Gx);for(let M=0,S=c.length;M<S;M++){const C=c[M],W=C.color,U=C.intensity,X=C.distance,K=C.shadow&&C.shadow.map?C.shadow.map.texture:null;if(C.isAmbientLight)u+=W.r*U,d+=W.g*U,h+=W.b*U;else if(C.isLightProbe){for(let V=0;V<9;V++)i.probe[V].addScaledVector(C.sh.coefficients[V],U);w++}else if(C.isDirectionalLight){const V=t.get(C);if(V.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){const J=C.shadow,G=e.get(C);G.shadowIntensity=J.intensity,G.shadowBias=J.bias,G.shadowNormalBias=J.normalBias,G.shadowRadius=J.radius,G.shadowMapSize=J.mapSize,i.directionalShadow[m]=G,i.directionalShadowMap[m]=K,i.directionalShadowMatrix[m]=C.shadow.matrix,T++}i.directional[m]=V,m++}else if(C.isSpotLight){const V=t.get(C);V.position.setFromMatrixPosition(C.matrixWorld),V.color.copy(W).multiplyScalar(U),V.distance=X,V.coneCos=Math.cos(C.angle),V.penumbraCos=Math.cos(C.angle*(1-C.penumbra)),V.decay=C.decay,i.spot[_]=V;const J=C.shadow;if(C.map&&(i.spotLightMap[N]=C.map,N++,J.updateMatrices(C),C.castShadow&&A++),i.spotLightMatrix[_]=J.matrix,C.castShadow){const G=e.get(C);G.shadowIntensity=J.intensity,G.shadowBias=J.bias,G.shadowNormalBias=J.normalBias,G.shadowRadius=J.radius,G.shadowMapSize=J.mapSize,i.spotShadow[_]=G,i.spotShadowMap[_]=K,E++}_++}else if(C.isRectAreaLight){const V=t.get(C);V.color.copy(W).multiplyScalar(U),V.halfWidth.set(C.width*.5,0,0),V.halfHeight.set(0,C.height*.5,0),i.rectArea[p]=V,p++}else if(C.isPointLight){const V=t.get(C);if(V.color.copy(C.color).multiplyScalar(C.intensity),V.distance=C.distance,V.decay=C.decay,C.castShadow){const J=C.shadow,G=e.get(C);G.shadowIntensity=J.intensity,G.shadowBias=J.bias,G.shadowNormalBias=J.normalBias,G.shadowRadius=J.radius,G.shadowMapSize=J.mapSize,G.shadowCameraNear=J.camera.near,G.shadowCameraFar=J.camera.far,i.pointShadow[g]=G,i.pointShadowMap[g]=K,i.pointShadowMatrix[g]=C.shadow.matrix,y++}i.point[g]=V,g++}else if(C.isHemisphereLight){const V=t.get(C);V.skyColor.copy(C.color).multiplyScalar(U),V.groundColor.copy(C.groundColor).multiplyScalar(U),i.hemi[f]=V,f++}}p>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=st.LTC_FLOAT_1,i.rectAreaLTC2=st.LTC_FLOAT_2):(i.rectAreaLTC1=st.LTC_HALF_1,i.rectAreaLTC2=st.LTC_HALF_2)),i.ambient[0]=u,i.ambient[1]=d,i.ambient[2]=h;const P=i.hash;(P.directionalLength!==m||P.pointLength!==g||P.spotLength!==_||P.rectAreaLength!==p||P.hemiLength!==f||P.numDirectionalShadows!==T||P.numPointShadows!==y||P.numSpotShadows!==E||P.numSpotMaps!==N||P.numLightProbes!==w)&&(i.directional.length=m,i.spot.length=_,i.rectArea.length=p,i.point.length=g,i.hemi.length=f,i.directionalShadow.length=T,i.directionalShadowMap.length=T,i.pointShadow.length=y,i.pointShadowMap.length=y,i.spotShadow.length=E,i.spotShadowMap.length=E,i.directionalShadowMatrix.length=T,i.pointShadowMatrix.length=y,i.spotLightMatrix.length=E+N-A,i.spotLightMap.length=N,i.numSpotLightShadowsWithMaps=A,i.numLightProbes=w,P.directionalLength=m,P.pointLength=g,P.spotLength=_,P.rectAreaLength=p,P.hemiLength=f,P.numDirectionalShadows=T,P.numPointShadows=y,P.numSpotShadows=E,P.numSpotMaps=N,P.numLightProbes=w,i.version=kx++)}function l(c,u){let d=0,h=0,m=0,g=0,_=0;const p=u.matrixWorldInverse;for(let f=0,T=c.length;f<T;f++){const y=c[f];if(y.isDirectionalLight){const E=i.directional[d];E.direction.setFromMatrixPosition(y.matrixWorld),r.setFromMatrixPosition(y.target.matrixWorld),E.direction.sub(r),E.direction.transformDirection(p),d++}else if(y.isSpotLight){const E=i.spot[m];E.position.setFromMatrixPosition(y.matrixWorld),E.position.applyMatrix4(p),E.direction.setFromMatrixPosition(y.matrixWorld),r.setFromMatrixPosition(y.target.matrixWorld),E.direction.sub(r),E.direction.transformDirection(p),m++}else if(y.isRectAreaLight){const E=i.rectArea[g];E.position.setFromMatrixPosition(y.matrixWorld),E.position.applyMatrix4(p),o.identity(),s.copy(y.matrixWorld),s.premultiply(p),o.extractRotation(s),E.halfWidth.set(y.width*.5,0,0),E.halfHeight.set(0,y.height*.5,0),E.halfWidth.applyMatrix4(o),E.halfHeight.applyMatrix4(o),g++}else if(y.isPointLight){const E=i.point[h];E.position.setFromMatrixPosition(y.matrixWorld),E.position.applyMatrix4(p),h++}else if(y.isHemisphereLight){const E=i.hemi[_];E.direction.setFromMatrixPosition(y.matrixWorld),E.direction.transformDirection(p),_++}}}return{setup:a,setupView:l,state:i}}function sf(n){const t=new Vx(n),e=[],i=[];function r(u){c.camera=u,e.length=0,i.length=0}function s(u){e.push(u)}function o(u){i.push(u)}function a(){t.setup(e)}function l(u){t.setupView(e,u)}const c={lightsArray:e,shadowsArray:i,camera:null,lights:t,transmissionRenderTarget:{}};return{init:r,state:c,setupLights:a,setupLightsView:l,pushLight:s,pushShadow:o}}function Wx(n){let t=new WeakMap;function e(r,s=0){const o=t.get(r);let a;return o===void 0?(a=new sf(n),t.set(r,[a])):s>=o.length?(a=new sf(n),o.push(a)):a=o[s],a}function i(){t=new WeakMap}return{get:e,dispose:i}}class Xx extends Cr{static get type(){return"MeshDepthMaterial"}constructor(t){super(),this.isMeshDepthMaterial=!0,this.depthPacking=Mm,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class Yx extends Cr{static get type(){return"MeshDistanceMaterial"}constructor(t){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const qx=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Zx=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function $x(n,t,e){let i=new yh;const r=new Wt,s=new Wt,o=new de,a=new Xx({depthPacking:ym}),l=new Yx,c={},u=e.maxTextureSize,d={[ii]:Fe,[Fe]:ii,[an]:an},h=new ri({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Wt},radius:{value:4}},vertexShader:qx,fragmentShader:Zx}),m=h.clone();m.defines.HORIZONTAL_PASS=1;const g=new hn;g.setAttribute("position",new Ce(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const _=new ue(g,h),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Qd;let f=this.type;this.render=function(A,w,P){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||A.length===0)return;const M=n.getRenderTarget(),S=n.getActiveCubeFace(),C=n.getActiveMipmapLevel(),W=n.state;W.setBlending(ei),W.buffers.color.setClear(1,1,1,1),W.buffers.depth.setTest(!0),W.setScissorTest(!1);const U=f!==Rn&&this.type===Rn,X=f===Rn&&this.type!==Rn;for(let K=0,V=A.length;K<V;K++){const J=A[K],G=J.shadow;if(G===void 0){console.warn("THREE.WebGLShadowMap:",J,"has no shadow.");continue}if(G.autoUpdate===!1&&G.needsUpdate===!1)continue;r.copy(G.mapSize);const it=G.getFrameExtents();if(r.multiply(it),s.copy(G.mapSize),(r.x>u||r.y>u)&&(r.x>u&&(s.x=Math.floor(u/it.x),r.x=s.x*it.x,G.mapSize.x=s.x),r.y>u&&(s.y=Math.floor(u/it.y),r.y=s.y*it.y,G.mapSize.y=s.y)),G.map===null||U===!0||X===!0){const Et=this.type!==Rn?{minFilter:Xe,magFilter:Xe}:{};G.map!==null&&G.map.dispose(),G.map=new wi(r.x,r.y,Et),G.map.texture.name=J.name+".shadowMap",G.camera.updateProjectionMatrix()}n.setRenderTarget(G.map),n.clear();const ut=G.getViewportCount();for(let Et=0;Et<ut;Et++){const Ft=G.getViewport(Et);o.set(s.x*Ft.x,s.y*Ft.y,s.x*Ft.z,s.y*Ft.w),W.viewport(o),G.updateMatrices(J,Et),i=G.getFrustum(),E(w,P,G.camera,J,this.type)}G.isPointLightShadow!==!0&&this.type===Rn&&T(G,P),G.needsUpdate=!1}f=this.type,p.needsUpdate=!1,n.setRenderTarget(M,S,C)};function T(A,w){const P=t.update(_);h.defines.VSM_SAMPLES!==A.blurSamples&&(h.defines.VSM_SAMPLES=A.blurSamples,m.defines.VSM_SAMPLES=A.blurSamples,h.needsUpdate=!0,m.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new wi(r.x,r.y)),h.uniforms.shadow_pass.value=A.map.texture,h.uniforms.resolution.value=A.mapSize,h.uniforms.radius.value=A.radius,n.setRenderTarget(A.mapPass),n.clear(),n.renderBufferDirect(w,null,P,h,_,null),m.uniforms.shadow_pass.value=A.mapPass.texture,m.uniforms.resolution.value=A.mapSize,m.uniforms.radius.value=A.radius,n.setRenderTarget(A.map),n.clear(),n.renderBufferDirect(w,null,P,m,_,null)}function y(A,w,P,M){let S=null;const C=P.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(C!==void 0)S=C;else if(S=P.isPointLight===!0?l:a,n.localClippingEnabled&&w.clipShadows===!0&&Array.isArray(w.clippingPlanes)&&w.clippingPlanes.length!==0||w.displacementMap&&w.displacementScale!==0||w.alphaMap&&w.alphaTest>0||w.map&&w.alphaTest>0){const W=S.uuid,U=w.uuid;let X=c[W];X===void 0&&(X={},c[W]=X);let K=X[U];K===void 0&&(K=S.clone(),X[U]=K,w.addEventListener("dispose",N)),S=K}if(S.visible=w.visible,S.wireframe=w.wireframe,M===Rn?S.side=w.shadowSide!==null?w.shadowSide:w.side:S.side=w.shadowSide!==null?w.shadowSide:d[w.side],S.alphaMap=w.alphaMap,S.alphaTest=w.alphaTest,S.map=w.map,S.clipShadows=w.clipShadows,S.clippingPlanes=w.clippingPlanes,S.clipIntersection=w.clipIntersection,S.displacementMap=w.displacementMap,S.displacementScale=w.displacementScale,S.displacementBias=w.displacementBias,S.wireframeLinewidth=w.wireframeLinewidth,S.linewidth=w.linewidth,P.isPointLight===!0&&S.isMeshDistanceMaterial===!0){const W=n.properties.get(S);W.light=P}return S}function E(A,w,P,M,S){if(A.visible===!1)return;if(A.layers.test(w.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&S===Rn)&&(!A.frustumCulled||i.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(P.matrixWorldInverse,A.matrixWorld);const U=t.update(A),X=A.material;if(Array.isArray(X)){const K=U.groups;for(let V=0,J=K.length;V<J;V++){const G=K[V],it=X[G.materialIndex];if(it&&it.visible){const ut=y(A,it,M,S);A.onBeforeShadow(n,A,w,P,U,ut,G),n.renderBufferDirect(P,null,U,ut,A,G),A.onAfterShadow(n,A,w,P,U,ut,G)}}}else if(X.visible){const K=y(A,X,M,S);A.onBeforeShadow(n,A,w,P,U,K,null),n.renderBufferDirect(P,null,U,K,A,null),A.onAfterShadow(n,A,w,P,U,K,null)}}const W=A.children;for(let U=0,X=W.length;U<X;U++)E(W[U],w,P,M,S)}function N(A){A.target.removeEventListener("dispose",N);for(const P in c){const M=c[P],S=A.target.uuid;S in M&&(M[S].dispose(),delete M[S])}}}const Kx={[fl]:dl,[hl]:_l,[pl]:gl,[gr]:ml,[dl]:fl,[_l]:hl,[gl]:pl,[ml]:gr};function jx(n,t){function e(){let L=!1;const rt=new de;let z=null;const Z=new de(0,0,0,0);return{setMask:function(lt){z!==lt&&!L&&(n.colorMask(lt,lt,lt,lt),z=lt)},setLocked:function(lt){L=lt},setClear:function(lt,at,Rt,re,ve){ve===!0&&(lt*=re,at*=re,Rt*=re),rt.set(lt,at,Rt,re),Z.equals(rt)===!1&&(n.clearColor(lt,at,Rt,re),Z.copy(rt))},reset:function(){L=!1,z=null,Z.set(-1,0,0,0)}}}function i(){let L=!1,rt=!1,z=null,Z=null,lt=null;return{setReversed:function(at){if(rt!==at){const Rt=t.get("EXT_clip_control");rt?Rt.clipControlEXT(Rt.LOWER_LEFT_EXT,Rt.ZERO_TO_ONE_EXT):Rt.clipControlEXT(Rt.LOWER_LEFT_EXT,Rt.NEGATIVE_ONE_TO_ONE_EXT);const re=lt;lt=null,this.setClear(re)}rt=at},getReversed:function(){return rt},setTest:function(at){at?nt(n.DEPTH_TEST):yt(n.DEPTH_TEST)},setMask:function(at){z!==at&&!L&&(n.depthMask(at),z=at)},setFunc:function(at){if(rt&&(at=Kx[at]),Z!==at){switch(at){case fl:n.depthFunc(n.NEVER);break;case dl:n.depthFunc(n.ALWAYS);break;case hl:n.depthFunc(n.LESS);break;case gr:n.depthFunc(n.LEQUAL);break;case pl:n.depthFunc(n.EQUAL);break;case ml:n.depthFunc(n.GEQUAL);break;case _l:n.depthFunc(n.GREATER);break;case gl:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}Z=at}},setLocked:function(at){L=at},setClear:function(at){lt!==at&&(rt&&(at=1-at),n.clearDepth(at),lt=at)},reset:function(){L=!1,z=null,Z=null,lt=null,rt=!1}}}function r(){let L=!1,rt=null,z=null,Z=null,lt=null,at=null,Rt=null,re=null,ve=null;return{setTest:function(Xt){L||(Xt?nt(n.STENCIL_TEST):yt(n.STENCIL_TEST))},setMask:function(Xt){rt!==Xt&&!L&&(n.stencilMask(Xt),rt=Xt)},setFunc:function(Xt,Be,Ye){(z!==Xt||Z!==Be||lt!==Ye)&&(n.stencilFunc(Xt,Be,Ye),z=Xt,Z=Be,lt=Ye)},setOp:function(Xt,Be,Ye){(at!==Xt||Rt!==Be||re!==Ye)&&(n.stencilOp(Xt,Be,Ye),at=Xt,Rt=Be,re=Ye)},setLocked:function(Xt){L=Xt},setClear:function(Xt){ve!==Xt&&(n.clearStencil(Xt),ve=Xt)},reset:function(){L=!1,rt=null,z=null,Z=null,lt=null,at=null,Rt=null,re=null,ve=null}}}const s=new e,o=new i,a=new r,l=new WeakMap,c=new WeakMap;let u={},d={},h=new WeakMap,m=[],g=null,_=!1,p=null,f=null,T=null,y=null,E=null,N=null,A=null,w=new Vt(0,0,0),P=0,M=!1,S=null,C=null,W=null,U=null,X=null;const K=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let V=!1,J=0;const G=n.getParameter(n.VERSION);G.indexOf("WebGL")!==-1?(J=parseFloat(/^WebGL (\d)/.exec(G)[1]),V=J>=1):G.indexOf("OpenGL ES")!==-1&&(J=parseFloat(/^OpenGL ES (\d)/.exec(G)[1]),V=J>=2);let it=null,ut={};const Et=n.getParameter(n.SCISSOR_BOX),Ft=n.getParameter(n.VIEWPORT),$t=new de().fromArray(Et),k=new de().fromArray(Ft);function et(L,rt,z,Z){const lt=new Uint8Array(4),at=n.createTexture();n.bindTexture(L,at),n.texParameteri(L,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(L,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Rt=0;Rt<z;Rt++)L===n.TEXTURE_3D||L===n.TEXTURE_2D_ARRAY?n.texImage3D(rt,0,n.RGBA,1,1,Z,0,n.RGBA,n.UNSIGNED_BYTE,lt):n.texImage2D(rt+Rt,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,lt);return at}const pt={};pt[n.TEXTURE_2D]=et(n.TEXTURE_2D,n.TEXTURE_2D,1),pt[n.TEXTURE_CUBE_MAP]=et(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),pt[n.TEXTURE_2D_ARRAY]=et(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),pt[n.TEXTURE_3D]=et(n.TEXTURE_3D,n.TEXTURE_3D,1,1),s.setClear(0,0,0,1),o.setClear(1),a.setClear(0),nt(n.DEPTH_TEST),o.setFunc(gr),Bt(!1),Ht(cu),nt(n.CULL_FACE),I(ei);function nt(L){u[L]!==!0&&(n.enable(L),u[L]=!0)}function yt(L){u[L]!==!1&&(n.disable(L),u[L]=!1)}function Tt(L,rt){return d[L]!==rt?(n.bindFramebuffer(L,rt),d[L]=rt,L===n.DRAW_FRAMEBUFFER&&(d[n.FRAMEBUFFER]=rt),L===n.FRAMEBUFFER&&(d[n.DRAW_FRAMEBUFFER]=rt),!0):!1}function Pt(L,rt){let z=m,Z=!1;if(L){z=h.get(rt),z===void 0&&(z=[],h.set(rt,z));const lt=L.textures;if(z.length!==lt.length||z[0]!==n.COLOR_ATTACHMENT0){for(let at=0,Rt=lt.length;at<Rt;at++)z[at]=n.COLOR_ATTACHMENT0+at;z.length=lt.length,Z=!0}}else z[0]!==n.BACK&&(z[0]=n.BACK,Z=!0);Z&&n.drawBuffers(z)}function Jt(L){return g!==L?(n.useProgram(L),g=L,!0):!1}const zt={[vi]:n.FUNC_ADD,[$p]:n.FUNC_SUBTRACT,[Kp]:n.FUNC_REVERSE_SUBTRACT};zt[jp]=n.MIN,zt[Jp]=n.MAX;const ee={[Qp]:n.ZERO,[tm]:n.ONE,[em]:n.SRC_COLOR,[cl]:n.SRC_ALPHA,[am]:n.SRC_ALPHA_SATURATE,[sm]:n.DST_COLOR,[im]:n.DST_ALPHA,[nm]:n.ONE_MINUS_SRC_COLOR,[ul]:n.ONE_MINUS_SRC_ALPHA,[om]:n.ONE_MINUS_DST_COLOR,[rm]:n.ONE_MINUS_DST_ALPHA,[lm]:n.CONSTANT_COLOR,[cm]:n.ONE_MINUS_CONSTANT_COLOR,[um]:n.CONSTANT_ALPHA,[fm]:n.ONE_MINUS_CONSTANT_ALPHA};function I(L,rt,z,Z,lt,at,Rt,re,ve,Xt){if(L===ei){_===!0&&(yt(n.BLEND),_=!1);return}if(_===!1&&(nt(n.BLEND),_=!0),L!==Zp){if(L!==p||Xt!==M){if((f!==vi||E!==vi)&&(n.blendEquation(n.FUNC_ADD),f=vi,E=vi),Xt)switch(L){case dr:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Uo:n.blendFunc(n.ONE,n.ONE);break;case uu:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case fu:n.blendFuncSeparate(n.ZERO,n.SRC_COLOR,n.ZERO,n.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",L);break}else switch(L){case dr:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Uo:n.blendFunc(n.SRC_ALPHA,n.ONE);break;case uu:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case fu:n.blendFunc(n.ZERO,n.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",L);break}T=null,y=null,N=null,A=null,w.set(0,0,0),P=0,p=L,M=Xt}return}lt=lt||rt,at=at||z,Rt=Rt||Z,(rt!==f||lt!==E)&&(n.blendEquationSeparate(zt[rt],zt[lt]),f=rt,E=lt),(z!==T||Z!==y||at!==N||Rt!==A)&&(n.blendFuncSeparate(ee[z],ee[Z],ee[at],ee[Rt]),T=z,y=Z,N=at,A=Rt),(re.equals(w)===!1||ve!==P)&&(n.blendColor(re.r,re.g,re.b,ve),w.copy(re),P=ve),p=L,M=!1}function Me(L,rt){L.side===an?yt(n.CULL_FACE):nt(n.CULL_FACE);let z=L.side===Fe;rt&&(z=!z),Bt(z),L.blending===dr&&L.transparent===!1?I(ei):I(L.blending,L.blendEquation,L.blendSrc,L.blendDst,L.blendEquationAlpha,L.blendSrcAlpha,L.blendDstAlpha,L.blendColor,L.blendAlpha,L.premultipliedAlpha),o.setFunc(L.depthFunc),o.setTest(L.depthTest),o.setMask(L.depthWrite),s.setMask(L.colorWrite);const Z=L.stencilWrite;a.setTest(Z),Z&&(a.setMask(L.stencilWriteMask),a.setFunc(L.stencilFunc,L.stencilRef,L.stencilFuncMask),a.setOp(L.stencilFail,L.stencilZFail,L.stencilZPass)),qt(L.polygonOffset,L.polygonOffsetFactor,L.polygonOffsetUnits),L.alphaToCoverage===!0?nt(n.SAMPLE_ALPHA_TO_COVERAGE):yt(n.SAMPLE_ALPHA_TO_COVERAGE)}function Bt(L){S!==L&&(L?n.frontFace(n.CW):n.frontFace(n.CCW),S=L)}function Ht(L){L!==Xp?(nt(n.CULL_FACE),L!==C&&(L===cu?n.cullFace(n.BACK):L===Yp?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):yt(n.CULL_FACE),C=L}function Mt(L){L!==W&&(V&&n.lineWidth(L),W=L)}function qt(L,rt,z){L?(nt(n.POLYGON_OFFSET_FILL),(U!==rt||X!==z)&&(n.polygonOffset(rt,z),U=rt,X=z)):yt(n.POLYGON_OFFSET_FILL)}function St(L){L?nt(n.SCISSOR_TEST):yt(n.SCISSOR_TEST)}function b(L){L===void 0&&(L=n.TEXTURE0+K-1),it!==L&&(n.activeTexture(L),it=L)}function v(L,rt,z){z===void 0&&(it===null?z=n.TEXTURE0+K-1:z=it);let Z=ut[z];Z===void 0&&(Z={type:void 0,texture:void 0},ut[z]=Z),(Z.type!==L||Z.texture!==rt)&&(it!==z&&(n.activeTexture(z),it=z),n.bindTexture(L,rt||pt[L]),Z.type=L,Z.texture=rt)}function F(){const L=ut[it];L!==void 0&&L.type!==void 0&&(n.bindTexture(L.type,null),L.type=void 0,L.texture=void 0)}function q(){try{n.compressedTexImage2D.apply(n,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function j(){try{n.compressedTexImage3D.apply(n,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function Y(){try{n.texSubImage2D.apply(n,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function mt(){try{n.texSubImage3D.apply(n,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function ot(){try{n.compressedTexSubImage2D.apply(n,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function dt(){try{n.compressedTexSubImage3D.apply(n,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function kt(){try{n.texStorage2D.apply(n,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function Q(){try{n.texStorage3D.apply(n,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function ht(){try{n.texImage2D.apply(n,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function bt(){try{n.texImage3D.apply(n,arguments)}catch(L){console.error("THREE.WebGLState:",L)}}function wt(L){$t.equals(L)===!1&&(n.scissor(L.x,L.y,L.z,L.w),$t.copy(L))}function ft(L){k.equals(L)===!1&&(n.viewport(L.x,L.y,L.z,L.w),k.copy(L))}function Gt(L,rt){let z=c.get(rt);z===void 0&&(z=new WeakMap,c.set(rt,z));let Z=z.get(L);Z===void 0&&(Z=n.getUniformBlockIndex(rt,L.name),z.set(L,Z))}function Ct(L,rt){const Z=c.get(rt).get(L);l.get(rt)!==Z&&(n.uniformBlockBinding(rt,Z,L.__bindingPointIndex),l.set(rt,Z))}function Ut(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),o.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),u={},it=null,ut={},d={},h=new WeakMap,m=[],g=null,_=!1,p=null,f=null,T=null,y=null,E=null,N=null,A=null,w=new Vt(0,0,0),P=0,M=!1,S=null,C=null,W=null,U=null,X=null,$t.set(0,0,n.canvas.width,n.canvas.height),k.set(0,0,n.canvas.width,n.canvas.height),s.reset(),o.reset(),a.reset()}return{buffers:{color:s,depth:o,stencil:a},enable:nt,disable:yt,bindFramebuffer:Tt,drawBuffers:Pt,useProgram:Jt,setBlending:I,setMaterial:Me,setFlipSided:Bt,setCullFace:Ht,setLineWidth:Mt,setPolygonOffset:qt,setScissorTest:St,activeTexture:b,bindTexture:v,unbindTexture:F,compressedTexImage2D:q,compressedTexImage3D:j,texImage2D:ht,texImage3D:bt,updateUBOMapping:Gt,uniformBlockBinding:Ct,texStorage2D:kt,texStorage3D:Q,texSubImage2D:Y,texSubImage3D:mt,compressedTexSubImage2D:ot,compressedTexSubImage3D:dt,scissor:wt,viewport:ft,reset:Ut}}function of(n,t,e,i){const r=Jx(i);switch(e){case sh:return n*t;case ah:return n*t;case lh:return n*t*2;case Nc:return n*t/r.components*r.byteLength;case Uc:return n*t/r.components*r.byteLength;case ch:return n*t*2/r.components*r.byteLength;case Oc:return n*t*2/r.components*r.byteLength;case oh:return n*t*3/r.components*r.byteLength;case un:return n*t*4/r.components*r.byteLength;case Fc:return n*t*4/r.components*r.byteLength;case So:case Mo:return Math.floor((n+3)/4)*Math.floor((t+3)/4)*8;case yo:case To:return Math.floor((n+3)/4)*Math.floor((t+3)/4)*16;case Ml:case Tl:return Math.max(n,16)*Math.max(t,8)/4;case Sl:case yl:return Math.max(n,8)*Math.max(t,8)/2;case bl:case Al:return Math.floor((n+3)/4)*Math.floor((t+3)/4)*8;case wl:return Math.floor((n+3)/4)*Math.floor((t+3)/4)*16;case Rl:return Math.floor((n+3)/4)*Math.floor((t+3)/4)*16;case Cl:return Math.floor((n+4)/5)*Math.floor((t+3)/4)*16;case Ll:return Math.floor((n+4)/5)*Math.floor((t+4)/5)*16;case Pl:return Math.floor((n+5)/6)*Math.floor((t+4)/5)*16;case Il:return Math.floor((n+5)/6)*Math.floor((t+5)/6)*16;case Dl:return Math.floor((n+7)/8)*Math.floor((t+4)/5)*16;case Nl:return Math.floor((n+7)/8)*Math.floor((t+5)/6)*16;case Ul:return Math.floor((n+7)/8)*Math.floor((t+7)/8)*16;case Ol:return Math.floor((n+9)/10)*Math.floor((t+4)/5)*16;case Fl:return Math.floor((n+9)/10)*Math.floor((t+5)/6)*16;case Bl:return Math.floor((n+9)/10)*Math.floor((t+7)/8)*16;case Hl:return Math.floor((n+9)/10)*Math.floor((t+9)/10)*16;case zl:return Math.floor((n+11)/12)*Math.floor((t+9)/10)*16;case kl:return Math.floor((n+11)/12)*Math.floor((t+11)/12)*16;case bo:case Gl:case Vl:return Math.ceil(n/4)*Math.ceil(t/4)*16;case uh:case Wl:return Math.ceil(n/4)*Math.ceil(t/4)*8;case Xl:case Yl:return Math.ceil(n/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function Jx(n){switch(n){case Nn:case nh:return{byteLength:1,components:1};case ms:case ih:case Ms:return{byteLength:2,components:1};case Ic:case Dc:return{byteLength:2,components:4};case Ai:case Pc:case xn:return{byteLength:4,components:1};case rh:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${n}.`)}function Qx(n,t,e,i,r,s,o){const a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Wt,u=new WeakMap;let d;const h=new WeakMap;let m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(b,v){return m?new OffscreenCanvas(b,v):gs("canvas")}function _(b,v,F){let q=1;const j=St(b);if((j.width>F||j.height>F)&&(q=F/Math.max(j.width,j.height)),q<1)if(typeof HTMLImageElement<"u"&&b instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&b instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&b instanceof ImageBitmap||typeof VideoFrame<"u"&&b instanceof VideoFrame){const Y=Math.floor(q*j.width),mt=Math.floor(q*j.height);d===void 0&&(d=g(Y,mt));const ot=v?g(Y,mt):d;return ot.width=Y,ot.height=mt,ot.getContext("2d").drawImage(b,0,0,Y,mt),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+j.width+"x"+j.height+") to ("+Y+"x"+mt+")."),ot}else return"data"in b&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+j.width+"x"+j.height+")."),b;return b}function p(b){return b.generateMipmaps}function f(b){n.generateMipmap(b)}function T(b){return b.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:b.isWebGL3DRenderTarget?n.TEXTURE_3D:b.isWebGLArrayRenderTarget||b.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function y(b,v,F,q,j=!1){if(b!==null){if(n[b]!==void 0)return n[b];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+b+"'")}let Y=v;if(v===n.RED&&(F===n.FLOAT&&(Y=n.R32F),F===n.HALF_FLOAT&&(Y=n.R16F),F===n.UNSIGNED_BYTE&&(Y=n.R8)),v===n.RED_INTEGER&&(F===n.UNSIGNED_BYTE&&(Y=n.R8UI),F===n.UNSIGNED_SHORT&&(Y=n.R16UI),F===n.UNSIGNED_INT&&(Y=n.R32UI),F===n.BYTE&&(Y=n.R8I),F===n.SHORT&&(Y=n.R16I),F===n.INT&&(Y=n.R32I)),v===n.RG&&(F===n.FLOAT&&(Y=n.RG32F),F===n.HALF_FLOAT&&(Y=n.RG16F),F===n.UNSIGNED_BYTE&&(Y=n.RG8)),v===n.RG_INTEGER&&(F===n.UNSIGNED_BYTE&&(Y=n.RG8UI),F===n.UNSIGNED_SHORT&&(Y=n.RG16UI),F===n.UNSIGNED_INT&&(Y=n.RG32UI),F===n.BYTE&&(Y=n.RG8I),F===n.SHORT&&(Y=n.RG16I),F===n.INT&&(Y=n.RG32I)),v===n.RGB_INTEGER&&(F===n.UNSIGNED_BYTE&&(Y=n.RGB8UI),F===n.UNSIGNED_SHORT&&(Y=n.RGB16UI),F===n.UNSIGNED_INT&&(Y=n.RGB32UI),F===n.BYTE&&(Y=n.RGB8I),F===n.SHORT&&(Y=n.RGB16I),F===n.INT&&(Y=n.RGB32I)),v===n.RGBA_INTEGER&&(F===n.UNSIGNED_BYTE&&(Y=n.RGBA8UI),F===n.UNSIGNED_SHORT&&(Y=n.RGBA16UI),F===n.UNSIGNED_INT&&(Y=n.RGBA32UI),F===n.BYTE&&(Y=n.RGBA8I),F===n.SHORT&&(Y=n.RGBA16I),F===n.INT&&(Y=n.RGBA32I)),v===n.RGB&&F===n.UNSIGNED_INT_5_9_9_9_REV&&(Y=n.RGB9_E5),v===n.RGBA){const mt=j?Yo:Yt.getTransfer(q);F===n.FLOAT&&(Y=n.RGBA32F),F===n.HALF_FLOAT&&(Y=n.RGBA16F),F===n.UNSIGNED_BYTE&&(Y=mt===ne?n.SRGB8_ALPHA8:n.RGBA8),F===n.UNSIGNED_SHORT_4_4_4_4&&(Y=n.RGBA4),F===n.UNSIGNED_SHORT_5_5_5_1&&(Y=n.RGB5_A1)}return(Y===n.R16F||Y===n.R32F||Y===n.RG16F||Y===n.RG32F||Y===n.RGBA16F||Y===n.RGBA32F)&&t.get("EXT_color_buffer_float"),Y}function E(b,v){let F;return b?v===null||v===Ai||v===Er?F=n.DEPTH24_STENCIL8:v===xn?F=n.DEPTH32F_STENCIL8:v===ms&&(F=n.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):v===null||v===Ai||v===Er?F=n.DEPTH_COMPONENT24:v===xn?F=n.DEPTH_COMPONENT32F:v===ms&&(F=n.DEPTH_COMPONENT16),F}function N(b,v){return p(b)===!0||b.isFramebufferTexture&&b.minFilter!==Xe&&b.minFilter!==vn?Math.log2(Math.max(v.width,v.height))+1:b.mipmaps!==void 0&&b.mipmaps.length>0?b.mipmaps.length:b.isCompressedTexture&&Array.isArray(b.image)?v.mipmaps.length:1}function A(b){const v=b.target;v.removeEventListener("dispose",A),P(v),v.isVideoTexture&&u.delete(v)}function w(b){const v=b.target;v.removeEventListener("dispose",w),S(v)}function P(b){const v=i.get(b);if(v.__webglInit===void 0)return;const F=b.source,q=h.get(F);if(q){const j=q[v.__cacheKey];j.usedTimes--,j.usedTimes===0&&M(b),Object.keys(q).length===0&&h.delete(F)}i.remove(b)}function M(b){const v=i.get(b);n.deleteTexture(v.__webglTexture);const F=b.source,q=h.get(F);delete q[v.__cacheKey],o.memory.textures--}function S(b){const v=i.get(b);if(b.depthTexture&&(b.depthTexture.dispose(),i.remove(b.depthTexture)),b.isWebGLCubeRenderTarget)for(let q=0;q<6;q++){if(Array.isArray(v.__webglFramebuffer[q]))for(let j=0;j<v.__webglFramebuffer[q].length;j++)n.deleteFramebuffer(v.__webglFramebuffer[q][j]);else n.deleteFramebuffer(v.__webglFramebuffer[q]);v.__webglDepthbuffer&&n.deleteRenderbuffer(v.__webglDepthbuffer[q])}else{if(Array.isArray(v.__webglFramebuffer))for(let q=0;q<v.__webglFramebuffer.length;q++)n.deleteFramebuffer(v.__webglFramebuffer[q]);else n.deleteFramebuffer(v.__webglFramebuffer);if(v.__webglDepthbuffer&&n.deleteRenderbuffer(v.__webglDepthbuffer),v.__webglMultisampledFramebuffer&&n.deleteFramebuffer(v.__webglMultisampledFramebuffer),v.__webglColorRenderbuffer)for(let q=0;q<v.__webglColorRenderbuffer.length;q++)v.__webglColorRenderbuffer[q]&&n.deleteRenderbuffer(v.__webglColorRenderbuffer[q]);v.__webglDepthRenderbuffer&&n.deleteRenderbuffer(v.__webglDepthRenderbuffer)}const F=b.textures;for(let q=0,j=F.length;q<j;q++){const Y=i.get(F[q]);Y.__webglTexture&&(n.deleteTexture(Y.__webglTexture),o.memory.textures--),i.remove(F[q])}i.remove(b)}let C=0;function W(){C=0}function U(){const b=C;return b>=r.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+b+" texture units while this GPU supports only "+r.maxTextures),C+=1,b}function X(b){const v=[];return v.push(b.wrapS),v.push(b.wrapT),v.push(b.wrapR||0),v.push(b.magFilter),v.push(b.minFilter),v.push(b.anisotropy),v.push(b.internalFormat),v.push(b.format),v.push(b.type),v.push(b.generateMipmaps),v.push(b.premultiplyAlpha),v.push(b.flipY),v.push(b.unpackAlignment),v.push(b.colorSpace),v.join()}function K(b,v){const F=i.get(b);if(b.isVideoTexture&&Mt(b),b.isRenderTargetTexture===!1&&b.version>0&&F.__version!==b.version){const q=b.image;if(q===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(q.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{k(F,b,v);return}}e.bindTexture(n.TEXTURE_2D,F.__webglTexture,n.TEXTURE0+v)}function V(b,v){const F=i.get(b);if(b.version>0&&F.__version!==b.version){k(F,b,v);return}e.bindTexture(n.TEXTURE_2D_ARRAY,F.__webglTexture,n.TEXTURE0+v)}function J(b,v){const F=i.get(b);if(b.version>0&&F.__version!==b.version){k(F,b,v);return}e.bindTexture(n.TEXTURE_3D,F.__webglTexture,n.TEXTURE0+v)}function G(b,v){const F=i.get(b);if(b.version>0&&F.__version!==b.version){et(F,b,v);return}e.bindTexture(n.TEXTURE_CUBE_MAP,F.__webglTexture,n.TEXTURE0+v)}const it={[bi]:n.REPEAT,[cn]:n.CLAMP_TO_EDGE,[El]:n.MIRRORED_REPEAT},ut={[Xe]:n.NEAREST,[Sm]:n.NEAREST_MIPMAP_NEAREST,[Rs]:n.NEAREST_MIPMAP_LINEAR,[vn]:n.LINEAR,[Qo]:n.LINEAR_MIPMAP_NEAREST,[Si]:n.LINEAR_MIPMAP_LINEAR},Et={[Am]:n.NEVER,[Im]:n.ALWAYS,[wm]:n.LESS,[fh]:n.LEQUAL,[Rm]:n.EQUAL,[Pm]:n.GEQUAL,[Cm]:n.GREATER,[Lm]:n.NOTEQUAL};function Ft(b,v){if(v.type===xn&&t.has("OES_texture_float_linear")===!1&&(v.magFilter===vn||v.magFilter===Qo||v.magFilter===Rs||v.magFilter===Si||v.minFilter===vn||v.minFilter===Qo||v.minFilter===Rs||v.minFilter===Si)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(b,n.TEXTURE_WRAP_S,it[v.wrapS]),n.texParameteri(b,n.TEXTURE_WRAP_T,it[v.wrapT]),(b===n.TEXTURE_3D||b===n.TEXTURE_2D_ARRAY)&&n.texParameteri(b,n.TEXTURE_WRAP_R,it[v.wrapR]),n.texParameteri(b,n.TEXTURE_MAG_FILTER,ut[v.magFilter]),n.texParameteri(b,n.TEXTURE_MIN_FILTER,ut[v.minFilter]),v.compareFunction&&(n.texParameteri(b,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(b,n.TEXTURE_COMPARE_FUNC,Et[v.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(v.magFilter===Xe||v.minFilter!==Rs&&v.minFilter!==Si||v.type===xn&&t.has("OES_texture_float_linear")===!1)return;if(v.anisotropy>1||i.get(v).__currentAnisotropy){const F=t.get("EXT_texture_filter_anisotropic");n.texParameterf(b,F.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(v.anisotropy,r.getMaxAnisotropy())),i.get(v).__currentAnisotropy=v.anisotropy}}}function $t(b,v){let F=!1;b.__webglInit===void 0&&(b.__webglInit=!0,v.addEventListener("dispose",A));const q=v.source;let j=h.get(q);j===void 0&&(j={},h.set(q,j));const Y=X(v);if(Y!==b.__cacheKey){j[Y]===void 0&&(j[Y]={texture:n.createTexture(),usedTimes:0},o.memory.textures++,F=!0),j[Y].usedTimes++;const mt=j[b.__cacheKey];mt!==void 0&&(j[b.__cacheKey].usedTimes--,mt.usedTimes===0&&M(v)),b.__cacheKey=Y,b.__webglTexture=j[Y].texture}return F}function k(b,v,F){let q=n.TEXTURE_2D;(v.isDataArrayTexture||v.isCompressedArrayTexture)&&(q=n.TEXTURE_2D_ARRAY),v.isData3DTexture&&(q=n.TEXTURE_3D);const j=$t(b,v),Y=v.source;e.bindTexture(q,b.__webglTexture,n.TEXTURE0+F);const mt=i.get(Y);if(Y.version!==mt.__version||j===!0){e.activeTexture(n.TEXTURE0+F);const ot=Yt.getPrimaries(Yt.workingColorSpace),dt=v.colorSpace===jn?null:Yt.getPrimaries(v.colorSpace),kt=v.colorSpace===jn||ot===dt?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,v.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,v.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,kt);let Q=_(v.image,!1,r.maxTextureSize);Q=qt(v,Q);const ht=s.convert(v.format,v.colorSpace),bt=s.convert(v.type);let wt=y(v.internalFormat,ht,bt,v.colorSpace,v.isVideoTexture);Ft(q,v);let ft;const Gt=v.mipmaps,Ct=v.isVideoTexture!==!0,Ut=mt.__version===void 0||j===!0,L=Y.dataReady,rt=N(v,Q);if(v.isDepthTexture)wt=E(v.format===Sr,v.type),Ut&&(Ct?e.texStorage2D(n.TEXTURE_2D,1,wt,Q.width,Q.height):e.texImage2D(n.TEXTURE_2D,0,wt,Q.width,Q.height,0,ht,bt,null));else if(v.isDataTexture)if(Gt.length>0){Ct&&Ut&&e.texStorage2D(n.TEXTURE_2D,rt,wt,Gt[0].width,Gt[0].height);for(let z=0,Z=Gt.length;z<Z;z++)ft=Gt[z],Ct?L&&e.texSubImage2D(n.TEXTURE_2D,z,0,0,ft.width,ft.height,ht,bt,ft.data):e.texImage2D(n.TEXTURE_2D,z,wt,ft.width,ft.height,0,ht,bt,ft.data);v.generateMipmaps=!1}else Ct?(Ut&&e.texStorage2D(n.TEXTURE_2D,rt,wt,Q.width,Q.height),L&&e.texSubImage2D(n.TEXTURE_2D,0,0,0,Q.width,Q.height,ht,bt,Q.data)):e.texImage2D(n.TEXTURE_2D,0,wt,Q.width,Q.height,0,ht,bt,Q.data);else if(v.isCompressedTexture)if(v.isCompressedArrayTexture){Ct&&Ut&&e.texStorage3D(n.TEXTURE_2D_ARRAY,rt,wt,Gt[0].width,Gt[0].height,Q.depth);for(let z=0,Z=Gt.length;z<Z;z++)if(ft=Gt[z],v.format!==un)if(ht!==null)if(Ct){if(L)if(v.layerUpdates.size>0){const lt=of(ft.width,ft.height,v.format,v.type);for(const at of v.layerUpdates){const Rt=ft.data.subarray(at*lt/ft.data.BYTES_PER_ELEMENT,(at+1)*lt/ft.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,z,0,0,at,ft.width,ft.height,1,ht,Rt)}v.clearLayerUpdates()}else e.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,z,0,0,0,ft.width,ft.height,Q.depth,ht,ft.data)}else e.compressedTexImage3D(n.TEXTURE_2D_ARRAY,z,wt,ft.width,ft.height,Q.depth,0,ft.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ct?L&&e.texSubImage3D(n.TEXTURE_2D_ARRAY,z,0,0,0,ft.width,ft.height,Q.depth,ht,bt,ft.data):e.texImage3D(n.TEXTURE_2D_ARRAY,z,wt,ft.width,ft.height,Q.depth,0,ht,bt,ft.data)}else{Ct&&Ut&&e.texStorage2D(n.TEXTURE_2D,rt,wt,Gt[0].width,Gt[0].height);for(let z=0,Z=Gt.length;z<Z;z++)ft=Gt[z],v.format!==un?ht!==null?Ct?L&&e.compressedTexSubImage2D(n.TEXTURE_2D,z,0,0,ft.width,ft.height,ht,ft.data):e.compressedTexImage2D(n.TEXTURE_2D,z,wt,ft.width,ft.height,0,ft.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ct?L&&e.texSubImage2D(n.TEXTURE_2D,z,0,0,ft.width,ft.height,ht,bt,ft.data):e.texImage2D(n.TEXTURE_2D,z,wt,ft.width,ft.height,0,ht,bt,ft.data)}else if(v.isDataArrayTexture)if(Ct){if(Ut&&e.texStorage3D(n.TEXTURE_2D_ARRAY,rt,wt,Q.width,Q.height,Q.depth),L)if(v.layerUpdates.size>0){const z=of(Q.width,Q.height,v.format,v.type);for(const Z of v.layerUpdates){const lt=Q.data.subarray(Z*z/Q.data.BYTES_PER_ELEMENT,(Z+1)*z/Q.data.BYTES_PER_ELEMENT);e.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,Z,Q.width,Q.height,1,ht,bt,lt)}v.clearLayerUpdates()}else e.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,Q.width,Q.height,Q.depth,ht,bt,Q.data)}else e.texImage3D(n.TEXTURE_2D_ARRAY,0,wt,Q.width,Q.height,Q.depth,0,ht,bt,Q.data);else if(v.isData3DTexture)Ct?(Ut&&e.texStorage3D(n.TEXTURE_3D,rt,wt,Q.width,Q.height,Q.depth),L&&e.texSubImage3D(n.TEXTURE_3D,0,0,0,0,Q.width,Q.height,Q.depth,ht,bt,Q.data)):e.texImage3D(n.TEXTURE_3D,0,wt,Q.width,Q.height,Q.depth,0,ht,bt,Q.data);else if(v.isFramebufferTexture){if(Ut)if(Ct)e.texStorage2D(n.TEXTURE_2D,rt,wt,Q.width,Q.height);else{let z=Q.width,Z=Q.height;for(let lt=0;lt<rt;lt++)e.texImage2D(n.TEXTURE_2D,lt,wt,z,Z,0,ht,bt,null),z>>=1,Z>>=1}}else if(Gt.length>0){if(Ct&&Ut){const z=St(Gt[0]);e.texStorage2D(n.TEXTURE_2D,rt,wt,z.width,z.height)}for(let z=0,Z=Gt.length;z<Z;z++)ft=Gt[z],Ct?L&&e.texSubImage2D(n.TEXTURE_2D,z,0,0,ht,bt,ft):e.texImage2D(n.TEXTURE_2D,z,wt,ht,bt,ft);v.generateMipmaps=!1}else if(Ct){if(Ut){const z=St(Q);e.texStorage2D(n.TEXTURE_2D,rt,wt,z.width,z.height)}L&&e.texSubImage2D(n.TEXTURE_2D,0,0,0,ht,bt,Q)}else e.texImage2D(n.TEXTURE_2D,0,wt,ht,bt,Q);p(v)&&f(q),mt.__version=Y.version,v.onUpdate&&v.onUpdate(v)}b.__version=v.version}function et(b,v,F){if(v.image.length!==6)return;const q=$t(b,v),j=v.source;e.bindTexture(n.TEXTURE_CUBE_MAP,b.__webglTexture,n.TEXTURE0+F);const Y=i.get(j);if(j.version!==Y.__version||q===!0){e.activeTexture(n.TEXTURE0+F);const mt=Yt.getPrimaries(Yt.workingColorSpace),ot=v.colorSpace===jn?null:Yt.getPrimaries(v.colorSpace),dt=v.colorSpace===jn||mt===ot?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,v.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,v.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,dt);const kt=v.isCompressedTexture||v.image[0].isCompressedTexture,Q=v.image[0]&&v.image[0].isDataTexture,ht=[];for(let Z=0;Z<6;Z++)!kt&&!Q?ht[Z]=_(v.image[Z],!0,r.maxCubemapSize):ht[Z]=Q?v.image[Z].image:v.image[Z],ht[Z]=qt(v,ht[Z]);const bt=ht[0],wt=s.convert(v.format,v.colorSpace),ft=s.convert(v.type),Gt=y(v.internalFormat,wt,ft,v.colorSpace),Ct=v.isVideoTexture!==!0,Ut=Y.__version===void 0||q===!0,L=j.dataReady;let rt=N(v,bt);Ft(n.TEXTURE_CUBE_MAP,v);let z;if(kt){Ct&&Ut&&e.texStorage2D(n.TEXTURE_CUBE_MAP,rt,Gt,bt.width,bt.height);for(let Z=0;Z<6;Z++){z=ht[Z].mipmaps;for(let lt=0;lt<z.length;lt++){const at=z[lt];v.format!==un?wt!==null?Ct?L&&e.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Z,lt,0,0,at.width,at.height,wt,at.data):e.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Z,lt,Gt,at.width,at.height,0,at.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Ct?L&&e.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Z,lt,0,0,at.width,at.height,wt,ft,at.data):e.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Z,lt,Gt,at.width,at.height,0,wt,ft,at.data)}}}else{if(z=v.mipmaps,Ct&&Ut){z.length>0&&rt++;const Z=St(ht[0]);e.texStorage2D(n.TEXTURE_CUBE_MAP,rt,Gt,Z.width,Z.height)}for(let Z=0;Z<6;Z++)if(Q){Ct?L&&e.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0,0,0,ht[Z].width,ht[Z].height,wt,ft,ht[Z].data):e.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0,Gt,ht[Z].width,ht[Z].height,0,wt,ft,ht[Z].data);for(let lt=0;lt<z.length;lt++){const Rt=z[lt].image[Z].image;Ct?L&&e.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Z,lt+1,0,0,Rt.width,Rt.height,wt,ft,Rt.data):e.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Z,lt+1,Gt,Rt.width,Rt.height,0,wt,ft,Rt.data)}}else{Ct?L&&e.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0,0,0,wt,ft,ht[Z]):e.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Z,0,Gt,wt,ft,ht[Z]);for(let lt=0;lt<z.length;lt++){const at=z[lt];Ct?L&&e.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Z,lt+1,0,0,wt,ft,at.image[Z]):e.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+Z,lt+1,Gt,wt,ft,at.image[Z])}}}p(v)&&f(n.TEXTURE_CUBE_MAP),Y.__version=j.version,v.onUpdate&&v.onUpdate(v)}b.__version=v.version}function pt(b,v,F,q,j,Y){const mt=s.convert(F.format,F.colorSpace),ot=s.convert(F.type),dt=y(F.internalFormat,mt,ot,F.colorSpace),kt=i.get(v),Q=i.get(F);if(Q.__renderTarget=v,!kt.__hasExternalTextures){const ht=Math.max(1,v.width>>Y),bt=Math.max(1,v.height>>Y);j===n.TEXTURE_3D||j===n.TEXTURE_2D_ARRAY?e.texImage3D(j,Y,dt,ht,bt,v.depth,0,mt,ot,null):e.texImage2D(j,Y,dt,ht,bt,0,mt,ot,null)}e.bindFramebuffer(n.FRAMEBUFFER,b),Ht(v)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,q,j,Q.__webglTexture,0,Bt(v)):(j===n.TEXTURE_2D||j>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&j<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,q,j,Q.__webglTexture,Y),e.bindFramebuffer(n.FRAMEBUFFER,null)}function nt(b,v,F){if(n.bindRenderbuffer(n.RENDERBUFFER,b),v.depthBuffer){const q=v.depthTexture,j=q&&q.isDepthTexture?q.type:null,Y=E(v.stencilBuffer,j),mt=v.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ot=Bt(v);Ht(v)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,ot,Y,v.width,v.height):F?n.renderbufferStorageMultisample(n.RENDERBUFFER,ot,Y,v.width,v.height):n.renderbufferStorage(n.RENDERBUFFER,Y,v.width,v.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,mt,n.RENDERBUFFER,b)}else{const q=v.textures;for(let j=0;j<q.length;j++){const Y=q[j],mt=s.convert(Y.format,Y.colorSpace),ot=s.convert(Y.type),dt=y(Y.internalFormat,mt,ot,Y.colorSpace),kt=Bt(v);F&&Ht(v)===!1?n.renderbufferStorageMultisample(n.RENDERBUFFER,kt,dt,v.width,v.height):Ht(v)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,kt,dt,v.width,v.height):n.renderbufferStorage(n.RENDERBUFFER,dt,v.width,v.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function yt(b,v){if(v&&v.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(n.FRAMEBUFFER,b),!(v.depthTexture&&v.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const q=i.get(v.depthTexture);q.__renderTarget=v,(!q.__webglTexture||v.depthTexture.image.width!==v.width||v.depthTexture.image.height!==v.height)&&(v.depthTexture.image.width=v.width,v.depthTexture.image.height=v.height,v.depthTexture.needsUpdate=!0),K(v.depthTexture,0);const j=q.__webglTexture,Y=Bt(v);if(v.depthTexture.format===hr)Ht(v)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,j,0,Y):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,j,0);else if(v.depthTexture.format===Sr)Ht(v)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,j,0,Y):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,j,0);else throw new Error("Unknown depthTexture format")}function Tt(b){const v=i.get(b),F=b.isWebGLCubeRenderTarget===!0;if(v.__boundDepthTexture!==b.depthTexture){const q=b.depthTexture;if(v.__depthDisposeCallback&&v.__depthDisposeCallback(),q){const j=()=>{delete v.__boundDepthTexture,delete v.__depthDisposeCallback,q.removeEventListener("dispose",j)};q.addEventListener("dispose",j),v.__depthDisposeCallback=j}v.__boundDepthTexture=q}if(b.depthTexture&&!v.__autoAllocateDepthBuffer){if(F)throw new Error("target.depthTexture not supported in Cube render targets");yt(v.__webglFramebuffer,b)}else if(F){v.__webglDepthbuffer=[];for(let q=0;q<6;q++)if(e.bindFramebuffer(n.FRAMEBUFFER,v.__webglFramebuffer[q]),v.__webglDepthbuffer[q]===void 0)v.__webglDepthbuffer[q]=n.createRenderbuffer(),nt(v.__webglDepthbuffer[q],b,!1);else{const j=b.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,Y=v.__webglDepthbuffer[q];n.bindRenderbuffer(n.RENDERBUFFER,Y),n.framebufferRenderbuffer(n.FRAMEBUFFER,j,n.RENDERBUFFER,Y)}}else if(e.bindFramebuffer(n.FRAMEBUFFER,v.__webglFramebuffer),v.__webglDepthbuffer===void 0)v.__webglDepthbuffer=n.createRenderbuffer(),nt(v.__webglDepthbuffer,b,!1);else{const q=b.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,j=v.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,j),n.framebufferRenderbuffer(n.FRAMEBUFFER,q,n.RENDERBUFFER,j)}e.bindFramebuffer(n.FRAMEBUFFER,null)}function Pt(b,v,F){const q=i.get(b);v!==void 0&&pt(q.__webglFramebuffer,b,b.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),F!==void 0&&Tt(b)}function Jt(b){const v=b.texture,F=i.get(b),q=i.get(v);b.addEventListener("dispose",w);const j=b.textures,Y=b.isWebGLCubeRenderTarget===!0,mt=j.length>1;if(mt||(q.__webglTexture===void 0&&(q.__webglTexture=n.createTexture()),q.__version=v.version,o.memory.textures++),Y){F.__webglFramebuffer=[];for(let ot=0;ot<6;ot++)if(v.mipmaps&&v.mipmaps.length>0){F.__webglFramebuffer[ot]=[];for(let dt=0;dt<v.mipmaps.length;dt++)F.__webglFramebuffer[ot][dt]=n.createFramebuffer()}else F.__webglFramebuffer[ot]=n.createFramebuffer()}else{if(v.mipmaps&&v.mipmaps.length>0){F.__webglFramebuffer=[];for(let ot=0;ot<v.mipmaps.length;ot++)F.__webglFramebuffer[ot]=n.createFramebuffer()}else F.__webglFramebuffer=n.createFramebuffer();if(mt)for(let ot=0,dt=j.length;ot<dt;ot++){const kt=i.get(j[ot]);kt.__webglTexture===void 0&&(kt.__webglTexture=n.createTexture(),o.memory.textures++)}if(b.samples>0&&Ht(b)===!1){F.__webglMultisampledFramebuffer=n.createFramebuffer(),F.__webglColorRenderbuffer=[],e.bindFramebuffer(n.FRAMEBUFFER,F.__webglMultisampledFramebuffer);for(let ot=0;ot<j.length;ot++){const dt=j[ot];F.__webglColorRenderbuffer[ot]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,F.__webglColorRenderbuffer[ot]);const kt=s.convert(dt.format,dt.colorSpace),Q=s.convert(dt.type),ht=y(dt.internalFormat,kt,Q,dt.colorSpace,b.isXRRenderTarget===!0),bt=Bt(b);n.renderbufferStorageMultisample(n.RENDERBUFFER,bt,ht,b.width,b.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+ot,n.RENDERBUFFER,F.__webglColorRenderbuffer[ot])}n.bindRenderbuffer(n.RENDERBUFFER,null),b.depthBuffer&&(F.__webglDepthRenderbuffer=n.createRenderbuffer(),nt(F.__webglDepthRenderbuffer,b,!0)),e.bindFramebuffer(n.FRAMEBUFFER,null)}}if(Y){e.bindTexture(n.TEXTURE_CUBE_MAP,q.__webglTexture),Ft(n.TEXTURE_CUBE_MAP,v);for(let ot=0;ot<6;ot++)if(v.mipmaps&&v.mipmaps.length>0)for(let dt=0;dt<v.mipmaps.length;dt++)pt(F.__webglFramebuffer[ot][dt],b,v,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+ot,dt);else pt(F.__webglFramebuffer[ot],b,v,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+ot,0);p(v)&&f(n.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(mt){for(let ot=0,dt=j.length;ot<dt;ot++){const kt=j[ot],Q=i.get(kt);e.bindTexture(n.TEXTURE_2D,Q.__webglTexture),Ft(n.TEXTURE_2D,kt),pt(F.__webglFramebuffer,b,kt,n.COLOR_ATTACHMENT0+ot,n.TEXTURE_2D,0),p(kt)&&f(n.TEXTURE_2D)}e.unbindTexture()}else{let ot=n.TEXTURE_2D;if((b.isWebGL3DRenderTarget||b.isWebGLArrayRenderTarget)&&(ot=b.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),e.bindTexture(ot,q.__webglTexture),Ft(ot,v),v.mipmaps&&v.mipmaps.length>0)for(let dt=0;dt<v.mipmaps.length;dt++)pt(F.__webglFramebuffer[dt],b,v,n.COLOR_ATTACHMENT0,ot,dt);else pt(F.__webglFramebuffer,b,v,n.COLOR_ATTACHMENT0,ot,0);p(v)&&f(ot),e.unbindTexture()}b.depthBuffer&&Tt(b)}function zt(b){const v=b.textures;for(let F=0,q=v.length;F<q;F++){const j=v[F];if(p(j)){const Y=T(b),mt=i.get(j).__webglTexture;e.bindTexture(Y,mt),f(Y),e.unbindTexture()}}}const ee=[],I=[];function Me(b){if(b.samples>0){if(Ht(b)===!1){const v=b.textures,F=b.width,q=b.height;let j=n.COLOR_BUFFER_BIT;const Y=b.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,mt=i.get(b),ot=v.length>1;if(ot)for(let dt=0;dt<v.length;dt++)e.bindFramebuffer(n.FRAMEBUFFER,mt.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+dt,n.RENDERBUFFER,null),e.bindFramebuffer(n.FRAMEBUFFER,mt.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+dt,n.TEXTURE_2D,null,0);e.bindFramebuffer(n.READ_FRAMEBUFFER,mt.__webglMultisampledFramebuffer),e.bindFramebuffer(n.DRAW_FRAMEBUFFER,mt.__webglFramebuffer);for(let dt=0;dt<v.length;dt++){if(b.resolveDepthBuffer&&(b.depthBuffer&&(j|=n.DEPTH_BUFFER_BIT),b.stencilBuffer&&b.resolveStencilBuffer&&(j|=n.STENCIL_BUFFER_BIT)),ot){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,mt.__webglColorRenderbuffer[dt]);const kt=i.get(v[dt]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,kt,0)}n.blitFramebuffer(0,0,F,q,0,0,F,q,j,n.NEAREST),l===!0&&(ee.length=0,I.length=0,ee.push(n.COLOR_ATTACHMENT0+dt),b.depthBuffer&&b.resolveDepthBuffer===!1&&(ee.push(Y),I.push(Y),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,I)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,ee))}if(e.bindFramebuffer(n.READ_FRAMEBUFFER,null),e.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),ot)for(let dt=0;dt<v.length;dt++){e.bindFramebuffer(n.FRAMEBUFFER,mt.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+dt,n.RENDERBUFFER,mt.__webglColorRenderbuffer[dt]);const kt=i.get(v[dt]).__webglTexture;e.bindFramebuffer(n.FRAMEBUFFER,mt.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+dt,n.TEXTURE_2D,kt,0)}e.bindFramebuffer(n.DRAW_FRAMEBUFFER,mt.__webglMultisampledFramebuffer)}else if(b.depthBuffer&&b.resolveDepthBuffer===!1&&l){const v=b.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[v])}}}function Bt(b){return Math.min(r.maxSamples,b.samples)}function Ht(b){const v=i.get(b);return b.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&v.__useRenderToTexture!==!1}function Mt(b){const v=o.render.frame;u.get(b)!==v&&(u.set(b,v),b.update())}function qt(b,v){const F=b.colorSpace,q=b.format,j=b.type;return b.isCompressedTexture===!0||b.isVideoTexture===!0||F!==Ar&&F!==jn&&(Yt.getTransfer(F)===ne?(q!==un||j!==Nn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",F)),v}function St(b){return typeof HTMLImageElement<"u"&&b instanceof HTMLImageElement?(c.width=b.naturalWidth||b.width,c.height=b.naturalHeight||b.height):typeof VideoFrame<"u"&&b instanceof VideoFrame?(c.width=b.displayWidth,c.height=b.displayHeight):(c.width=b.width,c.height=b.height),c}this.allocateTextureUnit=U,this.resetTextureUnits=W,this.setTexture2D=K,this.setTexture2DArray=V,this.setTexture3D=J,this.setTextureCube=G,this.rebindTextures=Pt,this.setupRenderTarget=Jt,this.updateRenderTargetMipmap=zt,this.updateMultisampleRenderTarget=Me,this.setupDepthRenderbuffer=Tt,this.setupFrameBufferTexture=pt,this.useMultisampledRTT=Ht}function tE(n,t){function e(i,r=jn){let s;const o=Yt.getTransfer(r);if(i===Nn)return n.UNSIGNED_BYTE;if(i===Ic)return n.UNSIGNED_SHORT_4_4_4_4;if(i===Dc)return n.UNSIGNED_SHORT_5_5_5_1;if(i===rh)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===nh)return n.BYTE;if(i===ih)return n.SHORT;if(i===ms)return n.UNSIGNED_SHORT;if(i===Pc)return n.INT;if(i===Ai)return n.UNSIGNED_INT;if(i===xn)return n.FLOAT;if(i===Ms)return n.HALF_FLOAT;if(i===sh)return n.ALPHA;if(i===oh)return n.RGB;if(i===un)return n.RGBA;if(i===ah)return n.LUMINANCE;if(i===lh)return n.LUMINANCE_ALPHA;if(i===hr)return n.DEPTH_COMPONENT;if(i===Sr)return n.DEPTH_STENCIL;if(i===Nc)return n.RED;if(i===Uc)return n.RED_INTEGER;if(i===ch)return n.RG;if(i===Oc)return n.RG_INTEGER;if(i===Fc)return n.RGBA_INTEGER;if(i===So||i===Mo||i===yo||i===To)if(o===ne)if(s=t.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(i===So)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Mo)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===yo)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===To)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=t.get("WEBGL_compressed_texture_s3tc"),s!==null){if(i===So)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Mo)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===yo)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===To)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Sl||i===Ml||i===yl||i===Tl)if(s=t.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(i===Sl)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Ml)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===yl)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Tl)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===bl||i===Al||i===wl)if(s=t.get("WEBGL_compressed_texture_etc"),s!==null){if(i===bl||i===Al)return o===ne?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(i===wl)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(i===Rl||i===Cl||i===Ll||i===Pl||i===Il||i===Dl||i===Nl||i===Ul||i===Ol||i===Fl||i===Bl||i===Hl||i===zl||i===kl)if(s=t.get("WEBGL_compressed_texture_astc"),s!==null){if(i===Rl)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Cl)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Ll)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Pl)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Il)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Dl)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Nl)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Ul)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Ol)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===Fl)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Bl)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Hl)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===zl)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===kl)return o===ne?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===bo||i===Gl||i===Vl)if(s=t.get("EXT_texture_compression_bptc"),s!==null){if(i===bo)return o===ne?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Gl)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===Vl)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===uh||i===Wl||i===Xl||i===Yl)if(s=t.get("EXT_texture_compression_rgtc"),s!==null){if(i===bo)return s.COMPRESSED_RED_RGTC1_EXT;if(i===Wl)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===Xl)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===Yl)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Er?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:e}}class eE extends je{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class Mi extends Re{constructor(){super(),this.isGroup=!0,this.type="Group"}}const nE={type:"move"};class Aa{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Mi,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Mi,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new B,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new B),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Mi,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new B,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new B),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const i of t.hand.values())this._getHandJoint(e,i)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,i){let r=null,s=null,o=null;const a=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){o=!0;for(const _ of t.hand.values()){const p=e.getJointPose(_,i),f=this._getHandJoint(c,_);p!==null&&(f.matrix.fromArray(p.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=p.radius),f.visible=p!==null}const u=c.joints["index-finger-tip"],d=c.joints["thumb-tip"],h=u.position.distanceTo(d.position),m=.02,g=.005;c.inputState.pinching&&h>m+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&h<=m-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(s=e.getPose(t.gripSpace,i),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1));a!==null&&(r=e.getPose(t.targetRaySpace,i),r===null&&s!==null&&(r=s),r!==null&&(a.matrix.fromArray(r.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,r.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(r.linearVelocity)):a.hasLinearVelocity=!1,r.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(r.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(nE)))}return a!==null&&(a.visible=r!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const i=new Mi;i.matrixAutoUpdate=!1,i.visible=!1,t.joints[e.jointName]=i,t.add(i)}return t.joints[e.jointName]}}const iE=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,rE=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class sE{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,i){if(this.texture===null){const r=new ye,s=t.properties.get(r);s.__webglTexture=e.texture,(e.depthNear!=i.depthNear||e.depthFar!=i.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=r}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,i=new ri({vertexShader:iE,fragmentShader:rE,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new ue(new fn(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class oE extends wr{constructor(t,e){super();const i=this;let r=null,s=1,o=null,a="local-floor",l=1,c=null,u=null,d=null,h=null,m=null,g=null;const _=new sE,p=e.getContextAttributes();let f=null,T=null;const y=[],E=[],N=new Wt;let A=null;const w=new je;w.viewport=new de;const P=new je;P.viewport=new de;const M=[w,P],S=new eE;let C=null,W=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(k){let et=y[k];return et===void 0&&(et=new Aa,y[k]=et),et.getTargetRaySpace()},this.getControllerGrip=function(k){let et=y[k];return et===void 0&&(et=new Aa,y[k]=et),et.getGripSpace()},this.getHand=function(k){let et=y[k];return et===void 0&&(et=new Aa,y[k]=et),et.getHandSpace()};function U(k){const et=E.indexOf(k.inputSource);if(et===-1)return;const pt=y[et];pt!==void 0&&(pt.update(k.inputSource,k.frame,c||o),pt.dispatchEvent({type:k.type,data:k.inputSource}))}function X(){r.removeEventListener("select",U),r.removeEventListener("selectstart",U),r.removeEventListener("selectend",U),r.removeEventListener("squeeze",U),r.removeEventListener("squeezestart",U),r.removeEventListener("squeezeend",U),r.removeEventListener("end",X),r.removeEventListener("inputsourceschange",K);for(let k=0;k<y.length;k++){const et=E[k];et!==null&&(E[k]=null,y[k].disconnect(et))}C=null,W=null,_.reset(),t.setRenderTarget(f),m=null,h=null,d=null,r=null,T=null,$t.stop(),i.isPresenting=!1,t.setPixelRatio(A),t.setSize(N.width,N.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(k){s=k,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(k){a=k,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(k){c=k},this.getBaseLayer=function(){return h!==null?h:m},this.getBinding=function(){return d},this.getFrame=function(){return g},this.getSession=function(){return r},this.setSession=async function(k){if(r=k,r!==null){if(f=t.getRenderTarget(),r.addEventListener("select",U),r.addEventListener("selectstart",U),r.addEventListener("selectend",U),r.addEventListener("squeeze",U),r.addEventListener("squeezestart",U),r.addEventListener("squeezeend",U),r.addEventListener("end",X),r.addEventListener("inputsourceschange",K),p.xrCompatible!==!0&&await e.makeXRCompatible(),A=t.getPixelRatio(),t.getSize(N),r.renderState.layers===void 0){const et={antialias:p.antialias,alpha:!0,depth:p.depth,stencil:p.stencil,framebufferScaleFactor:s};m=new XRWebGLLayer(r,e,et),r.updateRenderState({baseLayer:m}),t.setPixelRatio(1),t.setSize(m.framebufferWidth,m.framebufferHeight,!1),T=new wi(m.framebufferWidth,m.framebufferHeight,{format:un,type:Nn,colorSpace:t.outputColorSpace,stencilBuffer:p.stencil})}else{let et=null,pt=null,nt=null;p.depth&&(nt=p.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,et=p.stencil?Sr:hr,pt=p.stencil?Er:Ai);const yt={colorFormat:e.RGBA8,depthFormat:nt,scaleFactor:s};d=new XRWebGLBinding(r,e),h=d.createProjectionLayer(yt),r.updateRenderState({layers:[h]}),t.setPixelRatio(1),t.setSize(h.textureWidth,h.textureHeight,!1),T=new wi(h.textureWidth,h.textureHeight,{format:un,type:Nn,depthTexture:new bh(h.textureWidth,h.textureHeight,pt,void 0,void 0,void 0,void 0,void 0,void 0,et),stencilBuffer:p.stencil,colorSpace:t.outputColorSpace,samples:p.antialias?4:0,resolveDepthBuffer:h.ignoreDepthValues===!1})}T.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await r.requestReferenceSpace(a),$t.setContext(r),$t.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return _.getDepthTexture()};function K(k){for(let et=0;et<k.removed.length;et++){const pt=k.removed[et],nt=E.indexOf(pt);nt>=0&&(E[nt]=null,y[nt].disconnect(pt))}for(let et=0;et<k.added.length;et++){const pt=k.added[et];let nt=E.indexOf(pt);if(nt===-1){for(let Tt=0;Tt<y.length;Tt++)if(Tt>=E.length){E.push(pt),nt=Tt;break}else if(E[Tt]===null){E[Tt]=pt,nt=Tt;break}if(nt===-1)break}const yt=y[nt];yt&&yt.connect(pt)}}const V=new B,J=new B;function G(k,et,pt){V.setFromMatrixPosition(et.matrixWorld),J.setFromMatrixPosition(pt.matrixWorld);const nt=V.distanceTo(J),yt=et.projectionMatrix.elements,Tt=pt.projectionMatrix.elements,Pt=yt[14]/(yt[10]-1),Jt=yt[14]/(yt[10]+1),zt=(yt[9]+1)/yt[5],ee=(yt[9]-1)/yt[5],I=(yt[8]-1)/yt[0],Me=(Tt[8]+1)/Tt[0],Bt=Pt*I,Ht=Pt*Me,Mt=nt/(-I+Me),qt=Mt*-I;if(et.matrixWorld.decompose(k.position,k.quaternion,k.scale),k.translateX(qt),k.translateZ(Mt),k.matrixWorld.compose(k.position,k.quaternion,k.scale),k.matrixWorldInverse.copy(k.matrixWorld).invert(),yt[10]===-1)k.projectionMatrix.copy(et.projectionMatrix),k.projectionMatrixInverse.copy(et.projectionMatrixInverse);else{const St=Pt+Mt,b=Jt+Mt,v=Bt-qt,F=Ht+(nt-qt),q=zt*Jt/b*St,j=ee*Jt/b*St;k.projectionMatrix.makePerspective(v,F,q,j,St,b),k.projectionMatrixInverse.copy(k.projectionMatrix).invert()}}function it(k,et){et===null?k.matrixWorld.copy(k.matrix):k.matrixWorld.multiplyMatrices(et.matrixWorld,k.matrix),k.matrixWorldInverse.copy(k.matrixWorld).invert()}this.updateCamera=function(k){if(r===null)return;let et=k.near,pt=k.far;_.texture!==null&&(_.depthNear>0&&(et=_.depthNear),_.depthFar>0&&(pt=_.depthFar)),S.near=P.near=w.near=et,S.far=P.far=w.far=pt,(C!==S.near||W!==S.far)&&(r.updateRenderState({depthNear:S.near,depthFar:S.far}),C=S.near,W=S.far),w.layers.mask=k.layers.mask|2,P.layers.mask=k.layers.mask|4,S.layers.mask=w.layers.mask|P.layers.mask;const nt=k.parent,yt=S.cameras;it(S,nt);for(let Tt=0;Tt<yt.length;Tt++)it(yt[Tt],nt);yt.length===2?G(S,w,P):S.projectionMatrix.copy(w.projectionMatrix),ut(k,S,nt)};function ut(k,et,pt){pt===null?k.matrix.copy(et.matrixWorld):(k.matrix.copy(pt.matrixWorld),k.matrix.invert(),k.matrix.multiply(et.matrixWorld)),k.matrix.decompose(k.position,k.quaternion,k.scale),k.updateMatrixWorld(!0),k.projectionMatrix.copy(et.projectionMatrix),k.projectionMatrixInverse.copy(et.projectionMatrixInverse),k.isPerspectiveCamera&&(k.fov=_s*2*Math.atan(1/k.projectionMatrix.elements[5]),k.zoom=1)}this.getCamera=function(){return S},this.getFoveation=function(){if(!(h===null&&m===null))return l},this.setFoveation=function(k){l=k,h!==null&&(h.fixedFoveation=k),m!==null&&m.fixedFoveation!==void 0&&(m.fixedFoveation=k)},this.hasDepthSensing=function(){return _.texture!==null},this.getDepthSensingMesh=function(){return _.getMesh(S)};let Et=null;function Ft(k,et){if(u=et.getViewerPose(c||o),g=et,u!==null){const pt=u.views;m!==null&&(t.setRenderTargetFramebuffer(T,m.framebuffer),t.setRenderTarget(T));let nt=!1;pt.length!==S.cameras.length&&(S.cameras.length=0,nt=!0);for(let Tt=0;Tt<pt.length;Tt++){const Pt=pt[Tt];let Jt=null;if(m!==null)Jt=m.getViewport(Pt);else{const ee=d.getViewSubImage(h,Pt);Jt=ee.viewport,Tt===0&&(t.setRenderTargetTextures(T,ee.colorTexture,h.ignoreDepthValues?void 0:ee.depthStencilTexture),t.setRenderTarget(T))}let zt=M[Tt];zt===void 0&&(zt=new je,zt.layers.enable(Tt),zt.viewport=new de,M[Tt]=zt),zt.matrix.fromArray(Pt.transform.matrix),zt.matrix.decompose(zt.position,zt.quaternion,zt.scale),zt.projectionMatrix.fromArray(Pt.projectionMatrix),zt.projectionMatrixInverse.copy(zt.projectionMatrix).invert(),zt.viewport.set(Jt.x,Jt.y,Jt.width,Jt.height),Tt===0&&(S.matrix.copy(zt.matrix),S.matrix.decompose(S.position,S.quaternion,S.scale)),nt===!0&&S.cameras.push(zt)}const yt=r.enabledFeatures;if(yt&&yt.includes("depth-sensing")){const Tt=d.getDepthInformation(pt[0]);Tt&&Tt.isValid&&Tt.texture&&_.init(t,Tt,r.renderState)}}for(let pt=0;pt<y.length;pt++){const nt=E[pt],yt=y[pt];nt!==null&&yt!==void 0&&yt.update(nt,et,c||o)}Et&&Et(k,et),et.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:et}),g=null}const $t=new Th;$t.setAnimationLoop(Ft),this.setAnimationLoop=function(k){Et=k},this.dispose=function(){}}}const fi=new Un,aE=new ae;function lE(n,t){function e(p,f){p.matrixAutoUpdate===!0&&p.updateMatrix(),f.value.copy(p.matrix)}function i(p,f){f.color.getRGB(p.fogColor.value,Eh(n)),f.isFog?(p.fogNear.value=f.near,p.fogFar.value=f.far):f.isFogExp2&&(p.fogDensity.value=f.density)}function r(p,f,T,y,E){f.isMeshBasicMaterial||f.isMeshLambertMaterial?s(p,f):f.isMeshToonMaterial?(s(p,f),d(p,f)):f.isMeshPhongMaterial?(s(p,f),u(p,f)):f.isMeshStandardMaterial?(s(p,f),h(p,f),f.isMeshPhysicalMaterial&&m(p,f,E)):f.isMeshMatcapMaterial?(s(p,f),g(p,f)):f.isMeshDepthMaterial?s(p,f):f.isMeshDistanceMaterial?(s(p,f),_(p,f)):f.isMeshNormalMaterial?s(p,f):f.isLineBasicMaterial?(o(p,f),f.isLineDashedMaterial&&a(p,f)):f.isPointsMaterial?l(p,f,T,y):f.isSpriteMaterial?c(p,f):f.isShadowMaterial?(p.color.value.copy(f.color),p.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function s(p,f){p.opacity.value=f.opacity,f.color&&p.diffuse.value.copy(f.color),f.emissive&&p.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(p.map.value=f.map,e(f.map,p.mapTransform)),f.alphaMap&&(p.alphaMap.value=f.alphaMap,e(f.alphaMap,p.alphaMapTransform)),f.bumpMap&&(p.bumpMap.value=f.bumpMap,e(f.bumpMap,p.bumpMapTransform),p.bumpScale.value=f.bumpScale,f.side===Fe&&(p.bumpScale.value*=-1)),f.normalMap&&(p.normalMap.value=f.normalMap,e(f.normalMap,p.normalMapTransform),p.normalScale.value.copy(f.normalScale),f.side===Fe&&p.normalScale.value.negate()),f.displacementMap&&(p.displacementMap.value=f.displacementMap,e(f.displacementMap,p.displacementMapTransform),p.displacementScale.value=f.displacementScale,p.displacementBias.value=f.displacementBias),f.emissiveMap&&(p.emissiveMap.value=f.emissiveMap,e(f.emissiveMap,p.emissiveMapTransform)),f.specularMap&&(p.specularMap.value=f.specularMap,e(f.specularMap,p.specularMapTransform)),f.alphaTest>0&&(p.alphaTest.value=f.alphaTest);const T=t.get(f),y=T.envMap,E=T.envMapRotation;y&&(p.envMap.value=y,fi.copy(E),fi.x*=-1,fi.y*=-1,fi.z*=-1,y.isCubeTexture&&y.isRenderTargetTexture===!1&&(fi.y*=-1,fi.z*=-1),p.envMapRotation.value.setFromMatrix4(aE.makeRotationFromEuler(fi)),p.flipEnvMap.value=y.isCubeTexture&&y.isRenderTargetTexture===!1?-1:1,p.reflectivity.value=f.reflectivity,p.ior.value=f.ior,p.refractionRatio.value=f.refractionRatio),f.lightMap&&(p.lightMap.value=f.lightMap,p.lightMapIntensity.value=f.lightMapIntensity,e(f.lightMap,p.lightMapTransform)),f.aoMap&&(p.aoMap.value=f.aoMap,p.aoMapIntensity.value=f.aoMapIntensity,e(f.aoMap,p.aoMapTransform))}function o(p,f){p.diffuse.value.copy(f.color),p.opacity.value=f.opacity,f.map&&(p.map.value=f.map,e(f.map,p.mapTransform))}function a(p,f){p.dashSize.value=f.dashSize,p.totalSize.value=f.dashSize+f.gapSize,p.scale.value=f.scale}function l(p,f,T,y){p.diffuse.value.copy(f.color),p.opacity.value=f.opacity,p.size.value=f.size*T,p.scale.value=y*.5,f.map&&(p.map.value=f.map,e(f.map,p.uvTransform)),f.alphaMap&&(p.alphaMap.value=f.alphaMap,e(f.alphaMap,p.alphaMapTransform)),f.alphaTest>0&&(p.alphaTest.value=f.alphaTest)}function c(p,f){p.diffuse.value.copy(f.color),p.opacity.value=f.opacity,p.rotation.value=f.rotation,f.map&&(p.map.value=f.map,e(f.map,p.mapTransform)),f.alphaMap&&(p.alphaMap.value=f.alphaMap,e(f.alphaMap,p.alphaMapTransform)),f.alphaTest>0&&(p.alphaTest.value=f.alphaTest)}function u(p,f){p.specular.value.copy(f.specular),p.shininess.value=Math.max(f.shininess,1e-4)}function d(p,f){f.gradientMap&&(p.gradientMap.value=f.gradientMap)}function h(p,f){p.metalness.value=f.metalness,f.metalnessMap&&(p.metalnessMap.value=f.metalnessMap,e(f.metalnessMap,p.metalnessMapTransform)),p.roughness.value=f.roughness,f.roughnessMap&&(p.roughnessMap.value=f.roughnessMap,e(f.roughnessMap,p.roughnessMapTransform)),f.envMap&&(p.envMapIntensity.value=f.envMapIntensity)}function m(p,f,T){p.ior.value=f.ior,f.sheen>0&&(p.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),p.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(p.sheenColorMap.value=f.sheenColorMap,e(f.sheenColorMap,p.sheenColorMapTransform)),f.sheenRoughnessMap&&(p.sheenRoughnessMap.value=f.sheenRoughnessMap,e(f.sheenRoughnessMap,p.sheenRoughnessMapTransform))),f.clearcoat>0&&(p.clearcoat.value=f.clearcoat,p.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(p.clearcoatMap.value=f.clearcoatMap,e(f.clearcoatMap,p.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,e(f.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(p.clearcoatNormalMap.value=f.clearcoatNormalMap,e(f.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===Fe&&p.clearcoatNormalScale.value.negate())),f.dispersion>0&&(p.dispersion.value=f.dispersion),f.iridescence>0&&(p.iridescence.value=f.iridescence,p.iridescenceIOR.value=f.iridescenceIOR,p.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(p.iridescenceMap.value=f.iridescenceMap,e(f.iridescenceMap,p.iridescenceMapTransform)),f.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=f.iridescenceThicknessMap,e(f.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),f.transmission>0&&(p.transmission.value=f.transmission,p.transmissionSamplerMap.value=T.texture,p.transmissionSamplerSize.value.set(T.width,T.height),f.transmissionMap&&(p.transmissionMap.value=f.transmissionMap,e(f.transmissionMap,p.transmissionMapTransform)),p.thickness.value=f.thickness,f.thicknessMap&&(p.thicknessMap.value=f.thicknessMap,e(f.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=f.attenuationDistance,p.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(p.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(p.anisotropyMap.value=f.anisotropyMap,e(f.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=f.specularIntensity,p.specularColor.value.copy(f.specularColor),f.specularColorMap&&(p.specularColorMap.value=f.specularColorMap,e(f.specularColorMap,p.specularColorMapTransform)),f.specularIntensityMap&&(p.specularIntensityMap.value=f.specularIntensityMap,e(f.specularIntensityMap,p.specularIntensityMapTransform))}function g(p,f){f.matcap&&(p.matcap.value=f.matcap)}function _(p,f){const T=t.get(f).light;p.referencePosition.value.setFromMatrixPosition(T.matrixWorld),p.nearDistance.value=T.shadow.camera.near,p.farDistance.value=T.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:r}}function cE(n,t,e,i){let r={},s={},o=[];const a=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(T,y){const E=y.program;i.uniformBlockBinding(T,E)}function c(T,y){let E=r[T.id];E===void 0&&(g(T),E=u(T),r[T.id]=E,T.addEventListener("dispose",p));const N=y.program;i.updateUBOMapping(T,N);const A=t.render.frame;s[T.id]!==A&&(h(T),s[T.id]=A)}function u(T){const y=d();T.__bindingPointIndex=y;const E=n.createBuffer(),N=T.__size,A=T.usage;return n.bindBuffer(n.UNIFORM_BUFFER,E),n.bufferData(n.UNIFORM_BUFFER,N,A),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,y,E),E}function d(){for(let T=0;T<a;T++)if(o.indexOf(T)===-1)return o.push(T),T;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function h(T){const y=r[T.id],E=T.uniforms,N=T.__cache;n.bindBuffer(n.UNIFORM_BUFFER,y);for(let A=0,w=E.length;A<w;A++){const P=Array.isArray(E[A])?E[A]:[E[A]];for(let M=0,S=P.length;M<S;M++){const C=P[M];if(m(C,A,M,N)===!0){const W=C.__offset,U=Array.isArray(C.value)?C.value:[C.value];let X=0;for(let K=0;K<U.length;K++){const V=U[K],J=_(V);typeof V=="number"||typeof V=="boolean"?(C.__data[0]=V,n.bufferSubData(n.UNIFORM_BUFFER,W+X,C.__data)):V.isMatrix3?(C.__data[0]=V.elements[0],C.__data[1]=V.elements[1],C.__data[2]=V.elements[2],C.__data[3]=0,C.__data[4]=V.elements[3],C.__data[5]=V.elements[4],C.__data[6]=V.elements[5],C.__data[7]=0,C.__data[8]=V.elements[6],C.__data[9]=V.elements[7],C.__data[10]=V.elements[8],C.__data[11]=0):(V.toArray(C.__data,X),X+=J.storage/Float32Array.BYTES_PER_ELEMENT)}n.bufferSubData(n.UNIFORM_BUFFER,W,C.__data)}}}n.bindBuffer(n.UNIFORM_BUFFER,null)}function m(T,y,E,N){const A=T.value,w=y+"_"+E;if(N[w]===void 0)return typeof A=="number"||typeof A=="boolean"?N[w]=A:N[w]=A.clone(),!0;{const P=N[w];if(typeof A=="number"||typeof A=="boolean"){if(P!==A)return N[w]=A,!0}else if(P.equals(A)===!1)return P.copy(A),!0}return!1}function g(T){const y=T.uniforms;let E=0;const N=16;for(let w=0,P=y.length;w<P;w++){const M=Array.isArray(y[w])?y[w]:[y[w]];for(let S=0,C=M.length;S<C;S++){const W=M[S],U=Array.isArray(W.value)?W.value:[W.value];for(let X=0,K=U.length;X<K;X++){const V=U[X],J=_(V),G=E%N,it=G%J.boundary,ut=G+it;E+=it,ut!==0&&N-ut<J.storage&&(E+=N-ut),W.__data=new Float32Array(J.storage/Float32Array.BYTES_PER_ELEMENT),W.__offset=E,E+=J.storage}}}const A=E%N;return A>0&&(E+=N-A),T.__size=E,T.__cache={},this}function _(T){const y={boundary:0,storage:0};return typeof T=="number"||typeof T=="boolean"?(y.boundary=4,y.storage=4):T.isVector2?(y.boundary=8,y.storage=8):T.isVector3||T.isColor?(y.boundary=16,y.storage=12):T.isVector4?(y.boundary=16,y.storage=16):T.isMatrix3?(y.boundary=48,y.storage=48):T.isMatrix4?(y.boundary=64,y.storage=64):T.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",T),y}function p(T){const y=T.target;y.removeEventListener("dispose",p);const E=o.indexOf(y.__bindingPointIndex);o.splice(E,1),n.deleteBuffer(r[y.id]),delete r[y.id],delete s[y.id]}function f(){for(const T in r)n.deleteBuffer(r[T]);o=[],r={},s={}}return{bind:l,update:c,dispose:f}}class uE{constructor(t={}){const{canvas:e=jm(),context:i=null,depth:r=!0,stencil:s=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:d=!1,reverseDepthBuffer:h=!1}=t;this.isWebGLRenderer=!0;let m;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");m=i.getContextAttributes().alpha}else m=o;const g=new Uint32Array(4),_=new Int32Array(4);let p=null,f=null;const T=[],y=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Ve,this.toneMapping=ni,this.toneMappingExposure=1;const E=this;let N=!1,A=0,w=0,P=null,M=-1,S=null;const C=new de,W=new de;let U=null;const X=new Vt(0);let K=0,V=e.width,J=e.height,G=1,it=null,ut=null;const Et=new de(0,0,V,J),Ft=new de(0,0,V,J);let $t=!1;const k=new yh;let et=!1,pt=!1;const nt=new ae,yt=new ae,Tt=new B,Pt=new de,Jt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let zt=!1;function ee(){return P===null?G:1}let I=i;function Me(x,D){return e.getContext(x,D)}try{const x={alpha:!0,depth:r,stencil:s,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:d};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Lc}`),e.addEventListener("webglcontextlost",Z,!1),e.addEventListener("webglcontextrestored",lt,!1),e.addEventListener("webglcontextcreationerror",at,!1),I===null){const D="webgl2";if(I=Me(D,x),I===null)throw Me(D)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(x){throw console.error("THREE.WebGLRenderer: "+x.message),x}let Bt,Ht,Mt,qt,St,b,v,F,q,j,Y,mt,ot,dt,kt,Q,ht,bt,wt,ft,Gt,Ct,Ut,L;function rt(){Bt=new mv(I),Bt.init(),Ct=new tE(I,Bt),Ht=new lv(I,Bt,t,Ct),Mt=new jx(I,Bt),Ht.reverseDepthBuffer&&h&&Mt.buffers.depth.setReversed(!0),qt=new vv(I),St=new Ox,b=new Qx(I,Bt,Mt,St,Ht,Ct,qt),v=new uv(E),F=new pv(E),q=new T_(I),Ut=new ov(I,q),j=new _v(I,q,qt,Ut),Y=new Ev(I,j,q,qt),wt=new xv(I,Ht,b),Q=new cv(St),mt=new Ux(E,v,F,Bt,Ht,Ut,Q),ot=new lE(E,St),dt=new Bx,kt=new Wx(Bt),bt=new sv(E,v,F,Mt,Y,m,l),ht=new $x(E,Y,Ht),L=new cE(I,qt,Ht,Mt),ft=new av(I,Bt,qt),Gt=new gv(I,Bt,qt),qt.programs=mt.programs,E.capabilities=Ht,E.extensions=Bt,E.properties=St,E.renderLists=dt,E.shadowMap=ht,E.state=Mt,E.info=qt}rt();const z=new oE(E,I);this.xr=z,this.getContext=function(){return I},this.getContextAttributes=function(){return I.getContextAttributes()},this.forceContextLoss=function(){const x=Bt.get("WEBGL_lose_context");x&&x.loseContext()},this.forceContextRestore=function(){const x=Bt.get("WEBGL_lose_context");x&&x.restoreContext()},this.getPixelRatio=function(){return G},this.setPixelRatio=function(x){x!==void 0&&(G=x,this.setSize(V,J,!1))},this.getSize=function(x){return x.set(V,J)},this.setSize=function(x,D,O=!0){if(z.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}V=x,J=D,e.width=Math.floor(x*G),e.height=Math.floor(D*G),O===!0&&(e.style.width=x+"px",e.style.height=D+"px"),this.setViewport(0,0,x,D)},this.getDrawingBufferSize=function(x){return x.set(V*G,J*G).floor()},this.setDrawingBufferSize=function(x,D,O){V=x,J=D,G=O,e.width=Math.floor(x*O),e.height=Math.floor(D*O),this.setViewport(0,0,x,D)},this.getCurrentViewport=function(x){return x.copy(C)},this.getViewport=function(x){return x.copy(Et)},this.setViewport=function(x,D,O,H){x.isVector4?Et.set(x.x,x.y,x.z,x.w):Et.set(x,D,O,H),Mt.viewport(C.copy(Et).multiplyScalar(G).round())},this.getScissor=function(x){return x.copy(Ft)},this.setScissor=function(x,D,O,H){x.isVector4?Ft.set(x.x,x.y,x.z,x.w):Ft.set(x,D,O,H),Mt.scissor(W.copy(Ft).multiplyScalar(G).round())},this.getScissorTest=function(){return $t},this.setScissorTest=function(x){Mt.setScissorTest($t=x)},this.setOpaqueSort=function(x){it=x},this.setTransparentSort=function(x){ut=x},this.getClearColor=function(x){return x.copy(bt.getClearColor())},this.setClearColor=function(){bt.setClearColor.apply(bt,arguments)},this.getClearAlpha=function(){return bt.getClearAlpha()},this.setClearAlpha=function(){bt.setClearAlpha.apply(bt,arguments)},this.clear=function(x=!0,D=!0,O=!0){let H=0;if(x){let R=!1;if(P!==null){const tt=P.texture.format;R=tt===Fc||tt===Oc||tt===Uc}if(R){const tt=P.texture.type,ct=tt===Nn||tt===Ai||tt===ms||tt===Er||tt===Ic||tt===Dc,_t=bt.getClearColor(),gt=bt.getClearAlpha(),Lt=_t.r,Dt=_t.g,vt=_t.b;ct?(g[0]=Lt,g[1]=Dt,g[2]=vt,g[3]=gt,I.clearBufferuiv(I.COLOR,0,g)):(_[0]=Lt,_[1]=Dt,_[2]=vt,_[3]=gt,I.clearBufferiv(I.COLOR,0,_))}else H|=I.COLOR_BUFFER_BIT}D&&(H|=I.DEPTH_BUFFER_BIT),O&&(H|=I.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),I.clear(H)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",Z,!1),e.removeEventListener("webglcontextrestored",lt,!1),e.removeEventListener("webglcontextcreationerror",at,!1),dt.dispose(),kt.dispose(),St.dispose(),v.dispose(),F.dispose(),Y.dispose(),Ut.dispose(),L.dispose(),mt.dispose(),z.dispose(),z.removeEventListener("sessionstart",As),z.removeEventListener("sessionend",Ii),pn.stop()};function Z(x){x.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),N=!0}function lt(){console.log("THREE.WebGLRenderer: Context Restored."),N=!1;const x=qt.autoReset,D=ht.enabled,O=ht.autoUpdate,H=ht.needsUpdate,R=ht.type;rt(),qt.autoReset=x,ht.enabled=D,ht.autoUpdate=O,ht.needsUpdate=H,ht.type=R}function at(x){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",x.statusMessage)}function Rt(x){const D=x.target;D.removeEventListener("dispose",Rt),re(D)}function re(x){ve(x),St.remove(x)}function ve(x){const D=St.get(x).programs;D!==void 0&&(D.forEach(function(O){mt.releaseProgram(O)}),x.isShaderMaterial&&mt.releaseShaderCache(x))}this.renderBufferDirect=function(x,D,O,H,R,tt){D===null&&(D=Jt);const ct=R.isMesh&&R.matrixWorld.determinant()<0,_t=Ni(x,D,O,H,R);Mt.setMaterial(H,ct);let gt=O.index,Lt=1;if(H.wireframe===!0){if(gt=j.getWireframeAttribute(O),gt===void 0)return;Lt=2}const Dt=O.drawRange,vt=O.attributes.position;let Zt=Dt.start*Lt,ie=(Dt.start+Dt.count)*Lt;tt!==null&&(Zt=Math.max(Zt,tt.start*Lt),ie=Math.min(ie,(tt.start+tt.count)*Lt)),gt!==null?(Zt=Math.max(Zt,0),ie=Math.min(ie,gt.count)):vt!=null&&(Zt=Math.max(Zt,0),ie=Math.min(ie,vt.count));const se=ie-Zt;if(se<0||se===1/0)return;Ut.setup(R,H,_t,O,gt);let Ne,Kt=ft;if(gt!==null&&(Ne=q.get(gt),Kt=Gt,Kt.setIndex(Ne)),R.isMesh)H.wireframe===!0?(Mt.setLineWidth(H.wireframeLinewidth*ee()),Kt.setMode(I.LINES)):Kt.setMode(I.TRIANGLES);else if(R.isLine){let xt=H.linewidth;xt===void 0&&(xt=1),Mt.setLineWidth(xt*ee()),R.isLineSegments?Kt.setMode(I.LINES):R.isLineLoop?Kt.setMode(I.LINE_LOOP):Kt.setMode(I.LINE_STRIP)}else R.isPoints?Kt.setMode(I.POINTS):R.isSprite&&Kt.setMode(I.TRIANGLES);if(R.isBatchedMesh)if(R._multiDrawInstances!==null)Kt.renderMultiDrawInstances(R._multiDrawStarts,R._multiDrawCounts,R._multiDrawCount,R._multiDrawInstances);else if(Bt.get("WEBGL_multi_draw"))Kt.renderMultiDraw(R._multiDrawStarts,R._multiDrawCounts,R._multiDrawCount);else{const xt=R._multiDrawStarts,Mn=R._multiDrawCounts,jt=R._multiDrawCount,en=gt?q.get(gt).bytesPerElement:1,Ui=St.get(H).currentProgram.getUniforms();for(let ze=0;ze<jt;ze++)Ui.setValue(I,"_gl_DrawID",ze),Kt.render(xt[ze]/en,Mn[ze])}else if(R.isInstancedMesh)Kt.renderInstances(Zt,se,R.count);else if(O.isInstancedBufferGeometry){const xt=O._maxInstanceCount!==void 0?O._maxInstanceCount:1/0,Mn=Math.min(O.instanceCount,xt);Kt.renderInstances(Zt,se,Mn)}else Kt.render(Zt,se)};function Xt(x,D,O){x.transparent===!0&&x.side===an&&x.forceSinglePass===!1?(x.side=Fe,x.needsUpdate=!0,Qt(x,D,O),x.side=ii,x.needsUpdate=!0,Qt(x,D,O),x.side=an):Qt(x,D,O)}this.compile=function(x,D,O=null){O===null&&(O=x),f=kt.get(O),f.init(D),y.push(f),O.traverseVisible(function(R){R.isLight&&R.layers.test(D.layers)&&(f.pushLight(R),R.castShadow&&f.pushShadow(R))}),x!==O&&x.traverseVisible(function(R){R.isLight&&R.layers.test(D.layers)&&(f.pushLight(R),R.castShadow&&f.pushShadow(R))}),f.setupLights();const H=new Set;return x.traverse(function(R){if(!(R.isMesh||R.isPoints||R.isLine||R.isSprite))return;const tt=R.material;if(tt)if(Array.isArray(tt))for(let ct=0;ct<tt.length;ct++){const _t=tt[ct];Xt(_t,O,R),H.add(_t)}else Xt(tt,O,R),H.add(tt)}),y.pop(),f=null,H},this.compileAsync=function(x,D,O=null){const H=this.compile(x,D,O);return new Promise(R=>{function tt(){if(H.forEach(function(ct){St.get(ct).currentProgram.isReady()&&H.delete(ct)}),H.size===0){R(x);return}setTimeout(tt,10)}Bt.get("KHR_parallel_shader_compile")!==null?tt():setTimeout(tt,10)})};let Be=null;function Ye(x){Be&&Be(x)}function As(){pn.stop()}function Ii(){pn.start()}const pn=new Th;pn.setAnimationLoop(Ye),typeof self<"u"&&pn.setContext(self),this.setAnimationLoop=function(x){Be=x,z.setAnimationLoop(x),x===null?pn.stop():pn.start()},z.addEventListener("sessionstart",As),z.addEventListener("sessionend",Ii),this.render=function(x,D){if(D!==void 0&&D.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(N===!0)return;if(x.matrixWorldAutoUpdate===!0&&x.updateMatrixWorld(),D.parent===null&&D.matrixWorldAutoUpdate===!0&&D.updateMatrixWorld(),z.enabled===!0&&z.isPresenting===!0&&(z.cameraAutoUpdate===!0&&z.updateCamera(D),D=z.getCamera()),x.isScene===!0&&x.onBeforeRender(E,x,D,P),f=kt.get(x,y.length),f.init(D),y.push(f),yt.multiplyMatrices(D.projectionMatrix,D.matrixWorldInverse),k.setFromProjectionMatrix(yt),pt=this.localClippingEnabled,et=Q.init(this.clippingPlanes,pt),p=dt.get(x,T.length),p.init(),T.push(p),z.enabled===!0&&z.isPresenting===!0){const tt=E.xr.getDepthSensingMesh();tt!==null&&Di(tt,D,-1/0,E.sortObjects)}Di(x,D,0,E.sortObjects),p.finish(),E.sortObjects===!0&&p.sort(it,ut),zt=z.enabled===!1||z.isPresenting===!1||z.hasDepthSensing()===!1,zt&&bt.addToRenderList(p,x),this.info.render.frame++,et===!0&&Q.beginShadows();const O=f.state.shadowsArray;ht.render(O,x,D),et===!0&&Q.endShadows(),this.info.autoReset===!0&&this.info.reset();const H=p.opaque,R=p.transmissive;if(f.setupLights(),D.isArrayCamera){const tt=D.cameras;if(R.length>0)for(let ct=0,_t=tt.length;ct<_t;ct++){const gt=tt[ct];Dr(H,R,x,gt)}zt&&bt.render(x);for(let ct=0,_t=tt.length;ct<_t;ct++){const gt=tt[ct];ws(p,x,gt,gt.viewport)}}else R.length>0&&Dr(H,R,x,D),zt&&bt.render(x),ws(p,x,D);P!==null&&(b.updateMultisampleRenderTarget(P),b.updateRenderTargetMipmap(P)),x.isScene===!0&&x.onAfterRender(E,x,D),Ut.resetDefaultState(),M=-1,S=null,y.pop(),y.length>0?(f=y[y.length-1],et===!0&&Q.setGlobalState(E.clippingPlanes,f.state.camera)):f=null,T.pop(),T.length>0?p=T[T.length-1]:p=null};function Di(x,D,O,H){if(x.visible===!1)return;if(x.layers.test(D.layers)){if(x.isGroup)O=x.renderOrder;else if(x.isLOD)x.autoUpdate===!0&&x.update(D);else if(x.isLight)f.pushLight(x),x.castShadow&&f.pushShadow(x);else if(x.isSprite){if(!x.frustumCulled||k.intersectsSprite(x)){H&&Pt.setFromMatrixPosition(x.matrixWorld).applyMatrix4(yt);const ct=Y.update(x),_t=x.material;_t.visible&&p.push(x,ct,_t,O,Pt.z,null)}}else if((x.isMesh||x.isLine||x.isPoints)&&(!x.frustumCulled||k.intersectsObject(x))){const ct=Y.update(x),_t=x.material;if(H&&(x.boundingSphere!==void 0?(x.boundingSphere===null&&x.computeBoundingSphere(),Pt.copy(x.boundingSphere.center)):(ct.boundingSphere===null&&ct.computeBoundingSphere(),Pt.copy(ct.boundingSphere.center)),Pt.applyMatrix4(x.matrixWorld).applyMatrix4(yt)),Array.isArray(_t)){const gt=ct.groups;for(let Lt=0,Dt=gt.length;Lt<Dt;Lt++){const vt=gt[Lt],Zt=_t[vt.materialIndex];Zt&&Zt.visible&&p.push(x,ct,Zt,O,Pt.z,vt)}}else _t.visible&&p.push(x,ct,_t,O,Pt.z,null)}}const tt=x.children;for(let ct=0,_t=tt.length;ct<_t;ct++)Di(tt[ct],D,O,H)}function ws(x,D,O,H){const R=x.opaque,tt=x.transmissive,ct=x.transparent;f.setupLightsView(O),et===!0&&Q.setGlobalState(E.clippingPlanes,O),H&&Mt.viewport(C.copy(H)),R.length>0&&$(R,D,O),tt.length>0&&$(tt,D,O),ct.length>0&&$(ct,D,O),Mt.buffers.depth.setTest(!0),Mt.buffers.depth.setMask(!0),Mt.buffers.color.setMask(!0),Mt.setPolygonOffset(!1)}function Dr(x,D,O,H){if((O.isScene===!0?O.overrideMaterial:null)!==null)return;f.state.transmissionRenderTarget[H.id]===void 0&&(f.state.transmissionRenderTarget[H.id]=new wi(1,1,{generateMipmaps:!0,type:Bt.has("EXT_color_buffer_half_float")||Bt.has("EXT_color_buffer_float")?Ms:Nn,minFilter:Si,samples:4,stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Yt.workingColorSpace}));const tt=f.state.transmissionRenderTarget[H.id],ct=H.viewport||C;tt.setSize(ct.z,ct.w);const _t=E.getRenderTarget();E.setRenderTarget(tt),E.getClearColor(X),K=E.getClearAlpha(),K<1&&E.setClearColor(16777215,.5),E.clear(),zt&&bt.render(O);const gt=E.toneMapping;E.toneMapping=ni;const Lt=H.viewport;if(H.viewport!==void 0&&(H.viewport=void 0),f.setupLightsView(H),et===!0&&Q.setGlobalState(E.clippingPlanes,H),$(x,O,H),b.updateMultisampleRenderTarget(tt),b.updateRenderTargetMipmap(tt),Bt.has("WEBGL_multisampled_render_to_texture")===!1){let Dt=!1;for(let vt=0,Zt=D.length;vt<Zt;vt++){const ie=D[vt],se=ie.object,Ne=ie.geometry,Kt=ie.material,xt=ie.group;if(Kt.side===an&&se.layers.test(H.layers)){const Mn=Kt.side;Kt.side=Fe,Kt.needsUpdate=!0,It(se,O,H,Ne,Kt,xt),Kt.side=Mn,Kt.needsUpdate=!0,Dt=!0}}Dt===!0&&(b.updateMultisampleRenderTarget(tt),b.updateRenderTargetMipmap(tt))}E.setRenderTarget(_t),E.setClearColor(X,K),Lt!==void 0&&(H.viewport=Lt),E.toneMapping=gt}function $(x,D,O){const H=D.isScene===!0?D.overrideMaterial:null;for(let R=0,tt=x.length;R<tt;R++){const ct=x[R],_t=ct.object,gt=ct.geometry,Lt=H===null?ct.material:H,Dt=ct.group;_t.layers.test(O.layers)&&It(_t,D,O,gt,Lt,Dt)}}function It(x,D,O,H,R,tt){x.onBeforeRender(E,D,O,H,R,tt),x.modelViewMatrix.multiplyMatrices(O.matrixWorldInverse,x.matrixWorld),x.normalMatrix.getNormalMatrix(x.modelViewMatrix),R.onBeforeRender(E,D,O,H,x,tt),R.transparent===!0&&R.side===an&&R.forceSinglePass===!1?(R.side=Fe,R.needsUpdate=!0,E.renderBufferDirect(O,D,H,R,x,tt),R.side=ii,R.needsUpdate=!0,E.renderBufferDirect(O,D,H,R,x,tt),R.side=an):E.renderBufferDirect(O,D,H,R,x,tt),x.onAfterRender(E,D,O,H,R,tt)}function Qt(x,D,O){D.isScene!==!0&&(D=Jt);const H=St.get(x),R=f.state.lights,tt=f.state.shadowsArray,ct=R.state.version,_t=mt.getParameters(x,R.state,tt,D,O),gt=mt.getProgramCacheKey(_t);let Lt=H.programs;H.environment=x.isMeshStandardMaterial?D.environment:null,H.fog=D.fog,H.envMap=(x.isMeshStandardMaterial?F:v).get(x.envMap||H.environment),H.envMapRotation=H.environment!==null&&x.envMap===null?D.environmentRotation:x.envMapRotation,Lt===void 0&&(x.addEventListener("dispose",Rt),Lt=new Map,H.programs=Lt);let Dt=Lt.get(gt);if(Dt!==void 0){if(H.currentProgram===Dt&&H.lightsStateVersion===ct)return fe(x,_t),Dt}else _t.uniforms=mt.getUniforms(x),x.onBeforeCompile(_t,E),Dt=mt.acquireProgram(_t,gt),Lt.set(gt,Dt),H.uniforms=_t.uniforms;const vt=H.uniforms;return(!x.isShaderMaterial&&!x.isRawShaderMaterial||x.clipping===!0)&&(vt.clippingPlanes=Q.uniform),fe(x,_t),H.needsLights=Te(x),H.lightsStateVersion=ct,H.needsLights&&(vt.ambientLightColor.value=R.state.ambient,vt.lightProbe.value=R.state.probe,vt.directionalLights.value=R.state.directional,vt.directionalLightShadows.value=R.state.directionalShadow,vt.spotLights.value=R.state.spot,vt.spotLightShadows.value=R.state.spotShadow,vt.rectAreaLights.value=R.state.rectArea,vt.ltc_1.value=R.state.rectAreaLTC1,vt.ltc_2.value=R.state.rectAreaLTC2,vt.pointLights.value=R.state.point,vt.pointLightShadows.value=R.state.pointShadow,vt.hemisphereLights.value=R.state.hemi,vt.directionalShadowMap.value=R.state.directionalShadowMap,vt.directionalShadowMatrix.value=R.state.directionalShadowMatrix,vt.spotShadowMap.value=R.state.spotShadowMap,vt.spotLightMatrix.value=R.state.spotLightMatrix,vt.spotLightMap.value=R.state.spotLightMap,vt.pointShadowMap.value=R.state.pointShadowMap,vt.pointShadowMatrix.value=R.state.pointShadowMatrix),H.currentProgram=Dt,H.uniformsList=null,Dt}function ce(x){if(x.uniformsList===null){const D=x.currentProgram.getUniforms();x.uniformsList=Ao.seqWithValue(D.seq,x.uniforms)}return x.uniformsList}function fe(x,D){const O=St.get(x);O.outputColorSpace=D.outputColorSpace,O.batching=D.batching,O.batchingColor=D.batchingColor,O.instancing=D.instancing,O.instancingColor=D.instancingColor,O.instancingMorph=D.instancingMorph,O.skinning=D.skinning,O.morphTargets=D.morphTargets,O.morphNormals=D.morphNormals,O.morphColors=D.morphColors,O.morphTargetsCount=D.morphTargetsCount,O.numClippingPlanes=D.numClippingPlanes,O.numIntersection=D.numClipIntersection,O.vertexAlphas=D.vertexAlphas,O.vertexTangents=D.vertexTangents,O.toneMapping=D.toneMapping}function Ni(x,D,O,H,R){D.isScene!==!0&&(D=Jt),b.resetTextureUnits();const tt=D.fog,ct=H.isMeshStandardMaterial?D.environment:null,_t=P===null?E.outputColorSpace:P.isXRRenderTarget===!0?P.texture.colorSpace:Ar,gt=(H.isMeshStandardMaterial?F:v).get(H.envMap||ct),Lt=H.vertexColors===!0&&!!O.attributes.color&&O.attributes.color.itemSize===4,Dt=!!O.attributes.tangent&&(!!H.normalMap||H.anisotropy>0),vt=!!O.morphAttributes.position,Zt=!!O.morphAttributes.normal,ie=!!O.morphAttributes.color;let se=ni;H.toneMapped&&(P===null||P.isXRRenderTarget===!0)&&(se=E.toneMapping);const Ne=O.morphAttributes.position||O.morphAttributes.normal||O.morphAttributes.color,Kt=Ne!==void 0?Ne.length:0,xt=St.get(H),Mn=f.state.lights;if(et===!0&&(pt===!0||x!==S)){const qe=x===S&&H.id===M;Q.setState(H,x,qe)}let jt=!1;H.version===xt.__version?(xt.needsLights&&xt.lightsStateVersion!==Mn.state.version||xt.outputColorSpace!==_t||R.isBatchedMesh&&xt.batching===!1||!R.isBatchedMesh&&xt.batching===!0||R.isBatchedMesh&&xt.batchingColor===!0&&R.colorTexture===null||R.isBatchedMesh&&xt.batchingColor===!1&&R.colorTexture!==null||R.isInstancedMesh&&xt.instancing===!1||!R.isInstancedMesh&&xt.instancing===!0||R.isSkinnedMesh&&xt.skinning===!1||!R.isSkinnedMesh&&xt.skinning===!0||R.isInstancedMesh&&xt.instancingColor===!0&&R.instanceColor===null||R.isInstancedMesh&&xt.instancingColor===!1&&R.instanceColor!==null||R.isInstancedMesh&&xt.instancingMorph===!0&&R.morphTexture===null||R.isInstancedMesh&&xt.instancingMorph===!1&&R.morphTexture!==null||xt.envMap!==gt||H.fog===!0&&xt.fog!==tt||xt.numClippingPlanes!==void 0&&(xt.numClippingPlanes!==Q.numPlanes||xt.numIntersection!==Q.numIntersection)||xt.vertexAlphas!==Lt||xt.vertexTangents!==Dt||xt.morphTargets!==vt||xt.morphNormals!==Zt||xt.morphColors!==ie||xt.toneMapping!==se||xt.morphTargetsCount!==Kt)&&(jt=!0):(jt=!0,xt.__version=H.version);let en=xt.currentProgram;jt===!0&&(en=Qt(H,D,R));let Ui=!1,ze=!1,Nr=!1;const oe=en.getUniforms(),mn=xt.uniforms;if(Mt.useProgram(en.program)&&(Ui=!0,ze=!0,Nr=!0),H.id!==M&&(M=H.id,ze=!0),Ui||S!==x){Mt.buffers.depth.getReversed()?(nt.copy(x.projectionMatrix),Qm(nt),t_(nt),oe.setValue(I,"projectionMatrix",nt)):oe.setValue(I,"projectionMatrix",x.projectionMatrix),oe.setValue(I,"viewMatrix",x.matrixWorldInverse);const Bn=oe.map.cameraPosition;Bn!==void 0&&Bn.setValue(I,Tt.setFromMatrixPosition(x.matrixWorld)),Ht.logarithmicDepthBuffer&&oe.setValue(I,"logDepthBufFC",2/(Math.log(x.far+1)/Math.LN2)),(H.isMeshPhongMaterial||H.isMeshToonMaterial||H.isMeshLambertMaterial||H.isMeshBasicMaterial||H.isMeshStandardMaterial||H.isShaderMaterial)&&oe.setValue(I,"isOrthographic",x.isOrthographicCamera===!0),S!==x&&(S=x,ze=!0,Nr=!0)}if(R.isSkinnedMesh){oe.setOptional(I,R,"bindMatrix"),oe.setOptional(I,R,"bindMatrixInverse");const qe=R.skeleton;qe&&(qe.boneTexture===null&&qe.computeBoneTexture(),oe.setValue(I,"boneTexture",qe.boneTexture,b))}R.isBatchedMesh&&(oe.setOptional(I,R,"batchingTexture"),oe.setValue(I,"batchingTexture",R._matricesTexture,b),oe.setOptional(I,R,"batchingIdTexture"),oe.setValue(I,"batchingIdTexture",R._indirectTexture,b),oe.setOptional(I,R,"batchingColorTexture"),R._colorsTexture!==null&&oe.setValue(I,"batchingColorTexture",R._colorsTexture,b));const Ur=O.morphAttributes;if((Ur.position!==void 0||Ur.normal!==void 0||Ur.color!==void 0)&&wt.update(R,O,en),(ze||xt.receiveShadow!==R.receiveShadow)&&(xt.receiveShadow=R.receiveShadow,oe.setValue(I,"receiveShadow",R.receiveShadow)),H.isMeshGouraudMaterial&&H.envMap!==null&&(mn.envMap.value=gt,mn.flipEnvMap.value=gt.isCubeTexture&&gt.isRenderTargetTexture===!1?-1:1),H.isMeshStandardMaterial&&H.envMap===null&&D.environment!==null&&(mn.envMapIntensity.value=D.environmentIntensity),ze&&(oe.setValue(I,"toneMappingExposure",E.toneMappingExposure),xt.needsLights&&He(mn,Nr),tt&&H.fog===!0&&ot.refreshFogUniforms(mn,tt),ot.refreshMaterialUniforms(mn,H,G,J,f.state.transmissionRenderTarget[x.id]),Ao.upload(I,ce(xt),mn,b)),H.isShaderMaterial&&H.uniformsNeedUpdate===!0&&(Ao.upload(I,ce(xt),mn,b),H.uniformsNeedUpdate=!1),H.isSpriteMaterial&&oe.setValue(I,"center",R.center),oe.setValue(I,"modelViewMatrix",R.modelViewMatrix),oe.setValue(I,"normalMatrix",R.normalMatrix),oe.setValue(I,"modelMatrix",R.matrixWorld),H.isShaderMaterial||H.isRawShaderMaterial){const qe=H.uniformsGroups;for(let Bn=0,Hn=qe.length;Bn<Hn;Bn++){const lu=qe[Bn];L.update(lu,en),L.bind(lu,en)}}return en}function He(x,D){x.ambientLightColor.needsUpdate=D,x.lightProbe.needsUpdate=D,x.directionalLights.needsUpdate=D,x.directionalLightShadows.needsUpdate=D,x.pointLights.needsUpdate=D,x.pointLightShadows.needsUpdate=D,x.spotLights.needsUpdate=D,x.spotLightShadows.needsUpdate=D,x.rectAreaLights.needsUpdate=D,x.hemisphereLights.needsUpdate=D}function Te(x){return x.isMeshLambertMaterial||x.isMeshToonMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isShadowMaterial||x.isShaderMaterial&&x.lights===!0}this.getActiveCubeFace=function(){return A},this.getActiveMipmapLevel=function(){return w},this.getRenderTarget=function(){return P},this.setRenderTargetTextures=function(x,D,O){St.get(x.texture).__webglTexture=D,St.get(x.depthTexture).__webglTexture=O;const H=St.get(x);H.__hasExternalTextures=!0,H.__autoAllocateDepthBuffer=O===void 0,H.__autoAllocateDepthBuffer||Bt.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),H.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(x,D){const O=St.get(x);O.__webglFramebuffer=D,O.__useDefaultFramebuffer=D===void 0},this.setRenderTarget=function(x,D=0,O=0){P=x,A=D,w=O;let H=!0,R=null,tt=!1,ct=!1;if(x){const gt=St.get(x);if(gt.__useDefaultFramebuffer!==void 0)Mt.bindFramebuffer(I.FRAMEBUFFER,null),H=!1;else if(gt.__webglFramebuffer===void 0)b.setupRenderTarget(x);else if(gt.__hasExternalTextures)b.rebindTextures(x,St.get(x.texture).__webglTexture,St.get(x.depthTexture).__webglTexture);else if(x.depthBuffer){const vt=x.depthTexture;if(gt.__boundDepthTexture!==vt){if(vt!==null&&St.has(vt)&&(x.width!==vt.image.width||x.height!==vt.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");b.setupDepthRenderbuffer(x)}}const Lt=x.texture;(Lt.isData3DTexture||Lt.isDataArrayTexture||Lt.isCompressedArrayTexture)&&(ct=!0);const Dt=St.get(x).__webglFramebuffer;x.isWebGLCubeRenderTarget?(Array.isArray(Dt[D])?R=Dt[D][O]:R=Dt[D],tt=!0):x.samples>0&&b.useMultisampledRTT(x)===!1?R=St.get(x).__webglMultisampledFramebuffer:Array.isArray(Dt)?R=Dt[O]:R=Dt,C.copy(x.viewport),W.copy(x.scissor),U=x.scissorTest}else C.copy(Et).multiplyScalar(G).floor(),W.copy(Ft).multiplyScalar(G).floor(),U=$t;if(Mt.bindFramebuffer(I.FRAMEBUFFER,R)&&H&&Mt.drawBuffers(x,R),Mt.viewport(C),Mt.scissor(W),Mt.setScissorTest(U),tt){const gt=St.get(x.texture);I.framebufferTexture2D(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0,I.TEXTURE_CUBE_MAP_POSITIVE_X+D,gt.__webglTexture,O)}else if(ct){const gt=St.get(x.texture),Lt=D||0;I.framebufferTextureLayer(I.FRAMEBUFFER,I.COLOR_ATTACHMENT0,gt.__webglTexture,O||0,Lt)}M=-1},this.readRenderTargetPixels=function(x,D,O,H,R,tt,ct){if(!(x&&x.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let _t=St.get(x).__webglFramebuffer;if(x.isWebGLCubeRenderTarget&&ct!==void 0&&(_t=_t[ct]),_t){Mt.bindFramebuffer(I.FRAMEBUFFER,_t);try{const gt=x.texture,Lt=gt.format,Dt=gt.type;if(!Ht.textureFormatReadable(Lt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Ht.textureTypeReadable(Dt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}D>=0&&D<=x.width-H&&O>=0&&O<=x.height-R&&I.readPixels(D,O,H,R,Ct.convert(Lt),Ct.convert(Dt),tt)}finally{const gt=P!==null?St.get(P).__webglFramebuffer:null;Mt.bindFramebuffer(I.FRAMEBUFFER,gt)}}},this.readRenderTargetPixelsAsync=async function(x,D,O,H,R,tt,ct){if(!(x&&x.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let _t=St.get(x).__webglFramebuffer;if(x.isWebGLCubeRenderTarget&&ct!==void 0&&(_t=_t[ct]),_t){const gt=x.texture,Lt=gt.format,Dt=gt.type;if(!Ht.textureFormatReadable(Lt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Ht.textureTypeReadable(Dt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(D>=0&&D<=x.width-H&&O>=0&&O<=x.height-R){Mt.bindFramebuffer(I.FRAMEBUFFER,_t);const vt=I.createBuffer();I.bindBuffer(I.PIXEL_PACK_BUFFER,vt),I.bufferData(I.PIXEL_PACK_BUFFER,tt.byteLength,I.STREAM_READ),I.readPixels(D,O,H,R,Ct.convert(Lt),Ct.convert(Dt),0);const Zt=P!==null?St.get(P).__webglFramebuffer:null;Mt.bindFramebuffer(I.FRAMEBUFFER,Zt);const ie=I.fenceSync(I.SYNC_GPU_COMMANDS_COMPLETE,0);return I.flush(),await Jm(I,ie,4),I.bindBuffer(I.PIXEL_PACK_BUFFER,vt),I.getBufferSubData(I.PIXEL_PACK_BUFFER,0,tt),I.deleteBuffer(vt),I.deleteSync(ie),tt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(x,D=null,O=0){x.isTexture!==!0&&(Qr("WebGLRenderer: copyFramebufferToTexture function signature has changed."),D=arguments[0]||null,x=arguments[1]);const H=Math.pow(2,-O),R=Math.floor(x.image.width*H),tt=Math.floor(x.image.height*H),ct=D!==null?D.x:0,_t=D!==null?D.y:0;b.setTexture2D(x,0),I.copyTexSubImage2D(I.TEXTURE_2D,O,0,0,ct,_t,R,tt),Mt.unbindTexture()},this.copyTextureToTexture=function(x,D,O=null,H=null,R=0){x.isTexture!==!0&&(Qr("WebGLRenderer: copyTextureToTexture function signature has changed."),H=arguments[0]||null,x=arguments[1],D=arguments[2],R=arguments[3]||0,O=null);let tt,ct,_t,gt,Lt,Dt,vt,Zt,ie;const se=x.isCompressedTexture?x.mipmaps[R]:x.image;O!==null?(tt=O.max.x-O.min.x,ct=O.max.y-O.min.y,_t=O.isBox3?O.max.z-O.min.z:1,gt=O.min.x,Lt=O.min.y,Dt=O.isBox3?O.min.z:0):(tt=se.width,ct=se.height,_t=se.depth||1,gt=0,Lt=0,Dt=0),H!==null?(vt=H.x,Zt=H.y,ie=H.z):(vt=0,Zt=0,ie=0);const Ne=Ct.convert(D.format),Kt=Ct.convert(D.type);let xt;D.isData3DTexture?(b.setTexture3D(D,0),xt=I.TEXTURE_3D):D.isDataArrayTexture||D.isCompressedArrayTexture?(b.setTexture2DArray(D,0),xt=I.TEXTURE_2D_ARRAY):(b.setTexture2D(D,0),xt=I.TEXTURE_2D),I.pixelStorei(I.UNPACK_FLIP_Y_WEBGL,D.flipY),I.pixelStorei(I.UNPACK_PREMULTIPLY_ALPHA_WEBGL,D.premultiplyAlpha),I.pixelStorei(I.UNPACK_ALIGNMENT,D.unpackAlignment);const Mn=I.getParameter(I.UNPACK_ROW_LENGTH),jt=I.getParameter(I.UNPACK_IMAGE_HEIGHT),en=I.getParameter(I.UNPACK_SKIP_PIXELS),Ui=I.getParameter(I.UNPACK_SKIP_ROWS),ze=I.getParameter(I.UNPACK_SKIP_IMAGES);I.pixelStorei(I.UNPACK_ROW_LENGTH,se.width),I.pixelStorei(I.UNPACK_IMAGE_HEIGHT,se.height),I.pixelStorei(I.UNPACK_SKIP_PIXELS,gt),I.pixelStorei(I.UNPACK_SKIP_ROWS,Lt),I.pixelStorei(I.UNPACK_SKIP_IMAGES,Dt);const Nr=x.isDataArrayTexture||x.isData3DTexture,oe=D.isDataArrayTexture||D.isData3DTexture;if(x.isRenderTargetTexture||x.isDepthTexture){const mn=St.get(x),Ur=St.get(D),qe=St.get(mn.__renderTarget),Bn=St.get(Ur.__renderTarget);Mt.bindFramebuffer(I.READ_FRAMEBUFFER,qe.__webglFramebuffer),Mt.bindFramebuffer(I.DRAW_FRAMEBUFFER,Bn.__webglFramebuffer);for(let Hn=0;Hn<_t;Hn++)Nr&&I.framebufferTextureLayer(I.READ_FRAMEBUFFER,I.COLOR_ATTACHMENT0,St.get(x).__webglTexture,R,Dt+Hn),x.isDepthTexture?(oe&&I.framebufferTextureLayer(I.DRAW_FRAMEBUFFER,I.COLOR_ATTACHMENT0,St.get(D).__webglTexture,R,ie+Hn),I.blitFramebuffer(gt,Lt,tt,ct,vt,Zt,tt,ct,I.DEPTH_BUFFER_BIT,I.NEAREST)):oe?I.copyTexSubImage3D(xt,R,vt,Zt,ie+Hn,gt,Lt,tt,ct):I.copyTexSubImage2D(xt,R,vt,Zt,ie+Hn,gt,Lt,tt,ct);Mt.bindFramebuffer(I.READ_FRAMEBUFFER,null),Mt.bindFramebuffer(I.DRAW_FRAMEBUFFER,null)}else oe?x.isDataTexture||x.isData3DTexture?I.texSubImage3D(xt,R,vt,Zt,ie,tt,ct,_t,Ne,Kt,se.data):D.isCompressedArrayTexture?I.compressedTexSubImage3D(xt,R,vt,Zt,ie,tt,ct,_t,Ne,se.data):I.texSubImage3D(xt,R,vt,Zt,ie,tt,ct,_t,Ne,Kt,se):x.isDataTexture?I.texSubImage2D(I.TEXTURE_2D,R,vt,Zt,tt,ct,Ne,Kt,se.data):x.isCompressedTexture?I.compressedTexSubImage2D(I.TEXTURE_2D,R,vt,Zt,se.width,se.height,Ne,se.data):I.texSubImage2D(I.TEXTURE_2D,R,vt,Zt,tt,ct,Ne,Kt,se);I.pixelStorei(I.UNPACK_ROW_LENGTH,Mn),I.pixelStorei(I.UNPACK_IMAGE_HEIGHT,jt),I.pixelStorei(I.UNPACK_SKIP_PIXELS,en),I.pixelStorei(I.UNPACK_SKIP_ROWS,Ui),I.pixelStorei(I.UNPACK_SKIP_IMAGES,ze),R===0&&D.generateMipmaps&&I.generateMipmap(xt),Mt.unbindTexture()},this.copyTextureToTexture3D=function(x,D,O=null,H=null,R=0){return x.isTexture!==!0&&(Qr("WebGLRenderer: copyTextureToTexture3D function signature has changed."),O=arguments[0]||null,H=arguments[1]||null,x=arguments[2],D=arguments[3],R=arguments[4]||0),Qr('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(x,D,O,H,R)},this.initRenderTarget=function(x){St.get(x).__webglFramebuffer===void 0&&b.setupRenderTarget(x)},this.initTexture=function(x){x.isCubeTexture?b.setTextureCube(x,0):x.isData3DTexture?b.setTexture3D(x,0):x.isDataArrayTexture||x.isCompressedArrayTexture?b.setTexture2DArray(x,0):b.setTexture2D(x,0),Mt.unbindTexture()},this.resetState=function(){A=0,w=0,P=null,Mt.reset(),Ut.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Ln}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorspace=Yt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Yt._getUnpackColorSpace()}}class zc{constructor(t,e=1,i=1e3){this.isFog=!0,this.name="",this.color=new Vt(t),this.near=e,this.far=i}clone(){return new zc(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class fE extends Re{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Un,this.environmentIntensity=1,this.environmentRotation=new Un,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class dE{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=ql,this.updateRanges=[],this.version=0,this.uuid=Pn()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,i){t*=this.stride,i*=e.stride;for(let r=0,s=this.stride;r<s;r++)this.array[t+r]=e.array[i+r];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Pn()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),i=new this.constructor(e,this.stride);return i.setUsage(this.usage),i}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Pn()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const Le=new B;class Fo{constructor(t,e,i,r=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=i,this.normalized=r}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,i=this.data.count;e<i;e++)Le.fromBufferAttribute(this,e),Le.applyMatrix4(t),this.setXYZ(e,Le.x,Le.y,Le.z);return this}applyNormalMatrix(t){for(let e=0,i=this.count;e<i;e++)Le.fromBufferAttribute(this,e),Le.applyNormalMatrix(t),this.setXYZ(e,Le.x,Le.y,Le.z);return this}transformDirection(t){for(let e=0,i=this.count;e<i;e++)Le.fromBufferAttribute(this,e),Le.transformDirection(t),this.setXYZ(e,Le.x,Le.y,Le.z);return this}getComponent(t,e){let i=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(i=ln(i,this.array)),i}setComponent(t,e,i){return this.normalized&&(i=te(i,this.array)),this.data.array[t*this.data.stride+this.offset+e]=i,this}setX(t,e){return this.normalized&&(e=te(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=te(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=te(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=te(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=ln(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=ln(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=ln(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=ln(e,this.array)),e}setXY(t,e,i){return t=t*this.data.stride+this.offset,this.normalized&&(e=te(e,this.array),i=te(i,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=i,this}setXYZ(t,e,i,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=te(e,this.array),i=te(i,this.array),r=te(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=i,this.data.array[t+2]=r,this}setXYZW(t,e,i,r,s){return t=t*this.data.stride+this.offset,this.normalized&&(e=te(e,this.array),i=te(i,this.array),r=te(r,this.array),s=te(s,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=i,this.data.array[t+2]=r,this.data.array[t+3]=s,this}clone(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let i=0;i<this.count;i++){const r=i*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)e.push(this.data.array[r+s])}return new Ce(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new Fo(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let i=0;i<this.count;i++){const r=i*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)e.push(this.data.array[r+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class Li extends Cr{static get type(){return"SpriteMaterial"}constructor(t){super(),this.isSpriteMaterial=!0,this.color=new Vt(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}let Ki;const zr=new B,ji=new B,Ji=new B,Qi=new Wt,kr=new Wt,Lh=new ae,$s=new B,Gr=new B,Ks=new B,af=new Wt,wa=new Wt,lf=new Wt;class Pr extends Re{constructor(t=new Li){if(super(),this.isSprite=!0,this.type="Sprite",Ki===void 0){Ki=new hn;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),i=new dE(e,5);Ki.setIndex([0,1,2,0,2,3]),Ki.setAttribute("position",new Fo(i,3,0,!1)),Ki.setAttribute("uv",new Fo(i,2,3,!1))}this.geometry=Ki,this.material=t,this.center=new Wt(.5,.5)}raycast(t,e){t.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),ji.setFromMatrixScale(this.matrixWorld),Lh.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),Ji.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&ji.multiplyScalar(-Ji.z);const i=this.material.rotation;let r,s;i!==0&&(s=Math.cos(i),r=Math.sin(i));const o=this.center;js($s.set(-.5,-.5,0),Ji,o,ji,r,s),js(Gr.set(.5,-.5,0),Ji,o,ji,r,s),js(Ks.set(.5,.5,0),Ji,o,ji,r,s),af.set(0,0),wa.set(1,0),lf.set(1,1);let a=t.ray.intersectTriangle($s,Gr,Ks,!1,zr);if(a===null&&(js(Gr.set(-.5,.5,0),Ji,o,ji,r,s),wa.set(0,1),a=t.ray.intersectTriangle($s,Ks,Gr,!1,zr),a===null))return;const l=t.ray.origin.distanceTo(zr);l<t.near||l>t.far||e.push({distance:l,point:zr.clone(),uv:Je.getInterpolation(zr,$s,Gr,Ks,af,wa,lf,new Wt),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}function js(n,t,e,i,r,s){Qi.subVectors(n,e).addScalar(.5).multiply(i),r!==void 0?(kr.x=s*Qi.x-r*Qi.y,kr.y=r*Qi.x+s*Qi.y):kr.copy(Qi),n.copy(t),n.x+=kr.x,n.y+=kr.y,n.applyMatrix4(Lh)}class hE extends ye{constructor(t=null,e=1,i=1,r,s,o,a,l,c=Xe,u=Xe,d,h){super(null,o,a,l,c,u,r,s,d,h),this.isDataTexture=!0,this.image={data:t,width:e,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class cf extends Ce{constructor(t,e,i,r=1){super(t,e,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const tr=new ae,uf=new ae,Js=[],ff=new Ci,pE=new ae,Vr=new ue,Wr=new Rr;class mE extends ue{constructor(t,e,i){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new cf(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<i;r++)this.setMatrixAt(r,pE)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new Ci),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<e;i++)this.getMatrixAt(i,tr),ff.copy(t.boundingBox).applyMatrix4(tr),this.boundingBox.union(ff)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new Rr),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<e;i++)this.getMatrixAt(i,tr),Wr.copy(t.boundingSphere).applyMatrix4(tr),this.boundingSphere.union(Wr)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){const i=e.morphTargetInfluences,r=this.morphTexture.source.data.data,s=i.length+1,o=t*s+1;for(let a=0;a<i.length;a++)i[a]=r[o+a]}raycast(t,e){const i=this.matrixWorld,r=this.count;if(Vr.geometry=this.geometry,Vr.material=this.material,Vr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Wr.copy(this.boundingSphere),Wr.applyMatrix4(i),t.ray.intersectsSphere(Wr)!==!1))for(let s=0;s<r;s++){this.getMatrixAt(s,tr),uf.multiplyMatrices(i,tr),Vr.matrixWorld=uf,Vr.raycast(t,Js);for(let o=0,a=Js.length;o<a;o++){const l=Js[o];l.instanceId=s,l.object=this,e.push(l)}Js.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new cf(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){const i=e.morphTargetInfluences,r=i.length+1;this.morphTexture===null&&(this.morphTexture=new hE(new Float32Array(r*this.count),r,this.count,Nc,xn));const s=this.morphTexture.source.data.data;let o=0;for(let c=0;c<i.length;c++)o+=i[c];const a=this.geometry.morphTargetsRelative?1:1-o,l=r*t;s[l]=a,s.set(i,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}class Ph extends Cr{static get type(){return"PointsMaterial"}constructor(t){super(),this.isPointsMaterial=!0,this.color=new Vt(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}const df=new ae,$l=new mh,Qs=new Rr,to=new B;class _E extends Re{constructor(t=new hn,e=new Ph){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){const i=this.geometry,r=this.matrixWorld,s=t.params.Points.threshold,o=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Qs.copy(i.boundingSphere),Qs.applyMatrix4(r),Qs.radius+=s,t.ray.intersectsSphere(Qs)===!1)return;df.copy(r).invert(),$l.copy(t.ray).applyMatrix4(df);const a=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=i.index,d=i.attributes.position;if(c!==null){const h=Math.max(0,o.start),m=Math.min(c.count,o.start+o.count);for(let g=h,_=m;g<_;g++){const p=c.getX(g);to.fromBufferAttribute(d,p),hf(to,p,l,r,t,e,this)}}else{const h=Math.max(0,o.start),m=Math.min(d.count,o.start+o.count);for(let g=h,_=m;g<_;g++)to.fromBufferAttribute(d,g),hf(to,g,l,r,t,e,this)}}updateMorphTargets(){const e=this.geometry.morphAttributes,i=Object.keys(e);if(i.length>0){const r=e[i[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=r.length;s<o;s++){const a=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}}function hf(n,t,e,i,r,s,o){const a=$l.distanceSqToPoint(n);if(a<e){const l=new B;$l.closestPointToPoint(n,l),l.applyMatrix4(i);const c=r.ray.origin.distanceTo(l);if(c<r.near||c>r.far)return;s.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}class kc extends ye{constructor(t,e,i,r,s,o,a,l,c){super(t,e,i,r,s,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}const pf={enabled:!1,files:{},add:function(n,t){this.enabled!==!1&&(this.files[n]=t)},get:function(n){if(this.enabled!==!1)return this.files[n]},remove:function(n){delete this.files[n]},clear:function(){this.files={}}};class gE{constructor(t,e,i){const r=this;let s=!1,o=0,a=0,l;const c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=i,this.itemStart=function(u){a++,s===!1&&r.onStart!==void 0&&r.onStart(u,o,a),s=!0},this.itemEnd=function(u){o++,r.onProgress!==void 0&&r.onProgress(u,o,a),o===a&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(u){r.onError!==void 0&&r.onError(u)},this.resolveURL=function(u){return l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,d){return c.push(u,d),this},this.removeHandler=function(u){const d=c.indexOf(u);return d!==-1&&c.splice(d,2),this},this.getHandler=function(u){for(let d=0,h=c.length;d<h;d+=2){const m=c[d],g=c[d+1];if(m.global&&(m.lastIndex=0),m.test(u))return g}return null}}}const vE=new gE;class Gc{constructor(t){this.manager=t!==void 0?t:vE,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(t,e){const i=this;return new Promise(function(r,s){i.load(t,r,e,s)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}}Gc.DEFAULT_MATERIAL_NAME="__DEFAULT";class xE extends Gc{constructor(t){super(t)}load(t,e,i,r){this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);const s=this,o=pf.get(t);if(o!==void 0)return s.manager.itemStart(t),setTimeout(function(){e&&e(o),s.manager.itemEnd(t)},0),o;const a=gs("img");function l(){u(),pf.add(t,this),e&&e(this),s.manager.itemEnd(t)}function c(d){u(),r&&r(d),s.manager.itemError(t),s.manager.itemEnd(t)}function u(){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1)}return a.addEventListener("load",l,!1),a.addEventListener("error",c,!1),t.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),s.manager.itemStart(t),a.src=t,a}}class EE extends Gc{constructor(t){super(t)}load(t,e,i,r){const s=new ye,o=new xE(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(t,function(a){s.image=a,s.needsUpdate=!0,e!==void 0&&e(s)},i,r),s}}class SE{constructor(t=!0){this.autoStart=t,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=mf(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let t=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const e=mf();t=(e-this.oldTime)/1e3,this.oldTime=e,this.elapsedTime+=t}return t}}function mf(){return performance.now()}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Lc}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Lc);const ME="/assets/barricade-eOe1CG1w.webp",yE="/assets/coin_bonus-CnCdInxy.webp",TE="/assets/coin_common-T-B0nAe6.webp",bE="/assets/facade_a-D5NB2O2e.webp",AE="/assets/facade_b-pfAOa5D3.webp",wE="/assets/facade_c1-BiQsoOY8.webp",RE="/assets/facade_c2-DRB9_t7v.webp",CE="/assets/facade_c3-Ckgd_vfq.webp",LE="/assets/facade_c4-DgOundCk.webp",PE="/assets/facade_f1-BpVlnVAz.webp",IE="/assets/facade_f2-mpniaNnO.webp",DE="/assets/facade_h1-wP-Lz1Wk.webp",NE="/assets/facade_h2-CUlrwNey.webp",UE="/assets/facade_r1-BZD17MwD.webp",OE="/assets/facade_r2-BtV6_-E1.webp",FE="/assets/facade_s1-BuiMr6kj.webp",BE="/assets/facade_s2-DLD8xQii.webp",HE="/assets/facade_sp1-BPxTSzCO.webp",zE="/assets/facade_sp2-DWC41VbF.webp",kE="/assets/facade_w1-DBS0tVz9.webp",GE="/assets/facade_w2-tCpWTzIy.webp",VE="/assets/facade_wb1-BqR1Uc8-.webp",WE="/assets/facade_wb2-CMUw13B1.webp",XE="/assets/foot_soldier_0-BipYUmFZ.webp",YE="/assets/foot_soldier_nunchaku-BzJ395Fd.webp",qE="/assets/foot_soldier_staff-BIpvZHSC.webp",ZE="/assets/foot_soldier_sword-Bda3bSv2.webp",$E="/assets/gobalance_horizontal_board-BPrIEOfe.webp",KE="/assets/lc_curtain_left-CGlaQsE6.webp",jE="/assets/lc_curtain_right-gkFNC6bS.webp",JE="/assets/leo_jump_0-DO8MTu-H.webp",QE="/assets/leo_jump_1-d4Ju7ZyQ.webp",tS="/assets/leo_jump_2-B06TsC2Z.webp",eS="/assets/leo_jump_3-CXA4VkFH.webp",nS="/assets/leo_lunge_0-Cguz2exw.webp",iS="/assets/leo_lunge_1-htS8sxGG.webp",rS="/assets/leo_lunge_2-Cq1VeKM7.webp",sS="/assets/leo_lunge_3-DelgNLF3.webp",oS="/assets/leo_run_0-DXX5uTr6.webp",aS="/assets/leo_run_1-B7Y9FlOd.webp",lS="/assets/leo_run_2-8NFH_E1W.webp",cS="/assets/leo_run_3-DeMKJWJ4.webp",uS="/assets/leo_run_4-w_0g-YCq.webp",fS="/assets/leo_run_5-Bv04EM6X.webp",dS="/assets/leo_spin_0-BtXVZeeB.webp",hS="/assets/leo_spin_1-zCHxyKya.webp",pS="/assets/leo_spin_2-DUnUmiRj.webp",mS="/assets/leo_spin_3-CJssGHis.webp",_S="/assets/leo_turn_0-CVXQvjf5.webp",gS="/assets/leo_turn_1-Bl46zK6z.webp",vS="/assets/leo_turn_2-CwqKqR5a.webp",xS="/assets/leo_turn_3-B1lJOG7v.webp",ES="/assets/pickup_life-xHEk8uBz.webp",SS="/assets/pickup_magnet-CdVCzBWy.webp",MS="/assets/platform_box-CJkSDGWJ.webp",yS="/assets/platform_ramp-BJUW9Btu.webp",TS="/assets/ribbon_0-dxBYZlZg.webp",bS="/assets/ribbon_1-DcGHOyK_.webp",AS="/assets/ribbon_2-CFotheSZ.webp",wS="/assets/ribbon_3-CfNo2hHd.webp",RS="/assets/ribbon_4-JQ2KyLSw.webp",CS="/assets/skyline-BX-680JX.webp",LS="/assets/skyline_forest-DmVjwbz7.webp",PS="/assets/skyline_harbor-HGEHqTED.webp",IS="/assets/skyline_rooftop-BqnW71sy.webp",DS="/assets/skyline_space-DUfssol5.webp",NS="/assets/skyline_subway-D_SPl5s3.webp",US="/assets/skyline_sunny-CDcO2g92.webp",OS="/assets/skyline_warehouse-C08jFTkG.webp",FS="/assets/skyline_warehouse_roof-Cllu5bB-.webp",BS="/assets/street_forest-ElP1oNFT.webp",HS="/assets/street_harbor-BamNiAfL.webp",zS="/assets/street_rooftop-zuRNRCM_.webp",kS="/assets/street_space-DVXjwpWV.webp",GS="/assets/street_subway-DvmznPOD.webp",VS="/assets/street_tex-BrekuArd.webp",WS="/assets/street_warehouse-BNA9PVLc.webp",Ts=n=>new URL(Object.assign({"../assets/tmnt/barricade.webp":ME,"../assets/tmnt/coin_bonus.webp":yE,"../assets/tmnt/coin_common.webp":TE,"../assets/tmnt/facade_a.webp":bE,"../assets/tmnt/facade_b.webp":AE,"../assets/tmnt/facade_c1.webp":wE,"../assets/tmnt/facade_c2.webp":RE,"../assets/tmnt/facade_c3.webp":CE,"../assets/tmnt/facade_c4.webp":LE,"../assets/tmnt/facade_f1.webp":PE,"../assets/tmnt/facade_f2.webp":IE,"../assets/tmnt/facade_h1.webp":DE,"../assets/tmnt/facade_h2.webp":NE,"../assets/tmnt/facade_r1.webp":UE,"../assets/tmnt/facade_r2.webp":OE,"../assets/tmnt/facade_s1.webp":FE,"../assets/tmnt/facade_s2.webp":BE,"../assets/tmnt/facade_sp1.webp":HE,"../assets/tmnt/facade_sp2.webp":zE,"../assets/tmnt/facade_w1.webp":kE,"../assets/tmnt/facade_w2.webp":GE,"../assets/tmnt/facade_wb1.webp":VE,"../assets/tmnt/facade_wb2.webp":WE,"../assets/tmnt/foot_soldier_0.webp":XE,"../assets/tmnt/foot_soldier_nunchaku.webp":YE,"../assets/tmnt/foot_soldier_staff.webp":qE,"../assets/tmnt/foot_soldier_sword.webp":ZE,"../assets/tmnt/gobalance_horizontal_board.webp":$E,"../assets/tmnt/lc_curtain_left.webp":KE,"../assets/tmnt/lc_curtain_right.webp":jE,"../assets/tmnt/leo_jump_0.webp":JE,"../assets/tmnt/leo_jump_1.webp":QE,"../assets/tmnt/leo_jump_2.webp":tS,"../assets/tmnt/leo_jump_3.webp":eS,"../assets/tmnt/leo_lunge_0.webp":nS,"../assets/tmnt/leo_lunge_1.webp":iS,"../assets/tmnt/leo_lunge_2.webp":rS,"../assets/tmnt/leo_lunge_3.webp":sS,"../assets/tmnt/leo_run_0.webp":oS,"../assets/tmnt/leo_run_1.webp":aS,"../assets/tmnt/leo_run_2.webp":lS,"../assets/tmnt/leo_run_3.webp":cS,"../assets/tmnt/leo_run_4.webp":uS,"../assets/tmnt/leo_run_5.webp":fS,"../assets/tmnt/leo_spin_0.webp":dS,"../assets/tmnt/leo_spin_1.webp":hS,"../assets/tmnt/leo_spin_2.webp":pS,"../assets/tmnt/leo_spin_3.webp":mS,"../assets/tmnt/leo_turn_0.webp":_S,"../assets/tmnt/leo_turn_1.webp":gS,"../assets/tmnt/leo_turn_2.webp":vS,"../assets/tmnt/leo_turn_3.webp":xS,"../assets/tmnt/pickup_life.webp":ES,"../assets/tmnt/pickup_magnet.webp":SS,"../assets/tmnt/platform_box.webp":MS,"../assets/tmnt/platform_ramp.webp":yS,"../assets/tmnt/ribbon_0.webp":TS,"../assets/tmnt/ribbon_1.webp":bS,"../assets/tmnt/ribbon_2.webp":AS,"../assets/tmnt/ribbon_3.webp":wS,"../assets/tmnt/ribbon_4.webp":RS,"../assets/tmnt/skyline.webp":CS,"../assets/tmnt/skyline_forest.webp":LS,"../assets/tmnt/skyline_harbor.webp":PS,"../assets/tmnt/skyline_rooftop.webp":IS,"../assets/tmnt/skyline_space.webp":DS,"../assets/tmnt/skyline_subway.webp":NS,"../assets/tmnt/skyline_sunny.webp":US,"../assets/tmnt/skyline_warehouse.webp":OS,"../assets/tmnt/skyline_warehouse_roof.webp":FS,"../assets/tmnt/street_forest.webp":BS,"../assets/tmnt/street_harbor.webp":HS,"../assets/tmnt/street_rooftop.webp":zS,"../assets/tmnt/street_space.webp":kS,"../assets/tmnt/street_subway.webp":GS,"../assets/tmnt/street_tex.webp":VS,"../assets/tmnt/street_warehouse.webp":WS})[`../assets/tmnt/${n}`],import.meta.url).href,XS=[{file:"leo_run_0.webp",holdUnits:1,yOffset:-.15,xOffset:0},{file:"leo_run_1.webp",holdUnits:1,yOffset:0,xOffset:.15},{file:"leo_run_2.webp",holdUnits:1,yOffset:-.15,xOffset:0},{file:"leo_run_3.webp",holdUnits:1,yOffset:0,xOffset:-.15}],YS=["leo_jump_0.webp","leo_jump_0.webp","leo_run_1.webp"],qS=760/800;function Zo(){return typeof window<"u"&&window.GoBalance?window.GoBalance:null}const Kl=12;function Bo(){const n=Zo();return!!(n&&typeof n.getMaxAngle=="function")}function Ih(){const n=Zo();return!n||typeof n.getMaxAngle!="function"?Promise.resolve(null):Promise.resolve(n.getMaxAngle()).catch(()=>null)}function Dh(n){const t=Zo();return!t||typeof t.setMaxAngle!="function"?Promise.resolve(null):Promise.resolve(t.setMaxAngle(Math.round(n))).catch(()=>null)}function _f(n){const t=Zo();return!t||typeof t.setMaxAngleSession!="function"?Promise.resolve(null):Promise.resolve(t.setMaxAngleSession(Math.round(n))).catch(()=>null)}function ZS(n,t){if(!n.length)return 0;const e=n.slice().sort((r,s)=>r-s),i=Math.min(e.length-1,Math.max(0,Math.round(t*(e.length-1))));return e[i]}const wo=45,$S=.92,KS=3,gf=1e3,jS=450,JS=1,QS=6e3,tM=16,eM=2e4,nM=6,iM=30;function vf(n,{onTilt:t,onGateOpen:e,onGateClose:i,onHoldStart:r,onHoldProgress:s,isCancelled:o}={}){const a=KS/wo,l=JS/wo,c=n>0?.9:.1,u=(d,h)=>n>0?d>h:d<h;return new Promise(d=>{const h=[];let m=!1,g=0,_=!1,p=0,f=0,T=0;const y=performance.now(),E=A=>{if(clearInterval(N),A==="cancelled"){d(null);return}if(A==="timeout"){d("timeout");return}const w=h.length?ZS(h,c):0;d(w*wo)},N=setInterval(()=>{if(o&&o()){E("cancelled");return}const A=window.__gbSensor,w=A?A.x:0;t&&t(w);const P=performance.now(),M=n>0?w>a:w<-a;if(!m){if(M)m=!0,g=P,_=!1,f=w,T=P,h.length=0,e&&e();else if(P-y>=eM){E("timeout");return}return}if(!M){m=!1,_=!1,h.length=0,i&&i();return}if(!_){u(w,f+n*l)&&(f=w,T=P),(P-T>=jS||P-g>=QS)&&(_=!0,p=P,h.length=0,r&&r());return}if(u(w,f+n*l)){_=!1,f=w,T=P,h.length=0,e&&e();return}h.push(w),s&&s(Math.min(1,(P-p)/gf)),P-p>=gf&&E("done")},tM)})}async function rM({onPhase:n,onTilt:t,onGateOpen:e,onGateClose:i,onHoldStart:r,onHoldProgress:s,isCancelled:o}={}){const a=p=>{n&&n(p)},l=p=>({onTilt:f=>{t&&t(f,p)},onGateOpen:()=>{e&&e(p)},onGateClose:()=>{i&&i(p)},onHoldStart:()=>{r&&r(p)},onHoldProgress:f=>{s&&s(f,p)},isCancelled:o}),c=await Ih();async function u(p){return c&&await _f(c.value),{cancelled:!0,reason:p}}if(await _f(wo),o&&o())return u("cancelled");a("right");const d=await vf(1,l("right"));if(d===null)return u("cancelled");if(d==="timeout")return u("timeout");a("left");const h=await vf(-1,l("left"));if(h===null)return u("cancelled");if(h==="timeout")return u("timeout");const m=(d-h)/2,g=m*$S;if(g<nM||g>iM)return{...await u("implausible"),computed:g};a("done");const _=await Dh(g);return jl=Date.now(),{rightDeg:d,leftDeg:h,reach:m,computed:g,applied:_}}let jl=0;function sM(){return jl?Date.now()-jl:1/0}if(typeof window<"u"&&!window.GoBalance){const n={left:!1,right:!1};window.addEventListener("keydown",o=>{o.code==="ArrowLeft"?n.left=!0:o.code==="ArrowRight"&&(n.right=!0)}),window.addEventListener("keyup",o=>{o.code==="ArrowLeft"?n.left=!1:o.code==="ArrowRight"&&(n.right=!1)});const t=.4;window.__gbSensor=window.__gbSensor||{x:0,y:0};const e=()=>{const o=(n.right?t:0)-(n.left?t:0);window.__gbSensor.x+=(o-window.__gbSensor.x)*.08,requestAnimationFrame(e)};requestAnimationFrame(e);const i={value:Kl,default:Kl,min:5,max:45},r=o=>Math.max(i.min,Math.min(i.max,Math.round(o))),s=()=>Promise.resolve({...i});window.GoBalance={getMaxAngle:()=>s(),setMaxAngle:o=>(i.value=r(o),s()),setMaxAngleSession:o=>(i.value=r(o),s())},console.log("[dev] mock GoBalance.getMaxAngle/setMaxAngle/setMaxAngleSession + keyboard sensor installed (browser only) -- hold ArrowLeft/ArrowRight to lean.")}const yr=3.2,le=[-yr,0,yr],We=1,Sn=0,Tr=14.4,Ri=10.08,Dn=45,xf=15,oM=.22,aM=.3,Ef=.44,Ra=26,lM=.5,cM=20,Vc=5,Nh=5,uM=1.2,fM=7,Sf=26,dM=.45,hM=6,pM=.15,mM=2,Wc="stepped",$o="absolute",Uh=[Wc,$o],Oh=Wc,Fh=.35,Bh=.12,Hh=.45,_M=.15,gM=.34,vM=.5,lr=.28,Jl=.1265,zh=.4065,Ro=2.4,xM=.3,Pi=-140,Ir=12,Xc=1.5,EM=.1,kh=1.9,Gh=4.6,SM=-10,MM=1.85,yM=58,eo=16,no=9,TM=new EE,Ca=new Map;function Se(n){if(!n)return null;if(Ca.has(n))return Ca.get(n);const t=TM.load(n);return t.colorSpace=Ve,Ca.set(n,t),t}function At(n,t,e){return{url:Ts(n),w:t,h:e,aspect:e/t}}const Mf=At("barricade.webp",640,585),bM=At("coin_common.webp",506,512),AM=At("coin_bonus.webp",512,512),wM=At("pickup_magnet.webp",458,512),RM=At("pickup_life.webp",512,450),yf=At("platform_box.webp",640,640),CM=At("platform_ramp.webp",480,640),LM=At("foot_soldier_0.webp",2028,2028),PM=At("foot_soldier_sword.webp",2028,2028),IM=At("foot_soldier_nunchaku.webp",2028,2028),DM=At("foot_soldier_staff.webp",2028,2028),NM={sunnyStreet:{street:At("street_tex.webp",576,768),facades:[{tex:At("facade_a.webp",1342,1514),bodyColor:9790029},{tex:At("facade_b.webp",1304,1517),bodyColor:9794887}],skyline:At("skyline_sunny.webp",3168,1344),buildingProfile:{widthCycle:[6,7,8],depth:8,heightBase:8,heightMod:10,heightSideOffset:13,count:42,gapMin:1,gapRange:6,leftGapStride:7,leftGapOffset:0,rightGapStride:11,rightGapOffset:3}},centralCity:{street:At("street_tex.webp",576,768),facades:[{tex:At("facade_c1.webp",2048,2048),bodyColor:8938069},{tex:At("facade_c2.webp",2048,2048),bodyColor:9864553},{tex:At("facade_c3.webp",1052,1350),bodyColor:7303794},{tex:At("facade_c4.webp",1243,1351),bodyColor:5986640}],skyline:At("skyline.webp",1600,906),buildingProfile:{widthCycle:[12,17,22,15,19],depth:13,heightBase:11,heightMod:13,heightSideOffset:17,count:18,gapMin:1,gapRange:6,leftGapStride:7,leftGapOffset:0,rightGapStride:11,rightGapOffset:3}},harborDocks:{street:At("street_harbor.webp",1792,2400),skyline:At("skyline_harbor.webp",3136,1344),facades:[{tex:At("facade_h1.webp",2048,2048),bodyColor:6911084},{tex:At("facade_h2.webp",2048,2048),bodyColor:9144452}],buildingProfile:{widthCycle:[18,26,15,22,20],depth:14,heightBase:8,heightMod:7,heightSideOffset:11,count:16,gapMin:1,gapRange:9,leftGapStride:7,leftGapOffset:0,rightGapStride:11,rightGapOffset:3}},subwayPlatform:{street:At("street_subway.webp",1792,2400),skyline:At("skyline_subway.webp",2752,1536),facades:[{tex:At("facade_s1.webp",1316,1438),bodyColor:6188376},{tex:At("facade_s2.webp",1316,1438),bodyColor:7499872}],buildingProfile:{widthCycle:[16,20,14,18,22],depth:11,heightBase:6,heightMod:4,heightSideOffset:5,count:16,gapMin:1,gapRange:6,leftGapStride:7,leftGapOffset:0,rightGapStride:11,rightGapOffset:3}},rooftopBridge:{street:At("street_rooftop.webp",1792,2400),skyline:At("skyline_rooftop.webp",2752,1521),facades:[{tex:At("facade_r1.webp",1324,1481),bodyColor:6322555},{tex:At("facade_r2.webp",1428,1536),bodyColor:7833485}],buildingProfile:{widthCycle:[14,20,11,17,15],depth:12,heightBase:9,heightMod:8,heightSideOffset:13,count:18,gapMin:1,gapRange:7,leftGapStride:7,leftGapOffset:0,rightGapStride:11,rightGapOffset:3}},funkyForest:{street:At("street_forest.webp",1792,2400),skyline:At("skyline_forest.webp",3168,1344),facades:[{tex:At("facade_f1.webp",1722,1130),bodyColor:11565630},{tex:At("facade_f2.webp",1722,1130),bodyColor:9209982}],buildingProfile:{widthCycle:[12,17,10,20,14],depth:11,heightBase:26,heightMod:24,heightSideOffset:20,count:18,gapMin:1,gapRange:8,leftGapStride:7,leftGapOffset:0,rightGapStride:11,rightGapOffset:3}},warehouse:{street:At("street_warehouse.webp",1792,2400),skyline:At("skyline_warehouse.webp",2048,868),facades:[{tex:At("facade_w1.webp",1780,1188),bodyColor:9410464},{tex:At("facade_w2.webp",1780,1188),bodyColor:14206106}],buildingProfile:{widthCycle:[20,28,17,24,22],depth:15,heightBase:10,heightMod:8,heightSideOffset:9,count:16,gapMin:1,gapRange:6,leftGapStride:7,leftGapOffset:0,rightGapStride:11,rightGapOffset:3}},warehouseRoof:{street:At("street_warehouse.webp",1792,2400),skyline:At("skyline_warehouse_roof.webp",3168,1344),facades:[{tex:At("facade_wb1.webp",2036,1012),bodyColor:10134444},{tex:At("facade_wb2.webp",2036,1012),bodyColor:11570270}],buildingProfile:{widthCycle:[20,28,17,24,22],depth:15,heightBase:10,heightMod:8,heightSideOffset:9,count:16,gapMin:1,gapRange:6,leftGapStride:7,leftGapOffset:0,rightGapStride:11,rightGapOffset:3}},spaceCity:{street:At("street_space.webp",896,1200),skyline:At("skyline_space.webp",3168,1344),facades:[{tex:At("facade_sp1.webp",1792,1200),bodyColor:11187414},{tex:At("facade_sp2.webp",1792,1200),bodyColor:9407104}],buildingProfile:{widthCycle:[11,16,13,19,14],depth:13,heightBase:16,heightMod:14,heightSideOffset:12,count:18,gapMin:1,gapRange:6,leftGapStride:7,leftGapOffset:0,rightGapStride:11,rightGapOffset:3}}},ti=400,Co=-ti/2+20,Vh=yr*3,Wh=3.4,La=Vh+Wh*2,UM=Ir,OM=Vh/2+Wh+1.5,FM=14273197,Tf=260;function BM(n,t,e,i,r){const s=[];for(let o=0;o<n;o++)s.push(t+(o*i+r)%e);return s}function HM(n,t){const{count:e,widthCycle:i,heightBase:r,heightMod:s,heightSideOffset:o}=t,a=BM(e,t.gapMin,t.gapRange,n>0?t.rightGapStride:t.leftGapStride,n>0?t.rightGapOffset:t.leftGapOffset),l=[],c=[];for(let _=0;_<e;_++)l.push(i[_%i.length]),c.push(r+(_*37+(n>0?o:0))%s);const u=l.reduce((_,p)=>_+p,0),d=a.reduce((_,p)=>_+p,0),h=(ti-u)/d,m=[];let g=Co+ti/2;for(let _=0;_<e;_++){const p=l[_]+a[_]*h;m.push({width:l[_],height:c[_],z:g-p/2}),g-=p}return m}const zM=-195,bf=624,kM=60;function Pa(n,t,e){const i=Se(n.url).clone();i.needsUpdate=!0,i.wrapS=cn,i.wrapT=bi;const r=t*n.aspect;return i.repeat.set(1,e/r),new we({map:i})}function Ia(n,t="centralCity"){const e=NM[t];n.background=new Vt(9422824),n.fog=new zc(10474220,70,290);const i=new Mi,r=Se(e.skyline.url),s=new we({map:r,fog:!1}),o=bf*e.skyline.aspect,a=new ue(new fn(bf,o),s);a.position.set(0,kM,zM),i.add(a);const l=Se(e.street.url),c=La*e.street.aspect;l.wrapS=cn,l.wrapT=bi,l.repeat.set(1,ti/c);const u=new we({map:l}),d=new ue(new fn(La,ti),u);d.rotation.x=-Math.PI/2,d.position.set(0,0,Co),i.add(d);const h=new we({color:FM});for(const p of[-1,1]){const f=new ue(new fn(Tf,ti),h);f.rotation.x=-Math.PI/2,f.position.set(p*(La/2+Tf/2-1),-.01,Co),i.add(f)}const m=new we({color:16777215});for(const p of[-1,1]){const f=new ue(new fn(.14,ti),m);f.rotation.x=-Math.PI/2,f.position.set(p*yr*.5,.02,Co),i.add(f)}const g=e.buildingProfile,_=[];for(const p of[-1,1]){const f=HM(p,g);for(let T=0;T<g.count;T++){const{width:y,height:E,z:N}=f[T],A=g.depth,w=p*(OM+A/2),P=(T+(p>0?1:0))%e.facades.length,{tex:M,bodyColor:S}=e.facades[P],C=new Mi;C.position.set(w,0,N),i.add(C);const W=p>0?1:0,U=W===0?1:0,X=new we({color:S}),K=[null,null,X,X,null,null];K[W]=Pa(M,y,E),K[U]=X,K[4]=Pa(M,A,E),K[5]=Pa(M,A,E);const V=new ue(new On(A,E,y),K);V.position.set(0,E/2,0),C.add(V),_.push({slotGroup:C,z:N})}}return n.add(i),{group:i,buildingSlots:_,streetTexture:l,streetTileLength:c}}function Af(n,t){n.remove(t.group),t.group.traverse(e=>{if(e.geometry&&e.geometry.dispose(),e.material){const i=Array.isArray(e.material)?e.material:[e.material];for(const r of i)r&&r.dispose()}})}function GM(n,t,e){const i=e*t;for(const r of n.buildingSlots)r.z+=i,r.z>UM&&(r.z-=ti),r.slotGroup.position.z=r.z;n.streetTexture.offset.y+=i/n.streetTileLength}const VM=8;function WM(n){return n.position.set(le[We],kh,Gh),{camera:n,baseX:le[We],shake:0}}function XM(n){n.shake=0,n.baseX=le[We],n.camera.position.x=n.baseX}function YM(n,t){n.shake=Math.max(n.shake,t)}function qM(n,t,e=0,i=0){const{camera:r}=n;n.baseX+=(t-n.baseX)*EM,i>0&&n.shake>0&&(n.shake=Math.max(n.shake-VM*i,0));const s=i>0&&n.shake>0;r.position.x=n.baseX+(s?(Math.random()-.5)*n.shake:0),r.position.y=kh+e+(s?(Math.random()-.5)*n.shake:0),r.position.z=Gh,r.lookAt(n.baseX*.4,MM+e,SM)}const ZM=XS,$M=qS,on=ZM.map(({file:n,holdUnits:t,yOffset:e,xOffset:i})=>({url:Ts(n),holdUnits:t,yOffset:e,xOffset:i})),Ho=.09,Ql=[0,1,2].map(n=>({key:`run-reuse-${n}`,frameDuration:Ho,frames:on.map(t=>({url:t.url}))})),ls=YS.map(n=>({url:Ts(n)})),Qe=3.5,dn=10,Ei=30,KM=20,Xh=60,wf=2.1,jM=15,Yc=3,tc=1.9,Rf=4.5,JM=2,Cf=.9,Lf=0,QM=7.5,Pf=12,ty=3,If=10,ey=6,Yh=-50,ny=.5,iy=40,Df=.7,ry=3,Da=.5,Nf=.25,Uf=3,sy=5,oy=2.5,ay=[.07,.2,.5,.8,.93],Of=4,Ff=1.5,qc=1.1,Bf=.35,ly=.18,ec=1.1,cy=.16,Hf=.93,uy=.16,zf=11,fy=4,kf=10,dy=11,hy=.45,py=.09,nc=1.2,Gf=.5,my=13,Na=.85,_y=.26,gy=.16,vy=6,rr=yr*.85,Vf=n=>Math.max(0,Math.min(1,n)),Wf=n=>n*n*(3-2*n);function qh(n,t,e){const i=Se(n.url).clone();i.needsUpdate=!0,i.wrapS=cn,i.wrapT=bi;const r=t*n.aspect;return i.repeat.set(1,e/r),new we({map:i})}function xy(n,t,e){const i=Se(n.url).clone();i.needsUpdate=!0,i.wrapS=bi,i.wrapT=cn;const r=t/n.aspect;return i.repeat.set(e/r,1),new we({map:i})}function Xf(){const n=qh(CM,rr,dn);return n.side=an,n}const Ey=6370072,Yf=2.2,qf=1;function Sy(){return new we({color:657930,side:an})}function Zf(n,t,e){const i=n/2,r=new Float32Array([-i,0,0,i,0,0,-i,0,t,i,0,t,-i,e,t,i,e,t]),s=[0,1,3,0,3,2,2,3,5,2,5,4,0,4,5,0,5,1,0,2,4,1,3,5],o=new Float32Array([0,0,1,0,1,0,0,0,0,1,1,1]),a=new hn;return a.setAttribute("position",new Ce(r,3)),a.setAttribute("uv",new Ce(o,2)),a.setIndex(s),a.computeVertexNormals(),a}function $f(n){const t=new Mi;t.visible=!1;let e=0;if(n){const l=new ue(Zf(rr,dn,Qe),Xf());l.position.z=0,t.add(l),e=dn}else{const l=new ue(new On(rr,Yf,qf),Sy());l.position.set(0,Yf/2,-qf/2),t.add(l)}const i=e+Ei,r=qh(yf,rr,Ei),s=xy(yf,Qe,Ei),o=new we({color:Ey}),a=new ue(new On(rr,Qe,Ei),[s,s,r,o,o,o]);if(a.position.set(0,Qe/2,e+Ei/2),t.add(a),n){const l=new ue(Zf(rr,dn,Qe),Xf());l.scale.z=-1,l.position.z=i+dn,t.add(l)}return t}function My(n){const t=$f(!1),e=$f(!0);return n.add(t,e),{active:!1,type:"ramp",lane:1,entryStartZ:0,deckStartZ:0,deckEndZ:0,exitEndZ:0,cleared:!1,deckEnemyPlaced:!1,rampCoinsPlaced:!1,killGroup:t,rampGroup:e}}function yy(n){const t=[];for(let e=0;e<vy;e++)t.push(My(n));return{pool:t}}function Ty(n){for(const t of n.pool)t.active=!1,t.killGroup.visible=!1,t.rampGroup.visible=!1}function by(n,t){const i=t+dn+Ei;return{start:t,end:i+dn}}function Kf(n,t,e,i){const r=by(e,i);for(const s of n.pool)if(!(!s.active||s.lane!==t)&&r.start<s.exitEndZ+Pf&&r.end+Pf>s.entryStartZ)return!1;return!0}function jf(n,t,e=null,i=Pi){const r=n.pool.find(l=>!l.active);if(!r)return;let s;if(e!==null){if(!Kf(n,e,t,i))return;s=e}else{const l=[];for(let c=0;c<le.length;c++)l.push(c),c!==We&&l.push(c);for(let c=l.length-1;c>0;c--){const u=Math.floor(Math.random()*(c+1));[l[c],l[u]]=[l[u],l[c]]}if(s=l.find(c=>Kf(n,c,t,i)),s===void 0)return}r.active=!0,r.type=t,r.lane=s,r.entryStartZ=i,r.deckStartZ=i+dn,r.deckEndZ=r.deckStartZ+Ei,r.exitEndZ=r.deckEndZ+dn,r.cleared=!1,r.deckEnemyPlaced=!1,r.rampCoinsPlaced=!1;const o=r.rampGroup,a=r.killGroup;o.visible=!0,o.position.set(le[s],0,r.entryStartZ),a.visible=!1}function Ay(n,t,e){const i=e*t;for(const r of n.pool){if(!r.active)continue;r.entryStartZ+=i,r.deckStartZ+=i,r.deckEndZ+=i,r.exitEndZ+=i;const s=r.type==="kill"?r.killGroup:r.rampGroup;s.position.z=r.entryStartZ,r.entryStartZ>Ir&&(r.active=!1,r.killGroup.visible=!1,r.rampGroup.visible=!1)}}function Zc(n,t,e){for(const i of n.pool)if(!(!i.active||i.lane!==t)&&e>=i.entryStartZ&&e<=i.exitEndZ)return i;return null}function wy(n,t,e){const i=Zc(n,t,e);return!!i&&i.type==="ramp"}function zo(n,t,e){for(const i of n.pool)if(!(!i.active||i.lane!==t)&&e>=i.entryStartZ-If&&e<=i.exitEndZ+If)return!0;return!1}function Zh(n,t){const e=[];for(let i=0;i<le.length;i++)zo(n,i,t)||e.push(i);return e.length===0?null:e[Math.floor(Math.random()*e.length)]}function Ry(n,t,e){for(const i of n.pool)if(i.active&&t>=i.entryStartZ-e&&t<=i.exitEndZ+e)return!0;return!1}const Jf=3;function Cy(n){const t=[];for(const e of n.pool){if(!e.active||e.type!=="ramp"||e.deckEnemyPlaced)continue;const i=e.deckStartZ+Jf,r=e.deckEndZ-Jf;r<=i||r>=Yh||t.push({lane:e.lane,z:i+Math.random()*(r-i),claim:()=>{e.deckEnemyPlaced=!0}})}return t}function Ly(n){const t=[];for(const e of n.pool){if(!e.active||e.type!=="ramp"||e.rampCoinsPlaced)continue;const i=()=>{e.rampCoinsPlaced=!0},r=[[e.entryStartZ,e.deckStartZ],[e.deckEndZ,e.exitEndZ]];for(const[s,o]of r)o>=Yh||t.push({lane:e.lane,startZ:s,endZ:o,claim:i})}return t}function si(n,t,e){const i=Zc(n,t,e);return!i||e>=i.exitEndZ?0:e<i.deckStartZ?i.type==="kill"?0:Wf(Vf((e-i.entryStartZ)/dn)):e<i.deckEndZ?1:1-Wf(Vf((e-i.deckEndZ)/dn))}function Py(n,t,e,i){const r=Zc(n,t,e);return!r||e>=r.exitEndZ?0:r.type==="ramp"?si(n,t,e):e>=r.deckEndZ?0:(i&&(r.cleared=!0),r.cleared?si(n,t,e):0)}const Iy=.5;function Dy(n,t,e,i){return si(n,t,e)*Qe>i+Iy}function Ny(n,t,e){if(!e)return null;for(const i of t.pool)if(!(!i.active||i.type!=="kill"||i.lane!==n.laneIndex)&&!(Math.abs(i.entryStartZ-Sn)>Xc))return i;return null}function Uy(n){n.cleared=!0}Ql.forEach(n=>n.frames.forEach(t=>Se(t.url)));ls.forEach(n=>Se(n.url));const Oy=.88,$h=2.4*Oy,$c=$h*$M,cr=$c/2,Qf=.22,Kc=$c,Kh=lr+Jl+zh;function jh(n){if(n<lr){const e=n/lr;return Ro*(1-(1-e)*(1-e))}if(n<lr+Jl)return Ro;const t=Math.min((n-lr-Jl)/zh,1);return Ro*(1-t*t*t)}function Fy(n){return n.map(t=>{const e=t*Kh;return{elapsed:e,height:jh(e)}})}function By(){const n=new Li({map:Se(on[0].url),transparent:!0}),t=new Pr(n);return t.scale.set($h,$c,1),t.position.set(le[We],cr,Sn),{sprite:t,laneIndex:We,targetLane:We,laneX:le[We],frameIndex:0,frameTimer:0,jumpElapsed:null,jumpFrameIndex:-1,magnetTimer:0,nudgeOffset:0,airHeight:0,elevationY:0,elevationVelocity:0,attacking:!1,attackSequence:null,attackFrameIndex:0,attackTimer:0}}function Hy(n){n.laneIndex=We,n.targetLane=We,n.laneX=le[We],n.frameIndex=0,n.frameTimer=0,n.jumpElapsed=null,n.jumpFrameIndex=-1,n.magnetTimer=0,n.nudgeOffset=0,n.airHeight=0,n.elevationY=0,n.elevationVelocity=0,n.attacking=!1,n.attackSequence=null,n.attackFrameIndex=0,n.attackTimer=0,n.sprite.material.map=Se(on[0].url),n.sprite.position.x=le[We],n.sprite.position.y=cr,n.sprite.material.rotation=0,n.sprite.visible=!0}function zy(n,t){n.targetLane=t,n.laneIndex=t}function Ua(n,t){n.sprite.visible=t}function ky(n,t){n.nudgeOffset=t*gM}function td(n){n.magnetTimer=fM}function Gy(n){return n.magnetTimer>0}function Vy(n){n.jumpElapsed===null&&(n.jumpElapsed=0)}function Wy(n,t=0){if(n.attacking||n.jumpElapsed!==null)return;const e=Ql[t%Ql.length];n.attacking=!0,n.attackSequence=e,n.attackFrameIndex=0,n.attackTimer=0,n.sprite.material.map=Se(e.frames[0].url)}function Xy(n,t,e){n.magnetTimer>0&&(n.magnetTimer=Math.max(0,n.magnetTimer-t));const i=Py(e,n.laneIndex,n.sprite.position.z,n.jumpElapsed!==null)*Qe;i>=n.elevationY||wy(e,n.laneIndex,n.sprite.position.z)?(n.elevationY=i,n.elevationVelocity=0):(n.elevationVelocity-=KM*t,n.elevationY+=n.elevationVelocity*t,n.elevationY<=i&&(n.elevationY=i,n.elevationVelocity=0));const r=le[n.targetLane],s=n.laneX,o=1-Math.exp(-10*t);n.laneX+=(r-s)*o,n.nudgeOffset!==0&&(n.nudgeOffset*=Math.exp(-13*t),Math.abs(n.nudgeOffset)<.002&&(n.nudgeOffset=0));const a=(n.laneX-s)/Math.max(t,1e-6),l=Km.clamp(-a*.05-n.nudgeOffset*vM,-Qf,Qf);if(n.sprite.material.rotation+=(l-n.sprite.material.rotation)*.2,n.jumpElapsed!==null){const c=Math.min(n.jumpElapsed/lr,1),u=Math.min(Math.floor(c*ls.length),ls.length-1);u!==n.jumpFrameIndex&&(n.jumpFrameIndex=u,n.sprite.material.map=Se(ls[u].url)),n.sprite.position.x=n.laneX+n.nudgeOffset}else if(n.attacking){const{frames:c,frameDuration:u}=n.attackSequence;n.attackTimer+=t,n.attackTimer>=u&&(n.attackTimer-=u,n.attackFrameIndex+=1,n.attackFrameIndex>=c.length?(n.attacking=!1,n.attackSequence=null,n.frameIndex=0,n.frameTimer=0,n.sprite.material.map=Se(on[0].url)):n.sprite.material.map=Se(c[n.attackFrameIndex].url)),n.sprite.position.x=n.laneX+n.nudgeOffset}else{n.frameTimer+=t;const c=Ho*on[n.frameIndex].holdUnits;n.frameTimer>=c&&(n.frameTimer-=c,n.frameIndex=(n.frameIndex+1)%on.length,n.sprite.material.map=Se(on[n.frameIndex].url)),n.sprite.position.x=n.laneX+n.nudgeOffset+on[n.frameIndex].xOffset}n.jumpElapsed!==null?(n.jumpElapsed+=t,n.jumpElapsed>=Kh?(n.jumpElapsed=null,n.jumpFrameIndex=-1,n.airHeight=0,n.sprite.position.y=cr+n.elevationY):(n.airHeight=jh(n.jumpElapsed),n.sprite.position.y=cr+n.elevationY+n.airHeight)):n.attacking?(n.airHeight=0,n.sprite.position.y=cr+n.elevationY):(n.airHeight=0,n.sprite.position.y=cr+n.elevationY+on[n.frameIndex].yOffset)}const Yy=5;Array.from({length:Yy},(n,t)=>({url:Ts(`ribbon_${t}.webp`)}));function qy(){const n=document.createElement("canvas");n.width=128,n.height=128;const t=n.getContext("2d"),e=t.createRadialGradient(64,64,0,64,64,64);return e.addColorStop(0,"rgba(20,15,10,0.55)"),e.addColorStop(.6,"rgba(20,15,10,0.32)"),e.addColorStop(1,"rgba(20,15,10,0)"),t.fillStyle=e,t.fillRect(0,0,128,128),new kc(n)}let Oa=null;function jc(){return Oa||(Oa=qy()),Oa}const Jh=.88,Zy=1.5*Jh,$y=.85*Jh,Ky=6,jy=.22,Jy=.55,Qy=.6;function tT(n){const t=new we({map:jc(),transparent:!0,depthWrite:!1,fog:!1}),e=new ue(new fn(Zy,$y),t);return e.rotation.x=-Math.PI/2,e.position.y=.015,n.add(e),{mesh:e,pulse:0}}function eT(n){n.pulse=1}function Fa(n,t){n.mesh.visible=t}function nT(n,t,e){const{mesh:i}=n;i.position.x=t.sprite.position.x,i.position.z=t.sprite.position.z,i.position.y=.015+t.elevationY,n.pulse=Math.max(0,n.pulse-Ky*e);const r=t.airHeight/Ro,s=(1-r*Jy)*(1+n.pulse*jy);i.scale.set(s,s,1),i.material.opacity=1-r*Qy}const Xr=yr*.82,iT={medium:{texture:Mf,color:null,width:Xr,height:Xr*Mf.aspect,jumpable:!0,jumpClearHeight:2,shadowWidth:Xr*1.1,shadowDepth:1.15},low:{texture:null,color:5489259,width:Xr,height:1.1,jumpable:!0,jumpClearHeight:1.5,shadowWidth:Xr*.95,shadowDepth:.7}},rT=14;function sT(n){const t=new Li({transparent:!0}),e=new Pr(t);e.visible=!1,n.add(e);const i=new we({map:jc(),transparent:!0,depthWrite:!1,fog:!1}),r=new ue(new fn(1,1),i);return r.rotation.x=-Math.PI/2,r.position.y=.015,r.visible=!1,n.add(r),{sprite:e,shadow:r,type:null,active:!1,lane:1,z:0}}function oT(n){const t=[];for(let e=0;e<rT;e++)t.push(sT(n));return{pool:t}}function aT(n){for(const t of n.pool)t.active=!1,t.sprite.visible=!1,t.shadow.visible=!1}function lT(n,t,e,i){const r=iT[e];n.active=!0,n.type=r,n.lane=t,n.z=i,r.texture?(n.sprite.material.map=Se(r.texture.url),n.sprite.material.color.set(16777215)):(n.sprite.material.map=null,n.sprite.material.color.set(r.color)),n.sprite.material.needsUpdate=!0,n.sprite.scale.set(r.width,r.height,1),n.sprite.position.set(le[t],r.height/2,i),n.sprite.visible=!0,n.shadow.scale.set(r.shadowWidth,r.shadowDepth,1),n.shadow.position.set(le[t],n.shadow.position.y,i),n.shadow.visible=!0}function cT(){return"medium"}function ed(n,t,e=null,i=Pi,r=!0){const s=n.pool.find(l=>!l.active);if(!s||r&&Ry(t,i,ey))return;const o=Zh(t,i);if(o===null)return;const a=e||cT();lT(s,o,a,i)}function uT(n,t,e){for(const i of n.pool)i.active&&(i.z+=e*t,i.sprite.position.z=i.z,i.shadow.position.z=i.z,i.z>Ir&&(i.active=!1,i.sprite.visible=!1,i.shadow.visible=!1))}const fT=.3;function dT(n,t){return!t.active||Math.abs(t.z-Sn)>Xc||t.lane!==n.laneIndex||t.type.jumpable&&n.airHeight+xM>=t.type.jumpClearHeight?!1:n.elevationY<fT}const io=5.2,ro=0,so=3.6,oo=2,ao=0,lo=3.6,Qh={footSoldier:{texture:LM,height:io,floatHeight:ro,shadowWidth:so,shadowDepth:oo,breatheAmplitude:ao,breathePeriod:lo,poofColors:[10186705,13081584,6965908]},footSoldierSword:{texture:PM,height:io,floatHeight:ro,shadowWidth:so,shadowDepth:oo,breatheAmplitude:ao,breathePeriod:lo,poofColors:[13721439,15769760,9714234]},footSoldierNunchaku:{texture:IM,height:io,floatHeight:ro,shadowWidth:so,shadowDepth:oo,breatheAmplitude:ao,breathePeriod:lo,poofColors:[6273130,10543272,3832386]},footSoldierStaff:{texture:DM,height:io,floatHeight:ro,shadowWidth:so,shadowDepth:oo,breatheAmplitude:ao,breathePeriod:lo,poofColors:[5224624,10347486,3112312]}};function hT(){const n=document.createElement("canvas");n.width=128,n.height=128;const t=n.getContext("2d"),e=t.createRadialGradient(64,64,0,64,64,64);return e.addColorStop(0,"rgba(255,255,255,0)"),e.addColorStop(.48,"rgba(255,255,255,0)"),e.addColorStop(.62,"rgba(255,255,255,0.9)"),e.addColorStop(.72,"rgba(255,255,255,0.9)"),e.addColorStop(.86,"rgba(255,255,255,0)"),e.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=e,t.fillRect(0,0,128,128),new kc(n)}let Ba=null;function pT(){return Ba||(Ba=hT()),Ba}const mT=2.6,co=.18,nd=.14,_T=.82,gT=.34,vT=.1;function id(n){const t=new Li({map:pT(),transparent:!0,depthWrite:!1,fog:!1,blending:Uo}),e=new Pr(t);return e.visible=!1,n.add(e),e}const xT=14,ET=.3;function ST(n){const t=new Li({transparent:!0}),e=new Pr(t);e.visible=!1,n.add(e);const i=new we({map:jc(),transparent:!0,depthWrite:!1,fog:!1}),r=new ue(new fn(1,1),i);r.rotation.x=-Math.PI/2,r.position.y=.015,r.visible=!1,n.add(r);const s=id(n),o=id(n);return{sprite:e,shadow:r,ring0:s,ring1:o,ringTravel:[0,.5],type:null,active:!1,lane:1,z:0,breatheTimer:0,elevationY:0}}function MT(n){const t=[];for(let e=0;e<xT;e++)t.push(ST(n));return{pool:t}}function yT(n){for(const t of n.pool)t.active=!1,t.sprite.visible=!1,t.shadow.visible=!1,t.ring0.visible=!1,t.ring1.visible=!1}function TT(n,t,e,i){const r=Qh[e],s=r.height/r.texture.aspect;n.active=!0,n.type=r,n.lane=t,n.z=i,n.elevationY=0,n.breatheTimer=Math.random()*r.breathePeriod,n.sprite.material.map=Se(r.texture.url),n.sprite.scale.set(s,r.height,1),n.sprite.position.set(le[t],r.height/2+r.floatHeight,i),n.sprite.visible=!0,n.shadow.scale.set(r.shadowWidth,r.shadowDepth,1),n.shadow.position.set(le[t],n.shadow.position.y,i),n.shadow.visible=!0;const o=r.poofColors[0],a=r.height*gT,l=r.height*vT,c=Math.random();n.ringTravel[0]=c,n.ringTravel[1]=(c+.5)%1;for(const u of[n.ring0,n.ring1])u.material.color.setHex(o),u.scale.set(a,l,1),u.position.set(le[t],0,i),u.visible=!0}const rd=Object.keys(Qh);function Ha(n,t,e=null,i=null,r=Pi){const s=n.pool.find(c=>!c.active);if(!s)return;let o=i,a=r;if(i===null){const c=Cy(t),u=c.length>0&&Math.random()<ny?c[Math.floor(Math.random()*c.length)]:null;if(u)u.claim(),o=u.lane,a=u.z;else if(o=Zh(t,r),o===null)return}const l=e||rd[Math.floor(Math.random()*rd.length)];TT(s,o,l,a)}function bT(n,t,e,i){for(const r of n.pool){if(!r.active)continue;if(r.z+=e*t,r.sprite.position.z=r.z,r.shadow.position.z=r.z,r.ring0.position.z=r.z,r.ring1.position.z=r.z,r.z>Ir){r.active=!1,r.sprite.visible=!1,r.shadow.visible=!1,r.ring0.visible=!1,r.ring1.visible=!1;continue}r.elevationY=si(i,r.lane,r.z)*Qe;const{type:s}=r,o=s.height;r.breatheTimer=(r.breatheTimer+t)%s.breathePeriod;const a=.5*(1-Math.cos(2*Math.PI*r.breatheTimer/s.breathePeriod)),l=1+s.breatheAmplitude*a;r.sprite.scale.y=o*l,r.sprite.position.y=o/2+(l-1)*o*.5+s.floatHeight+r.elevationY,r.shadow.position.y=.015+r.elevationY;const c=[r.ring0,r.ring1];for(let u=0;u<c.length;u++){r.ringTravel[u]=(r.ringTravel[u]+t/mT)%1;const d=r.ringTravel[u],h=nd+d*(_T-nd);let m=1;d<co?m=d/co:d>1-co&&(m=(1-d)/co),c[u].material.opacity=m,c[u].position.y=o*h+s.floatHeight+r.elevationY}}}function AT(n,t){for(const e of t.pool)if(e.active&&!(Math.abs(e.z-Sn)>Xc)&&e.lane===n.laneIndex&&!(Math.abs(n.elevationY-e.elevationY)>=ET))return e;return null}function wT(n){n.active=!1,n.sprite.visible=!1,n.shadow.visible=!1,n.ring0.visible=!1,n.ring1.visible=!1}const Ko=Tr-Ri,tp=Ko/(2*Dn),ko=Ri*Dn+Ko*Dn/2;function sd(n){return n>=Dn?Tr:Ri+Ko*(n/Dn)}function vs(n){return n>=Dn?ko+Tr*(n-Dn):Ri*n+Ko*n*n/(2*Dn)}function ep(n){return n>=ko?Tr:Math.min(Math.sqrt(Ri*Ri+4*tp*n),Tr)}function RT(n){return n<=0?0:n>=ko?Dn+(n-ko)/Tr:(ep(n)-Ri)/(2*tp)}function CT(n,t){return vs(n+t)-vs(n)}const od=.85,np={common:{points:1,texture:bM,width:od,sparkleColor:16763199},bonus:{points:3,texture:AM,width:od*1.32,sparkleColor:6283519}},LT="common",PT=1.1,IT=.3;function DT(n){const t=new Li({transparent:!0,depthWrite:!1,fog:!1}),e=new Pr(t);return e.visible=!1,n.add(e),{sprite:e,type:null,active:!1,lane:1,z:0,baseHeight:0,pulseTimer:0,magnetPull:0,magnetInfluence:0,magnetLatched:!1}}function NT(n){const t=[];for(let e=0;e<iy;e++)t.push(DT(n));return{pool:t}}function UT(n){for(const t of n.pool)t.active=!1,t.sprite.visible=!1}function ip(n){n.active=!1,n.sprite.visible=!1}function OT(n,t,e,i,r,s){const o=np[r];n.active=!0,n.type=o,n.lane=t,n.z=e,n.baseHeight=i,n.pulseTimer=s%ec,n.magnetPull=0,n.magnetInfluence=0,n.magnetLatched=!1,n.sprite.material.map=Se(o.texture.url),n.sprite.material.needsUpdate=!0,n.sprite.scale.set(o.width,o.width*o.texture.aspect,1),n.sprite.position.set(le[t],i,e),n.sprite.visible=!0}function FT(n,t,e,i){for(const r of n.pool){if(!r.active)continue;if(r.z+=e*t,r.z>Ir){ip(r);continue}r.sprite.position.z=r.z,r.sprite.position.y=si(i,r.lane,r.z)*Qe+r.baseHeight,r.pulseTimer=(r.pulseTimer+t)%ec;const s=.5*(1-Math.cos(2*Math.PI*r.pulseTimer/ec)),o=r.type.width*(1+cy*s);r.sprite.scale.set(o,o*r.type.texture.aspect,1),r.sprite.material.opacity=Hf+(1-Hf)*s}}function BT(n,t,e){const i=[],r=si(e,n.laneIndex,Sn)*Qe;if(Math.abs(n.elevationY-r)>=IT)return i;const s=n.airHeight-Bf,o=n.airHeight+Kc+Bf;for(const a of t.pool){if(!a.active||Math.abs(a.z-Sn)>PT)continue;const l=a.magnetInfluence>=dM;!l&&a.lane!==n.laneIndex||!l&&(a.baseHeight<s||a.baseHeight>o)||i.push(a)}return i}function HT(n,t,e,i){const r=t.elevationY+t.airHeight+Kc/2,s=Math.min(1,hM*e);for(const o of n.pool){if(!o.active)continue;const a=Math.abs(o.z-Sn),l=a<Sf?1-a/Sf:0;let c=i?l:0;o.magnetLatched&&(c=Math.max(c,l,o.magnetPull)),o.magnetPull+=(c-o.magnetPull)*s,!o.magnetLatched&&o.magnetPull<.002&&(o.magnetPull=0),o.magnetPull>=pM&&(o.magnetLatched=!0),o.magnetInfluence=o.magnetPull**mM;const u=le[o.lane];if(o.magnetInfluence>0){o.sprite.position.x=u+(t.laneX-u)*o.magnetInfluence;const d=o.sprite.position.y;o.sprite.position.y=d+(r-d)*o.magnetInfluence}else o.sprite.position.x=u}}function zT(){return Math.random()<ly?"bonus":LT}function rp(n,t,e,i){for(const r of n.pool)if(!(!r.active||r.lane!==t)&&r.z>=e-zf&&r.z<=i+zf)return!0;return!1}function ad(n,t,e,i,r){const s=[];for(let o=0;o<le.length;o++)s.push(o);for(let o=s.length-1;o>0;o--){const a=Math.floor(Math.random()*(o+1));[s[o],s[a]]=[s[a],s[o]]}for(const o of s)if(!rp(t,o,e,i)&&!(r&&(zo(n,o,i)||zo(n,o,e))))return o;return null}function za(n,t,e){const i=n.pool.filter(r=>!r.active);return i.length<t.length?!1:(t.forEach((r,s)=>{OT(i[s],r.lane,r.z,r.baseHeight,e,s*uy)}),!0)}function kT(n,t){const e=Uf+Math.floor(Math.random()*(sy-Uf+1)),i=[];for(let r=0;r<e;r++)i.push({lane:n,z:t-r*oy,baseHeight:qc});return i}function GT(n,t,e){const i=ep(vs(e)+Math.abs(t));return Fy(ay).map(r=>({lane:n,z:t-r.elapsed*i,baseHeight:qc+r.height}))}function VT(n){const t=n.endZ-Ff,e=n.startZ+Ff,i=t-e;if(i<=0)return null;const r=[];for(let s=0;s<Of;s++){const o=s/(Of-1);r.push({lane:n.lane,z:t-o*i,baseHeight:qc})}return r}function ld(n,t,e,i,r=Pi){const s=zT(),o=Math.random();if(o>=Da+Nf){const d=Ly(t).filter(h=>!rp(e,h.lane,h.startZ,h.endZ));if(d.length>0){const h=d[Math.floor(Math.random()*d.length)],m=VT(h);if(m&&za(n,m,s)){h.claim();return}}}if(o>=Da&&o<Da+Nf){const d=GT(0,r,i),h=d[d.length-1].z,m=ad(t,e,h,r,!0);if(m===null)return;d.forEach(g=>{g.lane=m}),za(n,d,s);return}const l=kT(0,r),c=l[l.length-1].z,u=ad(t,e,c,r,!1);u!==null&&(l.forEach(d=>{d.lane=u}),za(n,l,s))}const cd=1.5,WT={magnet:{effect:"magnet",texture:wM,width:cd,sparkleColor:8378623},life:{effect:"life",texture:RM,width:cd*.94,sparkleColor:16748451}},XT=1.4,YT=.3;function qT(n){const t=new Li({transparent:!0,depthWrite:!1,fog:!1}),e=new Pr(t);return e.visible=!1,n.add(e),{sprite:e,type:null,typeKey:null,active:!1,lane:1,z:0,baseHeight:nc,pulseTimer:0}}function ZT(n){const t=[];for(let e=0;e<fy;e++)t.push(qT(n));return{pool:t}}function $T(n){for(const t of n.pool)t.active=!1,t.sprite.visible=!1}function sp(n){n.active=!1,n.sprite.visible=!1}function KT(n,t,e){for(const i of n.pool)if(!(!i.active||i.lane!==t)&&Math.abs(i.z-e)<=my)return!0;return!1}function jT(n,t,e){const i=[];for(let r=0;r<le.length;r++)i.push(r);for(let r=i.length-1;r>0;r--){const s=Math.floor(Math.random()*(r+1));[i[r],i[s]]=[i[s],i[r]]}for(const r of i)if(!KT(t,r,e)&&!zo(n,r,e))return r;return null}function ud(n,t,e,i,r=Pi){const s=n.pool.find(l=>!l.active);if(!s)return;const o=jT(t,e,r);if(o===null)return;const a=WT[i];s.active=!0,s.type=a,s.typeKey=i,s.lane=o,s.z=r,s.baseHeight=nc,s.pulseTimer=0,s.sprite.material.map=Se(a.texture.url),s.sprite.material.needsUpdate=!0,s.sprite.material.rotation=0,s.sprite.scale.set(a.width,a.width*a.texture.aspect,1),s.sprite.position.set(le[o],nc,r),s.sprite.visible=!0}function JT(n,t,e,i){for(const r of n.pool){if(!r.active)continue;if(r.z+=e*t,r.z>Ir){sp(r);continue}r.sprite.position.z=r.z,r.sprite.position.y=si(i,r.lane,r.z)*Qe+r.baseHeight,r.pulseTimer=(r.pulseTimer+t)%Na;const s=.5*(1-Math.cos(2*Math.PI*r.pulseTimer/Na)),o=r.type.width*(1+_y*s);r.sprite.scale.set(o,o*r.type.texture.aspect,1),r.sprite.material.rotation=gy*Math.sin(2*Math.PI*r.pulseTimer/Na)}}function QT(n,t,e){const i=[],r=si(e,n.laneIndex,Sn)*Qe;if(Math.abs(n.elevationY-r)>=YT)return i;const s=n.airHeight-Gf,o=n.airHeight+Kc+Gf;for(const a of t.pool)a.active&&(Math.abs(a.z-Sn)>XT||a.lane===n.laneIndex&&(a.baseHeight<s||a.baseHeight>o||i.push(a)));return i}const tb=Math.abs(Pi-Sn);function eb(n){return RT(vs(n)+tb)}function nb(n,t=Xh){if(t<=0)return 1;const e=Math.min(1,Math.max(0,n/t));return wf+(1-wf)*e}function Yr(n=Yc){return{timer:n}}function di(n,t=Yc){n.timer=t}function qr(n,t,e,i=tc){n.timer-=t,n.timer<=0&&(n.timer+=i,e())}function ib(){return{total:0,displayed:0,enemiesKilled:0,coinsCollected:0}}function rb(n){n.total=0,n.displayed=0,n.enemiesKilled=0,n.coinsCollected=0}function sb(n){return n.enemiesKilled+=1,n.total+=xf,xf}function ob(n,t){return n.coinsCollected+=1,n.total+=t.points,t.points}function ab(n,t){n.displayed=Math.min(n.displayed+t,n.total)}function ka(n){n.displayed=n.total}const uo=new B,xs=[];let ic=null,Es=null,rc=null,Cn=null,op=0,ap=0;function sc(){if(!rc||!Es)return;const n=rc.getBoundingClientRect(),t=Es.getBoundingClientRect();op=n.left-t.left+n.width/2,ap=n.top-t.top+n.height/2}function lb(n,t,e,i){Es=n,ic=t,rc=e,Cn=i;for(let r=0;r<cM;r++){const s=document.createElement("div");s.className="points-fly",s.style.display="none",ic.appendChild(s),xs.push({el:s,active:!1,t:0,x0:0,y0:0,value:0,variant:null,credited:!1})}sc(),window.addEventListener("resize",sc)}function cb(){sc()}function ub(n,t,e,i){if(uo.set(n,t,e).project(i),uo.z>1)return null;const r=Es.clientWidth,s=Es.clientHeight;return{x:(uo.x*.5+.5)*r,y:(-uo.y*.5+.5)*s}}function fd(n,t,e,i,r,s){if(!ic){Cn&&Cn(r,s);return}const o=ub(n,t,e,i);if(!o){Cn&&Cn(r,s);return}let a=xs.find(l=>!l.active);a||(a=xs.reduce((l,c)=>l.t>c.t?l:c),!a.credited&&Cn&&Cn(a.value,a.variant)),a.active=!0,a.credited=!1,a.t=0,a.x0=o.x,a.y0=o.y,a.value=r,a.variant=s,a.el.textContent=`+${r}`,a.el.className=`points-fly points-fly--${s}`,a.el.style.display="block",a.el.style.transform=`translate3d(${o.x}px, ${o.y}px, 0) translate(-50%, -50%) scale(0.4)`,a.el.style.opacity="0"}function fb(n){const t=oM,e=t+aM,i=e+Ef;for(const r of xs){if(!r.active)continue;r.t+=n;let s,o,a,l=1;if(r.t<t){const c=r.t/t;a=.4+.85*c+.25*Math.sin(c*Math.PI),s=r.x0,o=r.y0-Ra*c,l=Math.min(1,c*3)}else if(r.t<e)a=1,s=r.x0,o=r.y0-Ra;else if(r.t<i){const c=(r.t-e)/Ef,u=c*c,d=r.x0,h=r.y0-Ra;s=d+(op-d)*u,o=h+(ap-h)*u,a=1+(lM-1)*u,l=1-.25*u}else{r.credited||(r.credited=!0,Cn&&Cn(r.value,r.variant)),r.active=!1,r.el.style.display="none";continue}r.el.style.transform=`translate3d(${s}px, ${o}px, 0) translate(-50%, -50%) scale(${a})`,r.el.style.opacity=`${l}`}}function fo(){for(const n of xs)n.active=!1,n.credited=!0,n.el.style.display="none"}const Zr=[300,800,1500],db=1e3,hb=.2,pb=1.3,Ga=["WAREHOUSE ROOF","BIG WAREHOUSES","CENTRAL CITY","HARBOR DOCKS","FUNKY FOREST","SPACE CITY"],ho=5,dd=2,mb=.6,Ti=["warehouseRoof","warehouse","centralCity","harborDocks","funkyForest","spaceCity"];function Lo(n){return n<=Zr.length?Zr[n-1]:Zr[Zr.length-1]+(n-Zr.length)*db}function jo(n){return Ga.length===0?`TIER ${n}`:Ga[(n-1)%Ga.length]}function po(n){return Ti.length===0?null:Ti[(n-1)%Ti.length]}function hd(n,t){const e=t-(n-1)*hb;return Math.max(pb,e)}function Kn(n){let t=1,e=0,i=Lo(1);for(;n>=i&&t<1e3;){t+=1,e=i;const a=Lo(t);if(a<=e){i=e;break}i=a}const r=Ti.length;if(r>0&&t>r)return{tier:r,start:Lo(r),next:1/0,frac:1};const s=i-e,o=s>0?Math.min(1,Math.max(0,(n-e)/s)):1;return{tier:t,start:e,next:i,frac:o}}function pd(n){return Ti.length>0&&n>=Lo(Ti.length)}function _b(){return{lives:Vc,invulnerableUntil:0}}function gb(n){n.lives=Vc,n.invulnerableUntil=0}function vb(n,t){return t<n.invulnerableUntil?{hit:!1,dead:!1}:(n.invulnerableUntil=t+uM,n.lives-=1,{hit:!0,dead:n.lives<=0})}function Va(n,t){return t<n.invulnerableUntil}function xb(n){return n.lives>=Nh?!1:(n.lives+=1,!0)}const oc="gb2:",Eb=5e3;let Sb=1;const cs=new Map,ac=()=>typeof window<"u"?window.Unity:null;function Yn(n,t,e){const i=ac();if(!i||typeof i.call!="function")return Promise.reject(new Error("no host"));if(!e){try{i.call(oc+"0:"+n+":"+(t??""))}catch{}return Promise.resolve(null)}const r=Sb++;return new Promise((s,o)=>{const a=setTimeout(()=>{cs.delete(r),o(new Error("timed out: "+n))},Eb);cs.set(r,{resolve:s,reject:o,timer:a});try{i.call(oc+r+":"+n+":"+(t??""))}catch(l){clearTimeout(a),cs.delete(r),o(l)}})}function md(n,t){let e=String(n);if(!t)return e;for(const i of Object.keys(t)){const r=t[i];r!=null&&(e+="|"+i+"="+String(r).replace(/[|=]/g,""))}return e}function Mb(n){if(n==null||n==="")return null;if(typeof n!="string")return n;try{return JSON.parse(n)}catch{return null}}function yb(){return typeof window>"u"||!ac()?!1:window.GoBalance?(typeof window.GoBalance.logEvent!="function"&&(window.GoBalance.logEvent=(n,t)=>{try{ac().call(oc+"0:analytics.log:"+md(n,t))}catch{}return Promise.resolve(null)}),!0):(window.__gb={_resolve(n,t,e){const i=cs.get(n);i&&(cs.delete(n),clearTimeout(i.timer),t?i.resolve(Mb(e)):i.reject(new Error("host reported failure")))},_roster(){},_tickAnimations(){}},window.GoBalance={load:()=>Yn("save.load","",!0),save:n=>Yn("save.set",JSON.stringify(n),!0),submitScore:n=>Yn("score.submit",String(Math.round(n)),!0),getScoreboard:()=>Yn("score.board","",!0),profile:()=>Yn("profile.get","",!0),players:()=>Yn("players.get","",!0),logEvent:(n,t)=>Yn("analytics.log",md(n,t),!1)},Yn("ready","",!1),!0)}const _i={START:"start_game",LEVEL_START:"level_start",LEVEL_END:"level_end",SETTINGS:"settings_changed",END:"game_end",HEARTBEAT:"heartbeat"},_d={CLEAR:"clear",FAIL:"fail"},lp=()=>typeof window<"u"?window.GoBalance:null;function cp(){const n=lp();return!!(n&&typeof n.logEvent=="function")}function gi(n,t){if(cp())try{const e=lp().logEvent(n,t);e&&typeof e.catch=="function"&&e.catch(()=>{})}catch{}}const $r=n=>Math.max(0,Math.round(n||0));function Tb(n,t){return t?Math.max(0,Math.min(100,Math.round(n/t*100))):0}function Jn(){return typeof performance<"u"&&performance.now?performance.now():Date.now()}const bb=3e4;let ur=!1,us=0,tn=0,er=null,Wa=0;const Xa=Object.create(null);let Ue=null;function up(){const n=tn?Jn()-tn:0;return Math.max(0,Math.round((us+n)/1e3))}function fp(n){if(!ur||!tn&&!n)return;const t={duration_seconds:up()};Ue&&(t.level_id=Ue.id),gi(_i.HEARTBEAT,t)}function lc(){typeof document>"u"||lc.done||(lc.done=!0,document.addEventListener("visibilitychange",()=>{ur&&(document.visibilityState==="hidden"?(tn&&(us+=Jn()-tn,tn=0),fp(!0)):tn||(tn=Jn()))}))}function Ya(){return{level_id:Ue.id,level_number:Ue.number,attempt:Ue.attempt,mode:"arcade"}}const Kr={runStarted(){ur||(ur=!0,us=0,tn=Jn(),lc(),er&&clearInterval(er),er=setInterval(fp,bb)),Wa+=1,Ue=null,gi(_i.START,{mode:"arcade"})},levelStarted(n,t){Xa[n]=(Xa[n]||0)+1,Ue={id:n,number:t,attempt:Xa[n],at:Jn(),score:0},gi(_i.LEVEL_START,Ya())},levelCleared(n){Ue&&(gi(_i.LEVEL_END,{...Ya(),result:_d.CLEAR,score:$r(n),progress_pct:100,duration_seconds:$r((Jn()-Ue.at)/1e3)}),Ue=null)},levelFailed(n,t,e){Ue&&(gi(_i.LEVEL_END,{...Ya(),result:_d.FAIL,score:$r(n),progress_pct:Tb(t,e),duration_seconds:$r((Jn()-Ue.at)/1e3)}),Ue=null)},settingChanged(n,t){gi(_i.SETTINGS,{setting:n,setting_value:$r(t)})},gameLeft(){ur&&(tn&&(us+=Jn()-tn,tn=0),gi(_i.END,{duration_seconds:up(),runs:Wa}),er&&(clearInterval(er),er=null),ur=!1,us=0,Wa=0,Ue=null)},isAvailable:cp};function dp(){return typeof window<"u"&&window.GoBalance?window.GoBalance:null}function qa(n){const t=dp();if(!t||typeof t.submitScore!="function")return Promise.resolve(!1);const e=Math.max(0,Math.round(n||0));try{return Promise.resolve(t.submitScore(e)).then(()=>!0).catch(()=>!1)}catch{return Promise.resolve(!1)}}const Ab=100;function Za(){const n=dp();return!n||typeof n.getScoreboard!="function"?Promise.resolve({available:!1,complete:!0,rows:[]}):Promise.resolve(n.getScoreboard()).then(t=>{const i=(t&&t.entries||[]).filter(Boolean).slice().sort((r,s)=>(s.score||0)-(r.score||0)||String(r.name||"").localeCompare(String(s.name||""))||String(r.profileId||"").localeCompare(String(s.profileId||""))).slice(0,Ab).map((r,s)=>({...r,rank:s+1}));return{available:!0,complete:t?t.complete!==!1:!1,rows:i}}).catch(()=>({available:!0,complete:!1,rows:[]}))}function $a(n,t,e=5,i=2,r=2){const s=n.slice(0,e);if(t==null)return{top:s,window:[]};const o=Math.round(t);let a=n.findIndex(d=>d.isYou&&Math.round(d.score||0)===o);if(a<0)return{top:s,window:[]};if(a<e)return{top:s,window:[]};const l=Math.max(e,a-i),c=Math.min(n.length,a+r+1),u=n.slice(l,c).map(d=>({...d,isRun:d===n[a]}));return{top:s,window:u}}function wb(){return{current:"intro"}}function gd(n){n.current="running"}function Rb(n){n.current="gameover"}function Cb(n){n.current="levelcomplete"}function Lb(n){n.current="intro"}function Pb(n){n.current="cleared"}const vd=["center","left","right"],xd=1.3,mo=[{frame:2,boardDeg:0,holdSec:.4},{frame:0,boardDeg:-58,holdSec:.1},{frame:1,boardDeg:-58,holdSec:.12},{frame:2,boardDeg:-20,holdSec:.25},{frame:2,boardDeg:0,holdSec:.4},{frame:0,boardDeg:58,holdSec:.1},{frame:1,boardDeg:58,holdSec:.12},{frame:2,boardDeg:20,holdSec:.25}],Ib=9,Db=6,hp={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down"},En={left:!1,right:!1,up:!1,down:!1};let Ed=!1,Sd=!1,Md=!1,yd=!1;window.addEventListener("keydown",n=>{const t=hp[n.code];t&&(En[t]=!0)});window.addEventListener("keyup",n=>{const t=hp[n.code];t&&(En[t]=!1)});const Oe={mode:Oh,laneZone:Fh,laneHysteresis:Bh,jumpTilt:Hh},Go={x:0,y:0};let br=1,fs=!1,Td=!1;function Nb(n){Oe.mode=n}function Ub(n){Oe.laneZone=n}function Ob(n){Oe.laneHysteresis=n}function Fb(n){Oe.jumpTilt=n}function Bb(){const n=window.__gbSensor;if(n)return{x:n.x-Go.x,y:n.y-Go.y};const t=(En.right?1:0)-(En.left?1:0),e=(En.up?1:0)-(En.down?1:0);return{x:t,y:e}}function Hb(){const n=window.__gbSensor;return n?(Go.x=n.x,Go.y=n.y,br=1,!0):!1}function zb(n){const t=le.length-1,e=Math.max(0,Oe.laneZone-Oe.laneHysteresis);return br===0?n<-e?0:1:br===t?n>e?t:1:n<-Oe.laneZone?0:n>Oe.laneZone?t:1}function kb(){if(Oe.mode!==$o){br=1,fs=!1;return}const n=Bb();br=zb(n.x);const t=Math.max(0,Oe.jumpTilt-_M),e=Math.abs(n.y);fs=fs?e>t:e>Oe.jumpTilt}function Gb(){const n=En.left,t=En.right,e=n&&!Ed,i=t&&!Sd;return Ed=n,Sd=t,Oe.mode!==Wc?0:(i?1:0)-(e?1:0)}function Vb(){return Oe.mode===$o?br:null}function Wb(){const n=En.up,t=En.down,e=n&&!Md||t&&!yd;if(Md=n,yd=t,Oe.mode===$o){const i=fs&&!Td;return Td=fs,i}return e}const pp="roborun:vfx",Jo={vfxEnabled:!0};function Xb(){try{const n=window.localStorage.getItem(pp);if(!n)return;const t=JSON.parse(n);typeof t.vfxEnabled=="boolean"&&(Jo.vfxEnabled=t.vfxEnabled)}catch{}}function Yb(){try{window.localStorage.setItem(pp,JSON.stringify(Jo))}catch{}}Xb();function bs(){return Jo.vfxEnabled}function qb(n){Jo.vfxEnabled=n,Yb()}const Zb=document.getElementById("points-value-text"),$b=document.getElementById("points-target"),es=document.getElementById("points-hud"),cc=document.getElementById("points-burst"),ds=document.getElementById("tier-bar"),sr=document.getElementById("tier-fill"),Kb=document.getElementById("tier-label"),Jc=document.getElementById("level-complete"),hs=document.getElementById("lc-headline"),jb=document.getElementById("lc-title"),Jb=document.getElementById("lc-next"),_o=document.getElementById("lc-countdown"),mr=document.getElementById("lc-confetti"),Qc=document.getElementById("lc-curtain-left"),tu=document.getElementById("lc-curtain-right"),Vo=document.getElementById("lives-tray"),mp=document.getElementById("gameover-overlay"),Qb=document.getElementById("final-points"),tA=document.getElementById("final-breakdown"),_p=document.getElementById("scoreboard"),eA=document.getElementById("scoreboard-title"),gp=document.getElementById("scoreboard-rows"),eu=document.getElementById("confirm-overlay"),nu=document.getElementById("quit-overlay"),nA=document.getElementById("quit-title"),iA=document.getElementById("quit-stats"),vp=document.getElementById("quit-scoreboard"),rA=document.getElementById("quit-scoreboard-title"),xp=document.getElementById("quit-scoreboard-rows"),Ep=document.getElementById("victory-overlay"),sA=document.getElementById("victory-sub"),oA=document.getElementById("victory-stats"),ps=document.getElementById("victory-confetti"),aA=document.getElementById("paused-badge"),Sp=document.getElementById("intro-tutorial-overlay"),lA=document.getElementById("intro-step-lanes"),cA=document.getElementById("intro-step-jump"),bd=document.getElementById("intro-board-lanes"),uc=document.getElementById("intro-player"),uA=document.getElementById("intro-board-jump"),Ad=document.getElementById("intro-jumper"),fA="❤";let fc=null,dc=null,hc=null,pc=-1,mc=null,_c=null;const wd=["#fff2a8","#ffb43c","#ff8a3c","#ffe066"],Rd=12;let ns=0,Po=0,Io="coin",Do=0,No=!1,Mp="coin";const dA=.26,hA=.32,pA=.55,mA=.32,Cd=.75,Ld=1;function Ke(n,t,e){return n+(t-n)*e}function _A(n,t){return n==="enemy"?t<.3?Ke(1,1.34,t/.3):t<.6?Ke(1.34,.97,(t-.3)/.3):Ke(.97,1,(t-.6)/.4):t<.35?Ke(1,1.07,t/.35):Ke(1.07,1,(t-.35)/.65)}const gc=[];function gA(){if(!cc)return;const n=document.createDocumentFragment();for(let t=0;t<Rd;t++){const e=document.createElement("div");e.className="points-burst-piece";const i=wd[t%wd.length];e.style.background=i,e.style.color=i;const r=t/Rd*Math.PI*2+(Math.random()-.5)*.6,s=5.5+Math.random()*3.5;n.appendChild(e),gc.push({el:e,bx:Math.cos(r)*s,by:Math.sin(r)*s})}cc.appendChild(n)}gA();function vA(n){!cc||!bs()||(No=!0,Do=0,Mp=n)}function xA(n){es&&(Io=n==="enemy"?"enemy":"coin",Po=Io==="enemy"?hA:dA,ns=0,vA(Io))}function EA(n){if(es)if(ns<Po){ns=Math.min(Po,ns+n);const t=_A(Io,ns/Po);es.style.transform=`translateX(-50%) scale(${t.toFixed(4)})`}else es.style.transform&&(es.style.transform="");if(No){const t=Mp!=="enemy";if(Do+=n,t){const e=Math.min(1,Do/mA);gc.forEach((i,r)=>{if(r%2!==0){i.el.style.opacity="0";return}const s=i.bx*Cd*e,o=i.by*Cd*e,a=Ke(Ld,Ld*.25,e);i.el.style.transform=`translate(${s.toFixed(2)}vmin, ${o.toFixed(2)}vmin) scale(${a.toFixed(3)})`,i.el.style.opacity=Ke(1,0,e).toFixed(3)}),e>=1&&(No=!1)}else{const e=Math.min(1,Do/pA);for(const i of gc){let r,s,o,a,l;e<.2?(o=e/.2,r=1,s=Ke(1.6,1.3,o),a=i.bx*.35*o,l=i.by*.35*o):(o=(e-.2)/.8,r=Ke(1,0,o),s=Ke(1.3,.3,o),a=Ke(i.bx*.35,i.bx,o),l=Ke(i.by*.35,i.by,o)),i.el.style.transform=`translate(${a.toFixed(2)}vmin, ${l.toFixed(2)}vmin) scale(${s.toFixed(3)})`,i.el.style.opacity=r.toFixed(3)}e>=1&&(No=!1)}}}function nr(n,t=!1,e=null){const i=`${n}`;i!==fc&&(fc=i,Zb.textContent=i,t&&xA(e));const r=Kn(n),s=`/ ${r.next}`;s!==dc&&(dc=s,$b.textContent=s);const o=jo(r.tier);o!==hc&&(hc=o,Kb.textContent=o);const a=Math.round(r.frac*100);a!==pc&&(pc=a,sr.style.width=`${a}%`)}const Pd=["#ffe066","#ffc93f","#5fe0ff","#ff8fa3","#7fd8ff","#97ff6b","#ffb43c","#ff6bb0","#c58cff","#4dffb8"],SA=34,MA=120;function yp(n,t,e=!1){if(!n)return;const i=document.createDocumentFragment();for(let r=0;r<t;r++){const s=document.createElement("div"),o=e&&Math.random()<.3;if(s.className=o?"confetti-piece confetti-star":"confetti-piece",s.style.left=`${Math.random()*100}%`,s.style.background=Pd[r%Pd.length],e){const a=.7+Math.random()*1.3;s.style.width=`${(o?2.6:1.1)*a}vmin`,s.style.height=`${(o?2.6:2.3)*a}vmin`}s.style.setProperty("--drift",`${(Math.random()*2-1)*24}vw`),s.style.setProperty("--spin",`${(Math.random()<.5?-1:1)*(2+Math.random()*3)*360}deg`),s.style.animationDuration=`${2+Math.random()*1.4}s`,s.style.animationDelay=`${Math.random()*2}s`,i.appendChild(s)}n.appendChild(i)}yp(mr,SA);yp(ps,MA,!0);function yA(n,t){jb.textContent=`LEVEL ${n} COMPLETE`,bs()&&(ds.classList.remove("tier-bar-celebrate"),ds.offsetWidth,ds.classList.add("tier-bar-celebrate"),mr.classList.remove("lc-confetti-play"),mr.offsetWidth,mr.classList.add("lc-confetti-play")),hs.classList.remove("lc-headline-play"),hs.offsetWidth,hs.classList.add("lc-headline-play"),Jb.textContent=`NEXT: ${jo(t)}`,_c=null,Tp(),Jc.classList.remove("hidden")}function TA(){Qc.classList.add("lc-curtain-closed"),tu.classList.add("lc-curtain-closed")}function bA(){Qc.classList.remove("lc-curtain-closed"),tu.classList.remove("lc-curtain-closed")}function Tp(){for(const n of[Qc,tu]){const t=n.style.transition;n.style.transition="none",n.classList.remove("lc-curtain-closed"),n.offsetWidth,n.style.transition=t}}function Id(n){n!==_c&&(_c=n,_o.textContent=`${n}`,_o.classList.remove("lc-tick"),_o.offsetWidth,_o.classList.add("lc-tick"))}function AA(){Jc.classList.add("hidden"),ds.classList.remove("tier-bar-celebrate"),hs.classList.remove("lc-headline-play"),mr.classList.remove("lc-confetti-play")}function wA(){Jc.classList.add("hidden"),ds.classList.remove("tier-bar-celebrate"),hs.classList.remove("lc-headline-play"),mr.classList.remove("lc-confetti-play"),Tp();const n=sr.style.transition;sr.style.transition="none",sr.style.width="0%",sr.offsetWidth,sr.style.transition=n,fc=null,dc=null,hc=null,pc=-1}function bp(n){Vo.innerHTML="";for(let t=0;t<n;t++){const e=document.createElement("div");e.className="life-icon",e.textContent=fA,Vo.appendChild(e)}mc=null}function Ka(n){if(n===mc)return;n>Vo.children.length&&bp(n),mc=n;const t=Vo.children;for(let e=0;e<t.length;e++)t[e].classList.toggle("spent",e>=n)}function RA(n,t){Qb.textContent=`${n.total}`;const e=Kn(n.total);tA.textContent=`${jo(e.tier)}   ·   ${n.enemiesKilled} defeated   ·   ${n.coinsCollected} coins   ·   ${Math.floor(t)}m`,mp.classList.remove("hidden")}function CA(){mp.classList.add("hidden"),_p.classList.add("hidden"),gp.innerHTML=""}function Ap(n,t,e,i,r){if(!n)return;const s=(r||[]).filter(o=>o&&o.length);if(!i||!i.available||!s.length){n.classList.add("hidden");return}t.textContent=i.complete?"BEST ON THIS ACCOUNT":"BEST ON THIS DEVICE",e.innerHTML="",s.forEach((o,a)=>{if(a>0){const l=document.createElement("li");l.className="sb-gap",l.textContent="·  ·  ·",e.appendChild(l)}o.forEach(l=>{const c=document.createElement("li");c.className="sb-row"+(l.isRun?" sb-you":l.isYou?" sb-mine":"");const u=document.createElement("span");u.className="sb-rank",u.textContent=String(l.rank);const d=document.createElement("span");d.className="sb-name",d.textContent=l.name||"PLAYER";const h=document.createElement("span");h.className="sb-score",h.textContent=Number(l.score||0).toLocaleString(),c.appendChild(u),c.appendChild(d),c.appendChild(h),e.appendChild(c)})}),n.classList.remove("hidden")}function LA(n,t){Ap(_p,eA,gp,n,t)}function PA(){eu.classList.remove("hidden")}function Dd(){eu.classList.add("hidden")}function IA(){return!eu.classList.contains("hidden")}function go(n,t,e,i="RUN ENDED"){nA.textContent=i,iA.textContent=n,Ap(vp,rA,xp,t,e),nu.classList.remove("hidden")}function DA(){nu.classList.add("hidden"),vp.classList.add("hidden"),xp.innerHTML=""}function NA(){return!nu.classList.contains("hidden")}function UA(n){sA.textContent=`You cleared all ${Ti.length} tiers.`,oA.textContent=n,bs()&&(ps.classList.remove("lc-confetti-play"),ps.offsetWidth,ps.classList.add("lc-confetti-play")),Ep.classList.remove("hidden")}function Nd(){Ep.classList.add("hidden"),ps.classList.remove("lc-confetti-play")}function OA(n){aA.classList.toggle("hidden",!n)}let vc=null,xc=null,Ec=null;const Ud=["intro-lane-center","intro-lane-left","intro-lane-right"];function FA(){Sp.classList.remove("hidden"),vc=null,xc=null,Ec=null,wp(1),Rp("center"),Cp(0)}function BA(){Sp.classList.add("hidden")}function wp(n){lA.classList.toggle("hidden",n!==1),cA.classList.toggle("hidden",n!==2)}function Rp(n){if(n===vc)return;vc=n;const t=`intro-lane-${n}`;bd.classList.remove(...Ud),bd.classList.add(t),uc.classList.remove(...Ud),uc.classList.add(t)}function Cp(n){n!==xc&&(xc=n,uc.src=on[n].url)}function Od(n,t){n!==Ec&&(Ec=n,Ad.src=ls[t.frame].url,uA.style.transform=`perspective(380px) rotateX(${t.boardDeg}deg)`,Ad.style.transform=t.frame===2?"translateY(-3vmin)":"translateY(0)")}const HA="/assets/music_theme-B3OmR9fv.mp3",zA="/assets/sfx_coin-DlGIjd5A.mp3",kA="/assets/sfx_enemy_kill-Dh9rwocP.mp3",GA="/assets/sfx_gameover-SjJkviVP.mp3",VA="/assets/sfx_hit-D7YUQDWb.mp3",WA="/assets/sfx_jump-D3yAgG_6.mp3",XA="/assets/sfx_level_complete-QK6DR8VP.mp3",YA="/assets/sfx_ui_tap-p3aV7HZV.mp3";function qn(n){return new URL(Object.assign({"../assets/audio/music_theme.mp3":HA,"../assets/audio/sfx_coin.mp3":zA,"../assets/audio/sfx_enemy_kill.mp3":kA,"../assets/audio/sfx_gameover.mp3":GA,"../assets/audio/sfx_hit.mp3":VA,"../assets/audio/sfx_jump.mp3":WA,"../assets/audio/sfx_level_complete.mp3":XA,"../assets/audio/sfx_ui_tap.mp3":YA})[`../assets/audio/${n}`],import.meta.url).href}const qA={music:qn("music_theme.mp3"),sfx_jump:qn("sfx_jump.mp3"),sfx_coin:qn("sfx_coin.mp3"),sfx_enemy_kill:qn("sfx_enemy_kill.mp3"),sfx_hit:qn("sfx_hit.mp3"),sfx_gameover:qn("sfx_gameover.mp3"),sfx_level_complete:qn("sfx_level_complete.mp3"),sfx_ui_tap:qn("sfx_ui_tap.mp3")},Lp="roborun:audio",ZA=.6,$A=.35,Fn={sfxEnabled:!0,musicEnabled:!0};function KA(){try{const n=window.localStorage.getItem(Lp);if(!n)return;const t=JSON.parse(n);typeof t.sfxEnabled=="boolean"&&(Fn.sfxEnabled=t.sfxEnabled),typeof t.musicEnabled=="boolean"&&(Fn.musicEnabled=t.musicEnabled)}catch{}}function Pp(){try{window.localStorage.setItem(Lp,JSON.stringify(Fn))}catch{}}KA();let De=null;try{const n=window.AudioContext||window.webkitAudioContext;n&&(De=new n)}catch{De=null}const iu={};async function jA(n){if(!De)return null;try{const e=await(await fetch(n)).arrayBuffer();return await De.decodeAudioData(e)}catch{return null}}let ja=!1;function JA(){if(!De)return;const n=()=>{ja||(ja=!0,De.resume().catch(()=>{}),window.removeEventListener("pointerdown",n),window.removeEventListener("touchstart",n),window.removeEventListener("keydown",n))};window.addEventListener("pointerdown",n),window.addEventListener("touchstart",n),window.addEventListener("keydown",n),document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"&&ja&&De.resume().catch(()=>{})})}function QA(){for(const[n,t]of Object.entries(qA))jA(t).then(e=>{e&&(iu[n]=e,n==="music"&&ru())});JA()}function me(n){if(!De||!Fn.sfxEnabled)return;const t=iu[n];if(!t)return;const e=De.createBufferSource();e.buffer=t;const i=De.createGain();i.gain.value=ZA,e.connect(i).connect(De.destination),e.start(0)}let gn=null,_r=null;function ru(){if(!De||!Fn.musicEnabled||gn)return;const n=iu.music;n&&(gn=De.createBufferSource(),gn.buffer=n,gn.loop=!0,_r=De.createGain(),_r.gain.value=$A,gn.connect(_r).connect(De.destination),gn.start(0))}function Ip(){if(gn){try{gn.stop()}catch{}gn.disconnect(),gn=null}_r&&(_r.disconnect(),_r=null)}function tw(){return Fn.sfxEnabled}function ew(){return Fn.musicEnabled}function nw(n){Fn.sfxEnabled=n,Pp()}function iw(n){Fn.musicEnabled=n,Pp(),n?ru():Ip()}function Fd(){Ip()}function Bd(){ru()}const Dp="roborun:steering",rw=55,Ee={mode:Oh,laneZone:Fh,hysteresis:Bh,jumpTilt:Hh,sensitivity:rw};function sw(){try{const n=window.localStorage.getItem(Dp);if(!n)return;const t=JSON.parse(n);Uh.includes(t.mode)&&(Ee.mode=t.mode);for(const e of["laneZone","hysteresis","jumpTilt","sensitivity"])typeof t[e]=="number"&&Number.isFinite(t[e])&&(Ee[e]=t[e])}catch{}}function ow(){try{window.localStorage.setItem(Dp,JSON.stringify(Ee))}catch{}}function aw(){window.Unity&&window.Unity.call(`gb:sensitivity:${Math.round(Ee.sensitivity)}`)}function Np(){Nb(Ee.mode),Ub(Ee.laneZone),Ob(Ee.hysteresis),Fb(Ee.jumpTilt),aw()}const Up=[];function Op(n){Up.push(n)}function Hd(){Np(),ow(),Up.forEach(n=>n())}function Fp(n){const t=[];let e=0;function i(d,h,m){const{key:g,min:_,max:p,step:f}=d;let T=m[g]+h*f;T>p+1e-9?T=_:T<_-1e-9&&(T=p),m[g]=Math.round(T/f)*f,Hd()}function r({label:d,key:h,min:m,max:g,step:_,fmt:p,note:f,mode:T,state:y}){const E=document.createElement("div");E.className="sp-row",T&&(E.dataset.mode=T);const N=document.createElement("span");N.className="sp-label",N.textContent=d;const A=document.createElement("button");A.type="button",A.innerHTML="&minus;";const w=document.createElement("span");w.className="sp-value";const P=document.createElement("button");P.type="button",P.textContent="+";const M={el:E,key:h,min:m,max:g,step:_,mode:T,refresh:()=>{w.textContent=p(y[h])},activate:()=>i(M,1,y)};if(A.addEventListener("click",()=>i(M,-1,y)),P.addEventListener("click",()=>i(M,1,y)),E.append(N,A,w,P),n.appendChild(E),f){const S=document.createElement("div");S.className="sp-note",S.textContent=f,T&&(S.dataset.mode=T),n.appendChild(S)}return t.push(M),M}function s({label:d,get:h,onStep:m,fmt:g,note:_}){const p=document.createElement("div");p.className="sp-row";const f=document.createElement("span");f.className="sp-label",f.textContent=d;const T=document.createElement("button");T.type="button",T.innerHTML="&minus;";const y=document.createElement("span");y.className="sp-value";const E=document.createElement("button");E.type="button",E.textContent="+";const N={el:p,refresh:()=>{y.textContent=g(h())},activate:()=>m(1)};T.addEventListener("click",()=>m(-1)),E.addEventListener("click",()=>m(1)),p.append(f,T,y,E),n.appendChild(p);let A=null;return _&&(A=document.createElement("div"),A.className="sp-note",A.textContent=_,n.appendChild(A)),N.setNote=(w,P)=>{A&&(A.textContent=w,A.classList.toggle("sp-note-warn",!!P))},N.defaultNote=_,t.push(N),N}function o({label:d,note:h,values:m,get:g,set:_}){const p=document.createElement("div");p.className="sp-row";const f=document.createElement("span");f.className="sp-label",f.textContent=d;const T=document.createElement("button");T.type="button",T.className="sp-mode";const y={el:p,refresh:()=>{T.textContent=g()},activate:()=>{_(m[(m.indexOf(g())+1)%m.length]),Hd()}};if(T.addEventListener("click",y.activate),p.append(f,T),n.appendChild(p),h){const E=document.createElement("div");E.className="sp-note",E.textContent=h,n.appendChild(E)}return t.push(y),y}function a({label:d,run:h}){const m=document.createElement("button");m.type="button",m.className="sp-wide",m.textContent=d;const g={el:m,refresh:()=>{},activate:()=>{me("sfx_ui_tap");const _=h();_&&(m.textContent=_,window.setTimeout(()=>{m.textContent=d},1200))}};return m.addEventListener("click",g.activate),n.appendChild(m),t.push(g),g}function l(d){const h=document.createElement("div");return h.className="sp-chip-row",n.appendChild(h),d.map(({label:m,run:g})=>{const _=document.createElement("button");_.type="button",_.className="sp-chip",_.textContent=m;const p={el:_,refresh:()=>{},activate:()=>{me("sfx_ui_tap");const f=g();f&&(_.textContent=f,window.setTimeout(()=>{_.textContent=m},1200))}};return _.addEventListener("click",p.activate),h.appendChild(_),t.push(p),p})}function c(d){n.querySelectorAll('[data-mode="absolute"]').forEach(h=>{h.classList.toggle("sp-dim",d!=="absolute")}),n.querySelectorAll('[data-mode="stepped"]').forEach(h=>{h.classList.toggle("sp-dim",d==="absolute")})}function u(){t.forEach((d,h)=>d.el.classList.toggle("sp-sel",h===e))}return{rows:t,addStepper:r,addExternalStepper:s,addChoice:o,addAction:a,addChipRow:l,refreshRelevance:c,refreshSelection:u,getSelected:()=>e,setSelected:d=>{e=d}}}let Bp=!1;function lw(n){Bp=n}function cw(){return Bp}const Ja=document.getElementById("calibration-overlay"),Sc=document.getElementById("calibration-title"),uw=document.getElementById("calibration-board"),Ss=document.getElementById("calibration-board-wrap"),zd={right:document.querySelector(".cal-foot-right"),left:document.querySelector(".cal-foot-left")},su=document.getElementById("calibration-progress"),kd=document.getElementById("calibration-progress-fill"),or=document.getElementById("calibration-sub"),fr=document.getElementById("calibration-value"),ou=document.getElementById("calibration-cancel"),fw=1200,dw=32,Qa={right:{title:"LEAN RIGHT",sub:"All the way, then hold."},left:{title:"LEAN LEFT",sub:"All the way, then hold."}};let is=!1,rs=!1,Mc=null,yc=null,Wo="cancel",Zn=null;function hw(){return rs}function pw(n,t){Mc=n,yc=t}function tl(n){zd.right.classList.toggle("active",n==="right"),zd.left.classList.toggle("active",n==="left")}function vo(n){const t=Math.max(-1,Math.min(1,n||0))*dw;uw.style.transform=`perspective(380px) rotateY(${t.toFixed(1)}deg)`}const mw=450;let xo=0,Gd=null;function ir(n){Ss.classList.toggle("reaching",n)}function el(n,t){Ss.classList.toggle("counting",n&&t<1),Ss.classList.toggle("held",n&&t>=1),su.classList.toggle("visible",n),kd.style.width=`${(n?t:0)*100}%`,kd.classList.toggle("full",n&&t>=1)}function hi(n,t){const e=Math.max(0,Math.min(1,t||0));if(window.clearTimeout(Gd),n&&e>=1){xo=performance.now()+mw,el(!0,1);return}const i=xo-performance.now();if(i>0){Gd=window.setTimeout(()=>{xo=0,el(n,e)},i);return}xo=0,el(n,e)}function Eo({title:n,value:t,warn:e,sub:i}){Sc.textContent=n,or.textContent=i,Ss.classList.add("hidden"),su.classList.add("hidden"),t!=null?(fr.textContent=t,fr.classList.toggle("warn",!!e),fr.classList.remove("hidden")):fr.classList.add("hidden"),Wo="ok",ou.textContent="OK"}function _w(){Ss.classList.remove("hidden"),su.classList.remove("hidden"),fr.classList.add("hidden"),fr.classList.remove("warn"),Wo="cancel",ou.textContent="CANCEL"}function nl(){return new Promise(n=>{Zn=n})}function gw(n){return new Promise(t=>{const e=performance.now(),i=()=>{if(is||performance.now()-e>=n){t();return}requestAnimationFrame(i)};i()})}function vw(){if(!Ja)return{open:async()=>!1};ou.addEventListener("click",t=>{if(t.stopPropagation(),Wo==="ok"){if(Zn){const e=Zn;Zn=null,e()}}else is=!0}),window.addEventListener("keydown",t=>{if(rs&&!(t.code!=="Enter"&&t.code!=="Space")&&(t.preventDefault(),t.stopImmediatePropagation(),Wo==="ok"&&Zn)){const e=Zn;Zn=null,e()}},!0);async function n(){if(!Bo()||rs)return!1;rs=!0,is=!1,Ja.classList.remove("hidden"),Mc&&Mc(),Sc.textContent="STAND ON THE BOARD",or.textContent="Get comfortable.",_w(),vo(0),hi(!1,0),ir(!1),tl(null),await gw(fw);let t={cancelled:!0};return is||(t=await rM({isCancelled:()=>is,onPhase:e=>{const i=Qa[e];i&&(Sc.textContent=i.title,or.textContent=i.sub),hi(!1,0),ir(!1),tl(Qa[e]?e:null)},onGateOpen:()=>{or.textContent="Keep going -- all the way to your limit.",ir(!0),hi(!1,0)},onHoldStart:()=>{or.textContent="Got it -- hold it there...",ir(!1),hi(!0,0)},onGateClose:e=>{const i=Qa[e];i&&(or.textContent=i.sub),ir(!1),hi(!1,0)},onHoldProgress:e=>hi(!0,e),onTilt:e=>vo(e)})),hi(!1,0),ir(!1),tl(null),vo(0),t.cancelled?t.reason==="implausible"?(Eo({title:"OUT OF RANGE",value:`${Math.round(t.computed)}°`,warn:!0,sub:"Calibration only accepts 6° to 30°. Nothing was changed."}),await nl()):t.reason==="timeout"&&(Eo({title:"NO CLEAR READING",sub:"Nothing was changed. Try again from Settings."}),await nl()):(t.applied?Eo({title:"ALL SET",value:`${t.applied.value}°`,sub:"Lean this far for full steering."}):Eo({title:"COULDN'T SAVE",sub:"Nothing was changed. Try again from Settings."}),await nl()),Ja.classList.add("hidden"),vo(0),Zn=null,rs=!1,yc&&yc(),!0}return{open:n}}let Qn=null,pe=null,Tc=null,bc=null,$e=null,$n={value:Kl,min:5,max:45},Ac=!1;function Hp(){Bo()&&Ih().then(n=>{n&&($n=n,Ac=!0),$e&&$e.refresh()})}const xw=15e3,Ew=4e3;let jr=!1,il=null;function Sw(n,t){Tc=n,bc=t}function ss(n){const t=!Qn.classList.contains("hidden");n!==t&&(Qn.classList.toggle("hidden",!n),n?(pe.setSelected(0),pe.refreshSelection(),Hp(),Tc&&Tc()):bc&&bc())}function Mw(){Qn&&ss(!1)}function yw(){sw(),Np();const n=document.getElementById("steering-button");if(Qn=document.getElementById("steering-panel"),!n||!Qn)return;pe=Fp(Qn);const t=vw();n.addEventListener("click",()=>{me("sfx_ui_tap"),ss(Qn.classList.contains("hidden"))}),pe.addStepper({label:"SENSITIVITY",key:"sensitivity",mode:"stepped",min:0,max:100,step:5,fmt:e=>`${Math.round(e)}`,state:Ee}),pe.addChoice({label:"SFX",values:["ON","OFF"],get:()=>tw()?"ON":"OFF",set:e=>nw(e==="ON")}),pe.addChoice({label:"MUSIC",values:["ON","OFF"],get:()=>ew()?"ON":"OFF",set:e=>iw(e==="ON")}),pe.addAction({label:"CALIBRATE BOARD",run:()=>Bo()?(t.open(),ss(!1),null):"NOT AVAILABLE"}),$e=pe.addExternalStepper({label:"MAX TILT ANGLE",get:()=>$n.value,fmt:e=>Ac?`${e}°`:"...",note:"how far you need to lean for full steering",onStep:e=>{if(!Bo()){$e.setNote("NOT AVAILABLE",!0),window.setTimeout(()=>$e.setNote($e.defaultNote,!1),1200);return}if(sM()<xw&&!jr){jr=!0,$e.setNote("You just calibrated -- press again to change anyway.",!0),clearTimeout(il),il=window.setTimeout(()=>{jr=!1,$e.setNote($e.defaultNote,!1)},Ew);return}jr&&(clearTimeout(il),jr=!1,$e.setNote($e.defaultNote,!1));let r=$n.value+e;r>$n.max?r=$n.min:r<$n.min&&(r=$n.max),Dh(r).then(s=>{s&&($n=s,Ac=!0),$e.refresh()})}}),pe.addAction({label:"CLOSE",run:()=>(ss(!1),null)}),pe.rows.forEach(e=>e.refresh()),pe.refreshRelevance(Ee.mode),pe.refreshSelection(),Hp(),Op(()=>{pe.rows.forEach(e=>e.refresh()),pe.refreshRelevance(Ee.mode)}),window.addEventListener("keydown",e=>{if(e.code!=="Enter"&&e.code!=="Space"||cw()||hw())return;const i=document.getElementById("gameover-overlay");if(i&&!i.classList.contains("hidden"))return;const r=document.getElementById("level-complete");if(r&&!r.classList.contains("hidden"))return;const s=document.getElementById("victory-overlay");if(!(s&&!s.classList.contains("hidden"))){if(Qn.classList.contains("hidden")){if(e.code!=="Enter")return;e.preventDefault(),me("sfx_ui_tap"),ss(!0);return}e.preventDefault(),e.code==="Enter"?(pe.setSelected((pe.getSelected()+1)%pe.rows.length),pe.refreshSelection()):pe.rows[pe.getSelected()].activate()}})}const Tw="&#128295;";let wc=null;function bw(n){wc=n}let Rc=null;function Aw(n){Rc=n}let Cc=null;function ww(n){Cc=n}function Rw(){const n=document.createElement("button");n.id="dev-button",n.type="button",n.title="Dev Tools",n.innerHTML=Tw;const t=document.createElement("div");t.id="dev-panel",t.className="hidden";const e=Fp(t);function i(a){t.classList.toggle("hidden",!a),n.classList.toggle("on",a),lw(a),a&&(Mw(),e.setSelected(0),e.refreshSelection())}n.addEventListener("click",()=>{me("sfx_ui_tap"),i(t.classList.contains("hidden"))});const r=document.createElement("div");r.className="sp-keyhint",r.textContent="ENTER = next row   SPACE = change",t.appendChild(r),e.addChoice({label:"MODE",values:Uh,get:()=>Ee.mode,set:a=>{Ee.mode=a},note:"absolute needs forwardSteeringKeys = OFF on the scene"}),e.addStepper({label:"LANE ZONE",key:"laneZone",mode:"absolute",min:.1,max:.9,step:.05,fmt:a=>a.toFixed(2),note:"lean past this to leave the centre lane",state:Ee}),e.addStepper({label:"HYSTERESIS",key:"hysteresis",mode:"absolute",min:0,max:.4,step:.02,fmt:a=>a.toFixed(2),note:"stops a lean parked on the edge flapping between lanes",state:Ee}),e.addStepper({label:"JUMP TILT",key:"jumpTilt",mode:"absolute",min:.15,max:.95,step:.05,fmt:a=>a.toFixed(2),note:"lean forward OR back to jump (analog sends no arrows)",state:Ee}),e.addChoice({label:"VFX",values:["ON","OFF"],get:()=>bs()?"ON":"OFF",set:a=>qb(a==="ON")}),e.addAction({label:"RECENTRE BOARD",run:()=>Hb()?"CENTRED ✓":"NO SENSOR (BROWSER)"}),e.addAction({label:"NEXT THEME (DEV)",run:()=>wc?wc()===!1?"NOT RUNNING":"JUMPING...":"NOT READY"});const s=document.createElement("div");s.className="sp-label",s.style.marginTop="10px",s.textContent="ADD POINTS",t.appendChild(s),e.addChipRow([100,300,500,1e3].map(a=>({label:`+${a}`,run:()=>Rc?Rc(a)===!1?"NOT RUNNING":"ADDED":"NOT READY"}))),e.addAction({label:"SHOW FINAL ENDING SCREEN",run:()=>Cc?Cc()===!1?"NOT RUNNING":"SHOWING...":"NOT READY"}),e.addAction({label:"CLOSE",run:()=>(i(!1),null)}),e.rows.forEach(a=>a.refresh()),e.refreshRelevance(Ee.mode),e.refreshSelection(),Op(()=>{e.rows.forEach(a=>a.refresh()),e.refreshRelevance(Ee.mode)}),window.addEventListener("keydown",a=>{if(a.code!=="Enter"&&a.code!=="Space"||t.classList.contains("hidden"))return;const l=document.getElementById("gameover-overlay");if(l&&!l.classList.contains("hidden"))return;const c=document.getElementById("level-complete");if(c&&!c.classList.contains("hidden"))return;const u=document.getElementById("victory-overlay");u&&!u.classList.contains("hidden")||(a.preventDefault(),a.code==="Enter"?(e.setSelected((e.getSelected()+1)%e.rows.length),e.refreshSelection()):e.rows[e.getSelected()].activate())});let o=!1;return{button:n,panel:t,mount(){o||(o=!0,document.body.appendChild(n),document.body.appendChild(t),i(!0))}}}const Cw=7e3,rl="2128",Lw=["1","2","3","4","5","6","7","8","9"],Pw=550;function Iw(n,t,e){if(!t)return;let i=null,r=null,s="",o=!1,a=null;function l(){const _=n.createElement("div");_.id="devcode-overlay";const p=n.createElement("div");p.id="devcode-card";const f=n.createElement("div");f.id="devcode-head";const T=n.createElement("div");T.id="devcode-dots";const y=n.createElement("button");y.id="devcode-close",y.type="button",y.textContent="×",y.addEventListener("click",N=>{N.stopPropagation(),h()}),f.appendChild(T),f.appendChild(y);const E=n.createElement("div");return E.id="devcode-grid",Lw.forEach(N=>{const A=n.createElement("button");A.type="button",A.className="devcode-key",A.textContent=N,A.addEventListener("click",w=>{w.stopPropagation(),u(N,T)}),E.appendChild(A)}),p.appendChild(f),p.appendChild(E),_.appendChild(p),_.addEventListener("click",N=>N.stopPropagation()),{wrap:_,dots:T}}function c(_){_.textContent="•".repeat(s.length)+"–".repeat(Math.max(0,rl.length-s.length))}function u(_,p){if(!o&&(s+=_,c(p),!(s.length<rl.length))){if(s===rl){h(),e();return}o=!0,p.classList&&p.classList.add("devcode-wrong"),a=setTimeout(()=>{o=!1,s="",p.classList&&p.classList.remove("devcode-wrong"),c(p)},Pw)}}function d(){if(r)return;s="";const _=l();r=_.wrap,c(_.dots),n.body.appendChild(r)}function h(){r&&(clearTimeout(a),a=null,o=!1,r.remove(),r=null,s="")}const m=()=>{r||(clearTimeout(i),i=setTimeout(d,Cw),t.classList.add("devhold"))},g=()=>{clearTimeout(i),i=null,t.classList.remove("devhold")};return t.addEventListener("pointerdown",m),["pointerup","pointerleave","pointercancel"].forEach(_=>t.addEventListener(_,g)),{open:d,close:h}}const Dw=le.length,Nw=-26,Uw=1,Ow=1.8,Fw=[5.8,11.2],Bw=[3,6.9,10,12.8],Hw=[6.8],zw=[3.4,6.4,9.4,12.4],kw=[5.4,9],Gw=[2.8,6.8],Vw=[3.4,6.2,9.2],Ww=[7.6],Xw=new URLSearchParams(location.search),Yw=250,qw=3e3,Vd=`http://${location.hostname}:5300/s`,Wd=60;function Zw({canvas:n,probe:t,label:e="game"}={}){if(Xw.get("perf")!=="1")return{frame(){},mark(){}};const i=document.createElement("div");i.style.cssText=["position:fixed","top:0","left:0","z-index:2147483647","font:11px/1.35 ui-monospace,Menlo,monospace","background:rgba(8,8,10,.82)","color:#e8e8e6","padding:6px 8px","margin:0","white-space:pre","pointer-events:none","border-bottom-right-radius:6px","text-shadow:0 1px 0 #000"].join(";"),document.body.appendChild(i);const r=[],s=[];let o=0,a=performance.now(),l=0,c=0,u=0,d=0;const h=`${e}  screen ${screen.width}x${screen.height}`;function m(){const f=r.length,T=f?r.reduce((C,W)=>C+W,0)/f:0,y=T?1e3/T:0,E=n?n.width:0,N=n?n.height:0,A=E*N/1e6,w=n?Math.round(n.clientWidth):0,P=n?Math.round(n.clientHeight):0,M=s.length?s.reduce((C,W)=>C+W,0)/s.length:0,S=[h,`${A.toFixed(2)} Mpx   ${E}x${N}`,`css ${w}x${P}  dpr ${(window.devicePixelRatio||1).toFixed(2)}`,`${y.toFixed(1)} fps  avg ${T.toFixed(1)}ms  worst ${l.toFixed(0)}ms`,`js ${M.toFixed(1)}ms  =  ${T?Math.round(M/T*100):0}% of frame`];if(t)try{S.push(...t())}catch{}i.textContent=S.join(`
`),l=0}function g(){const f=r.length,T=f?r.reduce((P,M)=>P+M,0)/f:0,y=s.length?s.reduce((P,M)=>P+M,0)/s.length:0,E=n?n.width:0,N=n?n.height:0;let A="";if(t)try{A=t().join("  ")}catch{}const w=JSON.stringify({label:e,screen:`${screen.width}x${screen.height}`,backing:`${E}x${N}`,mpx:E*N/1e6,dpr:window.devicePixelRatio||1,css:n?`${Math.round(n.clientWidth)}x${Math.round(n.clientHeight)}`:"",fps:T?1e3/T:0,avgMs:T,jsMs:y,worst:d,extra:A});d=0;try{const P=new Blob([w],{type:"text/plain;charset=UTF-8"});(!navigator.sendBeacon||!navigator.sendBeacon(Vd,P))&&fetch(Vd,{method:"POST",body:w,keepalive:!0}).catch(()=>{})}catch{}}function _(){o=performance.now()}function p(){const f=performance.now();if(o){const y=f-o;y>=0&&y<1e3&&(s.push(y),s.length>Wd&&s.shift()),o=0}const T=f-a;a=f,T>0&&T<1e3&&(r.push(T),r.length>Wd&&r.shift(),T>l&&(l=T),T>d&&(d=T)),f-c>Yw&&(c=f,m()),f-u>qw&&(u=f,g())}return m(),{frame:p,mark:_}}const $w=new URLSearchParams(location.search),Xd=1.6;function Kw(){const n=$w.get("budget");if(n==null)return Xd;const t=Number(n);return n==="0"?null:Number.isFinite(t)&&t>0?t:Xd}function jw(n,t,e=2){const i=Math.min(window.devicePixelRatio||1,e),r=Kw();if(!r||n<=0||t<=0)return i;const s=Math.sqrt(r*1e6/(n*t));return Math.min(i,s)}function Jw(){const n=document.createElement("canvas");n.width=32,n.height=32;const t=n.getContext("2d"),e=t.createRadialGradient(16,16,0,16,16,16);return e.addColorStop(0,"rgba(255,255,255,1)"),e.addColorStop(.5,"rgba(255,255,255,0.6)"),e.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=e,t.fillRect(0,0,32,32),new kc(n)}let sl=null;function Qw(){return sl||(sl=Jw()),sl}class ol{constructor(t,e,i,r=1){this.count=e,this.cursor=0,this.positions=new Float32Array(e*3),this.colors=new Float32Array(e*3),this.baseColors=new Float32Array(e*3),this.velocities=new Float32Array(e*3),this.life=new Float32Array(e),this.maxLife=new Float32Array(e),this.gravity=new Float32Array(e),this.swirl=new Float32Array(e),this.centerX=new Float32Array(e),this.centerZ=new Float32Array(e);const s=new hn;s.setAttribute("position",new Ce(this.positions,3)),s.setAttribute("color",new Ce(this.colors,3));const o=new Ph({size:i,map:Qw(),vertexColors:!0,transparent:!0,opacity:r,depthWrite:!1,depthTest:!1,blending:Uo,sizeAttenuation:!0,fog:!1});this.points=new _E(s,o),this.points.frustumCulled=!1,this.points.renderOrder=999,t.add(this.points)}spawn(t,e,i,r,{count:s=1,speed:o=2,spread:a=.15,life:l=.4,upBias:c=0,gravity:u=2,dirX:d=0,dirY:h=0,dirZ:m=0,dirSpread:g=Math.PI,warmup:_=0,swirl:p=0}={}){const f=new Vt(r);for(let T=0;T<s;T++){const y=this.cursor;this.cursor=(this.cursor+1)%this.count;const E=Math.random()*Math.PI*2,N=Math.random()*g,A=Math.sin(N);let w=A*Math.cos(E),P=Math.cos(N),M=A*Math.sin(E);(d||h||m)&&(w+=d,P+=h,M+=m);const S=Math.hypot(w,P,M)||1,C=o*(.5+Math.random()*.5);this.velocities[y*3+0]=w/S*C,this.velocities[y*3+1]=P/S*C+c,this.velocities[y*3+2]=M/S*C,this.positions[y*3+0]=t+(Math.random()-.5)*a,this.positions[y*3+1]=e+(Math.random()-.5)*a*.3,this.positions[y*3+2]=i+(Math.random()-.5)*a,this.baseColors[y*3+0]=f.r,this.baseColors[y*3+1]=f.g,this.baseColors[y*3+2]=f.b,this.gravity[y]=u,this.maxLife[y]=l,this.life[y]=l,this.swirl[y]=p?p*(.85+Math.random()*.3):0,this.centerX[y]=t,this.centerZ[y]=i,_>0&&(this.velocities[y*3+1]-=this.gravity[y]*_,this.positions[y*3+0]+=this.velocities[y*3+0]*_,this.positions[y*3+1]+=this.velocities[y*3+1]*_,this.positions[y*3+2]+=this.velocities[y*3+2]*_)}}update(t){let e=!1;for(let i=0;i<this.count;i++){if(this.life[i]<=0)continue;e=!0,this.life[i]-=t;const r=Math.max(this.life[i],0)/this.maxLife[i];if(this.velocities[i*3+1]-=this.gravity[i]*t,this.positions[i*3+0]+=this.velocities[i*3+0]*t,this.positions[i*3+1]+=this.velocities[i*3+1]*t,this.positions[i*3+2]+=this.velocities[i*3+2]*t,this.swirl[i]!==0){const s=this.positions[i*3+0]-this.centerX[i],o=this.positions[i*3+2]-this.centerZ[i],a=this.swirl[i]*t,l=Math.cos(a),c=Math.sin(a);this.positions[i*3+0]=this.centerX[i]+s*l-o*c,this.positions[i*3+2]=this.centerZ[i]+s*c+o*l}this.colors[i*3+0]=this.baseColors[i*3+0]*r,this.colors[i*3+1]=this.baseColors[i*3+1]*r,this.colors[i*3+2]=this.baseColors[i*3+2]*r}e&&(this.points.geometry.attributes.position.needsUpdate=!0,this.points.geometry.attributes.color.needsUpdate=!0)}scrollZ(t,e=0){for(let i=0;i<this.count;i++)this.life[i]<=0||(this.positions[i*3+2]+=t,e&&(this.positions[i*3+0]+=Math.sign(this.velocities[i*3+0])*e*t));this.points.geometry.attributes.position.needsUpdate=!0}}function tR(n,t,e,i){n.spawn(t,e,i,8223349,{count:16,speed:2.1,life:.4,gravity:1.4,spread:.22,dirY:1,dirSpread:1,upBias:1.3,warmup:.07}),n.spawn(t,e,i,9407622,{count:8,speed:1.5,life:.32,gravity:1.1,spread:.16,dirY:1,dirSpread:.8,upBias:1,warmup:.07})}const al=4,Yd=5,qd=7,ll=.5;function eR(n,t,e,i,r,s,o){for(let a=0;a<Yd;a++)for(let l=0;l<al;l++){const c=t+(l/(al-1)-.5)*r*ll,u=e-s*ll/2+a/(Yd-1)*s*ll,d=o[(a*al+l)%o.length];n.spawn(c,u,i,d,{count:7,speed:4.6,life:.6,gravity:.35,spread:.05,dirSpread:Math.PI,upBias:.35,warmup:0,swirl:qd*(Math.random()<.5?-1:1)})}n.spawn(t,e,i,o[0],{count:40,speed:6.5,life:.65,gravity:.4,spread:.1,dirSpread:Math.PI,upBias:.6,warmup:0,swirl:qd})}function Zd(n,t,e,i,r){n.spawn(t,e,i,r,{count:12,speed:2.8,life:.34,gravity:.5,spread:.12,dirSpread:Math.PI,upBias:.7,warmup:0})}const zp=6,kp=-18,nR=8,iR=4.2,$d=.3,rR=3.4,Gp=1,sR=.06,oR=2.6,Kd=.5,Vp=1.6,au=[16777215,16773826,10483199];function aR(){return Kd+Math.random()*(Vp-Kd)}function lR(){const n=[];for(let t=0;t<zp;t++)n.push({x:0,y:0,z:kp,colorIdx:Math.floor(Math.random()*au.length),active:!1,wait:Math.random()*Vp});return n}function cR(n){n.active=!0,n.x=(Math.random()-.5)*2*iR,n.y=$d+Math.random()*(rR-$d),n.z=kp,n.colorIdx=Math.floor(Math.random()*au.length)}const Jr=new Re,jd=new Vt;function Wp(n,t,e,i){Jr.position.set(e.x,e.y,e.z),Jr.rotation.set(0,0,0),Jr.scale.set(1,1,e.active?i:0),Jr.updateMatrix(),n.setMatrixAt(t,Jr.matrix),jd.setHex(au[e.colorIdx]),n.setColorAt(t,jd)}function uR(n){const t=new On(.03,.03,1),e=new we({color:16777215,transparent:!0,opacity:.8,fog:!1}),i=new mE(t,e,zp);i.instanceMatrix.setUsage(Dm),n.add(i);const r=lR();return r.forEach((s,o)=>Wp(i,o,s,Gp)),i.instanceMatrix.needsUpdate=!0,i.instanceColor.needsUpdate=!0,{slots:r,mesh:i}}function fR(n,t,e){const{slots:i,mesh:r}=n,s=Gp+e*sR;for(const o of i){if(!o.active){o.wait-=t,o.wait<=0&&cR(o);continue}o.z+=e*oR*t,o.z>nR&&(o.active=!1,o.wait=aR())}i.forEach((o,a)=>Wp(r,a,o,s)),r.instanceMatrix.needsUpdate=!0}for(const[n,t]of[["--theme-curtain-left","lc_curtain_left.webp"],["--theme-curtain-right","lc_curtain_right.webp"],["--theme-board","gobalance_horizontal_board.webp"]])document.documentElement.style.setProperty(n,`url('${Ts(t)}')`);yb();function Jd(){const n=document.getElementById("app"),t=document.getElementById("stage"),e=new uE({antialias:!0});e.setPixelRatio(jw(window.innerWidth,window.innerHeight)),n.appendChild(e.domElement);const i=Zw({canvas:e.domElement,label:"roborun",probe:()=>{const $=e.info.render;return[`${$.calls} calls  ${($.triangles/1e3).toFixed(1)}k tris`]}});window.__perfScene=()=>r;const r=new fE,s=new je(yM,eo/no,.1,220);let o=Ia(r,po(1)),a=po(1);const l=By();r.add(l.sprite);const c=oT(r),u=Yr(),d=MT(r),h=Yr(Rf),m=yy(r),g=Yr(Lf),_=NT(r),p=Yr(Df),f=ZT(r),T=Yr(kf),y=WM(s),E=wb(),N=_b(),A=tT(r),w=new ol(r,100,.4,.14),P=.19,M=.1,S=uR(r),C=new ol(r,220,.5,.6),W=new ol(r,80,.28,.85),U=ib();let X=0,K=0,V=0,J=0;const G=.45;let it=sd(0);const ut=.14,Et=.42,Ft=.4,$t=document.getElementById("damage-flash");let k=0,et=-1/0,pt=-1/0,nt=1,yt=0,Tt=0,Pt=1,Jt=!1,zt=!1,ee=1,I=0,Me=0,Bt=0,Ht=0,Mt=0,qt=0,St=0;const b=()=>"ramp";function v($){const It=He=>{const Te=CT(yt,He);return Te>Math.abs(Pi)?null:-Te},Qt=$?Fw:kw,ce=$?Bw:Gw,fe=$?Hw:Ww,Ni=$?zw:Vw;fe.forEach((He,Te)=>{const x=It(He);x!==null&&jf(m,b(),(We+Te)%le.length,x)});for(const He of Qt){const Te=It(He);Te!==null&&ed(c,m,null,Te,!1)}for(const He of ce){const Te=It(He);Te!==null&&Ha(d,m,null,null,Te)}for(const He of Ni){const Te=It(He);Te!==null&&ld(_,m,c,k,Te)}}function F($){if(Hy(l),aT(c),yT(d),Ty(m),di(g,$?Lf:ty),UT(_),di(p,Df),$T(f),di(T,kf),XM(y),Ua(l,!0),Fa(A,!0),V=0,J=0,$t.style.opacity="0",et=-1/0,pt=-1/0,yt=k,$){for(let It=0;It<Dw;It++)Ha(d,m,null,It,Nw);pt=k,di(h,Uw),di(u,Ow)}else di(h,Rf),di(u,Yc);v($)}function q(){k=0,X=0,K=0,nt=1,Pt=1,Tt=0,Jt=!1;{const $=po(1);$&&$!==a&&(Af(r,o),o=Ia(r,$),a=$)}gb(N),rb(U),fo(),wA(),nr(U.displayed),Ka(N.lives),F(!0)}function j(){Lb(E),ee=1,I=0,Me=0,Bt=0,Ht=0,Mt=0,FA()}function Y(){ee=2,I=0,qt=0,St=0,wp(2),Od(0,mo[0])}function mt(){BA(),Kr.runStarted(),ot(),gd(E)}document.getElementById("intro-next-button").addEventListener("click",()=>{me("sfx_ui_tap"),E.current==="intro"&&ee===1&&Y()}),document.getElementById("intro-start-button").addEventListener("click",()=>{me("sfx_ui_tap"),E.current==="intro"&&ee===2&&mt()});function ot(){Kr.levelStarted(`tier_${nt}`,nt)}function dt(){const $=Kn(U.total);Kr.levelFailed(U.total,Math.round($.frac*100),100)}function kt($){Kr.levelCleared(U.total),Cb(E),me("sfx_level_complete"),Fd(),ka(U),fo(),nr(U.displayed),Pt=$,Tt=ho,Jt=!1,zt=!1,Id(ho),yA(nt,$)}function Q(){AA(),nt=Pt,ot(),F(!1),gd(E),Bd(),bA()}function ht($){qa($).then(()=>Za().then(It=>{const{top:Qt,window:ce}=$a(It.rows,$);LA(It,ce.length?[Qt,ce]:[Qt])}))}function bt(){dt(),Rb(E),me("sfx_gameover"),Ua(l,!0),Fa(A,!0),ka(U),fo(),nr(U.displayed),RA(U,X),ht(U.total)}function wt(){const $=vb(N,k);return $.hit?(Ka(N.lives),YM(y,Ft),V=ut,me("sfx_hit"),$.dead?(bt(),!0):!1):!1}function ft(){CA(),Nd(),q(),j()}document.getElementById("restart-button").addEventListener("click",ft),window.addEventListener("keydown",$=>{E.current==="gameover"&&($.code==="Space"||$.code==="Enter")?ft():E.current==="intro"&&($.code==="Space"||$.code==="Enter")&&(ee===1?Y():mt())});function Gt(){DA(),ft()}let Ct=!1;window.addEventListener("keydown",$=>{$.code==="KeyG"&&(Ct=!Ct,r.traverse(It=>{It.material&&"wireframe"in It.material&&(It.material.wireframe=Ct)}))});let Ut=!1;const L=document.getElementById("pause-button");function rt($){Ut=$,L.innerHTML=Ut?"&#9654;":"&#9208;",OA(Ut),Ut?Fd():E.current!=="levelcomplete"&&Bd()}L.addEventListener("click",()=>{me("sfx_ui_tap"),rt(!Ut)});const z=new Set;let Z=!1;function lt($){z.size===0&&(Z=Ut,rt(!0)),z.add($)}function at($){z.delete($)&&z.size===0&&rt(Z)}pw(()=>lt("calibration"),()=>at("calibration")),Sw(()=>lt("settings"),()=>at("settings"));function Rt(){if(Kr.gameLeft(),window.GoBalance&&typeof window.GoBalance.back=="function"){window.GoBalance.back();return}window.Unity&&window.Unity.call("nav:back")}let re=!1;window.__gbBack=()=>{if(NA())return Rt();if(!IA()){if(E.current!=="running")return Rt();re=Ut,rt(!0),PA()}};function ve(){Dd(),rt(!0);const $=U.total,It=`SCORE ${Math.floor($).toLocaleString()} · ${jo(Kn($).tier)}`;go(It,null,[]),qa($).then(()=>Za().then(Qt=>{const{top:ce,window:fe}=$a(Qt.rows,$);go(It,Qt,fe.length?[ce,fe]:[ce])}))}document.getElementById("confirm-stay").addEventListener("click",$=>{$.stopPropagation(),me("sfx_ui_tap"),Dd(),rt(re)}),document.getElementById("confirm-quit").addEventListener("click",$=>{$.stopPropagation(),me("sfx_ui_tap"),ve()}),document.getElementById("quit-again").addEventListener("click",$=>{$.stopPropagation(),me("sfx_ui_tap"),Gt(),rt(!1)}),document.getElementById("quit-leave").addEventListener("click",$=>{$.stopPropagation(),me("sfx_ui_tap"),Rt()});function Xt(){E.current==="running"&&(Pb(E),me("sfx_level_complete"),ka(U),fo(),nr(U.displayed),UA(`SCORE ${Math.floor(U.total).toLocaleString()}`))}function Be(){if(E.current!=="cleared")return;Nd();const $=U.total,It=`SCORE ${Math.floor($).toLocaleString()}`;go(It,null,[],"ALL TIERS CLEARED!"),qa($).then(()=>Za().then(Qt=>{const{top:ce,window:fe}=$a(Qt.rows,$);go(It,Qt,fe.length?[ce,fe]:[ce],"ALL TIERS CLEARED!")}))}document.getElementById("victory-continue").addEventListener("click",$=>{$.stopPropagation(),me("sfx_ui_tap"),Be()}),QA(),yw();const Ye=Rw();bw(()=>E.current!=="running"?!1:(kt(nt+1),!0));function As($){U.total+=$;const It=Kn(U.displayed).tier;if(U.displayed=U.total,nr(U.displayed,!0),pd(U.displayed)){Xt();return}const Qt=Kn(U.displayed).tier;Qt>It&&kt(Qt)}Aw($=>E.current!=="running"?!1:(As($),!0)),ww(()=>E.current!=="running"?!1:(Xt(),!0));const Ii=document.createElement("div");Ii.id="dev-hit",document.body.appendChild(Ii),Iw(document,Ii,Ye.mount),/[?&]dev=1\b/.test(window.location.search||"")&&Ye.mount(),lb(t,document.getElementById("hud"),document.getElementById("points-value"),($,It)=>{const Qt=Kn(U.displayed).tier;if(ab(U,$),nr(U.displayed,!0,It),E.current==="running"&&pd(U.displayed)){Xt();return}const ce=Kn(U.displayed).tier;ce>Qt&&E.current==="running"&&kt(ce)}),bp(Vc),window.addEventListener("keydown",$=>{$.code==="KeyM"&&td(l)});function pn(){const $=window.innerWidth,It=window.innerHeight;let Qt=$,ce=Qt*no/eo;ce>It&&(ce=It,Qt=ce*eo/no),t.style.width=`${Qt}px`,t.style.height=`${ce}px`,e.setSize(Qt,ce),s.aspect=eo/no,s.updateProjectionMatrix(),cb()}window.addEventListener("resize",pn),pn();let Di=l.frameIndex;const ws=new SE;function Dr(){requestAnimationFrame(Dr),i.mark();const $=Math.min(ws.getDelta(),1/30);if(!Ut&&E.current==="intro")if(I+=$,ee===1)Bt+=$,Bt>=xd&&(Bt-=xd,Me=(Me+1)%vd.length,Rp(vd[Me])),Mt+=$,Mt>=Ho&&(Mt-=Ho,Ht=(Ht+1)%on.length,Cp(Ht)),I>=Ib&&Y();else{St+=$;const It=mo[qt].holdSec;St>=It&&(St-=It,qt=(qt+1)%mo.length,Od(qt,mo[qt])),I>=Db&&mt()}if(!Ut&&E.current==="levelcomplete"){if(Tt-=$,Id(Math.max(1,Math.ceil(Tt))),!Jt&&ho-Tt>=dd&&(TA(),Jt=!0),!zt&&Jt&&ho-Tt>=dd+mb){zt=!0;{const It=po(Pt);It&&It!==a&&(Af(r,o),o=Ia(r,It),a=It)}}Tt<=0&&Q()}if(!Ut&&E.current==="running"){k+=$,it=sd(k),J>0&&(J=Math.max(0,J-$)),kb();const It=Vb(),Qt=It===null?Gb():Math.sign(It-l.targetLane);if(Qt!==0){const R=l.targetLane+Qt;R>=0&&R<=le.length-1&&(Dy(m,R,l.sprite.position.z,l.elevationY)?J<=0&&(ky(l,Qt),J=G):zy(l,R))}if(Wb()){const R=l.jumpElapsed===null;Vy(l),R&&me("sfx_jump")}Xy(l,$,m),GM(o,$,it);const ce=l.frameIndex!==Di&&(l.frameIndex===1||l.frameIndex===3)&&l.jumpElapsed===null;Di=l.frameIndex;const fe=bs();ce&&(eT(A),fe&&tR(w,l.sprite.position.x,.05+l.elevationY,l.sprite.position.z-P));const Ni=Va(N,k)&&Math.floor(k*14)%2!==0;if(Ua(l,!Ni),Fa(A,!Ni),V>0){V=Math.max(0,V-$);const R=V/ut;$t.style.opacity=`${R*Et}`}nT(A,l,$),w.points.visible=fe,S.mesh.visible=fe,fe&&(w.update($),w.scrollZ(it*$,M),fR(S,$,it)),X=vs(k);const He=nt===1?Xh:jM,x=hd(nt,tc)*nb(eb(k)-yt,He),D=nt===1?x:Math.min(x,hd(nt-1,tc));if(qr(u,$,()=>{k-pt>=Cf&&(ed(c,m),et=k)},D),uT(c,$,it),!Va(N,k)){for(const R of c.pool)if(dT(l,R)){wt();break}}if(!Va(N,k)){const R=Ny(l,m,l.jumpElapsed===null);R&&(wt()||Uy(R))}qr(h,$,()=>{k-et>=Cf&&(Ha(d,m),pt=k)},JM),bT(d,$,it,m);const O=AT(l,d);if(O){fe&&eR(C,O.sprite.position.x,O.sprite.position.y,O.sprite.position.z,O.sprite.scale.x,O.sprite.scale.y,O.type.poofColors);const R=O.sprite.position.x,tt=O.sprite.position.y,ct=O.sprite.position.z;wT(O),me("sfx_enemy_kill"),Wy(l,K),K+=1,fd(R,tt,ct,s,sb(U),"enemy")}C.points.visible=fe,fe&&C.update($),qr(g,$,()=>{jf(m,b())},QM),Ay(m,$,it),qr(p,$,()=>{ld(_,m,c,k)},ry),FT(_,$,it,m),HT(_,l,$,Gy(l));const H=BT(l,_,m);for(const R of H)me("sfx_coin"),fe&&Zd(W,R.sprite.position.x,R.sprite.position.y,R.sprite.position.z,R.type.sparkleColor),fd(R.sprite.position.x,R.sprite.position.y,R.sprite.position.z,s,ob(U,R.type),R.type===np.bonus?"bonus":"coin"),ip(R);W.points.visible=fe,fe&&W.update($),qr(T,$,()=>{N.lives<Nh&&Math.random()<py?ud(f,m,c,"life"):Math.random()<hy&&ud(f,m,c,"magnet")},dy),JT(f,$,it,m);for(const R of QT(l,f,m))fe&&Zd(W,R.sprite.position.x,R.sprite.position.y,R.sprite.position.z,R.type.sparkleColor),R.type.effect==="magnet"?td(l):R.type.effect==="life"&&xb(N)&&Ka(N.lives),sp(R)}Ut||fb($),Ut||EA($),qM(y,l.laneX,l.elevationY,Ut?0:$),e.render(r,s),i.frame()}q(),j(),Dr()}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",Jd):Jd();
