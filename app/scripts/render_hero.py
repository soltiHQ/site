#!/usr/bin/env python3
"""Render the seamless Solti three-voice hero animation and static cue."""

from __future__ import annotations

import argparse
import colorsys
import math
import subprocess
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


WIDTH = 1440
HEIGHT = 900
OUTPUT_WIDTH = 6144
OUTPUT_HEIGHT = 3840
AVIF_SIZE = (2880, 1800)
SCALE = OUTPUT_WIDTH / WIDTH
RW = OUTPUT_WIDTH
RH = OUTPUT_HEIGHT
SOFT_SCALE = 2.0
SW = round(WIDTH * SOFT_SCALE)
SH = round(HEIGHT * SOFT_SCALE)
FPS = 30
DURATION_SECONDS = 16
FRAME_COUNT = FPS * DURATION_SECONDS
TAU = math.tau

PAPER = (255, 255, 255)
SKY = (219, 234, 254)
CUE_INK = (58, 66, 77)

LAYER_COLORS = (
    (138, 132, 202),
    (97, 158, 208),
    (85, 170, 161),
)
KNOT_X = np.array(
    (-160.0, 60.0, 270.0, 480.0, 690.0, 900.0, 1110.0, 1320.0, 1530.0, 1600.0)
)
BASE_Y = (444.0, 580.0, 734.0)
HALF_HEIGHT = (50.0, 62.0, 70.0)
OWN_PHRASES = np.array(
    (
        (0.0, -10.0, 13.0, -7.0, 15.0, -10.0, 12.0, -6.0, 8.0, 0.0),
        (0.0, 12.0, -8.0, 16.0, -12.0, 14.0, -9.0, 13.0, -7.0, 0.0),
        (0.0, -7.0, 15.0, -11.0, 18.0, -9.0, 14.0, -12.0, 9.0, 0.0),
    ),
    dtype=np.float64,
)
SHARED_PHRASE = np.array(
    (0.0, -6.0, 12.0, -9.0, 14.0, -8.0, 11.0, -7.0, 8.0, 0.0),
    dtype=np.float64,
)
DEPTH_SCALE = (1.0, 1.18, 1.36)
BACKGROUND_CACHE: Image.Image | None = None
FADE_MASK_CACHE: dict[tuple[int, int, float, float, float, float], Image.Image] = {}

CUE_SOURCE_PATH = (
    Path(__file__).resolve().parent / "assets" / "conductor-filament-source.png"
)
CUE_OVERLAY_NAME = "hero-conductor-static.webp"
# Keep the exact approved cue footprint from the previous pen-path version.
CUE_TARGET_BOX = (603.65, 457.28, 853.36, 842.66)


@dataclass(frozen=True)
class LayerGeometry:
    center: np.ndarray


@dataclass(frozen=True)
class RasterCue:
    image: Image.Image
    underlay: Image.Image
    glow: Image.Image


RASTER_CUE_CACHE: RasterCue | None = None


@dataclass(frozen=True)
class RenderStyle:
    stem: str
    thread_count: tuple[int, int, int]
    thread_alpha: int
    thread_width: float
    anchor_every: int
    anchor_alpha: int
    anchor_width: float
    fade_start: float
    fade_end: float
    fade_minimum: float
    volume_strength: float
    vertical_offset: float
    flow_width_scale: float
    thread_motion_strength: float
    color_saturation: float


@dataclass(frozen=True)
class VideoTier:
    suffix: str
    webm_size: tuple[int, int]
    webm_crf: int
    mp4_size: tuple[int, int]
    mp4_crf: int
    mp4_level: str


RENDER_STYLES = (
    RenderStyle(
        stem="hero-conductor-static-shadow-000",
        thread_count=(24, 36, 48),
        thread_alpha=72,
        thread_width=0.68,
        anchor_every=6,
        anchor_alpha=120,
        anchor_width=1.0,
        fade_start=920.0,
        fade_end=1440.0,
        fade_minimum=0.34,
        volume_strength=1.05,
        vertical_offset=0.0,
        flow_width_scale=1.0,
        thread_motion_strength=1.0,
        color_saturation=1.08,
    ),
)

VIDEO_TIERS = (
    VideoTier("", (2560, 1600), 32, (2560, 1600), 17, "5.1"),
    VideoTier("-standard", (1920, 1200), 36, (1920, 1200), 19, "5.0"),
    VideoTier("-mobile", (1440, 900), 42, (1440, 900), 21, "4.0"),
)

LAYER_FLOW = (
    ((1, 0.75, -0.15), (2, 0.25, 1.10)),
    ((2, 0.62, 0.75), (3, 0.25, -0.40), (1, 0.13, 1.70)),
    ((3, 0.55, -1.05), (5, 0.28, 0.35), (2, 0.17, -0.80)),
)
FLOW_NORM = (1.109161, 1.332724, 1.251926)
FLOW_SHARPNESS = (0.72, 0.94, 1.18)
FLOW_TRAVEL = (18.0, 22.0, 27.0)


def smoothstep(value: np.ndarray | float) -> np.ndarray | float:
    value = np.clip(value, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


def sc(value: float) -> float:
    return value * SCALE


def rgba_layer(
    width: int = RW,
    height: int = RH,
) -> Image.Image:
    return Image.new("RGBA", (width, height), (0, 0, 0, 0))


def scaled_points(
    points: np.ndarray,
    scale: float = SCALE,
) -> list[tuple[float, float]]:
    return [tuple(point) for point in (points * scale).tolist()]


def build_background() -> Image.Image:
    global BACKGROUND_CACHE
    if BACKGROUND_CACHE is not None:
        return BACKGROUND_CACHE.copy()

    y = np.linspace(0.0, 1.0, RH, dtype=np.float32)
    wash = smoothstep((y - 0.37) / 0.63)[:, None]
    paper = np.array(PAPER, dtype=np.float32)
    wash_color = np.array((245.0, 249.0, 253.0), dtype=np.float32)
    vertical = paper * (1.0 - wash * 0.84) + wash_color * (wash * 0.84)
    strip = Image.fromarray(
        np.clip(vertical, 0.0, 255.0).astype(np.uint8)[:, None, :],
        "RGB",
    )
    background = strip.resize((RW, RH), Image.Resampling.NEAREST).convert("RGBA")

    haze_width = 768
    haze_height = 480
    hy, hx = np.mgrid[0:haze_height, 0:haze_width]
    xn = hx / (haze_width - 1)
    yn = hy / (haze_height - 1)
    haze = np.exp(
        -(((xn - 0.50) / 0.62) ** 2 + ((yn - 0.67) / 0.32) ** 2) * 1.45
    )
    haze_alpha = Image.fromarray(
        np.clip(haze * 6.0, 0.0, 255.0).astype(np.uint8),
        "L",
    ).resize((RW, RH), Image.Resampling.BICUBIC)
    haze_layer = Image.new("RGBA", (RW, RH), (*SKY, 0))
    haze_layer.putalpha(haze_alpha)
    background.alpha_composite(haze_layer)

    BACKGROUND_CACHE = background
    return BACKGROUND_CACHE.copy()


def catmull_rom(
    points: list[tuple[float, float]],
    samples_per_segment: int = 128,
) -> np.ndarray:
    control = np.array([points[0], *points, points[-1]], dtype=np.float64)
    output: list[np.ndarray] = []
    for index in range(1, len(control) - 2):
        p0, p1, p2, p3 = control[index - 1 : index + 3]
        t = np.linspace(0.0, 1.0, samples_per_segment, endpoint=False)[:, None]
        segment = 0.5 * (
            (2.0 * p1)
            + (-p0 + p2) * t
            + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * (t**2)
            + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * (t**3)
        )
        output.append(segment)
    return np.vstack((*output, np.array((points[-1],), dtype=np.float64)))


def offset_curve(points: np.ndarray, distance: float) -> np.ndarray:
    tangents = np.gradient(points, axis=0)
    lengths = np.linalg.norm(tangents, axis=1, keepdims=True)
    lengths = np.maximum(lengths, 1e-6)
    normals = np.column_stack((-tangents[:, 1], tangents[:, 0])) / lengths
    return points + normals * distance


def layer_half_height(index: int, style: RenderStyle) -> float:
    return HALF_HEIGHT[index] * style.flow_width_scale


def layer_flow(index: int, progress: float) -> float:
    theta = TAU * progress
    harmonics = LAYER_FLOW[index]
    raw = sum(
        amplitude * math.sin(cycles * theta + phase)
        for cycles, amplitude, phase in harmonics
    )
    raw_at_zero = sum(
        amplitude * math.sin(phase)
        for _, amplitude, phase in harmonics
    )
    normalized = (raw - raw_at_zero) / FLOW_NORM[index]
    if abs(normalized) < 1e-12:
        return 0.0
    sharpness = FLOW_SHARPNESS[index]
    return math.tanh(sharpness * normalized) / math.tanh(sharpness)


def build_layer_geometry(
    index: int,
    progress: float,
    style: RenderStyle,
) -> LayerGeometry:
    response = layer_flow(index, progress)
    shared_min = float(np.min(SHARED_PHRASE))
    shared_range = float(np.max(SHARED_PHRASE) - shared_min)
    directional_profile = 0.28 + 0.72 * (
        (SHARED_PHRASE - shared_min) / shared_range
    )
    knot_offset = (
        DEPTH_SCALE[index] * OWN_PHRASES[index]
        + response * FLOW_TRAVEL[index] * directional_profile
    )

    center_y = BASE_Y[index] + style.vertical_offset
    knots = list(zip(KNOT_X.tolist(), (center_y + knot_offset).tolist(), strict=True))
    center = catmull_rom(knots)
    return LayerGeometry(center=center)


def apply_horizontal_fade(
    layer: Image.Image,
    start_x: float,
    end_x: float,
    minimum_opacity: float,
    scale: float = SCALE,
) -> Image.Image:
    width, height = layer.size
    cache_key = (width, height, scale, start_x, end_x, minimum_opacity)
    fade_mask = FADE_MASK_CACHE.get(cache_key)
    if fade_mask is None:
        x = np.arange(width, dtype=np.float32) / scale
        fade = 1.0 - (1.0 - minimum_opacity) * smoothstep(
            (x - start_x) / (end_x - start_x)
        )
        strip = Image.new("L", (width, 1))
        strip.putdata(np.clip(fade * 255.0, 0.0, 255.0).astype(np.uint8).tolist())
        fade_mask = strip.resize((width, height), Image.Resampling.NEAREST)
        FADE_MASK_CACHE[cache_key] = fade_mask

    layer.putalpha(ImageChops.multiply(layer.getchannel("A"), fade_mask))
    return layer


def mix_rgb(
    first: tuple[int, int, int],
    second: tuple[int, int, int],
    amount: float,
) -> tuple[int, int, int]:
    return tuple(
        round(a + (b - a) * amount)
        for a, b in zip(first, second, strict=True)
    )


def shade_rgb(
    color: tuple[int, int, int],
    lightness: float = 0.78,
    saturation: float = 1.35,
) -> tuple[int, int, int]:
    red, green, blue = (channel / 255.0 for channel in color)
    hue, luminance, chroma = colorsys.rgb_to_hls(red, green, blue)
    shaded = colorsys.hls_to_rgb(
        hue,
        max(0.0, min(1.0, luminance * lightness)),
        max(0.0, min(1.0, chroma * saturation)),
    )
    return tuple(round(channel * 255.0) for channel in shaded)


def style_layer_color(
    index: int,
    style: RenderStyle,
) -> tuple[int, int, int]:
    return shade_rgb(
        LAYER_COLORS[index],
        lightness=1.0,
        saturation=style.color_saturation,
    )


def draw_layer_mass(
    canvas: Image.Image,
    geometry: LayerGeometry,
    index: int,
    style: RenderStyle,
) -> None:
    half_height = layer_half_height(index, style)
    volume = style.volume_strength
    color = style_layer_color(index, style)

    body = rgba_layer(SW, SH)
    body_draw = ImageDraw.Draw(body)
    body_draw.line(
        scaled_points(geometry.center, SOFT_SCALE),
        fill=(*color, round((38 + index * 5) * volume)),
        width=max(2, round(half_height * 1.34 * SOFT_SCALE)),
        joint="curve",
    )
    lower_curve = offset_curve(geometry.center, half_height * 0.28)
    # The transparent stroke replaces body pixels before blur; its RGB still
    # contributes to the approved soft lower edge.
    body_draw.line(
        scaled_points(lower_curve, SOFT_SCALE),
        fill=(
            *shade_rgb(
                color,
                lightness=0.80,
                saturation=3.20,
            ),
            0,
        ),
        width=max(2, round(half_height * 0.84 * SOFT_SCALE)),
        joint="curve",
    )
    upper_curve = offset_curve(geometry.center, -half_height * 0.18)
    body_draw.line(
        scaled_points(upper_curve, SOFT_SCALE),
        fill=(*mix_rgb(color, PAPER, 0.24), round((11 + index) * volume)),
        width=max(2, round(half_height * 0.48 * SOFT_SCALE)),
        joint="curve",
    )
    body = body.filter(
        ImageFilter.GaussianBlur(half_height * 0.22 * SOFT_SCALE)
    )
    body = apply_horizontal_fade(
        body,
        style.fade_start,
        style.fade_end,
        style.fade_minimum,
        SOFT_SCALE,
    ).resize((RW, RH), Image.Resampling.BICUBIC)
    canvas.alpha_composite(body)


def curve_frame(
    points: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    tangents = np.gradient(points, axis=0)
    lengths = np.linalg.norm(tangents, axis=1, keepdims=True)
    unit_tangents = tangents / np.maximum(lengths, 1e-6)
    normals = np.column_stack((-unit_tangents[:, 1], unit_tangents[:, 0]))
    steps = np.linalg.norm(np.diff(points, axis=0), axis=1)
    arc = np.concatenate((np.array((0.0,)), np.cumsum(steps)))
    arc /= max(float(arc[-1]), 1e-6)
    return arc, unit_tangents, normals


def texture_thread(
    geometry: LayerGeometry,
    index: int,
    style: RenderStyle,
    thread_index: int,
    progress: float,
) -> np.ndarray:
    count = style.thread_count[index]
    q = thread_index / max(count - 1, 1)
    u, tangents, normals = curve_frame(geometry.center)
    half_height = layer_half_height(index, style)

    base_v = (
        -0.86
        + 1.72 * q
        + 0.026 * math.sin(TAU * (thread_index * 0.61803398875 + 0.13 * index))
    )
    phrase = math.sin(math.pi * q) * (
        0.42 * np.sin(TAU * (0.78 * u + 0.68 * q + 0.17 * index))
        + 0.18 * np.sin(TAU * (1.68 * u - 0.52 * q + 0.31 * index))
        + 0.08 * np.sin(TAU * (3.25 * u + 0.36 * q + 0.09 * index))
    )
    body = 0.68 * base_v + phrase
    tangent_shift = 7.4 * math.sin(math.pi * q) * np.sin(
        TAU * (0.52 * u + 0.58 * q + 0.21 * index)
    )
    seed = (
        (thread_index + 1) * 0.61803398875
        + (index + 1) * 0.41421356237
    ) % 1.0
    layer_cycles = (2, 3, 4)[index]
    thread_cycles = 2 + ((thread_index + index) % 3)
    shared_k = (2.05, 2.28, 2.55)[index]
    thread_k = 3.65 + 0.23 * index
    envelope = (
        0.62 + 0.38 * np.sin(math.pi * u) ** 2
    ) * (
        0.58 + 0.42 * math.sin(math.pi * q) ** 0.70
    )
    shared_phase = TAU * (
        shared_k * u
        - layer_cycles * progress
        + 0.11 * index
    )
    thread_phase = TAU * (
        thread_k * u
        - thread_cycles * progress
        + 0.19 * seed
    )
    normal_wind = envelope * (
        np.sin(shared_phase) + 0.34 * np.sin(thread_phase)
    )
    tangent_wind = envelope * (
        np.cos(shared_phase) + 0.27 * np.cos(thread_phase)
    )
    body += 0.17 * normal_wind
    tangent_shift += 10.5 * tangent_wind
    v = 0.94 * np.tanh(body / 0.94)

    spatial_envelope = 0.76 + 0.24 * np.sin(np.pi * u) ** 2
    flow = layer_flow(index, progress)

    def fract(value: float) -> float:
        return value - math.floor(value)

    seed_one = fract(
        (thread_index + 1) * 0.61803398875
        + (index + 1) * 0.41421356237
    )
    seed_two = fract(
        (thread_index + 1) * 0.754877666
        + (index + 1) * 0.569840291
    )
    seed_three = fract(
        (thread_index + 1) * 0.438579
        + (index + 1) * 0.278317
    )
    edge_gate = 0.18 + 0.82 * math.sin(math.pi * q) ** 0.72
    flow_sign = 0.0 if flow == 0.0 else math.copysign(1.0, flow)
    response_power = 0.72 + 0.72 * seed_one
    amplitude = (3.2, 4.0, 4.8)[index] * (0.75 + 0.35 * seed_two)
    tangent_gain = 0.10
    normal_profile = 0.54 + 0.46 * (
        0.5
        + 0.5
        * np.sin(
            TAU
            * (0.63 * u + seed_three + 0.11 * q)
        )
    )
    tangent_profile = 0.34 + 0.66 * (
        0.5
        + 0.5
        * np.cos(
            TAU
            * (0.48 * u + seed_two + 0.07 * q)
        )
    )

    response = flow_sign * abs(flow) ** response_power
    amplitude *= style.thread_motion_strength * edge_gate
    normal_delta = (
        response
        * amplitude
        * spatial_envelope
        * normal_profile
    )
    tangent_delta = (
        response
        * tangent_gain
        * amplitude
        * tangent_profile
    )

    return (
        geometry.center
        + normals * (v * half_height + normal_delta)[:, None]
        + tangents * (tangent_shift + tangent_delta)[:, None]
    )

def draw_layer_texture(
    canvas: Image.Image,
    geometry: LayerGeometry,
    index: int,
    style: RenderStyle,
    progress: float,
) -> None:
    color = style_layer_color(index, style)
    texture = rgba_layer()
    draw = ImageDraw.Draw(texture)
    threads = tuple(
        texture_thread(geometry, index, style, thread_index, progress)
        for thread_index in range(style.thread_count[index])
    )

    for thread_index, curve in enumerate(threads):
        is_anchor = (
            style.anchor_every > 0
            and thread_index % style.anchor_every == 0
            and thread_index not in (0, len(threads) - 1)
        )
        thread_color = (
            color
            if is_anchor
            else mix_rgb(color, PAPER, 0.10)
        )
        alpha = style.anchor_alpha if is_anchor else style.thread_alpha
        edge_visibility = 0.58 + 0.42 * math.sin(math.pi * (
            thread_index / max(len(threads) - 1, 1)
        )) ** 0.45
        alpha = round(alpha * edge_visibility)
        width = style.anchor_width if is_anchor else style.thread_width
        draw.line(
            scaled_points(curve),
            fill=(*thread_color, alpha),
            width=max(2, round(sc(width))),
            joint="curve",
        )

    texture = apply_horizontal_fade(
        texture,
        style.fade_start,
        style.fade_end,
        style.fade_minimum,
    )
    canvas.alpha_composite(texture)


def cue_source_to_rgba(path: Path) -> Image.Image:
    """Extract colored filament ink from the generated white source."""
    with Image.open(path) as source:
        rgb_image = source.convert("RGB")
    rgb = np.asarray(rgb_image, dtype=np.float32)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    darkness = 255.0 - rgb.mean(axis=2)

    color_alpha = smoothstep((chroma - 2.0) / 26.0)
    dark_alpha = 0.60 * smoothstep((darkness - 2.0) / 30.0)
    alpha = np.maximum(color_alpha, dark_alpha)
    alpha[alpha < 0.018] = 0.0

    ink = np.empty_like(rgb)
    ink[:, :] = CUE_INK
    rgba = np.dstack((ink, np.rint(alpha * 255.0))).astype(np.uint8)
    image = Image.fromarray(rgba, "RGBA")
    bbox = image.getchannel("A").point(
        lambda value: 255 if value >= 12 else 0
    ).getbbox()
    if bbox is None:
        raise RuntimeError(f"Cue asset contains no usable colored ink: {path}")
    return image.crop(bbox)


def image_with_opacity(image: Image.Image, opacity: float) -> Image.Image:
    result = image.copy()
    alpha = result.getchannel("A").point(
        lambda value: round(value * opacity)
    )
    result.putalpha(alpha)
    return result


def load_raster_cue() -> RasterCue:
    global RASTER_CUE_CACHE
    if RASTER_CUE_CACHE is not None:
        return RASTER_CUE_CACHE

    path = CUE_SOURCE_PATH
    x0, y0, x1, y1 = CUE_TARGET_BOX
    target_size = (
        max(1, round(sc(x1 - x0))),
        max(1, round(sc(y1 - y0))),
    )
    extracted = cue_source_to_rgba(path)
    alpha = extracted.getchannel("A").resize(
        target_size,
        Image.Resampling.LANCZOS,
    )
    image = Image.new("RGBA", target_size, (*CUE_INK, 255))
    image.putalpha(alpha)
    glow = image.filter(ImageFilter.GaussianBlur(sc(3.4)))
    raster_cue = RasterCue(
        image=image,
        underlay=image_with_opacity(image, 0.27),
        glow=image_with_opacity(glow, 0.11),
    )
    RASTER_CUE_CACHE = raster_cue
    return raster_cue


def build_cue_overlay() -> Image.Image:
    """Return the approved static cue as a tightly cropped RGBA overlay."""
    raster_cue = load_raster_cue()
    overlay = rgba_layer(*raster_cue.image.size)
    overlay.alpha_composite(raster_cue.glow)
    overlay.alpha_composite(raster_cue.underlay)
    overlay.alpha_composite(raster_cue.image)
    return overlay


def render_waves(
    progress: float = 0.0,
    style: RenderStyle = RENDER_STYLES[0],
) -> Image.Image:
    """Render the opaque background and waves without the static cue."""
    canvas = build_background()
    geometries = tuple(
        build_layer_geometry(index, progress, style)
        for index in range(3)
    )
    for index, geometry in enumerate(geometries):
        draw_layer_mass(canvas, geometry, index, style)
    for index, geometry in enumerate(geometries):
        draw_layer_texture(canvas, geometry, index, style, progress)

    return canvas.convert("RGB")


def encode_animation(
    output_dir: Path,
    style: RenderStyle,
    renderer: Callable[[float, RenderStyle], Image.Image],
) -> None:
    poster_path = output_dir / f"{style.stem}.avif"
    split_labels: list[str] = []
    scale_filters: list[str] = []
    for index, tier in enumerate(VIDEO_TIERS):
        split_labels.extend((f"[av1src{index}]", f"[h264src{index}]"))
        scale_filters.extend(
            (
                (
                    f"[av1src{index}]scale={tier.webm_size[0]}:{tier.webm_size[1]}:"
                    "flags=lanczos+accurate_rnd+full_chroma_int,"
                    f"format=yuv420p[av1{index}]"
                ),
                (
                    f"[h264src{index}]scale={tier.mp4_size[0]}:{tier.mp4_size[1]}:"
                    "flags=lanczos+accurate_rnd+full_chroma_int,"
                    f"format=yuv420p[h264{index}]"
                ),
            )
        )

    filter_graph = (
        f"[0:v]split={len(split_labels)}{''.join(split_labels)};"
        + ";".join(scale_filters)
    )
    command = (
        "/opt/homebrew/bin/ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "rawvideo",
        "-pixel_format",
        "rgb24",
        "-video_size",
        f"{OUTPUT_WIDTH}x{OUTPUT_HEIGHT}",
        "-framerate",
        str(FPS),
        "-i",
        "pipe:0",
        "-filter_complex",
        filter_graph,
    )
    output_paths: list[Path] = []
    for index, tier in enumerate(VIDEO_TIERS):
        webm_path = output_dir / f"{style.stem}{tier.suffix}.webm"
        mp4_path = output_dir / f"{style.stem}{tier.suffix}.mp4"
        output_paths.extend((webm_path, mp4_path))
        command += (
            "-map",
            f"[av1{index}]",
            "-an",
            "-c:v",
            "libsvtav1",
            "-preset",
            "4",
            "-crf",
            str(tier.webm_crf),
            "-pix_fmt",
            "yuv420p",
            "-g",
            str(FRAME_COUNT),
            "-color_range",
            "tv",
            "-colorspace",
            "bt709",
            "-color_trc",
            "bt709",
            "-color_primaries",
            "bt709",
            str(webm_path),
            "-map",
            f"[h264{index}]",
            "-an",
            "-c:v",
            "libx264",
            "-crf",
            str(tier.mp4_crf),
            "-preset",
            "veryslow",
            "-tune",
            "animation",
            "-profile:v",
            "high",
            "-level",
            tier.mp4_level,
            "-pix_fmt",
            "yuv420p",
            "-g",
            str(FRAME_COUNT),
            "-keyint_min",
            str(FRAME_COUNT),
            "-sc_threshold",
            "0",
            "-x264-params",
            "colorprim=bt709:transfer=bt709:colormatrix=bt709:range=limited",
            "-movflags",
            "+faststart",
            "-color_range",
            "tv",
            "-colorspace",
            "bt709",
            "-color_trc",
            "bt709",
            "-color_primaries",
            "bt709",
            str(mp4_path),
        )
    process = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    if process.stdin is None:
        raise RuntimeError("ffmpeg stdin is unavailable")

    for frame_index in range(FRAME_COUNT):
        frame = renderer(frame_index / FRAME_COUNT, style)
        if frame_index == 0:
            save_poster(frame, poster_path)
        process.stdin.write(frame.tobytes())
        if frame_index % (FPS * 2) == 0:
            print(
                f"{style.stem}: frame {frame_index}/{FRAME_COUNT}",
                flush=True,
            )

    process.stdin.close()
    error_output = process.stderr.read() if process.stderr is not None else b""
    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(error_output.decode("utf-8", errors="replace"))

    print(poster_path, flush=True)
    for output_path in output_paths:
        print(output_path, flush=True)


def save_poster(frame: Image.Image, path: Path) -> None:
    poster = frame.resize(AVIF_SIZE, Image.Resampling.LANCZOS)
    poster.save(
        path,
        "AVIF",
        quality=95,
        speed=4,
        subsampling="4:4:4",
    )


def save_cue_overlay(path: Path) -> None:
    build_cue_overlay().save(
        path,
        "WEBP",
        lossless=True,
        method=6,
        exact=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--style",
        choices=tuple(style.stem for style in RENDER_STYLES),
    )
    parser.add_argument("--poster-only", action="store_true")
    parser.add_argument("--output-dir", type=Path)
    arguments = parser.parse_args()
    output_dir = (
        arguments.output_dir
        if arguments.output_dir is not None
        else Path(__file__).resolve().parents[1] / "public" / "media"
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    selected_styles = (
        tuple(style for style in RENDER_STYLES if style.stem == arguments.style)
        if arguments.style
        else RENDER_STYLES
    )
    cue_path = output_dir / CUE_OVERLAY_NAME
    save_cue_overlay(cue_path)
    print(cue_path, flush=True)
    for style in selected_styles:
        if arguments.poster_only:
            poster_path = output_dir / f"{style.stem}.avif"
            save_poster(render_waves(0.0, style), poster_path)
            print(poster_path, flush=True)
        else:
            encode_animation(output_dir, style, render_waves)


if __name__ == "__main__":
    main()
