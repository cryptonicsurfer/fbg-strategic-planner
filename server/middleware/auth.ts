import { Request, Response, NextFunction } from 'express';

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://cms.businessfalkenberg.se';

interface DirectusUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface DirectusUserResponse {
  data: DirectusUser;
}

export interface AuthenticatedRequest extends Request {
  user?: DirectusUser;
}

export async function verifyDirectusToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.directus_access_token;

  console.log('[Auth] Checking token for:', req.path);
  console.log('[Auth] Token present:', !!token);
  console.log('[Auth] Cookies:', Object.keys(req.cookies || {}));

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const response = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('[Auth] Directus response status:', response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.log('[Auth] Directus error:', errorBody);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const data = await response.json() as DirectusUserResponse;
    req.user = data.data;
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
      const response = await fetch(`${DIRECTUS_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json() as DirectusUserResponse;
        req.user = data.data;
      }
    } catch (error) {
      // Ignore auth errors for optional auth
    }
  }

  next();
}
