#!/usr/bin/env python3
"""Local-only JSON-lines voice sidecar for JARVIS.

The service never opens a network port and never writes raw microphone audio.
Whisper mode is intentionally optional so the Electron shell remains usable
before the local model runtime is installed.
"""

from __future__ import annotations

import argparse
import json
import queue
import sys
import threading
import time
from dataclasses import dataclass
from typing import Any


def emit(event_type: str, **payload: Any) -> None:
    print(json.dumps({"type": event_type, **payload}, ensure_ascii=False), flush=True)


@dataclass
class RuntimeState:
    paused: bool = False
    stopped: bool = False


def command_loop(state: RuntimeState, commands: queue.Queue[dict[str, Any]]) -> None:
    for raw in sys.stdin:
        try:
            command = json.loads(raw)
            if isinstance(command, dict):
                commands.put(command)
        except json.JSONDecodeError:
            emit("error", message="收到无效控制命令")
    state.stopped = True


def process_commands(state: RuntimeState, commands: queue.Queue[dict[str, Any]]) -> None:
    while True:
        try:
            command = commands.get_nowait()
        except queue.Empty:
            return
        command_type = command.get("type")
        if command_type == "pause":
            state.paused = True
        elif command_type == "resume":
            state.paused = False
        elif command_type == "simulate_wake" and not state.paused:
            emit("wake", text=str(command.get("text", "贾维斯")), confidence=1.0)
        elif command_type == "shutdown":
            state.stopped = True


def run_mock(state: RuntimeState, commands: queue.Queue[dict[str, Any]], model: str) -> None:
    emit("ready", engine="mock", model=model)
    while not state.stopped:
        process_commands(state, commands)
        time.sleep(0.05)


def normalized_wake_match(text: str) -> bool:
    compact = "".join(text.lower().split())
    if any(alias in compact for alias in ("贾维斯", "家维斯", "贾卫斯", "贾维思", "jarvis")):
        return True
    try:
        from pypinyin import lazy_pinyin
        syllables = "".join(lazy_pinyin(compact))
        return "jiaweisi" in syllables
    except ImportError:
        return False


def run_whisper(state: RuntimeState, commands: queue.Queue[dict[str, Any]], model_name: str) -> None:
    try:
        import numpy as np
        import sounddevice as sd
        from faster_whisper import WhisperModel
    except ImportError as exc:
        emit("error", message=f"语音依赖未安装：{exc.name}")
        return

    started = time.perf_counter()
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    emit("metric", name="model_load", value=round(time.perf_counter() - started, 3), unit="s")
    emit("ready", engine="faster-whisper", model=model_name)

    sample_rate = 16000
    frame_samples = 480
    audio_queue: queue.Queue[Any] = queue.Queue()

    def on_audio(indata: Any, _frames: int, _time_info: Any, status: Any) -> None:
        if status:
            emit("error", message=str(status))
        audio_queue.put(indata[:, 0].copy())

    with sd.InputStream(samplerate=sample_rate, channels=1, dtype="int16", blocksize=frame_samples, callback=on_audio):
        noise_frames = [audio_queue.get() for _ in range(20)]
        noise = float(np.median([np.sqrt(np.mean(frame.astype(np.float64) ** 2)) for frame in noise_frames]))
        threshold = max(noise * 3.5, 400.0)
        buffer: list[Any] = []
        silence = 0
        speaking = False

        while not state.stopped:
            process_commands(state, commands)
            frame = audio_queue.get()
            if state.paused:
                buffer, silence, speaking = [], 0, False
                continue
            rms = float(np.sqrt(np.mean(frame.astype(np.float64) ** 2)) + 1e-9)
            loud = rms > threshold
            if speaking:
                buffer.append(frame)
                silence = 0 if loud else silence + 1
                if silence >= 24 or len(buffer) >= 330:
                    if len(buffer) >= 10:
                        audio = np.concatenate(buffer).astype(np.float32) / 32768.0
                        started = time.perf_counter()
                        segments, _ = model.transcribe(
                            audio,
                            language="zh",
                            beam_size=1,
                            vad_filter=True,
                            condition_on_previous_text=False,
                            initial_prompt="简体中文语音。关键词：贾维斯。",
                        )
                        text = "".join(segment.text for segment in segments).strip()
                        emit("metric", name="transcribe", value=round(time.perf_counter() - started, 3), unit="s")
                        if text:
                            emit("transcript", text=text, final=True)
                            if normalized_wake_match(text):
                                emit("wake", text=text)
                    buffer, silence, speaking = [], 0, False
            elif loud:
                speaking = True
                buffer = [frame]
                silence = 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("mock", "whisper"), default="mock")
    parser.add_argument("--model", default="tiny")
    args = parser.parse_args()
    state = RuntimeState()
    commands: queue.Queue[dict[str, Any]] = queue.Queue()
    threading.Thread(target=command_loop, args=(state, commands), daemon=True).start()
    try:
        if args.mode == "whisper":
            run_whisper(state, commands, args.model)
        else:
            run_mock(state, commands, args.model)
    except Exception as exc:  # noqa: BLE001 - sidecar must report and exit cleanly.
        emit("error", message=f"语音服务异常：{type(exc).__name__}: {exc}")
        return 1
    finally:
        emit("stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
