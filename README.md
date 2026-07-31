# Emertrack Docker Deployment Guide

This repository contains the Emertrack application with a Docker Compose stack for:
- PostgreSQL database
- MinIO object storage
- Go backend service
- Next.js frontend
- Nginx reverse proxy with HTTPS

## What was done
- Copied `.env.example` to `.env`
- Filled `.env` with working default values for local development
- Deployed the stack using Docker Compose
- Created the required MinIO bucket (`emertrack`)
- Confirmed the admin seeder variables are available for first login

## Prerequisites
- Docker Desktop or Docker Engine with Compose support
- `docker compose` available in your shell
- Ports must be available (if possible): `8443`, `3000`, `9000`, `9101`, `5432`, and `8080`. Or any port base of your server.

## Deployment steps
1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your environment-specific values.
   At minimum, update:
   - `BACKEND_PORT`
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `SMTP_*`
   - `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`
   - `DB_PASSWORD`
   - `RUN_SEEDER=true`
   - `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`
   - `SEED_SITE_CODE, SEED_SITE_NAME, SEED_ADMIN_NIK, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD`
   - `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_MINIO_URL`
   - `FRONTEND_PORT`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT`, `NGINX_HTTPS_PORT`, `NGINX_SERVER_NAME`


3. Make certificate SSL
   a. Make certs folder
      ``` bash
         mkdir nginx/certs
      ```
   b. Go to `certs` folder
      ```bash
         cd nginx/certs
      ```
   c. Generate the certificates
      ``` bash
         openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout key.pem -out cert.pem \
            -subj "/CN=<your-address" \
            -addext "subjectAltName=IP:<your-address>"
      ```

4. Start the entire stack:

   ```bash
   docker compose up -d --build
   ```

5. Verify the services are running:

   ```bash
   docker compose ps
   ```

## MinIO bucket setup
The application expects a MinIO bucket matching the `S3_BUCKET` value in `.env`.

After MinIO is running, create the bucket and set it to public access using the MinIO Client (`mc`):

```bash
# Run MinIO shell
docker exec -it emertrack-minio sh \
  mc alias set local http://localhost:9000 minioadmin minioadmin

# Create the bucket
  mc mb local/emertrack

# Set bucket to public read access so files can be accessed without authentication
  mc anonymous set public local/emertrack
```

If you prefer the MinIO Console, open:

- `http://localhost:9101` (or `http://<host>:<MINIO_CONSOLE_PORT>`)

Login with:
- Username: `minioadmin`
- Password: `minioadmin`

Then:
1. Create bucket `emertrack` if it does not already exist.
2. Select the bucket → **Anonymous** → toggle **Read Only** to enable public access for downloads.

## First admin login
The first admin user is seeded by the backend when `RUN_SEEDER=true`.
Use the credentials from `.env`:

- Email: `admin@emertrack.local`
- Password: `Admin@12345`

If you changed the admin seed values, use those values instead.

Login via the frontend or API:

- Frontend: `https://localhost:8443/login`
- API: `https://localhost:8443/api/v1/login`

## Notes
- If the compose command fails because container names already exist, stop and remove the conflicting containers first.
- The `.env` file is intentionally excluded from Git via `.gitignore`.
- In this repository, MinIO is configured to use path-style requests and the bucket name is loaded from `S3_BUCKET`.

## Example `.env` values
The `.env` file created for this environment includes:

```env
BACKEND_PORT=8080
DATABASE_URL=host=emertrack-db user=postgres password=postgres dbname=emertrack port=5432 sslmode=disable
JWT_SECRET=supersecretjwtkey
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
SMTP_FROM=no-reply@emertrack.local
S3_ENDPOINT=http://emertrack-minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=emertrack
S3_REGION=us-east-1
DB_PASSWORD=postgres
DB_PORT=5432
RUN_SEEDER=true
SEED_SITE_CODE=YOUR CODE SITE
SEED_SITE_NAME=YOUR DESC SITE
SEED_DEPT_CODE=QAQS
SEED_DEPT_NAME=Quality Assurance - Quality System
SEED_ADMIN_NIK=0000000001
SEED_ADMIN_NAME=Super Admin
SEED_ADMIN_EMAIL=admin@emertrack.local
SEED_ADMIN_PASSWORD=Admin@12345
NEXT_EMAIL_EMERTRACK=admin@emertrack.local
NEXT_PUBLIC_API_URL=https://localhost:8443/api/v1
NEXT_PUBLIC_MINIO_URL=https://localhost:8443/storage
FRONTEND_BASE_URL=https://localhost:8443
FRONTEND_PORT=3000
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9101
NGINX_HTTPS_PORT=8443
NGINX_SERVER_NAME=localhost
```

Adjust these values for your environment before deployment.
