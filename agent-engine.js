const crypto = require('crypto');

const RUNS = new Map();
const TOTAL_AGENTS = 500;
const BATCH_SIZE = 20;

const lanes = [
  'Tonight & nightlife','Restaurants & food','Music & live culture','Hidden rooms & access','Social overlaps',
  'Dating & introductions','Friends & reconnections','Spontaneous adventures','Day trips','Wellness & recovery',
  'Sports & games','Art & design','Fashion & shopping','Business opportunities','Career & networking',
  'Travel possibilities','Learning & curiosity','Luxury without obviousness','Low-effort options','Wild-card ideas'
];

const lenses = [
  'high probability','unexpected','socially magnetic','low friction','worth crossing town for',
  'rare access','good story tomorrow','quietly excellent','time-sensitive','serendipitous',
  'budget-aware','premium','solo-friendly','group-friendly','date-friendly','local-insider',
  'contrarian','weather-resilient','last-minute','high-upside'
];

function now(){ return new Date().toISOString(); }
function id(){ return crypto.randomBytes(8).toString('hex'); }
function normalize(x){ return String(x || '').trim().toLowerCase(); }

function makeAgents(member, goal){
  return Array.from({length: TOTAL_AGENTS}, (_, i) => ({
    id: `A${String(i+1).padStart(3,'0')}`,
    member,
    lane: lanes[i % lanes.length],
    lens: lenses[Math.floor(i / lanes.length) % lenses.length],
    mission: `${lanes[i % lanes.length]} through a ${lenses[Math.floor(i / lanes.length) % lenses.length]} lens`,
    status: 'queued',
    goal
  }));
}

function outputText(json){
  if (typeof json.output_text === 'string') return json.output_text;
  const parts = [];
  for (const o of (json.output || [])) {
    for (const c of (o.content || [])) if (typeof c.text === 'string') parts.push(c.text);
  }
  return parts.join('\n');
}

function parseJson(text){
  try { return JSON.parse(text); } catch (_) {}
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if(start >= 0 && end > start){ try { return JSON.parse(text.slice(start,end+1)); } catch (_) {} }
  return null;
}

function fallbackOptions(agents, goal, member){
  return agents.map((a, i) => ({
    agentId: a.id,
    title: `${a.lane}: ${a.lens}`,
    why: `A ${a.lens} possibility for ${member} based on the goal “${goal}”.`,
    move: `Explore one concrete ${a.lane.toLowerCase()} option and test whether it is genuinely worth doing now.`,
    score: 50 + ((i * 17) % 45),
    confidence: 'fallback',
    source: 'local-orchestrator'
  }));
}

async function runBatch(run, agents){
  const key = process.env.OPENAI_API_KEY;
  agents.forEach(a => a.status = 'working');
  run.working += agents.length;
  run.updatedAt = now();

  if (!key) {
    const opts = fallbackOptions(agents, run.goal, run.member);
    run.results.push(...opts);
    agents.forEach(a => a.status = 'fallback');
    run.working -= agents.length;
    run.fallback += agents.length;
    run.completed += agents.length;
    run.updatedAt = now();
    return;
  }

  const roster = agents.map(a => `${a.id} | ${a.mission}`).join('\n');
  const prompt = `You are a batch of independent possibility scouts working for ${run.member}.\nGoal/context: ${run.goal}\n\nEach scout must independently produce ONE concrete possibility. Do not merely restate its lane. Favor specific, useful, surprising next moves. Avoid duplicates within this batch.\n\nScout roster:\n${roster}\n\nReturn ONLY valid JSON in this exact shape: {"options":[{"agentId":"A001","title":"...","why":"...","move":"...","score":0-100,"confidence":"low|medium|high"}]}. Include exactly one option per scout.`;

  try {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model: process.env.AGENT_SCOUT_MODEL || 'gpt-5.6-luna',
        input: prompt,
        reasoning:{effort:'low'},
        max_output_tokens: 6000
      })
    });
    if(!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    const data = await r.json();
    const parsed = parseJson(outputText(data));
    if(!parsed || !Array.isArray(parsed.options)) throw new Error('Could not parse scout JSON');
    const byId = new Map(parsed.options.map(x => [x.agentId, x]));
    for(const a of agents){
      const o = byId.get(a.id);
      if(o) run.results.push({...o, source:'openai', lane:a.lane, lens:a.lens});
      else run.results.push(...fallbackOptions([a], run.goal, run.member));
      a.status = o ? 'complete' : 'fallback';
      if(!o) run.fallback += 1;
    }
    run.aiCompleted += agents.filter(a => a.status === 'complete').length;
  } catch(e){
    run.errors.push({at:now(), message:e.message});
    const opts = fallbackOptions(agents, run.goal, run.member);
    run.results.push(...opts);
    agents.forEach(a => a.status = 'fallback');
    run.fallback += agents.length;
  } finally {
    run.working -= agents.length;
    run.completed += agents.length;
    run.updatedAt = now();
  }
}

async function synthesize(run){
  const sorted = [...run.results].sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0));
  run.top = sorted.slice(0, 30);
  if(!process.env.OPENAI_API_KEY || run.aiCompleted === 0){
    run.summary = 'Agent orchestration completed, but no OpenAI-backed scout work was confirmed. Add OPENAI_API_KEY to activate true AI scouting.';
    return;
  }
  try{
    const compact = sorted.slice(0,80).map(x=>({title:x.title,why:x.why,move:x.move,score:x.score}));
    const r = await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:process.env.AGENT_JUDGE_MODEL || 'gpt-5.6-terra',reasoning:{effort:'medium'},max_output_tokens:5000,input:`You are the final judge for Mikey's possibility engine. Goal: ${run.goal}. Here are the strongest scout outputs: ${JSON.stringify(compact)}. Return ONLY JSON {"summary":"2 sentence synthesis","top":[{"title":"...","why":"...","move":"...","score":0-100}]}. Select 12 genuinely distinct, actionable possibilities.`})
    });
    if(r.ok){
      const p=parseJson(outputText(await r.json()));
      if(p){ if(p.summary) run.summary=p.summary; if(Array.isArray(p.top)) run.top=p.top; }
    }
  }catch(e){ run.errors.push({at:now(),message:`Judge: ${e.message}`}); }
}

async function executeRun(run){
  run.status='running'; run.startedAt=now(); run.updatedAt=now();
  const batches=[];
  for(let i=0;i<run.agents.length;i+=BATCH_SIZE) batches.push(run.agents.slice(i,i+BATCH_SIZE));
  const concurrency = Math.max(1, Math.min(Number(process.env.AGENT_BATCH_CONCURRENCY || 4), 10));
  let cursor=0;
  async function worker(){ while(true){ const idx=cursor++; if(idx>=batches.length) return; await runBatch(run,batches[idx]); } }
  await Promise.all(Array.from({length:concurrency},()=>worker()));
  await synthesize(run);
  run.status='complete'; run.finishedAt=now(); run.updatedAt=now();
}

function createRun(member='mikey', goal='Find the best possibilities worth caring about right now.'){
  member=normalize(member)||'mikey';
  const run={id:id(),member,goal:String(goal||'').slice(0,2000),status:'queued',total:TOTAL_AGENTS,completed:0,aiCompleted:0,fallback:0,working:0,createdAt:now(),updatedAt:now(),results:[],top:[],summary:'',errors:[]};
  run.agents=makeAgents(member,run.goal);
  RUNS.set(run.id,run);
  setImmediate(()=>executeRun(run));
  return run;
}

function publicRun(run, includeResults=false){
  if(!run) return null;
  const x={id:run.id,member:run.member,goal:run.goal,status:run.status,total:run.total,completed:run.completed,aiCompleted:run.aiCompleted,fallback:run.fallback,working:run.working,modelConfigured:!!process.env.OPENAI_API_KEY,createdAt:run.createdAt,startedAt:run.startedAt,finishedAt:run.finishedAt,updatedAt:run.updatedAt,summary:run.summary,top:run.top,errors:run.errors.slice(-3)};
  if(includeResults) x.results=run.results;
  return x;
}

function latestFor(member='mikey'){
  const m=normalize(member); return [...RUNS.values()].filter(r=>r.member===m).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0] || null;
}

function registerAgentRoutes(app){
  app.get('/api/agents/status',(req,res)=>{
    const run=req.query.runId?RUNS.get(String(req.query.runId)):latestFor(req.query.member||'mikey');
    if(!run) return res.json({status:'idle',member:normalize(req.query.member||'mikey'),total:TOTAL_AGENTS,modelConfigured:!!process.env.OPENAI_API_KEY});
    res.json(publicRun(run,false));
  });
  app.get('/api/agents/results',(req,res)=>{
    const run=req.query.runId?RUNS.get(String(req.query.runId)):latestFor(req.query.member||'mikey');
    if(!run) return res.status(404).json({error:'No run found'});
    res.json(publicRun(run,true));
  });
  app.post('/api/agents/run',(req,res)=>{
    const member=normalize(req.body.member||'mikey'), goal=String(req.body.goal||'Find options and possibilities worth caring about right now.').trim();
    const existing=latestFor(member);
    if(existing && (existing.status==='queued'||existing.status==='running')) return res.status(409).json({error:'Run already active',run:publicRun(existing,false)});
    const run=createRun(member,goal); res.status(202).json(publicRun(run,false));
  });
}

module.exports={registerAgentRoutes,createRun,latestFor};
