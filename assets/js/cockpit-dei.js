(function(){
  var user=null;
  try{user=JSON.parse(localStorage.getItem('studio_user')||'null');}catch(e){}
  var isAdmin=Boolean(user&&user.role==='admin');
  var audience=new URLSearchParams(location.search).get('audience');
  var adminView=isAdmin&&audience!=='client';
  ['dei-calendar-link','dei-final-calendar-link'].forEach(function(id){
    var link=document.getElementById(id);
    if(link)link.href=adminView?'calendrier.html':'calendrier.html?audience=client';
  });
})();
