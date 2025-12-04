import { Router, Request, Response } from 'express';

const router = Router();
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://cms.businessfalkenberg.se';

// Directus response types
interface DirectusAuthData {
  access_token: string;
  refresh_token: string;
}

interface DirectusAuthResponse {
  data: DirectusAuthData;
}

interface DirectusUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface DirectusUserResponse {
  data: DirectusUser;
}

interface DirectusErrorResponse {
  errors?: Array<{ message: string }>;
}

// Login - proxy to Directus
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const directusResponse = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, mode: 'json' })
    });

    if (!directusResponse.ok) {
      const errorData = await directusResponse.json().catch(() => ({})) as DirectusErrorResponse;
      return res.status(directusResponse.status).json({
        error: errorData.errors?.[0]?.message || 'Login failed'
      });
    }

    const authData = await directusResponse.json() as DirectusAuthResponse;
    const { access_token, refresh_token } = authData.data;

    if (!access_token || !refresh_token) {
      return res.status(500).json({ error: 'Invalid response from authentication server' });
    }

    // Set httpOnly cookies
    res.cookie('directus_access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 3600 * 1000 // 1 hour
    });

    res.cookie('directus_refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // Fetch user info after login
    const userResponse = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const userData = userResponse.ok ? await userResponse.json() as DirectusUserResponse : null;

    return res.json({ success: true, user: userData?.data });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred during login' });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.directus_refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const directusResponse = await fetch(`${DIRECTUS_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' })
    });

    if (!directusResponse.ok) {
      res.clearCookie('directus_access_token');
      res.clearCookie('directus_refresh_token');
      return res.status(401).json({ error: 'Token refresh failed' });
    }

    const authData = await directusResponse.json() as DirectusAuthResponse;
    const { access_token, refresh_token: newRefreshToken } = authData.data;

    res.cookie('directus_access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 3600 * 1000
    });

    res.cookie('directus_refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Check auth status
router.get('/check', async (req: Request, res: Response) => {
  const accessToken = req.cookies?.directus_access_token;
  const refreshToken = req.cookies?.directus_refresh_token;

  if (!accessToken && !refreshToken) {
    return res.json({ authenticated: false });
  }

  if (accessToken) {
    try {
      const response = await fetch(`${DIRECTUS_URL}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (response.ok) {
        const data = await response.json() as DirectusUserResponse;
        return res.json({ authenticated: true, user: data.data });
      }
    } catch (error) {
      // Token might be expired, try refresh
    }
  }

  return res.json({ authenticated: false, canRefresh: !!refreshToken });
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('directus_access_token');
  res.clearCookie('directus_refresh_token');
  return res.json({ success: true });
});

export default router;
