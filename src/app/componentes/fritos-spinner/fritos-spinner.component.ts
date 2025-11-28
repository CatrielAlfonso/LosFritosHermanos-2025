import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fritos-spinner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fritos-spinner.component.html',
  styleUrls: ['./fritos-spinner.component.scss']
})
export class FritosSpinnerComponent {
  @Input() mensaje: string = 'Cargando...';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() showText: boolean = true;
  @Input() inline: boolean = false;
  
  readonly LOGO_URL = 'https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/crispy2.png';
}
