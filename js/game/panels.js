// CUTISE ZOO — what the side panel shows. Each PANELS entry returns HTML for one kind of panel
// (or null to close it). Pack rule: one simple contextual panel per thing, important actions
// visible, and a disabled action always says why in plain words (not only in a tooltip).

// A picture when its art is ready, else the emoji stand-in.
const pic = (key, emoji, cls = '') => (ZOO_ART_READY[key] ? `<img class="pic ${cls}" src="${ZOO_ART_READY[key]}" alt="">` : emoji);
const animalPic = (a, cls) => pic(a.stage ? animalArtKey(a) : 'animal-' + a.sp, D.SPECIES[a.sp].emoji, cls);
const meter = (label, icon, v) =>
  `<div class="meter"><span>${icon} ${label}</span><span class="bar ${v < 35 ? 'low' : ''}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span></div>`;
const attr = (o) => esc(JSON.stringify(o));
const coinBtn = (cmd, label, cost, cls = '') =>
  `<button class="btn ${cls}" data-cmd="${attr(cmd)}" ${S.coins < cost ? 'disabled' : ''}>${label}${cost ? ` · ${cost} 🪙` : ''}</button>`;
const confirmBtn = (c, label, cls = '', disabled) =>
  `<button class="btn ${cls}" data-confirm="${attr(c)}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const why = (text) => (text ? `<p class="why">${esc(text)}</p>` : '');
const moodWord = { love: 'Over the moon', happy: 'Happy', meh: 'So-so', sad: 'Unhappy' };
const face = (a, extra = '') =>
  `<button class="face" data-open="animal" data-id="${a.id}">${animalPic(a)}<small>${esc(a.name)} ${sexIcon(a.sex)}</small>${extra}<i class="${Sim.mood(a.wb)}"></i></button>`;
const tabs = (p, list) =>
  `<div class="tabs">${Object.entries(list)
    .map(([k, v]) => `<button class="tab ${k === (p.tab || Object.keys(list)[0]) ? 'on' : ''}" data-tab="${k}">${v}</button>`)
    .join('')}</div>`;
const habName = (hab) => `${D.SPECIES[hab.sp].emoji} ${esc(D.SPECIES[hab.sp].habitat)}`;

// A problem as the deck draws it: a warm chip with the need, then one big button that fixes it.
function problemBlock(p, hab) {
  if (!p) return '<div class="okchip">🌿 All is well</div>';
  let fix = '';
  if (p.fix && p.fix.cmd) fix = coinBtn(p.fix.cmd, p.fix.label, p.fix.cost, 'wide');
  else if (p.fix && p.fix.place)
    fix = `<button class="btn wide" data-place="${p.fix.place}" data-hab="${hab.id}" ${S.coins < p.fix.cost ? 'disabled' : ''}>${esc(p.fix.label)} · ${p.fix.cost} 🪙</button>`;
  else if (p.fix && p.fix.ui === 'path') fix = `<button class="btn wide" data-build="path">${esc(p.fix.label)}</button>`;
  else if (p.fix && p.fix.ui === 'resize') fix = `<button class="btn wide" data-resize="${hab.id}">${esc(p.fix.label)}</button>`;
  else if (p.fix && p.fix.ui === 'market') fix = `<button class="btn wide" data-open="market">${esc(p.fix.label)}</button>`;
  return `<div class="need">💛 ${esc(p.text)} <span class="dot">!</span></div>${p.why ? `<p class="muted">${esc(p.why)}</p>` : ''}${fix}`;
}

const PANELS = {
  build(p) {
    const tab = p.tab || 'enclose';
    const head = `<h2>Build</h2>` + tabs(p, { enclose: '🏡 Enclosures', park: '🛤️ Paths & park', land: '🗺️ Land' });
    if (tab === 'enclose') {
      const rows = Object.values(D.SPECIES).map((sp) => {
        const open = Sim.unlocked(S, sp.stage);
        const homes = S.habs.filter((h) => h.sp === sp.id).length;
        return `<div class="animal-row ${open ? '' : 'locked'}"><span class="big">${pic('animal-' + sp.id, sp.emoji)}</span>
          <div><b>${esc(sp.habitat)}</b> ${homes ? `<span class="chip">×${homes}</span>` : ''}<small>${esc(sp.name)} · ${esc(sp.zone)} · suggested ${sp.footprint[0]}×${sp.footprint[1]}</small></div>
          ${open ? `<button class="btn small" data-enclose="${sp.id}">Fence it</button>` : `<span class="muted small">🔒 ${esc(Sim.stageOf(sp.stage).name)}</span>`}</div>`;
      });
      return (
        head +
        `<p class="muted">Drag out a fence on your land. Fencing costs ${D.BALANCE.fencePerEdge} 🪙 per edge plus ${D.BALANCE.terrainPerTile} 🪙 per tile. One species per enclosure.</p>` +
        rows.join('')
      );
    }
    if (tab === 'land') {
      const sale = Sim.landForSale(S);
      return (
        head +
        `<p>You own <b>${S.land.length}</b> plots of ${D.BALANCE.chunk}×${D.BALANCE.chunk} tiles. Each costs ${D.BALANCE.landUpkeep} 🪙 a day to keep.</p><p>The next plot costs <b>${Sim.landPrice(S)} 🪙</b>. ${sale.length} plots next to yours are for sale.</p><button class="btn wide" data-mode="land">🗺️ Choose a plot on the map</button>`
      );
    }
    return (
      head +
      `<div class="cards">` +
      Object.entries(D.BUILDS)
        .map(([k, b]) => {
          const open = Sim.unlocked(S, b.stage);
          return `<button class="card ${open ? '' : 'locked'}" ${open ? `data-build="${k}"` : 'disabled'}><span class="big">${pic('build-' + k, b.emoji, 'card-pic')}</span><b>${esc(b.name)}</b><small>${esc(b.desc)}</small>
          <span class="price ${S.coins < b.cost ? 'bad' : ''}">${open ? `${b.cost} 🪙${b.upkeep ? ` <i>+${b.upkeep}/day</i>` : ''}` : `🔒 ${esc(Sim.stageOf(b.stage).name)}`}</span></button>`;
        })
        .join('') +
      `</div>`
    );
  },

  // The market: six listings, refreshed daily. Buy asks first, showing the group and upkeep after.
  market() {
    const rows = S.market.offers.map((o) => {
      const sp = D.SPECIES[o.sp];
      const homes = S.habs.filter((h) => h.sp === o.sp);
      const room = homes.find((h) => Sim.habStats(S, h).free >= 1);
      let action;
      if (!Sim.unlocked(S, sp.stage)) action = why(`Unlocks at "${Sim.stageOf(sp.stage).name}"`);
      else if (!homes.length) action = `<button class="btn small ghost" data-enclose="${o.sp}">Fence a ${esc(sp.habitat)} first</button>`;
      else if (!room)
        action = why(
          `No room in your ${sp.name.toLowerCase()} enclosure${homes.length > 1 ? 's' : ''}: add space, shelter, a feeder or water.`
        );
      else {
        const group = Sim.residents(S, room).length + 1;
        const upkeep = Sim.dailyCosts(S).animals + sp.upkeep;
        const body = `<p>${sp.emoji} A ${o.sex === 'f' ? 'female' : 'male'} ${sp.name.toLowerCase()} (${esc(D.TRAITS[o.trait].name.toLowerCase())}) for <b>${o.price} 🪙</b>.</p><p>They'll live in <b>${esc(sp.habitat)}</b>, making a group of ${group}. Animal upkeep goes to ${upkeep} 🪙 a day (+${sp.upkeep}).</p><p class="muted">If you sell them later they fetch ${Math.floor(o.price * D.BALANCE.saleFraction)} 🪙.</p>`;
        action = confirmBtn(
          {
            cmd: { type: 'buy', offer: o.id, hab: room.id },
            title: `Welcome a ${sp.name.toLowerCase()}?`,
            body,
            label: `Buy · ${o.price} 🪙`,
          },
          `Buy · ${o.price} 🪙`,
          'small',
          S.coins < o.price
        );
      }
      return `<div class="animal-row"><span class="big">${pic('animal-' + o.sp, sp.emoji)}</span><div><b>${esc(sp.name)} ${sexIcon(o.sex)}</b><small>${esc(D.TRAITS[o.trait].emoji)} ${esc(D.TRAITS[o.trait].name)} · adult · ${sp.upkeep} 🪙/day</small><small class="blurb">${esc(sp.personality)}</small></div><div class="col">${action}</div></div>`;
    });
    const mine = S.habs
      .map((h) => {
        const who = Sim.residents(S, h);
        return who.length ? `<h3>${habName(h)}</h3><div class="faces">${who.map((a) => face(a)).join('')}</div>` : '';
      })
      .join('');
    return `<h2>Animal market</h2><p class="muted">New listings every morning. Animals arrive as adults.</p>${rows.join('') || '<p class="muted">Nothing today. Come back tomorrow!</p>'}${mine ? `<h2 class="sp">Your animals</h2>${mine}` : ''}`;
  },

  // An enclosure: Overview (capacity and care), Build (its 15-item catalogue), Family (breeding).
  habitat(p) {
    const hab = Sim.habById(S, p.id);
    if (!hab) return null;
    const sp = D.SPECIES[hab.sp];
    const st = Sim.habStats(S, hab);
    const steps = Sim.TIER_NAMES.slice(1)
      .map((t, i) => `<span class="${st.tier >= i + 1 ? 'on' : ''}">${i + 1}</span>`)
      .join('');
    const head =
      `<h2>${habName(hab)}</h2><div class="sub">${esc(sp.name)}s · ${hab.w}×${hab.h} tiles</div><div class="tier"><div class="steps">${steps}</div><b>${Sim.TIER_NAMES[st.tier]}</b></div>` +
      tabs(p, { overview: 'Overview', build: 'Build', family: 'Family' });
    const tab = p.tab || 'overview';
    if (tab === 'build') return head + habBuild(hab, st);
    if (tab === 'family') return head + habFamily(hab, st);
    const who = Sim.residents(S, hab);
    const worst = who.map((a) => ({ a, p: Sim.problem(S, a) })).find((x) => x.p);
    const cap = [
      ['space', '📐 Space', st.physical],
      ['shelter', '🛖 Shelter', st.shelter],
      ['food', '🥕 Food', st.feed],
      ['water', '💧 Water', st.water],
    ]
      .map(
        ([k, label, v]) =>
          `<div class="caprow ${k === st.bottleneck ? 'neck' : ''}"><span>${label}</span><b>${v}</b>${k === st.bottleneck ? '<em>bottleneck</em>' : ''}</div>`
      )
      .join('');
    return (
      head +
      (worst
        ? problemBlock(worst.p, hab)
        : who.length
          ? '<div class="okchip">🌿 Everyone here is doing well</div>'
          : `<p class="muted">Nobody lives here yet. ${st.free > 0 ? '' : 'Give it a keeper gate, shelter, a feeder and water first.'}</p>`) +
      `<h3>Who it can support</h3><div class="capgrid">${cap}</div>
      <p class="small">Supports <b>${st.supported}</b> · lives here <b>${st.residents}</b>${st.reserved ? ` · on the way <b>${st.reserved}</b>` : ''} · free <b>${Math.max(0, st.free)}</b></p>
      <p class="muted small">Each ${sp.name.toLowerCase()} needs ${sp.tilesPerSlot} open tiles. Space alone doesn't add room: shelter, food and water have to keep up.</p>
      <div class="row"><span>🥕 Feeder</span><span class="bar ${hab.food < 30 ? 'low' : ''}"><i style="width:${st.feed ? hab.food : 0}%"></i></span>${coinBtn({ type: 'feed', hab: hab.id }, 'Top up', 0, 'small')}</div>
      <h3>Who lives here</h3><div class="faces">${who.map((a) => face(a, a.stage !== 'adult' ? `<em>${stageName[a.stage]}</em>` : '')).join('') || '<p class="muted">Nobody yet.</p>'}</div>
      ${who.length < st.supported ? `<button class="btn ghost small" data-open="market">🐾 Find animals at the market</button>` : ''}
      <h3>The enclosure</h3><div class="wrap"><button class="btn ghost small" data-resize="${hab.id}">📐 Resize</button>
      ${confirmBtn({ cmd: { type: 'demolish', hab: hab.id }, title: 'Take down this enclosure?', body: '<p>The fence and everything inside comes down. You get half the cost back.</p>', label: 'Take it down' }, 'Take down', 'ghost small', who.length > 0)}</div>
      ${who.length ? why('Move or sell the animals before taking it down.') : ''}`
    );
  },

  animal(p) {
    const a = Sim.animalById(S, p.id);
    if (!a) return null;
    const sp = D.SPECIES[a.sp],
      tr = D.TRAITS[a.trait],
      n = Sim.needs(S, a);
    const hab = Sim.habById(S, a.hab);
    const head =
      `<div class="title"><h2>${esc(a.name)}</h2><span class="sexbig">${sexIcon(a.sex)}</span><button class="heart" data-ui="rename" data-id="${a.id}" title="Rename">✏️</button></div>
      <div class="sub">${esc(sp.name)} · ${stageName[a.stage]} · ${moodWord[Sim.mood(a.wb)]}</div>` +
      tabs(p, { overview: 'Overview', family: 'Family' });
    if (p.tab === 'family') return head + animalFamily(a);
    const growth =
      a.stage !== 'adult'
        ? (() => {
            const total = a.stage === 'baby' ? sp.days.baby : sp.days.juvenile;
            return `<div class="meter"><span>🌱 Growing up</span><span class="bar"><i style="width:${(a.stageDays / total) * 100}%"></i></span></div><p class="muted small">${total - a.stageDays} more days as a ${a.stage}.</p>`;
          })()
        : '';
    const sellWhy = Sim.sellProblem(S, a);
    const value = Sim.salePrice(a);
    const others = S.habs.filter((h) => h.sp === a.sp && h.id !== a.hab);
    const moveWhy = others.length ? null : `No other ${sp.name.toLowerCase()} enclosure to move to.`;
    return (
      head +
      `<div class="portrait">${ZOO_ART_READY['portrait-' + a.sp] ? pic('portrait-' + a.sp, '') : `<span>${animalPic(a, 'portrait-pic')}</span>`}</div>` +
      problemBlock(Sim.problem(S, a), hab) +
      meter('Food', '🥕', n.food) +
      meter('Water', '💧', n.water) +
      meter('Comfort', '🍃', n.comfort) +
      meter('Social', '👥', n.social) +
      meter('Enrichment', '✨', n.enrichment) +
      `<p class="small">Wellbeing <b>${Math.round(a.wb)}%</b> · health <b>${Math.round(a.health)}%</b>${a.stage === 'adult' ? ` · ${a.goodDays} great day${a.goodDays === 1 ? '' : 's'} in a row` : ''}</p>` +
      growth +
      `<div class="traits"><span class="chip">${tr.emoji} ${esc(tr.name)}</span><span class="chip">${esc(sp.personality)}</span></div>
      <p class="muted small">${esc(tr.desc)} ${esc(sp.signature)}.</p>
      <div class="row2"><button class="btn ghost wide" data-ui="follow" data-id="${a.id}">${ui.follow === a.id ? '⏹ Stop following' : `👀 Follow ${esc(a.name)}`}</button></div>
      <h3>Move</h3>${others.length ? `<div class="row"><select>${others.map((h) => `<option value="${h.id}">${habName(h)} (${Math.max(0, Sim.habStats(S, h).free)} free)</option>`).join('')}</select><button class="btn small" data-ui="move" data-id="${a.id}">Move</button></div>` : why(moveWhy)}
      <h3>Find a new home</h3>${confirmBtn({ cmd: { type: 'sell', animal: a.id }, title: `Say goodbye to ${a.name}?`, body: `<p>${esc(a.name)} the ${esc(sp.name.toLowerCase())} goes to a lovely new home for <b>${value} 🪙</b>.</p><p class="muted">${Sim.residents(S, hab).length - 1} ${esc(sp.name.toLowerCase())}${Sim.residents(S, hab).length - 1 === 1 ? '' : 's'} will be left here.${Sim.residents(S, hab).length - 1 < sp.group[0] ? ` That's fewer than the ${sp.group[0]} they like to live with.` : ''} Their family history is kept.</p>`, label: `Sell · ${value} 🪙` }, `Sell · ${value} 🪙`, 'ghost', !!sellWhy)}${why(sellWhy)}`
    );
  },

  thing(p) {
    const b = Sim.buildById(S, p.id);
    if (!b) return null;
    const item = D.ITEMS[b.k];
    const def = D.BUILDS[b.k];
    const name = item ? item.name : def.name;
    const back = Math.floor((item ? item.price : def.cost) * D.BALANCE.refund);
    const open = Sim.besidePath(S, b.x, b.y, 1, 1);
    const earns =
      def && def.kind === 'shop' && def.spend
        ? `<p>Earning about <b>${Math.round(Math.min(S.guests, def.seats) * D.BALANCE.shopEveryGuest * def.spend * (0.5 + S.enjoy / 2) * D.BALANCE.dayLength)} 🪙</b> a day right now.</p>`
        : '';
    return `<h2>${item ? item.emoji : def.emoji} ${esc(name)}</h2><p>${esc(def ? def.desc : `Adds ${item.value} ${item.effect} to the enclosure next to it.`)}</p>
      ${def && !open ? '<div class="need">🛤️ Not next to a path guests can reach.</div>' : ''}${earns}
      ${def && def.upkeep ? `<p class="muted">Upkeep ${def.upkeep} 🪙 a day.</p>` : ''}
      <button class="btn ghost" data-cmd="${attr({ type: 'bulldoze', x: b.x, y: b.y })}">Remove (+${back} 🪙)</button>`;
  },

  staff() {
    const rows = Object.entries(D.STAFF)
      .map(
        ([
          k,
          st,
        ]) => `<div class="animal-row"><span class="big">${st.emoji}</span><div><b>${esc(st.name)}s: ${S.staff[k]}</b><small>${esc(st.desc)}</small><small>Wage ${st.wage} 🪙 a day.</small></div>
        <div class="col">${Sim.unlocked(S, st.stage) ? coinBtn({ type: 'hire', role: k }, 'Hire', st.hire, 'small') : `<span class="muted small">🔒 ${esc(Sim.stageOf(st.stage).name)}</span>`}
        ${S.staff[k] ? `<button class="btn small ghost" data-cmd="${attr({ type: 'fire', role: k })}">Let go</button>` : ''}</div></div>`
      )
      .join('');
    const reach = S.habs.filter((h) => Sim.habStats(S, h).access).length;
    return `<h2>Staff</h2>${rows}<p class="muted">Keepers cover ${S.staff.keeper * D.BALANCE.keeperHabitats} enclosures. ${reach} of ${S.habs.length} have a keeper gate by a path.</p>`;
  },

  goals() {
    const rows = D.GOALS.map((g, i) => {
      const state = i < S.goal ? '✅' : i === S.goal ? (Sim.goalDone(S, g) ? '🎉' : '👉') : '·';
      return `<div class="goal-row ${i > S.goal ? 'muted' : ''}">${state} <b>${i > S.goal + 2 ? '???' : esc(g.title)}</b> ${i > S.goal + 2 ? '' : esc(g.text)}</div>`;
    });
    return `<h2>Goals</h2>${rows.join('')}`;
  },

  zoo() {
    const c = Sim.dailyCosts(S);
    const r = S.report;
    const st = S.stats;
    const stage = Sim.stage(S);
    const next = D.STAGES.find((x) => x.rep > S.rep);
    const album = S.album
      .slice()
      .reverse()
      .slice(0, 12)
      .map(
        (pg) =>
          `<button class="face" ${Sim.animalById(S, pg.id) ? `data-open="animal" data-id="${pg.id}"` : 'disabled'}>${pic('animal-' + pg.sp + '-baby', D.SPECIES[pg.sp].emoji)}<small>${esc(pg.name)}</small><em>day ${pg.day}</em></button>`
      )
      .join('');
    return `<h2>🏛️ ${esc(S.name || 'Your zoo')}</h2>
      <div class="sub">${esc(stage.name)} · ${Math.floor(S.rep)} care reputation${next ? ` · "${esc(next.name)}" at ${next.rep}` : ''}</div>
      ${S.opened ? '' : `<div class="need">🎟️ The gates are closed. ${coinBtn({ type: 'open' }, 'Open the gates', 0, 'small')}</div>`}
      <h3>Money</h3>
      <p>${r ? `Yesterday: <b class="${r.net < 0 ? 'bad' : 'good'}">${r.net >= 0 ? '+' : ''}${r.net} 🪙</b>. ` : ''}Tonight's running costs: <b>${c.total} 🪙</b></p>
      <p class="muted small">Animals ${c.animals} · wages ${c.wages} · land ${c.land} (${S.land.length} plots) · buildings ${c.buildings}</p>
      <h3>🎟️ Ticket price: <span id="pricev">${S.price}</span> 🪙</h3>
      <input type="range" min="0" max="40" value="${S.price}" id="price">
      <p class="muted small">Guests think about ${S.fair} 🪙 is fair right now. At this price you draw ${Math.round(Sim.priceMult(S) * 100)}% of the crowd you could. Paths hold ${S.capacity} visitors.</p>
      <h3>Land</h3><p class="small">${S.land.length} plots. The next costs ${Sim.landPrice(S)} 🪙.</p><button class="btn ghost small" data-mode="land">🗺️ Buy land</button>
      <h3>📸 Photo album</h3>${album ? `<div class="faces">${album}</div>` : '<p class="muted small">Babies born here appear in the album.</p>'}
      <h3>All time</h3><p class="muted small">${st.guests} visitors · ${fmt(st.earned)} 🪙 earned · ${st.babies} babies · ${st.bought} bought · ${st.sold} rehomed · ${st.cleaned} poops tidied</p>
      <h3>Settings</h3><div class="wrap">
      <button class="btn ghost small" data-ui="rename-zoo">✏️ Rename zoo</button>
      <button class="btn ghost small" data-ui="home">🎪 Back to the gate</button>
      <button class="btn ghost small" data-ui="sound">${prefs.sound ? '🔊 Sound on' : '🔈 Sound off'}</button>
      <button class="btn ghost small" data-ui="motion">${prefs.reduceMotion ? '🐢 Reduced motion' : '🐇 Full motion'}</button>
      <button class="btn ghost small" data-ui="buildpause">${prefs.pauseWhileBuilding ? '⏸ Pause while building' : '▶ Keep time while building'}</button>
      <button class="btn ghost small" data-ui="newzoo">🗑️ Start a new zoo</button></div>`;
  },
};

// The enclosure's own catalogue, by category, plus what's already placed.
function habBuild(hab, st) {
  const ids = D.CATALOGUE[hab.sp];
  const byCat = {};
  for (const k of ids) (byCat[D.ITEMS[k].cat] = byCat[D.ITEMS[k].cat] || []).push(k);
  const need = Sim.priorityItem(hab);
  const groups = Object.entries(byCat)
    .map(([cat, ks]) => {
      const cards = ks
        .map((k) => {
          const it = D.ITEMS[k];
          const locked = it.level > st.tier + 1;
          const count = hab.items.filter((i) => i.k === k).length + S.builds.filter((b) => b.hab === hab.id && b.k === k).length;
          return `<button class="itm ${k === need && !st.prioMet ? 'want' : ''}" ${locked ? 'disabled' : `data-place="${k}" data-hab="${hab.id}"`} title="${esc(it.name)}">
          <span>${pic(artKey(it), it.emoji)}</span><small>${esc(it.name.replace(D.SPECIES[hab.sp].habitat + ' ', ''))}</small><i>${locked ? '🔒 ' + esc(Sim.TIER_NAMES[it.level - 1]) : it.price + ' 🪙'}</i>${count ? `<b class="count">${count}</b>` : ''}</button>`;
        })
        .join('');
      return `<h3>${esc(D.CATEGORIES[cat] || cat)}</h3><div class="items">${cards}</div>`;
    })
    .join('');
  const placed = hab.items
    .map((i) => {
      const it = D.ITEMS[i.k];
      return `<div class="placed"><span>${it.emoji} ${esc(it.name.replace(D.SPECIES[hab.sp].habitat + ' ', ''))}</span><button class="btn small ghost" data-moveitem="${i.id}" data-hab="${hab.id}">Move</button><button class="btn small ghost" data-cmd="${attr({ type: 'removeItem', hab: hab.id, item: i.id })}">Remove · +${Math.floor(it.price * D.BALANCE.refund)}</button></div>`;
    })
    .join('');
  return `<p class="muted small">Tap an item, then tap inside the fence. Dotted = what ${D.SPECIES[hab.sp].name.toLowerCase()}s need most. Gates and windows go on the fence; signs and borders just outside.</p>${groups}${placed ? `<h3>Placed</h3>${placed}` : ''}`;
}

// Breeding: explicit toggle, chosen pair, a readiness checklist, then one confirmed attempt.
function habFamily(hab, st) {
  const sp = D.SPECIES[hab.sp];
  const who = Sim.residents(S, hab);
  const adults = who.filter((a) => a.stage === 'adult');
  const r = Sim.readiness(S, hab);
  const pair = hab.breeding.pair || [];
  const picker = (sex, name) =>
    adults
      .filter((a) => a.sex === sex)
      .map(
        (a) =>
          `<label class="pick"><input type="radio" name="${name}" value="${a.id}" ${pair.includes(a.id) ? 'checked' : ''}>${sp.emoji} ${esc(a.name)} <small>${Math.round(a.wb)}%</small></label>`
      )
      .join('') || `<span class="muted small">No ${sex === 'f' ? 'females' : 'males'} here yet.</span>`;
  const events = S.events
    .filter((e) => e.hab === hab.id && !e.done)
    .map((e) => {
      const left = Math.max(0, Math.ceil((e.due - S.t) / D.BALANCE.dayLength));
      return `<div class="okchip">${e.egg ? '🥚 An egg is being kept warm' : '💕 A baby is on the way'}: about ${left} day${left === 1 ? '' : 's'} to go.</div>`;
    })
    .join('');
  const young = who.filter((a) => a.stage !== 'adult');
  return (
    events +
    `<div class="row"><span>💕 Breeding</span><button class="btn small ${r.on ? '' : 'ghost'}" data-cmd="${attr({ type: 'breeding', hab: hab.id, on: !r.on })}">${r.on ? 'On' : 'Off'}</button></div>
    <p class="muted small">Off by default. One baby per attempt. Switching off never cancels a baby already on the way.</p>
    <h3>Choose a pair</h3><div class="pairpick" data-hab="${hab.id}"><div><b>♀</b>${picker('f', 'pa')}</div><div><b>♂</b>${picker('m', 'pb')}</div></div>
    <h3>Ready?</h3><ul class="checks">${r.checks.map((c) => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? '✓' : '·'} ${esc(c.text)}</li>`).join('')}</ul>
    ${confirmBtn({ cmd: { type: 'breed', hab: hab.id }, title: 'Start a family?', body: `<p>${sp.egg ? 'An egg will hatch' : 'A baby will arrive'} in about ${sp.days.pre} days, then spend ${sp.days.baby} days as a baby and ${sp.days.juvenile} as a juvenile.</p><p class="muted">One place in the enclosure is kept free for them from now on. The parents rest for ${sp.days.cooldown} days afterwards.</p>`, label: 'Start' }, sp.egg ? '🥚 Start a family' : '💕 Start a family', 'wide', !r.ok)}
    ${!r.on ? why('Switch breeding on to start.') : ''}
    ${young.length ? `<h3>Little ones</h3><div class="faces">${young.map((a) => face(a, `<em>${stageName[a.stage]}</em>`)).join('')}</div>` : ''}`
  );
}

function animalFamily(a) {
  const find = (id) => Sim.animalById(S, id) || S.departed.find((d) => d.id === id);
  const link = (x) =>
    Sim.animalById(S, x.id)
      ? face(x)
      : `<span class="face gone">${pic('animal-' + x.sp, D.SPECIES[x.sp].emoji)}<small>${esc(x.name)}</small><em>rehomed</em></span>`;
  const parents = a.parents.map(find).filter(Boolean);
  const kids = [...S.animals, ...S.departed].filter((x) => (x.parents || []).includes(a.id));
  const sibs = S.animals.filter((x) => x.id !== a.id && a.parents.length && (x.parents || []).some((p) => a.parents.includes(p)));
  return (
    `<h3>Parents</h3><div class="faces">${parents.map(link).join('') || `<p class="muted small">${a.parents.length ? 'Unknown' : 'Came from the market: a founder of their own family line.'}</p>`}</div>` +
    `<h3>Little ones</h3><div class="faces">${kids.map(link).join('') || '<p class="muted small">None yet.</p>'}</div>` +
    (sibs.length ? `<h3>Brothers and sisters</h3><div class="faces">${sibs.map(link).join('')}</div>` : '')
  );
}
