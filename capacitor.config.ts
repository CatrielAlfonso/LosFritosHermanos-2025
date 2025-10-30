import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'losFritosHermanos',
  webDir: 'www',
   "plugins": 
  {
    CapacitorHttp: {
      enabled:true
    },
    "SplashScreen": {
      "launchAutoHide": false, // Asegúrate de que esté en false
       backgroundColor: '#1942d7',
    },
    "PushNotifications": {
      "presentationOptions": ["badge", "sound", "alert"]
    }          
  }
};

export default config;
