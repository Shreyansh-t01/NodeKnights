const { google } = require('googleapis');

/**
 * Gmail Integration Service
 * Handles email extraction and processing from Gmail
 */

class GmailService {
  constructor(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.gmail = google.gmail({ version: 'v1', auth: this.createAuth() });
  }

  createAuth() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );
  }

  /**
   * Fetch emails from Gmail
   */
  async fetchEmails(query = '', maxResults = 10) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      });

      const messages = response.data.messages || [];
      const emails = [];

      for (const message of messages) {
        const fullMessage = await this.gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });

        emails.push(this.parseMessage(fullMessage.data));
      }

      return emails;
    } catch (error) {
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }
  }

  /**
   * Parse Gmail message to extract data
   */
  parseMessage(message) {
    const headers = message.payload.headers;
    const getHeader = (name) => headers.find(h => h.name === name)?.value || null;

    const body = this.getMessageBody(message.payload);

    return {
      messageId: message.id,
      threadId: message.threadId,
      email: {
        subject: getHeader('Subject'),
        from: getHeader('From'),
        to: getHeader('To')?.split(',').map(e => e.trim()) || [],
        cc: getHeader('Cc')?.split(',').map(e => e.trim()) || [],
        bcc: getHeader('Bcc')?.split(',').map(e => e.trim()) || [],
        messageId: getHeader('Message-ID'),
        threadId: message.threadId,
        labels: message.labelIds || [],
        isRead: !message.labelIds?.includes('UNREAD'),
      },
      content: body,
      source: {
        type: 'gmail',
        sourceId: message.id,
        accountEmail: getHeader('From'),
      },
      contentType: 'email',
      metadata: {
        author: getHeader('From'),
        createdDate: getHeader('Date'),
      },
      timestamps: {
        createdAt: new Date(parseInt(message.internalDate)),
      },
    };
  }

  /**
   * Extract message body from payload
   */
  getMessageBody(payload) {
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
          if (part.data) {
            return Buffer.from(part.data, 'base64').toString('utf-8');
          }
        }
      }
    } else if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    return '';
  }

  /**
   * Watch for new emails (using webhooks)
   */
  async watchEmails() {
    try {
      return await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/topics/gmail-notifications`,
        },
      });
    } catch (error) {
      throw new Error(`Failed to set up email watch: ${error.message}`);
    }
  }
}

module.exports = GmailService;
