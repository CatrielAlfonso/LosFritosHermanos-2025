import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ScreenSplashPage } from './screen-splash.page';

const routes: Routes = [
  {
    path: '',
    component: ScreenSplashPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ScreenSplashPageRoutingModule {}
