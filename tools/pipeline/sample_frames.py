#!/usr/bin/env python3
"""
Frame sampler for the video-analyst pipeline stage.

Why this exists: no tool in this environment reads video directly (Read
handles images/PDFs/notebooks, not video). The video-analyst agent "watches"
a gameplay video by sampling it down to a handful of still frames first,
then looking at those stills like any other image.

Uses imageio-ffmpeg's bundled static ffmpeg binary -- this machine has
neither a system ffmpeg nor Homebrew, so don't assume either is available.
Install once with:
    pip3 install imageio-ffmpeg

Usage:
    python3 sample_frames.py <video_path> <output_dir> [--max-frames 12] [--interval-sec 3]

Samples one frame every --interval-sec seconds, capped at --max-frames total
(evenly re-spaced across the video if the naive interval would produce more
than that -- a 10-minute video at a 3s interval is 200 frames, way more than
any agent should look at per video). Frames land in <output_dir> as
frame_001.jpg, frame_002.jpg, ...
"""
import argparse
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg


def probe_duration(ffmpeg_exe, video_path):
    # ffmpeg prints duration to stderr on a plain -i probe (no output file).
    proc = subprocess.run(
        [ffmpeg_exe, "-i", str(video_path)],
        capture_output=True, text=True,
    )
    for line in proc.stderr.splitlines():
        line = line.strip()
        if line.startswith("Duration:"):
            # "Duration: 00:03:12.45, start: ..."
            ts = line.split(",")[0].replace("Duration:", "").strip()
            h, m, s = ts.split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    return None


def sample_frames(video_path, output_dir, max_frames=12, interval_sec=3):
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    video_path = Path(video_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    duration = probe_duration(ffmpeg_exe, video_path)
    fps = 1.0 / interval_sec
    if duration:
        naive_count = duration / interval_sec
        if naive_count > max_frames:
            fps = max_frames / duration
    else:
        print("warning: could not probe duration, using flat interval", file=sys.stderr)

    out_pattern = str(output_dir / "frame_%03d.jpg")
    cmd = [
        ffmpeg_exe, "-y", "-i", str(video_path),
        "-vf", f"fps={fps}",
        "-vframes", str(max_frames),
        "-q:v", "3",
        out_pattern,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit(1)

    frames = sorted(output_dir.glob("frame_*.jpg"))
    print(f"{video_path} -> {len(frames)} frames in {output_dir} (duration={duration})")
    return frames


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("video_path")
    p.add_argument("output_dir")
    p.add_argument("--max-frames", type=int, default=12)
    p.add_argument("--interval-sec", type=float, default=3)
    args = p.parse_args()
    sample_frames(args.video_path, args.output_dir, args.max_frames, args.interval_sec)
