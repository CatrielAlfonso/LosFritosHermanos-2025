import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'losFritosHermanos',
  webDir: 'www',
  backgroundColor: '#1942d7',
  server: {
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#1942d7'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    SplashScreen: {
      backgroundColor: '#1942d7',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
      launchShowDuration: 2000,
      launchAutoHide: false
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
