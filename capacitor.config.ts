import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.violetbites.canteen',
  appName: 'Violet Bites',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
