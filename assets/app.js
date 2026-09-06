/* Shared state + ranking engine for the study demo.
   State persists across pages via localStorage where available,
   and degrades gracefully to in-memory when it isn't. */

const POOL = [
  { n:'Marcus', m:'38 · Zilker · restores pinball machines', t:['6\'1"','Self-taught','No kids'] },
  { n:'Tom',    m:'36 · Hyde Park · runs a bike shop',       t:['5\'10"','Trade school','One kid'] },
  { n:'Dev',    m:'35 · Clarksville · ER physician',          t:['5\'9"','MD','Undecided'] },
  { n:'Julian', m:'33 · Bouldin · landscape architect',       t:['6\'0"','Masters','Wants kids'] },
  { n:'Elias',  m:'39 · Travis Heights · documentary editor', t:['5\'8"','BFA','No kids'] },
  { n:'Ravi',   m:'34 · Mueller · teaches high school physics',t:['5\'11"','PhD','Wants kids'] }
];

const KEY = 'studydemo.v1';
let _mem = null;

function load(){
  const blank = { scores: POOL.map(()=>1000), count: 0, skips: 0, joined: null, order: null };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : blank;
  } catch(e) {
    return _mem || blank;
  }
}

function save(s){
  _mem = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e) {}
}

function reset(){
  _mem = null;
  try { localStorage.removeItem(KEY); } catch(e) {}
}

/* Elo update — the practical stand-in for Bradley-Terry.
   Same family of model; converges to the same ordering. */
function recordChoice(state, winner, loser){
  const K = 32;
  const exp = 1 / (1 + Math.pow(10, (state.scores[loser] - state.scores[winner]) / 400));
  state.scores[winner] += K * (1 - exp);
  state.scores[loser]  -= K * (1 - exp);
  state.count++;
  return state;
}

/* Adaptive selection: show the pair the model is least certain about,
   with a little jitter so it doesn't repeat the same pair. */
function nextPair(state, avoid){
  let best = null, bestDist = Infinity;
  for (let i = 0; i < POOL.length; i++) {
    for (let j = i + 1; j < POOL.length; j++) {
      if (avoid && avoid[0] === i && avoid[1] === j) continue;
      const d = Math.abs(state.scores[i] - state.scores[j]) + Math.random() * 40;
      if (d < bestDist) { bestDist = d; best = [i, j]; }
    }
  }
  return best || [0, 1];
}

/* Ranking derived from scores, or the user's hand-edited order if they set one. */
function ranking(state){
  if (state.order) return state.order.slice();
  return POOL.map((p, i) => i).sort((a, b) => state.scores[b] - state.scores[a]);
}

function progressBar(el, done, target){
  el.style.width = Math.min(100, (done / target) * 100) + '%';
}
