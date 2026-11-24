/* ============================================================
   timer.js ― タイマーの動き
   ------------------------------------------------------------
   【時間の測り方】
   「1秒ごとに1引く」と、スマホが画面を消したときなどに時計が止まって
   ずれてしまいます。そこで、スタートしたときに「終わる時刻」を
   覚えておき、毎回「終わる時刻 − 今の時刻」で残り時間を計算します。
   こうすると、途中で止まっていても、戻ったときに正しい時間になります。
   ============================================================ */

// 画面を描き直すたびに次の描き直しを予約する（requestAnimationFrame）ときの番号札
let frameId = null;


/* ---------- 準備 ---------- */

// メニュー（state.plan）から実行用のリストを作り直し、最初の状態に戻す
function buildRunList() {
  const list = flattenPlan(state.plan);

  // msFrom[i] = i番目から最後までの合計時間
  const msFrom = new Array(list.length + 1).fill(0);
  for (let i = list.length - 1; i >= 0; i--) {
    msFrom[i] = msFrom[i + 1] + stepMs(list[i]);
  }

  state.runList = list;
  state.msFrom = msFrom;
  state.index = 0;
  state.started = false;
  state.running = false;
  state.finished = false;
  state.lastBeepSecond = null;
  state.remainingMs = list.length > 0 ? stepMs(list[0]) : 0;
}


/* ---------- 状態を調べる関数 ---------- */

// リストの1つ分の長さ（ミリ秒）
function stepMs(item) {
  return item.node.seconds * 1000;
}

// 今のブロック（終わっていたら null）
function currentItem() {
  if (state.finished) return null;
  return state.runList[state.index] || null;
}

// 途中か（スタートしたけれど、まだ終わっていない）
function isInProgress() {
  return state.started && !state.finished;
}

// 全体の残り時間（ミリ秒）
function totalRemainingMs() {
  if (state.finished) return 0;
  return state.remainingMs + (state.msFrom[state.index + 1] || 0);
}

// 全体の長さ（ミリ秒）
function totalMs() {
  return state.msFrom[0] || 0;
}


/* ---------- スタート・一時停止 ---------- */

function startTimer() {
  if (state.runList.length === 0) return;
  if (state.finished) buildRunList();  // 終わっていたら最初から

  prepareAudio();
  keepScreenOn();

  state.started = true;
  state.running = true;
  state.endAt = Date.now() + state.remainingMs;  // 終わる時刻を覚える

  loop();
}

function pauseTimer() {
  state.remainingMs = Math.max(0, state.endAt - Date.now());  // 残りを覚えておく
  state.running = false;
  cancelAnimationFrame(frameId);
  allowScreenOff();
  updateView();
}

// 画面が描き直されるたびに tick を呼ぶ（だいたい1秒に60回）
function loop() {
  tick();
  if (state.running) {
    frameId = requestAnimationFrame(loop);
  }
}


/* ---------- 時間を進める ---------- */

function tick() {
  if (!state.running) return;

  const now = Date.now();
  let changed = false;

  // 今のブロックの終わる時刻を過ぎていたら、次のブロックへ進む。
  // 画面が消えていた間に何ブロックも終わっていることがあるので、
  // if ではなく while で、追いつくまでくり返す
  while (now >= state.endAt) {
    state.index++;
    if (state.index >= state.runList.length) {
      finishTimer();
      return;
    }
    state.endAt += stepMs(state.runList[state.index]);
    changed = true;
  }

  state.remainingMs = state.endAt - now;

  if (changed) {
    state.lastBeepSecond = null;
    signal("change");
  }

  playCountdown();
  updateView();
}

// 残り3秒・2秒・1秒で「ピッ」と鳴らす
function playCountdown() {
  const item = currentItem();
  const secondsLeft = Math.ceil(state.remainingMs / 1000);

  // 短すぎるブロック（3秒以下）では鳴らさない
  if (item.node.seconds <= CONFIG.countdownSeconds) return;
  if (secondsLeft < 1 || secondsLeft > CONFIG.countdownSeconds) return;
  if (secondsLeft === state.lastBeepSecond) return;  // この秒ではもう鳴らした

  state.lastBeepSecond = secondsLeft;
  signal("count");
}

function finishTimer() {
  state.running = false;
  state.finished = true;
  state.index = state.runList.length - 1;
  state.remainingMs = 0;
  cancelAnimationFrame(frameId);
  allowScreenOff();
  signal("finish");
  updateView();
}


/* ---------- 前へ・次へ・最初に戻す ---------- */

// リストの i 番目に移動して、そのブロックの最初から始める
function goToStep(i) {
  state.index = i;
  state.remainingMs = stepMs(state.runList[i]);
  state.lastBeepSecond = null;
  if (state.running) {
    state.endAt = Date.now() + state.remainingMs;
  }
  updateView();
}

function nextStep() {
  if (state.runList.length === 0 || state.finished) return;

  if (state.index < state.runList.length - 1) {
    goToStep(state.index + 1);
  } else if (state.started) {
    finishTimer();  // 最後のブロックで「次へ」を押したら終わり
  }
}

function prevStep() {
  if (state.runList.length === 0) return;

  // 終わったあとに押したら、最後のブロックに戻る
  if (state.finished) {
    state.finished = false;
    state.started = true;
    goToStep(state.runList.length - 1);
    return;
  }

  if (state.running) {
    state.remainingMs = Math.max(0, state.endAt - Date.now());
  }
  const elapsedMs = stepMs(state.runList[state.index]) - state.remainingMs;

  // 少し進んでいたら今のブロックの最初へ、始まったばかりなら前のブロックへ
  // （音楽プレーヤーの「前へ」ボタンと同じ動き）
  if (elapsedMs > CONFIG.backThresholdMs || state.index === 0) {
    goToStep(state.index);
  } else {
    goToStep(state.index - 1);
  }
}

function resetTimer() {
  cancelAnimationFrame(frameId);
  allowScreenOff();
  buildRunList();
  updateView();
}
