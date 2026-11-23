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
    startTimer();
  }
});
$("nextBtn").addEventListener("click", nextStep);
$("prevBtn").addEventListener("click", prevStep);
$("resetBtn").addEventListener("click", function () {
  resetTimer();
  showToast("最初に戻しました");
});

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
    tick();          // 止まっていた間の時間を、すぐに反映する
  }
});


/* ---------- 2. 保存されていたメニューを読み込む ---------- */

const loaded = loadState();
if (!loaded) {
  state.presets = makeDefaultPresets();
  state.plan = normalizePlan(state.presets[0].plan);  // 初めて開いたときは、最初のマイセットを使う
}


/* ---------- 3. 画面を表示 ---------- */

buildRunList();
renderPlan();
