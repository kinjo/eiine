var GL, FB, TARGET;
var cliff, lifegame, blur;
var effectList = [];
var COUNT=0;
function initGL(){
  var flag=false;
  var canvas=document.getElementById("webglcanvas");
  canvas.style.position='absolute';
  canvas.style.left=canvas.style.top=0;
  GL=canvas.getContext("experimental-webgl");
  FB=GL.framebuffer=new FrameBufferObject();
  var renderTarget;
  window.onresize=function(){
    canvas.width=innerWidth;
    canvas.height=innerHeight;
    TARGET = new RenderTarget({width: canvas.width, height: canvas.width,x:0,y:-(canvas.width-canvas.height)/2});
    GL.framebuffer.setRenderTarget(TARGET);
    render();
  }
  GL.clearColor(0,0,0,1)
  GL.clear(GL.COLOR_BUFFER_BIT);
  GL.disable(GL.DEPTH_TEST);
  GL.enable(GL.BLEND);
  cliff = new CliffEffect('/webgl/effects/cliff/');
  blur = new BlurEffect('/webgl/effects/blur/');
  lifegame = new LifeGame('/webgl/effects/lifegame/');
  window.onresize();
  function timing(){
    var time1=new Date();
    render();
    var time2=new Date();
    var sleep = 16-(time2-time1);
    if(sleep<5)sleep=5
    setTimeout(timing,sleep);
  }
  timing();
}



function renderBackground(){
  cliff.render(TARGET);
  lifegame.render(TARGET, COUNT);
  blur.render(TARGET, COUNT);
  COUNT = 0;
}


function render(){
  GL.clear(GL.COLOR_BUFFER_BIT);
  GL.blendFunc(GL.ONE,GL.ZERO);
  renderBackground();
  var list=[];
  for(var i=0;i<effectList.length;i++){
    var effect = effectList[i];
    if(effect.render(TARGET)){
      list.push(effect);
    }
  }
  effectList = list;
}

function addEffect(n){COUNT+=(n||1);}

function addBigEffect(effect){
  effectList.push(effect);
}


function DelayEffect(effect, delay){
  this.time0=new Date();
  this.delay=delay;
  this.effect=effect;
  effect.time0=this.time0.getTime()+delay;
}
DelayEffect.prototype.render=function(target){
  var msec=(new Date()-this.time0);
  if(msec<this.delay)return true;
  return this.effect.render(target);
}


function genBigEffect(){
  var constructors = [AriaEffect, SugokuEffect];
  var constructor = constructors[Math.floor(constructors.length*Math.random())];
  return new constructor();
}
var bigSound;
onload=function(){
  initGL();
  AriaEffect.load('/webgl/aftereffect/aria/');
  SugokuEffect.load('/webgl/aftereffect/sugokuiine/');
  SquareEffect.load('/webgl/aftereffect/square/');
  bigSound=document.createElement("video");//new Audio();
  bigSound.src="/webgl/sounds/iyopon.mp3";

  var iine=0;
  var pre_update='';
  var iinen=0; // number of iine
  var n=0;

  var ws = new WebSocket('ws://' + $('#hostname').val());
  ws.onmessage = function (e) {
    eval('var json=' + e.data);
    if(pre_update != json.update){
      pre_update=json.update;
      iinen=json.count;
      iinen-=iine;
      iine=0;
      n=iinen;
      if(n>0)addEffect(n);
    }
    if(json.aftereffect){
      console.log('aftereffect received');
      addBigEffect(new DelayEffect(new SquareEffect(7000),300));
      addBigEffect(new DelayEffect(genBigEffect(),3100));
      bigSound.play();
    }
  };
  document.onclick=function(e){
    $.ajax({
      type:'POST',
      url:'/',
      data:{session_id:$('#session_id').val()},
      success:function(){
        ws.send('message');
        iine++;
        addEffect(1);
      },
      error:function(){
      }
    });
  }
}
