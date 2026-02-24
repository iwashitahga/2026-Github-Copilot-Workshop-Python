# フロントエンド

## 概要

Pomodoro Focus のフロントエンドは Vanilla JavaScript (ES6 Modules) で構築されており、ビルドツールを使用しないシンプルな構成です。

## ファイル構成

```
static/
├── app.js           # メインアプリケーションロジック、UI制御
├── timer_state.js   # タイマーステートマシン
└── styles.css       # スタイルシート
```

## モジュール構成

### timer_state.js - ステートマシン

タイマーのビジネスロジックを管理するステートマシンモジュール。

#### エクスポート

##### `TimerStatus` オブジェクト

タイマーの状態を表す定数:

```javascript
export const TimerStatus = {
  IDLE: "idle",           // 初期状態、未開始
  RUNNING: "running",     // 実行中
  PAUSED: "paused",       // 一時停止中
  COMPLETED: "completed"  // 完了
};
```

##### `createTimerStateMachine(config)` 関数

ステートマシンインスタンスを作成します。

**パラメータ:**
```javascript
{
  workSeconds: number,   // 作業モードの秒数（例: 1500）
  breakSeconds: number   // 休憩モードの秒数（例: 300）
}
```

**戻り値:**

ステートマシンオブジェクト（以下のメソッドを持つ）:

- **`setMode(mode: string)`**: モードを変更（"work" または "break"）
  - 戻り値: 更新後の状態
  - 副作用: totalSeconds, remainingSeconds を新しいモードの値にリセット、ステータスを IDLE に変更

- **`start()`**: タイマーを開始
  - 戻り値: 更新後の状態
  - 副作用: ステータスを RUNNING に変更、COMPLETED 状態から開始する場合は remainingSeconds をリセット

- **`pause()`**: タイマーを一時停止
  - 戻り値: 更新後の状態
  - 副作用: ステータスを PAUSED に変更（RUNNING 状態の場合のみ）

- **`reset()`**: タイマーをリセット
  - 戻り値: 更新後の状態
  - 副作用: ステータスを IDLE に変更、remainingSeconds を totalSeconds にリセット

- **`complete()`**: タイマーを完了
  - 戻り値: 更新後の状態
  - 副作用: ステータスを COMPLETED に変更、remainingSeconds を 0 に設定

- **`setRemaining(seconds: number)`**: 残り時間を設定
  - 戻り値: 更新後の状態
  - 副作用: remainingSeconds を指定された値に設定（0 ～ totalSeconds の範囲にクランプ）

- **`snapshot()`**: 現在の状態のコピーを取得
  - 戻り値: 状態オブジェクトのコピー
  ```javascript
  {
    mode: "work" | "break",
    status: TimerStatus,
    totalSeconds: number,
    remainingSeconds: number
  }
  ```

**内部状態:**

```javascript
const state = {
  mode: "work",                   // 現在のモード
  status: TimerStatus.IDLE,       // 現在のステータス
  totalSeconds: modes.work,       // 現在のモードの合計秒数
  remainingSeconds: modes.work    // 残り秒数
};
```

---

### app.js - メインアプリケーション

UI制御、イベント処理、API通信を担当します。

#### 定数

```javascript
const WORK_SECONDS = 25 * 60;    // 作業時間: 1500秒（25分）
const BREAK_SECONDS = 5 * 60;    // 休憩時間: 300秒（5分）
const RING_LENGTH = 540;         // SVGストロークの円周長
```

#### グローバル変数

```javascript
let timerId = null;        // setInterval のID
let endTimestamp = null;   // タイマー終了予定時刻（ミリ秒）
let sessionStart = null;   // セッション開始時刻（Date オブジェクト）
let audioContext = null;   // Web Audio API のコンテキスト
```

#### 主要な関数

##### UI 更新系

- **`formatTime(seconds)`**: 秒数を "MM:SS" 形式の文字列に変換
  ```javascript
  formatTime(125) // => "02:05"
  ```

- **`updateRing(remainingSeconds, totalSeconds)`**: 進捗リングの表示を更新
  - SVG の `stroke-dashoffset` を計算して進捗を表現

- **`updateUI()`**: 全UIコンポーネントを更新
  - 時間表示、ステータステキスト、モードテキスト、進捗リング、ボタン状態を更新

- **`syncModeButtons(mode)`**: モード切り替えボタンの状態を同期
  - `aria-pressed` 属性を更新してアクティブ状態を表現

##### タイマー制御系

- **`startTimer()`**: タイマーを開始
  - ステートマシンの `start()` を呼び出し
  - 初回またはリセット後の場合、sessionStart を記録
  - endTimestamp を計算
  - 250ms間隔で `tick()` を実行する setInterval を開始

- **`pauseTimer()`**: タイマーを一時停止
  - ステートマシンの `pause()` を呼び出し
  - setInterval を停止
  - 現在の残り時間を計算してステートマシンに反映

- **`resetTimer()`**: タイマーをリセット
  - ステートマシンの `reset()` を呼び出し
  - sessionStart をクリア
  - setInterval を停止

- **`completeTimer()`**: タイマーを完了
  - ステートマシンの `complete()` を呼び出し
  - setInterval を停止
  - 完了通知を表示
  - セッションを保存してから統計を更新（`saveSession().then(() => fetchStats())`）

- **`tick()`**: タイマー更新処理（250ms間隔で実行）
  - 現在時刻と endTimestamp から残り秒数を計算
  - ステートマシンの `setRemaining()` で状態を更新
  - UI を更新
  - 残り時間が0になったら `completeTimer()` を呼び出し

##### 通知・サウンド系

- **`requestNotifications()`**: 通知権限をリクエスト
  - ブラウザが通知をサポートしていない場合は "Notifications not supported"
  - 既に許可されている場合は "Notifications on"
  - デフォルト状態の場合は `Notification.requestPermission()` を呼び出し

- **`notifyCompletion()`**: 完了通知を表示
  - Web Notifications API でデスクトップ通知を表示
  - `playBeep()` でビープ音を再生

- **`ensureAudioContext()`**: AudioContext を初期化
  - 初回のみ AudioContext を作成
  - suspended 状態の場合は resume

- **`playBeep()`**: ビープ音を再生
  - Web Audio API で合成音を生成（640Hz の正弦波）
  - 音量を exponentialRampToValueAtTime でフェードイン・フェードアウト
  - 約0.35秒間再生

##### API通信系

- **`saveSession()`**: セッションをサーバーに保存
  - POST /api/sessions にセッション情報を送信
  - 戻り値: Promise（エラー時も resolve）
  - ペイロード:
    ```javascript
    {
      start_time: sessionStart.toISOString(),  // "YYYY-MM-DDTHH:MM:SS.sssZ"
      end_time: new Date().toISOString(),
      duration_sec: snapshot.totalSeconds,
      type: snapshot.mode  // "work" | "break"
    }
    ```
  - sessionStart をクリア

- **`fetchStats()`**: 統計情報を取得
  - GET /api/stats?date=YYYY-MM-DD から今日の統計を取得
  - UI の完了セッション数と集中分数を更新

#### イベントリスナー

##### モード切り替えボタン

```javascript
modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;  // "work" または "break"
    stateMachine.setMode(mode);
    syncModeButtons(mode);
    resetTimer();
    updateUI();
  });
});
```

##### 制御ボタン

```javascript
startBtn.addEventListener("click", () => {
  ensureAudioContext();
  requestNotifications();
  startTimer();
});

pauseBtn.addEventListener("click", pauseTimer);
resetBtn.addEventListener("click", resetTimer);
```

#### 初期化処理

```javascript
updateUI();      // 初期UI状態を表示
fetchStats();    // 初期統計データを取得
```

---

### styles.css - スタイルシート

#### CSS カスタムプロパティ

```css
:root {
  --ink: #1d1a16;           /* テキストカラー */
  --muted: #5c5148;         /* ミュートテキスト */
  --accent: #ff6b6b;        /* プライマリアクセント */
  --accent-2: #ffb26b;      /* セカンダリアクセント */
  --surface: #fff8f1;       /* カード背景 */
  --surface-2: #f3ede6;     /* セカンダリ背景 */
  --shadow: 0 24px 60px rgba(33, 25, 16, 0.15);
  --radius-lg: 28px;        /* 大きい角丸 */
  --radius-md: 18px;        /* 中くらいの角丸 */
}
```

#### レイアウト構造

- **`.page`**: メインコンテナ（max-width: 1100px、中央揃え）
- **`.hero`**: ヘッダーセクション（タイトル、説明、モード切り替え）
- **`.grid`**: カードグリッド（CSS Grid、レスポンシブ）
- **`.card`**: カードコンポーネント（背景、角丸、シャドウ）

#### 主要なコンポーネント

##### タイマーリング

```css
.ring {
  position: relative;
  width: min(320px, 80vw);  /* レスポンシブサイズ */
  aspect-ratio: 1;
  display: grid;
  place-items: center;
}

.ring svg {
  transform: rotate(-90deg);  /* 12時位置から開始 */
}

.ring-progress {
  stroke: url(#ringGradient);  /* グラデーション */
  stroke-dasharray: 540;       /* 円周長 */
  stroke-dashoffset: 0;        /* 進捗オフセット */
  transition: stroke-dashoffset 0.5s ease;
}
```

##### ボタンスタイル

- **`.primary`**: プライマリボタン（黒背景、白テキスト、シャドウ）
- **`.secondary`**: セカンダリボタン（グレー背景）
- **`.ghost`**: ゴーストボタン（透明背景、ミュートテキスト）
- **`:disabled`**: 無効状態（opacity: 0.6、cursor: not-allowed）

##### モード切り替えチップ

```css
.chip[aria-pressed="true"] {
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 8px 20px rgba(33, 25, 16, 0.12);
}
```

#### レスポンシブデザイン

```css
@media (max-width: 700px) {
  .hero {
    padding: 22px;
  }
  
  .actions {
    flex-direction: column;
    width: 100%;
  }
  
  .actions button {
    width: 100%;
  }
}
```

#### アニメーション

```css
@keyframes floatIn {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero {
  animation: floatIn 0.7s ease forwards;
}
```

---

## データフロー

### タイマー開始フロー

```
1. ユーザーが "Start" ボタンをクリック
   ↓
2. ensureAudioContext() - AudioContext を初期化
   ↓
3. requestNotifications() - 通知権限をリクエスト
   ↓
4. startTimer()
   - stateMachine.start() で状態を RUNNING に変更
   - sessionStart を記録（初回またはリセット後）
   - endTimestamp を計算
   - setInterval で 250ms ごとに tick() を実行
   ↓
5. tick() が繰り返し実行される
   - 残り秒数を計算
   - stateMachine.setRemaining() で状態を更新
   - updateUI() で表示を更新
   - 残り時間が 0 になったら completeTimer()
```

### タイマー完了フロー

```
1. tick() で残り時間が 0 になる
   ↓
2. completeTimer()
   - stateMachine.complete() でステータスを COMPLETED に変更
   - setInterval を停止
   - updateUI() で表示を更新
   - notifyCompletion() で通知とビープ音
   - saveSession() でセッションをサーバーに保存
   ↓
3. saveSession() が完了したら fetchStats()
   - POST /api/sessions でセッションを保存
   - GET /api/stats で統計を取得
   - UIの統計表示を更新
```

### モード切り替えフロー

```
1. ユーザーが "Work 25" または "Break 5" をクリック
   ↓
2. modeButtons イベントリスナー
   - button.dataset.mode から "work" または "break" を取得
   - stateMachine.setMode(mode) でモード変更
   - syncModeButtons(mode) でボタン状態を同期
   - resetTimer() でタイマーをリセット
   - updateUI() で表示を更新
```

## ブラウザAPI

### Web Notifications API

```javascript
if ("Notification" in window) {
  if (Notification.permission === "granted") {
    new Notification("Pomodoro complete", {
      body: "Nice work. Take a short break."
    });
  } else if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}
```

### Web Audio API

```javascript
const audioContext = new AudioContext();
const oscillator = audioContext.createOscillator();
const gainNode = audioContext.createGain();

oscillator.type = "sine";
oscillator.frequency.value = 640;  // Hz
gainNode.gain.value = 0.001;
gainNode.gain.exponentialRampToValueAtTime(0.4, audioContext.currentTime + 0.02);
gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

oscillator.connect(gainNode);
gainNode.connect(audioContext.destination);
oscillator.start();
oscillator.stop(audioContext.currentTime + 0.35);
```

### Fetch API

```javascript
// セッション作成
fetch("/api/sessions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});

// 統計取得
fetch(`/api/stats?date=${dateString}`)
  .then(response => response.json())
  .then(data => {
    // データを処理
  });
```

## アクセシビリティ

### ARIA属性

- **`role="group"`**: モード切り替えボタングループ
- **`aria-label="Timer mode"`**: ボタングループのラベル
- **`aria-pressed`**: ボタンの押下状態（"true" または "false"）
- **`aria-hidden="true"`**: 装飾的なSVGリング

### キーボード操作

すべてのボタンはネイティブ `<button>` 要素を使用しており、キーボード操作（Tab、Enter、Space）に対応しています。

### セマンティックHTML

```html
<main class="page">
  <header class="hero">...</header>
  <section class="grid">
    <article class="card timer-card">...</article>
    <article class="card stats-card">...</article>
  </section>
</main>
```

## パフォーマンス最適化

### タイマー更新頻度

250ms（4 FPS）の更新頻度でCPU使用率とUIの滑らかさのバランスを取っています。

### ステート管理

`snapshot()` メソッドで状態のコピーを返すことで、不変性（Immutability）を保ち、予期しない副作用を防いでいます。

### フォント読み込み

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

`preconnect` でフォントサーバーへの接続を事前に確立し、読み込み時間を短縮しています。

## テスト

### ステートマシンのテスト

`tests/frontend_state.test.mjs` でステートマシンのユニットテストを実施:

```bash
node tests/frontend_state.test.mjs
```

テスト内容:
- 状態遷移の正確性
- モード切り替えの動作
- 残り時間の更新とクランプ処理
- snapshot の不変性

## 将来の拡張

1. **カスタマイズ機能**: 作業時間・休憩時間のカスタマイズUI
2. **テーマ切り替え**: ダークモード、カラースキーム変更
3. **サウンドカスタマイズ**: 効果音の選択、音量調整
4. **履歴表示**: 過去のセッション一覧、グラフ表示
5. **オフライン対応**: Service Worker でオフライン動作
6. **PWA化**: manifest.json、インストール可能なアプリ
