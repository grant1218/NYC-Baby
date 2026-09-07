/* NYC Baby city intelligence — factual public-source leads, summarized in NYC Baby's own voice. */
window.NYCBABY_CITY = {
  updated: '2026-09-06',
  restaurants: [
    {name:'Faux', area:'Tribeca', kind:'French', why:'New opening · bi-level restaurant + late-night energy', source:'The Infatuation · New Openings'},
    {name:"Wu’s Dynasty", area:'Upper West Side', kind:'Chinese', why:'Just added · 210 W 70th St', source:'The Infatuation · New Openings'},
    {name:'20 Blocks', area:'East Village', kind:'Sandwiches', why:'New Hit List pick · lunch, brunch, coffee', source:'The Infatuation · Hit List'},
    {name:'Frenzie', area:'Brooklyn Heights', kind:'Pizza', why:'Walk-in-only · casual dinner or date', source:'The Infatuation · Hit List'},
    {name:'Cospa Ramen', area:'NoMad', kind:'Japanese', why:'Late-night ramen · open daily until 2am or sellout', source:'The Infatuation · Hit List'},
    {name:'Keepers', area:'West Village', kind:'Pizza + Bar', why:'New West Village spot · good for eating at the bar', source:'The Infatuation · Hit List'},
    {name:'Lala Hot Chicken', area:'Chelsea', kind:'Fried Chicken', why:'Casual · solo-friendly · inexpensive', source:'The Infatuation · Hit List'},
    {name:'Hungry Spicy', area:'Chelsea', kind:'Thai', why:'New Chelsea opening · strong group-dinner energy', source:'The Infatuation · Hit List'},
    {name:'Burmese Bites', area:'Astoria', kind:'Burmese', why:'Casual, group-friendly and under-the-radar', source:'The Infatuation · Hit List'},
    {name:'Zig Zag Oyster Bar', area:'Prospect Heights', kind:'Raw Bar', why:'Walk-in-only · easy bar-seat plan', source:'The Infatuation · Hit List'},
    {name:'Graciela', area:'West Village', kind:'Argentinian', why:'Date night · parents in town · special occasion', source:'The Infatuation · Hit List'},
    {name:'Prosciutto', area:'East Village', kind:'Italian', why:'Eight tables · walk-in · solo-friendly', source:'The Infatuation · Hit List'},
    {name:'Bark Barbecue', area:'Bushwick', kind:'BBQ', why:'Dominican-Texan barbecue · great for groups', source:'The Infatuation · Hit List'},
    {name:'Phê', area:'Chinatown', kind:'Vietnamese', why:'Calm daytime stop · coffee + solo-friendly', source:'The Infatuation · Hit List'},
    {name:'Consuelo', area:'Upper West Side', kind:'Mexican', why:'New UWS follow-up · date, brunch or solo dinner', source:'The Infatuation · Hit List'},
    {name:'Titán', area:'DUMBO', kind:'Mexican', why:'Big backyard · easy group plan', source:'The Infatuation · Hit List'},
    {name:'Oriana', area:'Nolita', kind:'American', why:'Polished · groups, occasions and team dinners', source:'The Infatuation · Hit List'}
  ],
  activities: [
    {date:'SEP 8', name:'Appleton Organ Performance', area:'The Met', why:'Free with museum admission · 1 PM', tag:'CULTURE'},
    {date:'SEP 8', name:'Japanese Ceramics Expert Talk', area:'The Met', why:'Gallery deep dive · 3 PM · free with admission', tag:'CULTURE'},
    {date:'SEP 9', name:'Willow Leaf Tray Weaving', area:'The Met Cloisters', why:'Hands-on workshop · 10 AM', tag:'MAKE SOMETHING'},
    {date:'SEP 11', name:'Date Night at The Met', area:'Upper East Side', why:'Live music + art · 5 PM · come solo or bring someone', tag:'SOCIAL'},
    {date:'SEP 11', name:'Yankees vs. Mets', area:'Yankee Stadium', why:'Subway Series + September 11 tribute · 7:05 PM', tag:'SPORTS'},
    {date:'SEP 12', name:'Date Night at The Met', area:'Upper East Side', why:'Live music + art · 5 PM', tag:'SOCIAL'},
    {date:'SEP 18', name:'Date Night at The Met', area:'Upper East Side', why:'Easy Friday plan · live music + art', tag:'SOCIAL'},
    {date:'SEP 19', name:'Date Night at The Met', area:'Upper East Side', why:'Saturday evening plan · 5 PM', tag:'SOCIAL'},
    {date:'SEP 21', name:'Chuseok Celebration', area:'City Hall', why:'Public cultural celebration · 5:30 PM', tag:'COMMUNITY'},
    {date:'SEP 22', name:'Climate Week at City Hall', area:'City Hall', why:'Civic + climate community · 5:30 PM', tag:'CAUSES'},
    {date:'SEP 25', name:'Date Night at The Met', area:'Upper East Side', why:'Friday culture plan · 5 PM', tag:'SOCIAL'},
    {date:'SEP 26', name:'Date Night at The Met', area:'Upper East Side', why:'Saturday culture plan · 5 PM', tag:'SOCIAL'}
  ]
};

(function(){
  function esc(s){return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  function openCityHub(type){
    const data=window.NYCBABY_CITY[type]||[];
    let modal=document.getElementById('cityHubModal');
    if(!modal){modal=document.createElement('div');modal.id='cityHubModal';modal.className='modal';modal.onclick=e=>{if(e.target===modal)modal.classList.remove('open')};document.body.appendChild(modal)}
    const title=type==='restaurants'?'New York, eat something new.':'Get out of the apartment.';
    const sub=type==='restaurants'?'New openings and recent standouts, organized for actual plans—not a giant review dump.':'Things happening in the city that can turn an empty day into a plan. Come solo is normal here.';
    modal.innerHTML=`<div class="modalCard" style="width:min(760px,94vw);max-height:84vh;overflow:auto"><button class="close" onclick="document.getElementById('cityHubModal').classList.remove('open')">×</button><p class="kicker">${type==='restaurants'?'NYC BABY · RESTAURANT INTELLIGENCE':'NYC BABY · DO SOMETHING'}</p><h3>${title}</h3><p>${sub}</p><div class="access" style="margin-top:18px">${data.map((x,i)=>`<button onclick="show('${type==='restaurants'?'Saved':'Added to your plans'}: ${esc(x.name)}')"><span>${esc(x.name)}</span><small>${esc(x.date||x.area)} · ${esc(x.area||x.kind)} · ${esc(x.why)}</small><b>›</b></button>`).join('')}</div><p style="margin-top:18px;font-size:9px">Updated ${window.NYCBABY_CITY.updated}. Restaurant leads summarized from public Infatuation New Openings/Hit List information; event facts from official/public NYC calendars. NYC Baby adds its own social context.</p></div>`;
    modal.classList.add('open');
  }
  window.openCityHub=openCityHub;
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('.sidebar nav a').forEach(a=>{
      const t=a.textContent.trim();
      if(t.includes('Restaurants')) a.onclick=e=>{e.preventDefault();openCityHub('restaurants')};
      if(t.includes('Activities')) a.onclick=e=>{e.preventDefault();openCityHub('activities')};
    });
    const home=document.querySelector('#home');
    if(home){const b=document.createElement('button');b.className='light';b.textContent='✦ I NEED A PLAN';b.onclick=()=>openCityHub('activities');const actions=home.querySelector('.heroActions');if(actions)actions.prepend(b)}
  });
})();