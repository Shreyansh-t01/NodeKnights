# Multiple Gemini API Requests Analysis Report

## Reason for Multiple Requests Despite Single User Click

The repeated Gemini API failures occur because a single "Get Insights" button click triggers multiple separate AI generation requests to the Gemini API. This happens due to the application's architecture where insights are generated at multiple levels for a single contract analysis.

### Root Cause Analysis

1. **Multi-Level Insight Generation**:
   - **Contract Overview**: One request to generate an overall contract summary and recommendations
   - **Clause-Level Insights**: Up to 5 separate requests for individual high-risk clauses identified in the contract

2. **Backend Processing Flow**:
   - When a user clicks "Get Insights" on a contract, the frontend calls `api.getContractInsights(contractId)`
   - This triggers `buildContractInsights()` in the backend
   - `buildContractInsights()` calls:
     - `generateContractOverview()` - attempts Gemini API call for contract summary
     - `buildAutomaticClauseInsights()` - selects up to 5 high-risk clauses and calls `generateClauseInsight()` for each

3. **Individual API Calls**:
   - Each `generateClauseInsight()` function independently checks `isGeminiEnabled()` and attempts a Gemini API call
   - If the API key is valid but rate limits are exceeded or temporary service issues occur, each call fails individually
   - The application has fallback logic, so it continues working with template-based responses

### Why Multiple Requests Occur

- **Sequential Processing**: The backend processes insights sequentially, not in parallel
- **Per-Clause Generation**: Each high-risk clause requires its own AI analysis
- **No Request Batching**: The current implementation doesn't batch multiple clauses into a single API call
- **Independent Fallbacks**: Each insight generation has its own error handling and fallback mechanism

### Code Locations Involved

- **Frontend Trigger**: `ContractReviewCard.jsx` "Get Insights" button → `onOpenInsights()` → `handleOpenInsights()` in `App.jsx`
- **API Endpoint**: `GET /api/contracts/:contractId/insights` → `getInsights()` controller
- **Backend Processing**: `buildContractInsights()` → `generateContractOverview()` + `buildAutomaticClauseInsights()` → multiple `generateClauseInsight()` calls
- **Gemini Calls**: `insight.service.js` functions attempt individual API requests

### Impact on API Limits

With 18 contracts in the system, if each has multiple high-risk clauses:
- Each "Get Insights" click can generate 6+ API calls (1 overview + 5 clauses)
- If users analyze multiple contracts, this quickly accumulates API usage
- Rate limits or temporary service degradation affects all calls simultaneously

## How to Fix the Multiple Request Issue

### Option 1: Implement Request Batching
Modify `buildAutomaticClauseInsights()` to batch multiple clause insights into a single Gemini API call instead of individual requests.

### Option 2: Add Request Caching
Cache successful Gemini responses to avoid repeated API calls for the same contract/clause combinations.

### Option 3: Implement Rate Limiting
Add delays between API calls or implement exponential backoff for failed requests.

### Option 4: Reduce Insight Scope
Limit the number of automatic clause insights generated per contract (currently up to 5) to reduce API usage.

### Option 5: Disable Gemini Temporarily
As a quick fix, set `GENAI_PROVIDER=template` in `.env` to use only template fallbacks, eliminating API calls entirely.

### Option 6: Optimize API Usage
- Use Gemini's batch processing capabilities if available
- Implement smarter clause selection to prioritize only the most critical insights
- Add user preference to control insight depth vs. API usage

## Recommended Immediate Fix

Since the API key is confirmed valid, the issue is likely rate limiting from multiple concurrent requests. Implement Option 3 (rate limiting) by adding delays between API calls in `generateStructuredObject()` or `runGeminiRequest()`.

For a production fix, implement Option 1 (request batching) to consolidate multiple clause insights into fewer, more efficient API calls.</content>
<parameter name="filePath">d:\PROJECTS\SOLUTIONHACKATHON\MULTIPLE_REQUESTS_ANALYSIS_REPORT.md