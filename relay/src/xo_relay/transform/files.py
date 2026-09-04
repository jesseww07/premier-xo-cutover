"""FileData / ImageData parsing.

Rules (handoff §7):
  * Document files (spec / installation / warranty) match on the FileDescr keyword, NEVER on
    slot index - file-1/2/3 positions are random.
  * Values are sometimes full https:// URLs (Eurofase amplifi CDN, Dropbox); pass through.
  * Prefer structured JSON from the API (FlatFormat[FileData]=n, [ImageData]=n) so nothing
    needs splitting. String forms are parsed defensively as a fallback.

A note on the "split on the last colon" rule from the CSV era: over the API the FlatFormat
`p`/`o` string form is `Label:Value|Label:Value` (documented example:
`FileName:https://example/SpecFiles/SP-284-1W.pdf|FileDescr:Spec Sheet`). Splitting that on
the LAST colon would break every https URL. So this module splits on the FIRST colon when
the prefix is a known label, and only otherwise treats a token as a bare value. Confirm
against captured fixtures (see scripts/capture_fixtures.py) before trusting the string path.
"""
from __future__ import annotations

import re
from typing import Any, Iterable, Mapping, Optional

from ..xo.models import XOProduct, canon_key
from .normalize import absolutize_url

KNOWN_LABELS = {
    "filename", "filepath", "filedescr", "filedesc", "filetype", "fileurl", "url", "description",
    "imagename", "imagepath", "imagedescr", "imageurl", "sortorder", "sort", "type", "name", "path",
}

DOC_KEYWORDS = {
    "spec": ("spec sheet", "spec", "specification", "cut sheet"),
    "installation": ("installation", "install", "instructions", "assembly"),
    "warranty": ("warranty",),
    "maintenance": ("maintenance", "use and care", "care"),
}

_INDEXED_KEY = re.compile(r"^(?P<group>[a-z]+data)-?(?P<idx>\d+)-(?P<label>.+)$")


def _split_token(token: str) -> tuple[Optional[str], str]:
    token = token.strip()
    if not token:
        return None, ""
    head, sep, tail = token.partition(":")
    if sep and head.strip().lower() in KNOWN_LABELS and not head.strip().lower().startswith("http"):
        return head.strip(), tail.strip()
    return None, token


def parse_entries(value: Any) -> list[dict[str, str]]:
    """Normalize any FlatFormat shape of FileData/ImageData to a list of {label: value} dicts."""
    if value in (None, ""):
        return []
    if isinstance(value, list):
        out: list[dict[str, str]] = []
        for item in value:
            if isinstance(item, dict):
                out.append({str(k): ("" if v is None else str(v)) for k, v in item.items()})
            elif isinstance(item, str):
                out.extend(parse_entries(item))
        return out
    if isinstance(value, dict):
        # either a single entry or an index-keyed dict {"1": {...}, "2": {...}}
        if all(isinstance(v, dict) for v in value.values()) and value:
            return [parse_entries(v)[0] for _k, v in sorted(value.items(), key=lambda kv: _idx_sort(kv[0])) if parse_entries(v)]
        return [{str(k): ("" if v is None else str(v)) for k, v in value.items()}]
    # string: Label:Value|Label:Value  (one entry) - or bare URL(s) separated by |
    tokens = [t for t in str(value).split("|") if t.strip()]
    entry: dict[str, str] = {}
    entries: list[dict[str, str]] = []
    bare_idx = 0
    for tok in tokens:
        label, val = _split_token(tok)
        if label is None:
            # a bare value: treat as a path/URL entry of its own
            entries.append({"FilePath": val, "_bare": "1"})
            bare_idx += 1
            continue
        if label in entry:  # a repeated label starts a new entry
            entries.append(entry)
            entry = {}
        entry[label] = val
    if entry:
        entries.append(entry)
    return entries


def _idx_sort(k: str):
    try:
        return int(k)
    except (TypeError, ValueError):
        return 10**9


def collect_indexed(product: XOProduct, group: str) -> list[dict[str, str]]:
    """FlatFormat `k` shape: keys like `ImageData-1-FileName`, `ImageData-1-FilePath`."""
    cg = canon_key(group)
    buckets: dict[int, dict[str, str]] = {}
    for orig in product.raw.keys():
        m = _INDEXED_KEY.match(canon_key(orig))
        if not m or m.group("group") != cg:
            continue
        idx = int(m.group("idx"))
        label = m.group("label")
        v = product.raw[orig]
        buckets.setdefault(idx, {})[_relabel(label)] = "" if v is None else str(v)
    return [buckets[i] for i in sorted(buckets)]


def _relabel(canon_label: str) -> str:
    return {
        "filename": "FileName", "filepath": "FilePath", "filedescr": "FileDescr", "filetype": "FileType",
        "imagename": "ImageName", "imagepath": "ImagePath",
    }.get(canon_label, canon_label)


def file_entries(product: XOProduct) -> list[dict[str, str]]:
    entries = parse_entries(product.get("FileData"))
    if not entries:
        entries = collect_indexed(product, "FileData")
    return entries


def image_entries(product: XOProduct) -> list[dict[str, str]]:
    entries = parse_entries(product.get("ImageData"))
    if not entries:
        entries = collect_indexed(product, "ImageData")
    return entries


def _entry_url(e: Mapping[str, str]) -> Optional[str]:
    for k in ("FilePath", "FileName", "ImagePath", "FileURL", "URL", "url", "path", "Path"):
        v = e.get(k)
        if v and (("/" in v) or v.lower().startswith("http")):
            return v
    for k in ("FilePath", "FileName", "ImagePath"):
        if e.get(k):
            return e[k]
    return None


def _entry_descr(e: Mapping[str, str]) -> str:
    for k in ("FileDescr", "FileDesc", "Description", "FileType", "Type", "ImageDescr"):
        if e.get(k):
            return e[k]
    return ""


def find_document(entries: Iterable[Mapping[str, str]], kind: str, *, base: str = "") -> Optional[str]:
    """URL of the document whose FileDescr contains a keyword for `kind`. Slot index is ignored."""
    kws = DOC_KEYWORDS[kind]
    for e in entries:
        d = _entry_descr(e).lower()
        if any(k in d for k in kws):
            url = _entry_url(e)
            if url:
                return absolutize_url(url, base)
    return None


def spec_sheet(product: XOProduct, *, base: str = "") -> Optional[str]:
    return find_document(file_entries(product), "spec", base=base)


def installation_sheet(product: XOProduct, *, base: str = "") -> Optional[str]:
    return find_document(file_entries(product), "installation", base=base)


def warranty_doc(product: XOProduct, *, base: str = "") -> Optional[str]:
    return find_document(file_entries(product), "warranty", base=base)


def primary_image(product: XOProduct, *, base: str = "") -> Optional[str]:
    v = product.first("ImagePath", "Image Path", "Image")
    if v:
        return absolutize_url(str(v), base)
    for e in image_entries(product):
        url = _entry_url(e)
        if url:
            return absolutize_url(url, base)
    return None


def gallery(product: XOProduct, *, base: str = "") -> list[str]:
    urls: list[str] = []
    for e in image_entries(product):
        url = _entry_url(e)
        if url:
            u = absolutize_url(url, base)
            if u and u not in urls:
                urls.append(u)
    return urls
