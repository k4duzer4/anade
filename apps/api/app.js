import express from 'express';
import { createVercelHandler } from './src/vercel.js';

// A Vercel gerencia o servidor HTTP; o desenvolvimento Node usa src/index.js.
const app = express();
app.disable('x-powered-by');
app.use(createVercelHandler());
export default app;
