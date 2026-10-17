// CUTISE ZOO — drawing the zoo: a 2:1 isometric map with a camera you can pan and zoom.
// The rules decide where each animal is heading (its activity anchor); this file walks it there
// smoothly, draws everything back to front, and only draws what's on screen (the map can be
// 192×192 tiles). Pictures from ZOO_ART_READY are drawn when loaded; otherwise emoji stand-ins.
const GUEST_FACES = ['🧒', '👧', '👦', '🧑', '👩', '👨', '👵', '👴', '👩‍🦰', '🧑‍🦱'];
// Park buildings stand on one tile but read better a little larger than it (a tea room bigger than a bench).
const BUILD_SCALE = { cafe: 1.9, gifts: 1.8, snacks: 1.7, toilet: 1.6, icecream: 1.5, tree: 1.5, fountain: 1.6, statue: 1.5, lamp: 1.2 };
const ACTION_ICONS = {
  rest: '💤',
  shade_rest: '💤',
  curl_sleep: '💤',
  hang_sleep: '💤',
  den_sleep: '💤',
  baby_rest: '💤',
  feed: '🥕',
  drink: '💧',
  retreat: '🌿',
};

const render = {
  canvas: null,
  ctx: null,
  w: 0,
  h: 0,
  cam: { x: 32, y: 52, tw: 40 }, // world point at the centre of the screen, and tile width in px
  images: {},
  critters: new Map(), // animal id → {wx, wy, flip, helloNow}
  walkers: [],
  fx: [],
  hits: [],
  last: 0,

  init() {
    this.canvas = $('#zoo');
    this.ctx = this.canvas.getContext('2d');
    addEventListener('resize', () => this.resize());
    this.resize();
    this.home();
  },
  // Back to the gate, at a comfortable zoom for the screen.
  home() {
    this.cam.x = D.BALANCE.gate.x - 6;
    this.cam.y = D.BALANCE.gate.y - 10;
    this.cam.tw = this.h > this.w ? 44 : 40;
  },
  resize() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = box.width;
    this.h = box.height;
    this.canvas.width = Math.floor(box.width * dpr);
    this.canvas.height = Math.floor(box.height * dpr);
    this.canvas.style.width = box.width + 'px';
    this.canvas.style.height = box.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
  get TW() {
    return this.cam.tw;
  },
  toScreen(fx, fy) {
    const dx = fx - this.cam.x,
      dy = fy - this.cam.y;
    return [this.w / 2 + ((dx - dy) * this.cam.tw) / 2, this.h / 2 + ((dx + dy) * this.cam.tw) / 4];
  },
  toWorld(X, Y) {
    const a = (X - this.w / 2) / (this.cam.tw / 2),
      b = (Y - this.h / 2) / (this.cam.tw / 4);
    return [this.cam.x + (a + b) / 2, this.cam.y + (b - a) / 2];
  },
  tileFromScreen(X, Y) {
    const [fx, fy] = this.toWorld(X, Y);
    const x = Math.floor(fx),
      y = Math.floor(fy);
    return x >= 0 && y >= 0 && x < Sim.SIZE && y < Sim.SIZE ? { x, y } : null;
  },
  pan(dx, dy) {
    const a = -dx / (this.cam.tw / 2),
      b = -dy / (this.cam.tw / 4);
    this.cam.x = Math.max(0, Math.min(Sim.SIZE, this.cam.x + (a + b) / 2));
    this.cam.y = Math.max(0, Math.min(Sim.SIZE, this.cam.y + (b - a) / 2));
  },
  zoomAt(factor, X = this.w / 2, Y = this.h / 2) {
    const [fx, fy] = this.toWorld(X, Y);
    this.cam.tw = Math.max(14, Math.min(120, this.cam.tw * factor));
    const [nx, ny] = this.toScreen(fx, fy);
    this.pan(X - nx, Y - ny);
  },
  // Tiles on screen (plus a margin), so we only draw those.
  view() {
    const pts = [
      [0, 0],
      [this.w, 0],
      [0, this.h],
      [this.w, this.h],
    ].map(([X, Y]) => this.toWorld(X, Y));
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    return {
      x0: Math.max(0, Math.floor(Math.min(...xs)) - 2),
      y0: Math.max(0, Math.floor(Math.min(...ys)) - 2),
      x1: Math.min(Sim.SIZE, Math.ceil(Math.max(...xs)) + 3),
      y1: Math.min(Sim.SIZE, Math.ceil(Math.max(...ys)) + 3),
    };
  },
  visible(x, y, w = 1, h = 1, v = this.v) {
    return x + w >= v.x0 && y + h >= v.y0 && x <= v.x1 && y <= v.y1;
  },

  // ---------- helpers ----------
  diamond(x, y, w, h, fill, stroke, lw = 1) {
    const c = this.ctx;
    c.beginPath();
    for (const [fx, fy] of [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ])
      c.lineTo(...this.toScreen(fx, fy));
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  },
  sprite(key, emoji, X, Y, size, flip) {
    const c = this.ctx,
      img = this.image(key);
    c.save();
    c.translate(X, Y);
    if (flip) c.scale(-1, 1);
    if (img && img.complete && img.naturalWidth) {
      const h = (size * img.naturalHeight) / img.naturalWidth;
      c.drawImage(img, -size / 2, -h, size, h);
    } else if (emoji) {
      c.font = `${Math.floor(size * 0.8)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'bottom';
      c.fillStyle = '#000'; // colour emoji take the fill's alpha, so never draw them see-through
      c.fillText(emoji, 0, size * 0.08);
    }
    c.restore();
  },
  // Pictures load the first time they're needed, so a player only downloads what they see.
  image(key) {
    if (!key || !ZOO_ART_READY[key]) return null;
    let img = this.images[key];
    if (!img) {
      img = this.images[key] = new Image();
      img.src = ZOO_ART_READY[key];
    }
    return img;
  },
  // Draws something that stands on a w×h footprint: a picture is scaled to the footprint's width
  // and stands on its front corner; an emoji stand-in keeps its old, smaller size.
  footSprite(key, emoji, x, y, w, h, scale = 1) {
    const TW = this.TW;
    const X = this.toScreen(x + w / 2, y + h / 2)[0];
    const img = this.image(key);
    if (img && img.complete && img.naturalWidth) {
      const size = ((w + h) / 2) * TW * 0.98 * scale;
      const Y = this.toScreen(x + w, y + h)[1] - TW * 0.04;
      this.sprite(key, emoji, X, Y, size);
      return { X, Y: Y - (size * img.naturalHeight) / img.naturalWidth / 2, r: size * 0.4 };
    }
    const [, Yc] = this.toScreen(x + w / 2, y + h / 2);
    const size = TW * Math.min(2.4, 0.55 + Math.sqrt(w * h) * 0.35) * Math.min(1, scale + 0.2);
    this.sprite(key, emoji, X, Yc + TW * 0.15, size);
    return { X, Y: Yc - size * 0.3, r: size * 0.45 };
  },
  shadow(X, Y, r) {
    const c = this.ctx;
    c.fillStyle = 'rgba(36,70,56,.16)';
    c.beginPath();
    c.ellipse(X, Y, r, r / 2, 0, 0, Math.PI * 2);
    c.fill();
  },
  bubble(X, Y, emoji, size) {
    const c = this.ctx;
    c.fillStyle = 'rgba(251,245,232,.95)';
    c.strokeStyle = 'rgba(36,70,56,.25)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(X - size * 0.6, Y - size * 1.2, size * 1.2, size * 1.05, size * 0.4);
    c.fill();
    c.stroke();
    this.sprite('', emoji, X, Y - size * 0.15, size * 0.95);
  },
  label(X, Y, text, bg = 'rgba(251,245,232,.95)', fg = '#244638') {
    const c = this.ctx;
    c.font = '800 13px Nunito,system-ui,sans-serif';
    const w = c.measureText(text).width + 16;
    c.fillStyle = bg;
    c.beginPath();
    c.roundRect(X - w / 2, Y - 13, w, 24, 12);
    c.fill();
    c.fillStyle = fg;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, X, Y);
  },

  // ---------- one frame ----------
  frame(now) {
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    const c = this.ctx;
    if (ui.follow) {
      const cr = this.critters.get(ui.follow);
      if (cr && Sim.animalById(S, ui.follow)) {
        this.cam.x += (cr.wx - this.cam.x) * 0.08;
        this.cam.y += (cr.wy - this.cam.y) * 0.08;
      } else ui.follow = null;
    }
    this.v = this.view();
    c.fillStyle = '#d9cfb2';
    c.fillRect(0, 0, this.w, this.h);
    this.hits = [];
    const { reached } = Sim.map(S);
    const things = [];
    this.ground(reached);
    for (const hab of S.habs) if (this.visible(hab.x - 1, hab.y - 1, hab.w + 2, hab.h + 2)) this.enclosure(hab, things, now, dt);
    for (const a of S.animals)
      if (
        !Sim.habById(S, a.hab) ||
        !this.visible(Sim.habById(S, a.hab).x, Sim.habById(S, a.hab).y, Sim.habById(S, a.hab).w, Sim.habById(S, a.hab).h)
      )
        this.walk(a, dt); // keep off-screen animals moving too
    for (const b of S.builds) if (this.visible(b.x, b.y)) this.build(b, things, now);
    const g = D.BALANCE.gate;
    things.push([g.x + g.y + 1.9, () => this.sprite('gate', '🎪', ...this.toScreen(g.x + 0.95, g.y + 0.95), this.TW * 0.95)]);
    this.people(now, reached, things);
    things.sort((a, b) => a[0] - b[0]);
    for (const [, draw] of things) draw();
    this.preview();
    const k = (S.t % D.BALANCE.dayLength) / D.BALANCE.dayLength;
    if (k > 0.85) {
      c.fillStyle = `rgba(232,140,80,${(k - 0.85) * 0.6})`;
      c.fillRect(0, 0, this.w, this.h);
    }
    this.drawFx(now);
  },

  // Land (owned, for sale, beyond), the grid when zoomed in, and paths.
  ground(reached) {
    const B = D.BALANCE,
      v = this.v;
    const forSale = ui.mode === 'land' ? Sim.landForSale(S) : [];
    for (let cy = 0; cy < B.maxChunks; cy++)
      for (let cx = 0; cx < B.maxChunks; cx++) {
        const x = cx * B.chunk,
          y = cy * B.chunk;
        if (!this.visible(x, y, B.chunk, B.chunk)) continue;
        const own = S.land.includes(cx + ',' + cy);
        const sale = forSale.find((f) => f.cx === cx && f.cy === cy);
        this.diamond(x, y, B.chunk, B.chunk, own ? '#b6c79b' : sale ? '#cdd3b5' : '#c9c2a5', own ? null : 'rgba(36,70,56,.12)', 1);
        if (sale) {
          const hov = ui.hover && Math.floor(ui.hover.x / B.chunk) === cx && Math.floor(ui.hover.y / B.chunk) === cy;
          this.diamond(x + 0.5, y + 0.5, B.chunk - 1, B.chunk - 1, hov ? 'rgba(127,174,106,.35)' : null, '#4f7f5a', 2);
          this.label(...this.toScreen(x + B.chunk / 2, y + B.chunk / 2), `＋ Buy for ${sale.price} 🪙`);
        }
      }
    if (this.TW >= 26) {
      const c = this.ctx;
      c.strokeStyle = 'rgba(36,70,56,.06)';
      c.lineWidth = 1;
      c.beginPath();
      for (let x = v.x0; x <= v.x1; x++) {
        c.moveTo(...this.toScreen(x, v.y0));
        c.lineTo(...this.toScreen(x, v.y1));
      }
      for (let y = v.y0; y <= v.y1; y++) {
        c.moveTo(...this.toScreen(v.x0, y));
        c.lineTo(...this.toScreen(v.x1, y));
      }
      c.stroke();
    }
    for (const p of S.paths) {
      const x = p % Sim.SIZE,
        y = Math.floor(p / Sim.SIZE);
      if (!this.visible(x, y)) continue;
      this.diamond(x, y, 1, 1, '#ead6b3');
      this.diamond(x + 0.1, y + 0.1, 0.8, 0.8, reached.has(p) ? '#f3e4c6' : '#e0d2bb');
    }
    const g = B.gate;
    this.diamond(g.x, g.y, 1, 1, '#E8B58A', '#c98f61', 2);
  },

  enclosure(hab, things, now, dt) {
    const sp = D.SPECIES[hab.sp],
      zone = D.ZONES[sp.zone],
      TW = this.TW;
    const st = Sim.habStats(S, hab);
    this.diamond(hab.x, hab.y, hab.w, hab.h, zone.edge);
    this.diamond(hab.x + 0.1, hab.y + 0.1, hab.w - 0.2, hab.h - 0.2, zone.color);
    if (zone.pond) this.diamond(hab.x + hab.w * 0.35, hab.y + hab.h * 0.35, hab.w * 0.3, hab.h * 0.3, 'rgba(120,175,190,.55)');
    // item footprints on the ground, then the item standing on it
    for (const it of hab.items) {
      const def = D.ITEMS[it.k];
      const [w, h] = Sim.footprint(def, it.r);
      this.diamond(it.x + 0.05, it.y + 0.05, w - 0.1, h - 0.1, def.solid ? 'rgba(138,90,59,.18)' : 'rgba(255,255,255,.18)');
      things.push([
        it.x + w + it.y + h - 1,
        () => {
          const at = this.footSprite(artKey(def), def.emoji, it.x, it.y, w, h, def.template === 'terrain' ? 1 : 0.92);
          this.hits.push({ kind: 'item', hab: hab.id, id: it.id, x: at.X, y: at.Y, r: at.r });
        },
      ]);
    }
    // fence: back edges flat, front edges stand among the animals
    const rail = (ax, ay, bx, by, depth) =>
      things.push([
        depth,
        () => {
          const c = this.ctx,
            post = TW * 0.16;
          const [x1, y1] = this.toScreen(ax, ay),
            [x2, y2] = this.toScreen(bx, by);
          const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)));
          c.strokeStyle = '#8a5a3b';
          c.lineWidth = Math.max(1.5, TW * 0.04);
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(x1, y1 - post);
          c.lineTo(x2, y2 - post);
          c.moveTo(x1, y1 - post * 0.45);
          c.lineTo(x2, y2 - post * 0.45);
          for (let i = 0; i <= n; i++) {
            const px = x1 + ((x2 - x1) * i) / n,
              py = y1 + ((y2 - y1) * i) / n;
            c.moveTo(px, py);
            c.lineTo(px, py - post * 1.2);
          }
          c.stroke();
        },
      ]);
    rail(hab.x, hab.y, hab.x + hab.w, hab.y, hab.x + hab.y);
    rail(hab.x, hab.y, hab.x, hab.y + hab.h, hab.x + hab.y);
    rail(hab.x + hab.w, hab.y, hab.x + hab.w, hab.y + hab.h, hab.x + hab.w + hab.y + hab.h + 0.01);
    rail(hab.x, hab.y + hab.h, hab.x + hab.w, hab.y + hab.h, hab.x + hab.w + hab.y + hab.h + 0.01);
    for (const p of hab.poop)
      things.push([
        p.x + p.y,
        () => {
          const [X, Y] = this.toScreen(p.x, p.y);
          this.sprite('poop', '💩', X, Y + TW * 0.05, TW * 0.32);
          this.hits.push({ kind: 'poop', hab: hab.id, id: p.id, x: X, y: Y - TW * 0.08, r: Math.max(12, TW * 0.24) });
        },
      ]);
    for (const a of Sim.residents(S, hab)) this.animal(a, hab, things, now, dt);
    // a sign over the gate side saying what's wrong, until it's a safe home
    const selected = ui.panel && ui.panel.kind === 'habitat' && ui.panel.id === hab.id;
    if (selected || st.tier === 0)
      things.push([
        hab.x + hab.w + hab.y + hab.h + 0.02,
        () => {
          const [X, Y] = this.toScreen(hab.x + hab.w / 2, hab.y + hab.h / 2);
          if (selected) this.diamond(hab.x, hab.y, hab.w, hab.h, null, '#E8B58A', 3);
          if (st.tier === 0 && this.TW >= 18)
            this.label(
              X,
              Y - TW,
              !st.access ? '🚪 Needs a keeper gate by a path' : '🛖 Needs shelter, food and water',
              'rgba(251,227,211,.95)',
              '#c8643c'
            );
        },
      ]);
    this.hits.push({ kind: 'habitat', id: hab.id, rect: hab });
  },

  // Walks an animal's drawn position towards where the rules say it is.
  walk(a, dt) {
    let cr = this.critters.get(a.id);
    if (!cr) {
      cr = { wx: a.x, wy: a.y, flip: false, helloNow: 0 };
      this.critters.set(a.id, cr);
    }
    const dx = a.x - cr.wx,
      dy = a.y - cr.wy,
      dist = Math.hypot(dx, dy);
    const speed = (a.stage === 'adult' ? 1.4 : 1.8) * ui.speed * (ui.paused ? 0 : 1);
    cr.moving = dist > 0.03;
    if (dist > 6) {
      cr.wx = a.x;
      cr.wy = a.y; // moved to another enclosure: appear there
    } else if (cr.moving) {
      const step = Math.min(dist, speed * dt);
      cr.wx += (dx / dist) * step;
      cr.wy += (dy / dist) * step;
      if (Math.abs(dx - dy) > 0.01) cr.flip = dx - dy > 0;
    }
    return cr;
  },
  animal(a, hab, things, now, dt) {
    const TW = this.TW,
      sp = D.SPECIES[a.sp];
    const cr = this.walk(a, dt);
    // On a platform, in a pool or under a canopy: draw on top of that item, not behind it.
    const on = a.act && a.act.item && !cr.moving && hab.items.find((i) => i.id === a.act.item && !D.ITEMS[i.k].solid);
    const onDepth = on ? on.x + Sim.footprint(D.ITEMS[on.k], on.r)[0] + on.y + Sim.footprint(D.ITEMS[on.k], on.r)[1] - 0.99 : 0;
    things.push([
      on ? Math.max(cr.wx + cr.wy, onDepth) : cr.wx + cr.wy,
      () => {
        const big = Math.min(2.2, 0.75 + Math.sqrt(sp.tilesPerSlot) * 0.09);
        const size = TW * big * (a.stage === 'baby' ? 0.5 : a.stage === 'juvenile' ? 0.75 : 1);
        const calm = prefs.reduceMotion;
        const hop = calm ? 0 : cr.moving ? Math.abs(Math.sin(now / 130 + a.id)) * TW * 0.06 : 0;
        const [X, Y] = this.toScreen(cr.wx, cr.wy);
        this.shadow(X, Y, size * 0.3);
        const since = now - cr.helloNow;
        const squish = !calm && since < 600 ? 1 + Math.sin(since / 60) * 0.08 : 1;
        const art = a.stage !== 'adult' && ZOO_ART_READY[`animal-${a.sp}-baby`] ? `animal-${a.sp}-baby` : `animal-${a.sp}`;
        const c = this.ctx;
        c.save();
        c.translate(X, Y - hop);
        c.scale(squish, 2 - squish);
        this.sprite(art, sp.emoji, 0, 0, size, cr.flip);
        c.restore();
        const selected = ui.panel && ui.panel.kind === 'animal' && ui.panel.id === a.id;
        if (selected) {
          c.strokeStyle = '#E8B58A';
          c.lineWidth = 3;
          c.beginPath();
          c.ellipse(X, Y, size * 0.45, size * 0.22, 0, 0, Math.PI * 2);
          c.stroke();
        }
        if (TW >= 22 || selected) {
          const p = Sim.problem(S, a);
          const act =
            a.act && !cr.moving
              ? ACTION_ICONS[a.act.type] || (a.act.item && D.ITEMS[(hab.items.find((i) => i.id === a.act.item) || {}).k] ? '✨' : null)
              : null;
          const icon = p ? (p.soft ? '💭' : '❗') : a.stage === 'baby' && Math.sin(now / 900 + a.id) > 0.7 ? '💗' : act;
          if (icon) this.bubble(X + size * 0.3, Y - size * 0.9, icon, Math.max(14, TW * 0.24));
        }
        this.hits.push({ kind: 'animal', id: a.id, x: X, y: Y - size * 0.4, r: Math.max(size * 0.5, 16) });
      },
    ]);
  },

  build(b, things, now) {
    const item = D.ITEMS[b.k];
    const def = D.BUILDS[b.k];
    const [w, h] = item ? Sim.footprint(item, b.r || 0) : [1, 1];
    if (item) this.diamond(b.x + 0.05, b.y + 0.05, w - 0.1, h - 0.1, 'rgba(255,255,255,.2)');
    things.push([
      b.x + w + b.y + h - 1,
      () => {
        const [X, Y] = this.toScreen(b.x + w / 2, b.y + h / 2);
        const emoji = item ? item.emoji : def.emoji;
        const scale = item ? 0.92 : BUILD_SCALE[b.k] || 1;
        if (!this.image(item ? artKey(item) : 'build-' + b.k)) this.shadow(X, Y, this.TW * 0.22);
        this.footSprite(item ? artKey(item) : 'build-' + b.k, emoji, b.x, b.y, w, h, scale);
        if (def && def.kind === 'shop' && !Sim.besidePath(S, b.x, b.y, 1, 1)) this.bubble(X, Y - this.TW * 0.5, '🚧', this.TW * 0.28);
        this.hits.push({ kind: 'build', id: b.id, x: X, y: Y - this.TW * 0.25, r: this.TW * 0.35 });
      },
    ]);
  },

  people(now, reached, things) {
    const W = Sim.SIZE;
    const tiles = reached.size;
    const want = Math.min(Math.round(S.guests), 60, (tiles - 1) * 4);
    const staffWant = S.staff.keeper + S.staff.guide;
    const g = D.BALANCE.gate;
    const add = (face, staff) =>
      this.walkers.push({
        x: g.x,
        y: g.y,
        fx: g.x,
        fy: g.y,
        tx: g.x,
        ty: g.y,
        face,
        staff,
        off: Math.random() * 0.5 - 0.25,
        speed: 0.008 + Math.random() * 0.006,
        p: Math.random(),
      });
    const guests = this.walkers.filter((w) => !w.staff);
    if (guests.length < want) add(GUEST_FACES[Math.floor(Math.random() * GUEST_FACES.length)], false);
    if (guests.length > want) this.walkers.splice(this.walkers.indexOf(guests[guests.length - 1]), 1);
    const staff = this.walkers.filter((w) => w.staff);
    if (staff.length < staffWant) add(staff.length < S.staff.keeper ? D.STAFF.keeper.emoji : D.STAFF.guide.emoji, true);
    if (staff.length > staffWant) this.walkers.splice(this.walkers.indexOf(staff[staff.length - 1]), 1);
    for (const w of this.walkers) {
      if (w.p >= 1 || !reached.has(w.ty * W + w.tx)) {
        w.fx = w.tx;
        w.fy = w.ty;
        if (!reached.has(w.fy * W + w.fx)) [w.fx, w.fy] = [g.x, g.y];
        const options = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
          .map(([dx, dy]) => [w.fx + dx, w.fy + dy])
          .filter(([x, y]) => x >= 0 && y >= 0 && reached.has(y * W + x));
        const ahead = options.filter(([x, y]) => x !== w.x || y !== w.y);
        const from = ahead.length ? ahead : options;
        const [nx, ny] = from.length ? from[Math.floor(Math.random() * from.length)] : [w.fx, w.fy];
        w.x = w.fx;
        w.y = w.fy;
        w.tx = nx;
        w.ty = ny;
        w.p = 0;
      }
      w.p += w.speed * ui.speed * (ui.paused ? 0 : 1);
      const k = Math.min(1, w.p);
      const wx = w.fx + (w.tx - w.fx) * k + 0.5 + w.off,
        wy = w.fy + (w.ty - w.fy) * k + 0.5 - w.off;
      if (!this.visible(wx, wy)) continue;
      things.push([
        wx + wy,
        () => {
          const [X, Y] = this.toScreen(wx, wy);
          const bob = prefs.reduceMotion ? 0 : Math.abs(Math.sin(now / 160 + w.off * 10)) * this.TW * 0.03;
          this.shadow(X, Y, this.TW * 0.07);
          this.sprite('', w.face, X, Y - bob, this.TW * 0.34);
        },
      ]);
    }
  },

  // Ghost previews for every building mode: green if it works, red with the reason in the tip bar.
  preview() {
    const h = ui.hover;
    if (ui.mode === 'enclose' || ui.mode === 'resize') {
      const r = ui.drag ? dragRect() : ui.rect;
      if (ui.mode === 'resize') {
        const hab = Sim.habById(S, ui.hab);
        if (hab) this.diamond(hab.x, hab.y, hab.w, hab.h, null, 'rgba(36,70,56,.5)', 2);
      }
      if (!r) {
        if (h && ui.mode === 'enclose') this.diamond(h.x, h.y, 1, 1, 'rgba(127,174,106,.4)', '#4f7f5a', 2);
        return;
      }
      const out = {};
      const hab = ui.mode === 'resize' ? Sim.habById(S, ui.hab) : null;
      const why = hab ? Sim.resizeProblem(S, hab, r.x, r.y, r.w, r.h, out) : Sim.rectProblem(S, r.x, r.y, r.w, r.h, null, out);
      this.diamond(r.x, r.y, r.w, r.h, why ? 'rgba(224,122,95,.3)' : 'rgba(127,174,106,.35)', why ? '#e07a5f' : '#4f7f5a', 2);
      const sp = D.SPECIES[ui.species || (hab && hab.sp)];
      const slots = Math.floor((r.w * r.h) / sp.tilesPerSlot);
      this.label(...this.toScreen(r.x + r.w / 2, r.y + r.h / 2), `${r.w}×${r.h} · room for ${slots} · ${why ? '✗' : out.cost + ' 🪙'}`);
      setTip(why, r, out);
      return;
    }
    if (!h || !ui.mode) return;
    if (ui.mode === 'bulldoze') return this.diamond(h.x, h.y, 1, 1, 'rgba(224,122,95,.35)', '#e07a5f', 2);
    if (ui.mode === 'build') {
      const def = D.BUILDS[ui.buildKey];
      const why = Sim.buildProblem(S, ui.buildKey, h.x, h.y);
      this.diamond(h.x, h.y, 1, 1, why ? 'rgba(224,122,95,.35)' : 'rgba(127,174,106,.45)', why ? '#e07a5f' : '#4f7f5a', 2);
      this.ctx.globalAlpha = 0.75;
      if (ui.buildKey !== 'path') this.footSprite('build-' + ui.buildKey, def.emoji, h.x, h.y, 1, 1, BUILD_SCALE[ui.buildKey] || 1);
      this.ctx.globalAlpha = 1;
      return setTip(why);
    }
    if (ui.mode === 'place') {
      const hab = Sim.habById(S, ui.hab);
      const def = D.ITEMS[ui.item];
      if (!hab || !def) return;
      const [w, hh] = Sim.footprint(def, ui.rot);
      const x = h.x - Math.floor((w - 1) / 2),
        y = h.y - Math.floor((hh - 1) / 2);
      const why = Sim.placeProblem(S, hab, ui.item, x, y, ui.rot);
      this.diamond(hab.x, hab.y, hab.w, hab.h, null, 'rgba(36,70,56,.45)', 2);
      this.diamond(x, y, w, hh, why ? 'rgba(224,122,95,.35)' : 'rgba(127,174,106,.45)', why ? '#e07a5f' : '#4f7f5a', 2);
      this.ctx.globalAlpha = 0.8;
      this.footSprite(artKey(def), def.emoji, x, y, w, hh, 0.92);
      this.ctx.globalAlpha = 1;
      return setTip(why);
    }
  },

  pop(X, Y, text, color = '#fff') {
    this.fx.push({ x: X, y: Y, text, color, t0: performance.now() });
  },
  drawFx(now) {
    const c = this.ctx;
    this.fx = this.fx.filter((f) => now - f.t0 < 1200);
    for (const f of this.fx) {
      const k = (now - f.t0) / 1200;
      c.globalAlpha = 1 - k * k;
      c.font = `900 ${Math.floor(Math.max(14, this.TW * 0.3))}px Nunito,system-ui,sans-serif`;
      c.textAlign = 'center';
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(36,70,56,.7)';
      c.strokeText(f.text, f.x, f.y - k * 40);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y - k * 40);
    }
    c.globalAlpha = 1;
  },
};
// The rectangle being dragged out, in tiles (either corner first).
function dragRect() {
  const d = ui.drag;
  if (!d) return null;
  const x = Math.min(d.x0, d.x1),
    y = Math.min(d.y0, d.y1);
  return { x, y, w: Math.abs(d.x1 - d.x0) + 1, h: Math.abs(d.y1 - d.y0) + 1 };
}
// Art key for a catalogue item: shared templates share a picture (item-shelter), signature items
// have their own (item-capybara__signature-1). See docs/ART-BRIEF.md.
const artKey = (def) => (def.template ? 'item-' + def.template : 'item-' + def.id);
