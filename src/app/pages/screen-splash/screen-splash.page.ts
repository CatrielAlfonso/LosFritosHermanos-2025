import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonLabel } from "@ionic/angular/standalone";

@Component({
  selector: 'app-screen-splash',
  templateUrl: './screen-splash.page.html',
  styleUrls: ['./screen-splash.page.scss'],
  imports: [IonLabel, IonContent]
})
export class ScreenSplashPage implements OnInit {

   constructor(private _router:Router) 
  { 
    setTimeout(()=>{
      this._router.navigateByUrl('/home',{replaceUrl: true});
    }, 4000);
  }

  ngOnInit() { }

}
