# API リファレンス

## 概要

Pomodoro Focus アプリケーションのREST APIドキュメント。すべてのエンドポイントはJSON形式でデータを送受信します。

## エンドポイント一覧

### `POST /api/sessions`

新しいポモドーロセッションを記録します。

#### リクエスト

**ヘッダー:**
```
Content-Type: application/json
```

**ボディ:**
```json
{
  "start_time": "2026-02-24T10:00:00.000Z",
  "end_time": "2026-02-24T10:25:00.000Z",
  "duration_sec": 1500,
  "type": "work"
}
```

**フィールド:**

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `start_time` | string | ✓ | セッション開始時刻（ISO 8601形式）。末尾 "Z" または "+00:00" 形式に対応 |
| `end_time` | string | ✓ | セッション終了時刻（ISO 8601形式）。末尾 "Z" または "+00:00" 形式に対応 |
| `duration_sec` | integer | ✓ | セッション継続時間（秒）。0以上の整数 |
| `type` | string | ✓ | セッションタイプ。`"work"` または `"break"` |

#### レスポンス

**成功時 (201 Created):**
```json
{
  "id": 42
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | integer | 作成されたセッションのID |

**エラー時 (400 Bad Request):**

```json
{
  "error": "Missing required fields"
}
```

**バリデーションエラー:**

| エラーメッセージ | 条件 |
|-----------------|------|
| `"Missing required fields"` | 必須フィールドが不足している |
| `"Invalid datetime format"` | 日時フォーマットが不正 |
| `"Invalid duration"` | duration_sec が整数でない |
| `"Invalid session type"` | type が "work" または "break" でない |
| `"Duration must be non-negative"` | duration_sec が負の値 |
| `"End time must be after start time"` | end_time が start_time より前 |

#### 実装の詳細

- **日時の正規化**: 末尾 "Z" 付きISO文字列（例: `2026-02-24T10:00:00.000Z`）は自動的に `+00:00` 形式に変換されます
- **タイムゾーン処理**: タイムゾーン付きの日時はUTCに変換され、データベースにはタイムゾーン情報なし（naive datetime）のUTC時刻として保存されます
- **保存形式**: データベースには秒精度のISO形式文字列（例: `2026-02-24T10:00:00`）で保存されます

---

### `GET /api/stats`

指定した日付の統計情報を取得します。

#### リクエスト

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `date` | string | - | 取得する日付（YYYY-MM-DD形式）。省略時は今日の日付 |

**例:**
```
GET /api/stats?date=2026-02-24
GET /api/stats
```

#### レスポンス

**成功時 (200 OK):**
```json
{
  "date": "2026-02-24",
  "completed_sessions": 4,
  "focus_seconds": 6000,
  "focus_minutes": 100
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `date` | string | 統計対象の日付（ISO 8601形式：YYYY-MM-DD） |
| `completed_sessions` | integer | 完了したワークセッション数（type="work"のみカウント） |
| `focus_seconds` | integer | 合計集中時間（秒） |
| `focus_minutes` | integer | 合計集中時間（分）。focus_seconds を60で割った整数値 |

**エラー時 (400 Bad Request):**
```json
{
  "error": "Invalid date format"
}
```

#### 実装の詳細

- **集計対象**: `type="work"` のセッションのみが集計されます。`type="break"` のセッションは除外されます
- **日付範囲**: 指定された日付の 00:00:00 から 23:59:59 まで（翌日の00:00:00未満）のセッションが対象
- **デフォルト値**: セッションが存在しない場合、`completed_sessions=0`, `focus_seconds=0`, `focus_minutes=0` が返されます

---

## 共通仕様

### Content-Type

すべてのリクエストとレスポンスは `application/json` 形式です。

### エラーレスポンス

すべてのエラーレスポンスは以下の形式です:

```json
{
  "error": "エラーメッセージ"
}
```

### 日時フォーマット

- **入力**: ISO 8601形式（例: `2026-02-24T10:00:00`, `2026-02-24T10:00:00.000Z`, `2026-02-24T10:00:00+09:00`）
- **出力**: ISO 8601形式（例: `2026-02-24`, `2026-02-24T10:00:00`）
- **タイムゾーン**: すべての日時はUTCで保存され、処理されます

### データベーススキーマ

```sql
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_sec INTEGER NOT NULL,
    type TEXT NOT NULL
);
```

- `start_time`, `end_time`: UTC時刻のISO形式文字列（タイムゾーン情報なし、秒精度）
- `duration_sec`: セッション継続時間（秒）
- `type`: セッションタイプ（"work" または "break"）
