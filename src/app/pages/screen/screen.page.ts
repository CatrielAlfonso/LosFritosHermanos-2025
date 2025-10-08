import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from "@ionic/angular/standalone";
import { AudioService } from '../../servicios/audio.service';

@Component({
  selector: 'app-screen',
  templateUrl: './screen.page.html',
  styleUrls: ['./screen.page.scss'],
  imports: [IonContent]
})
export class ScreenPage implements OnInit {

    constructor(private router: Router, private audio:AudioService) {}

  async ngOnInit() {
    await this.audio.preload();
    this.audio.playInicio();
    setTimeout(() => {
      this.router.navigateByUrl('/bienvenida');
    }, 3800);
  }

}
