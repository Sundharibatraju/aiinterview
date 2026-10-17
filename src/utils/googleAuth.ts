// Centralized Google Identity Services (GIS) OAuth Utility

let cachedClientId: string | null = null;

export async function getGoogleClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;

  // 1. Check Vite client environment
  const envId =
    ((import.meta as any).env?.GOOGLE_CLIENT_ID as string) ||
    ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string) ||
    '';
  if (envId) {
    cachedClientId = envId;
    return envId;
  }

  // 2. Check localStorage override
  const localId = localStorage.getItem('ai_interviewer_google_client_id');
  if (localId) {
    cachedClientId = localId;
    return localId;
  }

  // 3. Fetch from backend API
  try {
    const res = await fetch('/api/auth/google-config');
    const data = await res.json();
    if (data.clientId) {
      cachedClientId = data.clientId;
      return data.clientId;
    }
  } catch {
    // fallback
  }

  return '';
}

export interface GoogleUserProfile {
  email: string;
  name: string;
  picture?: string;
  sub: string;
}

export interface DirectGoogleAuthOptions {
  onStart?: () => void;
  onSuccess: (profile: GoogleUserProfile) => Promise<void> | void;
  onError: (error: string) => void;
  onCancel?: () => void;
}

/**
 * Directly initiates the official Google Account Selector popup via GIS
 * and retrieves user profile details (email, name, photo, googleId) directly from Google.
 */
export async function directGoogleSignIn({
  onStart,
  onSuccess,
  onError,
  onCancel,
}: DirectGoogleAuthOptions): Promise<void> {
  try {
    const clientId = await getGoogleClientId();
    if (!clientId) {
      onError('Google OAuth Client ID is not configured on this server.');
      return;
    }

    const googleObj = (window as any).google;
    if (!googleObj || !googleObj.accounts || !googleObj.accounts.oauth2) {
      onError('Google Identity Services SDK is loading. Please try again in a few seconds.');
      return;
    }

    onStart?.();

    const tokenClient = googleObj.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      prompt: 'select_account',
      callback: async (tokenResponse: any) => {
        if (tokenResponse.error) {
          if (tokenResponse.error === 'popup_closed_by_user') {
            onCancel?.();
            return;
          }
          onError(`Google Sign-In: ${tokenResponse.error_description || tokenResponse.error}`);
          return;
        }

        if (tokenResponse.access_token) {
          try {
            // Retrieve verified user profile directly from Google's userinfo API
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });

            if (!userInfoRes.ok) {
              throw new Error('Could not retrieve user details from Google account');
            }

            const googleUser: GoogleUserProfile = await userInfoRes.json();
            if (!googleUser.email) {
              throw new Error('No email address provided by Google account');
            }

            await onSuccess(googleUser);
          } catch (err: any) {
            onError(err.message || 'Failed to fetch details from Google');
          }
        }
      },
    });

    tokenClient.requestAccessToken();
  } catch (err: any) {
    onError(err.message || 'Failed to initiate Google authentication');
  }
}
