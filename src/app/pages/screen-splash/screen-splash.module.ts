import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ScreenSplashPageRoutingModule } from './screen-splash-routing.module';

import { ScreenSplashPage } from './screen-splash.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ScreenSplashPageRoutingModule
  ]
})
export class ScreenSplashPageModule {}
