## Datasource Registry

The following datasources are available for dashboard development.

Dashboard implementations should:

- Use registered datasources whenever possible.
- Use `datasource.service` with `base_urls` to build the full API URL.
  - `fastapi` means call `https://fastapi.muns.io` + endpoint path.
  - `nestjs` means call `https://devde.muns.io` + endpoint path.
- Follow documented request and response contracts.
- Respect rate limits and cache recommendations.
- Use host-provided authentication.
- Handle API failures gracefully.
- Avoid introducing undocumented API dependencies.

<!-- GENERATED CONTENT - DO NOT EDIT MANUALLY -->

```yaml
base_urls:
  fastapi: https://fastapi.muns.io
  nestjs: https://devde.muns.io
datasources:
  - id: web_search
    name: Web Search
    description: Search the public internet using Brave Search. Pass a comma-separated list of countries to fetch 5 results per country; a single country (or none) fetches 10.
    service: fastapi
    endpoint: POST /tools/web-search
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: query
        type: string
        required: true
        description: Search query
      - field: country
        type: string
        required: false
        description: Country name, or comma-separated list of country names, for localized results.
    response_fields:
      - field: success
        type: boolean
        required: true
        description: Always true on HTTP 200. Tool-level errors are returned as HTTP 200 with success=true and the error nested inside results — check response body, not status code.
      - field: query
        type: string
        required: true
      - field: results_count
        type: integer
        required: true
        description: Number of items in results (0 if results is not a list).
      - field: results
        type: array
        required: true
        description: Structured search result hits. On a tool-level error, contains a single object [{"error": "..."}].
    cache_ttl_seconds: 300
  - id: web_reader
    name: Web Reader
    description: Read one or more URLs and extract their content as markdown (via markitdown), one result entry per URL.
    service: fastapi
    endpoint: POST /tools/web-reader
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: urls
        type: string[]
        required: true
        description: URLs to extract content from
      - field: task
        type: string
        required: false
        description: Optional extraction objective
    response_fields:
      - field: success
        type: boolean
        required: true
        description: Always true on HTTP 200. Tool-level errors are returned as HTTP 200 with success=true and the error nested inside results — check response body, not status code.
      - field: urls_count
        type: integer
        required: true
        description: Number of URLs in the request (not the number successfully read).
      - field: results
        type: array
        required: true
        description: One entry per URL — each { url, ...content... } or { url, error }. On bad input (missing/invalid urls) this may be a bare error string instead of an array.
    cache_ttl_seconds: 300
  - id: news_search
    name: News Search
    description: Search recent news articles via Brave. Provide from_date and to_date together to apply a freshness filter.
    service: fastapi
    endpoint: POST /tools/news-search
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: query
        type: string
        required: true
      - field: country
        type: string
        required: false
      - field: from_date
        type: date
        required: false
        description: Start date. Applies a freshness filter only when paired with to_date.
      - field: to_date
        type: date
        required: false
        description: End date. Applies a freshness filter only when paired with from_date.
    response_fields:
      - field: success
        type: boolean
        required: true
        description: Always true on HTTP 200. Tool-level errors are returned as HTTP 200 with success=true and the error nested inside results — check response body, not status code.
      - field: query
        type: string
        required: true
      - field: results_count
        type: integer
        required: true
        description: Number of items in results (0 if results is not a list).
      - field: results
        type: array
        required: true
        description: News article hits. On a tool-level error, contains a single object [{"error": "..."}].
    cache_ttl_seconds: 180
  - id: document_search
    name: Document Search
    description: Search proprietary documents indexed in Pinecone.
    service: fastapi
    endpoint: POST /tools/document-search
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: query
        type: string
        required: true
      - field: user_index
        type: integer
        required: true
      - field: ticker_symbol
        type: string|string[]
        required: false
      - field: from_date
        type: date
        required: false
      - field: to_date
        type: date
        required: false
      - field: categories
        type: string[]
        required: false
      - field: doc_indexes
        type: string[]
        required: false
    response_fields:
      - field: success
        type: boolean
        required: true
        description: Always true on HTTP 200. Tool-level errors are returned as HTTP 200 with success=true and the error nested inside results — check response body, not status code.
      - field: query
        type: string
        required: true
      - field: results_count
        type: integer
        required: true
        description: Number of items in results.structured_data.
      - field: results
        type: object
        required: true
        description: "Object with structured_data: array of matching document chunks (capped at 10, optionally reranked). On error, contains { error: \"...\" } instead."
    cache_ttl_seconds: 120
  - id: muns_chat
    name: Muns Chat
    description: Stream an AI answer for a dashboard question using Muns chat context, documents, tickers, and dashboard inputs.
    service: nestjs
    endpoint: POST /chat/chat-muns
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 30
    request_fields:
      - field: tasks
        type: string[]
        required: true
        description: User question or task list. Usually provide one dashboard-specific question.
      - field: query_context.chatHistory
        type: object[]
        required: true
        description: Prior chat messages. Use [] for a new dashboard query.
      - field: query_context.TICKER_SYMBOL
        type: string[]
        required: false
        description: Tickers relevant to the dashboard.
      - field: query_context.FROM_DATE
        type: date
        required: false
        description: Start date for time-bounded analysis.
      - field: query_context.TO_DATE
        type: date
        required: false
        description: End date for time-bounded analysis.
      - field: query_context.DOCUMENT_IDS
        type: string[]
        required: false
        description: Uploaded document UUIDs to ground the answer.
      - field: query_context.DOC_INDEX
        type: integer[]
        required: false
        description: Internal document indexes when already known.
      - field: query_context.DASHBOARD_INPUTS
        type: object[]
        required: false
        description: Dashboard extraction inputs to forward into the model context.
      - field: query_context.mode
        type: enum
        required: false
        description: fast or expert. Defaults to expert.
      - field: chat_id
        type: string
        required: false
        description: Existing chat ID when continuing a prior chat.
    response_fields:
      - field: stream
        type: text/event-stream
        required: true
        description: Raw streamed answer chunks from Muns AI.
      - field: X-Chat-Id
        type: header
        required: true
        description: Chat ID created or reused for the request.
      - field: X-Message-Id
        type: header
        required: true
        description: Message ID for the streamed response.
    cache_ttl_seconds: 0
  - id: agent_run
    name: Agent Run
    description: Run a registered analyst agent and stream its output for dashboard generation or refresh workflows.
    service: nestjs
    endpoint: POST /agents/run
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 20
    request_fields:
      - field: agent_id
        type: string
        required: false
        description: Active analyst UUID. Provide either agent_id or agent_library_id, not both.
      - field: agent_library_id
        type: string
        required: false
        description: Library agent UUID. Provide either agent_library_id or agent_id, not both.
      - field: user_query
        type: string
        required: false
        description: Specific dashboard question or run objective.
      - field: metadata
        type: object
        required: false
        description: Run context such as stock_ticker, from_date, to_date, urls, or autoAddUpcoming.
      - field: DASHBOARD_INPUTS
        type: object[]
        required: false
        description: Dashboard extraction inputs to include in agent context.
      - field: CATEGORIES
        type: string[]
        required: false
        description: Categories to include in the agent query context.
      - field: WRITING_STYLES
        type: string[]
        required: false
        description: Optional registered writing style names for output formatting.
    response_fields:
      - field: stream
        type: text/event-stream
        required: true
        description: Raw streamed agent output.
      - field: X-Active-Analyst-Id
        type: header
        required: true
        description: Active analyst ID used for the run.
      - field: X-Analyst-Output-Id
        type: header
        required: true
        description: Analyst output ID where the run is persisted.
    cache_ttl_seconds: 0
  - id: portfolio_list
    name: Portfolio List
    description: Retrieve the user's portfolio or watchlist items with stock details such as ticker, company, sector, and industry.
    service: nestjs
    endpoint: GET /portfolio/list
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 60
    request_fields: []
    response:
      type: object[]
      fields:
        - field: id
          type: string
          required: true
          description: Portfolio item UUID.
        - field: ticker
          type: string
          required: true
          description: Stock ticker symbol.
        - field: rank
          type: integer
          required: true
          description: Ordering or ranking position of the portfolio item.
        - field: createdAt
          type: datetime
          required: true
          description: Timestamp when the portfolio item was added.
        - field: groupId
          type: string
          required: true
          description: Portfolio or watchlist group UUID.
        - field: company_name
          type: string
          required: false
          description: Full company name.
        - field: country
          type: string
          required: false
          description: Country where the company operates.
        - field: sector
          type: string|null
          required: false
          description: Company sector classification.
        - field: industry
          type: string|null
          required: false
          description: Company industry classification.
    cache_ttl_seconds: 300
  - id: super_investors_list
    name: Super Investors List
    description: List well-known ("super") investors and their basic profile. Scraped live from finology.in.
    service: nestjs
    endpoint: GET /super-investors
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 30
    request_fields: []
    response_fields:
      - field: count
        type: integer
        required: true
        description: Number of investors returned.
      - field: investors
        type: object[]
        required: true
        description: "Each investor: name, slug (use as the {slug} path param for the portfolio endpoint), bio (string|null), imageUrl (string|null)."
    cache_ttl_seconds: 300
  - id: super_investor_portfolio
    name: Super Investor Portfolio
    description: Get a super investor's portfolio with quarterly holdings by company. Scraped live from finology.in.
    service: nestjs
    endpoint: GET /super-investors/{slug}
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 30
    request_fields:
      - field: slug
        type: string
        required: true
        description: Investor slug (path param), e.g. "ashish-kacholia". Only [a-z0-9-] allowed (400 if invalid); 404 if not found.
    response_fields:
      - field: name
        type: string
        required: true
      - field: slug
        type: string
        required: true
      - field: netWorthCr
        type: number|null
        required: false
        description: Net worth in ₹ crore.
      - field: activeStocks
        type: integer|null
        required: false
      - field: totalStocks
        type: integer|null
        required: false
      - field: quarters
        type: string[]
        required: true
        description: Quarter labels (e.g. "Sep 2025") — these are the keys used in each holding's quarterlyHoldings.
      - field: holdings
        type: object[]
        required: true
        description: "Each holding: company, companySlug (string|null), quarterlyHoldings (object keyed by quarter label → holding % or null), valueCr (number|null). Numeric fields are null where the source shows \"-\"/missing."
    cache_ttl_seconds: 300
  - id: llm_chat
    name: LLM Chat
    description: Send a query to a local or hosted LLM and get the completion back, streamed as NDJSON or as a single JSON response.
    service: fastapi
    endpoint: POST /query-router
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 30
    request_fields:
      - field: query
        type: string
        required: true
        description: The prompt to send to the selected LLM.
      - field: llm_type
        type: string
        required: true
        description: "\"local_llm\" or \"hosted_llm\"."
      - field: stream
        type: boolean
        required: false
        description: Default true. If true, streams the response as NDJSON. If false, returns the full response as JSON.
      - field: temperature
        type: float
        required: false
        description: Sampling temperature. Defaults to config value.
      - field: max_tokens
        type: integer
        required: false
        description: Maximum tokens in the response. Defaults to config value.
    response_fields:
      - field: (stream|object)
        type: string
        required: true
        description: "If stream=true: NDJSON (application/x-ndjson), each line {\"text\": \"...\"} or {\"error\": \"...\"} on failure. If stream=false: JSON object {\"text\": \"...\"}."
    cache_ttl_seconds: 0
  - id: email_send
    name: Email Send (Raw)
    description: Send a transactional email (subject + HTML or plain-text body) to a single recipient. Used to deliver designed dashboard content — reports, editions, briefs — to a user's inbox.
    service: nestjs
    endpoint: POST /email/send/raw
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 30
    request_fields:
      - field: email
        type: string
        required: true
        description: Recipient email address. Exactly one recipient per request.
      - field: subject
        type: string
        required: true
        description: Email subject line.
      - field: html
        type: string
        required: false
        description: HTML email body. Provide EITHER html OR text — exactly one, never both, never neither. Use inline styles and table layouts for email-client (Gmail) compatibility.
      - field: text
        type: string
        required: false
        description: Plain-text email body. Mutually exclusive with html.
    response_fields:
      - field: success
        type: boolean
        required: true
        description: Whether the email was accepted for delivery.
      - field: message
        type: string
        required: true
        description: Human-readable status (e.g. "Email sent successfully!") or error reason.
      - field: data
        type: object
        required: false
        description: Nested envelope; data.message carries the server's detail message.
    cache_ttl_seconds: 0
  - id: stock_search
    name: Stock Search
    description: Search stocks by company name or ticker across listed stocks, user/org custom stocks, and unlisted DRHP/IPO companies. Supports filters, sorting, and pagination.
    service: nestjs
    endpoint: POST /stock/search
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: query
        type: string
        required: true
        description: Search term. Matched against company_name and ticker (case-insensitive partial match). Pass "" to list without a text filter.
      - field: filters.exchange
        type: string[]
        required: false
        description: Filter by exchange(s).
      - field: filters.sector
        type: string
        required: false
        description: Filter by sector.
      - field: filters.country
        type: string
        required: false
        description: Filter by country.
      - field: sort.field
        type: string
        required: false
        description: Field to sort by (applies to listed stocks).
      - field: sort.order
        type: string
        required: false
        description: "\"asc\" or \"desc\"."
      - field: pagination.limit
        type: integer
        required: false
        description: Max results to return.
      - field: pagination.offset
        type: integer
        required: false
        description: Number of results to skip.
    response_fields:
      - field: total_results
        type: integer
        required: true
        description: Number of unique tickers in results.
      - field: results
        type: object
        required: true
        description: "Object keyed by ticker. Each value is a FLAT array where every 3 elements form one (country, company_name, industry) triple — a ticker present in multiple countries has 6, 9, ... elements. Merges 3 sources (listed stocks, custom stocks, DRHP/IPO companies); DRHP entries show industry \"IPO\" and are skipped if the company already exists as a listed/custom stock."
    cache_ttl_seconds: 300
  - id: fetch_formula
    name: Fetch Formula
    description: Fetch formula definitions (name, expression, description) for one or more metric/ratio names using semantic search. Returns definitions only — not data values.
    service: fastapi
    endpoint: GET /data/fetch_formula
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: q
        type: string[]
        required: true
        description: Formula or metric names to look up (e.g. ROE, EBITDA). Semantically matched via FAISS — not exact string match. Repeat param for multiple values (?q=ROE&q=EBITDA).
    response_fields:
      - field: (string)
        type: string
        required: true
        description: "Plain-text string. One block per query term — Formula: {name}, Expression: {expr}, Description: {desc}. If no match: \"{query}: No results found.\". Always HTTP 200 — errors surface as text, not status codes."
    cache_ttl_seconds: 600
  - id: financials
    name: Financials
    description: Fetch income statement, balance sheet, cash flow statement, and calendar info for a ticker as a markdown string. Sourced from yfinance. No auth required.
    service: fastapi
    endpoint: POST /financials/{ticker}
    auth:
      type: none
    rate_limit:
      requests_per_minute: 30
    request_fields:
      - field: ticker
        type: string
        required: true
        description: Stock ticker symbol (path param). Used verbatim — no India .NS/.BO fallback. Pass RELIANCE.NS explicitly for Indian stocks.
      - field: period
        type: string
        required: false
        description: "\"annual\" (default) or \"quarterly\"."
    response_fields:
      - field: (string)
        type: string
        required: true
        description: "text/markdown string with 4 sections: Income Statement, Balance Sheet, Cash Flow Statement, Calendar Information. Values are currency-formatted ($B, $M, $K). Dates sorted descending. Each section independently falls back to \"No data available.\" if yfinance returns nothing."
    cache_ttl_seconds: 300
  - id: ratio_source
    name: Ratio Source
    description: Look up source URLs for financial ratios/metrics for one or more tickers using semantic search. Returns where to find the data, not the values themselves — follow up with web_reader on the returned URLs.
    service: fastapi
    endpoint: GET /data/ratio_source
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: q
        type: string[]
        required: true
        description: Ratio or metric names to look up (e.g. PE, ROE). Semantically matched via FAISS — not exact string match. Repeat param for multiple values (?q=PE&q=ROE).
      - field: tickers
        type: string[]
        required: true
        description: Ticker symbols. Positionally aligned with countries. Repeat param for multiple values (?tickers=AAPL&tickers=RELIANCE).
      - field: countries
        type: string[]
        required: true
        description: Country per ticker (e.g. USA, INDIA). Must be same length as tickers. Repeat param for multiple values (?countries=USA&countries=INDIA).
    response_fields:
      - field: (string)
        type: string
        required: true
        description: "Plain-text output. For each ticker, lists the ratio name and source URL(s) flagged with \"(Use WebReader Tool)\" — these URLs should be fetched via web_reader to get the actual values. Tickers with no results are silently omitted. Returns \"Country length mismatch\" (HTTP 200) if countries array is shorter than tickers."
    cache_ttl_seconds: 300
  - id: street_estimates
    name: Street Estimates
    description: Fetch analyst/broker street estimates for a ticker as a markdown table. India sourced from Trendlyne; USA sourced from TipRanks.
    service: fastapi
    endpoint: GET /data/street_estimates
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: ticker
        type: string
        required: true
        description: Stock ticker symbol (e.g. AAPL, RELIANCE).
      - field: country
        type: string
        required: true
        description: "\"INDIA\" or \"USA\" (case-insensitive). Any other value returns 400."
    response_fields:
      - field: (string)
        type: string
        required: true
        description: "Plain-text markdown table. India columns vary by Trendlyne render. USA fixed columns: Analyst, Firm, Price Target, Rating, Upside/Downside, Action, Date — sorted by date descending. Returns 404 if no estimates found."
    cache_ttl_seconds: 300
  - id: stock_data
    name: Stock Data
    description: Fetch real-time stock quotes, detailed company info, cash flow, or balance sheet for a ticker. No auth required. Poll at max every 3 seconds to stay safe under the 60 RPM limit.
    service: fastapi
    endpoint: POST /stock-data
    auth:
      type: none
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: ticker_symbol
        type: string
        required: true
        description: Stock ticker symbol (e.g. AAPL, RELIANCE).
      - field: type
        type: string
        required: true
        description: "Query type. Allowed values: \"stockquote\" (current price + basic metrics), \"detailquote\" (detailed quote/company info), \"cashflow\" (cash flow statement — requires range_type/start_date/end_date), \"balance-sheet\" (balance sheet — requires range_type/start_date/end_date)."
      - field: country
        type: string
        required: false
        description: "\"India\" enables automatic .NS / .BO exchange fallback. Defaults to US handling."
      - field: range_type
        type: string
        required: false
        description: "Required for cashflow and balance-sheet types. \"yearly\" or \"quarterly\" (cashflow supports yearly only)."
      - field: start_date
        type: string
        required: false
        description: Required for cashflow and balance-sheet types. Format YYYY-MM-DD.
      - field: end_date
        type: string
        required: false
        description: Required for cashflow and balance-sheet types. Format YYYY-MM-DD.
    response_fields:
      - field: (string)
        type: string
        required: true
        description: "Plain-text comma-separated key=value pairs (not JSON). Parse the key you need by name, e.g. \"Current Price\", \"Market Cap\", \"PE Ratio\"."
    cache_ttl_seconds: 0
  - id: market_data
    name: Market Data
    description: Fetch historical or intraday OHLCV price series for a ticker over a date range. No auth required. Always pass csv=false to get JSON.
    service: fastapi
    endpoint: GET /market_data
    auth:
      type: none
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: ticker
        type: string
        required: true
        description: Stock ticker symbol (e.g. AAPL, RELIANCE).
      - field: start
        type: string
        required: true
        description: Start date. Format YYYY-MM-DD.
      - field: end
        type: string
        required: true
        description: End date. Format YYYY-MM-DD.
      - field: csv
        type: boolean
        required: true
        description: Always pass false. Default is true which returns plain-text — must explicitly set false to get JSON.
      - field: interval
        type: string
        required: false
        description: "Intraday interval: 1m, 2m, 5m, 15m, 30m, 1h. Defaults to 1d. Note: Yahoo restricts intraday depth — 1m data only available for very recent dates."
      - field: country
        type: string
        required: false
        description: "\"USA\" (default) or \"India\". For India, tries .NS then .BO automatically."
    response_fields:
      - field: ticker
        type: string
        required: true
        description: Original ticker symbol passed in.
      - field: resolved_ticker
        type: string
        required: true
        description: Actual symbol used to fetch data (e.g. RELIANCE.NS for Indian stocks).
      - field: country
        type: string
        required: true
      - field: start
        type: string
        required: true
      - field: end
        type: string
        required: true
      - field: interval
        type: string
        required: true
      - field: columns
        type: string[]
        required: true
        description: Column names in the data array.
      - field: total_rows
        type: integer
        required: true
        description: Total number of data points returned.
      - field: data
        type: object[]
        required: true
        description: OHLCV records. Each item — Date, Open, High, Low, Close, Volume, Dividends, Stock Splits.
    cache_ttl_seconds: 300
  - id: stock_data_batch
    name: Stock Data Batch
    description: Fetch real-time stock quotes for up to 80 tickers in a single call. No auth required. Returns per-ticker status so partial failures don't break the whole response.
    service: fastapi
    endpoint: POST /stock-data/batch
    auth:
      type: none
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: type
        type: string
        required: true
        description: Must be "stockquote_batch".
      - field: tickers
        type: string[]
        required: false
        description: List of ticker symbols. Provide either tickers or ticker_symbol, not both.
      - field: ticker_symbol
        type: string
        required: false
        description: Comma-separated ticker symbols. Alternative to tickers array. Max 80 tickers. Duplicates are ignored.
      - field: country
        type: string|string[]
        required: true
        description: Single country value applied to all tickers, or comma-separated list with one value per ticker (e.g. "USA,USA,India").
      - field: timeout_ms
        type: integer
        required: false
        description: Per-ticker timeout in milliseconds. Range 1000–60000. Default 1000.
    response_fields:
      - field: data.asOf
        type: string
        required: true
        description: UTC timestamp of the response.
      - field: data.items
        type: object[]
        required: true
        description: "Per-ticker results. Each item: ticker, status (ok/timeout/not_found/error), currentPrice (when ok), rawQuote (full key=value string when ok), reason (when failed)."
      - field: meta.requested
        type: integer
        required: true
        description: Total number of tickers requested.
      - field: meta.resolved
        type: integer
        required: true
        description: Number of tickers with status ok.
      - field: meta.failed
        type: integer
        required: true
        description: Number of tickers that failed.
    cache_ttl_seconds: 0
  - id: free_float_market_cap
    name: Free Float Market Cap
    description: Fetch the free float market cap (and total market cap) for an Indian listed stock, in ₹ crore. Sourced live from BSE.
    service: nestjs
    endpoint: POST /filings/free_float_market_cap
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 30
    request_fields:
      - field: ticker
        type: string
        required: true
        description: NSE symbol (e.g. "TCS"), BSE security_id, or numeric BSE scrip code (e.g. "532540"). 400 if empty; 404 if no BSE scrip maps or BSE returns no market-cap field; 502 if the BSE fetch fails.
    response_fields:
      - field: symbol
        type: string
        required: true
        description: The input ticker, trimmed and uppercased.
      - field: scripCode
        type: string
        required: true
        description: Resolved BSE scrip code.
      - field: freeFloatMarketCap
        type: number|null
        required: true
        description: Free float market cap in ₹ crore. null if BSE has no value.
      - field: totalMarketCap
        type: number|null
        required: true
        description: Total market cap in ₹ crore. null if BSE has no value.
      - field: currency
        type: string
        required: true
        description: Always "INR".
      - field: unit
        type: string
        required: true
        description: Always "Cr" (crore).
      - field: source
        type: string
        required: true
        description: Always "BSE".
      - field: asOf
        type: datetime
        required: true
        description: ISO timestamp when the value was fetched.
    cache_ttl_seconds: 300
  - id: insider_trades
    name: Insider Trades
    description: Fetch insider trades for a ticker as a markdown table. Routes to Indian exchange data (NSE/BSE/Trendlyne) or US Finviz data based on country.
    service: nestjs
    endpoint: POST /filings/data/insider_trades
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: ticker
        type: string
        required: true
        description: Stock ticker symbol.
      - field: country
        type: string
        required: true
        description: "\"india\" for Indian exchange data (NSE/BSE/Trendlyne); any other value (e.g. \"USA\") for US data via Finviz."
      - field: fromDate
        type: string
        required: false
        description: Filter start date. Accepts YYYY-MM-DD or full ISO 8601 timestamp.
      - field: toDate
        type: string
        required: false
        description: Filter end date. Accepts YYYY-MM-DD or full ISO 8601 timestamp.
    response_fields:
      - field: (string)
        type: string
        required: true
        description: "Markdown table string. India columns: Company, Insider, Category, Security Type, Transaction, Trade Shares, Trade %, Trade Value, Post Holding Shares, Post Holding %, Mode, From Date, To Date, Broadcast Date, Source. US columns: Insider, Relationship, Date, Transaction, #Shares, Value ($), #Shares Total, SEC Form 4. Without date filters, India path is capped at 100 most recent records."
    cache_ttl_seconds: 300
  - id: drhp_companies
    name: DRHP Companies (Unlisted)
    description: List all unlisted DRHP/IPO companies with optional search, source filter, and pagination. Filters out companies already listed in the stock table — effectively an upcoming/unlisted IPO list.
    service: nestjs
    endpoint: GET /filings/drhp
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: search
        type: string
        required: false
        description: Filter by company name or symbol (case-insensitive partial match).
      - field: source
        type: string
        required: false
        description: Filter by source (e.g. "US", "IND"). Case-insensitive exact match.
      - field: page
        type: integer
        required: false
        description: Page number. Default 1.
      - field: limit
        type: integer
        required: false
        description: Results per page. Default 50, max 200.
    response_fields:
      - field: data
        type: object[]
        required: true
        description: "Unlisted DRHP companies (deduplicated by company_name, sorted by filing_date descending). Each item — symbol, company_name, form_type, filing_date, open_date, close_date, listing_date, issue_price, subscription, documents[] (each with sequence, doc_type, description, file_link)."
      - field: pagination
        type: object
        required: true
        description: "Pagination metadata — page, limit, total, totalPages."
    cache_ttl_seconds: 300
  - id: drhp_filings
    name: DRHP Filings
    description: Fetch DRHP/prospectus filings for a company by ticker symbol or exact company name. Returns up to 50 filings with nested document links, ordered by filing date descending.
    service: nestjs
    endpoint: GET /filings/drhp/{ticker}
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 60
    request_fields:
      - field: ticker
        type: string
        required: true
        description: Exact ticker symbol or exact company name (case-insensitive). Matched against both symbol and company_name fields.
    response_fields:
      - field: symbol
        type: string|null
        required: false
        description: Stock ticker symbol.
      - field: company_name
        type: string
        required: true
        description: Full company name.
      - field: form_type
        type: string
        required: true
        description: Filing form type (e.g. "DRHP").
      - field: filing_date
        type: datetime|null
        required: false
        description: Date the filing was submitted.
      - field: source
        type: string
        required: true
        description: Exchange or source of the filing (e.g. "BSE").
      - field: documents
        type: object[]
        required: true
        description: List of documents attached to the filing, ordered by sequence ascending.
      - field: documents[].sequence
        type: integer|null
        required: false
        description: Document sequence number.
      - field: documents[].doc_type
        type: string
        required: true
        description: Document type identifier.
      - field: documents[].description
        type: string
        required: true
        description: Human-readable document description.
      - field: documents[].file_link
        type: string
        required: true
        description: URL to the actual filing document.
    cache_ttl_seconds: 300
  - id: combined_financials
    name: Combined Financials
    description: Fetch combined financial data for a ticker as a markdown string. India path scrapes screener.in (financials, ratios, shareholding, peers); USA path fetches from yfinance (income statement, balance sheet, cash flow, calendar).
    service: nestjs
    endpoint: POST /filings/combined_financials
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 30
    request_fields:
      - field: ticker
        type: string
        required: true
        description: Stock ticker symbol.
      - field: country
        type: string
        required: true
        description: "Allowed values: \"India\", \"USA\", \"United States\". Determines data source and which other fields apply."
      - field: q
        type: string
        required: false
        description: "India path only. \"consolidated\" (default) or \"standalone\". Ignored for USA."
      - field: period
        type: string
        required: false
        description: "USA path only. \"annual\" (default) or \"quarterly\". Ignored for India."
    response_fields:
      - field: (string)
        type: string
        required: true
        description: "Raw markdown string. India sections: Pros & Cons, About, Stock Details (key ratios), Shareholding Pattern, Balance Sheet, Profit & Loss, Quarterly Results, Peer Comparison. USA sections: Income Statement, Balance Sheet, Cash Flow Statement, Calendar. Each section is fetched independently — a failed section produces a ## Skipping {section} block rather than failing the whole response."
    cache_ttl_seconds: 300
  - id: combined_filings_announcements
    name: Combined Filings & Announcements
    description: Fetch filings and announcements for a ticker from multiple sources (BSE/NSE/DRHP/screener.in for India; SEC via FastAPI for USA). Each item includes an isRead flag indicating whether the user has previously read that document.
    service: nestjs
    endpoint: POST /filings/combined_filings_announcements
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 30
    request_fields:
      - field: ticker
        type: string
        required: true
        description: Stock ticker symbol.
      - field: country
        type: string
        required: true
        description: "Allowed values: \"India\", \"USA\", \"United States\"."
      - field: form
        type: string[]
        required: false
        description: "India path only. Filter results by filing type. Allowed values: [\"concalls\"], [\"annual_report\"], [\"earnings_report\"], [\"all\"] (or omit for all). Ignored for USA."
      - field: start_date
        type: string
        required: false
        description: "Filter start date. Format: YYYY-MM-DD. India defaults to 1 year ago if omitted. No default for USA."
      - field: end_date
        type: string
        required: false
        description: "Filter end date. Format: YYYY-MM-DD. India defaults to today if omitted."
      - field: email
        type: string
        required: false
        description: USA path only. Forwarded to FastAPI.
      - field: company_name
        type: string
        required: false
        description: USA path only. Forwarded to FastAPI.
    response_fields:
      - field: (array)
        type: object[]
        required: true
        description: "Array of filing/announcement objects sorted by date descending. Returns [] if no data. Each item includes isRead: boolean (whether the user has read/uploaded that document). Item shape varies by source — announcements (BSE/NSE): symbol, title, desc, date, attachment, source; DRHP: filing DB fields + source; concalls: date, transcript, ppt, rec, source; annual/earnings reports: date, attachment, source. USA items are SEC filing objects from FastAPI. All items include isRead."
    cache_ttl_seconds: 120
  - id: filings_domestic
    name: Filings — Domestic
    description: Fetch concall transcripts, annual reports, and earnings report PDFs for an Indian ticker by scraping screener.in.
    service: nestjs
    endpoint: POST /filings/domestic
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 30
    request_fields:
      - field: ticker
        type: string
        required: true
        description: Stock ticker symbol or stock_identifier. Matched case-insensitively.
      - field: form
        type: string
        required: true
        description: "Filing category to fetch. Allowed values: \"concalls\", \"annual_report\", \"earnings_report\", \"all\". Any other value returns {}."
    response_fields:
      - field: concalls
        type: object[]
        required: false
        description: "Present when form is \"concalls\" or \"all\". Each item: { date, transcript, ppt, rec } — links to concall documents."
      - field: annual_report
        type: object[]
        required: false
        description: "Present when form is \"annual_report\" or \"all\". Each item: { attachment, date, source }."
      - field: earnings_report
        type: object[]
        required: false
        description: "Present when form is \"earnings_report\" or \"all\". Each item: { date, attachment } — only Raw PDF rows from the quarters table."
    cache_ttl_seconds: 300
  - id: corp_announcements
    name: Corporate Announcements
    description: Fetch corporate announcements for a ticker from BSE (primary), NSE (fallback), and DRHP documents. Results are grouped by source.
    service: nestjs
    endpoint: GET /filings/corp/announcements/{ticker}
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 30
    request_fields:
      - field: ticker
        type: string
        required: true
        description: Stock ticker symbol (path param). Auto-uppercased.
      - field: fromDate
        type: string
        required: true
        description: Filter start date. Format YYYYMMDD (e.g. 20250101). Applies to BSE/NSE only — does not filter DRHP results.
      - field: toDate
        type: string
        required: true
        description: Filter end date. Format YYYYMMDD (e.g. 20260715). Applies to BSE/NSE only — does not filter DRHP results.
    response_fields:
      - field: source
        type: string
        required: true
        description: "Data source for this group. One of: \"BSE\", \"NSE\", \"DRHP\". BSE is tried first; NSE is only used if BSE returns no data. DRHP is always included if documents exist."
      - field: data
        type: object[]
        required: true
        description: Announcements for this source. Each item — symbol, title, desc, date, attachment (URL or null).
    cache_ttl_seconds: 180
  - id: financial_tables_markdown
    name: Financial Tables (Markdown)
    description: Fetch financial summary for an Indian ticker as a markdown string by scraping screener.in. Includes pros/cons, about, key ratios, shareholding pattern, balance sheet, P&L, quarterly results, and peer comparison.
    service: nestjs
    endpoint: GET /filings/financial_tables/markdown/{ticker}
    auth:
      type: bearer_jwt
    rate_limit:
      requests_per_minute: 30
    request_fields:
      - field: ticker
        type: string
        required: true
        description: Stock ticker symbol or company name (path param). Resolved case-insensitively against stock_identifier, ticker, and company_name in DB.
      - field: form
        type: string
        required: false
        description: "Query param. \"standalone\" for standalone view. Any other value or omitted defaults to consolidated view."
    response_fields:
      - field: (string)
        type: string
        required: true
        description: "Raw markdown string with sections in order: Financial Summary heading, Pros & Cons, About, Stock Details (key ratios), Shareholding Pattern, Balance Sheet, Profit & Loss, Quarterly Results, Peer Comparison. Failed sections render as ## Skipping {title} rather than erroring."
    cache_ttl_seconds: 300
auth_defaults:
  timeout_seconds: 30
  retry_attempts: 3
  retry_backoff_factor: 2.0
  ssl_verify: true
naming_conventions:
  dashboard_file_prefix: dashboard_
  component_file_prefix: component_
  hook_prefix: use
  constant_prefix: DASHBOARD_
```

<!-- END GENERATED CONTENT -->
