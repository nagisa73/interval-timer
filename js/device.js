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
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextClass();
    }
    audioContext.resume();
  } catch (error) {
    // 音が使えない端末では何もしない
  }
}

// 「ピッ」という音を1回鳴らす
//   freq   : 音の高さ（Hz）
//   length : 長さ（秒）
//   delay  : 何秒後に鳴らすか（省略すると今すぐ）
function playTone(freq, length, delay) {
  if (!audioContext) return;

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
