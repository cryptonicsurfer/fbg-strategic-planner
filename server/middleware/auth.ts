import { Request, Response, NextFunction } from 'express';

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://cms.businessfalkenberg.se';

interface DirectusUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role?: { name?: string } | null;
}

// Rollspärr (2026-10-22): ett giltigt Directus-konto räcker inte — Directus har även externa konton
// (Foodtrucker m.fl.) som annars kunde läsa och skriva i årsplanen. Kommaseparerad lista, skiftlägesokänslig.
const ALLOWED_ROLES = (process.env.ALLOWED_DIRECTUS_ROLES || 'CRM användare,Administrator')
  .split(',')
  .map((r) => r.trim().toLowerCase())
  .filter(Boolean);

// Fälten vi hämtar från /users/me — role.name behövs för spärren.
export const USER_FIELDS = 'id,email,first_name,last_name,role.name';

export function hasAllowedRole(user: { role?: { name?: string } | null } | null | undefined): boolean {
  const name = user?.role?.name?.trim().toLowerCase();
  return !!name && ALLOWED_ROLES.includes(name);
}

interface DirectusUserResponse {
  data: DirectusUser;
}

interface DirectusRefreshResponse {
  data: {
    access_token: string;
    refresh_token: string;
    expires: number;
  };
}

export interface AuthenticatedRequest extends Request {
  user?: DirectusUser;
}

// Helper to refresh the access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<DirectusRefreshResponse['data'] | null> {
  try {
    const response = await fetch(`${DIRECTUS_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
    });

    if (!response.ok) {
      console.log('[Auth] Refresh failed:', response.status);
      return null;
    }

    const data = await response.json() as DirectusRefreshResponse;
    return data.data;
  } catch (error) {
    console.error('[Auth] Refresh error:', error);
    return null;
  }
}

// Helper to verify token and get user
async function verifyAndGetUser(token: string): Promise<DirectusUser | null> {
  try {
    const response = await fetch(`${DIRECTUS_URL}/users/me?fields=${USER_FIELDS}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as DirectusUserResponse;
    return data.data;
  } catch {
    return null;
  }
}

export async function verifyDirectusToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  let token = req.cookies?.directus_access_token;
  const refreshToken = req.cookies?.directus_refresh_token;

  console.log('[Auth] Checking token for:', req.path);
  console.log('[Auth] Token present:', !!token);
  console.log('[Auth] Refresh token present:', !!refreshToken);

  if (!token && !refreshToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Try with current access token
    let user = token ? await verifyAndGetUser(token) : null;

    // If access token failed but we have refresh token, try to refresh
    if (!user && refreshToken) {
      console.log('[Auth] Access token invalid, attempting refresh...');
      const newTokens = await refreshAccessToken(refreshToken);

      if (newTokens) {
        console.log('[Auth] Token refreshed successfully');
        token = newTokens.access_token;
        user = await verifyAndGetUser(token);

        if (user) {
          // Set new cookies
          const isProduction = process.env.NODE_ENV === 'production';
          const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' as const : 'lax' as const,
            path: '/',
          };

          res.cookie('directus_access_token', newTokens.access_token, {
            ...cookieOptions,
            maxAge: newTokens.expires,
          });
          res.cookie('directus_refresh_token', newTokens.refresh_token, {
            ...cookieOptions,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          });
        }
      }
    }

    if (!user) {
      console.log('[Auth] All auth attempts failed');
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!hasAllowedRole(user)) {
      console.log('[Auth] Role not allowed:', user.role?.name ?? '(none)');
      return res.status(403).json({ error: 'Ditt konto har inte behörighet till årsplanen' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(500).json({ error: 'Authentication service error' });
  }
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.directus_access_token;

  if (token) {
    try {
      const response = await fetch(`${DIRECTUS_URL}/users/me?fields=${USER_FIELDS}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json() as DirectusUserResponse;
        if (hasAllowedRole(data.data)) req.user = data.data;
      }
    } catch (error) {
      // Ignore auth errors for optional auth
    }
  }

  next();
}
