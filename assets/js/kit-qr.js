// QR code du kit de communication : points arrondis, couleur Studio, logo du client au centre (sinon logo Me&YouToo).
(function(){
  var COLOR='#273a64',FALLBACK_LOGO='assets/img/brand/logo-meayt-color.png',shown='',current=null;
  function options(type,link,image){
    return {type:type,width:1200,height:1200,margin:48,data:link,image:image,
      qrOptions:{errorCorrectionLevel:'H'},
      imageOptions:{crossOrigin:'anonymous',imageSize:0.34,margin:14,hideBackgroundDots:true},
      dotsOptions:{type:'dots',color:COLOR},
      cornersSquareOptions:{type:'extra-rounded',color:COLOR},
      cornersDotOptions:{type:'extra-rounded',color:COLOR},
      backgroundOptions:{color:'#ffffff'}};
  }
  function canLoad(src){
    return new Promise(function(resolve){var img=new Image();img.crossOrigin='anonymous';img.onload=function(){resolve(true);};img.onerror=function(){resolve(false);};img.src=src;});
  }
  async function render(box,link,logo){
    var key=link+'|'+logo;if(key===shown)return;shown=key;
    var image=logo&&await canLoad(logo)?logo:FALLBACK_LOGO;
    current={link:link,image:image};
    box.replaceChildren();
    new QRCodeStyling(options('canvas',link,image)).append(box);
  }
  document.addEventListener('click',function(event){
    var button=event.target.closest('[data-qr-download]');if(!button||!current)return;
    var extension=button.dataset.qrDownload;
    new QRCodeStyling(options(extension==='svg'?'svg':'canvas',current.link,current.image)).download({name:'qr-code-campagne',extension:extension});
  });
  window.StudioQr={render:render};
})();
