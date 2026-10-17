// CUTISE ZOO — starts the game. Must be the last script on the page.
(function boot() {
  const start = loadSave();
  render.init();
  input.init();
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'zooname-input') UI_ACTIONS.closemodal();
    if (e.target.id === 'ask-input') UI_ACTIONS.askok();
    if (e.target.id === 'reveal-name') UI_ACTIONS.revealdone();
  });
  addEventListener('visibilitychange', () => document.hidden && save());
  addEventListener('pagehide', save);
  // HUD and toolbar icons: pictures where they exist (batch 2), emoji otherwise.
  for (const el of document.querySelectorAll('[data-icon]'))
    if (ZOO_ART_READY['icon-' + el.dataset.icon])
      el.innerHTML = `<img class="icon" src="${ZOO_ART_READY['icon-' + el.dataset.icon]}" alt="">`;
  updateHud();
  if (start.upgraded) showUpgraded();
  else if (start.fresh || !S.name) showWelcome();
  else if (start.away) toast(`Welcome back! ${S.name} waited for you: time only passes while you play.`);
  save();
  requestAnimationFrame(clock);
})();
