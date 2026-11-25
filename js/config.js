/* ============================================================
   config.js ― 変更しやすい設定値
   ------------------------------------------------------------
   アプリの動きを少し変えたいときは、まずここを見てください。
   数字を変えるだけで、プログラムの他の部分はそのまま使えます。
   ============================================================ */

const CONFIG = {
  // 保存するときの名前（変えると、今までの保存内容は読み込まれなくなる）
  storageKey: "interval-timer-v1",

  // はじめから入っている種類の色を変えたときに増やす番号（storage.js で使う）
  kindsVersion: 3,

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

  // 「元に戻す」ボタンを表示しておく時間（ミリ秒）
  undoMs: 6000,

  // ホイールピッカーの1行の高さ（px）
  wheelItemHeight: 40,

  // くり返しの入れ子の上限（スマホの横幅で読める段数）
  maxNestDepth: 3,

  // 種類の名前・マイセットの名前の最大文字数
  maxKindNameLength: 6,
  maxPresetNameLength: 20,

  // マイセットの説明の最大文字数
  maxPresetDescLength: 60,

  // スマホで長押しと判定するまでの時間（ミリ秒）
  dragPressMs: 280,

  // スタート後に今のブロックのゲージを動かすとき（scrub.js）
  scrubPressMs: 500,         // 長押しと判定するまでの時間（ミリ秒）。うっかり防止で長め
  scrubMoveTolerancePx: 8,   // 長押しの前にこれ以上動いたら、スクロールとみなす
  scrubDeadZonePx: 12,       // 横にこれだけ動かすまでは時間を変えない

  // 種類に選べる色（実際の色は style.css の --c-〇〇）
  kindColors: [
    { id: "orange", label: "色1" },
    { id: "teal",   label: "色2" },
    { id: "indigo", label: "色3" },
    { id: "red",    label: "色4" },
    { id: "pink",   label: "色5" },
    { id: "purple", label: "色6" },
    { id: "blue",   label: "色7" },
    { id: "green",  label: "色8" },
  ],
};

// はじめから入っている種類
const DEFAULT_KINDS = [
  { id: "work", name: "運動", color: "red" },
  { id: "rest", name: "休憩", color: "blue" },
  { id: "prep", name: "準備", color: "orange" },
];
