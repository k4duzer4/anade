import { rateLimit } from 'express-rate-limit';
export function sensitiveRequestLimits({ maxConcurrentUploads = 2 } = {}) {
  const writes = rateLimit({
    windowMs: 60000,
    limit: 60,
    keyGenerator: (_req, res) => res.locals.user.id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
    message: { error: 'Muitas alterações em pouco tempo. Aguarde um minuto.' },
  });
  const uploads = rateLimit({
    windowMs: 60000,
    limit: 10,
    keyGenerator: (_req, res) => res.locals.user.id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Muitos envios de arquivos. Aguarde um minuto.' },
  });
  let active = 0;
  return [
    writes,
    (req, res, next) => {
      if (!req.is('multipart/form-data') || !['POST', 'PUT'].includes(req.method)) return next();
      uploads(req, res, () => {
        if (active >= maxConcurrentUploads)
          return res
            .status(503)
            .set('Retry-After', '5')
            .json({
              error: 'Os envios estão ocupados. Aguarde alguns segundos e tente novamente.',
            });
        active++;
        let released = false;
        const release = () => {
          if (!released) {
            released = true;
            active--;
          }
        };
        res.once('finish', release);
        res.once('close', release);
        next();
      });
    },
  ];
}
