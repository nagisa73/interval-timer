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
  if (audioRecovering || !state.running || !state.settings.sound) return;
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
      if (state.running && state.settings.sound && !isAudioRunning()) prepareAudio();
    }, { capture: true, passive: true });
  }
}

// 「ピッ」という音を1回鳴らす
//   freq   : 音の高さ（Hz）
//   length : 長さ（秒）
//   delay  : 何秒後に鳴らすか（省略すると今すぐ）
function playTone(freq, length, delay) {
  if (!audioContext) return;

  if (isAudioRunning()) {
    scheduleTone(freq, length, delay);
    return;
  }

  // 止まっていたら再開を試す。間に合わなかった音は、あとからまとめて鳴らさない
  const requestedAt = Date.now();
  try {
    audioContext.resume().then(function () {
      if (Date.now() - requestedAt < 250 && isAudioRunning()) scheduleTone(freq, length, delay);
    }).catch(function () {});
  } catch (error) {
    // 何もしない
  }
}

// 音を実際に予約する
function scheduleTone(freq, length, delay) {
  const startTime = audioContext.currentTime + (delay || 0);
  const oscillator = audioContext.createOscillator();  // 音のもと
  const gain = audioContext.createGain();              // 音量の調整

  oscillator.frequency.value = freq;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  // 急に鳴らしたり止めたりすると「プツッ」とノイズが出るので、
  // 音量をすばやく上げて、なめらかに下げる
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(CONFIG.sound.volume, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + length);

  oscillator.start(startTime);
  oscillator.stop(startTime + length + 0.02);
}


/* ---------- 合図（音） ---------- */

// type には次のどれかを渡す
//   "count"  : 残り3秒の合図
//   "change" : ブロックが切り替わった合図
//   "finish" : 全部終わった合図
function signal(type) {
  if (!state.settings.sound) return;

  if (type === "count") {
    playTone(CONFIG.sound.count.freq, CONFIG.sound.count.length);
  }
  // 全部終わったときも、ブロックが終わったときと同じ音にする
  if (type === "change" || type === "finish") {
    playTone(CONFIG.sound.change.freq, CONFIG.sound.change.length);
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
