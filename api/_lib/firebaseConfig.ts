/**
 * Firebase REST API configuration for self-contained serverless functions in /api/
 * Strictly isolated: No imports jumping outside /api/
 */
export const FIREBASE_REST_CONFIG = {
  projectId:
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'simpel-media-ajar',
  apiKey:
    process.env.VITE_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    'AIzaSyCL1dR_YKV8iOt-_EEjdAiCejE4NuyI8h0',
  databaseId: '(default)',
};
