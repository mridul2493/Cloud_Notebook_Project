### Auth registration with AWS DynamoDB

To store users in AWS, the backend uses DynamoDB via the shared client defined in `backend/src/config/aws.js`.

- **Required AWS env vars** (set in `backend/env` or your process env):
  - `AWS_REGION` (e.g., `us-east-1`)
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `DYNAMODB_USERS_TABLE` (defaults to `AcademicUsers` if not set)
  - `JWT_SECRET` (for issuing tokens)

- **Backend port**: `5003` (see `backend/src/index.js`). Frontend requests are proxied to `http://localhost:5003/api/*` in development via `frontend/next.config.js`.

- **IAM permissions** for the execution role/credentials:
  - `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:UpdateItem`, `dynamodb:Scan` on the users table.

- **DynamoDB table schema** (on-demand capacity is fine):
  - Table name: `AcademicUsers`
  - Primary key: `id` (String)

No local fallback is used; registration writes to AWS DynamoDB.

### Where to put your AWS credentials

You can provide credentials in any of these standard AWS SDK locations (pick one):

- Environment file for the backend (recommended for local dev):
  - Edit `backend/env` and add:
    - `AWS_ACCESS_KEY_ID=YOUR_KEY`
    - `AWS_SECRET_ACCESS_KEY=YOUR_SECRET`
    - `AWS_REGION=us-east-1` (or your region)

- Shell environment variables (export before starting the backend):
  - `export AWS_ACCESS_KEY_ID=YOUR_KEY`
  - `export AWS_SECRET_ACCESS_KEY=YOUR_SECRET`
  - `export AWS_REGION=us-east-1`

- Shared AWS config/credentials files (works system-wide):
  - `~/.aws/credentials`:
    - `[default]`
    - `aws_access_key_id=YOUR_KEY`
    - `aws_secret_access_key=YOUR_SECRET`
  - `~/.aws/config`:
    - `[default]`
    - `region=us-east-1`
  - Optionally set `AWS_PROFILE=default` if using a non-default profile.

The backend uses the SDK default credential provider chain, so any of the above will work. Ensure the IAM user/role has DynamoDB permissions on the `DYNAMODB_USERS_TABLE`.

