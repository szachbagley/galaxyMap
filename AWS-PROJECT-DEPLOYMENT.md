# Galaxy Map — Serverless AWS Deployment

This document describes how to migrate the Galaxy Map application from its current EC2-based stack (Express + MySQL, Caddy-served React SPA) to a fully serverless AWS architecture using S3, Lambda, API Gateway, and DynamoDB.

---

## Architecture Overview

### Prototype (what we build)

```
                        ┌──────────────────────────┐
                        │        Browser           │
                        └─────┬──────────┬─────────┘
                              │          │
                     HTML/CSS/JS     fetch(/api/...)
                              │          │
                              ▼          ▼
                 ┌────────────────┐  ┌─────────────────┐
                 │  S3 Bucket     │  │  API Gateway     │
                 │  (Static       │  │  (HTTP API)      │
                 │   Website      │  │                  │
                 │   Hosting)     │  │  CORS enabled    │
                 └────────────────┘  └────────┬────────┘
                                              │
                                    Lambda proxy integration
                                              │
                                              ▼
                                   ┌──────────────────┐
                                   │  Lambda Function  │
                                   │  (Node.js 20)     │
                                   │  Single handler,  │
                                   │  all routes       │
                                   └────────┬─────────┘
                                            │
                                       AWS SDK v3
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │  DynamoDB         │
                                   │  (on-demand)      │
                                   │  GalaxyMapSystems │
                                   │  + GridCoordIndex  │
                                   │    GSI            │
                                   └──────────────────┘
```

### Production (one region, at scale)

```
                        ┌──────────────────────────┐
                        │        Users             │
                        └─────┬──────────┬─────────┘
                              │          │
                              ▼          │
                 ┌────────────────┐      │
                 │  CloudFront    │      │
                 │  (CDN + HTTPS) │      │
                 └───┬────────┬──┘      │
                     │        │         │
              static │   /api/*         │
                     │        │         │
                     ▼        ▼         │
        ┌──────────────┐ ┌─────────────────┐
        │  S3 (origin) │ │  API Gateway     │
        │  (static     │ │  (HTTP API)      │
        │   assets)    │ │  + WAF           │
        └──────────────┘ └────────┬────────┘
                                  │
                                  ▼
                       ┌──────────────────┐
                       │  Lambda Function  │
                       │  (provisioned     │
                       │   concurrency)    │
                       └────────┬─────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
           ┌────────────┐ ┌─────────┐ ┌────────────┐
           │  DynamoDB   │ │  DAX    │ │ CloudWatch │
           │  (on-demand │ │ (cache) │ │ (logs,     │
           │  + backups) │ │         │ │  alarms)   │
           └─────────────┘ └─────────┘ └────────────┘
```

Production adds: CloudFront for HTTPS + global edge caching, WAF for DDoS/bot protection, DAX for DynamoDB read caching, provisioned Lambda concurrency to eliminate cold starts, CloudWatch monitoring and alarms, and DynamoDB point-in-time recovery backups.

---

## Current State

| Layer | Current | Target |
|-------|---------|--------|
| Frontend hosting | EC2 + Caddy (HTTPS via Let's Encrypt) | S3 static website hosting |
| Backend runtime | Express.js on EC2 (PM2) | Lambda (Node.js 20) |
| API routing | Express routes on port 3001 | API Gateway (HTTP API) |
| Database | MySQL 8.x on EC2 (Knex query builder) | DynamoDB (AWS SDK v3) |
| Data | ~6,757 canon star systems | Same data, migrated |

---

## Prerequisites

- AWS CLI installed and configured (`aws configure`) with credentials for account `403894226819`
- Node.js 20+ installed locally
- The existing EC2 deployment is running (used as the data source for seeding DynamoDB)

---

## Step 1 — Create the DynamoDB Table

**Table name:** `GalaxyMapSystems`

| Key | Attribute | Type |
|-----|-----------|------|
| Partition Key | `id` | String |

**GSI:** `GridCoordIndex`

| Key | Attribute | Type |
|-----|-----------|------|
| Partition Key | `gridCoord` | String (e.g. `"L-9"`) |
| Sort Key | `name` | String |
| Projection | ALL |

`gridCoord` is a synthetic composite attribute (`"${grid_col}-${grid_row}"`) used only for efficient grid-based lookups. It is not returned in API responses.

**Billing mode:** On-demand (pay-per-request). No capacity planning needed.

```bash
aws dynamodb create-table \
  --table-name GalaxyMapSystems \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=gridCoord,AttributeType=S \
    AttributeName=name,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    '[{
      "IndexName": "GridCoordIndex",
      "KeySchema": [
        {"AttributeName": "gridCoord", "KeyType": "HASH"},
        {"AttributeName": "name", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }]' \
  --billing-mode PAY_PER_REQUEST
```

Wait for the table to become ACTIVE:

```bash
aws dynamodb wait table-exists --table-name GalaxyMapSystems
echo "Table is ACTIVE"
```

### DynamoDB Item Shape

Each item stored in DynamoDB matches the Express API's JSON response shape (snake_case), plus the synthetic `gridCoord` field:

```json
{
  "id": "1161",
  "name": "Coruscant",
  "sector": "Corusca (Coruscant)",
  "region": "Core Worlds",
  "grid_col": "L",
  "grid_row": 9,
  "gridCoord": "L-9",
  "description": null,
  "is_user_added": 0,
  "created_at": "2026-04-05T05:34:25.000Z",
  "updated_at": "2026-04-05T05:34:25.000Z"
}
```

---

## Step 2 — Seed DynamoDB

### 2a — Create the seed script

Create `backend/scripts/seedDynamo.mjs`:

```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

const SOURCE_URL =
  process.env.SOURCE_URL || 'https://galaxy-map-52-206-81-107.nip.io/api/systems';
const TABLE = process.env.TABLE_NAME || 'GalaxyMapSystems';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client);

async function main() {
  // 1. Fetch all systems from the live Express API
  console.log(`Fetching systems from ${SOURCE_URL}...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const systems = await res.json();
  console.log(`Fetched ${systems.length} systems`);

  // 2. Transform: stringify id, add gridCoord, handle nulls
  const items = systems.map((s) => {
    const item = {
      id: String(s.id),
      name: s.name,
      grid_col: s.grid_col,
      grid_row: s.grid_row,
      gridCoord: `${s.grid_col}-${s.grid_row}`,
      is_user_added: s.is_user_added ? 1 : 0,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
    // DynamoDB cannot store null — omit null fields or store as empty string
    if (s.sector) item.sector = s.sector;
    if (s.region) item.region = s.region;
    if (s.description) item.description = s.description;
    return item;
  });

  // 3. BatchWriteItem in chunks of 25
  const BATCH_SIZE = 25;
  let written = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const params = {
      RequestItems: {
        [TABLE]: batch.map((item) => ({
          PutRequest: { Item: item },
        })),
      },
    };

    let unprocessed = params;
    do {
      const result = await ddb.send(new BatchWriteCommand(unprocessed));
      const leftover = result.UnprocessedItems?.[TABLE];
      if (leftover && leftover.length > 0) {
        unprocessed = { RequestItems: { [TABLE]: leftover } };
        await new Promise((r) => setTimeout(r, 200)); // back off
      } else {
        unprocessed = null;
      }
    } while (unprocessed);

    written += batch.length;
    if (written % 500 === 0 || written === items.length) {
      console.log(`  ${written} / ${items.length} written`);
    }
  }

  console.log('Seeding complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### 2b — Run the seed script

```bash
cd backend/scripts
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
node seedDynamo.mjs
```

Verify the data landed:

```bash
aws dynamodb scan \
  --table-name GalaxyMapSystems \
  --select COUNT \
  --query 'Count'
# Should print 6757
```

---

## Step 3 — Write the Lambda Handler

Create `backend/lambda/index.mjs` — a single Lambda function that handles all API routes.

### Routing

The handler inspects `event.routeKey` (set by API Gateway HTTP API) to determine which operation to run:

| Route Key | Handler | DynamoDB Operation |
|---|---|---|
| `GET /api/systems` | `getAllSystems` | Scan (paginated, collects all pages) |
| `GET /api/systems/grid/{col}/{row}` | `getSystemsByGrid` | Query GSI `GridCoordIndex` where `gridCoord = "${col}-${row}"` |
| `GET /api/systems/{id}` | `getSystemById` | GetItem by PK `id` |
| `GET /api/systems/{id}/nearby` | `getNearby` | GetItem → compute 3×3 neighborhood coords → Query GSI for each (up to 9 queries) → combine |
| `POST /api/systems` | `createSystem` | Validate → PutItem with UUID, `is_user_added=1` |
| `PUT /api/systems/{id}` | `updateSystem` | GetItem → check `is_user_added` → validate → PutItem |
| `DELETE /api/systems/{id}` | `deleteSystem` | GetItem → check `is_user_added` → DeleteItem |

### Response Format

Every response uses the API Gateway proxy integration shape:

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  },
  "body": "{\"id\":1161,\"name\":\"Coruscant\", ...}"
}
```

### Key Compatibility Details

The Lambda must return the exact same JSON shape as the Express API so the frontend works without code changes:

- `gridCoord` is stripped from all responses (it's internal to DynamoDB)
- `id` is stored as String in DynamoDB but returned as Number (`parseInt(item.id)`) in JSON
- `grid_row` is stored as Number in DynamoDB, returned as number in JSON
- `is_user_added` is 0 or 1 (not boolean) to match MySQL behavior
- `sector`, `region`, `description` return `null` (not absent) when missing
- `created_at` and `updated_at` are ISO 8601 strings

### getAllSystems — Handling the Full Scan

DynamoDB returns max 1 MB per Scan. With ~6,757 items at ~150–200 bytes each (~1.35 MB total), the scan needs 2 pages. The handler must loop on `LastEvaluatedKey`:

```javascript
async function getAllSystems() {
  const items = [];
  let lastKey = undefined;
  do {
    const params = { TableName: TABLE };
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const result = await ddb.send(new ScanCommand(params));
    items.push(...result.Items);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  items.sort((a, b) => a.name.localeCompare(b.name));
  return response(200, items.map(toApi));
}
```

### getNearby — 3×3 Grid Query

```javascript
const COLS = ['C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V'];

async function getNearby(id) {
  // 1. Fetch the target system
  const system = await getItem(id);
  if (!system) return response(404, { error: 'System not found' });

  const colIdx = COLS.indexOf(system.grid_col);
  const row = system.grid_row;

  // 2. Build list of 3×3 neighbor coordinates
  const coords = [];
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      const ci = colIdx + dc;
      const r = row + dr;
      if (ci >= 0 && ci < COLS.length && r >= 1 && r <= 21) {
        coords.push(`${COLS[ci]}-${r}`);
      }
    }
  }

  // 3. Query GSI for each coordinate in parallel
  const results = await Promise.all(
    coords.map((gc) =>
      ddb.send(new QueryCommand({
        TableName: TABLE,
        IndexName: 'GridCoordIndex',
        KeyConditionExpression: 'gridCoord = :gc',
        ExpressionAttributeValues: { ':gc': gc },
      }))
    )
  );

  const items = results.flatMap((r) => r.Items);
  items.sort((a, b) => {
    if (a.grid_col !== b.grid_col) return a.grid_col.localeCompare(b.grid_col);
    if (a.grid_row !== b.grid_row) return a.grid_row - b.grid_row;
    return a.name.localeCompare(b.name);
  });

  return response(200, items.map(toApi));
}
```

### Validation (POST and PUT)

Port the existing `validateSystem.js` logic:

```javascript
function validateInput(body) {
  const errors = [];
  if (!body.name || !body.name.trim()) errors.push('name is required');
  const col = (body.grid_col || '').toUpperCase();
  if (!COLS.includes(col)) errors.push('grid_col must be a letter between C and V');
  const row = Number(body.grid_row);
  if (!Number.isInteger(row) || row < 1 || row > 21)
    errors.push('grid_row must be an integer between 1 and 21');
  return errors;
}
```

### Lambda Package

The Lambda needs no external dependencies — the AWS SDK v3 for DynamoDB is included in the Node.js 20 Lambda runtime. The deployment package is just the single `index.mjs` file:

```bash
cd backend/lambda
zip function.zip index.mjs
```

---

## Step 4 — Create the IAM Role for Lambda

### 4a — Create the trust policy

```bash
cat > /tmp/lambda-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

ROLE_ARN=$(aws iam create-role \
  --role-name GalaxyMapLambdaRole \
  --assume-role-policy-document file:///tmp/lambda-trust.json \
  --query 'Role.Arn' \
  --output text)

echo "Role ARN: $ROLE_ARN"
```

### 4b — Attach the basic execution policy (CloudWatch Logs)

```bash
aws iam attach-role-policy \
  --role-name GalaxyMapLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 4c — Add DynamoDB permissions (inline policy)

```bash
ACCOUNT_ID=403894226819

cat > /tmp/dynamo-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Scan",
      "dynamodb:Query"
    ],
    "Resource": [
      "arn:aws:dynamodb:us-east-1:${ACCOUNT_ID}:table/GalaxyMapSystems",
      "arn:aws:dynamodb:us-east-1:${ACCOUNT_ID}:table/GalaxyMapSystems/index/GridCoordIndex"
    ]
  }]
}
EOF

aws iam put-role-policy \
  --role-name GalaxyMapLambdaRole \
  --policy-name DynamoDBAccess \
  --policy-document file:///tmp/dynamo-policy.json
```

Wait ~10 seconds for the role to propagate before creating the Lambda function.

---

## Step 5 — Deploy the Lambda Function

```bash
cd backend/lambda
zip function.zip index.mjs

ROLE_ARN=$(aws iam get-role --role-name GalaxyMapLambdaRole --query 'Role.Arn' --output text)

aws lambda create-function \
  --function-name GalaxyMapAPI \
  --runtime nodejs20.x \
  --handler index.handler \
  --role $ROLE_ARN \
  --zip-file fileb://function.zip \
  --timeout 15 \
  --memory-size 256 \
  --environment "Variables={TABLE_NAME=GalaxyMapSystems}"
```

### Redeploying after code changes

```bash
cd backend/lambda
zip function.zip index.mjs
aws lambda update-function-code \
  --function-name GalaxyMapAPI \
  --zip-file fileb://function.zip
```

---

## Step 6 — Create the API Gateway (HTTP API)

### 6a — Create the API with CORS

```bash
API_ID=$(aws apigatewayv2 create-api \
  --name GalaxyMapAPI \
  --protocol-type HTTP \
  --cors-configuration \
    'AllowOrigins=["*"],AllowMethods=["GET","POST","PUT","DELETE","OPTIONS"],AllowHeaders=["Content-Type"]' \
  --query 'ApiId' \
  --output text)

echo "API ID: $API_ID"
```

### 6b — Create the Lambda integration

```bash
LAMBDA_ARN=$(aws lambda get-function \
  --function-name GalaxyMapAPI \
  --query 'Configuration.FunctionArn' \
  --output text)

INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id $API_ID \
  --integration-type AWS_PROXY \
  --integration-uri $LAMBDA_ARN \
  --payload-format-version 2.0 \
  --query 'IntegrationId' \
  --output text)

echo "Integration ID: $INTEGRATION_ID"
```

### 6c — Add routes

```bash
for ROUTE in \
  "GET /api/systems" \
  "GET /api/systems/grid/{col}/{row}" \
  "GET /api/systems/{id}" \
  "GET /api/systems/{id}/nearby" \
  "POST /api/systems" \
  "PUT /api/systems/{id}" \
  "DELETE /api/systems/{id}"
do
  aws apigatewayv2 create-route \
    --api-id $API_ID \
    --route-key "$ROUTE" \
    --target "integrations/$INTEGRATION_ID"
  echo "  Route created: $ROUTE"
done
```

### 6d — Create a stage and enable auto-deploy

```bash
aws apigatewayv2 create-stage \
  --api-id $API_ID \
  --stage-name '$default' \
  --auto-deploy
```

### 6e — Grant API Gateway permission to invoke the Lambda

```bash
ACCOUNT_ID=403894226819

aws lambda add-permission \
  --function-name GalaxyMapAPI \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*"
```

### 6f — Get the invoke URL

```bash
API_URL=$(aws apigatewayv2 get-api \
  --api-id $API_ID \
  --query 'ApiEndpoint' \
  --output text)

echo "API Gateway URL: $API_URL"
# e.g. https://abc123xyz.execute-api.us-east-1.amazonaws.com
```

### 6g — Quick API smoke test

```bash
# All systems (first 200 chars)
curl -s "$API_URL/api/systems" | head -c 200

# Grid square L-9 (Coruscant's location)
curl -s "$API_URL/api/systems/grid/L/9"

# Single system
curl -s "$API_URL/api/systems/1161"
```

---

## Step 7 — Deploy the Frontend to S3

### 7a — Create and configure the S3 bucket

```bash
BUCKET=galaxy-map-frontend-542
REGION=us-east-1

# Create bucket
aws s3api create-bucket \
  --bucket $BUCKET \
  --region $REGION

# Disable block public access
aws s3api put-public-access-block \
  --bucket $BUCKET \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Attach public-read policy
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${BUCKET}/*"
  }]
}
EOF

aws s3api put-bucket-policy \
  --bucket $BUCKET \
  --policy file:///tmp/bucket-policy.json

# Enable static website hosting
# error-document = index.html so React Router deep links work
aws s3 website s3://$BUCKET/ \
  --index-document index.html \
  --error-document index.html
```

### 7b — Build and upload

```bash
cd galaxy-map

# API_URL is the API Gateway endpoint from Step 6f
VITE_API_BASE=$API_URL npm run build

aws s3 sync dist/ s3://$BUCKET/ --delete
```

### 7c — Get the website URL

```bash
WEBSITE_URL="http://${BUCKET}.s3-website-${REGION}.amazonaws.com"
echo "Frontend URL: $WEBSITE_URL"
```

### 7d — Redeploying after frontend code changes

```bash
cd galaxy-map
VITE_API_BASE=$API_URL npm run build
aws s3 sync dist/ s3://$BUCKET/ --delete
```

---

## Step 8 — Full Smoke Test

### API endpoints (via curl)

```bash
# All systems
curl -s "$API_URL/api/systems" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} systems')"

# Grid square
curl -s "$API_URL/api/systems/grid/J/8" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} systems in J-08')"

# Single system (Coruscant)
curl -s "$API_URL/api/systems/1161" | python3 -m json.tool

# Nearby systems
curl -s "$API_URL/api/systems/1161/nearby" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} nearby')"
```

### Browser tests

Open `$WEBSITE_URL` and verify:

1. Grid renders with ~6,757 systems (no "SIGNAL LOST" overlay)
2. Clicking a cell shows the system list in the panel
3. Clicking a system row navigates to `/systems/:id` detail page
4. System name, region, sector, grid coordinate all display correctly
5. Hard refresh on `/systems/1161` still loads (SPA fallback)
6. Nearby grid shows correct counts
7. `< GALAXY MAP` back link returns to grid with correct cell selected
8. DevTools Network tab: all XHRs go to the API Gateway URL and return 200, no CORS errors

---

## Yearly Production Price Estimate

### Traffic Assumptions

Modeled after a company with ~31,000 retail locations (per the project brief):

- **Annual customer visits:** 100 million
- **App usage rate:** 5% of visits → **5 million sessions/year**
- **Per session:** 1 full catalog load + 5 grid queries + 3 detail views = **9 API calls/session**
- **Monthly API calls:** ~3.75 million
- **Average response size:** ~8 KB (catalog load is ~1.4 MB, individual queries ~1 KB)
- **Monthly data transfer out:** ~30 GB
- **Write traffic (user-added systems):** negligible (~5,000 writes/month)
- **Deployment across 10 regions** (traffic split equally)

### Per-Region Monthly Cost

| Service | Usage | Monthly Cost |
|---|---|---|
| **DynamoDB on-demand reads** | ~1.875M reads/mo × $0.25/1M RRU | $0.47 |
| **DynamoDB on-demand writes** | ~500 writes/mo | $0.01 |
| **DynamoDB storage** | ~2 MB | $0.01 |
| **Lambda invocations** | ~375K/mo (first 1M free) | $0.00 |
| **Lambda compute** | 375K × 256MB × 100ms avg = 9,600 GB-s | $0.16 |
| **API Gateway HTTP API** | ~375K requests × $1.00/1M | $0.38 |
| **S3 storage** | ~5 MB | $0.01 |
| **S3 GET requests** | ~50K/mo | $0.02 |
| **Data transfer out** | ~3 GB | $0.27 |
| **CloudFront** | ~3 GB transfer + ~50K requests | $0.30 |
| **CloudWatch Logs** | ~1 GB ingestion | $0.50 |
| **Region subtotal** | | **~$2.13** |

### Global Annual Cost (10 regions)

| | Cost |
|---|---|
| Per region per month | ~$2.13 |
| Per region per year | ~$25.56 |
| **10 regions per year** | **~$256** |

> **Note:** These estimates use on-demand pricing and assume traffic is evenly distributed. Actual costs would vary with traffic spikes, CloudFront cache hit ratios, and whether provisioned capacity or reserved pricing is used. The serverless model scales to zero during off-hours, keeping costs low for moderate traffic.

---

## Tearing Down

To remove all serverless resources:

```bash
# 1. Empty and delete S3 bucket
aws s3 rm s3://$BUCKET/ --recursive
aws s3api delete-bucket --bucket $BUCKET

# 2. Delete API Gateway
aws apigatewayv2 delete-api --api-id $API_ID

# 3. Delete Lambda
aws lambda delete-function --function-name GalaxyMapAPI

# 4. Delete IAM role (detach policies first)
aws iam detach-role-policy \
  --role-name GalaxyMapLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role-policy \
  --role-name GalaxyMapLambdaRole \
  --policy-name DynamoDBAccess
aws iam delete-role --role-name GalaxyMapLambdaRole

# 5. Delete DynamoDB table
aws dynamodb delete-table --table-name GalaxyMapSystems
```

---

## Deployed Reference

_Fill in after deployment:_

| Resource | Value |
|---|---|
| DynamoDB table | `GalaxyMapSystems` |
| Lambda function | `GalaxyMapAPI` |
| IAM role | `GalaxyMapLambdaRole` |
| API Gateway ID | `<fill in>` |
| API Gateway URL | `https://<fill in>.execute-api.us-east-1.amazonaws.com` |
| S3 bucket | `galaxy-map-frontend-542` |
| Frontend URL | `http://galaxy-map-frontend-542.s3-website-us-east-1.amazonaws.com` |
