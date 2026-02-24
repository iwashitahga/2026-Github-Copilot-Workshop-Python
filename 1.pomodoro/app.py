import os
import sqlite3
from datetime import date, datetime, timedelta, timezone

from flask import Flask, jsonify, render_template, request, g


def create_app(test_config=None):
	app = Flask(__name__, static_folder="static", template_folder="templates")

	default_db_path = os.path.join(app.instance_path, "pomodoro.sqlite")
	app.config.from_mapping(
		DATABASE_PATH=os.environ.get("POMODORO_DB_PATH", default_db_path),
		JSON_SORT_KEYS=False,
	)

	if test_config:
		app.config.update(test_config)

	os.makedirs(app.instance_path, exist_ok=True)

	def get_db():
		if "db" not in g:
			g.db = sqlite3.connect(app.config["DATABASE_PATH"])
			g.db.row_factory = sqlite3.Row
		return g.db

	def close_db(_error=None):
		db = g.pop("db", None)
		if db is not None:
			db.close()

	def init_db():
		db = get_db()
		db.execute(
			"""
			CREATE TABLE IF NOT EXISTS sessions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				start_time TEXT NOT NULL,
				end_time TEXT NOT NULL,
				duration_sec INTEGER NOT NULL,
				type TEXT NOT NULL
			)
			"""
		)
		db.commit()

	with app.app_context():
		init_db()

	app.teardown_appcontext(close_db)

	@app.get("/")
	def index():
		return render_template("index.html")

	@app.post("/api/sessions")
	def create_session():
		data = request.get_json(silent=True) or {}
		required_fields = {"start_time", "end_time", "duration_sec", "type"}
		if not required_fields.issubset(data.keys()):
			return jsonify({"error": "Missing required fields"}), 400

		def _normalize_iso_z(dt_str):
			# フロントエンドから送られてくる "2026-02-24T10:00:00.000Z" のような
			# 末尾 "Z" 付きISO文字列を、datetime.fromisoformat が解釈できる
			# "+00:00" 付きの文字列に正規化する。
			if isinstance(dt_str, str) and dt_str.endswith("Z"):
				return dt_str[:-1] + "+00:00"
			return dt_str

		try:
			start_time = datetime.fromisoformat(_normalize_iso_z(data["start_time"]))
			end_time = datetime.fromisoformat(_normalize_iso_z(data["end_time"]))
		except (TypeError, ValueError):
			return jsonify({"error": "Invalid datetime format"}), 400

		try:
			duration_sec = int(data["duration_sec"])
		except (TypeError, ValueError):
			return jsonify({"error": "Invalid duration"}), 400

		session_type = data.get("type")
		if session_type not in {"work", "break"}:
			return jsonify({"error": "Invalid session type"}), 400

		if duration_sec < 0:
			return jsonify({"error": "Duration must be non-negative"}), 400

		if end_time < start_time:
			return jsonify({"error": "End time must be after start time"}), 400

		# UTC正規化: タイムゾーン付きの場合はUTCに変換、naiveの場合はUTCと見なす
		def _to_utc(dt):
			if dt.tzinfo is not None:
				return dt.astimezone(timezone.utc).replace(tzinfo=None)
			return dt

		start_time_utc = _to_utc(start_time)
		end_time_utc = _to_utc(end_time)

		db = get_db()
		cursor = db.execute(
			"""
			INSERT INTO sessions (start_time, end_time, duration_sec, type)
			VALUES (?, ?, ?, ?)
			""",
			(
				start_time_utc.isoformat(timespec="seconds"),
				end_time_utc.isoformat(timespec="seconds"),
				duration_sec,
				session_type,
			),
		)
		db.commit()

		return jsonify({"id": cursor.lastrowid}), 201

	@app.get("/api/stats")
	def get_stats():
		date_param = request.args.get("date")
		try:
			target_date = (
				datetime.strptime(date_param, "%Y-%m-%d").date()
				if date_param
				else date.today()
			)
		except ValueError:
			return jsonify({"error": "Invalid date format"}), 400

		day_start = datetime.combine(target_date, datetime.min.time())
		day_end = day_start + timedelta(days=1)

		db = get_db()
		row = db.execute(
			"""
			SELECT COUNT(*) AS completed_sessions,
				   COALESCE(SUM(duration_sec), 0) AS focus_seconds
			FROM sessions
			WHERE type = ? AND end_time >= ? AND end_time < ?
			""",
			(
				"work",
				day_start.isoformat(timespec="seconds"),
				day_end.isoformat(timespec="seconds"),
			),
		).fetchone()

		focus_seconds = int(row["focus_seconds"])
		return jsonify(
			{
				"date": target_date.isoformat(),
				"completed_sessions": int(row["completed_sessions"]),
				"focus_seconds": focus_seconds,
				"focus_minutes": focus_seconds // 60,
			}
		)

	return app


app = create_app()


if __name__ == "__main__":
	debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
	app.run(debug=debug_mode)
