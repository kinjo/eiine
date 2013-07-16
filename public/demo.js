var GL,FB;
function start(){
  var iine=0;
  var flag=false;
  var pre_update='';
  var iinen=0; // number of iine
  var ws = new WebSocket('ws://' + $('#hostname').val());
  var n=0;
  //document.body.onclick=function(){flag=true;}
  //document.body.onkeydown=function(){flag=true;}
  ws.onmessage = function (e) {
    eval('var json=' + e.data);
    if(pre_update != json.update){
      flag=true;
      pre_update=json.update;
      iinen=json.count;
      iinen-=iine;
      iine=0;
      n=iinen;
    }
    if(json.aftereffect){
      //aftereffect.render(renderTarget,1);
      console.log('aftereffect received');
    }
  };
  document.body.onclick=function(){
    $.ajax({
      type:'POST',
      url:'/',
      data:{session_id:$('#session_id').val()},
      success:function(){
        ws.send('message');
        iine++;
        flag=true;
        n=1;
      },
      error:function(){
      }
    });
  }
  var canvas=document.getElementById("webglcanvas");
  canvas.style.position='absolute';
  canvas.style.left=canvas.style.top=0;
  GL=canvas.getContext("experimental-webgl");
  GL.framebuffer=new FrameBufferObject();
  var renderTarget;
  window.onresize=function(){
    canvas.width=innerWidth;
    canvas.height=innerHeight;
    renderTarget = new RenderTarget({width: canvas.width, height: canvas.width,x:0,y:-(canvas.width-canvas.height)/2});
    GL.framebuffer.setRenderTarget(renderTarget);
  }
  window.onresize();
  GL.clearColor(0,0,0,1)
  GL.clear(GL.COLOR_BUFFER_BIT);
  GL.disable(GL.DEPTH_TEST);
  GL.enable(GL.BLEND);
  var effect1 = new LifeGame('/webgl/effects/lifegame/');
  var effect2 = new BlurEffect('/webgl/effects/blur/');
  var effect3 = new SquareEffect('/webgl/aftereffect/square/');
  var effect4 = new SugokuEffect('/webgl/aftereffect/sugokuiine/');
  effect1.render(renderTarget,1);
  effect2.render(renderTarget,1);
  var t=new Date();
  setInterval(function(){
    GL.clear(GL.COLOR_BUFFER_BIT);
    GL.blendFunc(GL.ONE,GL.ZERO);
    if(flag&&n>0&&(new Date()-1000/10>t)){
      var q=Math.floor(Math.random()*2);
      if(q==0){
        effect1.render(renderTarget,n);
        effect2.render(renderTarget,0);
      }else{
        effect1.render(renderTarget,0);
        effect2.render(renderTarget,n);
      }
      flag=false;
      t=new Date();
    }else{
      effect1.render(renderTarget,0);
      effect2.render(renderTarget,0);
    }
    effect3.render(renderTarget);
    effect4.render(renderTarget);
  },10);
  // message polling. message is not sent when browser is quiet
  setInterval(function(){
    ws.send('message');
  },500);
}
