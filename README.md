# Order Formatter — ADJ/DJ Court

Upload a daily **cause list** (`.docx` / `.odt`) and instantly generate the
compiled **order sheets** — one page per case — as a downloadable `.docx` or
`.odt`, with the classic judge stamp, live preview, and all formatting
controls. Everything runs locally in the browser; the cause list never leaves
the computer.

## Run it

```bash
npm start          # serves on http://localhost:8420
```

Then open <http://localhost:8420>. Try it with `samples/sample-cause-list.docx`.

## Tests

```bash
npm test           # pipeline tests (Node, no dependencies to install)
```

## What it does

1. **Upload** — drag & drop or browse for a `.docx`/`.odt` cause list. The
   parser reads the court header, judge, list date (`CAUSE LIST DATED
   13-08-2026`), declared total, stage headers (`Misc. cases`, `Final
   Arguments`, …) and every numbered entry — including titles that wrap onto
   the next line and entries with old + new case numbers
   (`LC 413/2014 1555/16`). Party names are converted from ALL CAPS to proper
   case (`ROSHAN LAL Vs. M/S SABDA EXPORTS` → `Roshan Lal Vs. M/S Sabda
   Exports`). Parse problems are reported as notes, never hidden — the parsed
   count is checked against the declared total.
2. **Details** — ADJ/DJ Court, Classic Stamp. Judge name / designation /
   court name default to *Neeraj Gaur, Presiding Officer Labour Court-01,
   RADC* and are fully editable; **Save Judge Details** stores extra profiles
   in the browser (load with one click, delete with ✕). Controls: right-align
   case details, stamp location (New Delhi / Delhi / Haryana / Punjab), bold
   case details / date / stamp, appearance & body line spacing (1.0/1.5/2.0),
   stamp alignment (**Perfect Right** or **Offset Right 12/4/2/2** trailing
   spaces), steno initials appended to the stamp date, cause list date
   (auto-filled from the file, shown in the `dd.mm.yyyy` target format), and
   include case indices.
3. **Generate** — download the compiled sheets as `.docx` or `.odt`
   (Times New Roman 14pt, A4, 4 cm left/right and 2.5 cm top/bottom margins,
   page break between cases). The sidebar shows a live paper preview and a
   parsed-cases table, plus the **Split Court PDF Documents** companion link.

Each generated sheet looks like:

```
L I R 2365/21
Roshan Lal Vs. M/S Sabda Exports

13.08.2026

Present:

            [ blank space for the order text ]

                                        (Neeraj Gaur)
                                        Presiding Officer Labour Court-01
                                        RADC, New Delhi
                                        13.08.2026
```

## Configuration

- **PDF splitter link**: set `PDF_SPLITTER_URL` in [js/config.js](js/config.js).
- Defaults (judge profile, stamp locations, blank-line counts, page metrics)
  are also in [js/config.js](js/config.js).

## Architecture

```
UI (index.html + js/main.js)   ← upload, options, profiles, preview, downloads
        │
js/docread.js     .docx/.odt (zip+XML) → plain-text paragraphs
js/causelist.js   paragraphs → header info + structured case entries
js/sheets.js      cases + options → per-case sheet model (shared by all outputs)
js/docxgen.js     sheet models → .docx bytes (hand-built OOXML)
js/odtgen.js      sheet models → .odt bytes (hand-built ODF)
js/format.js      title-casing, date formats, XML escaping
js/config.js      defaults & constants
js/vendor/fflate.js   zip read/write (vendored, MIT)
```

The pipeline modules have no DOM dependencies and run identically in Node —
`tests/run-tests.mjs` builds a real fixture cause list (39 cases mirroring an
actual Labour Court list), parses it, and verifies both generated documents,
including a round-trip back through the app's own reader.
