import { Request, Response, NextFunction } from 'express';

export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role permissions' } });
    }

    next();
  };
};

export const requireLocationAccess = (paramName: string = 'locationId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    // Try finding the location ID in params or query
    const targetLocationId = req.params[paramName] || req.query[paramName];

    if (!targetLocationId || typeof targetLocationId !== 'string') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: `Missing ${paramName} parameter` } });
    }

    const { role, locationIds } = req.auth;

    if (role === 'admin') {
      return next(); // Admins have global access
    }

    // Both Managers and Staff must be explicitly linked to the location
    if (locationIds.includes(targetLocationId)) {
      return next();
    }

    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No access to this location' } });
  };
};
