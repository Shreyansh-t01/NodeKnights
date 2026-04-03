const { google } = require('googleapis');

/**
 * Google Drive Integration Service
 * Handles file extraction and processing from Google Drive
 */

class GoogleDriveService {
  constructor(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.drive = google.drive({ version: 'v3', auth: this.createAuth() });
  }

  createAuth() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );
  }

  /**
   * List files from Google Drive
   */
  async listFiles(pageSize = 20, pageToken = null) {
    try {
      const response = await this.drive.files.list({
        pageSize,
        pageToken,
        fields: 'nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, owners, webViewLink, size)',
        spaces: 'drive',
      });

      return {
        files: response.data.files || [],
        nextPageToken: response.data.nextPageToken,
      };
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Export and download file from Google Drive
   */
  async downloadFile(fileId, mimeType) {
    try {
      const file = await this.drive.files.get({ fileId, fields: 'mimeType, name' });
      const originalMimeType = file.data.mimeType;

      // Handle Google Docs/Sheets/Slides conversion
      let exportMimeType = mimeType;
      if (originalMimeType.includes('google-apps')) {
        exportMimeType = this.getExportMimeType(originalMimeType, mimeType);
      }

      const response = await this.drive.files.export(
        { fileId, mimeType: exportMimeType },
        { responseType: 'arraybuffer' }
      );

      return {
        data: response.data,
        fileName: file.data.name,
        mimeType: exportMimeType,
      };
    } catch (error) {
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Get export MIME type for Google apps
   */
  getExportMimeType(originalMimeType, preferredMimeType) {
    const mimeTypeMap = {
      'application/vnd.google-apps.document': 'application/pdf',
      'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.google-apps.presentation': 'application/pdf',
    };

    return mimeTypeMap[originalMimeType] || preferredMimeType || 'application/pdf';
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, createdTime, modifiedTime, owners, webViewLink, parents, properties',
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Watch for file changes
   */
  async watchFile(fileId) {
    try {
      return await this.drive.files.watch({
        fileId,
        requestBody: {
          id: `drive-watch-${fileId}`,
          type: 'webhook',
          address: `${process.env.WEBHOOK_URL}/drive/webhook`,
        },
      });
    } catch (error) {
      throw new Error(`Failed to watch file: ${error.message}`);
    }
  }

  /**
   * Search files in Drive
   */
  async searchFiles(query, pageSize = 20) {
    try {
      const response = await this.drive.files.list({
        pageSize,
        q: query,
        fields: 'files(id, name, mimeType, createdTime, webViewLink)',
        spaces: 'drive',
      });

      return response.data.files || [];
    } catch (error) {
      throw new Error(`Failed to search files: ${error.message}`);
    }
  }
}

module.exports = GoogleDriveService;
