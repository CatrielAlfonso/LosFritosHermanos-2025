import { Injectable, inject } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { Router } from '@angular/router';
import { Capacitor,CapacitorHttp,HttpResponse } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import OneSignal from 'onesignal-cordova-plugin';
import { environment } from 'src/environments/environment';
import { INotification } from '../models/notification.model';
import { h } from 'ionicons/dist/types/stencil-public-runtime';
import * as moment from 'moment-timezone';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  
  private router = inject(Router);

  init()
  {
    const isPushNotificationAvilable = Capacitor.isPluginAvailable('PushNotifications');

    if(isPushNotificationAvilable)
    {
        PushNotifications.requestPermissions().then((result) => {
        if (result.receive) {
          // Register with Apple / Google to receive push via APNS/FCM
          // PushNotifications.register();
          OneSignal.initialize(environment.oneSignalId);

          OneSignal.Notifications.addEventListener('click', async(e : any)=>{
            const notification:any = e.notification;
            const destino = notification.additionalData['url'];

            if(destino)
            {
              if (destino.startsWith('/'))
              {
                this.router.navigateByUrl(destino);
              }
              else
              {
                if(notification.additionalData['url'])
                {
                  await Browser.open({url: destino});
                  //window.open(notification.additionalData['url'],'_system');
                }
              }
            }


            
          })
        }
      });
    }
  }

  async sendNotification(notificacion:INotification)
  {
    const userTimeZone = moment.tz.guess();

    return CapacitorHttp.post({
      url: 'https://onesignal.com/api/v1/notifications',
      params: {},
      data:{
        app_id: environment.oneSignalId,
        included_segments: ['Total Subscriptions'],
        headings: { "en": notificacion.title },
        contents: { "en": notificacion.body },
        data:{url:notificacion.url},
        send_after: moment(notificacion.date).tz
        (userTimeZone).format('YYYY-MM-DD HH:mm:ss [GMT]Z')
      },
      headers:
      {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization' : `Basic ${environment.oneSignalRestApi}`,
      }
    }).then((response: HttpResponse) => {
      console.log(response);
      return response.status ===200;
    })
    
  }

  



}
