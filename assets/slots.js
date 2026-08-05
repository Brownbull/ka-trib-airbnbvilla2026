/* Raw-skeleton affordance: unfilled {{TOKEN}} slots render as labeled dashed chips with a
   notice bar, so an in-place open reads as "template awaiting its generator", never as a
   broken page. Generated pages contain no tokens — this script is a no-op there. */
(function(){
  function run(){
    if(document.body.innerHTML.indexOf('{{')<0)return;
    var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),nodes=[],n,total=0;
    while((n=walker.nextNode()))if(n.nodeValue.indexOf('{{')>-1)nodes.push(n);
    nodes.forEach(function(t){
      var s=t.nodeValue,re=/\{\{([A-Z0-9_]+)\}\}/g,frag=document.createDocumentFragment(),last=0,m,hits=0;
      while((m=re.exec(s))){
        if(m.index>last)frag.appendChild(document.createTextNode(s.slice(last,m.index)));
        var chip=document.createElement('span');chip.className='slottoken';
        chip.textContent=m[1].toLowerCase().replace(/_/g,' ');chip.title='slot {{'+m[1]+'}} — filled by the center generator';
        frag.appendChild(chip);hits++;total++;last=re.lastIndex;
      }
      if(!hits)return;
      if(last<s.length)frag.appendChild(document.createTextNode(s.slice(last)));
      t.parentNode.replaceChild(frag,t);
    });
    if(total){
      var main=document.querySelector('.main')||document.body;
      var note=document.createElement('div');note.className='slotnotice';
      note.innerHTML='<b>Template skeleton</b> \u2014 the chrome (sidebar, icons, colors, banners) ships here; the '
        +total+' dashed chips are slots the center generator fills from machine sources. Rendered raw on purpose \u2014 not a broken page.';
      main.insertBefore(note,main.firstChild);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
