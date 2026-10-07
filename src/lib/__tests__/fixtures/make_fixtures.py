"""Regenerates the spreadsheet fixtures used by spreadsheet.test.js.

The .xlsx files are written as raw OOXML (zip + XML, shared strings, a real
date style) laid out the way Excel saves them — deliberately NOT with ExcelJS,
so the tests read files produced by an independent writer.

    python3 make_fixtures.py
"""
import datetime
import zipfile
from xml.sax.saxutils import escape

HERE = __file__.rsplit("/", 1)[0]


def serial(y, m, d):
    return (datetime.date(y, m, d) - datetime.date(1899, 12, 30)).days


class Sheet:
    def __init__(self, rows, hyperlinks=()):
        self.rows, self.hyperlinks = rows, hyperlinks


def col(i):
    return "ABCDEFGHIJ"[i]


def build(path, sheets, date1904=False):
    strings, index = [], {}

    def sst(s):
        if s not in index:
            index[s] = len(strings)
            strings.append(s)
        return index[s]

    def cell_xml(ref, v):
        if v is None:
            return ""
        if isinstance(v, str):
            return f'<c r="{ref}" t="s"><v>{sst(v)}</v></c>'
        if isinstance(v, tuple) and v[0] == "date":  # number with the Excel date style (s=1)
            return f'<c r="{ref}" s="1"><v>{v[1]}</v></c>'
        if isinstance(v, tuple) and v[0] == "formula":  # formula with cached date value
            return f'<c r="{ref}" s="1"><f>{v[1]}</f><v>{v[2]}</v></c>'
        return f'<c r="{ref}"><v>{v}</v></c>'  # General-format number

    sheet_xml = []
    for sh in sheets:
        body = []
        for r, row in enumerate(sh.rows, 1):
            cells = "".join(cell_xml(f"{col(c)}{r}", v) for c, v in enumerate(row))
            body.append(f'<row r="{r}">{cells}</row>' if cells else "")
        links = ""
        if sh.hyperlinks:
            links = "<hyperlinks>" + "".join(
                f'<hyperlink ref="{ref}" r:id="rId{i}"/>' for i, (ref, _) in enumerate(sh.hyperlinks, 1)
            ) + "</hyperlinks>"
        sheet_xml.append(
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f'<sheetData>{"".join(body)}</sheetData>{links}</worksheet>'
        )

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            + "".join(
                f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                for i in range(1, len(sheets) + 1)
            )
            + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
            "</Types>",
        )
        z.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>",
        )
        z.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            + (f'<workbookPr date1904="1"/>' if date1904 else "")
            + "<sheets>"
            + "".join(
                f'<sheet name="{escape(s_name)}" sheetId="{i}" r:id="rId{i}"/>'
                for i, s_name in enumerate([s.title for s in sheets], 1)
            )
            + "</sheets></workbook>",
        )
        z.writestr(
            "xl/_rels/workbook.xml.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + "".join(
                f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
                for i in range(1, len(sheets) + 1)
            )
            + f'<Relationship Id="rId{len(sheets)+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            f'<Relationship Id="rId{len(sheets)+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
            "</Relationships>",
        )
        z.writestr(
            "xl/styles.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
            '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'
            "</styleSheet>",
        )
        for i, (xml, sh) in enumerate(zip(sheet_xml, sheets), 1):
            z.writestr(f"xl/worksheets/sheet{i}.xml", xml)
            if sh.hyperlinks:
                z.writestr(
                    f"xl/worksheets/_rels/sheet{i}.xml.rels",
                    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                    + "".join(
                        f'<Relationship Id="rId{n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="{escape(t)}" TargetMode="External"/>'
                        for n, (_, t) in enumerate(sh.hyperlinks, 1)
                    )
                    + "</Relationships>",
                )
        z.writestr(
            "xl/sharedStrings.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{len(strings)}" uniqueCount="{len(strings)}">'
            + "".join(f'<si><t xml:space="preserve">{escape(s)}</t></si>' for s in strings)
            + "</sst>",
        )


def titled(title, rows, hyperlinks=()):
    s = Sheet(rows, hyperlinks)
    s.title = title
    return s


HEADER = ["Name", "Phone", "Email", "Telegram", "Referred By", "Stage", "Last Contact", "Next Follow-up"]

customers = [
    HEADER,
    # real-looking rows: numeric phone, date-styled cells, a General-format serial, a hyperlinked email
    ["Jane Doe", 5551234567, "jane.doe@email.com", "@janedoe", "John Smith", "CP", ("date", serial(2026, 8, 1)), serial(2026, 8, 20)],
    ["SAMPLE — delete this row before importing", "(555) 123-4567", "jane.doe@email.com", "@janedoe", "John Smith", "CP", "2026-08-01", "2026-08-20"],
    [],  # blank row in the middle of the data
    [None, "(555) 000-0000", "nameless@email.com"],  # no name -> a failure
    ["John  Smith Jr", "416-555-0199", "john@smith.ca", None, None, "strategy meeting", "2026-08-15", ("formula", "DATE(2026,9,1)", serial(2026, 9, 1))],
    ["Mary O'Neil-Brown", None, None, None, "Jane Doe", "not a stage", ("date", serial(2026, 12, 31)), ("date", serial(2027, 1, 1))],
]
notes = [["Internal"], ["this second sheet must be ignored"]]
build(
    HERE + "/customers-export.xlsx",
    [titled("Clients Export", customers, hyperlinks=[("C2", "mailto:jane.doe@email.com")]), titled("Notes", notes)],
)

# header named __proto__ / constructor: must not touch Object.prototype
build(
    HERE + "/proto-pollution.xlsx",
    [titled("Clients", [["Name", "__proto__", "constructor", "prototype", "Phone"], ["Eve Attacker", "polluted", "polluted", "polluted", 5550001111]])],
)

# 1904 date system (older Mac Excel): serials are offset by 1462 days
build(
    HERE + "/date1904.xlsx",
    [titled("Clients", [["Name", "Next Follow-up"], ["Old Mac", ("date", serial(2026, 8, 20) - 1462)]])],
    date1904=True,
)

# CSV: BOM, CRLF, quoted comma, escaped quote, newline inside quotes, US + text dates, blank line, serial as text
with open(HERE + "/customers-export.csv", "w", encoding="utf-8", newline="") as f:
    f.write(
        "﻿Name,Phone,Email,Telegram,Referred By,Stage,Last Contact,Next Follow-up\r\n"
        'Jane Doe,(555) 123-4567,jane.doe@email.com,@janedoe,"Smith, John",CP,8/1/2026,2026-08-20\r\n'
        "SAMPLE — delete this row before importing,,,,,,,\r\n"
        "\r\n"
        '"O""Hara, Pat",5551230000,pat@x.com,,,FC1,,46255\r\n'
        'Multi Line,"line one\nline two",m@x.com,,,,,\r\n'
    )

# semicolon-delimited, Windows-1252 (what some European Excel installs save as "CSV")
with open(HERE + "/semicolon-cp1252.csv", "wb") as f:
    f.write("Name;Phone;Email\r\nZoë Müller;5559990000;zoe@x.com\r\n".encode("cp1252"))
