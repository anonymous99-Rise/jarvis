#!/usr/bin/env python3
"""Measure local faster-whisper load and transcription latency on one audio file."""

from __future__ import annotations

import argparse
import json
import platform
import time

from faster_whisper import WhisperModel


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("--model", default="tiny")
    args = parser.parse_args()

    load_started = time.perf_counter()
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    load_seconds = time.perf_counter() - load_started

    transcribe_started = time.perf_counter()
    segments, info = model.transcribe(
        args.audio,
        language="zh",
        beam_size=1,
        vad_filter=True,
        condition_on_previous_text=False,
        initial_prompt="简体中文语音。关键词：贾维斯。",
    )
    text = "".join(segment.text for segment in segments).strip()
    transcribe_seconds = time.perf_counter() - transcribe_started
    print(json.dumps({
        "architecture": platform.machine(),
        "model": args.model,
        "load_seconds": round(load_seconds, 3),
        "transcribe_seconds": round(transcribe_seconds, 3),
        "audio_seconds": round(float(info.duration), 3),
        "text": text,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
