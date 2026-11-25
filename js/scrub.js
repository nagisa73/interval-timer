/* ============================================================
   scrub.js ― スタート後に、今のブロックのゲージを動かす
   ------------------------------------------------------------
   今のブロックを長押しして左右に動かすと、残り時間を変えられる。
   初めての人がうっかり動かさないように、次のようにしている。
     ・長押し（CONFIG.scrubPressMs）しないと始まらない
     ・長押しの前に指が動いたら、スクロールとみなしてやめる
     ・触った位置に飛ばさず、今の位置から指を動かした分だけ動く
     ・横に少し（CONFIG.scrubDeadZonePx）動かすまでは時間を変えない
     ・指を離したら「元に戻す」付きのお知らせを出す
   ============================================================ */

const scrub = {
  pointerId: null,
  pressTimer: null,
  block: null,
  index: null,          // 始めたときのブロック（途中で進んだらやめる）
  ready: false,         // 長押しが成立した
  active: false,        // 実際に時間を動かしている
  startX: 0,
  startY: 0,
  anchorX: 0,           // 時間を動かし始めた指の位置
  anchorElapsedMs: 0,   // そのときの経過時間
  beforeRemainingMs: 0, // 動かす前の残り時間
};

function setupScrub() {
  $("planList").addEventListener("pointerdown", onScrubPointerDown);
  document.addEventListener("pointermove", onScrubPointerMove);
  document.addEventListener("pointerup", onScrubPointerUp);
  document.addEventListener("pointercancel", onScrubPointerUp);

  // 長押しが成立したら、指を動かしても図をスクロールさせない
  document.addEventListener("touchmove", function (event) {
    if (scrub.ready) event.preventDefault();
  }, { passive: false });
  document.addEventListener("contextmenu", function (event) {
    if (scrub.ready) event.preventDefault();
  });
}

// 今の残り時間（動作中は時計から計算する）
function currentRemainingMs() {
  if (state.scrubbing || !state.running) return state.remainingMs;
  return Math.max(0, state.endAt - Date.now());
}

// 残り時間を書き換える
function setRemainingMs(ms) {
  state.remainingMs = ms;
  if (state.running) state.endAt = Date.now() + ms;
  updateView();
}

function onScrubPointerDown(event) {
  if (scrub.pointerId !== null || !isInProgress() || state.selecting) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const block = event.target.closest(".block.current");
  if (!block) return;

  scrub.pointerId = event.pointerId;
  scrub.block = block;
  scrub.index = state.index;
  scrub.startX = event.clientX;
  scrub.startY = event.clientY;
  scrub.pressTimer = setTimeout(beginScrub, CONFIG.scrubPressMs);
}

// 長押しが成立した
function beginScrub() {
  if (scrub.pointerId === null) return;
  if (!isInProgress() || state.index !== scrub.index) {
    resetScrub();
    return;
  }
  scrub.ready = true;
  scrub.block.classList.add("scrubbing");
}

function onScrubPointerMove(event) {
  if (event.pointerId !== scrub.pointerId) return;
  const dx = event.clientX - scrub.startX;
  const dy = event.clientY - scrub.startY;

  // 長押しの前に指が動いたら、スクロールなのでやめる
  if (!scrub.ready) {
    if (Math.hypot(dx, dy) > CONFIG.scrubMoveTolerancePx) resetScrub();
    return;
  }
  // 途中で次のブロックに進んだら、そこでやめる
  if (!isInProgress() || state.index !== scrub.index) {
    finishScrub();
    return;
  }

  if (!scrub.active) {
    // 横より先に上下へ動いたら、時間は変えずにやめる
    if (Math.abs(dy) > CONFIG.scrubDeadZonePx && Math.abs(dy) > Math.abs(dx)) {
      resetScrub();
      return;
    }
    if (Math.abs(dx) < CONFIG.scrubDeadZonePx) return;

    scrub.active = true;
    state.scrubbing = true;  // 動かしている間は時計を止める（timer.js の tick）
    scrub.anchorX = event.clientX;
    scrub.beforeRemainingMs = currentRemainingMs();
    scrub.anchorElapsedMs = stepMs(currentItem()) - scrub.beforeRemainingMs;
  }

  // ブロックの横幅 = ブロックの長さ。1秒きざみで、今の位置から動かした分だけ動く
  const totalMs = stepMs(currentItem());
  const movedMs = (event.clientX - scrub.anchorX) / scrub.block.clientWidth * totalMs;
  const maxElapsed = Math.max(scrub.anchorElapsedMs, totalMs - 1000);  // 動かしただけで終わらないように
  const elapsed = clamp(scrub.anchorElapsedMs + Math.round(movedMs / 1000) * 1000, 0, maxElapsed);
  setRemainingMs(totalMs - elapsed);
}

function onScrubPointerUp(event) {
  if (event.pointerId !== scrub.pointerId) return;
  finishScrub();
}

// 指を離したとき。時間を動かしていたら「元に戻す」を出す
function finishScrub() {
  const wasActive = scrub.active;
  const index = scrub.index;
  const changeMs = wasActive ? state.remainingMs - scrub.beforeRemainingMs : 0;
  resetScrub();
  if (!wasActive || !isInProgress() || state.index !== index) return;

  setRemainingMs(state.remainingMs);  // 止めていた時計を、ここから動かす
  // 今いる秒の「ピッ」は鳴らさない（動かした先で急に鳴らないように）
  state.lastBeepSecond = Math.ceil(state.remainingMs / 1000);
  if (changeMs === 0) return;

  showUndoAction("時間を変更しました", function () {
    if (!isInProgress() || state.index !== index) {
      showToast("ブロックが進んだので、元に戻せません");
      return;
    }
    const item = currentItem();
    setRemainingMs(clamp(currentRemainingMs() - changeMs, 0, stepMs(item)));
    state.lastBeepSecond = Math.ceil(state.remainingMs / 1000);
    showToast("元に戻しました");
  });
}

function resetScrub() {
  clearTimeout(scrub.pressTimer);
  if (scrub.block) scrub.block.classList.remove("scrubbing");
  scrub.pointerId = null;
  scrub.block = null;
  scrub.ready = false;
  scrub.active = false;
  state.scrubbing = false;
}
