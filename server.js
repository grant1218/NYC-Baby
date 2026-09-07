const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const { registerAgentRoutes, createRun, latestFor } = require('./agent-engine');

const app = express();
app.use(cors());

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const members = ['grant','mikey','falconi','stuart','marney'];
const state = { signals: [], invites: [], paidMembers: [], activity: [] };

function normalize(x){ return String(x || '').trim().toLowerCase(); }
function overlaps(){
  const by = {};
  for(const s of state.signals){ if(!s.item) continue; (by[s.item] ??= []).push(s); }
  return Object.entries(by).map(([item,arr]) => {
    const people = [...new Set(arr.map(x => x.member))];
    if(people.length < 2) return null;
    return { item, people, score: people.length, latest: arr.at(-1).createdAt };
  }).filter(Boolean).sort((a,b) => b.score-a.score);
}

app.post('/api/billing/webhook', express.raw({type:'application/json'}), (req,res) => {
  if(!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Billing not configured');
  let event;
  try{ event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch(e){ return res.status(400).send('Invalid webhook signature'); }
  const o = event.data.object;
  if(event.type === 'checkout.session.completed'){
    state.paidMembers.push({email:normalize(o.customer_details && o.customer_details.email),customer:o.customer,subscription:o.subscription,status:'paid',createdAt:new Date().toISOString()});
  }
  if(event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated'){
    const m = state.paidMembers.find(x => x.subscription === o.id); if(m) m.status = o.status;
  }
  res.json({received:true});
});

app.use(express.json({limit:'1mb'}));

app.get('/health',(req,res) => {
  const latest = latestFor('mikey');
  res.json({
    ok:true,
    service:'IN shared-signal API',
    billing:!!stripe,
    agents:{enabled:true,total:500,modelConfigured:!!process.env.OPENAI_API_KEY,latest:latest?{id:latest.id,status:latest.status,completed:latest.completed,aiCompleted:latest.aiCompleted}:null}
  });
});

app.get('/api/billing/config',(req,res) => res.json({configured:!!(stripe&&process.env.STRIPE_PRICE_ID),amount:process.env.IN_MEMBERSHIP_AMOUNT?Number(process.env.IN_MEMBERSHIP_AMOUNT):null,interval:process.env.IN_MEMBERSHIP_INTERVAL||'month'}));
app.post('/api/billing/checkout',async(req,res) => {
  if(!stripe || !process.env.STRIPE_PRICE_ID) return res.status(503).json({error:'Membership checkout is not configured yet'});
  const email=normalize(req.body.email), name=String(req.body.name||'').trim();
  if(!email || !name) return res.status(400).json({error:'Name and email are required'});
  try{
    const site=process.env.IN_SITE_URL||'https://nyc-baby.onrender.com';
    const session=await stripe.checkout.sessions.create({mode:'subscription',line_items:[{price:process.env.STRIPE_PRICE_ID,quantity:1}],customer_email:email,success_url:site+'/join.html?success=1&session_id={CHECKOUT_SESSION_ID}',cancel_url:site+'/join.html?canceled=1',allow_promotion_codes:true,metadata:{member_name:name,source:'IN founding membership'},subscription_data:{metadata:{member_name:name,member_email:email}}});
    res.json({url:session.url});
  }catch(e){ console.error('Stripe checkout error',e.message); res.status(500).json({error:'Could not start secure checkout'}); }
});

app.get('/api/state',(req,res) => {
  const member=normalize(req.query.member||'grant');
  res.json({member,members,signals:state.signals,overlaps:overlaps(),invites:state.invites.filter(x=>x.to===member||x.from===member)});
});
app.post('/api/signal',(req,res) => {
  const member=normalize(req.body.member), item=normalize(req.body.item), value=String(req.body.value||'');
  if(!member||!item||!value) return res.status(400).json({error:'member, item, value required'});
  const rec={id:Date.now()+'-'+Math.random().toString(36).slice(2,7),member,item,value,createdAt:new Date().toISOString()};
  state.signals.push(rec); res.json({ok:true,signal:rec,overlaps:overlaps()});
});
app.post('/api/invite',(req,res) => {
  const from=normalize(req.body.from),to=normalize(req.body.to),item=normalize(req.body.item);
  if(!from||!to||!item) return res.status(400).json({error:'from, to, item required'});
  const rec={id:Date.now()+'-'+Math.random().toString(36).slice(2,7),from,to,item,status:'open',createdAt:new Date().toISOString()};
  state.invites.push(rec); res.json({ok:true,invite:rec});
});
app.post('/api/activity',(req,res) => {
  const member=normalize(req.body.member), event=normalize(req.body.event), detail=String(req.body.detail||''), sessionId=String(req.body.sessionId||'').slice(0,120);
  if(!member||!event) return res.status(400).json({error:'member and event required'});
  const rec={id:Date.now()+'-'+Math.random().toString(36).slice(2,7),member,event,detail,sessionId,createdAt:new Date().toISOString()};
  state.activity.push(rec);
  if(state.activity.length>1000) state.activity.splice(0,state.activity.length-1000);
  console.log('ACTIVITY',JSON.stringify(rec));
  res.json({ok:true,activity:rec});
});
app.get('/api/activity',(req,res) => {
  const member=normalize(req.query.member||'mikey');
  const rows=state.activity.filter(x=>x.member===member).slice(-200).reverse();
  const sessions=[...new Set(rows.map(x=>x.sessionId).filter(Boolean))];
  res.json({member,count:rows.length,sessions:sessions.length,lastActive:rows[0]?.createdAt||null,activity:rows});
});
app.post('/api/reset',(req,res) => { state.signals.length=0; state.invites.length=0; state.activity.length=0; res.json({ok:true}); });

registerAgentRoutes(app);

const port = process.env.PORT || 3000;
app.listen(port,() => {
  console.log('IN API listening on '+port);
  if(process.env.AGENT_AUTO_START_MIKE === 'true' && !latestFor('mikey')){
    console.log('Starting Mikey 500-agent possibility run');
    createRun('mikey', process.env.MIKEY_DEFAULT_GOAL || 'Continuously surface the most interesting options and possibilities worth caring about right now.');
  }
});
