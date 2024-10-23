// config/server.ts
import path from 'path';
import { createApp } from '../../../src/core/infrastructure/app/createApp';
import { container } from './container';

const controllersPath = path.resolve(__dirname, '..', 'infrastructure/http/controllers');
const pattern = path.join(controllersPath, '*Controller.{ts,js}');

const app = createApp({
  container,
  modulesPath: pattern
});

export default app;