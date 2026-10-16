// CUTISE ZOO — taps, drags, pinches and keys on the zoo.
// Look mode: tap the thing (an animal, a habitat, a shop) to open its one panel; tap poop to tidy it;
// drag to pan, pinch or scroll to zoom. Build mode: tap to place, drag to lay path. Clear mode: tap to clear.
const input = {
  pointers: new Map(),
  start: null, // where the first finger went down
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
        if (this.paints()) this.place(p);
      } else this.pinch = this.spread();
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
      if (this.paints()) return this.place(p);
      if (Math.hypot(p.x - this.start.x, p.y - this.start.y) > 8) this.dragged = true;
      if (this.dragged) {
        render.cam.px += p.x - last.x;
        render.cam.py += p.y - last.y;
        ui.follow = null;
      }
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0 && p && !this.dragged && !this.paints()) this.tap(p);
      this.pinch = 0;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    cv.addEventListener('pointerleave', () => (ui.hover = null));
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
      if (e.key === 'b') openPanel('build');
      if (e.key === 'a') openPanel('animals');
      if (e.key === 'x') setMode('bulldoze');
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
      if (e.key === '+' || e.key === '=') render.zoomAt(1.2);
      if (e.key === '-') render.zoomAt(1 / 1.2);
      if (e.key === ' ') {
        ui.paused = !ui.paused;
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
  // In build and clear modes, a press places (and a drag keeps placing paths and decorations).
  paints() {
    return ui.mode === 'bulldoze' || ui.mode === 'build';
  },

  place(p) {
    const tile = render.tileFromScreen(p.x, p.y);
    if (!tile) return;
    const key = tile.x + ',' + tile.y;
    if (this.painted.has(key)) return;
    this.painted.add(key);
    if (ui.mode === 'bulldoze') {
      if (!Sim.tileAt(S, tile.x, tile.y)) return;
      const res = act({ type: 'bulldoze', x: tile.x, y: tile.y });
      if (res.ok) {
        sfx('pop');
        render.pop(p.x, p.y, '+' + res.coins + ' 🪙', '#ffe39a');
      }
      return;
    }
    const def = D.BUILDS[ui.buildKey];
    // dragging only lays paths and decorations; a habitat or shop needs a fresh tap
    if (this.painted.size > 1 && !['path', 'decor'].includes(def.kind)) return;
    if (Sim.buildProblem(S, ui.buildKey, tile.x, tile.y)) {
      if (this.painted.size === 1) act({ type: 'build', k: ui.buildKey, x: tile.x, y: tile.y }); // says why
      return;
    }
    const res = act({ type: 'build', k: ui.buildKey, x: tile.x, y: tile.y });
    if (!res.ok) return;
    sfx('build');
    render.pop(p.x, p.y, '-' + def.cost + ' 🪙', '#ffe39a');
    ui.canUndo = true;
    if (['habitat', 'shop'].includes(def.kind)) {
      setMode(null);
      if (def.kind === 'habitat') openPanel('habitat', res.id);
    }
  },

  tap(p) {
    // Smallest targets first: poop, then animals, then buildings, then the habitat or tile underneath.
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
    const b = near('build');
    if (b) return openPanel('thing', b.id);
    const tile = render.tileFromScreen(p.x, p.y);
    if (!tile) return closePanel();
    const t = Sim.tileAt(S, tile.x, tile.y);
    if (t.startsWith('h:')) openPanel('habitat', +t.slice(2));
    else if (t.startsWith('b:')) openPanel('thing', +t.slice(2));
    else if (t === 'gate') openPanel('zoo');
    else closePanel();
  },
};
