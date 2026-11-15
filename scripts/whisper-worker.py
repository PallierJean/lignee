"""
Whisper for Lignée (voice.js): turns recordings into text, on this computer.

Started once by the server, it keeps the model in memory: one request per line on stdin,
{"wav": path, "lang": "fr", "hint": "names to expect"}, one answer per line on stdout,
{"text": ...} or {"error": ...}. The first line written, {"ready": true, "device": "cuda" or "cpu"},
says the model is loaded.

    python whisper-worker.py <model>   (faster-whisper: tiny, base, small, medium, large-v3-turbo...)

With an NVIDIA graphics card, Whisper runs on it, several times faster, if CUDA's libraries are there
(pip install nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*" in the same environment); otherwise, or if the
card fails, on the processor. LIGNEE_WHISPER_DEVICE=cpu or cuda forces the choice.
"""
import ctypes
import glob
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


def load_cuda_libraries():
    """Loads cuBLAS and cuDNN installed by pip (nvidia-* packages), which CTranslate2 wouldn't find."""
    try:
        import nvidia
    except ImportError:
        return
    for pattern in ("cublas/lib/libcublasLt.so.*", "cublas/lib/libcublas.so.*", "cudnn/lib/libcudnn*.so.*"):
        for base in nvidia.__path__:
            for lib in sorted(glob.glob(os.path.join(base, pattern))):
                try:
                    ctypes.CDLL(lib, mode=ctypes.RTLD_GLOBAL)
                except OSError:
                    pass


def on_card(name):
    """The model on the graphics card, or None if there's no card or it can't run Whisper."""
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() < 1:
            return None
        load_cuda_libraries()
        model = WhisperModel(name, device="cuda", compute_type="int8_float16")
        list(model.transcribe(np.zeros(RATE, dtype=np.float32), language="fr")[0])  # fails here without cuBLAS
        return model
    except Exception as e:
        print("whisper: graphics card unavailable, processor used (%s)" % e, file=sys.stderr, flush=True)
        return None


def main():
    name = sys.argv[1] if len(sys.argv) > 1 else "small"
    choice = os.environ.get("LIGNEE_WHISPER_DEVICE", "auto")
    model = on_card(name) if choice != "cpu" else None
    if model is None and choice == "cuda":
        sys.exit("whisper: no usable graphics card (LIGNEE_WHISPER_DEVICE=cuda)")
    device = "cuda" if model else "cpu"
    if model is None:
        threads = max(1, (os.cpu_count() or 2) - 2)
        model = WhisperModel(name, device="cpu", compute_type="int8", cpu_threads=threads)
    print(json.dumps({"ready": True, "device": device}), flush=True)
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
