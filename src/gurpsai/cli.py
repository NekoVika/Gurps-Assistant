from __future__ import annotations

import argparse


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="gurpsai", description="GURPS AI local app utilities")
    sub = parser.add_subparsers(dest="command")

    serve = sub.add_parser("serve", help="Run the local FastAPI backend")
    serve.add_argument("--host", default="127.0.0.1", help="Host interface to bind (default: 127.0.0.1)")
    serve.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    serve.add_argument("--reload", action="store_true", help="Enable autoreload for local development")

    return parser


def console_main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "serve":
        try:
            import uvicorn
        except ImportError as exc:
            raise SystemExit(
                "uvicorn is not installed. Install backend dependencies before running `gurpsai serve`."
            ) from exc

        uvicorn.run(
            "gurpsai.api.main:create_app",
            host=args.host,
            port=args.port,
            reload=bool(args.reload),
            factory=True,
        )
        return 0

    parser.print_help()
    return 0
