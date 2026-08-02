// @ts-ignore - dist/server.cjs is a build artifact
import serverModule from '../dist/server.cjs';

const app = (serverModule as any).default || serverModule;

// Disable Vercel's auto body parser — Express needs the raw body for Paytm checksum verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
