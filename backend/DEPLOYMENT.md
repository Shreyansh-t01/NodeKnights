# NodeKnights Backend - Deployment Guide

## Production Deployment Checklist

### Before Deployment

- [ ] Set all environment variables in `.env`
- [ ] Firebase service account key configured
- [ ] Google OAuth credentials set up
- [ ] Database indexes created in Firestore
- [ ] Firestore security rules configured
- [ ] Cloud Storage bucket created
- [ ] SSL/TLS certificates configured
- [ ] API rate limiting configured
- [ ] Logging and monitoring set up
- [ ] Backup strategy implemented

### Deployment Steps

#### 1. Using Google Cloud Run (Recommended)

```bash
# Install gcloud CLI
gcloud init

# Create Docker image
docker build -t gcr.io/PROJECT_ID/nodeknights-backend .

# Push to Container Registry
docker push gcr.io/PROJECT_ID/nodeknights-backend

# Deploy to Cloud Run
gcloud run deploy nodeknights-backend \
  --image gcr.io/PROJECT_ID/nodeknights-backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars-from-file .env.prod
```

#### 2. Using Firebase Functions

```bash
npm install -g firebase-tools
firebase init functions
firebase deploy --only functions
```

#### 3. Using Compute Engine

```bash
# Create VM
gcloud compute instances create nodeknights-backend \
  --image-family debian-11 \
  --image-project debian-cloud

# SSH into instance
gcloud compute ssh nodeknights-backend

# Install Node.js and dependencies
curl -sL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt-get install nodejs

# Clone code and install
git clone <repo>
cd backend
npm install

# Start with PM2
npm install -g pm2
pm2 start server.js --name "nodeknights-backend"
pm2 startup
pm2 save
```

### Environment Configuration

**Production `.env.prod`:**
```env
PORT=8080
NODE_ENV=production
FIREBASE_PROJECT_ID=prod-project-id
GOOGLE_CLIENT_ID=prod-client-id
GOOGLE_CLIENT_SECRET=prod-secret
JWT_SECRET=<strong-random-secret>
DEBUG=false
```

### Security Hardening

1. **Firestore Security Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /documents/{document=**} {
      allow read, write: if request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

2. **API Security:**
   - Enable Cloud Armor for DDoS protection
   - Set up Cloud CDN for caching
   - Implement rate limiting
   - Use Cloud KMS for secret management

3. **Monitoring:**
   - Set up Cloud Monitoring dashboards
   - Configure alerts for errors
   - Monitor database performance
   - Track API usage

### Database Backup

```bash
# Scheduled daily backup
gcloud firestore export gs://backup-bucket/firestore-export-$(date '+%Y%m%d')
```

### Scaling & Load Balancing

For high traffic:
1. Use Cloud Load Balancer
2. Deploy multiple instances
3. Enable autoscaling
4. Use Cloud CDN for static content
5. Consider multi-region deployment

### Monitoring & Logs

View logs:
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit 50 --format json
```

Monitor metrics:
```bash
gcloud monitoring dashboards create --config-from-file dashboard.yaml
```

## Rollback Procedure

```bash
# Get previous deployment revision
gcloud run revisions list --service nodeknights-backend

# Deploy previous revision
gcloud run deploy nodeknights-backend \
  --image gcr.io/PROJECT_ID/nodeknights-backend@sha256:PREVIOUS_SHA
```

## Performance Tuning

### Database Optimization
- Create composite indexes for common queries
- Denormalize data for repeated reads
- Use pagination for large result sets
- Monitor slow queries in Firestore

### API Optimization
- Enable compression middleware
- Implement caching headers
- Optimize query patterns
- Monitor API response times

### File Upload Optimization
- Use Cloud Storage signed URLs
- Implement resumable uploads
- Process large files asynchronously
- Clean up temporary files

## Cost Optimization

1. Use Firestore On-Demand billing for variable traffic
2. Set up Cloud Storage lifecycle policies
3. Use Cloud CDN to reduce egress costs
4. Monitor and optimize database reads/writes
5. Set up budget alerts

## Disaster Recovery

1. **Regular Backups:**
   - Daily automated Firestore backups
   - Store in separate GCS bucket

2. **Monitoring:**
   - Alert on database errors
   - Monitor API health
   - Track error rates

3. **Recovery Plan:**
   - Document RTO/RPO targets
   - Test recovery procedures quarterly
   - Maintain runbook for common issues

For more details, refer to:
- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Google Cloud Deployment Manager](https://cloud.google.com/deployment-manager/docs)
