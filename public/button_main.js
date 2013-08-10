var ws;
onload=function(){
  start("/webgl/button/");
  ws = new WebSocket('ws://' + $('#hostname').val());
}
function onButtonClick(){
  console.log('clicked');
  $.ajax({
    type:'POST',
    url:'/',
    data:{session_id:$('#session_id').val()},
    success:function(){
      ws.send('message');
    },
    error:function(){
    }
  });
}