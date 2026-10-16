// CUTISE ZOO — the HUD, the side panel, the goal card, toasts and pop-ups.
// Buttons say what they do with data attributes, and one click handler (bottom of this file) runs them:
//   data-cmd='{"type":"feed","hab":3}'   → act(...)   (changes the zoo)
//   data-panel / data-mode / data-build / data-ui      (changes the screen only)
// Deck rule: tapping a thing opens ONE contextual panel, and every problem comes with its fix and cost.

// ---------- HUD ----------
function updateHud() {
  const ev = D.EVENTS.find((e) => e.id === S.event) || D.EVENTS[1];
  $('#zooname').textContent = S.name || 'Your new zoo';
  $('#zoostage').textContent = Sim.stage(S).name;
  $('#day').textContent = 'Day ' + S.day;
  $('#event').textContent = ev.emoji;
  $('#event').title = ev.name;
  $('#dayfill').style.width = ((S.t % D.BALANCE.dayLength) / D.BALANCE.dayLength) * 100 + '%';
  $('#coins').textContent = fmt(S.coins);
  $('#coins')
    .closest('.pill')
    .classList.toggle('bad', S.coins < 0);
  $('#guests').textContent = S.opened ? Math.round(S.guests) : 'Closed';
  $('#care').textContent = S.animals.length ? S.care + '%' : '–';
  const next = D.STAGES.find((st) => st.rep > S.rep);
  const prev = Sim.stage(S);
  $('#repfill').style.width = next ? ((S.rep - prev.rep) / (next.rep - prev.rep)) * 100 + '%' : '100%';
  $('#rep').title = `Care reputation ${Math.floor(S.rep)}${next ? ` · "${next.name}" at ${next.rep}` : ''}`;
  $('#speed').textContent = ui.paused ? '⏸' : ui.speed === 1 ? '▶' : '⏩';
  $('#speed').title = ui.paused ? (ui.autoPaused ? 'Paused while you build' : 'Paused') : 'Speed';
  updateGoalCard();
  if (ui.panel && !document.activeElement.closest('#panel input')) drawPanel();
}

// ---------- the goal card ----------
function updateGoalCard() {
  const g = Sim.currentGoal(S),
    el = $('#goal');
  let html;
  if (!g) html = '<span class="ico">🏆</span><div><b>Your dream zoo</b><small>Every goal done. Sandbox time!</small></div>';
  else {
    const done = Sim.goalDone(S, g);
    html =
      `<span class="ico">${done ? '🎉' : '📋'}</span><div><b>${esc(g.title)}</b><small>${esc(g.text)}</small></div>` +
      (done ? `<button class="btn" data-cmd='{"type":"claim"}'>+${g.reward} 🪙</button>` : `<span class="chev">›</span>`);
    el.classList.toggle('ready', done);
  }
  if (el.dataset.html !== html) {
    el.innerHTML = html;
    el.dataset.html = html;
  }
}

// ---------- modes ----------
function setMode(mode, key) {
  ui.mode = mode;
  ui.buildKey = key || null;
  ui.canUndo = false;
  document.body.dataset.mode = mode || '';
  // the deck: let the player set the pace — the zoo waits while you build
  if (mode && prefs.pauseWhileBuilding && !ui.paused) ui.paused = ui.autoPaused = true;
  if (!mode && ui.autoPaused) ui.paused = ui.autoPaused = false;
  if (mode) closePanel();
  setTip(null);
  updateHud();
}
// The bar at the top of the map while building: what you're placing, why it won't fit, undo, done.
function setTip(why) {
  const tip = $('#modetip');
  if (!ui.mode) return (tip.hidden = true);
  const def = ui.mode === 'build' ? D.BUILDS[ui.buildKey] : null;
  const head = def
    ? `${def.emoji} <b>${esc(def.name)}</b> · ${def.cost} 🪙${def.kind === 'path' ? ' · drag to lay a run' : ''}`
    : '🧹 Tap to clear (half back)';
  const html = `<span>${head}${why ? `<em class="why">${esc(why)}</em>` : ''}</span>${ui.canUndo ? '<button class="btn small ghost" data-ui="undo">↶ Undo</button>' : ''}<button class="btn small" data-mode="">Done</button>`;
  if (tip.dataset.html !== html) {
    tip.innerHTML = html;
    tip.dataset.html = html;
  }
  tip.hidden = false;
}
function undo() {
  const res = act({ type: 'undo' });
  if (res.ok) {
    sfx('pop');
    toast(`Undone. ${res.coins} 🪙 back.`);
  }
  ui.canUndo = false;
}

// ---------- the side panel ----------
function openPanel(kind, id) {
  if (ui.mode) setMode(null);
  ui.panel = { kind, id, tab: (ui.panel && ui.panel.kind === kind && ui.panel.tab) || null };
  $('#panel').hidden = false;
  $('#panel .body').dataset.html = '';
  drawPanel();
}
function closePanel() {
  ui.panel = null;
  $('#panel').hidden = true;
}
function drawPanel() {
  const html = PANELS[ui.panel.kind](ui.panel);
  if (html === null) return closePanel();
  const body = $('#panel .body');
  if (body.dataset.html === html) return;
  body.innerHTML = html;
  body.dataset.html = html;
}
const meter = (label, icon, v) =>
  `<div class="meter"><span>${icon} ${label}</span><span class="bar ${v < 35 ? 'low' : ''}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span></div>`;
const coinBtn = (cmd, label, cost, cls = '') =>
  `<button class="btn ${cls}" data-cmd='${JSON.stringify(cmd)}' ${S.coins < cost ? 'disabled' : ''}>${label}${cost ? ` · ${cost} 🪙` : ''}</button>`;
const moodWord = { love: 'Over the moon', happy: 'Happy', meh: 'So-so', sad: 'Unhappy' };
// A problem as the deck draws it: a warm chip with the need, then one big button that fixes it.
function problemBlock(p) {
  if (!p) return '<div class="okchip">🌿 All is well</div>';
  let fix = '';
  if (p.fix && p.fix.cmd) fix = coinBtn(p.fix.cmd, p.fix.label, p.fix.cost, 'wide');
  else if (p.fix && p.fix.ui === 'build') fix = `<button class="btn wide" data-build="${p.fix.k}">Lay a path</button>`;
  const icon =
    p.fix && p.fix.cmd && p.fix.cmd.item ? D.ITEMS[p.fix.cmd.item].emoji : p.fix && p.fix.cmd && p.fix.cmd.type === 'feed' ? '🥣' : '💛';
  return `<div class="need">${icon} ${esc(p.text)} <span class="dot">!</span></div>${p.why ? `<p class="muted">${esc(p.why)}</p>` : ''}${fix}`;
}

const PANELS = {
  build(p) {
    const tab = p.tab || 'habitat';
    const tabs = { habitat: '🛤️ Paths & habitats', shop: '🍦 Amenities', decor: '🌷 Planting' };
    const list = Object.entries(D.BUILDS).filter(([, b]) => (tab === 'habitat' ? ['path', 'habitat'].includes(b.kind) : b.kind === tab));
    return (
      `<h2>Build</h2><div class="tabs">${Object.entries(tabs)
        .map(([k, v]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${v}</button>`)
        .join('')}</div><div class="cards">` +
      list
        .map(([k, b]) => {
          const locked = S.rep < b.rep;
          return `<button class="card ${locked ? 'locked' : ''}" ${locked ? 'disabled' : `data-build="${k}"`}>
          <span class="big">${b.emoji}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small>
          <span class="price ${S.coins < b.cost ? 'bad' : ''}">${locked ? `🔒 ${b.rep} care rep` : `${b.cost} 🪙${b.upkeep ? ` <i>+${b.upkeep}/day</i>` : ''}`}</span></button>`;
        })
        .join('') +
      `</div>`
    );
  },

  animals() {
    const rows = Object.entries(D.SPECIES).map(([k, sp]) => {
      const bio = D.BIOMES[sp.biome];
      const count = S.animals.filter((a) => a.sp === k).length;
      const offered = S.offered.includes(k);
      let btn;
      if (!offered) btn = `<span class="muted">🔒 ${sp.rep} care rep</span>`;
      else {
        const hab = S.habitats.find((h) => h.biome === sp.biome && Sim.spaceUsed(S, h) + sp.space <= D.HABITAT_SPACE);
        btn = hab
          ? coinBtn({ type: 'adopt', sp: k, hab: hab.id }, 'Adopt', sp.cost)
          : `<button class="btn ghost small" data-build="habitat_${sp.biome}">Build a ${esc(bio.name)} habitat</button>`;
      }
      return `<div class="animal-row ${offered ? '' : 'locked'}"><span class="big">${sp.emoji}</span>
        <div><b>${esc(sp.name)}</b> ${count ? `<span class="chip">×${count}</span>` : ''}<small class="blurb">${esc(sp.blurb)}</small>
        <small>${bio.emoji} ${esc(bio.name)} · wants ${['shelter', ...sp.wants].map((w) => D.ITEMS[w].emoji).join('')} · ${sp.social > 1 ? `likes ${sp.social} together` : 'happy alone'}</small>
        ${offered ? `<small class="fact">${esc(sp.fact)}</small>` : ''}</div>${btn}</div>`;
    });
    return `<h2>Adoption offers</h2><p class="muted">Animals need homes. Look after yours well and your care reputation brings new offers.</p>${rows.join('')}`;
  },

  // The deck's main panel: name, species, the problem and its fix, Comfort / Food / Social, Follow.
  animal(p) {
    const a = Sim.animalById(S, p.id);
    if (!a) return null;
    const sp = D.SPECIES[a.sp],
      tr = D.TRAITS[a.trait],
      n = Sim.needs(S, a);
    const fav = D.ITEMS[a.fav];
    const portrait = ZOO_ART_READY['portrait-' + a.sp]
      ? `<img src="${ZOO_ART_READY['portrait-' + a.sp]}" alt="">`
      : `<span>${sp.emoji}</span>`;
    return `<div class="title"><h2>${esc(a.name)}</h2><button class="heart" data-rename="${a.id}" title="Rename">✏️</button></div>
      <div class="sub">${esc(sp.name)}${a.baby ? ' · baby' : ''} · ${moodWord[Sim.mood(a.happy)]}</div>
      <div class="portrait">${portrait}</div>
      ${problemBlock(Sim.problem(S, a))}
      ${meter('Comfort', '🍃', n.comfort)}${meter('Food', '🥣', n.food)}${meter('Social', '👥', n.social)}
      <div class="traits"><span class="chip">${tr.emoji} ${esc(tr.name)}</span><span class="chip">❤️ Loves ${esc(fav.name.toLowerCase())}s</span></div>
      <p class="muted small">${esc(tr.desc)} ${esc(sp.fact)}</p>
      <div class="row2"><button class="btn ghost wide" data-ui="follow" data-id="${a.id}">${ui.follow === a.id ? '⏹ Stop following' : `👀 Follow ${esc(a.name)}`}</button></div>
      <div class="row2"><button class="btn ghost small" data-panel-hab="${a.hab}">🏡 Their habitat</button><button class="btn ghost small" data-rehome="${a.id}">Find a new home</button></div>`;
  },

  habitat(p) {
    const hab = Sim.habitatById(S, p.id);
    if (!hab) return null;
    const bio = D.BIOMES[hab.biome];
    const who = Sim.residents(S, hab);
    const used = Sim.spaceUsed(S, hab);
    const tier = S.tiers[hab.id];
    const wanted = new Set(who.flatMap(Sim.wantsOf));
    const items = Object.entries(D.ITEMS)
      .map(([k, it]) => {
        const here = hab.items.includes(k);
        const want = wanted.has(k);
        if (here)
          return `<button class="itm on" data-cmd='{"type":"removeItem","hab":${hab.id},"item":"${k}"}' title="Remove (half back)">${it.emoji}<small>${esc(it.name)}</small><i>✓</i></button>`;
        return `<button class="itm ${want ? 'want' : ''}" data-cmd='{"type":"item","hab":${hab.id},"item":"${k}"}' ${S.coins < it.cost || hab.items.length >= D.BALANCE.maxItems ? 'disabled' : ''} title="${esc(it.desc)}">${it.emoji}<small>${esc(it.name)}</small><i>${it.cost}</i></button>`;
      })
      .join('');
    const kids = who
      .map(
        (a) =>
          `<button class="face" data-panel-animal="${a.id}">${D.SPECIES[a.sp].emoji}<small>${esc(a.name)}</small><i class="${Sim.mood(a.happy)}"></i></button>`
      )
      .join('');
    const adopt = Object.entries(D.SPECIES)
      .filter(([k, sp]) => sp.biome === hab.biome && S.offered.includes(k))
      .map(
        ([k, sp]) =>
          `<button class="btn small" data-cmd='{"type":"adopt","sp":"${k}","hab":${hab.id}}' ${used + sp.space > D.HABITAT_SPACE || S.coins < sp.cost ? 'disabled' : ''}>${sp.emoji} ${esc(sp.name)} · ${sp.cost} 🪙</button>`
      )
      .join('');
    const steps = Sim.TIER_NAMES.slice(1)
      .map((t, i) => `<span class="${tier >= i + 1 ? 'on' : ''}">${i + 1}</span>`)
      .join('');
    return `<h2>${bio.emoji} ${esc(bio.name)}</h2>
      <div class="tier"><div class="steps">${steps}</div><b>${Sim.TIER_NAMES[tier]}</b></div>
      ${S.open.includes(hab.id) ? '' : '<div class="need">🛤️ Keepers and guests can\'t reach it. <button class="btn small" data-build="path">Lay a path</button></div>'}
      <div class="row"><span>🥣 Food</span><span class="bar ${hab.food < 30 ? 'low' : ''}"><i style="width:${hab.food}%"></i></span>${coinBtn({ type: 'feed', hab: hab.id }, 'Feed', D.BALANCE.feedCost, 'small')}</div>
      <div class="row"><span>🏡 Room</span><span class="bar"><i style="width:${(used / D.HABITAT_SPACE) * 100}%"></i></span><small>${used}/${D.HABITAT_SPACE}</small></div>
      <h3>Who lives here</h3><div class="faces">${kids || '<p class="muted">Nobody yet.</p>'}</div>
      <h3>Enrichment <small class="muted">${hab.items.length}/${D.BALANCE.maxItems} · dotted = wanted</small></h3><div class="items">${items}</div>
      ${tier >= 2 && tier < 3 ? `<p class="muted">Plant ${3 - Math.min(3, Sim.decorAround(S, hab))} more flowers, hedges or benches round the fence to make it a signature habitat.</p>` : ''}
      <h3>Adopt</h3><div class="wrap">${adopt || '<span class="muted">No offers for this habitat yet.</span>'}</div>`;
  },

  thing(p) {
    const b = Sim.buildById(S, p.id);
    if (!b) return null;
    const def = D.BUILDS[b.k];
    const open = Sim.isOpen(S, b.x, b.y, 1, 1);
    const earns =
      def.kind === 'shop' && def.spend
        ? `<p>Earning about <b>${Math.round(Math.min(S.guests, def.seats) * D.BALANCE.shopEveryGuest * def.spend * (0.5 + S.enjoy / 2) * D.BALANCE.dayLength)} 🪙</b> a day right now (serves up to ${def.seats} at once).</p>`
        : '';
    return `<h2>${def.emoji} ${esc(def.name)}</h2><p>${esc(def.desc)}</p>
      ${open ? '' : '<div class="need">🛤️ Not next to a path guests can reach.</div>'}${earns}
      <p class="muted">${def.upkeep ? `Upkeep ${def.upkeep} 🪙 a day. ` : ''}${def.appeal ? `Adds ${def.appeal} appeal.` : ''}</p>
      <button class="btn ghost" data-cmd='{"type":"bulldoze","x":${b.x},"y":${b.y}}'>Remove (+${Math.floor(def.cost * D.BALANCE.refund)} 🪙)</button>`;
  },

  staff() {
    const rows = Object.entries(D.STAFF)
      .map(
        ([
          k,
          st,
        ]) => `<div class="animal-row"><span class="big">${st.emoji}</span><div><b>${esc(st.name)}s: ${S.staff[k]}</b><small>${esc(st.desc)}</small><small>Wage ${st.wage} 🪙 a day.</small></div>
        <div class="col">${S.rep < st.rep ? `<span class="muted">🔒 ${st.rep} care rep</span>` : coinBtn({ type: 'hire', role: k }, 'Hire', st.hire, 'small')}
        ${S.staff[k] ? `<button class="btn small ghost" data-cmd='{"type":"fire","role":"${k}"}'>Let go</button>` : ''}</div></div>`
      )
      .join('');
    const covered = S.staff.keeper * D.BALANCE.keeperPens;
    return `<h2>Staff</h2>${rows}<p class="muted">Your keepers cover ${covered} of ${S.habitats.length} habitat${S.habitats.length === 1 ? '' : 's'}.</p>`;
  },

  goals() {
    const rows = D.GOALS.map((g, i) => {
      const state = i < S.goal ? '✅' : i === S.goal ? (Sim.goalDone(S, g) ? '🎉' : '👉') : '·';
      return `<div class="goal-row ${i > S.goal ? 'muted' : ''}">${state} <b>${i > S.goal + 2 ? '???' : esc(g.title)}</b> ${i > S.goal + 2 ? '' : esc(g.text)}</div>`;
    });
    return `<h2>Goals</h2>${rows.join('')}`;
  },

  zoo() {
    const mult = Sim.priceMult(S);
    const costs = Sim.wages(S) + Sim.upkeep(S);
    const r = S.report;
    const st = S.stats;
    const stage = Sim.stage(S);
    const next = D.STAGES.find((x) => x.rep > S.rep);
    return `<h2>🏛️ ${esc(S.name || 'Your zoo')}</h2>
      <div class="sub">${esc(stage.name)} · ${Math.floor(S.rep)} care reputation${next ? ` · "${esc(next.name)}" at ${next.rep}` : ''}</div>
      ${S.opened ? '' : `<div class="need">🎟️ The gates are closed. ${coinBtn({ type: 'open' }, 'Open the gates', 0)}</div>`}
      <h3>Money</h3>
      <p>${r ? `Yesterday: <b class="${r.net < 0 ? 'bad' : 'good'}">${r.net >= 0 ? '+' : ''}${r.net} 🪙</b> · ` : ''}Running costs tonight: <b>${costs} 🪙</b> <small class="muted">(wages ${Sim.wages(S)}, upkeep ${Sim.upkeep(S)})</small></p>
      <h3>🎟️ Ticket price: <span id="pricev">${S.price}</span> 🪙</h3>
      <input type="range" min="0" max="40" value="${S.price}" id="price">
      <p class="muted">Guests think about ${S.fair} 🪙 is fair right now. At this price you draw ${Math.round(mult * 100)}% of the crowd you could. Appeal ${S.appeal}, room for ${S.capacity} on your paths.</p>
      <h3>All time</h3><p class="muted">${st.guests} visitors · ${fmt(st.earned)} 🪙 earned · ${st.hellos} hellos · ${st.cleaned} poops tidied · ${st.babies} babies</p>
      <h3>Settings</h3><div class="wrap">
      <button class="btn ghost small" data-ui="rename-zoo">✏️ Rename zoo</button>
      <button class="btn ghost small" data-ui="sound">${prefs.sound ? '🔊 Sound on' : '🔈 Sound off'}</button>
      <button class="btn ghost small" data-ui="motion">${prefs.reduceMotion ? '🐢 Reduced motion' : '🐇 Full motion'}</button>
      <button class="btn ghost small" data-ui="buildpause">${prefs.pauseWhileBuilding ? '⏸ Pause while building' : '▶ Keep time while building'}</button>
      <button class="btn ghost small" data-ui="newzoo">🗑️ Start a new zoo</button></div>`;
  },
};

// ---------- toasts, pop-ups, confetti ----------
function toast(text, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  $('#toasts').prepend(el);
  setTimeout(() => el.classList.add('out'), 3500);
  setTimeout(() => el.remove(), 4000);
  while ($('#toasts').children.length > 3) $('#toasts').lastChild.remove();
}
function modal(html, button = 'Lovely!') {
  $('#modal .box').innerHTML = html + `<div class="actions"><button class="btn" data-ui="closemodal">${button}</button></div>`;
  $('#modal').hidden = false;
}
function showDayReport(r) {
  const born = r.babies.map((id) => Sim.animalById(S, id)).filter(Boolean);
  modal(`<h2>🌙 Day ${r.day} is done</h2>
    <div class="stats"><div><span class="big">🧒</span><b>${r.guests}</b><small>visitors</small></div>
    <div><span class="big">🎟️</span><b>${r.tickets}</b><small>tickets</small></div>
    <div><span class="big">🍦</span><b>${r.shops}</b><small>shops</small></div>
    <div><span class="big">🍃</span><b>${r.care}%</b><small>care</small></div></div>
    <p>Food ${r.food} · wages ${r.wages} · upkeep ${r.upkeep} → <b class="${r.net < 0 ? 'bad' : 'good'}">${r.net >= 0 ? '+' : ''}${r.net} 🪙</b> for the day.</p>
    <p class="muted">Tonight's running costs: ${Sim.wages(S) + Sim.upkeep(S)} 🪙.</p>
    ${born.length ? `<p>🍼 New arrivals: ${born.map((a) => `${D.SPECIES[a.sp].emoji} <b>${esc(a.name)}</b>`).join(', ')}</p>` : ''}`);
}
function showAway(a) {
  modal(`<h2>👋 Welcome back!</h2><p>Your keepers kept things ticking while you were away.</p>
    <div class="stats"><div><span class="big">🧒</span><b>${a.guests}</b><small>visitors</small></div>
    <div><span class="big">🪙</span><b>${a.coins >= 0 ? '+' : ''}${a.coins}</b><small>coins</small></div>
    <div><span class="big">🍃</span><b>${a.rep >= 0 ? '+' : ''}${a.rep}</b><small>reputation</small></div>
    <div><span class="big">🍼</span><b>${a.babies}</b><small>babies</small></div></div>
    <p class="muted">Some bowls might be empty. Go and say hello!</p>`);
}
// The deck's first step: make it yours. Naming the zoo also ticks the first goal.
function showWelcome() {
  modal(
    `<h2>🐾 A little zoo. A lot of personality.</h2>
    <p>You've taken over a tiny, empty animal park. Build homes, welcome animals and get to know them. Happy animals bring happy visitors.</p>
    <label class="field">What's your zoo called?<input id="zooname-input" maxlength="28" placeholder="Little Paws Zoo"></label>`,
    "Let's go!"
  );
  ui.naming = true;
}

function celebrate() {
  if (prefs.reduceMotion) return;
  const box = $('#confetti');
  for (let i = 0; i < 36; i++) {
    const s = document.createElement('i');
    s.textContent = ['🌸', '⭐', '🍃', '🎈', '🐾'][i % 5];
    s.style.left = Math.random() * 100 + '%';
    s.style.animationDelay = Math.random() * 0.6 + 's';
    box.appendChild(s);
    setTimeout(() => s.remove(), 2600);
  }
}

// ---------- one click handler for everything ----------
function onClick(e) {
  const el = e.target.closest('button,#goal');
  if (!el || el.disabled) return;
  const d = el.dataset;
  if (d.cmd) {
    const cmd = JSON.parse(d.cmd);
    const res = act(cmd);
    if (res.ok) {
      sfx(cmd.type === 'claim' ? 'level' : cmd.type === 'adopt' ? 'baby' : 'coin');
      if (cmd.type === 'claim' || cmd.type === 'open') celebrate();
      if (ui.panel) drawPanel();
    }
  } else if (el.id === 'goal') openPanel('goals');
  else if (d.panel !== undefined) {
    if (!d.panel || (ui.panel && ui.panel.kind === d.panel)) closePanel();
    else openPanel(d.panel);
  } else if (d.panelHab) openPanel('habitat', +d.panelHab);
  else if (d.panelAnimal) openPanel('animal', +d.panelAnimal);
  else if (d.build) setMode('build', d.build);
  else if (d.mode !== undefined) setMode(ui.mode === d.mode ? null : d.mode || null);
  else if (d.tab) {
    ui.panel.tab = d.tab;
    drawPanel();
  } else if (d.rename) {
    const a = Sim.animalById(S, +d.rename);
    const name = a && prompt(`A new name for ${a.name}?`, a.name);
    if (name) act({ type: 'rename', animal: a.id, name });
  } else if (d.rehome) {
    const a = Sim.animalById(S, +d.rehome);
    if (a && confirm(`Send ${a.name} to a lovely new home? You'll get some coins back.`)) act({ type: 'rehome', animal: a.id });
  } else if (d.ui) UI_ACTIONS[d.ui](d);
}
const UI_ACTIONS = {
  closemodal() {
    if (ui.naming) {
      ui.naming = false;
      const v = $('#zooname-input').value.trim() || 'Little Paws Zoo';
      act({ type: 'name', name: v });
    }
    $('#modal').hidden = true;
  },
  undo,
  follow(d) {
    ui.follow = ui.follow === +d.id ? null : +d.id;
    if (ui.follow && render.cam.zoom < 1.8) render.zoomAt(1.8 / render.cam.zoom);
    drawPanel();
  },
  sound() {
    prefs.sound = !prefs.sound;
    savePrefs();
    updateHud();
  },
  motion() {
    prefs.reduceMotion = !prefs.reduceMotion;
    savePrefs();
    updateHud();
  },
  buildpause() {
    prefs.pauseWhileBuilding = !prefs.pauseWhileBuilding;
    savePrefs();
    updateHud();
  },
  speed() {
    if (ui.paused) ui.paused = ui.autoPaused = false;
    else ui.speed = ui.speed === 1 ? 3 : 1;
    updateHud();
  },
  zoomin: () => render.zoomAt(1.25),
  zoomout: () => render.zoomAt(1 / 1.25),
  'rename-zoo'() {
    const name = prompt('What should your zoo be called?', S.name);
    if (name) act({ type: 'name', name });
  },
  newzoo() {
    if (confirm('Start over with a brand new zoo? Your animals will miss you.')) {
      newZoo();
      closePanel();
      showWelcome();
    }
  },
};
function onInput(e) {
  if (e.target.id === 'price') {
    act({ type: 'price', price: +e.target.value });
    $('#pricev').textContent = e.target.value;
  }
}
