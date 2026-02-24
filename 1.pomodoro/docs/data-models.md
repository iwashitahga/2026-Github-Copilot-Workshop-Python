# データモデル

## 概要

Pomodoro Focus アプリケーションのデータモデル仕様。

## データベーススキーマ

### sessions テーブル

ポモドーロセッションの記録を保存します。

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_sec INTEGER NOT NULL,
    type TEXT NOT NULL
);
```

#### カラム仕様

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | セッションの一意識別子 |
| `start_time` | TEXT | NOT NULL | セッション開始時刻（UTC、ISO形式、秒精度） |
| `end_time` | TEXT | NOT NULL | セッション終了時刻（UTC、ISO形式、秒精度） |
| `duration_sec` | INTEGER | NOT NULL | セッション継続時間（秒） |
| `type` | TEXT | NOT NULL | セッションタイプ（"work" または "break"） |

#### データ例

```sql
INSERT INTO sessions (start_time, end_time, duration_sec, type)
VALUES ('2026-02-24T10:00:00', '2026-02-24T10:25:00', 1500, 'work');

INSERT INTO sessions (start_time, end_time, duration_sec, type)
VALUES ('2026-02-24T10:25:00', '2026-02-24T10:30:00', 300, 'break');
```

### 日時フォーマット

**データベース保存形式:**
- ISO 8601形式の文字列（例: `2026-02-24T10:00:00`）
- タイムゾーン情報なし（naive datetime）
- すべてUTC時刻として保存
- 秒精度（ミリ秒は切り捨て）

**API入力形式:**
- ISO 8601形式（例: `2026-02-24T10:00:00`, `2026-02-24T10:00:00.000Z`, `2026-02-24T10:00:00+09:00`）
- タイムゾーン付き・なし両方に対応
- 末尾 "Z" 付きフォーマットに対応（フロントエンドから送信される形式）

**変換処理:**

1. フロントエンドから "Z" 付きISO文字列を受信（例: `2026-02-24T10:00:00.000Z`）
2. `_normalize_iso_z()` で "+00:00" 形式に正規化（例: `2026-02-24T10:00:00.000+00:00`）
3. `datetime.fromisoformat()` でパース
4. `_to_utc()` でUTCに変換し、タイムゾーン情報を削除
5. `.isoformat(timespec="seconds")` で秒精度のISO文字列に変換
6. データベースに保存

## フロントエンドのデータモデル

### タイマー状態 (TimerState)

```javascript
const state = {
  mode: "work",              // "work" | "break"
  status: TimerStatus.IDLE,  // "idle" | "running" | "paused" | "completed"
  totalSeconds: 1500,        // モードごとの合計秒数
  remainingSeconds: 1500     // 残り秒数
};
```

#### mode (モード)

| 値 | 説明 | デフォルト秒数 |
|----|------|---------------|
| `"work"` | 作業モード | 1500秒（25分） |
| `"break"` | 休憩モード | 300秒（5分） |

#### status (ステータス)

| 値 | 説明 | 遷移可能な状態 |
|----|------|---------------|
| `"idle"` | 初期状態、未開始 | → `running` |
| `"running"` | タイマー実行中 | → `paused`, `completed` |
| `"paused"` | 一時停止中 | → `running`, `idle` (reset) |
| `"completed"` | 完了 | → `running` (restart) |

### ステートマシン遷移図

```
       ┌──────┐
       │ IDLE │
       └──┬───┘
          │ start()
          ▼
     ┌─────────┐
     │ RUNNING │◄─┐
     └────┬────┘  │
          │       │ start()
    pause()│       │
          ▼       │
     ┌────────┐   │
     │ PAUSED ├───┘
     └────┬───┘
          │ reset()
          ▼
       ┌──────┐
       │ IDLE │
       └──────┘

     RUNNING
          │
          │ time expires
          ▼
    ┌───────────┐
    │ COMPLETED │
    └─────┬─────┘
          │ start()
          ▼
     ┌─────────┐
     │ RUNNING │
     └─────────┘
```

### API通信のデータ型

#### セッション作成リクエスト

```typescript
interface SessionCreateRequest {
  start_time: string;     // ISO 8601形式（例: "2026-02-24T10:00:00.000Z"）
  end_time: string;       // ISO 8601形式（例: "2026-02-24T10:25:00.000Z"）
  duration_sec: number;   // 秒数（整数）
  type: "work" | "break"; // セッションタイプ
}
```

#### セッション作成レスポンス

```typescript
interface SessionCreateResponse {
  id: number;  // 作成されたセッションのID
}
```

#### 統計取得レスポンス

```typescript
interface StatsResponse {
  date: string;               // YYYY-MM-DD形式
  completed_sessions: number; // 完了したワークセッション数
  focus_seconds: number;      // 合計集中秒数
  focus_minutes: number;      // 合計集中分数（focus_seconds / 60 の整数値）
}
```

## バリデーションルール

### sessions テーブル

#### start_time

- **型**: ISO 8601形式の日時文字列
- **必須**: はい
- **フォーマット**: `YYYY-MM-DDTHH:MM:SS` または `YYYY-MM-DDTHH:MM:SS.sssZ` または `YYYY-MM-DDTHH:MM:SS+HH:MM`
- **検証**: `datetime.fromisoformat()` でパース可能であること

#### end_time

- **型**: ISO 8601形式の日時文字列
- **必須**: はい
- **フォーマット**: start_time と同様
- **検証**: 
  - `datetime.fromisoformat()` でパース可能であること
  - start_time より後であること（`end_time > start_time`）

#### duration_sec

- **型**: 整数
- **必須**: はい
- **範囲**: 0以上（`duration_sec >= 0`）
- **検証**: `int()` で変換可能であること

#### type

- **型**: 文字列
- **必須**: はい
- **許可値**: `"work"`, `"break"`
- **検証**: 上記2つの値のいずれかであること

### API エラーレスポンス

バリデーション失敗時は 400 Bad Request を返し、エラーメッセージを含むJSONレスポンスを返します:

```json
{
  "error": "エラーの詳細"
}
```

#### エラーメッセージ一覧

| エラーメッセージ | 原因 |
|-----------------|------|
| `"Missing required fields"` | start_time, end_time, duration_sec, type のいずれかが欠落 |
| `"Invalid datetime format"` | start_time または end_time が不正な日時フォーマット |
| `"Invalid duration"` | duration_sec が整数に変換できない |
| `"Invalid session type"` | type が "work" または "break" でない |
| `"Duration must be non-negative"` | duration_sec が負の値 |
| `"End time must be after start time"` | end_time が start_time より前 |
| `"Invalid date format"` | `/api/stats` の date パラメータが YYYY-MM-DD 形式でない |

## データ型の対応表

### Python ↔ SQLite

| Python型 | SQLite型 | 説明 |
|---------|---------|------|
| `str` (datetime.isoformat()) | TEXT | 日時文字列 |
| `int` | INTEGER | 整数値 |
| `str` | TEXT | 文字列（type） |

### JavaScript ↔ API

| JavaScript型 | JSON型 | 説明 |
|-------------|--------|------|
| `Date.toISOString()` | string | ISO 8601形式の日時文字列（"Z" 付き） |
| `number` | number | 整数値 |
| `string` | string | 文字列 |

## データ整合性

### セッションデータ

- **duration_sec**: `(end_time - start_time)` の秒数と一致することが推奨されますが、強制はされません
  - フロントエンドは設定された時間（25分または5分）を送信
  - 実際の経過時間とは異なる場合があります（一時停止、早期終了など）

### 統計データ

- **集計対象**: `type="work"` のセッションのみ
- **日付範囲**: UTC時刻で指定日の 00:00:00 ～ 翌日00:00:00 未満
- **NULL処理**: セッションが存在しない場合は 0 を返す（`COALESCE(SUM(duration_sec), 0)`）

## 将来の拡張

現在のスキーマは以下の拡張に対応しやすい設計です:

1. **ユーザー管理**: `user_id` カラムの追加
2. **タグ付け**: `tags` テーブルと多対多リレーション
3. **メモ機能**: `note` TEXT カラムの追加
4. **中断理由**: `interruption_reason` TEXT カラムの追加
5. **目標設定**: `goals` テーブルの追加
6. **インデックス**: `end_time` カラムにインデックス追加（統計クエリの高速化）
