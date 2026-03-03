import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { EngineService } from '../services/engineService';

export const engineRouter = Router();

engineRouter.get('/shifts/:shiftId/eligibility/:userId', requireAuth, async (req, res) => {
  try {
    const { shiftId, userId } = req.params;

    // RBAC: Only admin, or manager/staff looking at themselves? 
    // LLD (Chunk 6 prompt context): allow checking anyone, UI usually handles filtering
    // To be safe, any authenticated user can check eligibility (e.g. for swapping)
    
    const result = await EngineService.evaluateConstraints(userId as string, shiftId as string);
    res.json({ data: result });
  } catch (error) {
    console.error('GET /eligibility error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Engine evaluation failed' } });
  }
});
