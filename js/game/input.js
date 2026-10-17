// CUTISE ZOO — taps, drags, pinches and keys on the zoo.
// Look mode: tap the thing (an animal, an enclosure, an item, a shop) for its one panel; tap poop
// to tidy it; drag to pan; pinch or scroll to zoom.
// Building modes: build (tap, drag for paths), enclose and resize (drag out a rectangle),
// place (tap; R rotates), bulldoze (tap or drag), land (tap a plot for sale).
const input = {
  pointers: new Map(),
  start: null,
  dragged: false,
  pinch: 0,
  painted: new Set(),

  init() {
    const cv = render.canvas;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const p = this.point(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 1) {
        this.start = p;
        this.dragged = false;
        this.painted.clear();
        const t = render.tileFromScreen(p.x, p.y);
        if (this.rectMode() && t && e.button !== 2) ui.drag = { x0: t.x, y0: t.y, x1: t.x, y1: t.y };
        else if (this.paints()) this.paint(p);
      } else {
        this.pinch = this.spread();
        ui.drag = null;
      }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.point(e);
      ui.hover = render.tileFromScreen(p.x, p.y);
      const last = this.pointers.get(e.pointerId);
      if (!last) return;
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 2) {
        const d = this.spread();
        if (this.pinch) render.zoomAt(d / this.pinch);
        this.pinch = d;
        this.dragged = true;
        return;
      }
      if (ui.drag && ui.hover) {
        ui.drag.x1 = ui.hover.x;
        ui.drag.y1 = ui.hover.y;
        return;
      }
      if (this.paints()) return this.paintLine(last, p);
      if (Math.hypot(p.x - this.start.x, p.y - this.start.y) > 8) this.dragged = true;
      if (this.dragged) {
        render.pan(p.x - last.x, p.y - last.y);
        ui.follow = null;
      }
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (ui.drag && this.pointers.size === 0) return this.finishRect();
      if (this.pointers.size === 0 && p && !this.dragged && !this.paints()) this.tap(p);
      this.pinch = 0;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', (e) => {
      this.pointers.delete(e.pointerId);
      ui.drag = null;
    });
    cv.addEventListener('pointerleave', () => (ui.hover = null));
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = this.point(e);
        render.zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, p.x, p.y);
      },
      { passive: false }
    );
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape') {
        setMode(null);
        closePanel();
      }
      if (e.key === 'r' && ui.mode === 'place') rotate();
      if (e.key === 'b') openPanel('build');
      if (e.key === 'a') openPanel('market');
      if (e.key === 'x') setMode('bulldoze');
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
      if (e.key === '+' || e.key === '=') render.zoomAt(1.2);
      if (e.key === '-') render.zoomAt(1 / 1.2);
      if (e.key === ' ') {
        ui.paused = !ui.paused;
        ui.autoPaused = false;
        updateHud();
        e.preventDefault();
      }
    });
  },
  point(e) {
    const r = render.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  },
  spread() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  },
  rectMode: () => ui.mode === 'enclose' || ui.mode === 'resize',
  paints: () => ['build', 'bulldoze', 'place', 'land'].includes(ui.mode),

  // A drag in enclose or resize mode: fence it right away (enclose), or hold it for Confirm (resize).
  finishRect() {
    const r = dragRect();
    ui.drag = null;
    if (!r) return;
    if (ui.mode === 'resize') {
      ui.rect = r;
      return;
    }
    const why = Sim.rectProblem(S, r.x, r.y, r.w, r.h);
    if (why) return toast(why, 'bad');
    const res = act({ type: 'enclose', sp: ui.species, x: r.x, y: r.y, w: r.w, h: r.h });
    if (!res.ok) return;
    sfx('build');
    render.pop(...render.toScreen(r.x + r.w / 2, r.y + r.h / 2), '-' + res.cost + ' 🪙', '#ffe39a');
    setMode(null);
    ui.canUndo = true;
    openPanel('habitat', res.hab, 'build');
  },

  // A fast drag jumps several tiles between pointer events: paint every tile along the way.
  paintLine(from, to) {
    const a = render.tileFromScreen(from.x, from.y),
      b = render.tileFromScreen(to.x, to.y);
    if (!a || !b || ui.mode === 'place' || ui.mode === 'land') return this.paint(to);
    const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    for (let i = 1; i <= n; i++) {
      const tx = Math.round(a.x + ((b.x - a.x) * i) / n),
        ty = Math.round(a.y + ((b.y - a.y) * i) / n);
      const [X, Y] = render.toScreen(tx + 0.5, ty + 0.5);
      this.paint({ x: X, y: Y });
    }
  },
  paint(p) {
    const tile = render.tileFromScreen(p.x, p.y);
    if (!tile) return;
    const key = tile.x + ',' + tile.y;
    if (this.painted.has(key)) return;
    this.painted.add(key);
    if (ui.mode === 'land') {
      if (this.painted.size > 1) return;
      const cx = Math.floor(tile.x / D.BALANCE.chunk),
        cy = Math.floor(tile.y / D.BALANCE.chunk);
      if (!Sim.landForSale(S).some((f) => f.cx === cx && f.cy === cy)) return;
      return confirmLand(cx, cy);
    }
    if (ui.mode === 'bulldoze') {
      if (!Sim.tileAt(S, tile.x, tile.y)) return;
      const res = act({ type: 'bulldoze', x: tile.x, y: tile.y });
      if (res.ok) {
        sfx('pop');
        render.pop(p.x, p.y, '+' + res.coins + ' 🪙', '#ffe39a');
      }
      return;
    }
    if (ui.mode === 'place') {
      if (this.painted.size > 1) return;
      const def = D.ITEMS[ui.item];
      const [w, h] = Sim.footprint(def, ui.rot);
      const x = tile.x - Math.floor((w - 1) / 2),
        y = tile.y - Math.floor((h - 1) / 2);
      const res = act({ type: 'place', hab: ui.hab, item: ui.item, x, y, r: ui.rot });
      if (!res.ok) return;
      sfx('build');
      render.pop(p.x, p.y, '-' + def.price + ' 🪙', '#ffe39a');
      const hab = ui.hab;
      setMode(null);
      ui.canUndo = true;
      openPanel('habitat', hab, 'build');
      return;
    }
    const def = D.BUILDS[ui.buildKey];
    if (this.painted.size > 1 && !['path', 'decor'].includes(def.kind)) return;
    if (Sim.buildProblem(S, ui.buildKey, tile.x, tile.y)) {
      if (this.painted.size === 1) act({ type: 'build', k: ui.buildKey, x: tile.x, y: tile.y }); // says why
      return;
    }
    if (!act({ type: 'build', k: ui.buildKey, x: tile.x, y: tile.y }).ok) return;
    sfx('build');
    render.pop(p.x, p.y, '-' + def.cost + ' 🪙', '#ffe39a');
    ui.canUndo = true;
    if (def.kind === 'shop') setMode(null);
  },

  tap(p) {
    // Smallest targets first: poop, then animals, then items and buildings, then the ground.
    const near = (kind, slack = 1) =>
      render.hits
        .filter((h) => h.kind === kind && Math.hypot(p.x - h.x, p.y - h.y) < h.r * slack)
        .sort((a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y))[0];
    const poop = near('poop', 1.3);
    if (poop) {
      const res = act({ type: 'clean', hab: poop.hab, poop: poop.id });
      if (res.ok) {
        sfx('coin');
        render.pop(poop.x, poop.y, res.coins ? '+' + res.coins + ' 🪙' : '✨', '#ffe39a');
      }
      return;
    }
    const animal = near('animal');
    if (animal) {
      const a = Sim.animalById(S, animal.id);
      openPanel('animal', a.id);
      if (S.t - a.helloAt >= D.BALANCE.helloCooldown && act({ type: 'hello', animal: a.id }).ok) {
        const cr = render.critters.get(a.id);
        if (cr) cr.helloNow = performance.now();
        sfx('pet');
        render.pop(animal.x, animal.y - animal.r, '💗', '#ffd1dc');
      }
      return;
    }
    const item = near('item');
    if (item) return openPanel('habitat', item.hab, 'build');
    const b = near('build');
    if (b) return openPanel('thing', b.id);
    const tile = render.tileFromScreen(p.x, p.y);
    if (!tile) return closePanel();
    const t = Sim.tileAt(S, tile.x, tile.y);
    if (t && t.startsWith('h:')) openPanel('habitat', +t.slice(2));
    else if (t && t.startsWith('b:')) openPanel('thing', +t.slice(2));
    else if (t === 'gate') openPanel('zoo');
    else if (!Sim.owned(S, tile.x, tile.y)) setMode('land');
    else closePanel();
  },
};
