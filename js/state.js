/* ============================================================
   state.js ― アプリ全体の状態
   ------------------------------------------------------------
   アプリが覚えておくべきことは、すべてこの state にまとめています。
   どのファイルからも state.〇〇 で読み書きできます。
   「今どうなっているか」がわからなくなったら、ここを見てください。
   ============================================================ */

const state = {

  // ----- 設定（保存される） -----

  // メニューの中身（入れ子の形）。plan.js を参照
  plan: [],

  // オン・オフの設定
  settings: {
    countSound: "beep",   // 残り3秒の音（sounds.js の id。"none" は鳴らさない）
    changeSound: "ping",  // ブロックが切り替わるときの音
    theme: "auto",  // 画面の色（auto：端末に合わせる / light / dark）
  },

  // ブロックの種類 [{ id, name, color }]
  kinds: DEFAULT_KINDS.map(function (kind) { return Object.assign({}, kind); }),

  // マイセット [{ id, name, plan }]
  presets: [],

  // マイセットの中身を編集している間だけ { id, backup: 編集前のメニュー }
  presetEdit: null,

  // ----- 選択の状態（保存されない） -----

  selecting: false,       // 複数選択モードか
  selectedIds: new Set(), // 選ばれているブロック・くり返しの id

  // ----- タイマーの状態（保存されない） -----

  // 実行用のリスト（plan の入れ子をほどいたもの）
  runList: [],

  // msFrom[i] = i番目から最後までの合計時間（ミリ秒）。全体の残り時間の計算に使う
  msFrom: [],

  // 今リストの何番目か（0から数える）
  index: 0,

  // 今のブロックの残り時間（ミリ秒）。一時停止中はここに残り時間を覚えておく
  remainingMs: 0,

  // 今のブロックが終わる時刻（Date.now() の形、ミリ秒）。動いている間だけ使う
  endAt: 0,

  started: false,   // 一度でもスタートしたか
  running: false,   // 今カウントしているか（一時停止中は false）
  finished: false,  // 最後まで終わったか

  // 最後に「ピッ」を鳴らした秒数（同じ秒に何度も鳴らさないため）
  lastBeepSecond: null,

  // 今のブロックのゲージを指で動かしているか（scrub.js）
  scrubbing: false,
};
