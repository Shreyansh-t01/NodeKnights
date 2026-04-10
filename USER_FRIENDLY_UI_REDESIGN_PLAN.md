# User-Friendly UI Redesign Plan

This file is a design recommendation only. No code changes are included here.

## 1. Why the current UI feels broken

The app already has strong building blocks, but the review journey is split across too many screens:

1. The user clicks **Process Contract** and does not get enough visible progress or feedback.
2. After upload, the user has to move to another route to confirm that the contract exists.
3. To see AI-generated insights, the user has to go to another page.
4. To see the original file, the user has to go to the documents route.
5. The same contract context is technically there, but the UI does not make it feel continuous.
6. The user is forced to mentally stitch together upload, contract review, insights, search, and file preview.

So the issue is not that routing is wrong. The issue is that the main review experience is fragmented.

## 2. What is already good

These parts are already strong and should be preserved:

1. Route separation keeps the product from feeling cluttered.
2. The app already has distinct capabilities:
   - intake
   - contract listing
   - clause/risk review
   - AI insights
   - semantic search
   - raw document preview
3. Contract-centered data already exists in the system.
4. The documents route is useful as a dedicated library/search surface.
5. The contracts page already moved in a better direction by attaching clause review to the contract.

So the redesign should not collapse everything into one giant page. It should create one **primary review workspace** where the user can do the main job without route hopping.

## 3. Main design goal

The app should feel like this:

1. Upload a contract.
2. See processing progress immediately.
3. Land directly inside the uploaded contract workspace.
4. Read the original document there.
5. Inspect contract risks there.
6. Open clause-level review there.
7. See AI insights there.
8. Jump to semantic search or precedent compare only when needed.

That means the product should become **contract-centric**, not **feature-centric**.

## 4. Recommended information architecture

Keep routing, but reorganize it around the user journey.

### Recommended primary routes

1. `/`
   - Dashboard / overview only
   - Not the main work screen

2. `/intake`
   - Upload, connectors, ingestion status

3. `/review/:contractId`
   - The main contract workspace
   - This should replace the need to jump between Contracts, Insights, and Documents during review

4. `/search`
   - Cross-contract semantic search and precedent retrieval

5. `/documents`
   - Optional library / file retrieval route
   - Useful for admin, archive lookup, and direct file access
   - Not part of the default review journey

### What should happen to current routes

1. `/contracts`
   - Can become a lightweight contract list that redirects into `/review/:contractId`
   - Or it can be removed later if `/review/:contractId` includes a contract switcher

2. `/insights`
   - Should not remain a standalone primary workflow page
   - Insights should live inside the review workspace as a tab/panel

3. `/documents`
   - Keep it, but treat it as a supporting route, not the place users must visit to finish review

## 5. The best UX model for this product

The product should revolve around one **Review Workspace**.

### Core idea

When a user opens a contract, the screen should show:

1. The contract identity
2. The original document
3. Clause navigation
4. Risk board
5. AI insights
6. Search / precedent actions

All of that should be available from one workspace with tabs, drawers, or side panels.

## 6. Proposed Review Workspace design

Route:

`/review/:contractId`

### Desktop layout

Use a 3-panel layout:

1. **Left rail**
   - Contract switcher / tracked contracts
   - Contract quick facts
   - Clause navigator

2. **Center panel**
   - Native document viewer
   - PDF/image/text preview in original format
   - This becomes the main reading surface

3. **Right panel**
   - Tabbed analysis panel
   - Tabs:
     - Summary
     - Clauses
     - Risks
     - Insights
     - File

### Mobile layout

Do not keep 3 columns on mobile.

Use:

1. Contract header
2. Tab bar
3. One active panel at a time
4. Sticky action buttons for important actions

## 7. Recommended screen structure inside Review Workspace

### A. Contract header

At the top of the workspace, show:

1. Contract title
2. Contract type
3. Source
4. Upload date
5. Processing status
6. Risk summary badges
7. Primary actions:
   - Reprocess
   - Open original file
   - Download file
   - Run semantic search

This makes the user feel grounded immediately.

### B. Left rail

The left rail should include:

1. Contract search/filter
2. Tracked contracts list
3. Risk counts per contract
4. Clause navigator for the selected contract

Each clause item should show:

1. Clause type
2. Risk label
3. Small summary
4. Actions:
   - View clause
   - View risk board
   - Compare with precedents

This is much better than showing clauses detached from the document context.

### C. Center panel: native document viewer

This is the biggest missing experience in the current flow.

The original document preview should be visible directly in the review workspace.

For this panel:

1. PDF should open inline
2. Images should render inline
3. Text documents should open inline
4. There should be Open and Download actions
5. If possible later, clicking a clause in the clause list should move the document viewer near that clause location

Even if clause-to-page highlighting is not available now, placing the raw document in the same screen already solves a major UX problem.

### D. Right panel tabs

#### Summary tab

Show:

1. Contract summary
2. Parties
3. Key dates
4. Contract status
5. Number of clauses
6. High/medium/low risk counts
7. Recommended next actions

#### Clauses tab

This should show a clean list of clauses with progressive disclosure.

Each clause card should include:

1. Clause type
2. Full clause text preview
3. Risk label
4. Risk score
5. Extracted values
6. Buttons:
   - Expand full text
   - View risk board
   - View AI suggestion
   - Compare with precedent

#### Risks tab

This should be the contract-level risk board.

Show:

1. All risky clauses grouped by severity
2. Filters for High / Medium / Low
3. Why the clause is risky
4. Suggested action
5. Link back to clause location

The important part is that the risk board is no longer a separate detached section. It is part of the selected contract.

#### Insights tab

This is where AI insights should live.

Show:

1. Headline
2. Executive summary
3. Priority items
4. Next steps
5. Clause-specific insights

Important change:

Do not make the user go to a different route just to read insights for the same contract.

#### File tab

This should show:

1. Original filename
2. MIME type
3. Storage mode
4. Artifact availability
5. Open file
6. Download file
7. Processing history later if added

## 8. Upload and processing flow redesign

This is the first place where the product loses trust.

### Current problem

The user clicks **Process Contract**, but the system does not visibly reassure them enough about what is happening.

### Better flow

When the user uploads a file:

1. Show an upload card immediately
2. Show real-time or staged processing states
3. Keep the user on the same screen until the contract is ready
4. Then auto-open the new contract in the review workspace

### Processing steps to display

Show a vertical or horizontal stepper:

1. File uploaded
2. Text extracted
3. Clauses detected
4. Risks scored
5. AI insights generated
6. Search index updated
7. Contract ready

Even if some steps are simulated initially, the UI should present a clear lifecycle.

### After completion

Instead of sending the user into a separate generic page, do this:

1. Show success message
2. Auto-navigate to `/review/:contractId`
3. Open the Summary tab first
4. Keep the original document visible on the same screen

## 9. Search UX redesign

Search is useful, but it should feel connected to the contract review workflow.

### Search should exist in two modes

1. **Quick search inside Review Workspace**
   - Scoped to the current contract by default
   - Good for asking clause and risk questions while reviewing a specific contract

2. **Full Search Route**
   - Cross-contract semantic search
   - Precedent retrieval
   - Similar clause discovery
   - Benchmarking across agreements

### What search results should show

Each result should include:

1. Contract name
2. Clause type
3. Clause text snippet
4. Why it matched
5. Risk label
6. Actions:
   - Open in review workspace
   - Compare side by side
   - Add to precedent set

### Important UX rule

Search results should always lead the user back into contract context.

The user should never feel that search is a dead-end list.

## 10. Recommended navigation changes

### Current navigation problem

The nav is organized by technical features, not by the user journey.

### Better top nav

Use something like:

1. Dashboard
2. Intake
3. Review
4. Search
5. Library

Where:

1. **Review** is the main daily-use route
2. **Library** is the current documents route

### Recommended labels

Current labels like **Contracts**, **Insights**, and **Documents** are valid, but together they split one review job into multiple destinations.

Better grouping:

1. Dashboard
2. Intake
3. Review
4. Search
5. Library

This is simpler and more user-centered.

## 11. State behavior that will make the app feel much smoother

These changes are small in code terms but huge in UX terms:

1. Keep the selected contract in the URL
2. Keep the selected tab in the URL query or local UI state
3. Preserve the last selected contract when moving between pages
4. Preserve the last selected clause when opening risk board or insight panel
5. On upload success, automatically select the uploaded contract everywhere
6. When the user opens a document from search, send them to that exact contract review screen

This removes the feeling that the app is forgetting the user.

## 12. What should be visible by default

The default screen matters a lot.

### On first load

Dashboard is okay.

### After a contract is uploaded or selected

The default working destination should be the Review Workspace, not a generic list.

### Inside Review Workspace default view

Show:

1. Summary tab open
2. Original document visible
3. High-risk clauses visible in a compact list

This gives immediate value without overwhelming the screen.

## 13. How to keep the UI clean without clutter

The solution is not to show less information. The solution is to show it progressively.

### Use progressive disclosure

1. Contract list collapsed by default
2. Clause details open on demand
3. Risk board in a tab or drawer
4. AI suggestion inside expandable sections
5. Advanced metadata hidden behind secondary tabs

### Do not do this

1. Do not create separate pages for every small action
2. Do not force the user to re-select the same contract repeatedly
3. Do not make search, insights, and document preview feel unrelated

## 14. Suggested component design for future implementation

If you later implement this redesign, these would be the most useful UI building blocks:

1. `ReviewWorkspacePage`
2. `ContractWorkspaceHeader`
3. `TrackedContractsRail`
4. `ClauseNavigator`
5. `NativeDocumentViewer`
6. `AnalysisTabs`
7. `ContractSummaryPanel`
8. `ClauseReviewPanel`
9. `ContractRiskPanel`
10. `ContractInsightsPanel`
11. `QuickSearchPanel`
12. `ProcessingTimelineCard`
13. `ReviewActionBar`

## 15. Suggested mapping from current app to future design

Your current frontend already contains useful pieces that can be reorganized instead of discarded.

### Pieces that can stay conceptually

1. Upload panel
2. Contract review card logic
3. Document preview logic
4. Insights panel logic
5. Search workbench logic

### What should change

1. Move document preview into contract review flow
2. Move insights into contract review flow
3. Turn contracts page into a launcher or contract rail
4. Keep search as advanced mode plus quick search in review page
5. Keep documents route as a library, not as required review step

## 16. Recommended implementation order later

When you decide to build this, this is the safest order:

### Phase 1: Fix the broken feeling first

1. Add visible upload and processing status
2. Auto-open uploaded contract after processing
3. Create a unified `/review/:contractId` route

### Phase 2: Merge the review experience

1. Embed document viewer inside the review route
2. Move insights into a review tab
3. Move contract-level risk board into a review tab
4. Keep clause-level risk board inside the clause section

### Phase 3: Improve navigation

1. Replace Contracts + Insights with Review
2. Rename Documents to Library
3. Add contract switcher inside the review workspace

### Phase 4: Connect search better

1. Add quick search in review workspace
2. Make search results open exact contracts and clauses
3. Add side-by-side compare for precedent review

### Phase 5: Polish

1. Better loading states
2. Empty states
3. Toasts
4. Success feedback
5. Error recovery

## 17. Exact user journey this product should support

The final experience should feel like this:

1. User uploads a sports contract
2. App shows progress and does not leave the user guessing
3. App opens the contract review workspace automatically
4. User sees the real PDF in the middle
5. User sees the contract summary and risks on the side
6. User opens a clause and sees:
   - clause text
   - risk score
   - why it is risky
   - AI suggestion
   - precedent compare action
7. User can open semantic search without losing contract context
8. User can still use the library/documents route when they specifically want file retrieval

That is the UX shape that best fits your problem statement.

## 18. Best final recommendation

Do not remove routing.

Do not combine every feature into one messy page.

Instead:

1. Keep route separation at the product level
2. Create one strong **contract review workspace**
3. Make that workspace the default post-upload destination
4. Put raw file preview, clause review, risk board, and AI insights in that one workspace
5. Keep search and library as supporting routes

This gives the user both:

1. clarity
2. power

And most importantly, it makes the app feel like one product instead of several useful screens stitched together.

## 19. Files that would likely change later when implementing this

This section is only for future implementation planning.

Frontend files likely involved:

1. `frontend/src/App.jsx`
2. `frontend/src/components/AppNav.jsx`
3. `frontend/src/pages/IntakePage.jsx`
4. `frontend/src/pages/ContractsPage.jsx`
5. `frontend/src/pages/InsightsPage.jsx`
6. `frontend/src/pages/DocumentsPage.jsx`
7. `frontend/src/pages/SearchPage.jsx`
8. `frontend/src/components/UploadPanel.jsx`
9. `frontend/src/components/ContractReviewCard.jsx`
10. `frontend/src/components/ContractInsightsPanel.jsx`
11. `frontend/src/components/SearchWorkbench.jsx`
12. A new `frontend/src/pages/ReviewWorkspacePage.jsx`
13. A new native document viewer wrapper component
14. A new contract rail / clause navigator component
15. A new analysis tabs component

## 20. Short conclusion

Your app does not have a feature problem.

It has a **flow problem**.

The fix is to make the contract the center of the experience and let all major review actions happen around that contract in one workspace.
