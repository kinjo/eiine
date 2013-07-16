var GL,FB;
function start(effectClass,baseURL,aftereffectClass,aftereffectBaseURL){
  var iine=0;
  var flag=false;
  var pre_update='';
  var iinen=0; // number of iine
  var ws = new WebSocket('ws://' + $('#hostname').val());
  ws.onmessage = function (e) {
    eval('var json=' + e.data);
    if(pre_update != json.update){
      flag=true;
      pre_update=json.update;
      iinen+=json.count;
      iinen-=iine;
      iine=0;
    }
    if(json.aftereffect){
      aftereffect.render(renderTarget,1);
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
        effect.render(renderTarget,1);
      },
      error:function(){
      }
    });
  }
  //document.body.onkeydown=function(){flag=true;}
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
  GL.clearColor(0,1,0,1)
  GL.clear(GL.COLOR_BUFFER_BIT);
  GL.disable(GL.DEPTH_TEST);
  GL.enable(GL.BLEND);
  var effect = new effectClass(baseURL);
  var aftereffect = new aftereffectClass(aftereffectBaseURL);
  effect.render(renderTarget,1);
  var t=new Date();
  setInterval(function(){
    GL.clear(GL.COLOR_BUFFER_BIT);
    if(flag&&(new Date()-1000/10>t)){
      // reander the iine
      for (var i=0;i<iinen;i++) {
        effect.render(renderTarget,1);
      }
      iinen=0; // clear number of iine
      flag=false;
      t=new Date();
    }else {
      effect.render(renderTarget,0);
      aftereffect.render(renderTarget,0);
    }
  },10);
}
