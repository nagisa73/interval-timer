/* ============================================================
   config.js ― 変更しやすい設定値
   ------------------------------------------------------------
   アプリの動きを少し変えたいときは、まずここを見てください。
   数字を変えるだけで、プログラムの他の部分はそのまま使えます。
   ============================================================ */

const CONFIG = {
  // 保存するときの名前（変えると、今までの保存内容は読み込まれなくなる）
  storageKey: "interval-timer-v1",

  // 1つのブロックの長さの上限（秒）。3600秒 = 60分
  maxSeconds: 3600,

  // くり返しのセット数の上限
  maxRepeat: 99,

  // ブロック名の最大文字数
  maxNameLength: 12,

  // 残り何秒から「ピッ」と鳴らすか
  countdownSeconds: 3,

  // 「前へ」ボタンを押したとき、この時間（ミリ秒）以上たっていたら
  // 前のブロックではなく、今のブロックの最初に戻る
  backThresholdMs: 2000,

  // ホイールピッカーの1行の高さ（px）
  wheelItemHeight: 40,

  // 音の設定。freq は音の高さ（Hz）、length は長さ（秒）
  sound: {
    volume: 0.35,
    count:  { freq: 660, length: 0.12 },  // 残り3秒の「ピッ」
    change: { freq: 990, length: 0.45 },  // ブロックが切り替わる「ピーン」
  },

  // くり返しの入れ子の上限（スマホの横幅で読める段数）
  maxNestDepth: 3,

  // 種類の名前・マイセットの名前の最大文字数
  maxKindNameLength: 6,
  maxPresetNameLength: 20,

  // マイセットの説明の最大文字数
  maxPresetDescLength: 60,

  // 画面の短い辺がこの幅（px）未満のタッチ端末をスマホとして扱う
  phoneMaxShortSide: 600,

  // スマホで長押しと判定するまでの時間（ミリ秒）
  dragPressMs: 280,

  // 種類に選べる色（実際の色は style.css の --c-〇〇）
  kindColors: [
    { id: "orange", label: "オレンジ" },
    { id: "teal",   label: "青緑" },
    { id: "indigo", label: "藍" },
    { id: "red",    label: "赤" },
    { id: "pink",   label: "ピンク" },
    { id: "purple", label: "紫" },
    { id: "blue",   label: "青" },
    { id: "green",  label: "緑" },
  ],
};

// はじめから入っている種類
const DEFAULT_KINDS = [
  { id: "work", name: "運動", color: "orange" },
  { id: "rest", name: "休憩", color: "teal" },
  { id: "prep", name: "準備", color: "indigo" },
];
