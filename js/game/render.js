// CUTISE ZOO — drawing the zoo: an isometric map (2:1 diamonds) with a camera you can pan and zoom.
// Animals, guests and keepers wander about here, on the screen only: the rules know which habitat
// an animal lives in and how many guests there are, not where anyone is standing.
// Pictures from ZOO_ART_READY are drawn when loaded; otherwise each thing's emoji stand-in.
// Sprites stand on their spot: they're anchored bottom-centre (see docs/ART-BRIEF.md).
const GUEST_FACES = ['🧒', '👧', '👦', '🧑', '👩', '👨', '👵', '👴', '👩‍🦰', '🧑‍🦱'];
const SCENERY = {
  wetland: ['🪷', '🌿'],
  woodland: ['🍃', '🌿'],
  meadow: ['🌼', '🌸'],
  ice: ['🧊', '❄️'],
  jungle: ['🌺', '🍃'],
  savanna: ['🌾', '🪨'],
};
// Where enrichment items stand inside a 3×3 habitat (tile units from its back corner).
const ITEM_SLOTS = [
  [0.7, 0.7],
  [2.3, 0.8],
  [0.8, 2.3],
  [2.3, 2.2],
  [1.5, 0.55],
];

const render = {
  canvas: null,
  ctx: null,
  w: 0,
  h: 0,
  base: 40, // tile width that fits the whole map at zoom 1
  cam: { zoom: 1, px: 0, py: 0 }, // zoom and pan (CSS pixels)
  images: {},
  critters: new Map(), // animal id → where it is and where it's going
  walkers: [], // guests and keepers
  fx: [], // floating "+1 🪙" and friends
  hits: [], // what's tappable this frame: {kind, id, x, y, r}

  init() {
    this.canvas = $('#zoo');
    this.ctx = this.canvas.getContext('2d');
    for (const [key, url] of Object.entries(ZOO_ART_READY)) {
      const img = new Image();
      img.src = url;
      this.images[key] = img;
    }
    addEventListener('resize', () => this.resize());
    this.resize();
    // Phones start zoomed in on the gate, where the first 15 minutes happen.
    if (this.h > this.w) {
      this.cam.zoom = 2.2;
      const g = D.BALANCE.gate;
      const [x, y] = this.toScreen(g.x - 1, g.y - 3);
      this.cam.px += this.w / 2 - x;
      this.cam.py += this.h / 2 - y;
    }
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
    const n = D.BALANCE.mapW + D.BALANCE.mapH;
    this.base = Math.max(24, Math.min((box.width * 2) / n, ((box.height - 30) * 4) / n));
  },
  get TW() {
    return this.base * this.cam.zoom;
  },
  // world (tile units, fractional) → screen
  toScreen(fx, fy) {
    const TW = this.TW,
      TH = TW / 2,
      W = D.BALANCE.mapW,
      H = D.BALANCE.mapH;
    const ox = this.w / 2 - ((W - H) * TW) / 4 + this.cam.px;
    const oy = (this.h - ((W + H) * TH) / 2) / 2 + this.cam.py;
    return [ox + ((fx - fy) * TW) / 2, oy + ((fx + fy) * TH) / 2];
  },
  toWorld(X, Y) {
    const [ox, oy] = this.toScreen(0, 0);
    const a = (X - ox) / (this.TW / 2),
      b = (Y - oy) / (this.TW / 4);
    return [(a + b) / 2, (b - a) / 2];
  },
  tileFromScreen(X, Y) {
    const [fx, fy] = this.toWorld(X, Y);
    const x = Math.floor(fx),
      y = Math.floor(fy);
    return Sim.tileAt(S, x, y) === null ? null : { x, y };
  },
  zoomAt(factor, X = this.w / 2, Y = this.h / 2) {
    const [fx, fy] = this.toWorld(X, Y);
    this.cam.zoom = Math.max(0.8, Math.min(3, this.cam.zoom * factor));
    const [nx, ny] = this.toScreen(fx, fy);
    this.cam.px += X - nx;
    this.cam.py += Y - ny;
  },
  centreOn(fx, fy) {
    const [x, y] = this.toScreen(fx, fy);
    this.cam.px += (this.w / 2 - x) * 0.1;
    this.cam.py += (this.h / 2 - y) * 0.1;
  },

  // ---------- drawing helpers ----------
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
  // Draws a picture standing on (X, Y) — bottom-centre — or its emoji if the picture isn't here yet.
  sprite(key, emoji, X, Y, size, flip) {
    const c = this.ctx,
      img = this.images[key];
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
      c.fillStyle = '#000'; // colour emoji take the fill's alpha, so never draw them with a see-through one
      c.fillText(emoji, 0, size * 0.08);
    }
    c.restore();
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

  // ---------- one frame ----------
  frame(now) {
    const c = this.ctx,
      W = D.BALANCE.mapW,
      H = D.BALANCE.mapH;
    if (ui.follow) {
      const cr = this.critters.get(ui.follow);
      if (cr && Sim.animalById(S, ui.follow)) this.centreOn(cr.wx, cr.wy);
      else ui.follow = null;
    }
    c.fillStyle = '#e9dfc6';
    c.fillRect(0, 0, this.w, this.h);
    const reached = Sim.reach(S);
    const open = new Set(S.open);
    this.hits = [];
    const things = []; // standing things, drawn back to front

    // ground
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = Sim.tileAt(S, x, y);
        if (t === 'path') {
          this.diamond(x, y, 1, 1, '#ead6b3');
          if (this.images['tile-path']) this.sprite('tile-path', '', ...this.toScreen(x + 1, y + 1), this.TW);
          else this.diamond(x + 0.1, y + 0.1, 0.8, 0.8, reached.has(y * W + x) ? '#f3e4c6' : '#e0d2bb');
        } else {
          this.diamond(x, y, 1, 1, (x + y) % 2 ? '#b9cb9e' : '#b2c596');
          if (this.images['tile-grass']) this.sprite('tile-grass', '', ...this.toScreen(x + 1, y + 1), this.TW);
        }
      }
    const g = D.BALANCE.gate;
    this.diamond(g.x, g.y, 1, 1, '#E8B58A', '#c98f61', 2);
    things.push([g.x + g.y + 1.9, () => this.sprite('gate', '🎪', ...this.toScreen(g.x + 0.95, g.y + 0.95), this.TW * 0.9)]);

    for (const hab of S.habitats) this.habitat(hab, open.has(hab.id), things, now);
    for (const b of S.builds) {
      const def = D.BUILDS[b.k];
      things.push([
        b.x + b.y + 1,
        () => {
          const [X, Y] = this.toScreen(b.x + 0.5, b.y + 0.5);
          this.shadow(X, Y, this.TW * 0.22);
          const bob = def.kind === 'shop' && !prefs.reduceMotion ? Math.sin(now / 600 + b.id) * 1.2 : 0;
          this.sprite(def.art, def.emoji, X, Y + this.TW * 0.12 + bob, this.TW * (def.kind === 'shop' ? 0.8 : 0.62));
          if (def.kind === 'shop' && !Sim.isOpen(S, b.x, b.y, 1, 1, reached)) this.bubble(X, Y - this.TW * 0.5, '🚧', this.TW * 0.28);
          this.hits.push({ kind: 'build', id: b.id, x: X, y: Y - this.TW * 0.25, r: this.TW * 0.35 });
        },
      ]);
    }
    this.people(now, reached, things);
    things.sort((a, b) => a[0] - b[0]);
    for (const [, draw] of things) draw();
    this.preview();
    // a warm glow as the day draws to a close
    const k = (S.t % D.BALANCE.dayLength) / D.BALANCE.dayLength;
    if (k > 0.8) {
      c.fillStyle = `rgba(232,140,80,${(k - 0.8) * 0.6})`;
      c.fillRect(0, 0, this.w, this.h);
    }
    this.drawFx(now);
  },

  habitat(hab, isOpen, things, now) {
    const bio = D.BIOMES[hab.biome],
      TW = this.TW;
    if (this.images[bio.art]) this.sprite(bio.art, '', ...this.toScreen(hab.x + 3, hab.y + 3), TW * 3);
    else {
      this.diamond(hab.x, hab.y, 3, 3, bio.edge);
      this.diamond(hab.x + 0.08, hab.y + 0.08, 2.84, 2.84, bio.color);
      if (hab.biome === 'wetland' || hab.items.includes('pool')) this.diamond(hab.x + 1.1, hab.y + 1.2, 1.2, 1, '#86b9c9');
      for (let i = 0; i < 5; i++) {
        const r = ((hab.id * 9301 + i * 49297) % 233280) / 233280;
        const [X, Y] = this.toScreen(hab.x + 0.3 + ((r * 7) % 1) * 2.4, hab.y + 0.3 + ((r * 13) % 1) * 2.4);
        this.sprite('', SCENERY[hab.biome][i % 2], X, Y + TW * 0.06, TW * 0.22);
      }
    }
    // fence: back edges flat on the ground, front edges stand among the animals
    const rail = (ax, ay, bx, by, depth) =>
      things.push([
        depth,
        () => {
          const c = this.ctx,
            post = TW * 0.13;
          const [x1, y1] = this.toScreen(ax, ay),
            [x2, y2] = this.toScreen(bx, by);
          c.strokeStyle = '#8a5a3b';
          c.lineWidth = Math.max(1.5, TW * 0.035);
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(x1, y1 - post);
          c.lineTo(x2, y2 - post);
          c.moveTo(x1, y1 - post * 0.45);
          c.lineTo(x2, y2 - post * 0.45);
          for (let i = 0; i <= 6; i++) {
            const px = x1 + ((x2 - x1) * i) / 6,
              py = y1 + ((y2 - y1) * i) / 6;
            c.moveTo(px, py);
            c.lineTo(px, py - post * 1.2);
          }
          c.stroke();
        },
      ]);
    rail(hab.x, hab.y, hab.x + 3, hab.y, hab.x + hab.y);
    rail(hab.x, hab.y, hab.x, hab.y + 3, hab.x + hab.y);
    rail(hab.x + 3, hab.y, hab.x + 3, hab.y + 3, hab.x + hab.y + 6.01);
    rail(hab.x, hab.y + 3, hab.x + 3, hab.y + 3, hab.x + hab.y + 6.01);

    // the bowl, items, poop, residents
    const bowl = [hab.x + 2.5, hab.y + 1.5];
    things.push([
      bowl[0] + bowl[1],
      () => {
        const [X, Y] = this.toScreen(...bowl);
        this.sprite('bowl', '🥣', X, Y + TW * 0.08, TW * 0.3);
        const c = this.ctx;
        c.fillStyle = '#fff';
        c.fillRect(X - TW * 0.15, Y + TW * 0.1, TW * 0.3, 4);
        c.fillStyle = hab.food < 30 ? '#e07a5f' : '#7fae6a';
        c.fillRect(X - TW * 0.15, Y + TW * 0.1, (TW * 0.3 * hab.food) / 100, 4);
      },
    ]);
    hab.items.forEach((it, i) => {
      const [dx, dy] = ITEM_SLOTS[i % ITEM_SLOTS.length];
      const def = D.ITEMS[it];
      things.push([
        hab.x + dx + hab.y + dy,
        () =>
          this.sprite(def.art, def.emoji, ...this.toScreen(hab.x + dx, hab.y + dy), TW * (it === 'shade' || it === 'climb' ? 0.75 : 0.55)),
      ]);
    });
    for (const p of hab.poop) {
      const wx = hab.x + 0.4 + p.x * 2.2,
        wy = hab.y + 0.4 + p.y * 2.2;
      things.push([
        wx + wy,
        () => {
          const [X, Y] = this.toScreen(wx, wy);
          this.sprite('poop', '💩', X, Y + TW * 0.05, TW * 0.24);
          this.hits.push({ kind: 'poop', hab: hab.id, id: p.id, x: X, y: Y - TW * 0.06, r: TW * 0.2 });
        },
      ]);
    }
    for (const a of Sim.residents(S, hab)) this.animal(a, hab, things, now);
    if (!isOpen)
      things.push([
        hab.x + hab.y + 6.02,
        () => {
          const [X, Y] = this.toScreen(hab.x + 1.5, hab.y + 1.5);
          this.bubble(X, Y - TW * 0.4, '🛤️', TW * 0.4);
        },
      ]);
    this.hits.push({ kind: 'habitat', id: hab.id, wx: hab.x, wy: hab.y });
  },

  animal(a, hab, things, now) {
    const TW = this.TW,
      sp = D.SPECIES[a.sp];
    let cr = this.critters.get(a.id);
    if (!cr || cr.hab !== hab.id) {
      cr = {
        hab: hab.id,
        wx: hab.x + 1 + ((a.id * 0.37) % 1),
        wy: hab.y + 1 + ((a.id * 0.61) % 1),
        tx: 0,
        ty: 0,
        next: 0,
        flip: false,
        helloNow: 0,
      };
      cr.tx = cr.wx;
      cr.ty = cr.wy;
      this.critters.set(a.id, cr);
    }
    // wander: now and then pick somewhere new (happy animals more often), then amble over
    if (now > cr.next) {
      const hasPool = hab.items.includes('pool') && Math.random() < 0.3;
      cr.tx = hasPool ? hab.x + 1.5 + Math.random() * 0.6 : hab.x + 0.45 + Math.random() * 2.1;
      cr.ty = hasPool ? hab.y + 1.5 + Math.random() * 0.4 : hab.y + 0.45 + Math.random() * 2.1;
      cr.next = now + (a.happy > 60 ? 2000 : 4500) + Math.random() * 4000;
    }
    const dx = cr.tx - cr.wx,
      dy = cr.ty - cr.wy,
      dist = Math.hypot(dx, dy);
    const moving = dist > 0.02;
    if (moving) {
      const step = Math.min(dist, 0.012 * (a.happy > 60 ? 1.3 : 0.7));
      cr.wx += (dx / dist) * step;
      cr.wy += (dy / dist) * step;
      cr.flip = dx - dy > 0; // facing right on screen
    }
    things.push([
      cr.wx + cr.wy,
      () => {
        const size = TW * (a.baby ? 0.4 : 0.5) * Math.min(1.6, 0.85 + sp.space * 0.15);
        const calm = prefs.reduceMotion;
        const hop = calm ? 0 : moving ? Math.abs(Math.sin(now / (a.happy > 60 ? 110 : 200) + a.id)) * TW * 0.06 : 0;
        const [X, Y] = this.toScreen(cr.wx, cr.wy);
        this.shadow(X, Y, size * 0.32);
        const since = now - cr.helloNow;
        const squish = !calm && since < 600 ? 1 + Math.sin(since / 60) * 0.08 : 1;
        const art = a.baby && this.images[`animal-${a.sp}-baby`] ? `animal-${a.sp}-baby` : `animal-${a.sp}`;
        const c = this.ctx;
        c.save();
        c.translate(X, Y - hop);
        c.scale(squish, 2 - squish);
        this.sprite(art, sp.emoji, 0, 0, size, cr.flip);
        c.restore();
        if (ui.panel && ui.panel.kind === 'animal' && ui.panel.id === a.id) {
          c.strokeStyle = '#E8B58A';
          c.lineWidth = 3;
          c.beginPath();
          c.ellipse(X, Y, size * 0.45, size * 0.22, 0, 0, Math.PI * 2);
          c.stroke();
        }
        const p = Sim.problem(S, a);
        const icon = p
          ? p.fix && p.fix.cmd && p.fix.cmd.item
            ? D.ITEMS[p.fix.cmd.item].emoji
            : p.text.includes('hungry')
              ? '🍖'
              : '❗'
          : a.happy >= 85 && Math.sin(now / 900 + a.id) > 0.8
            ? '💗'
            : null;
        if (icon) this.bubble(X + size * 0.3, Y - size * 0.95, icon, TW * 0.2);
        cr.sx = X;
        cr.sy = Y - size * 0.4;
        this.hits.push({ kind: 'animal', id: a.id, x: X, y: Y - size * 0.4, r: Math.max(size * 0.5, 16) });
      },
    ]);
  },

  people(now, reached, things) {
    const W = D.BALANCE.mapW;
    const want = Math.min(Math.round(S.guests), 50, (reached.size - 1) * 4);
    const keepers = S.staff.keeper + S.staff.guide;
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
        p: 1,
      });
    const guests = this.walkers.filter((w) => !w.staff);
    for (let i = guests.length; i < want; i++) add(GUEST_FACES[Math.floor(Math.random() * GUEST_FACES.length)], false);
    if (guests.length > want) this.walkers.splice(this.walkers.indexOf(guests[guests.length - 1]), 1);
    const staff = this.walkers.filter((w) => w.staff);
    for (let i = staff.length; i < keepers; i++) add(i < S.staff.keeper ? D.STAFF.keeper.emoji : D.STAFF.guide.emoji, true);
    if (staff.length > keepers) this.walkers.splice(this.walkers.indexOf(staff[staff.length - 1]), 1);

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
          .filter(([x, y]) => x >= 0 && y >= 0 && x < W && reached.has(y * W + x));
        const ahead = options.filter(([x, y]) => x !== w.x || y !== w.y);
        const pickFrom = ahead.length ? ahead : options;
        const [nx, ny] = pickFrom.length ? pickFrom[Math.floor(Math.random() * pickFrom.length)] : [w.fx, w.fy];
        w.x = w.fx;
        w.y = w.fy;
        w.tx = nx;
        w.ty = ny;
        w.p = 0;
      }
      w.p += w.speed;
      const k = Math.min(1, w.p);
      const wx = w.fx + (w.tx - w.fx) * k + 0.5 + w.off,
        wy = w.fy + (w.ty - w.fy) * k + 0.5 - w.off;
      things.push([
        wx + wy,
        () => {
          const [X, Y] = this.toScreen(wx, wy);
          const bob = prefs.reduceMotion ? 0 : Math.abs(Math.sin(now / 160 + w.off * 10)) * this.TW * 0.03;
          this.shadow(X, Y, this.TW * 0.07);
          this.sprite('', w.face, X, Y - bob, this.TW * 0.32);
        },
      ]);
    }
  },

  // The ghost of what you're about to build: green if it fits, red (with the reason in the tip) if not.
  preview() {
    if (!ui.hover || !ui.mode) return;
    const { x, y } = ui.hover;
    if (ui.mode === 'bulldoze') {
      this.diamond(x, y, 1, 1, 'rgba(224,122,95,.35)', '#e07a5f', 2);
      return;
    }
    const def = D.BUILDS[ui.buildKey];
    const n = def.kind === 'habitat' ? 3 : 1;
    const why = Sim.buildProblem(S, ui.buildKey, x, y);
    this.diamond(x, y, n, n, why ? 'rgba(224,122,95,.35)' : 'rgba(127,174,106,.45)', why ? '#e07a5f' : '#4f7f3f', 2);
    this.ctx.globalAlpha = 0.75;
    this.sprite(def.art, def.emoji, ...this.toScreen(x + n / 2, y + n / 2), this.TW * (n === 3 ? 1 : 0.6));
    this.ctx.globalAlpha = 1;
    setTip(why);
  },

  // Floating text like "+2 🪙" that drifts up and fades.
  pop(X, Y, text, color = '#fff') {
    this.fx.push({ x: X, y: Y, text, color, t0: performance.now() });
  },
  drawFx(now) {
    const c = this.ctx;
    this.fx = this.fx.filter((f) => now - f.t0 < 1200);
    for (const f of this.fx) {
      const k = (now - f.t0) / 1200;
      c.globalAlpha = 1 - k * k;
      c.font = `900 ${Math.floor(Math.max(14, this.TW * 0.24))}px Nunito,system-ui,sans-serif`;
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
