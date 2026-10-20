#!/usr/bin/env bash
# One-time setup so GitHub can deploy the database rules and the notification
# functions by itself, and so the Robot tab can download 3D files. Run it in Google Cloud Shell (it's already signed in as
# you), from console.cloud.google.com with the ftc-32313-tasks project:
#
#   bash <(curl -sL https://raw.githubusercontent.com/AsherMosseri/HarryTrotters/main/scripts/setup-firebase-deploy.sh)
#
# No keys or passwords are created: GitHub proves it's this repo's main branch
# (Workload Identity Federation) and gets short-lived access.
set -euo pipefail

PROJECT=ftc-32313-tasks
REPO_ID=1426118951 # AsherMosseri/HarryTrotters
SA_NAME=github-deploy
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"

gcloud config set project "$PROJECT" --quiet
PN=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
quiet() { "$@" --quiet >/dev/null; }

echo "1/5 Turning on the Google Cloud services the functions need (a few minutes)…"
gcloud services enable \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com cloudresourcemanager.googleapis.com \
  compute.googleapis.com cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  run.googleapis.com eventarc.googleapis.com pubsub.googleapis.com cloudscheduler.googleapis.com \
  firebaserules.googleapis.com fcm.googleapis.com fcmregistrations.googleapis.com firebaseinstallations.googleapis.com

echo "2/5 Creating the deploy account…"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 \
  || quiet gcloud iam service-accounts create "$SA_NAME" --display-name="GitHub deploy (HarryTrotters)"
for role in roles/editor roles/resourcemanager.projectIamAdmin; do
  quiet gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$role" --condition=None
done

echo "3/5 Letting the functions build and run…"
COMPUTE="$PN-compute@developer.gserviceaccount.com"
for i in $(seq 1 30); do
  gcloud iam service-accounts describe "$COMPUTE" >/dev/null 2>&1 && break
  sleep 10
done
for role in roles/cloudbuild.builds.builder roles/eventarc.eventReceiver roles/run.invoker; do
  quiet gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$COMPUTE" --role="$role" --condition=None
done

echo "4/5 Trusting GitHub (only the main branch of this repo)…"
gcloud iam workload-identity-pools describe github --location=global >/dev/null 2>&1 \
  || quiet gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers describe harrytrotters --location=global --workload-identity-pool=github >/dev/null 2>&1 \
  || quiet gcloud iam workload-identity-pools providers create-oidc harrytrotters \
    --location=global --workload-identity-pool=github --display-name="HarryTrotters repo" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository_id == '$REPO_ID' && assertion.ref == 'refs/heads/main'"
quiet gcloud iam service-accounts add-iam-policy-binding "$SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PN/locations/global/workloadIdentityPools/github/attribute.repository_id/$REPO_ID"

echo "5/5 Letting the site download Robot tab 3D files…"
echo '[{"origin":["https://ashermosseri.github.io"],"method":["GET"],"maxAgeSeconds":3600}]' > /tmp/cors.json
gcloud storage buckets update gs://ftc-32313-tasks.firebasestorage.app --cors-file=/tmp/cors.json --quiet

echo
echo "✅ Done. GitHub can now deploy the rules and notifications. Project number: $PN"
