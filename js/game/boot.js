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
  updateHud();
  if (start.upgraded) showUpgraded();
  else if (start.fresh || !S.name) showWelcome();
  else if (start.away) toast(`Welcome back! ${S.name} waited for you: time only passes while you play.`);
  save();
  requestAnimationFrame(clock);
})();
