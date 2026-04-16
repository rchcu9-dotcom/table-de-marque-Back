import * as admin from 'firebase-admin';

export const FIREBASE_ADMIN = 'FIREBASE_ADMIN';

export const firebaseAdminProvider = {
  provide: FIREBASE_ADMIN,
  useFactory: (): admin.app.App => {
    if (admin.apps.length > 0) {
      return admin.apps[0]!;
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(
        serviceAccountJson,
      ) as admin.ServiceAccount;
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  },
};
