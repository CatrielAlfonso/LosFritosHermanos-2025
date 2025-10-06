import { Component, NgModule, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BebidaService } from '../../servicios/bebida.service';
import { IonContent, IonText,IonLabel, IonInput, IonItem, IonTextarea,IonButton,IonIcon } from "@ionic/angular/standalone";
import { FeedbackService } from 'src/app/servicios/feedback-service.service';
import { VistaPreviaFotosPipe } from 'src/app/pipes/vista-previa-fotos-pipe';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ViewChildren, QueryList, ElementRef } from '@angular/core';

@Component({
  selector: 'app-bebidas',
  templateUrl: './bebidas.component.html',
  styleUrls: ['./bebidas.component.scss'],
  imports: [IonItem, IonContent, IonLabel, ReactiveFormsModule,IonInput, IonItem,  IonTextarea, IonButton, IonIcon, IonText,
    VistaPreviaFotosPipe, CommonModule, RouterLink
  ]
})
export class BebidasComponent {

 @ViewChildren('fileInput0, fileInput1, fileInput2')
  fileInputs!: QueryList<ElementRef<HTMLInputElement>>;

  abrirFileInput(index: number) {
    const inputs = this.fileInputs.toArray(); // convertir QueryList a array
    inputs[index]?.nativeElement.click();
  } 

 form = this.fb.group({
    nombre: ['', Validators.required],
    descripcion: ['', [Validators.required, Validators.minLength(5)]],
    tiempo_elaboracion: [null, [Validators.required, Validators.min(1)]],
    precio: [null, [Validators.required, Validators.min(0)]],
    tipo: 'bebida',
    foto1: [null as File | null],
    foto2: [null as File | null],
    foto3: [null as File | null]
  });

  selectedFiles: (File | null)[] = [null, null, null];
  mensaje = '';
  router = inject(Router);


  constructor(private fb: FormBuilder, private bebidaService: BebidaService, private feedback: FeedbackService ) {}



  onFileSelected(event: any, index: number) {
    // const files = event.target.files as FileList;

    // if (files && files.length >= 3) {
    //   this.selectedFiles = Array.from(files).slice(0, 3); // tomar sólo 3
    // } else {
    //   this.selectedFiles = [];
    //   this.feedback.showToast('error', 'Tenés que elegir 3 fotos, ni una más ni una menos 😅');
    // }
     const file = event.target.files[0];
      if (file) {
        this.selectedFiles[index] = file;
          if (index === 0) this.form.patchValue({ foto1: file });
          if (index === 1) this.form.patchValue({ foto2: file });
          if (index === 2) this.form.patchValue({ foto3: file });
      }
  }

  async onSubmit() 
  {
    if (this.form.invalid || this.selectedFiles.some(f => !f)) {
      this.feedback.showToast('error', '❌ Debes completar todos los campos del producto y subir las 3 fotos.');
      return;
    }

    const loading = await this.feedback.showLoading("Guardando bebida...");

    try {
      const urls: string[] = [];
      for (let i = 0; i < 3; i++) {
        const url = await this.bebidaService.uploadFoto(this.selectedFiles[i] as File, `foto${i+1}`);
        urls.push(url);
      }

      await this.bebidaService.agregarBebida({
        nombre: this.form.value.nombre!,
        descripcion: this.form.value.descripcion!,
        tiempo_elaboracion: this.form.value.tiempo_elaboracion!,
        precio: this.form.value.precio!,
        imagenes: urls,
        tipo: this.form.value.tipo!
      });

      await loading.dismiss();
      this.feedback.showToast('exito', '✅ Producto registrado con éxito.'); 
      this.form.reset();
      this.selectedFiles = [null, null, null]; // reset con 3 posiciones

    } catch (err: any) {
      await loading.dismiss();
      this.feedback.showToast('error', `Error al guardar: ${err.message}`);
    }
  }

  async volverPaginaPrincipal()
  {
    // Lógica para volver a la página principal
    this.feedback.showLoading();
      //volver al home
      this.feedback.hide();
      this.router.navigate(['/login']);
      
    
  }

}
