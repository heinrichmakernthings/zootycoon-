// CUTISE ZOO — starts the game. Must be the last script on the page.
(function boot() {
  const start = loadSave();
  render.init();
  input.init();
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', (e) => e.key === 'Enter' && e.target.id === 'zooname-input' && UI_ACTIONS.closemodal());
  addEventListener('visibilitychange', () => document.hidden && save());
  addEventListener('pagehide', save);
  updateHud();
  if (start.fresh || !S.name) showWelcome();
  else if (start.away) showAway(start.away);
  save();
  requestAnimationFrame(clock);
})();
