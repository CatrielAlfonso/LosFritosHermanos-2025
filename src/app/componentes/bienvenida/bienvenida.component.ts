import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router,RouterLink } from '@angular/router';
import { IonContent,IonButton, IonIcon} from "@ionic/angular/standalone";

@Component({
  selector: 'app-bienvenida',
  templateUrl: './bienvenida.component.html',
  styleUrls: ['./bienvenida.component.scss'],
  imports: [IonContent, IonButton,IonIcon, CommonModule, RouterLink]
})
export class BienvenidaComponent  implements OnInit {

  constructor(private router:Router) { }

  ngOnInit() {}

  irAnonimo()
  {
    this.router.navigate(['/anonimo']);
  }

}
