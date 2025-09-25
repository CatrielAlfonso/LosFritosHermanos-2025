import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from "@ionic/angular/standalone";

@Component({
  selector: 'app-screen',
  templateUrl: './screen.page.html',
  styleUrls: ['./screen.page.scss'],
  imports: [IonContent]
})
export class ScreenPage implements OnInit {

    constructor(private router: Router) {}

  ngOnInit() {
    setTimeout(() => {
      this.router.navigateByUrl('/bienvenida');
    }, 3800);
  }

}
