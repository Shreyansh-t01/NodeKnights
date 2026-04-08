# Technical Slide Content

## Slide Title
Legal Intelligence App: Technical Architecture

## Slide Layout

### Left Column: End-to-End Flow
- Intake from manual upload, Google Drive, and Gmail attachments
- Document extraction using `pdf-parse` for PDFs and `tesseract.js` for image OCR
- Contract analysis through a Python FastAPI ML service
- Clause-level storage, indexing, and grounded insight generation
- Reviewer workflow in separate Intake, Contracts, Insights, and Search screens

### Right Column: Implemented Stack
- Frontend: React 19 + Vite dashboard
- Backend: Node.js + Express orchestration APIs for contracts, connectors, health, and search
- ML layer: spaCy-based entity extraction with clause and risk prediction models loaded through `joblib`
- Storage: Firebase Storage + Firestore, with local file/JSON fallback when cloud services are unavailable
- Retrieval: Pinecone clause indexing, with a local vector-store fallback for development/demo mode
- Reasoning: rulebook-grounded structured responses, with optional Gemini 2.5 Flash integration and template fallback

## Footer Line
Resilient pipeline: ingest -> extract -> analyze -> store -> index -> reason -> review.

## Presenter Note
This slide is based on the current codebase implementation, including fallback modes that let the app run even when Firebase, Pinecone, Google connectors, external GenAI, or the Python ML service are not available.
