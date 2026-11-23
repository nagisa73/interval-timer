/* ============================================================
   device.js ― 音・画面の点灯
   ------------------------------------------------------------
   スマホやパソコンの機能を使う部分です。
   使えない端末でもエラーにならないように、すべて try { } catch { } で
   囲んでいます。
   ============================================================ */


/* ---------- 音 ---------- */

// 音を作る装置。ブラウザの決まりで、ユーザーがボタンを押したあとでないと
// 作れないので、スタートボタンを押したときに prepareAudio() で作る
let audioContext = null;

function prepareAudio() {
  try {
    if (!audioContext || audioContext.state === "closed") {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextClass();
    }
    resumeAudio();

    // iPhone は、無音を1回流すと音が使える状態になる
    const source = audioContext.createBufferSource();
    source.buffer = audioContext.createBuffer(1, 1, 22050);
    source.connect(audioContext.destination);
    source.start(0);
  } catch (error) {
    // 音が使えない端末では何もしない
  }
}

function resumeAudio() {
  try {
    const result = audioContext.resume();
    if (result) result.catch(function () {});
  } catch (error) {
    // 何もしない
  }
}

function isAudioRunning() {
  return audioContext !== null && audioContext.state === "running";
}

function waitMs(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// 別のアプリや画面オフから戻ったときに、止まった音を復帰させる
let audioRecovering = false;

async function recoverAudio() {
  if (audioRecovering || !state.running || !hasAnySound()) return;
  audioRecovering = true;

  prepareAudio();
  await waitMs(400);

  // 再開できなければ、音の装置を作り直す
  if (!isAudioRunning()) {
    try {
      if (audioContext) audioContext.close().catch(function () {});
    } catch (error) {
      // 何もしない
    }
    audioContext = null;
    prepareAudio();
    await waitMs(300);
  }

  // 端末の制限でタップが必要なときは、そのことを知らせる
  if (!isAudioRunning() && state.running && document.visibilityState === "visible") {
    showToast("音を再開するには、画面をタップしてください");
  }
  audioRecovering = false;
}

// 音が止まっているときは、次に画面を触ったタイミングで再開する
function setupAudioRecovery() {
  for (const type of ["pointerup", "touchend", "click", "keydown"]) {
    document.addEventListener(type, function () {
      if (state.running && hasAnySound() && !isAudioRunning()) prepareAudio();
    }, { capture: true, passive: true });
  }
}

// どちらかの合図で音を使う設定か
function hasAnySound() {
  return state.settings.countSound !== SOUND_NONE || state.settings.changeSound !== SOUND_NONE;
}

// sounds.js の音を1回鳴らす（isPreview は設定画面での試聴）
function playSound(id, isPreview) {
  const sound = findSound(id);
  if (!sound || !audioContext) return;

  if (isAudioRunning()) {
    scheduleSound(sound, isPreview);
    return;
  }

  // 止まっていたら再開を試す。間に合わなかった音は、あとからまとめて鳴らさない
  const requestedAt = Date.now();
  try {
    audioContext.resume().then(function () {
      if (Date.now() - requestedAt < 250 && isAudioRunning()) scheduleSound(sound, isPreview);
    }).catch(function () {});
  } catch (error) {
    // 何もしない
  }
}

// 音を実際に予約する
function scheduleSound(sound, isPreview) {
  try {
    if (isPreview) stopPreview();

    const bus = audioContext.createGain();
    bus.connect(audioContext.destination);
    if (isPreview) previewBus = bus;

    sound.play({ ctx: audioContext, bus: bus, start: audioContext.currentTime + 0.01 });

    // 鳴り終わったら片付ける（いちばん長い音でも2秒以内）
    setTimeout(function () { bus.disconnect(); }, 2500);
  } catch (error) {
    // 音が使えない端末では何もしない
  }
}

// 試聴中の音。次の音を試すときに止める
let previewBus = null;

function stopPreview() {
  if (!previewBus) return;
  try {
    const now = audioContext.currentTime;
    previewBus.gain.setValueAtTime(previewBus.gain.value, now);
    previewBus.gain.linearRampToValueAtTime(0, now + 0.015);
  } catch (error) {
    // 何もしない
  }
  previewBus = null;
}

// 設定画面で音を試聴する
function previewSound(id) {
  prepareAudio();
  stopPreview();
  playSound(id, true);
}


/* ---------- 合図（音） ---------- */

// type には次のどれかを渡す
//   "count"  : 残り3秒の合図
//   "change" : ブロックが切り替わった合図
//   "finish" : 全部終わった合図（切り替わりと同じ音）
function signal(type) {
  if (type === "count") {
    playSound(state.settings.countSound);
  }
  if (type === "change" || type === "finish") {
    playSound(state.settings.changeSound);
  }
}


/* ---------- ライト・ダーク ---------- */

const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");

// 設定（auto / light / dark）に合わせて画面の色を切り替える
function applyTheme() {
  const choice = state.settings.theme;
  const useDark = choice === "dark" || (choice !== "light" && darkModeQuery.matches);
  const root = document.documentElement;
  root.dataset.theme = useDark ? "dark" : "light";

  // スマホのブラウザのバーの色も合わせる
  $("themeColor").content = getComputedStyle(root).getPropertyValue("--bg").trim();
}


/* ---------- 画面を消さない ---------- */

// 画面を点けたままにしておく「鍵」。タイマー中だけ持っておく
let wakeLock = null;

async function keepScreenOn() {
  if (!("wakeLock" in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    // 別のアプリに切り替えたときなどに自動で外れるので、そのときは記録を消す
    wakeLock.addEventListener("release", function () {
      wakeLock = null;
    });
  } catch (error) {
    // 使えない端末では何もしない
  }
}

function allowScreenOff() {
  try {
    if (wakeLock) wakeLock.release();
  } catch (error) {
    // 何もしない
  }
  wakeLock = null;
}
