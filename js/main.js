/* ============================================================
   main.js ― はじめに動く処理
   ------------------------------------------------------------
   全部のファイルが読み込まれたあと、最後にここが実行されます。
   1. ボタンを押したときの動きを登録する
   2. 保存されていたメニューを読み込む
   3. 画面を表示する
   ============================================================ */


/* ---------- 1. ボタンの動きを登録 ---------- */

// 下の操作ボタン
$("playBtn").addEventListener("click", function () {
  if (state.running) {
    pauseTimer();
  } else {
    stopSelecting();
    dismissUndoToast();
    startTimer();
  }
});
$("nextBtn").addEventListener("click", nextStep);
$("prevBtn").addEventListener("click", prevStep);
$("resetBtn").addEventListener("click", openResetConfirm);

// メニューボタン
$("menuBtn").addEventListener("click", openMenu);

// ブロックの図（中のどこをタップしても、ここで受け取る）
$("plan").addEventListener("click", handlePlanClick);

// ドラッグ＆ドロップ
setupDrag();

// 複数選択のボタン
$("wrapBtn").addEventListener("click", wrapSelected);
$("selectCancelBtn").addEventListener("click", stopSelecting);

// マイセットの中身を編集しているときの帯のボタン
$("presetSaveBtn").addEventListener("click", function () { finishPresetEdit(true); });
$("presetCancelBtn").addEventListener("click", function () { finishPresetEdit(false); });

// パネルの外側をタップ、または Esc キーでパネルを閉じる
$("scrim").addEventListener("click", closeSheet);
$("sheetCloseBtn").addEventListener("click", closeSheet);
document.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") return;
  if (drag.pointerId !== null) cancelDrag();
  else if (isSheetOpen()) closeSheet();
  else stopSelecting();
});

// 別のアプリから戻ってきたとき
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible" && state.running) {
    keepScreenOn();  // 画面を消さない設定は、切り替えると外れるのでかけ直す
    recoverAudio();  // 止まった音を復帰させる
    tick();          // 止まっていた間の時間を、すぐに反映する
  }
});

// ブラウザの「戻る」やアプリの切り替えで、ページがそのまま復元されたとき
window.addEventListener("pageshow", function (event) {
  if (!event.persisted || !state.running) return;
  keepScreenOn();
  recoverAudio();
  cancelAnimationFrame(frameId);
  loop();
});

// 通話などから画面に戻ったとき
window.addEventListener("focus", recoverAudio);

// 音が止まっていたら、次に画面を触ったときに再開する
setupAudioRecovery();

// ホーム画面に追加できるようにする（ファイルを直接開いたときは使えないので読み込まない）
if (location.protocol === "http:" || location.protocol === "https:") {
  const manifestLink = document.createElement("link");
  manifestLink.rel = "manifest";
  manifestLink.href = "manifest.webmanifest";
  document.head.append(manifestLink);
}

// 「自動」のときは、端末のライト・ダークの変更についていく
darkModeQuery.addEventListener("change", applyTheme);


/* ---------- 2. 保存されていたメニューを読み込む ---------- */

const loaded = loadState();
if (!loaded) {
  state.presets = makeDefaultPresets();
  state.plan = normalizePlan(state.presets[0].plan);  // 初めて開いたときは、最初のマイセットを使う
}


/* ---------- 3. 画面を表示 ---------- */

applyTheme();
buildRunList();
renderPlan();
