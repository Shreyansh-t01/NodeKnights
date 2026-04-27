# Backend Flaws Causing Gemini Insight Generation and Semantic Answer Failures

## Overview
The backend has multiple architectural and configuration issues that cause Gemini AI API calls to fail with 429 (rate limiting) and 503 (service unavailable) errors. These failures occur during contract insight generation and semantic search answer generation, leading to degraded user experience with template fallbacks.

## 1. Rate Limiting Issues (HTTP 429)

### A. Multiple Concurrent API Calls per User Action
**Problem**: A single "Get Insights" button click triggers 6+ separate Gemini API calls:
- 1 contract overview generation
- Up to 5 individual clause insight generations

**Root Cause**: 
- `buildContractInsights()` in `contract.service.js` calls `generateContractOverview()` + `buildAutomaticClauseInsights()`
- `buildAutomaticClauseInsights()` loops through high-risk clauses calling `generateClauseInsight()` for each
- Each function independently attempts a Gemini API call

**Impact**: 
- Exceeds Gemini's rate limits quickly
- Multiple simultaneous requests from one user action
- No request batching or queuing mechanism

**Code Location**: 
- `backend/services/contract.service.js:510` - `generateContractOverview()`
- `backend/services/contract.service.js:848` - `generateClauseInsight()` loop

### B. No Request Batching Implementation
**Problem**: Individual clause insights are generated separately instead of batched into fewer API calls.

**Root Cause**: 
- Although batch processing was implemented (`generateBatchClauseInsights()`), it's not used in the main flow
- `buildAutomaticClauseInsights()` still calls individual `generateClauseInsight()` functions

**Impact**: 
- 5 separate API calls instead of 1 batched call
- Increased rate limiting probability
- Higher API usage costs

**Code Location**: 
- `backend/services/insight.service.js:762` - Batch function exists but unused
- `backend/services/contract.service.js:848` - Still uses individual calls

### C. Insufficient Retry Logic for Rate Limits
**Problem**: While exponential backoff exists, it's not optimized for rate limiting scenarios.

**Root Cause**: 
- `GENAI_MAX_RETRIES=0` in production `.env` (should be higher)
- Retry logic exists but may not handle sustained rate limiting well

**Impact**: 
- Quick failure on rate limit errors
- No intelligent backoff for quota exceeded scenarios

**Code Location**: 
- `backend/.env:61` - `GENAI_MAX_RETRIES=0`
- `backend/services/genAi.service.js:312` - `runGeminiRequest()` retry logic

## 2. Configuration Issues (HTTP 503/502)

### A. Invalid or Expired API Key
**Problem**: The Gemini API key may be invalid, expired, or have insufficient permissions.

**Root Cause**: 
- API key `AIzaSyAefRMUpe59IQpsAdolTECnwcNCSxcv90s` may be compromised or invalid
- No validation of API key validity on startup

**Impact**: 
- All Gemini requests fail with authentication errors
- Falls back to template responses

**Code Location**: 
- `backend/.env:56` - `GEMINI_API_KEY=AIzaSyAefRMUpe59IQpsAdolTECnwcNCSxcv90s`

### B. Incorrect API Configuration
**Problem**: Gemini API configuration may not match current API requirements.

**Root Cause**: 
- `GENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta` may be outdated
- Model `gemini-2.5-flash` may not be available or properly configured
- Single model candidate reduces fallback options

**Impact**: 
- API endpoint not found (404) or method not allowed (405) errors
- Model unavailability causes failures

**Code Location**: 
- `backend/.env:57-59` - Model and URL configuration

### C. Timeout and Resource Limits
**Problem**: Request timeouts and resource limits cause premature failures.

**Root Cause**: 
- `GENAI_TIMEOUT_MS=15000` may be too short for complex prompts
- `GENAI_MAX_OUTPUT_TOKENS=600` may be insufficient for detailed responses
- No adaptive timeout based on prompt complexity

**Impact**: 
- Timeout errors during complex insight generation
- Truncated responses due to token limits

**Code Location**: 
- `backend/.env:60,63` - Timeout and token limits

## 3. Caching and Performance Issues

### A. Inefficient Caching Strategy
**Problem**: Clause insight caching exists but may not prevent all redundant calls.

**Root Cause**: 
- Cache is in-memory only (lost on restart)
- Cache key is simple (`clause.id`) but doesn't account for context changes
- No persistence of successful responses

**Impact**: 
- Repeated API calls for same clauses after restart
- Cache misses for slightly different contexts

**Code Location**: 
- `backend/services/insight.service.js:28` - `clauseInsightCache` Map

### B. No Request Deduplication
**Problem**: Multiple simultaneous requests for same insights aren't deduplicated.

**Root Cause**: 
- No request deduplication mechanism
- `pendingStructuredRequests` Map exists but may not be fully utilized

**Impact**: 
- Duplicate API calls for concurrent requests
- Wasted API quota

**Code Location**: 
- `backend/services/genAi.service.js:25` - `pendingStructuredRequests`

## 4. Error Handling and Fallback Issues

### A. Overly Aggressive Fallback to Templates
**Problem**: Any Gemini failure immediately falls back to templates, losing AI capabilities.

**Root Cause**: 
- No partial success handling
- No degraded mode with reduced AI features
- All-or-nothing approach to AI integration

**Impact**: 
- Users get template responses even when AI could work
- No graceful degradation

**Code Location**: 
- `backend/services/insight.service.js:790` - Immediate template fallback

### B. Insufficient Error Logging
**Problem**: Gemini failures are logged but error details may not be comprehensive.

**Root Cause**: 
- Error messages may not include all relevant context
- No aggregation of failure patterns
- No alerting for sustained failures

**Impact**: 
- Difficult to diagnose root causes
- No proactive issue detection

**Code Location**: 
- `backend/services/insight.service.js:825` - Error logging

## 5. Architectural Issues

### A. Tight Coupling Between Services
**Problem**: Insight generation is tightly coupled to contract processing.

**Root Cause**: 
- Insight generation happens during contract ingestion
- No separation of concerns between data processing and AI generation
- Synchronous AI calls block contract processing

**Impact**: 
- Contract upload delays due to AI timeouts
- AI failures affect core contract functionality

**Code Location**: 
- `backend/services/contract.service.js:510` - Synchronous insight generation

### B. No Circuit Breaker Pattern
**Problem**: No protection against cascading failures when Gemini is down.

**Root Cause**: 
- No circuit breaker to temporarily disable Gemini when failure rate is high
- Continued attempts despite sustained failures

**Impact**: 
- Wasted resources on failed requests
- Slower response times

**Code Location**: 
- Missing circuit breaker implementation

## 6. Environment and Deployment Issues

### A. Production vs Development Configuration Drift
**Problem**: Production environment may have different effective configuration.

**Root Cause**: 
- Environment variables may not be properly set in production
- Railway ephemeral storage loses cached data
- Different network conditions affect timeouts

**Impact**: 
- Works in development but fails in production
- Inconsistent behavior

**Code Location**: 
- `backend/.env` vs production environment variables

### B. No Health Checks for External Services
**Problem**: No proactive checking of Gemini API availability.

**Root Cause**: 
- No health check endpoint for Gemini API
- No service status monitoring

**Impact**: 
- Silent failures until user attempts AI features
- No early warning of service issues

**Code Location**: 
- Missing health check implementation

## Recommended Fixes

### Immediate (High Priority)
1. **Fix API Key**: Validate and replace the potentially compromised Gemini API key
2. **Enable Retries**: Set `GENAI_MAX_RETRIES=2` to allow retry on transient failures
3. **Implement Request Batching**: Use `generateBatchClauseInsights()` instead of individual calls
4. **Increase Timeouts**: Set `GENAI_TIMEOUT_MS=30000` for complex prompts

### Medium Priority
1. **Add Circuit Breaker**: Implement failure threshold detection to temporarily disable Gemini
2. **Improve Caching**: Persist cache to disk or database
3. **Add Request Deduplication**: Prevent duplicate concurrent requests
4. **Better Error Handling**: More granular fallback strategies

### Long Term
1. **Separate AI Processing**: Move insight generation to background/async processing
2. **Add Health Checks**: Implement Gemini API health monitoring
3. **Optimize Prompts**: Reduce token usage and complexity
4. **Add Monitoring**: Implement metrics and alerting for AI service health

## Current Status
- Gemini is configured but failing due to the above issues
- Template fallbacks are working, maintaining basic functionality
- Users experience degraded AI features but app remains functional
- Rate limiting and configuration issues are the primary failure modes