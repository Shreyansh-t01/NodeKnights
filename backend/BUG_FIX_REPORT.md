# Backend Bug Fix Report

This file explains the bugs I found while fixing the upload flow and related backend issues.

## 1. `/api/upload` route did not exist

Reason:
The backend only had `POST /api/documents/upload`. If the frontend called `POST /api/upload`, Express correctly returned "Route not found".

Fix:
I added an alias route so both of these now work:
- `POST /api/upload`
- `POST /api/documents/upload`

## 2. Upload route was missing authentication middleware

Reason:
The upload controller reads `req.user.userId`, but the route did not run `authenticate` first. That means `req.user` could be empty and the request could crash.

Fix:
I added `authenticate` to the upload route handlers.

## 3. Upload controller used `this.processDocumentAsync(...)`

Reason:
Express calls route handlers as plain functions. In that situation, `this` inside the class method is not reliable. That can break async document processing after upload.

Fix:
I changed it to `DocumentController.processDocumentAsync(...)`.

## 4. Error handler had the wrong Express signature

Reason:
Express error middleware should receive 4 arguments: `(err, req, res, next)`.
The code only had 3 arguments, so some upload errors from `multer` might not be handled correctly.

Fix:
I updated the error handler signature to the proper Express format.

## 5. Document update code could crash on normal updates

Reason:
`DocumentService.updateDocument()` tried to do:
`updateData.timestamps.updatedAt = new Date()`

If `timestamps` was missing in the incoming update object, this caused:
"Cannot set properties of undefined"

Fix:
I now safely create the `timestamps` object before adding `updatedAt`.

## 6. Bulk update code had the same timestamps bug

Reason:
`bulkUpdateDocuments()` had the same pattern and could fail for the same reason.

Fix:
I applied the same safe timestamps merge there too.

## 7. Firestore retry counter used the wrong object

Reason:
The code used `db.FieldValue.increment(1)`, but `FieldValue` is not available from the Firestore instance like that.

Fix:
I changed it to `admin.firestore.FieldValue.increment(1)`.

## 8. Backend gave unclear crashes when Firebase was not configured

Reason:
If `firebase-service-account.json` was missing, `db` became undefined. Later, code tried to use `db.collection(...)`, which caused confusing runtime errors.

Fix:
I added a clear guard in `DocumentService` so the error message now explains that Firestore is not initialized and the Firebase credentials file is required.

## 9. Image uploads used a Linux-only temp path and never wrote the file

Reason:
The image extraction code built a path like `/tmp/...`, which is wrong on Windows. It also never saved the uploaded buffer before calling OCR, so OCR had nothing real to read.

Fix:
I changed image extraction to:
- create a real temp file using the OS temp directory
- write the uploaded image buffer to that file
- run OCR on it
- delete the temp file afterward

## 10. `.doc` files were allowed but not truly supported

Reason:
The route allowed `application/msword`, but the extraction code only properly handled DOCX with `mammoth`.
That means some Word uploads would be accepted first and fail later during processing.

Fix:
I removed old `.doc` acceptance from the upload filter so unsupported files are rejected early with a clear validation failure.

## 11. Search logic looked in the wrong document field

Reason:
Search checked `doc.content`, but processed upload text is stored in `doc.extraction.extractedText`.
So search could miss uploaded content even after processing finished.

Fix:
I updated search to look in extracted text and stored keywords/topics.

## 12. Logger calls used the wrong method format

Reason:
The custom logger expects `logger.info(...)` or `logger.log(level, message)`.
Some controllers called `logger.log(message, data)`, which made logs messy and misleading.

Fix:
I changed those calls to `logger.info(...)`.

## 13. Authentication middleware printed tokens to the console

Reason:
The middleware was doing `console.log(token)`.
That can leak sensitive auth tokens into terminal logs.

Fix:
I removed the token logging.

## 14. Async processing could still throw an unhandled rejection

Reason:
The upload request starts background processing without waiting for it.
If the background failure-handling step also failed, Node could still log an unhandled promise rejection.

Fix:
I added a final safety catch around background processing and a protected fallback when marking a document as failed.

## 15. Upload auth failures were too vague

Reason:
`POST /api/upload` and `POST /api/documents/upload` are protected routes.
When the frontend uploaded a file without an `Authorization` header, the backend only returned `"No token provided"`, which did not clearly explain that the upload route requires a Bearer JWT before file parsing begins.

Fix:
I updated the authentication middleware to return clearer 401 responses for:
- missing `Authorization` header
- malformed `Authorization` header
- expired JWT
- invalid JWT

The missing-header response now points directly to the current route so upload failures are easier to identify during integration.

## 16. Authentication temporarily disabled for development

Reason:
You requested that authorization be removed for now so uploads and the rest of the API can be used without JWT setup blocking development.

Fix:
I changed the shared `authenticate` middleware to allow every request through and attach:
- `req.user.userId = req.headers['x-user-id']`
- fallback `req.user.userId = 'dev-user'` when no header is provided

This keeps the current controllers working without route rewrites while auth is turned off.

## 17. File-only uploads are supported without extra text fields

Reason:
Users may upload just a file without sending `title`, `description`, or `contentType`.

Fix:
I made the upload controller safely handle an empty request body and documented the required Postman format:
- use `multipart/form-data`
- send one file field named `file`
- `title`, `description`, and `contentType` remain optional

If those fields are omitted, the backend uses the original filename as the title and an empty string as the description.

## 18. Firebase bootstrap aligned with the official Firestore Admin SDK pattern

Reason:
The Firebase database layer was working from a custom initialization flow. You asked to reset it around the official Firestore Admin SDK boilerplate without changing what gets stored.

Fix:
I updated `src/database/firebase.js` to use:
- `initializeApp(...)` from `firebase-admin/app`
- `cert(...)` for service-account credentials
- `getFirestore(...)` and `FieldValue` from `firebase-admin/firestore`

I kept the same Firestore collection names and document payload structure, and only updated the database bootstrap plus the retry counter helper import.

## Important setup note

There is still one non-code requirement for this backend:

- You need a valid `backend/firebase-service-account.json` file, or a correct `FIREBASE_SERVICE_ACCOUNT_PATH`, for document save/update operations to work.

Without Firebase credentials, the route exists and the code is cleaner, but uploads cannot be stored in Firestore.
