// @ts-ignore - dist/server.cjs is a build artifact
import serverModule from '../dist/server.cjs';

const app = (serverModule as any).default || serverModule;

export default app;
