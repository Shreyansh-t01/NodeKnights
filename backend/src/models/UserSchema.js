/**
 * User Schema for Firebase
 */

const UserSchema = {
  id: String, // Firestore doc ID / User ID
  email: String,
  displayName: String,
  profilePicture: String,
  
  // Auth & Verification
  authentication: {
    provider: String, // 'google', 'email', 'firebase'
    providerId: String,
    emailVerified: Boolean,
  },
  
  // Connected Integrations
  integrations: {
    gmail: {
      connected: Boolean,
      accessToken: String, // Encrypted
      refreshToken: String, // Encrypted
      email: String,
      scopes: [String],
      expiresAt: new Date(),
    },
    googleDrive: {
      connected: Boolean,
      accessToken: String, // Encrypted
      refreshToken: String, // Encrypted
      email: String,
      scopes: [String],
      expiresAt: new Date(),
    },
  },
  
  // Preferences
  preferences: {
    language: String,
    timezone: String,
    autoProcessing: Boolean,
    notificationSettings: {
      emailNotifications: Boolean,
      processingAlerts: Boolean,
    },
  },
  
  // Usage & Quota
  usage: {
    totalDocuments: Number,
    totalStorage: Number, // in bytes
    monthlyUploadQuota: Number,
    monthlyUploadUsed: Number,
    processingQuota: Number,
    processingUsed: Number,
  },
  
  // Subscription/Plan
  subscription: {
    plan: String, // 'free', 'pro', 'enterprise'
    active: Boolean,
    startDate: new Date(),
    endDate: new Date(),
    autoRenew: Boolean,
  },
  
  timestamps: {
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: new Date(),
  },
};

module.exports = UserSchema;
