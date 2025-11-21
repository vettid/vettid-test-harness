/**
 * Email Retriever Utility
 * Retrieves and parses emails from S3 bucket stored by SES
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

export interface EmailMetadata {
  key: string;
  size: number;
  lastModified: Date;
}

export interface ParsedEmail {
  from: string[];
  to: string[];
  subject: string;
  date: string;
  messageId: string;
  body: {
    text?: string;
    html?: string;
  };
  headers: Record<string, string>;
  raw: string;
}

export class EmailRetriever {
  private s3Client: S3Client;
  private bucketName: string;
  private prefix: string;

  constructor(bucketName: string, region: string = 'us-east-1', prefix: string = 'emails/') {
    this.s3Client = new S3Client({ region });
    this.bucketName = bucketName;
    this.prefix = prefix;
  }

  /**
   * List all emails in the bucket
   */
  async listEmails(maxResults: number = 100): Promise<EmailMetadata[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: this.prefix,
      MaxKeys: maxResults,
    });

    const response = await this.s3Client.send(command);

    if (!response.Contents) {
      return [];
    }

    return response.Contents
      .filter(obj => obj.Key && obj.Size && obj.LastModified)
      .map(obj => ({
        key: obj.Key!,
        size: obj.Size!,
        lastModified: obj.LastModified!,
      }))
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()); // Most recent first
  }

  /**
   * Get raw email content from S3
   */
  async getEmailRaw(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error(`No body found for email: ${key}`);
    }

    return await response.Body.transformToString();
  }

  /**
   * Parse raw email content
   */
  parseEmail(rawEmail: string): ParsedEmail {
    const lines = rawEmail.split('\n');
    const headers: Record<string, string> = {};
    let currentHeader = '';
    let headerSection = true;
    let bodyLines: string[] = [];

    for (const line of lines) {
      if (headerSection) {
        if (line.trim() === '') {
          headerSection = false;
          continue;
        }

        // Continuation of previous header
        if (line.startsWith(' ') || line.startsWith('\t')) {
          if (currentHeader) {
            headers[currentHeader] += ' ' + line.trim();
          }
          continue;
        }

        // New header
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const headerName = line.substring(0, colonIndex).trim().toLowerCase();
          const headerValue = line.substring(colonIndex + 1).trim();
          headers[headerName] = headerValue;
          currentHeader = headerName;
        }
      } else {
        bodyLines.push(line);
      }
    }

    // Parse common headers
    const from = this.parseEmailAddresses(headers['from'] || '');
    const to = this.parseEmailAddresses(headers['to'] || '');
    const subject = headers['subject'] || '';
    const date = headers['date'] || '';
    const messageId = headers['message-id'] || '';

    // Simple body extraction (doesn't handle multipart perfectly)
    const bodyText = bodyLines.join('\n');
    const body: { text?: string; html?: string } = {};

    // Check content type
    const contentType = headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      body.html = bodyText;
    } else {
      body.text = bodyText;
    }

    // If multipart, try to extract both
    if (contentType.includes('multipart')) {
      const { text, html } = this.extractMultipartBodies(bodyText, contentType);
      if (text) body.text = text;
      if (html) body.html = html;
    }

    return {
      from,
      to,
      subject,
      date,
      messageId,
      body,
      headers,
      raw: rawEmail,
    };
  }

  /**
   * Get and parse an email
   */
  async getEmail(key: string): Promise<ParsedEmail> {
    const raw = await this.getEmailRaw(key);
    return this.parseEmail(raw);
  }

  /**
   * Get the most recent email
   */
  async getMostRecentEmail(): Promise<ParsedEmail | null> {
    const emails = await this.listEmails(1);
    if (emails.length === 0) {
      return null;
    }
    return this.getEmail(emails[0].key);
  }

  /**
   * Find emails by recipient
   */
  async findEmailsByRecipient(recipient: string, maxResults: number = 10): Promise<ParsedEmail[]> {
    const allEmails = await this.listEmails(100);
    const matchingEmails: ParsedEmail[] = [];

    for (const emailMeta of allEmails) {
      if (matchingEmails.length >= maxResults) break;

      const email = await this.getEmail(emailMeta.key);
      if (email.to.some(addr => addr.toLowerCase().includes(recipient.toLowerCase()))) {
        matchingEmails.push(email);
      }
    }

    return matchingEmails;
  }

  /**
   * Find emails by subject
   */
  async findEmailsBySubject(subjectPattern: string, maxResults: number = 10): Promise<ParsedEmail[]> {
    const allEmails = await this.listEmails(100);
    const matchingEmails: ParsedEmail[] = [];

    for (const emailMeta of allEmails) {
      if (matchingEmails.length >= maxResults) break;

      const email = await this.getEmail(emailMeta.key);
      if (email.subject.toLowerCase().includes(subjectPattern.toLowerCase())) {
        matchingEmails.push(email);
      }
    }

    return matchingEmails;
  }

  /**
   * Extract magic link from VettID email
   */
  extractMagicLink(email: ParsedEmail): string | null {
    const content = email.body.html || email.body.text || '';

    // Look for VettID auth URLs with fragments
    const regex = /https:\/\/[^\/]+\/auth#token=([^&\s]+)&email=([^&\s<]+)/;
    const match = content.match(regex);

    if (match) {
      return match[0];
    }

    // Fallback: any URL containing /auth#token=
    const fallbackRegex = /(https?:\/\/[^\s<]+\/auth#token=[^\s<]+)/;
    const fallbackMatch = content.match(fallbackRegex);

    return fallbackMatch ? fallbackMatch[1] : null;
  }

  /**
   * Wait for an email to arrive (polling)
   */
  async waitForEmail(
    recipientOrFilter: string | ((email: ParsedEmail) => boolean),
    timeoutMs: number = 30000,
    pollIntervalMs: number = 1000
  ): Promise<ParsedEmail | null> {
    const startTime = Date.now();
    const filterFn = typeof recipientOrFilter === 'string'
      ? (email: ParsedEmail) => email.to.some(addr => addr.includes(recipientOrFilter))
      : recipientOrFilter;

    while (Date.now() - startTime < timeoutMs) {
      const emails = await this.listEmails(10);

      for (const emailMeta of emails) {
        // Only check recent emails (within last minute)
        if (Date.now() - emailMeta.lastModified.getTime() > 60000) {
          continue;
        }

        const email = await this.getEmail(emailMeta.key);
        if (filterFn(email)) {
          return email;
        }
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    return null;
  }

  /**
   * Delete an email from S3
   */
  async deleteEmail(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    await this.s3Client.send(command);
  }

  /**
   * Clear all emails from the bucket
   */
  async clearAllEmails(): Promise<number> {
    const emails = await this.listEmails(1000);
    let count = 0;

    for (const email of emails) {
      await this.deleteEmail(email.key);
      count++;
    }

    return count;
  }

  // Helper methods

  private parseEmailAddresses(addressString: string): string[] {
    // Simple email extraction - handles "Name <email@domain.com>" format
    const emailRegex = /<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/g;
    const matches = addressString.matchAll(emailRegex);
    return Array.from(matches).map(m => m[1]);
  }

  private extractMultipartBodies(body: string, contentType: string): { text?: string; html?: string } {
    const result: { text?: string; html?: string } = {};

    // Extract boundary
    const boundaryMatch = contentType.match(/boundary="?([^";,]+)"?/);
    if (!boundaryMatch) {
      return result;
    }

    const boundary = boundaryMatch[1];
    const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

    for (const part of parts) {
      if (part.includes('Content-Type: text/plain')) {
        const textMatch = part.split(/\r?\n\r?\n/);
        if (textMatch.length > 1) {
          result.text = textMatch.slice(1).join('\n\n').trim();
        }
      }
      if (part.includes('Content-Type: text/html')) {
        const htmlMatch = part.split(/\r?\n\r?\n/);
        if (htmlMatch.length > 1) {
          result.html = htmlMatch.slice(1).join('\n\n').trim();
        }
      }
    }

    return result;
  }
}

/**
 * Convenience function to create an email retriever
 */
export function createEmailRetriever(bucketName?: string): EmailRetriever {
  const bucket = bucketName || process.env.EMAIL_BUCKET_NAME;
  if (!bucket) {
    throw new Error('Email bucket name not provided. Set EMAIL_BUCKET_NAME or pass bucketName parameter');
  }
  return new EmailRetriever(bucket);
}
