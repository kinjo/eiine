var GL,FB;
function start(effectClass){
  var flag=false;
  var canvas=document.getElementById("webglcanvas");
  GL=canvas.getContext("experimental-webgl");
  GL.framebuffer=new FrameBufferObject();
  var renderTarget = new RenderTarget({width: canvas.width, height: canvas.height});
  GL.framebuffer.setRenderTarget(renderTarget);
  GL.clearColor(0,1,0,1)
  GL.clear(GL.COLOR_BUFFER_BIT);
  GL.disable(GL.DEPTH_TEST);
  var effect = new effectClass();
  //effect.render(renderTarget,1);
  var t=new Date();

  var pre_update='';
  var iinen=0; // number of iine
  var ws = new WebSocket('ws://' + $('#hostname').val());
  var ws_open=false;
  ws.onopen = function () {
    ws.send('message');
    ws_open=true;
  };
  ws.onmessage = function (e) {
    eval('var json=' + e.data);
    if(pre_update != json.update){
      flag=true;
      pre_update=json.update;
      iinen+=json.count;
    }
  };
  // FIXME: There is no immediacy in 4500 seconds.
  // When clients increase, immediacy is improved,
  // but, the load increases.
  setInterval(function(){
    if(ws_open){
      ws.send('message');
    }
  }, 500); // 4500
  var iinef = function(){
    //effect.render(renderTarget,1);
    $.ajax({
      type:'POST',
      url:'/'
    });
  };
  $('body').click(iinef).keydown(iinef);

  setInterval(function(){
    if(flag&&(new Date()-1000/10>t)){
      // reander the iine
      for (var i=0;i<iinen;i++) {
        effect.render(renderTarget,1);
      }
      iinen=0; // clear number of iine
      flag=false;
      t=new Date();
    }else effect.render(renderTarget,0);
  },10);
}

