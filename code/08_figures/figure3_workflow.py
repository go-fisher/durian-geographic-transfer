from __future__ import annotations

import argparse
import csv
import shutil
from html import escape
from pathlib import Path


PACKAGE = Path(__file__).resolve().parent
PROJECT = PACKAGE.parents[1]
DEFAULT_OUTPUT = PROJECT / "outputs" / "figures" / "workflow_rebuild"
DEFAULT_STEM = "Figure3_supervisor_R1"

CANVAS_WIDTH = 1018
CANVAS_HEIGHT = 763
RASTER_WIDTH = 4072
RASTER_HEIGHT = 3052

NAVY = "#0B2B5C"
SECONDARY = "#163C6F"
LINE = "#183C6B"
WHITE = "#FFFFFF"


NODES = [
    {
        "sequence": "1",
        "stage": "Reference Data",
        "title": "Bentong reference data",
        "details": "557 polygons | 206 spatial groups",
        "evidence_role": "Source reference data",
    },
    {
        "sequence": "2",
        "stage": "Model Development",
        "title": "E1 nested grouped model development",
        "details": "RF / XGBoost / SVM | nested grouped OOF",
        "evidence_role": "Source-domain development",
    },
    {
        "sequence": "3",
        "stage": "Staged Selection",
        "title": "Full-Bentong staged selection",
        "details": "S2: priority Durian F1 | R1 selected within S2",
        "evidence_role": "Full-source selection",
    },
    {
        "sequence": "4",
        "stage": "Freeze Specification",
        "title": "Frozen S2+R1",
        "details": "predictors + preprocessing | fixed before Pahang",
        "evidence_role": "Frozen specification",
    },
    {
        "sequence": "5a",
        "stage": "Source-Domain Benchmark",
        "title": "E2 fixed Bentong benchmark",
        "details": "post-selection conditional grouped OOF | OA = 0.855",
        "evidence_role": "Conditional source benchmark",
    },
    {
        "sequence": "5b",
        "stage": "Independent Target Audit",
        "title": "E3 independent Pahang audit",
        "details": "frozen model; no target fitting | OA = 0.704",
        "evidence_role": "Independent target audit",
    },
    {
        "sequence": "6",
        "stage": "Target-Domain Learnability",
        "title": "E5 target-domain learnability",
        "details": "post-hoc grouped modelling | with Pahang labels; OA = 0.836",
        "evidence_role": "Post-hoc target learnability",
    },
    {
        "sequence": "S",
        "stage": "Supplementary Post-hoc Diagnostics",
        "title": "E4 fixed-R1 feature sensitivity; E6 Rubber coverage sensitivity",
        "details": "no retroactive reselection | non-causal repeated reductions",
        "evidence_role": "Supplementary diagnostics",
    },
]


def _multiline_text(
    x: float,
    y: float,
    lines: list[str],
    *,
    size: float,
    weight: int = 400,
    colour: str = NAVY,
    line_height: float | None = None,
    anchor: str = "middle",
    extra: str = "",
) -> str:
    spacing = line_height if line_height is not None else size * 1.25
    tspans = []
    for index, line in enumerate(lines):
        dy = 0 if index == 0 else spacing
        tspans.append(f'<tspan x="{x}" dy="{dy}">{escape(line)}</tspan>')
    return (
        f'<text x="{x}" y="{y}" text-anchor="{anchor}" '
        f'font-family="Arial, Liberation Sans, sans-serif" font-size="{size}" '
        f'font-weight="{weight}" fill="{colour}" {extra}>'
        + "".join(tspans)
        + "</text>"
    )


def _stage_label(x0: float, x1: float, y: float, text: str) -> str:
    centre = (x0 + x1) / 2
    text_width = max(116, len(text) * 7.4)
    left_end = centre - text_width / 2 - 11
    right_start = centre + text_width / 2 + 11
    return "".join(
        [
            f'<line x1="{x0}" y1="{y - 4}" x2="{left_end}" y2="{y - 4}" stroke="{LINE}" stroke-width="1"/>',
            _multiline_text(centre, y, [text], size=14.5, weight=700),
            f'<line x1="{right_start}" y1="{y - 4}" x2="{x1}" y2="{y - 4}" stroke="{LINE}" stroke-width="1"/>',
        ]
    )


def _box(x: float, y: float, width: float, height: float, gradient: str, stroke: str = LINE) -> str:
    return (
        f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="7" '
        f'fill="url(#{gradient})" stroke="{stroke}" stroke-width="1.25" filter="url(#softShadow)"/>'
    )


def build_svg() -> str:
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="172.38mm" height="129.29mm" viewBox="0 0 {CANVAS_WIDTH} {CANVAS_HEIGHT}">',
        "<defs>",
        '<linearGradient id="blueFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FAFCFF"/><stop offset="1" stop-color="#E7F0FA"/></linearGradient>',
        '<linearGradient id="goldFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFDF6"/><stop offset="1" stop-color="#FFF1D3"/></linearGradient>',
        '<linearGradient id="greenFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FAFEFB"/><stop offset="1" stop-color="#E5F5E8"/></linearGradient>',
        '<linearGradient id="purpleFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FCFAFF"/><stop offset="1" stop-color="#EEE8FA"/></linearGradient>',
        '<filter id="softShadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="1" stdDeviation="1.4" flood-color="#12335C" flood-opacity="0.08"/></filter>',
        f'<marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="{NAVY}"/></marker>',
        "</defs>",
        f'<rect width="{CANVAS_WIDTH}" height="{CANVAS_HEIGHT}" fill="{WHITE}"/>',
        _multiline_text(509, 58, ["Source-to-Freeze-to-Target Evidence Sequence"], size=36, weight=700),
        _stage_label(42, 250, 109, "1. Reference Data"),
        _stage_label(279, 495, 109, "2. Model Development"),
        _stage_label(524, 739, 109, "3. Staged Selection"),
        _stage_label(764, 965, 109, "4. Freeze Specification"),
        _box(42, 124, 208, 127, "blueFill"),
        _box(279, 124, 216, 127, "goldFill"),
        _box(524, 124, 215, 127, "goldFill"),
        _box(764, 124, 201, 127, "greenFill", "#31896A"),
        _multiline_text(146, 160, ["Bentong", "reference data"], size=19, weight=700, line_height=24),
        _multiline_text(146, 211, ["557 polygons", "206 spatial groups"], size=14.5, line_height=21, colour=SECONDARY),
        _multiline_text(387, 160, ["E1 nested grouped", "model development"], size=18, weight=700, line_height=24),
        _multiline_text(387, 211, ["RF / XGBoost / SVM", "nested grouped OOF"], size=14.5, line_height=21, colour=SECONDARY),
        _multiline_text(631.5, 159, ["Full-Bentong staged", "selection"], size=18, weight=700, line_height=24),
        _multiline_text(631.5, 211, ["S2: priority Durian F1", "R1 selected within S2"], size=14, line_height=21, colour=SECONDARY),
        _multiline_text(864.5, 169, ["Frozen S2+R1"], size=18.5, weight=700),
        _multiline_text(864.5, 205, ["predictors + preprocessing", "fixed before Pahang"], size=14, line_height=21, colour=SECONDARY),
        f'<line x1="254" y1="185" x2="274" y2="185" stroke="{NAVY}" stroke-width="4" marker-end="url(#arrow)"/>',
        f'<line x1="499" y1="185" x2="519" y2="185" stroke="{NAVY}" stroke-width="4" marker-end="url(#arrow)"/>',
        f'<line x1="743" y1="185" x2="759" y2="185" stroke="{NAVY}" stroke-width="4" marker-end="url(#arrow)"/>',
        f'<path d="M854.5 251 V289 H281 V311 M854.5 289 H695 V311" fill="none" stroke="{NAVY}" stroke-width="3" stroke-linejoin="round"/>',
        _stage_label(143, 424, 331, "5a. Source-Domain Benchmark"),
        _stage_label(557, 836, 331, "5b. Independent Target Audit"),
        _box(130, 345, 308, 124, "blueFill"),
        _box(545, 345, 300, 124, "blueFill"),
        _multiline_text(284, 389, ["E2 fixed Bentong benchmark"], size=18, weight=700),
        _multiline_text(284, 419, ["post-selection conditional grouped OOF", "OA = 0.855"], size=14.5, line_height=21, colour=SECONDARY),
        _multiline_text(695, 376, ["E3 independent", "Pahang audit"], size=18, weight=700, line_height=24),
        _multiline_text(695, 425, ["frozen model; no target fitting", "OA = 0.704"], size=14.5, line_height=21, colour=SECONDARY),
        f'<line x1="695" y1="470" x2="695" y2="495" stroke="{NAVY}" stroke-width="3.5" marker-end="url(#arrow)"/>',
        _stage_label(550, 840, 518, "6. Target-Domain Learnability"),
        _box(545, 531, 300, 96, "purpleFill", "#5149A3"),
        _multiline_text(695, 565, ["E5 target-domain learnability"], size=17.5, weight=700),
        _multiline_text(695, 590, ["post-hoc grouped modelling", "with Pahang labels; OA = 0.836"], size=14, line_height=21, colour=SECONDARY),
        '<rect x="134" y="647" width="752" height="89" rx="7" fill="#FFFFFF" stroke="#6D89AE" stroke-width="1.25" stroke-dasharray="6 4"/>',
        _multiline_text(510, 675, ["Supplementary Post-hoc Diagnostics"], size=16, weight=700),
        f'<line x1="509" y1="685" x2="509" y2="721" stroke="#91A3BB" stroke-width="1"/>',
        _multiline_text(321, 699, ["E4 fixed-R1 feature sensitivity", "(no retroactive reselection)"], size=14, line_height=20, colour=SECONDARY),
        _multiline_text(697, 699, ["E6 Rubber coverage sensitivity", "(non-causal repeated reductions)"], size=14, line_height=20, colour=SECONDARY),
        "</svg>",
    ]
    return "".join(parts)


def write_node_manifest(path: Path) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(NODES[0]))
        writer.writeheader()
        writer.writerows(NODES)


def _render_with_pillow(png_path: Path, tif_path: Path, pdf_path: Path) -> None:
    """Dependency-light fallback that redraws the same fixed layout with Pillow."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as exc:
        raise RuntimeError("Install Pillow from requirements.txt before rendering Figure 3") from exc

    scale = RASTER_WIDTH / CANVAS_WIDTH
    image = Image.new("RGB", (RASTER_WIDTH, RASTER_HEIGHT), WHITE)
    draw = ImageDraw.Draw(image)

    def sc(value: float) -> int:
        return round(value * scale)

    def font(size: float, bold: bool = False):
        filename = "arialbd.ttf" if bold else "arial.ttf"
        path = Path("C:/Windows/Fonts") / filename
        if not path.exists():
            path = Path("C:/Windows/Fonts/calibrib.ttf" if bold else "C:/Windows/Fonts/calibri.ttf")
        return ImageFont.truetype(str(path), sc(size))

    def text_size(value: str, text_font) -> tuple[int, int]:
        if hasattr(draw, "textbbox"):
            box = draw.textbbox((0, 0), value, font=text_font)
            return box[2] - box[0], box[3] - box[1]
        return draw.textsize(value, font=text_font)

    def rounded_fill(canvas, coordinates, radius: int, fill) -> None:
        """Draw a filled rounded rectangle on Pillow versions predating rounded_rectangle."""
        x0, y0, x1, y1 = coordinates
        canvas.rectangle((x0 + radius, y0, x1 - radius, y1), fill=fill)
        canvas.rectangle((x0, y0 + radius, x1, y1 - radius), fill=fill)
        diameter = radius * 2
        canvas.ellipse((x0, y0, x0 + diameter, y0 + diameter), fill=fill)
        canvas.ellipse((x1 - diameter, y0, x1, y0 + diameter), fill=fill)
        canvas.ellipse((x0, y1 - diameter, x0 + diameter, y1), fill=fill)
        canvas.ellipse((x1 - diameter, y1 - diameter, x1, y1), fill=fill)

    def rounded_outline(canvas, coordinates, radius: int, colour: str, width: int) -> None:
        x0, y0, x1, y1 = coordinates
        canvas.line((x0 + radius, y0, x1 - radius, y0), fill=colour, width=width)
        canvas.line((x0 + radius, y1, x1 - radius, y1), fill=colour, width=width)
        canvas.line((x0, y0 + radius, x0, y1 - radius), fill=colour, width=width)
        canvas.line((x1, y0 + radius, x1, y1 - radius), fill=colour, width=width)
        diameter = radius * 2
        for offset in range(width):
            canvas.arc((x0 + offset, y0 + offset, x0 + diameter - offset, y0 + diameter - offset), 180, 270, fill=colour)
            canvas.arc((x1 - diameter + offset, y0 + offset, x1 - offset, y0 + diameter - offset), 270, 360, fill=colour)
            canvas.arc((x0 + offset, y1 - diameter + offset, x0 + diameter - offset, y1 - offset), 90, 180, fill=colour)
            canvas.arc((x1 - diameter + offset, y1 - diameter + offset, x1 - offset, y1 - offset), 0, 90, fill=colour)

    def centred_lines(
        centre_x: float,
        top: float,
        lines: list[str],
        size: float,
        *,
        bold: bool = False,
        colour: str = NAVY,
        line_height: float | None = None,
    ) -> None:
        text_font = font(size, bold)
        advance = sc(line_height if line_height is not None else size * 1.25)
        for index, line in enumerate(lines):
            width, _ = text_size(line, text_font)
            draw.text((sc(centre_x) - width // 2, sc(top) + index * advance), line, font=text_font, fill=colour)

    def gradient_box(x: float, y: float, width: float, height: float, start: str, end: str, outline: str = LINE) -> None:
        left, top, right, bottom = sc(x), sc(y), sc(x + width), sc(y + height)
        box_width, box_height = right - left, bottom - top
        start_rgb = tuple(int(start[i : i + 2], 16) for i in (1, 3, 5))
        end_rgb = tuple(int(end[i : i + 2], 16) for i in (1, 3, 5))
        gradient = Image.new("RGB", (box_width, box_height))
        gradient_draw = ImageDraw.Draw(gradient)
        for row in range(box_height):
            ratio = row / max(box_height - 1, 1)
            colour = tuple(round(a + (b - a) * ratio) for a, b in zip(start_rgb, end_rgb))
            gradient_draw.line((0, row, box_width, row), fill=colour)
        mask = Image.new("L", (box_width, box_height), 0)
        rounded_fill(ImageDraw.Draw(mask), (0, 0, box_width - 1, box_height - 1), sc(7), 255)
        image.paste(gradient, (left, top), mask)
        rounded_outline(draw, (left, top, right, bottom), sc(7), outline, max(2, sc(1.25)))

    def stage_label(x0: float, x1: float, y: float, label: str) -> None:
        text_font = font(14.5, True)
        text_width, _ = text_size(label, text_font)
        centre = sc((x0 + x1) / 2)
        line_y = sc(y + 7)
        gap = sc(11)
        draw.line((sc(x0), line_y, centre - text_width // 2 - gap, line_y), fill=LINE, width=sc(1))
        draw.text((centre - text_width // 2, sc(y)), label, font=text_font, fill=NAVY)
        draw.line((centre + text_width // 2 + gap, line_y, sc(x1), line_y), fill=LINE, width=sc(1))

    def arrow(x1: float, y1: float, x2: float, y2: float, width: float = 4, head: float = 9) -> None:
        x1s, y1s, x2s, y2s = sc(x1), sc(y1), sc(x2), sc(y2)
        draw.line((x1s, y1s, x2s, y2s), fill=NAVY, width=sc(width))
        if abs(x2 - x1) >= abs(y2 - y1):
            direction = 1 if x2 >= x1 else -1
            points = [(x2s, y2s), (x2s - direction * sc(head), y2s - sc(head * 0.65)), (x2s - direction * sc(head), y2s + sc(head * 0.65))]
        else:
            direction = 1 if y2 >= y1 else -1
            points = [(x2s, y2s), (x2s - sc(head * 0.65), y2s - direction * sc(head)), (x2s + sc(head * 0.65), y2s - direction * sc(head))]
        draw.polygon(points, fill=NAVY)

    centred_lines(509, 25, ["Source-to-Freeze-to-Target Evidence Sequence"], 36, bold=True)
    stage_label(42, 250, 96, "1. Reference Data")
    stage_label(279, 495, 96, "2. Model Development")
    stage_label(524, 739, 96, "3. Staged Selection")
    stage_label(764, 965, 96, "4. Freeze Specification")

    gradient_box(42, 124, 208, 127, "#FAFCFF", "#E7F0FA")
    gradient_box(279, 124, 216, 127, "#FFFDF6", "#FFF1D3")
    gradient_box(524, 124, 215, 127, "#FFFDF6", "#FFF1D3")
    gradient_box(764, 124, 201, 127, "#FAFEFB", "#E5F5E8", "#31896A")
    centred_lines(146, 144, ["Bentong", "reference data"], 19, bold=True, line_height=24)
    centred_lines(146, 198, ["557 polygons", "206 spatial groups"], 14.5, colour=SECONDARY, line_height=21)
    centred_lines(387, 144, ["E1 nested grouped", "model development"], 18, bold=True, line_height=24)
    centred_lines(387, 198, ["RF / XGBoost / SVM", "nested grouped OOF"], 14.5, colour=SECONDARY, line_height=21)
    centred_lines(631.5, 143, ["Full-Bentong staged", "selection"], 18, bold=True, line_height=24)
    centred_lines(631.5, 198, ["S2: priority Durian F1", "R1 selected within S2"], 14, colour=SECONDARY, line_height=21)
    centred_lines(864.5, 151, ["Frozen S2+R1"], 18.5, bold=True)
    centred_lines(864.5, 192, ["predictors + preprocessing", "fixed before Pahang"], 14, colour=SECONDARY, line_height=21)
    arrow(254, 185, 274, 185)
    arrow(499, 185, 519, 185)
    arrow(743, 185, 759, 185)

    branch_width = sc(3)
    draw.line((sc(854.5), sc(251), sc(854.5), sc(289)), fill=NAVY, width=branch_width)
    draw.line((sc(281), sc(289), sc(854.5), sc(289)), fill=NAVY, width=branch_width)
    draw.line((sc(281), sc(289), sc(281), sc(311)), fill=NAVY, width=branch_width)
    draw.line((sc(695), sc(289), sc(695), sc(311)), fill=NAVY, width=branch_width)

    stage_label(143, 424, 318, "5a. Source-Domain Benchmark")
    stage_label(557, 836, 318, "5b. Independent Target Audit")
    gradient_box(130, 345, 308, 124, "#FAFCFF", "#E7F0FA")
    gradient_box(545, 345, 300, 124, "#FAFCFF", "#E7F0FA")
    centred_lines(284, 370, ["E2 fixed Bentong benchmark"], 18, bold=True)
    centred_lines(284, 402, ["post-selection conditional grouped OOF", "OA = 0.855"], 14.5, colour=SECONDARY, line_height=21)
    centred_lines(695, 358, ["E3 independent", "Pahang audit"], 18, bold=True, line_height=24)
    centred_lines(695, 408, ["frozen model; no target fitting", "OA = 0.704"], 14.5, colour=SECONDARY, line_height=21)
    arrow(695, 470, 695, 495, width=3.5)

    stage_label(550, 840, 505, "6. Target-Domain Learnability")
    gradient_box(545, 531, 300, 96, "#FCFAFF", "#EEE8FA", "#5149A3")
    centred_lines(695, 547, ["E5 target-domain learnability"], 17.5, bold=True)
    centred_lines(695, 576, ["post-hoc grouped modelling", "with Pahang labels; OA = 0.836"], 14, colour=SECONDARY, line_height=21)

    left, top, right, bottom = sc(134), sc(647), sc(886), sc(736)
    dash, gap = sc(6), sc(4)
    for start in range(left + sc(7), right - sc(7), dash + gap):
        draw.line((start, top, min(start + dash, right), top), fill="#6D89AE", width=sc(1.25))
        draw.line((start, bottom, min(start + dash, right), bottom), fill="#6D89AE", width=sc(1.25))
    for start in range(top + sc(7), bottom - sc(7), dash + gap):
        draw.line((left, start, left, min(start + dash, bottom)), fill="#6D89AE", width=sc(1.25))
        draw.line((right, start, right, min(start + dash, bottom)), fill="#6D89AE", width=sc(1.25))
    centred_lines(510, 657, ["Supplementary Post-hoc Diagnostics"], 16, bold=True)
    draw.line((sc(509), sc(685), sc(509), sc(721)), fill="#91A3BB", width=sc(1))
    centred_lines(321, 685, ["E4 fixed-R1 feature sensitivity", "(no retroactive reselection)"], 14, colour=SECONDARY, line_height=20)
    centred_lines(697, 685, ["E6 Rubber coverage sensitivity", "(non-causal repeated reductions)"], 14, colour=SECONDARY, line_height=20)

    image.save(png_path, dpi=(600, 600), optimize=True)
    image.save(tif_path, dpi=(600, 600), compression="tiff_lzw")
    image.save(pdf_path, "PDF", resolution=600)


def build_figure3(output_dir: Path = DEFAULT_OUTPUT, stem: str = DEFAULT_STEM) -> list[Path]:
    """Render the approved Figure 3 workflow as editable SVG, PNG, TIFF, PDF, and CSV."""

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    svg_path = output_dir / f"{stem}.svg"
    png_path = output_dir / f"{stem}.png"
    tif_path = output_dir / f"{stem}.tif"
    pdf_path = output_dir / f"{stem}.pdf"
    csv_path = output_dir / f"{stem}_nodes.csv"

    svg_path.write_text(build_svg(), encoding="utf-8")
    try:
        import cairosvg
        from PIL import Image

        cairosvg.svg2png(
            bytestring=svg_path.read_bytes(),
            write_to=str(png_path),
            output_width=RASTER_WIDTH,
            output_height=RASTER_HEIGHT,
        )
        with Image.open(png_path) as rendered:
            rgb = rendered.convert("RGB")
            rgb.save(png_path, dpi=(600, 600), optimize=True)
            rgb.save(tif_path, dpi=(600, 600), compression="tiff_lzw")
        cairosvg.svg2pdf(bytestring=svg_path.read_bytes(), write_to=str(pdf_path))
    except (ImportError, OSError, AttributeError):
        _render_with_pillow(png_path, tif_path, pdf_path)
    write_node_manifest(csv_path)
    return [svg_path, png_path, tif_path, pdf_path, csv_path]


def publish(outputs: list[Path]) -> list[Path]:
    """Replace the approved Figure 3 assets while keeping the Python source in 06_CODE."""
    final_dir = PROJECT / "05_FIGURES" / "FINAL"
    editable_dir = PROJECT / "05_FIGURES" / "EDITABLE"
    data_dir = PROJECT / "05_FIGURES" / "FINAL_SOURCE_DATA"
    final_dir.mkdir(parents=True, exist_ok=True)
    editable_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    published = []
    for path in outputs:
        if path.suffix.lower() in {".png", ".tif", ".pdf", ".svg"}:
            destination = final_dir / path.name
            shutil.copy2(path, destination)
            published.append(destination)
        if path.suffix.lower() == ".svg":
            destination = editable_dir / path.name
            shutil.copy2(path, destination)
            published.append(destination)
        if path.suffix.lower() == ".csv":
            destination = data_dir / "Figure_3_workflow_nodes.csv"
            shutil.copy2(path, destination)
            published.append(destination)
    return published


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild the RSASE Figure 3 evidence-sequence workflow.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--stem", default=DEFAULT_STEM)
    parser.add_argument(
        "--publish",
        action="store_true",
        help="also replace Figure3_supervisor_R1 assets in 05_FIGURES/FINAL and EDITABLE",
    )
    args = parser.parse_args()
    outputs = build_figure3(args.output_dir, args.stem)
    for path in outputs:
        print(path)
    if args.publish:
        for path in publish(outputs):
            print(f"published: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
