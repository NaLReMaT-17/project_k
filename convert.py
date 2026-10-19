#!/usr/bin/env python3
"""Обёртка над pdf2docx: конвертирует PDF в DOCX."""

import sys
import os
import traceback


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: convert.py <input.pdf> <output.docx>", file=sys.stderr)
        return 2

    input_pdf = sys.argv[1]
    output_docx = sys.argv[2]

    if not os.path.isfile(input_pdf):
        print(f"Input not found: {input_pdf}", file=sys.stderr)
        return 3

    try:
        from pdf2docx import Converter
    except ImportError:
        print("pdf2docx not installed. Run: pip install pdf2docx", file=sys.stderr)
        return 4

    cv = Converter(input_pdf)
    try:
        cv.convert(output_docx, start=0, end=None)
    except Exception:
        traceback.print_exc()
        return 5
    finally:
        cv.close()

    if not os.path.isfile(output_docx):
        print("Converter did not produce output", file=sys.stderr)
        return 6

    return 0


if __name__ == "__main__":
    sys.exit(main())