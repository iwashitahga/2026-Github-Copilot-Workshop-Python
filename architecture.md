# Pomodoro Webアプリ アーキテクチャ案

## 目的
- 25分の作業タイマーと5分の休憩タイマーを提供する
- 開始・停止・リセットに対応する
- 進捗表示と統計機能を持つ
- ブラウザ通知とサウンド通知を行う
- レスポンシブなWeb UIを実現する

## 全体構成
- フロントエンド: HTML/CSS/JavaScript
- バックエンド: Flask
- データ保存: SQLite (単一ユーザ前提の最小構成)

## 主要コンポーネント

### フロントエンド
- タイマー制御: JavaScriptでカウントダウンを管理
- UI: モックに合わせたカード型レイアウト、円形プログレス
- 通知: Notification API と Web Audio/Audio要素でサウンド再生
- 進捗表示: 今日の完了数、合計集中時間
- レスポンシブ: 1カラム/2カラム切替、タップ操作に最適化

### バックエンド (Flask)
- ルーティング
  - GET / : メイン画面
  - POST /api/sessions : セッション記録
  - GET /api/stats?date=YYYY-MM-DD : 進捗/統計
- 入出力バリデーション: durationが負数にならないことなどを検証

### データ設計 (最小)
- sessions
  - id (PK)
  - start_time (datetime)
  - end_time (datetime)
  - duration_sec (int)
  - type ("work" | "break")

## タイマー仕様
- 作業: 25分
- 休憩: 5分
- 状態: idle -> running -> paused -> completed
- 完了時: セッションをAPIに送信、統計を更新

## 通知仕様
- ブラウザ通知: Notification API を利用
- サウンド通知: 事前にユーザー操作で音声再生の許可を取得

## 進捗・統計
- 今日の完了数
- 今日の集中時間合計 (分単位)

## セキュリティと拡張性
- 追加認証は将来対応 (最小構成では不要)
- DBは将来的にPostgreSQLへ移行可能な設計

## テスト方針 (最小)
- APIテスト: セッション登録と統計取得
- フロント: タイマー状態遷移と表示更新の簡易スモークテスト
