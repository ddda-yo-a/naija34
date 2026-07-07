#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Build, push, and deploy Naija34 backend to Google Cloud Run
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Prerequisites:
#   - gcloud CLI installed and authenticated  (gcloud auth login)
#   - Docker installed and running
#   - All variables in the CONFIG section below filled in
# =============================================================================
set -euo pipefail

# ── CONFIG — fill these in before running ─────────────────────────────────────

GCP_PROJECT_ID="YOUR_GCP_PROJECT_ID"          # e.g. naija34-prod
GCP_REGION="us-central1"                       # Cloud Run region
SERVICE_NAME="naija34-backend"                 # Cloud Run service name
ARTIFACT_REPO="naija34"                        # Artifact Registry repo name (created below)
IMAGE_NAME="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REPO}/${SERVICE_NAME}"

# ── Production secrets (will be stored in Google Secret Manager) ───────────────
# Do NOT commit real values to git. Fill these in at deploy time or export them
# as shell variables before running this script.
MONGODB_URI="${MONGODB_URI:-REPLACE_WITH_MONGODB_ATLAS_URI}"
JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-REPLACE_WITH_64_CHAR_SECRET}"
OTP_PEPPER="${OTP_PEPPER:-REPLACE_WITH_DIFFERENT_64_CHAR_SECRET}"
EMAIL_FROM="${EMAIL_FROM:-34th Street <no-reply@34thstreet.ng>}"
SMTP_HOST="${SMTP_HOST:-smtp.example.com}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_SECURE="${SMTP_SECURE:-false}"
SMTP_USER="${SMTP_USER:-REPLACE_WITH_SMTP_USER}"
SMTP_PASS="${SMTP_PASS:-REPLACE_WITH_SMTP_PASS}"
# Comma-separated allowed CORS origins. For a purely native mobile app this
# can stay empty; React Native requests have no browser Origin header.
CORS_ORIGINS="${CORS_ORIGINS:-}"

# ── Derived values ─────────────────────────────────────────────────────────────
IMAGE_TAG="${IMAGE_NAME}:$(git rev-parse --short HEAD 2>/dev/null || echo latest)"

echo "=================================================="
echo " Naija34 Backend — Cloud Run Deployment"
echo " Project : ${GCP_PROJECT_ID}"
echo " Region  : ${GCP_REGION}"
echo " Service : ${SERVICE_NAME}"
echo " Image   : ${IMAGE_TAG}"
echo "=================================================="

# ── 1. Set active project ──────────────────────────────────────────────────────
echo ""
echo "[1/6] Setting active GCP project..."
gcloud config set project "${GCP_PROJECT_ID}"

# ── 2. Enable required APIs ────────────────────────────────────────────────────
echo ""
echo "[2/6] Enabling Cloud Run, Artifact Registry, and Secret Manager APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project="${GCP_PROJECT_ID}"

# ── 3. Create Artifact Registry repository (idempotent) ───────────────────────
echo ""
echo "[3/6] Creating Artifact Registry repository (skipped if already exists)..."
gcloud artifacts repositories create "${ARTIFACT_REPO}" \
  --repository-format=docker \
  --location="${GCP_REGION}" \
  --description="Naija34 backend Docker images" \
  --project="${GCP_PROJECT_ID}" 2>/dev/null || true

# ── 4. Authenticate Docker to Artifact Registry ────────────────────────────────
echo ""
echo "[4/6] Configuring Docker auth for Artifact Registry..."
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

# ── 5. Build and push the Docker image ────────────────────────────────────────
echo ""
echo "[5/6] Building and pushing Docker image..."
docker build \
  --platform linux/amd64 \
  --tag "${IMAGE_TAG}" \
  --tag "${IMAGE_NAME}:latest" \
  "$(dirname "$0")"

docker push "${IMAGE_TAG}"
docker push "${IMAGE_NAME}:latest"

# ── 6. Store secrets in Secret Manager ────────────────────────────────────────
echo ""
echo "[6/6] Upserting secrets in Secret Manager..."

upsert_secret() {
  local name="$1"
  local value="$2"
  # Create the secret if it doesn't exist, then add a new version.
  gcloud secrets describe "${name}" --project="${GCP_PROJECT_ID}" &>/dev/null || \
    gcloud secrets create "${name}" \
      --replication-policy="automatic" \
      --project="${GCP_PROJECT_ID}"
  printf '%s' "${value}" | \
    gcloud secrets versions add "${name}" \
      --data-file=- \
      --project="${GCP_PROJECT_ID}"
}

upsert_secret "naija34-mongodb-uri"        "${MONGODB_URI}"
upsert_secret "naija34-jwt-access-secret"  "${JWT_ACCESS_SECRET}"
upsert_secret "naija34-otp-pepper"         "${OTP_PEPPER}"
upsert_secret "naija34-smtp-pass"          "${SMTP_PASS}"

# ── 7. Deploy to Cloud Run ─────────────────────────────────────────────────────
echo ""
echo "[7/7] Deploying to Cloud Run..."

# Grant the Cloud Run service account access to secrets
PROJECT_NUMBER=$(gcloud projects describe "${GCP_PROJECT_ID}" --format="value(projectNumber)")
CR_SA="service-${PROJECT_NUMBER}@serverless-robot-prod.iam.gserviceaccount.com"

for SECRET in naija34-mongodb-uri naija34-jwt-access-secret naija34-otp-pepper naija34-smtp-pass; do
  gcloud secrets add-iam-policy-binding "${SECRET}" \
    --member="serviceAccount:${CR_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="${GCP_PROJECT_ID}" &>/dev/null || true
done

gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_TAG}" \
  --platform=managed \
  --region="${GCP_REGION}" \
  --allow-unauthenticated \
  --port=8080 \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=30 \
  --concurrency=80 \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="API_PREFIX=/api/v1" \
  --set-env-vars="TRUST_PROXY=1" \
  --set-env-vars="ACCESS_TOKEN_TTL_MINUTES=15" \
  --set-env-vars="REFRESH_TOKEN_TTL_DAYS=30" \
  --set-env-vars="REGISTRATION_TOKEN_TTL_MINUTES=30" \
  --set-env-vars="OTP_TTL_MINUTES=10" \
  --set-env-vars="OTP_RESEND_SECONDS=60" \
  --set-env-vars="OTP_MAX_ATTEMPTS=5" \
  --set-env-vars="EMAIL_DELIVERY_MODE=smtp" \
  --set-env-vars="EMAIL_FROM=${EMAIL_FROM}" \
  --set-env-vars="SMTP_HOST=${SMTP_HOST}" \
  --set-env-vars="SMTP_PORT=${SMTP_PORT}" \
  --set-env-vars="SMTP_SECURE=${SMTP_SECURE}" \
  --set-env-vars="SMTP_USER=${SMTP_USER}" \
  --set-env-vars="CORS_ORIGINS=${CORS_ORIGINS}" \
  --set-secrets="MONGODB_URI=naija34-mongodb-uri:latest" \
  --set-secrets="JWT_ACCESS_SECRET=naija34-jwt-access-secret:latest" \
  --set-secrets="OTP_PEPPER=naija34-otp-pepper:latest" \
  --set-secrets="SMTP_PASS=naija34-smtp-pass:latest" \
  --project="${GCP_PROJECT_ID}"

echo ""
echo "✅  Deployment complete!"
echo ""
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform=managed \
  --region="${GCP_REGION}" \
  --project="${GCP_PROJECT_ID}" \
  --format="value(status.url)")
echo "🌐  Service URL : ${SERVICE_URL}"
echo "🔍  Health check: ${SERVICE_URL}/health"
echo ""
echo "Update your frontend API base URL to: ${SERVICE_URL}/api/v1"
