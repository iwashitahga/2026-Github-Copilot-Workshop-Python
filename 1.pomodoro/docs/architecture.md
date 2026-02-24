# アーキテクチャ

## 概要

Pomodoro Focus は、Flask をバックエンド、Vanilla JavaScript をフロントエンドとして構築されたシンプルなポモドーロタイマーアプリケーションです。

## 技術スタック

### バックエンド

- **言語**: Python 3.x
- **フレームワーク**: Flask
- **データベース**: SQLite3
- **パターン**: アプリケーションファクトリパターン

### フロントエンド

- **言語**: JavaScript (ES6 Modules)
- **スタイル**: CSS3 with Custom Properties
- **アーキテクチャ**: ステートマシンパターン

## プロジェクト構成

```
1.pomodoro/
├── app.py                    # Flask アプリケーション（メインエントリポイント）
├── static/
│   ├── app.js               # メインアプリケーションロジック
│   ├── timer_state.js       # タイマーステートマシン
│   └── styles.css           # スタイルシート
├── templates/
│   └── index.html           # SPAのHTMLテンプレート
├── tests/
│   ├── test_api.py          # APIエンドポイントのテスト
│   └── frontend_state.test.mjs  # フロントエンドステートのテスト
└── docs/                    # ドキュメント
```

## アーキテクチャパターン

### バックエンド: アプリケーションファクトリパターン

`app.py` は Flask のアプリケーションファクトリパターンを採用しています:

```python
def create_app(test_config=None):
    app = Flask(__name__)
    # 設定の読み込み
    # データベースの初期化
    # ルーティングの定義
    return app
```

**利点:**
- テスト時に異なる設定のアプリケーションインスタンスを作成可能
- 複数のアプリケーションインスタンスを同時に実行可能

### データアクセス: Flask の `g` オブジェクト

データベース接続はリクエストごとに管理されます:

- `get_db()`: リクエストごとにデータベース接続を取得（初回のみ接続を作成）
- `close_db()`: リクエスト終了時に接続をクローズ（`@app.teardown_appcontext` で自動実行）

### フロントエンド: ステートマシンパターン

`timer_state.js` は有限ステートマシンを実装しています:

**状態 (TimerStatus):**
- `IDLE`: 初期状態
- `RUNNING`: タイマー実行中
- `PAUSED`: 一時停止中
- `COMPLETED`: 完了

**操作:**
- `start()`: タイマーを開始
- `pause()`: タイマーを一時停止
- `reset()`: タイマーをリセット
- `complete()`: タイマーを完了
- `setMode()`: モード切り替え（work/break）
- `setRemaining()`: 残り時間を更新
- `snapshot()`: 現在の状態を取得

**モード:**
- `work`: 作業モード（デフォルト25分）
- `break`: 休憩モード（デフォルト5分）

## データフロー

### セッション作成フロー

```
1. ユーザーがタイマーを開始
   ↓
2. フロントエンド: タイマーが完了するまで実行
   ↓
3. タイマー完了時: POST /api/sessions
   - start_time: セッション開始時刻
   - end_time: 現在時刻
   - duration_sec: 設定時間（秒）
   - type: "work" または "break"
   ↓
4. バックエンド:
   - ISO文字列を正規化（"Z" → "+00:00"）
   - datetime オブジェクトに変換
   - UTC に正規化
   - データベースに保存（UTC naive datetime）
   ↓
5. レスポンス: { "id": 42 }
   ↓
6. フロントエンド: GET /api/stats で統計を更新
```

### 統計取得フロー

```
1. フロントエンド: GET /api/stats?date=YYYY-MM-DD
   ↓
2. バックエンド:
   - 日付範囲を計算（00:00:00 ～ 翌日00:00:00未満）
   - type="work" のセッションを集計
   - 完了セッション数と合計秒数を計算
   ↓
3. レスポンス:
   {
     "date": "2026-02-24",
     "completed_sessions": 4,
     "focus_seconds": 6000,
     "focus_minutes": 100
   }
   ↓
4. フロントエンド: UIを更新
```

## 状態管理

### フロントエンド状態

`timer_state.js` のステートマシンが管理:

```javascript
const state = {
  mode: "work",              // "work" | "break"
  status: TimerStatus.IDLE,  // IDLE | RUNNING | PAUSED | COMPLETED
  totalSeconds: 1500,        // モードごとの合計秒数
  remainingSeconds: 1500     // 残り秒数
};
```

### UI状態 (`app.js`)

- `timerId`: setInterval のID
- `endTimestamp`: タイマー終了予定時刻（ミリ秒）
- `sessionStart`: セッション開始時刻（Date オブジェクト）
- `audioContext`: Web Audio API のコンテキスト

### サーバー状態

- SQLite データベースに永続化されたセッション記録
- リクエストスコープのデータベース接続（`g.db`）

## UI/UXデザイン

### ビジュアルデザイン

- **カラーパレット**: CSS Custom Properties で定義
  - `--ink`: テキストカラー (#1d1a16)
  - `--accent`: プライマリアクセント (#ff6b6b)
  - `--accent-2`: セカンダリアクセント (#ffb26b)
  - `--surface`: カード背景 (#fff8f1)

- **タイポグラフィ**:
  - メインフォント: Space Grotesk
  - 見出しフォント: Fraunces

- **レイアウト**: CSS Grid と Flexbox
  - レスポンシブデザイン（モバイルファーストアプローチ）
  - 最大幅: 1100px

### インタラクション

- **進捗リング**: SVG ストロークアニメーション
  - stroke-dashoffset で進捗を表現
  - グラデーション付き（`#ffb26b` → `#ff6b6b`）

- **通知**: Web Notifications API
  - タイマー完了時に通知を表示
  - 初回開始時に通知許可をリクエスト

- **サウンド**: Web Audio API
  - タイマー完了時にビープ音を再生
  - AudioContext を使用した合成音

## セキュリティ考慮事項

### 入力バリデーション

すべてのユーザー入力は厳格にバリデーションされます:

- 必須フィールドの存在確認
- データ型の検証（整数、文字列）
- 値の範囲チェック（duration_sec >= 0, end_time > start_time）
- 列挙型の検証（type は "work" または "break" のみ）

### データベース

- SQLite のパラメータ化クエリを使用（SQLインジェクション対策）
- データベースファイルはインスタンスフォルダに保存

### フロントエンド

- Content Security Policy（将来の拡張として検討可能）
- XSS対策: innerHTML を使用せず、textContent を使用

## パフォーマンス

### フロントエンド

- **タイマー更新頻度**: 250ms（4 FPS）
  - UIの滑らかさとCPU使用率のバランス
  
- **ステート更新**: Immutable パターン
  - `snapshot()` は状態のコピーを返す

### バックエンド

- **データベース接続**: リクエストごとに1接続
  - `g` オブジェクトでリクエストスコープの接続を管理
  
- **インデックス**: 現状なし（将来の拡張として end_time にインデックス追加を検討）

## 拡張性

現在のアーキテクチャは以下の拡張に対応しやすい設計です:

1. **データモデルの拡張**: ユーザー認証、タグ付け、メモ機能
2. **統計機能の強化**: 週次/月次統計、グラフ表示
3. **カスタマイズ**: タイマー時間のカスタマイズ、テーマ切り替え
4. **データエクスポート**: CSV/JSON エクスポート機能
5. **永続化の強化**: PostgreSQL などへの移行

## テスト戦略

### バックエンドテスト (`tests/test_api.py`)

- **ツール**: Python unittest
- **スコープ**: APIエンドポイントの統合テスト
- **テストケース**:
  - セッション作成と統計取得の正常系
  - バリデーションエラー（負の値、不正な型）
  - "Z" 付きISO文字列の処理
  - break セッションが統計に含まれないことの確認

### フロントエンドテスト (`tests/frontend_state.test.mjs`)

- **ツール**: Node.js (ES Modules)
- **スコープ**: ステートマシンのユニットテスト
- **実行**: `node tests/frontend_state.test.mjs`

## 設定管理

### 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `POMODORO_DB_PATH` | データベースファイルのパス | `instance/pomodoro.sqlite` |
| `FLASK_DEBUG` | デバッグモードの有効化 | `0` (無効) |

### アプリケーション設定

```python
app.config.from_mapping(
    DATABASE_PATH=os.environ.get("POMODORO_DB_PATH", default_db_path),
    JSON_SORT_KEYS=False,  # JSONレスポンスのキー順序を保持
)
```

テスト時は `create_app(test_config)` で設定を上書き可能。
