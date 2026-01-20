import { Request, Response, NextFunction } from 'express';

/**
 * Request Logger Middleware
 * Logs incoming requests with timing information
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  const requestId = generateRequestId();

  // Attach request ID to request object
  (req as any).requestId = requestId;

  // Log request start
  console.log(`[${requestId}] ${req.method} ${req.path} - Started`);

  // Log request completion
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusEmoji = getStatusEmoji(statusCode);

    console.log(
      `[${requestId}] ${req.method} ${req.path} - ${statusEmoji} ${statusCode} (${duration}ms)`
    );
  });

  next();
};

/**
 * Generate a unique request ID
 */
const generateRequestId = (): string => {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Get emoji based on status code
 */
const getStatusEmoji = (statusCode: number): string => {
  if (statusCode >= 500) return '❌';
  if (statusCode >= 400) return '⚠️';
  if (statusCode >= 300) return '↪️';
  if (statusCode >= 200) return '✅';
  return '📝';
};

/**
 * Audit Logger for HIPAA Compliance
 * Logs sensitive data access for compliance
 */
export const auditLogger = async (
  userId: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details?: Record<string, unknown>
): Promise<void> => {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    userId,
    action,
    resourceType,
    resourceId,
    details,
  };

  // In production, this would write to the audit_logs table
  console.log('[AUDIT]', JSON.stringify(auditEntry));

  // TODO: Insert into audit_logs table
  // await pool.query(
  //   `INSERT INTO audit_logs (user_id, action_type, resource_type, resource_id, new_values)
  //    VALUES ($1, $2, $3, $4, $5)`,
  //   [userId, action, resourceType, resourceId, JSON.stringify(details)]
  // );
};

export default { requestLogger, auditLogger };
