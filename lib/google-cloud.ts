import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

/**
 * Securely initializes a Google Auth client using Application Default Credentials.
 * This avoids the deprecated 'keyFilename' and 'credentials' options which 
 * carry security risks when loading untrusted configurations.
 */
export const getGoogleAuth = () => {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Missing Google Service Account credentials in environment variables.');
  }

  return new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ],
  });
};

export const getDatastoreClient = () => {
  const auth = getGoogleAuth();
  // Bind the authenticated client to the API
  return google.datastore({ version: 'v1', auth });
};

export const getSheetsClient = () => {
  const auth = getGoogleAuth();
  // Bind the authenticated client to the Sheets API
  return google.sheets({ version: 'v4', auth });
};

export const getDriveClient = () => {
  const auth = getGoogleAuth();
  // Bind the authenticated client to the Drive API
  return google.drive({ version: 'v3', auth });
};