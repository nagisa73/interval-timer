/* ============================================================
   sounds.js ― 選べる音のリスト
   ------------------------------------------------------------
   音声ファイルは使わず、すべてプログラムで音を作っています。
   ここに足せば、設定の音の選択肢が増えます。
     id     : 保存に使う名前（あとから変えない）
     name   : 画面に出る名前
     play   : 音を鳴らす関数
   ============================================================ */

// 「鳴らさない」を表す id
const SOUND_NONE = "none";

// 1つの音を鳴らす
//   f : 高さ（Hz）   d : 長さ（秒）   v : 音量   w : 波の形（省略するとサイン波）
//   t : 何秒後に鳴らすか   a : 立ち上がりの時間   to / glide : 高さの変化
//   hold : 音量を保つ時間   vib / depth : 音のゆれ
function soundTone(out, o) {
  const ctx = out.ctx;
  const time = out.start + (o.t || 0);
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = o.w || "sine";
  oscillator.frequency.setValueAtTime(o.f, time);
  if (o.to) oscillator.frequency.exponentialRampToValueAtTime(o.to, time + (o.glide || o.d));

  if (o.vib) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = o.vib;
    lfoGain.gain.value = o.depth || 60;
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);
    lfo.start(time);
    lfo.stop(time + o.d + 0.02);
  }

  // 急に鳴らしたり止めたりすると「プツッ」とノイズが出るので、なめらかに変える
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(o.v, time + (o.a || 0.003));
  if (o.hold) gain.gain.setValueAtTime(o.v, time + o.hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + o.d);

  oscillator.connect(gain);
  gain.connect(out.bus);
  oscillator.start(time);
  oscillator.stop(time + o.d + 0.02);
}

// 短いノイズを鳴らす（打楽器の「コッ」という部分）
function soundNoise(out, d, freq, volume) {
  const ctx = out.ctx;
  const size = Math.max(1, Math.floor(ctx.sampleRate * d));
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 1.5;
  gain.gain.setValueAtTime(volume, out.start);
  gain.gain.exponentialRampToValueAtTime(0.0001, out.start + d);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(out.bus);
  source.start(out.start);
}

// ベルのように、高さの違う音を重ねて鳴らす
function soundBell(out, freq, volume, d) {
  const partials = [[1, 1, 1], [2.01, 0.5, 0.75], [2.76, 0.36, 0.55], [5.4, 0.18, 0.3], [8.93, 0.09, 0.16]];
  for (const [ratio, level, decay] of partials) {
    soundTone(out, { f: freq * ratio, v: volume * level, d: d * decay, a: 0.002 });
  }
}

const SOUND_LIST = [
  { id: "beep", name: "ピッ", play: function (o) {
    soundTone(o, { f: 660, d: 0.12, v: 0.35 });
  } },
  { id: "click", name: "クリック", play: function (o) {
    soundTone(o, { w: "triangle", f: 1800, to: 1100, glide: 0.012, d: 0.03, v: 0.4, a: 0.001 });
    soundNoise(o, 0.012, 3200, 0.14);
  } },
  { id: "wood", name: "ウッドブロック", play: function (o) {
    soundTone(o, { w: "triangle", f: 1250, to: 760, glide: 0.035, d: 0.07, v: 0.42, a: 0.001 });
    soundNoise(o, 0.018, 2400, 0.16);
  } },
  { id: "soft", name: "やわらかい電子音", play: function (o) {
    soundTone(o, { f: 980, to: 720, glide: 0.07, d: 0.11, v: 0.36, a: 0.006 });
  } },
  { id: "drop", name: "水滴", play: function (o) {
    soundTone(o, { f: 620, to: 1700, glide: 0.09, d: 0.13, v: 0.34, a: 0.004 });
  } },
  { id: "blip", name: "シンセブリップ", play: function (o) {
    soundTone(o, { w: "sawtooth", f: 1760, to: 1320, glide: 0.05, d: 0.07, v: 0.11, a: 0.001 });
  } },
  { id: "retro", name: "レトロゲーム風", play: function (o) {
    soundTone(o, { w: "square", f: 988, d: 0.05, v: 0.12, a: 0.001 });
    soundTone(o, { w: "square", f: 1319, t: 0.05, d: 0.07, v: 0.12, a: 0.001 });
  } },
  { id: "cowbell", name: "カウベル", play: function (o) {
    soundTone(o, { w: "square", f: 545, d: 0.16, v: 0.1, a: 0.001 });
    soundTone(o, { w: "square", f: 815, d: 0.13, v: 0.09, a: 0.001 });
  } },
  { id: "up", name: "上昇2音", play: function (o) {
    soundTone(o, { f: 880, d: 0.13, v: 0.28 });
    soundTone(o, { f: 1319, t: 0.09, d: 0.26, v: 0.3 });
  } },
  { id: "down", name: "下降2音", play: function (o) {
    soundTone(o, { f: 1319, d: 0.13, v: 0.28 });
    soundTone(o, { f: 880, t: 0.09, d: 0.26, v: 0.3 });
  } },
  { id: "arpeggio", name: "3音アルペジオ", play: function (o) {
    [1047, 1319, 1568].forEach(function (f, i) {
      soundTone(o, { f: f, t: i * 0.075, d: 0.32, v: 0.24 });
    });
  } },
  { id: "ping", name: "ピーン", play: function (o) {
    soundTone(o, { f: 990, d: 0.45, v: 0.35, a: 0.015 });
  } },
  { id: "marimba", name: "木琴・マリンバ風", play: function (o) {
    soundTone(o, { f: 784, d: 0.55, v: 0.36, a: 0.002 });
    soundTone(o, { f: 3136, d: 0.08, v: 0.1, a: 0.001 });
    soundTone(o, { f: 7840, d: 0.03, v: 0.035, a: 0.001 });
  } },
  { id: "glocken", name: "鉄琴", play: function (o) {
    soundTone(o, { f: 1568, d: 0.75, v: 0.27, a: 0.002 });
    soundTone(o, { f: 4312, d: 0.22, v: 0.09, a: 0.001 });
    soundTone(o, { f: 8467, d: 0.07, v: 0.03, a: 0.001 });
  } },
  { id: "whistle", name: "ホイッスル", play: function (o) {
    soundTone(o, { f: 2350, d: 0.42, v: 0.15, a: 0.012, hold: 0.34, vib: 34, depth: 75 });
    soundNoise(o, 0.4, 2600, 0.025);
  } },
  { id: "buzzer", name: "ブザー", play: function (o) {
    soundTone(o, { w: "square", f: 165, d: 0.48, v: 0.13, a: 0.004, hold: 0.4 });
    soundTone(o, { w: "square", f: 169, d: 0.48, v: 0.1, a: 0.004, hold: 0.4 });
  } },
  { id: "chime", name: "2音チャイム", play: function (o) {
    soundTone(o, { f: 1319, d: 0.32, v: 0.26, a: 0.004 });
    soundTone(o, { f: 1047, t: 0.2, d: 0.65, v: 0.3, a: 0.004 });
  } },
  { id: "triangle", name: "トライアングル", play: function (o) {
    [[2637, 0.12], [6330, 0.09], [9230, 0.05]].forEach(function (p) {
      soundTone(o, { f: p[0], d: 1, v: p[1], a: 0.001 });
    });
  } },
  { id: "bell", name: "ベル", play: function (o) {
    soundBell(o, 880, 0.22, 1.1);
  } },
  { id: "gong", name: "ゴング", play: function (o) {
    soundBell(o, 392, 0.27, 1.3);
    soundBell(o, 396, 0.1, 1);
    soundNoise(o, 0.03, 3000, 0.12);
  } },
];

function findSound(id) {
  return SOUND_LIST.find(function (sound) { return sound.id === id; }) || null;
}

// 設定画面に出す音の名前
function soundLabel(id) {
  const sound = findSound(id);
  return sound ? sound.name : "鳴らさない";
}

// 保存できる音の id か調べる
function isSoundId(id) {
  return id === SOUND_NONE || findSound(id) !== null;
}
