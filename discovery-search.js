'use strict';
(()=>{
 const lang=()=>document.documentElement.lang==='en'?'en':'fi';
 function update(){const en=lang()==='en';document.querySelectorAll('.external-search-lang').forEach(el=>el.value=lang());document.querySelector('#imageSearchForm .search-topics').setAttribute('aria-label',en?'Image search topics':'Kuvahaun aiheita');document.querySelector('#newsSearchForm .search-topics').setAttribute('aria-label',en?'News search topics':'Uutishaun aiheita');document.getElementById('newsHeadlines').href=en?'https://news.google.com/?hl=en-GB&gl=GB&ceid=GB%3Aen':'https://news.google.com/?hl=fi&gl=FI&ceid=FI%3Afi';document.querySelectorAll('[data-search-target]').forEach(el=>el.setAttribute('aria-pressed','false'))}
 document.querySelectorAll('[data-search-target]').forEach(button=>{
  button.addEventListener('click',()=>{const field=document.getElementById(button.dataset.searchTarget);field.value=lang()==='en'?button.dataset.queryEn:button.dataset.queryFi;document.querySelectorAll('[data-search-target="'+button.dataset.searchTarget+'"]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));field.focus()});
 });
 for(const id of ['imageSearchQuery','newsSearchQuery'])document.getElementById(id).addEventListener('input',()=>document.querySelectorAll('[data-search-target="'+id+'"]').forEach(el=>el.setAttribute('aria-pressed','false')));
 for(const id of ['imageSearchForm','newsSearchForm'])document.getElementById(id).addEventListener('submit',event=>{const input=document.querySelector('#'+id+' input[name=q]');input.value=input.value.trim();if(!input.value){event.preventDefault();input.focus();input.reportValidity()}});
 new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 update();
})();
