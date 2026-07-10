import * as Sentry from '@sentry/react';

const DSN = "";
const ENVIRONMENT = "dashboard-6a4e56a2be0419e0839712d2";
const RELEASE = "0.0.212";
const APPGROUP_ID = "6a4e56a2be0419e0839712d2";

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT || undefined,
    release: RELEASE || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  if (APPGROUP_ID) {
    Sentry.setTag('appgroup_id', APPGROUP_ID);
  }
}

export { Sentry };
