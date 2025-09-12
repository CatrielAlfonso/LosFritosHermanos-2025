import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'losFritosHermanos',
  webDir: 'www',
   "plugins": 
  {
    "SplashScreen": {
      "launchAutoHide": false // Asegúrate de que esté en false
    }          
  }
};

export default config;
