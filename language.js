'use strict';

(() => {
  const key='aimes-language';
  const url=new URL(location.href);
  const explicit=url.searchParams.get('lang');
  let saved;
  try {saved=localStorage.getItem(key) || JSON.parse(localStorage.getItem('aimes-p1-lang') || 'null');}catch{}
  const englishPath=url.pathname.startsWith('/en/');
  let language=['fi','en'].includes(explicit)?explicit:englishPath?'en':saved==='en'?'en':'fi';
  function remember(next) {
    if(!['fi','en'].includes(next))return;
    language=next;
    if(window.AimesLanguage)window.AimesLanguage.language=next;
    try {
      localStorage.setItem(key,next);
      localStorage.setItem('aimes-p1-lang',JSON.stringify(next));
    }catch{}
  }
  remember(language);
  document.documentElement.lang=language;
  const translate=(message,...values)=>{
    const copy=language==='en'?(window.AimesTranslations?.[message] || message):message;
    return copy.replace(/\{(\d+)\}/g,(_match,index)=>String(values[index] ?? ''));
  };
  function localizedPath(path,next) {
    if(['/','/en/','/time-jump/'].includes(path))return next==='en'?'/en/':'/';
    if(['/toimisto/','/en/toimisto/'].includes(path))return next==='en'?'/en/toimisto/':'/toimisto/';
    if(['/aimes-vanha','/aimes-vanha.html','/en/aimes-vanha','/en/aimes-vanha.html'].includes(path))return next==='en'?'/en/aimes-vanha':'/aimes-vanha';
    for(const suffix of ['eras/','helsinki-1952-photo/']) {
      if(['/time-jump/'+suffix,'/en/time-jump/'+suffix].includes(path))return (next==='en'?'/en':'')+'/time-jump/'+suffix;
    }
    return path;
  }
  const shared=path=>path.includes('/time-jump/');
  function localizedUrl(address,next=language) {
    const target=new URL(address,location.href);
    if(target.origin!==location.origin)return target;
    target.pathname=localizedPath(target.pathname,next);
    if(shared(target.pathname)||target.searchParams.has('lang'))target.searchParams.set('lang',next);
    return target;
  }
  function decorateLinks() {
    document.querySelectorAll('a[href]').forEach(anchor=>{
      const raw=anchor.getAttribute('href');
      if(raw.startsWith('#')||anchor.matches('[data-language],.languages a,.language'))return;
      const target=localizedUrl(anchor.href);
      if(target.origin===location.origin)anchor.href=target.href;
    });
  }
  function seo() {
    const canonical=document.querySelector('link[rel="canonical"][data-fi]');
    if(!canonical)return;
    canonical.href=canonical.dataset[language];
    document.title=translate(document.title);
    const description=document.querySelector('meta[name="description"]');
    if(description?.dataset[language])description.content=description.dataset[language];
    for(const [selector,value] of [
      ['meta[property="og:url"]',canonical.href],
      ['meta[property="og:title"]',document.title],['meta[name="twitter:title"]',document.title],
      ['meta[property="og:description"]',description?.content],['meta[name="twitter:description"]',description?.content],
      ['meta[property="og:locale"]',language==='en'?'en_GB':'fi_FI'],
      ['meta[property="og:locale:alternate"]',language==='en'?'fi_FI':'en_GB']
    ]) {
      const meta=document.querySelector(selector);
      if(meta&&value)meta.content=value;
    }
  }
  function apply(root=document.body) {
    if(language==='en') {
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
        acceptNode:node=>node.parentElement.closest('script,style')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT
      });
      for(let node=walker.nextNode();node;node=walker.nextNode()) {
        const value=node.nodeValue.trim();
        if(window.AimesTranslations?.[value])node.nodeValue=node.nodeValue.replace(value,translate(value));
      }
      root.querySelectorAll('[aria-label],[placeholder],[title],[alt]').forEach(element=>{
        for(const name of ['aria-label','placeholder','title','alt']) {
          if(element.hasAttribute(name))element.setAttribute(name,translate(element.getAttribute(name)));
        }
      });
    }
    decorateLinks();
  }
  window.AimesLanguage={language,t:translate,remember,apply,localizedUrl,decorateLinks,seo};
  const destination=localizedPath(url.pathname,language);
  if(destination!==url.pathname && (englishPath||url.pathname==='/'||url.pathname==='/toimisto/'||url.pathname==='/aimes-vanha'||shared(url.pathname))) {
    url.pathname=destination;
    location.replace(url.href);
    return;
  }
  if(['/','/en/'].includes(url.pathname)&&/^#(?:oma=|ihmiset|radiot|loyda|maailma)/.test(url.hash)) {
    url.pathname=language==='en'?'/en/aimes-vanha':'/aimes-vanha';
    location.replace(url.href);
    return;
  }
  document.addEventListener('click',event=>{
    const anchor=event.target.closest('a[href]');
    if(!anchor)return;
    const next=anchor.dataset.language || (anchor.matches('.languages a,.language')?anchor.lang:null);
    if(next==='fi'||next==='en') {
      remember(next);
      const target=localizedUrl(anchor.href,next);
      target.searchParams.set('lang',next);
      anchor.href=target.href;
    } else if(!anchor.getAttribute('href').startsWith('#'))anchor.href=localizedUrl(anchor.href).href;
  },true);
  document.addEventListener('DOMContentLoaded',()=>{decorateLinks();seo();},{once:true});
  document.addEventListener('invalid',event=>{
    const field=event.target;
    if(!field.validity||field.validity.customError)return;
    if(field.validity.valueMissing)field.setCustomValidity(language==='en'?'Please fill in this field.':'Täytä tämä kenttä.');
    else if(field.validity.badInput||field.validity.rangeOverflow||field.validity.rangeUnderflow) {
      field.setCustomValidity(language==='en'?'Enter a value within the indicated range.':'Anna arvo kentän sallimalta väliltä.');
    }
  },true);
  document.addEventListener('input',event=>{
    if(event.target.validity?.customError)event.target.setCustomValidity('');
  });
})();
