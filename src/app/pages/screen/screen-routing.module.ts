import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ScreenPage } from './screen.page';

const routes: Routes = [
  {
    path: '',
    component: ScreenPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ScreenPageRoutingModule {}
