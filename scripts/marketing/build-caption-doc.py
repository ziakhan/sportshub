"""
Builds the shareable Word document for the Instagram launch: every post with
its creative, its caption and its hashtags, in posting order.

    python3 scripts/marketing/build-caption-doc.py [outPath]

Single source of truth is docs/marketing/instagram-launch-captions-2026-08.md,
which is parsed here rather than retyped, so the document cannot drift from
the copy that ships. Images come from a render of the creatives, so run
render-creatives.mjs first if any card has changed.

Google Docs imports .docx with images intact, which is why this is a .docx
rather than a PDF: the team can edit the captions in the shared doc.
"""
import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor

REPO = Path(__file__).resolve().parents[2]
DOC = REPO / "docs/marketing/instagram-launch-captions-2026-08.md"
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(
    "/private/tmp/claude-501/-Users-ziakhan-zia-personal-sportshub"
    "/3a61122f-9c3c-432b-b6eb-701864840679/scratchpad/creatives"
)
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / "instagram-launch-posts.docx"

BASE_TAGS = "#youthbasketball #ontariobasketball #gtabasketball #basketballparents"
EXTRA_TAGS = {"7": "#basketballleague", "9": "#basketballtrainer", "10": "#basketballtryouts"}

NAVY = RGBColor(0x0B, 0x16, 0x28)
GREY = RGBColor(0x74, 0x74, 0x86)
ORANGE = RGBColor(0xF2, 0x4E, 0x1E)


def parse():
    """Pull post number, title, creative slug, ask type and caption per post."""
    raw = DOC.read_text()
    posts = []
    for block in re.split(r"^## ", raw, flags=re.M)[1:]:
        head = block.split("\n", 1)[0]
        m = re.match(r"^(\d+)\s+·\s+(.+)$", head)
        if not m:
            continue
        slug = re.search(r"`([a-z0-9-]+)`", block)
        if not slug:
            continue
        ask = re.search(r"\*\*Ask: (\w+)\*\*", block)
        quoted = [l[2:].rstrip() if l.startswith("> ") else "" for l in block.split("\n") if l.startswith(">")]
        # The doc hard-wraps for reading; a caption must not.
        paras = [
            " ".join(p.split())
            for p in "\n".join(quoted).split("\n\n")
            if p.strip()
        ]
        posts.append({
            "no": m.group(1),
            "title": m.group(2).strip(),
            "slug": slug.group(1),
            "ask": (ask.group(1) if ask else "reply"),
            "paras": paras,
        })
    return sorted(posts, key=lambda p: int(p["no"]))


def main():
    posts = parse()
    d = Document()

    for s in d.sections:
        s.top_margin = s.bottom_margin = Inches(0.7)
        s.left_margin = s.right_margin = Inches(0.9)

    t = d.add_heading("SportsHub One — Instagram launch", level=0)
    t.runs[0].font.color.rgb = NAVY
    sub = d.add_paragraph()
    r = sub.add_run(f"{len(posts)} posts, in order. Creative, caption and hashtags for each.")
    r.font.size = Pt(11)
    r.font.color.rgb = GREY

    note = d.add_paragraph()
    r = note.add_run(
        "One ask per post. “Reply” posts ask a question to earn comments; “convert” "
        "posts ask for the click. Post the seed together to fill the grid, then space "
        "the rest out. Captions are editable here; the images are final exports at "
        "1080×1350 (feed 4:5)."
    )
    r.font.size = Pt(9.5)
    r.font.color.rgb = GREY

    missing = []
    for p in posts:
        d.add_page_break()

        h = d.add_heading(f"Post {p['no']} — {p['title']}", level=1)
        h.runs[0].font.color.rgb = NAVY

        meta = d.add_paragraph()
        r = meta.add_run(f"{p['slug']}   ·   ask: {p['ask']}")
        r.font.size = Pt(9)
        r.font.color.rgb = GREY

        img = SHOTS / f"{p['slug']}-portrait.png"
        if img.exists():
            pic = d.add_paragraph()
            pic.alignment = WD_ALIGN_PARAGRAPH.CENTER
            pic.add_run().add_picture(str(img), width=Inches(3.6))
        else:
            missing.append(p["slug"])
            d.add_paragraph(f"[missing render: {img.name}]")

        cap = d.add_heading("Caption", level=2)
        cap.runs[0].font.color.rgb = ORANGE
        for i, para in enumerate(p["paras"]):
            para_el = d.add_paragraph()
            run = para_el.add_run(para)
            run.font.size = Pt(11.5)
            # The last paragraph is the ask; give it weight so it is obvious.
            if i == len(p["paras"]) - 1 and len(p["paras"]) > 1:
                run.bold = True

        tags = d.add_paragraph()
        r = tags.add_run(BASE_TAGS + (" " + EXTRA_TAGS[p["no"]] if p["no"] in EXTRA_TAGS else ""))
        r.font.size = Pt(10)
        r.font.color.rgb = GREY

    OUT.parent.mkdir(parents=True, exist_ok=True)
    d.save(OUT)
    size = OUT.stat().st_size / 1_048_576
    print(f"wrote {OUT}  ({len(posts)} posts, {size:.1f} MB)")
    if missing:
        print("MISSING RENDERS:", ", ".join(missing))


if __name__ == "__main__":
    main()
