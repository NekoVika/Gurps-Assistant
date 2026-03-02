def _paused_main() -> int:
    msg = (
        "GURPSAI CLI is temporarily on hold.\n"
        "Focus: AI GM workflows and content. Distribute updates via git.\n"
        "Refer to AGENTS.md and SYSTEM.md for workflow and persona usage."
    )
    print(msg)
    return 0


if __name__ == "__main__":
    raise SystemExit(_paused_main())
