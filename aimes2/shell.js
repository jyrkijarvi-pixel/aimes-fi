import {cleanJourney,readJourney,withJourney,finnishDay,dailyIndex,isPreview} from './journey.mjs';
import {discoveries} from './discoveries.mjs';

const lang=window.AimesLanguage.language, en=lang==='en';
const copy=en?{map:'Map',history:'History',museum:'Museum',more:'More',menu:'Menu',close:'Close menu',nav:'AIMES services',stories:'Stories',radio:'Radio',office:'Office',other:'Other discoveries',gallery:'Current photo gallery',timejump:'Helsinki 1952 · photo journey',continue:'Continue exploring',historyAction:'Historical photographs',museumAction:'Search related museum collections',mapAction:'Back to this place on the map',leave:'Leave this research trail',ended:'Research trail ended. You can continue using every service.',warning:'Museum results are keyword matches. They do not prove where an object was made, found or photographed.',find:'Discovery of the day',explore:'Explore this discovery',source:'Original source',rights:'Usage rights',dailyNote:'A checked selection rotates daily, using Finland’s calendar day. No collection search runs when this card loads.',preview:'Preview only: inspect all three discoveries',automatic:'Today’s discovery',language:'Language',local:'This service',tag:'One world, many ways to explore.'}:{map:'Kartta',history:'Historia',museum:'Museo',more:'Lisää',menu:'Valikko',close:'Sulje valikko',nav:'AIMESin palvelut',stories:'Tarinat',radio:'Radiot',office:'Toimisto',other:'Muut löydöt',gallery:'Nykyinen kuvagalleria',timejump:'Helsinki 1952 · valokuva-aikamatka',continue:'Jatka tutkimista',historyAction:'Historialliset valokuvat',museumAction:'Etsi aiheeseen liittyvää museoaineistoa',mapAction:'Takaisin tämän paikan kartalle',leave:'Poistu tutkimuspolusta',ended:'Tutkimuspolku päättyi. Voit jatkaa kaikkien palvelujen käyttöä.',warning:'Museotulokset ovat hakusanaosumia. Ne eivät todista esineen valmistus-, löytö- tai kuvauspaikkaa.',find:'Päivän löytö',explore:'Tutki löytöä',source:'Alkuperäinen lähde',rights:'Käyttöoikeus',dailyNote:'Tarkistettu valikoima vaihtuu päivittäin Suomen ajan mukaan. Kortin avaaminen ei tee aineistohakuja.',preview:'Vain esikatselu: tarkista kaikki kolme löytöä',automatic:'Tämän päivän löytö',language:'Kieli',local:'Tämän palvelun valinnat',tag:'Yksi maailma, monta tapaa tutkia.'};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const localized=(address,language=lang)=>window.AimesLanguage.localizedUrl(address,language);
const link=(title,address)=>{const a=node('a',title);a.href=localized(address);return a;};
let journey=readJourney(location.href);
const original=document.querySelector('header');
if(original)original.dataset.aimesOriginal='';
const shell=node('header',null,'aimes-shell');
const brand=link('AIMES','/');brand.className='aimes-shell-brand';brand.setAttribute('aria-label','AIMES · '+copy.tag);
const toggle=node('button',copy.menu,'aimes-menu-toggle');toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','aimes-primary-nav');
const nav=node('nav',null,'aimes-primary-nav');nav.id='aimes-primary-nav';nav.setAttribute('aria-label',copy.nav);
const path=location.pathname.replace(/^\/en(?=\/)/,'');
const inMap=['/','/time-jump/'].includes(path),inHistory=path.includes('/time-jump/')&&!inMap,inMuseum=path==='/museum/';
const mapLink=link(copy.map,'/'),historyLink=link(copy.history,'/time-jump/eras/'),museumLink=link(copy.museum,'/museum/');
const more=node('details',null,'aimes-more');const summary=node('summary',copy.more);const morePanel=node('div',null,'aimes-more-panel');
for(const [title,url]of [[copy.stories,'/aimes-vanha#ihmiset'],[copy.radio,'/aimes-vanha#radiot'],[copy.office,'/toimisto/'],[copy.other,'/aimes-vanha#loyda'],[copy.timejump,'/time-jump/helsinki-1952-photo/']])morePanel.append(link(title,url));
if(inMap){const gallery=node('button',copy.gallery);gallery.type='button';gallery.addEventListener('click',()=>{closeMenu();document.getElementById('nav-gallery')?.click();});morePanel.append(gallery);}
// Preserve the legacy quiet-mode button and Office/photo anchor controls.
if(original){
  for(const button of original.querySelectorAll('button.quiet-btn'))morePanel.append(button);
  if(path.includes('/toimisto/'))for(const a of original.querySelectorAll('nav a[href*="#"]'))morePanel.append(a.cloneNode(true));
  if(path.includes('helsinki-1952-photo'))morePanel.append(link(en?'Images and sources':'Kuvat ja lähteet','#lahteet'));
}
more.append(summary,morePanel);nav.append(mapLink,historyLink,museumLink,more);
for(const [a,active]of [[mapLink,inMap],[historyLink,inHistory],[museumLink,inMuseum]])if(active)a.setAttribute('aria-current','page');
const languages=node('div',null,'aimes-shell-languages');languages.setAttribute('role','group');languages.setAttribute('aria-label',copy.language);
for(const code of ['fi','en']){const a=link(code.toUpperCase(),location.href);a.dataset.language=code;a.lang=code;a.hreflang=code;const target=localized(location.href,code);target.searchParams.set('lang',code);a.href=target;if(code===lang)a.setAttribute('aria-current','page');languages.append(a);}
shell.append(brand,nav,languages,toggle);original?original.before(shell):document.body.prepend(shell);
function closeMenu(){shell.classList.remove('aimes-menu-open');toggle.setAttribute('aria-expanded','false');toggle.textContent=copy.menu;more.open=false;}
toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';shell.classList.toggle('aimes-menu-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?copy.close:copy.menu;});
shell.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMenu();toggle.focus();}});
document.addEventListener('click',event=>{if(!shell.contains(event.target))more.open=false;});
for(const a of nav.querySelectorAll('a'))a.addEventListener('click',closeMenu);

const trail=node('section',null,'aimes-trail');trail.setAttribute('aria-label',copy.continue);trail.hidden=true;
const trailTitle=node('p',null,'aimes-trail-title'),trailActions=node('div',null,'aimes-trail-actions'),trailNote=node('p',copy.warning,'aimes-trail-note');
const leave=node('button',copy.leave,'aimes-trail-leave');leave.type='button';
const trailStatus=node('p',null,'aimes-trail-status');trailStatus.setAttribute('role','status');
trail.append(trailTitle,trailActions,trailNote,leave);const main=document.querySelector('main');main?.prepend(trailStatus,trail);
function destination(address,state){return withJourney(localized(address),state);}
function renderTrail(){
  trail.hidden=!journey;trailActions.replaceChildren();
  mapLink.href=destination('/',journey);historyLink.href=destination('/time-jump/eras/',journey);
  const museumTarget=destination('/museum/',journey);if(journey)museumTarget.searchParams.set('q',journey.name);museumLink.href=museumTarget;
  if(!journey)return;
  trailTitle.textContent=copy.continue+' · '+journey.name+(journey.period?' · '+journey.period:'');
  for(const [title,url,active]of [[copy.mapAction,mapLink.href,inMap],[copy.historyAction,historyLink.href,inHistory],[copy.museumAction,museumLink.href,inMuseum]]){
    if(active)continue;const a=link(title,url);a.className='aimes-trail-link';trailActions.append(a);
  }
  trailNote.hidden=!inMuseum;
}
function remember(value){
  const next=cleanJourney(value);if(!next)return;
  journey=next;history.replaceState(history.state,'',withJourney(location.href,journey));renderTrail();
  for(const a of languages.querySelectorAll('a')){const url=withJourney(localized(location.href,a.lang),journey);url.searchParams.set('lang',a.lang);a.href=url;}
}
leave.addEventListener('click',()=>{journey=null;history.replaceState(history.state,'',withJourney(location.href,null));renderTrail();trailStatus.textContent=copy.ended;for(const a of languages.querySelectorAll('a'))a.href=withJourney(a.href,null);mapLink.focus();});
window.AimesJourney={get state(){return journey;},remember,forget(){journey=null;history.replaceState(history.state,'',withJourney(location.href,null));renderTrail();}};
renderTrail();

if(inMap&&document.getElementById('search-panel')){
  const section=node('section',null,'aimes-daily');section.id='daily-find';section.setAttribute('aria-labelledby','daily-title');
  const heading=node('h2',copy.find);heading.id='daily-title';
  const body=node('div',null,'aimes-daily-body'),image=node('img'),content=node('div');image.width=480;image.height=300;image.loading='lazy';image.decoding='async';
  const type=node('p',null,'aimes-daily-type'),title=node('h3'),description=node('p'),date=node('p',null,'aimes-daily-date'),action=link(copy.explore,'/'),credit=node('p',null,'aimes-daily-credit');action.className='aimes-daily-action';
  content.append(type,title,description,date,action);body.append(image,content);section.append(heading,body,credit);
  const note=node('p',copy.dailyNote,'aimes-daily-note');section.append(note);
  let selected='';const params=new URL(location.href).searchParams;
  const preview=isPreview(location.href);if(preview&&discoveries.some(d=>d.id===params.get('find')))selected=params.get('find');
  function show(){
    const item=discoveries.find(d=>d.id===selected)||discoveries[dailyIndex(new Date(),discoveries.length)],text=item[lang];
    section.dataset.discovery=item.id;type.textContent=text.type;title.textContent=text.title;description.textContent=text.text;date.textContent=text.date;image.src=item.image;image.alt=text.title;
    action.href=destination(item.href,item.journey||null);
    credit.replaceChildren(document.createTextNode(item.credit+' · '));const source=link(copy.source,item.source),rights=link(item.rights,item.license);source.target=rights.target='_blank';source.rel=rights.rel='noopener noreferrer';credit.append(source,document.createTextNode(' · '+copy.rights+': '),rights,document.createTextNode(en?' · resized preview':' · pienennetty esikatselu'));
    section.dataset.day=finnishDay();
  }
  if(preview){const label=node('label',copy.preview,'aimes-daily-preview');const select=node('select');select.id='daily-preview';select.append(new Option(copy.automatic,''),...discoveries.map(d=>new Option(d[lang].type+' · '+d[lang].title,d.id)));select.value=selected;select.addEventListener('change',()=>{selected=select.value;show();});label.append(select);section.append(label);}
  document.getElementById('search-panel').append(section);show();
  setInterval(()=>{if(section.dataset.day!==finnishDay())show();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&section.dataset.day!==finnishDay())show();});
}
window.dispatchEvent(new CustomEvent('aimes-shell-ready'));
