"""
Whisper for Lignée (voice.js): turns recordings into text, on this computer.

Started once by the server, it keeps the model in memory: one request per line on stdin,
{"wav": path, "lang": "fr", "hint": "names to expect"}, one answer per line on stdout,
{"text": ...} or {"error": ...}. The first line written, {"ready": true}, says the model is loaded.

    python whisper-worker.py <model>   (faster-whisper: tiny, base, small, medium, large-v3-turbo...)
"""
import json
import os
import sys
import wave

import numpy as np
from faster_whisper import WhisperModel

RATE = 16000  # what Whisper hears


def read_wav(path):
    """Samples of a PCM 16-bit WAV file, mono, at 16 kHz, as floats (without PyAV)."""
    with wave.open(path, "rb") as w:
        if w.getsampwidth() != 2:
            raise ValueError("WAV 16 bits attendu")
        channels, rate = w.getnchannels(), w.getframerate()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)
    if rate != RATE and len(data):
        n = int(len(data) * RATE / rate)
        data = np.interp(np.linspace(0, len(data) - 1, n), np.arange(len(data)), data).astype(np.float32)
    return data


def main():
    name = sys.argv[1] if len(sys.argv) > 1 else "small"
    threads = max(1, (os.cpu_count() or 2) - 2)
    model = WhisperModel(name, device="cpu", compute_type="int8", cpu_threads=threads)
    print(json.dumps({"ready": True}), flush=True)
    for line in sys.stdin:
        try:
            req = json.loads(line)
            segments, _ = model.transcribe(
                read_wav(req["wav"]),
                language=req.get("lang") or None,
                initial_prompt=req.get("hint") or None,
                beam_size=5,
                vad_filter=True,
            )
            text = " ".join(s.text.strip() for s in segments).strip()
            print(json.dumps({"text": text}, ensure_ascii=False), flush=True)
        except Exception as e:  # one bad recording must not stop the worker
            print(json.dumps({"error": str(e)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
