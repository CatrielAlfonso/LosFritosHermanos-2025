import { Component, Input, OnInit } from '@angular/core';
import { IonHeader } from "@ionic/angular/standalone";

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: false,
})
export class HeaderComponent  implements OnInit {

  @Input() title!:string;
  @Input() backButton!:string;
  
  constructor() { }

  ngOnInit() {}

}
