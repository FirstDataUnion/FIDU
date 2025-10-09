# ChatLab Metrics Implementation

This document describes the metrics collection and monitoring system for FIDU ChatLab.

## Overview

ChatLab implements a comprehensive metrics system that collects data from both the frontend (browser) and backend (FastAPI server) and forwards all metrics to VictoriaMetrics for centralized monitoring.

### Architecture

```
┌─────────────────┐
│   Browser       │
│   (Frontend)    │
│                 │
│  MetricsService │  ← Batches metrics every 30s
└────────┬────────┘
         │ POST /fidu-chat-lab/api/metrics
         ▼
┌─────────────────┐
│  FastAPI Server │
│  (Backend)      │
│                 │
│  - Receives     │
│  - Aggregates   │
│  - Forwards     │  ← Sends every 30s
└────────┬────────┘
         │ POST localhost:8428/api/v1/import/prometheus
         ▼
┌─────────────────┐
│ VictoriaMetrics │
│   (Server)      │
└─────────────────┘
```

## Metrics Collected

### Frontend Metrics

#### 1. Error Tracking
Captures all JavaScript errors, API failures, and application errors.

**Metric:** `chatlab_errors_total`

**Labels:**
- `error_type`: Type of error (TypeError, ApiError, AuthError, StorageError, etc.)
- `page`: Page where the error occurred

**Examples:**
```
chatlab_errors_total{error_type="TypeError", page="prompt-lab"} 3
chatlab_errors_total{error_type="ApiError", page="conversations"} 1
chatlab_errors_total{error_type="UnhandledPromiseRejection", page="contexts"} 2
```

**Tracked by:**
- Global error handlers (window.onerror, unhandledrejection)
- API interceptors
- Manual error tracking in components

#### 2. Page Views / Traffic Monitoring
Tracks page navigation and user engagement.

**Metric:** `chatlab_page_views_total`

**Labels:**
- `page`: Page name (prompt-lab, conversations, contexts, system-prompts, settings)

**Examples:**
```
chatlab_page_views_total{page="prompt-lab"} 145
chatlab_page_views_total{page="conversations"} 23
chatlab_page_views_total{page="settings"} 8
```

**Tracked by:**
- React Router location changes
- Automatic tracking on every route change

#### 3. Messages Sent to Models
Tracks AI model usage and success rates.

**Metric:** `chatlab_messages_sent_total`

**Labels:**
- `model`: AI model identifier (gpt-4.0, claude-sonnet, gemini-flash, etc.)
- `status`: success or error

**Examples:**
```
chatlab_messages_sent_total{model="gpt-4.0", status="success"} 45
chatlab_messages_sent_total{model="claude-sonnet", status="success"} 23
chatlab_messages_sent_total{model="gpt-4.0", status="error"} 2
```

**Tracked by:**
- PromptLabPage message handler
- Both successful and failed message attempts

#### 4. Google API Requests
Tracks Google Drive API usage for cloud storage.

**Metric:** `chatlab_google_api_requests_total`

**Labels:**
- `api`: API service (drive)
- `operation`: Operation type (listFiles, uploadFile, downloadFile, etc.)
- `status`: success or error

**Examples:**
```
chatlab_google_api_requests_total{api="drive", operation="listFiles", status="success"} 12
chatlab_google_api_requests_total{api="drive", operation="uploadFile", status="success"} 8
chatlab_google_api_requests_total{api="drive", operation="downloadFile", status="error"} 1
```

**Tracked by:**
- GoogleDriveService wrapper methods
- All Drive API operations

#### 5. API Latency
Measures response times for internal API calls (excludes external services like Identity Service).

**Metric:** `chatlab_api_latency_seconds` (histogram)

**Labels:**
- `endpoint`: API endpoint (simplified, e.g., /user, /profiles/:id, /contexts)

**Examples:**
```
chatlab_api_latency_seconds{endpoint="/user"} histogram
chatlab_api_latency_seconds{endpoint="/profiles/:id"} histogram
```

**Tracked by:**
- Manual metrics recording in service methods
- **Note:** Automatic interceptor-based tracking is available via `apiMetricsInterceptor.ts` 
  but is currently not enabled on any API clients to avoid CORS issues with external services

#### 6. Active Users
Current number of active users (gauge metric).

**Metric:** `chatlab_active_users`

**Example:**
```
chatlab_active_users 5
```

### Backend Metrics

#### 1. HTTP Request Metrics
Tracks all HTTP requests to the backend server.

**Metric:** `chatlab_backend_requests_total`

**Labels:**
- `method`: HTTP method (GET, POST, etc.)
- `endpoint`: Endpoint path (simplified)
- `status`: HTTP status code

**Examples:**
```
chatlab_backend_requests_total{method="GET", endpoint="/", status="200"} 100
chatlab_backend_requests_total{method="POST", endpoint="/api/metrics", status="200"} 50
```

#### 2. Request Duration
Measures backend response times.

**Metric:** `chatlab_backend_request_duration_seconds` (histogram)

**Labels:**
- `method`: HTTP method
- `endpoint`: Endpoint path

#### 3. Health Status
Application health indicator.

**Metric:** `chatlab_health_status` (gauge)

**Values:**
- `1`: Healthy
- `0`: Unhealthy

**Example:**
```
chatlab_health_status 1
```

## Implementation Details

### Frontend Components

#### MetricsService (`src/services/metrics/MetricsService.ts`)
Central service for collecting and batching metrics.

**Key Features:**
- Automatic batching (flushes every 30 seconds or when buffer reaches 50 metrics)
- Graceful handling of page unload using `sendBeacon`
- Configurable batch size and flush interval
- Singleton pattern for app-wide use

**Usage:**
```typescript
import { MetricsService } from './services/metrics/MetricsService';

// Record an error
MetricsService.recordError('TypeError', 'prompt-lab');

// Record a page view
MetricsService.recordPageView('conversations');

// Record a message sent
MetricsService.recordMessageSent('gpt-4.0', 'success');

// Record Google API request
MetricsService.recordGoogleApiRequest('drive', 'uploadFile', 'success');

// Record API latency
MetricsService.recordApiLatency('/user', 0.345);
```

#### Error Tracking (`src/utils/errorTracking.ts`)
Utility functions for tracking different types of errors.

**Features:**
- Global error handler registration
- Specialized functions for API, storage, and auth errors
- Automatic page context detection

**Usage:**
```typescript
import { trackApiError, trackStorageError, trackAuthError } from './utils/errorTracking';

// Track API error
trackApiError('/contexts', 500, 'Internal server error');

// Track storage error
trackStorageError('google_drive', 'uploadFile', 'Quota exceeded');

// Track auth error
trackAuthError('google_oauth', 'Invalid token');
```

#### API Metrics Interceptor (`src/services/api/apiMetricsInterceptor.ts`)
Axios interceptor for automatic API metrics collection.

**Features:**
- Tracks request latency automatically
- Records API errors
- Simplifies endpoint paths (removes IDs)
- Adds `X-Request-ID` header for request tracking

**Current Status:**
⚠️ **Not currently enabled** on any API clients to avoid CORS issues with external services 
(Identity Service, etc.). API latency can be tracked manually using `MetricsService.recordApiLatency()`.

**Setup (when needed for internal APIs):**
```typescript
import { setupMetricsInterceptors } from './apiMetricsInterceptor';

// Setup on axios instance (only for internal APIs with CORS configured)
setupMetricsInterceptors(axiosInstance);
```

**Important:** Only use this interceptor on internal APIs where you control the CORS policy.
External services may reject requests with the `X-Request-ID` header.

### Backend Components

#### FastAPI Server (`deploy.sh` - server.py)
Python FastAPI server that:
1. Receives batched metrics from frontend
2. Maintains Prometheus metrics in memory
3. Forwards to VictoriaMetrics every 30 seconds

**Key Endpoints:**
- `POST /fidu-chat-lab/api/metrics` - Receive metrics from frontend
- `GET /fidu-chat-lab/api/metrics` - Expose Prometheus-formatted metrics
- `GET /health` - Health check with metrics status

**Dependencies:**
- `fastapi` - Web framework
- `prometheus-client` - Metrics library
- `httpx` - Async HTTP client for VM forwarding

## Configuration

### Frontend Configuration

Metrics service is automatically initialized on import. To customize:

```typescript
import { MetricsService } from './services/metrics/MetricsService';

MetricsService.configure({
  batchSize: 100,        // Metrics before auto-flush
  flushInterval: 60000,  // Milliseconds between flushes
  enabled: true,         // Enable/disable metrics
});
```

## References

- [VictoriaMetrics Documentation](https://docs.victoriametrics.com/)
- [Prometheus Metric Types](https://prometheus.io/docs/concepts/metric_types/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Prometheus Python Client](https://github.com/prometheus/client_python)

