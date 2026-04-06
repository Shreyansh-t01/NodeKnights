# Errors And Reasons

This file records the concrete backend issues found and fixed during the PDF upload debugging pass on 2026-04-06.

## 1. `pdfParse is not a function`

- Symptom: PDF upload failed inside `documentExtraction.service.js` with `TypeError: pdfParse is not a function`.
- Root cause: the project is using `pdf-parse@2.4.5`, which no longer exposes the old v1 callable default API. It exports `PDFParse` as a class.
- Fix: updated the extraction code to support both export shapes:
  - v1: callable parser function
  - v2: `new PDFParse({ data: buffer }).getText()`
- Verification: a generated smoke-test PDF was parsed successfully and returned text plus page count.

## 2. PDF text was polluted by page markers

- Symptom: `pdf-parse` v2 inserted text like `-- 1 of 1 --` into extracted output.
- Root cause: `PDFParse#getText()` adds a default page joiner unless it is overridden.
- Fix: changed PDF extraction to call `getText({ pageJoiner: '' })`.
- Verification: the same smoke-test PDF now returns only the document text.

## 3. Missing upload buffer or mimetype could trigger follow-on runtime errors

- Symptom: the extraction flow assumed `file.buffer` and `file.mimetype` always existed.
- Root cause: `extractTextFromDocument()` accessed `file.buffer` and `file.mimetype.startsWith(...)` without guarding invalid upload objects.
- Fix: added validation for an in-memory `Buffer` and normalized the mimetype lookup before branching.
- Verification: module load and extraction smoke tests pass with the new guard path in place.

## 4. INR money detection was broken in heuristic analysis

- Symptom: the local ML fallback could miss rupee amounts in contract text.
- Root cause: the money regex contained an encoding-corrupted rupee symbol instead of a stable expression.
- Fix: replaced the symbol with the ASCII-safe Unicode escape `\u20B9`.
- Verification: forced ML fallback detected `\u20B9 80,000` correctly during smoke testing.

## 5. Local ML fallback was effectively disabled by default

- Symptom: uploads could still fail in local development when the Python ML service was down, even though the backend includes a heuristic fallback.
- Root cause: `requirePythonMlService` defaulted to `true`, and `.env.example` also set `REQUIRE_PYTHON_ML_SERVICE=true`.
- Fix:
  - changed the code default to `false`
  - changed `.env.example` to `REQUIRE_PYTHON_ML_SERVICE=false`
- Verification: with `ML_SERVICE_URL` intentionally pointed to an unavailable port, analysis completed through `node-heuristic-fallback` instead of failing.

## Verification Summary

The following checks passed after the fixes:

- backend-wide syntax check across all runtime `.js` files in `backend/config`, `backend/controllers`, `backend/errors`, `backend/middlewares`, `backend/routes`, `backend/services`, and `backend/utils`
- require/load smoke test for all backend source modules
- text contract ingestion smoke test
- forced ML-service-down fallback smoke test
- generated PDF extraction smoke test

## Note

This report covers the concrete issues discovered during this debugging and smoke-test pass. No additional syntax or module-load errors were found in the checked backend code paths.
