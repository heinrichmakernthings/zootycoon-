// CUTISE ZOO — the HUD, the goal card, building modes, toasts, pop-ups and the one click handler.
// The side panel's contents live in panels.js.
// Buttons say what they do with data attributes:
//   data-cmd='{"type":"feed","hab":3}'          → act(...) straight away (nothing to regret)
//   data-confirm='{"cmd":{...},"title":"…"}'    → a confirm pop-up first, then act with a fresh tx id
//   data-panel / data-open / data-tab           → change the panel
//   data-mode / data-build / data-enclose / data-place / data-resize / data-ui → screen only

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
  $('#rep').title = `Care ${S.care}% · reputation ${Math.floor(S.rep)}${next ? ` · "${next.name}" at ${next.rep}` : ''}`;
  $('#speed').textContent = ui.paused ? '⏸' : ui.speed === 1 ? '▶' : '⏩';
  $('#speed').title = ui.paused ? (ui.autoPaused ? 'Paused while you build' : 'Paused') : 'Speed';
  updateGoalCard();
  if (ui.panel && !document.activeElement.closest('#panel input[type=range], #panel input[type=text], #panel select')) drawPanel();
}

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

// ---------- building modes ----------
// The deck and the pack: the zoo waits while you build (pause during edit), previews are ghosts,
// invalid spots say why, and undo is free for a little while.
function setMode(mode, opts = {}) {
  ui.mode = mode;
  ui.buildKey = opts.k || null;
  ui.species = opts.sp || null;
  ui.hab = opts.hab || null;
  ui.item = opts.item || null;
  ui.rot = 0;
  ui.drag = null;
  ui.rect = null;
  ui.canUndo = false;
  document.body.dataset.mode = mode || '';
  if (mode && prefs.pauseWhileBuilding && !ui.paused) ui.paused = ui.autoPaused = true;
  if (!mode && ui.autoPaused) ui.paused = ui.autoPaused = false;
  if (mode) closePanel();
  setTip(null);
  updateHud();
}
function rotate() {
  ui.rot = (ui.rot + 90) % 360;
}
// The bar at the top while building: what, why not, and the buttons that matter.
function setTip(why, rect, out) {
  const tip = $('#modetip');
  if (!ui.mode) return (tip.hidden = true);
  let head,
    extra = '';
  if (ui.mode === 'build') {
    const def = D.BUILDS[ui.buildKey];
    head = `${def.emoji} <b>${esc(def.name)}</b> · ${def.cost} 🪙${def.kind === 'path' || def.kind === 'decor' ? ' · drag to lay a run' : ''}`;
  } else if (ui.mode === 'enclose') {
    const sp = D.SPECIES[ui.species];
    head = `${sp.emoji} <b>${esc(sp.habitat)}</b> · drag out the fence (suggested ${sp.footprint[0]}×${sp.footprint[1]})`;
  } else if (ui.mode === 'resize') {
    head = '📐 Drag out the new fence line';
    if (ui.rect && !why) extra = `<button class="btn small" data-ui="confirmresize">Confirm · ${out.cost} 🪙</button>`;
  } else if (ui.mode === 'place') {
    const def = D.ITEMS[ui.item];
    head = `${def.emoji} <b>${esc(def.name)}</b> · ${def.price} 🪙`;
    if (def.fp[0] !== def.fp[1]) extra = '<button class="btn small ghost" data-ui="rotate">⟳ Rotate</button>';
  } else if (ui.mode === 'land') head = '🗺️ Tap a plot next to your land to buy it';
  else head = '🧹 Tap to clear (half back)';
  const html = `<span>${head}${why ? `<em class="why">${esc(why)}</em>` : ''}</span>${extra}${ui.canUndo ? '<button class="btn small ghost" data-ui="undo">↶ Undo</button>' : ''}<button class="btn small" data-mode="">Done</button>`;
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
function openPanel(kind, id, tab) {
  if (ui.mode) setMode(null);
  const same = ui.panel && ui.panel.kind === kind && ui.panel.id === id;
  ui.panel = { kind, id, tab: tab || (same ? ui.panel.tab : null) };
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
  const top = body.scrollTop;
  body.innerHTML = html;
  body.dataset.html = html;
  body.scrollTop = top;
}

// ---------- toasts, pop-ups, confetti ----------
function toast(text, kind = 'info', animal) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  if (animal) {
    el.dataset.open = 'animal';
    el.dataset.id = animal;
    el.classList.add('link');
  }
  $('#toasts').prepend(el);
  setTimeout(() => el.classList.add('out'), 4500);
  setTimeout(() => el.remove(), 5000);
  while ($('#toasts').children.length > 3) $('#toasts').lastChild.remove();
}
function modal(html, buttons = '<button class="btn" data-ui="closemodal">Lovely!</button>') {
  $('#modal .box').innerHTML = html + `<div class="actions">${buttons}</div>`;
  $('#modal').hidden = false;
}
const closeModal = () => ($('#modal').hidden = true);
// Money-moving and hard-to-undo actions ask first, then run with a fresh transaction id.
let pending = null;
function confirmAct(title, body, cmd, label = 'Confirm') {
  pending = cmd;
  modal(
    `<h2>${title}</h2>${body}`,
    `<button class="btn ghost" data-ui="closemodal">Cancel</button><button class="btn" data-ui="doconfirm">${esc(label)}</button>`
  );
}
// The browser's prompt() and confirm() are blocked in some places the game runs (and look out of
// place everywhere), so naming and "are you sure?" use the game's own pop-up.
let pendingFn = null;
function askText(title, label, value, onOk, max = 16) {
  pendingFn = () => {
    const v = $('#ask-input').value.trim();
    if (v) onOk(v);
  };
  modal(
    `<h2>${esc(title)}</h2><label class="field">${esc(label)}<input id="ask-input" maxlength="${max}" value="${esc(value || '')}"></label>`,
    `<button class="btn ghost" data-ui="closemodal">Cancel</button><button class="btn" data-ui="askok">Save</button>`
  );
  setTimeout(() => $('#ask-input') && $('#ask-input').select(), 0);
}
function askYes(title, body, label, onOk) {
  pendingFn = onOk;
  modal(
    `<h2>${esc(title)}</h2>${body}`,
    `<button class="btn ghost" data-ui="closemodal">Cancel</button><button class="btn" data-ui="askok">${esc(label)}</button>`
  );
}
function confirmLand(cx, cy) {
  const price = Sim.landPrice(S);
  confirmAct(
    '🗺️ Buy this plot?',
    `<p>A ${D.BALANCE.chunk}×${D.BALANCE.chunk} plot of empty land for <b>${price} 🪙</b>.</p><p class="muted">Land upkeep goes up by ${D.BALANCE.landUpkeep} 🪙 a day (to ${(S.land.length + 1) * D.BALANCE.landUpkeep}). New land doesn't come with paths: lay one to reach it.</p>`,
    { type: 'buyLand', cx, cy },
    `Buy · ${price} 🪙`
  );
}
function showDayReport(r) {
  const born = r.babies.map((id) => Sim.animalById(S, id)).filter(Boolean);
  modal(`<h2>🌙 Day ${r.day} is done</h2>
    <div class="stats"><div><span class="big">🧒</span><b>${r.guests}</b><small>visitors</small></div>
    <div><span class="big">🎟️</span><b>${r.tickets}</b><small>tickets</small></div>
    <div><span class="big">🍦</span><b>${r.shops}</b><small>shops</small></div>
    <div><span class="big">🍃</span><b>${r.care}%</b><small>care</small></div></div>
    <p class="muted">Running costs: animals ${r.animals} · wages ${r.wages} · land ${r.land} · buildings ${r.buildings}${r.bought ? ` · bought ${r.bought}` : ''}${r.sold ? ` · sold +${r.sold}` : ''}</p>
    <p>That's <b class="${r.net < 0 ? 'bad' : 'good'}">${r.net >= 0 ? '+' : ''}${r.net} 🪙</b> for the day. Tonight's running costs: ${Sim.dailyCosts(S).total} 🪙.</p>
    ${born.length ? `<p>🍼 New arrivals: ${born.map((a) => `${D.SPECIES[a.sp].emoji} <b>${esc(a.name)}</b>`).join(', ')}</p>` : ''}`);
}
// A birth or hatching: a gentle reveal with a naming box. Dismissing keeps the newborn.
function showReveal(id) {
  const a = Sim.animalById(S, id);
  if (!a) return act({ type: 'seen', animal: id });
  const sp = D.SPECIES[a.sp];
  const parents = a.parents.map((p) => Sim.animalById(S, p)).filter(Boolean);
  ui.revealing = id;
  modal(
    `<div class="reveal"><span class="hero">${ZOO_ART_READY[`animal-${a.sp}-baby`] ? `<img src="${ZOO_ART_READY[`animal-${a.sp}-baby`]}" alt="">` : sp.egg ? '🐣' : sp.emoji}</span><h2>${sp.egg ? 'A chick has hatched!' : 'A baby has arrived!'}</h2>
    <p>A little ${sp.name.toLowerCase()} ${a.sex === 'f' ? 'girl' : 'boy'}${parents.length ? `, the ${a.sex === 'f' ? 'daughter' : 'son'} of ${parents.map((p) => esc(p.name)).join(' and ')}` : ''}.</p>
    <p class="muted">${esc(sp.baby)}</p>
    <label class="field">Their name<input id="reveal-name" maxlength="16" value="${esc(a.name)}"></label></div>`,
    `<button class="btn" data-ui="revealdone">Welcome, little one!</button>`
  );
}
function showWelcome() {
  modal(
    `<h2>🐾 A little zoo. A lot of personality.</h2>
    <p>You've taken over an empty patch of land at the edge of town. Fence homes, fill them with what animals need, then welcome your first residents. Happy animals bring happy visitors, and maybe a baby or two.</p>
    <label class="field">What's your zoo called?<input id="zooname-input" maxlength="28" placeholder="Little Paws Zoo"></label>`,
    `<button class="btn" data-ui="closemodal">Let's go!</button>`
  );
  ui.naming = true;
}
function showUpgraded() {
  modal(
    `<h2>🚚 Your zoo has moved!</h2><p>Cutise Zoo has grown: a bigger park you can expand, enclosures you size yourself, 20 species, families and a market.</p><p>Your old zoo couldn't come along as it was, so everything was sold back for <b>${S.compensation || 0} 🪙</b>. Your name, days, reputation and visitor count came with you.</p><p class="muted">A copy of your old save is kept on this device.</p>`,
    '<button class="btn" data-ui="closemodal">Let\'s build!</button>'
  );
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
  const el = e.target.closest('button,#goal,.toast.link');
  if (!el || el.disabled) return;
  const d = el.dataset;
  if (d.cmd) {
    const cmd = JSON.parse(d.cmd);
    const res = act(cmd);
    if (res.ok) {
      sfx(cmd.type === 'claim' ? 'level' : 'coin');
      if (cmd.type === 'claim' || cmd.type === 'open') celebrate();
      if (ui.panel) drawPanel();
    }
  } else if (d.confirm) {
    const c = JSON.parse(d.confirm);
    confirmAct(esc(c.title), c.body || '', c.cmd, c.label);
  } else if (el.id === 'goal') openPanel('goals');
  else if (d.open) openPanel(d.open, d.id !== undefined ? +d.id : undefined, d.tab);
  else if (d.panel !== undefined) {
    if (!d.panel || (ui.panel && ui.panel.kind === d.panel)) closePanel();
    else openPanel(d.panel);
  } else if (d.build) setMode('build', { k: d.build });
  else if (d.enclose) setMode('enclose', { sp: d.enclose });
  else if (d.place) setMode('place', { hab: +d.hab, item: d.place });
  else if (d.resize) setMode('resize', { hab: +d.resize });
  else if (d.mode !== undefined) setMode(ui.mode === d.mode ? null : d.mode || null);
  else if (d.tab) {
    ui.panel.tab = d.tab;
    drawPanel();
  } else if (d.ui) UI_ACTIONS[d.ui](d, el);
}
const UI_ACTIONS = {
  closemodal() {
    if (ui.naming) {
      ui.naming = false;
      act({ type: 'name', name: $('#zooname-input').value.trim() || 'Little Paws Zoo' });
    }
    pending = null;
    pendingFn = null;
    closeModal();
  },
  askok() {
    const fn = pendingFn;
    pendingFn = null;
    closeModal();
    if (fn) fn();
  },
  doconfirm() {
    const cmd = pending;
    pending = null;
    closeModal();
    if (!cmd) return;
    const res = act({ ...cmd, tx: newTx() });
    if (!res.ok) return;
    sfx(cmd.type === 'buy' || cmd.type === 'breed' ? 'baby' : 'coin');
    if (cmd.type === 'buy') openPanel('animal', res.animal);
    else if (cmd.type === 'buyLand') {
      setMode(null);
      celebrate();
    } else if (cmd.type === 'sell' || cmd.type === 'demolish') closePanel();
    else if (ui.panel) drawPanel();
  },
  revealdone() {
    const id = ui.revealing;
    const name = $('#reveal-name').value.trim();
    const a = Sim.animalById(S, id);
    if (a && name && name !== a.name) act({ type: 'rename', animal: id, name });
    act({ type: 'seen', animal: id });
    closeModal();
    openPanel('animal', id);
  },
  undo,
  rotate,
  confirmresize() {
    const r = ui.rect;
    if (!r) return;
    const hab = ui.hab;
    const res = act({ type: 'resize', hab, ...r });
    if (!res.ok) return;
    sfx('build');
    setMode(null);
    openPanel('habitat', hab);
  },
  follow(d) {
    ui.follow = ui.follow === +d.id ? null : +d.id;
    if (ui.follow && render.cam.tw < 56) render.cam.tw = 56;
    drawPanel();
  },
  move(d, el) {
    const sel = el.parentElement.querySelector('select');
    if (sel && sel.value) act({ type: 'move', animal: +d.id, hab: +sel.value }).ok && drawPanel();
  },
  pair(d, el) {
    const box = el.closest('.pairpick');
    const a = box.querySelector('[name=pa]:checked'),
      b = box.querySelector('[name=pb]:checked');
    if (a && b && act({ type: 'pair', hab: +d.hab, a: +a.value, b: +b.value }).ok) drawPanel();
  },
  rename(d) {
    const a = Sim.animalById(S, +d.id);
    if (a) askText(`Rename ${a.name}`, 'Their new name', a.name, (name) => act({ type: 'rename', animal: a.id, name }));
  },
  home: () => render.home(),
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
    askText('Rename your zoo', 'What should your zoo be called?', S.name, (name) => act({ type: 'name', name }), 28);
  },
  newzoo() {
    askYes(
      'Start a brand new zoo?',
      '<p>Everything here goes: animals, enclosures, coins and progress. Your animals will miss you.</p>',
      'Start over',
      () => {
        newZoo();
        closePanel();
        showWelcome();
      }
    );
  },
};
function onInput(e) {
  if (e.target.id === 'price') {
    act({ type: 'price', price: +e.target.value });
    $('#pricev').textContent = e.target.value;
  }
  if (e.target.name === 'pa' || e.target.name === 'pb') UI_ACTIONS.pair({ hab: e.target.closest('.pairpick').dataset.hab }, e.target);
}
