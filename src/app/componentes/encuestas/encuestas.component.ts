import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonContent, IonButton, IonIcon, IonHeader, IonToolbar, IonTitle, IonItem, IonLabel, IonInput, IonRange, IonRadioGroup, IonRadio, IonCheckbox, IonSelect, IonSelectOption, IonTextarea, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonGrid, IonRow, IonCol, IonImg, IonAlert, IonBackButton, IonButtons, IonSpinner, AlertController } from '@ionic/angular/standalone';
import { SupabaseService } from '../../servicios/supabase.service';
import { LoadingService } from '../../servicios/loading.service';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface Encuesta {
  id?: number;
  nombre: string;
  apellido: string;
  correo: string;
  satisfaccion_general: number;
  calidad_comida: number;
  calidad_servicio: number;
  ambiente: number;
  recomendacion: string;
  volverias: boolean;
  tipo_visita: string;
  comentario: string;
  imagenes: string[];
}

@Component({
  selector: 'app-encuestas',
  templateUrl: './encuestas.component.html',
  styleUrls: ['./encuestas.component.scss'],
   imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonContent,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonRange,
    IonRadioGroup,
    IonRadio,
    IonCheckbox,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonImg,

  ]
})
export class EncuestasComponent  implements OnInit {

   encuestaForm: FormGroup;
  fotos: string[] = [];
  maxFotos = 3;
  encuestas: Encuesta[] = [];
  mostrarGraficos = false;
  user: any = null;
  clientInfo: any = null;
  mensajeExito = '';
  mostrarMensajeExito = false;
  encuestaEnviada = false;
  mostrarImagenes = false;
  encuestaSeleccionada: Encuesta | null = null;
  imagenAmpliada: string | null = null;
  modo: 'hacer' | 'ver' = 'hacer';
  mostrarFormulario = true;

  constructor(
    private fb: FormBuilder,
    private supabase: SupabaseService,
    private loadingService: LoadingService,
    private router: Router,
    private alertController: AlertController
  ) {
    this.encuestaForm = this.fb.group({
      satisfaccion_general: [5, [Validators.required, Validators.min(1), Validators.max(10)]],
      calidad_comida: [5, [Validators.required, Validators.min(1), Validators.max(10)]],
      calidad_servicio: [5, [Validators.required, Validators.min(1), Validators.max(10)]],
      ambiente: [5, [Validators.required, Validators.min(1), Validators.max(10)]],
      recomendacion: ['', Validators.required],
      volverias: [true, Validators.required],
      tipo_visita: ['', Validators.required],
      comentario: ['', Validators.maxLength(500)]
    });
  }

  ngOnInit() {
    this.cargarUsuario();
    this.leerParametrosQuery();
  }

  leerParametrosQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    const modoParam = urlParams.get('modo');
    
    if (modoParam === 'ver') {
      this.modo = 'ver';
      this.mostrarFormulario = false;
      this.cargarEncuestas().then(() => {
        this.mostrarGraficos = true;
        this.crearGraficos();
      });
    } else if (modoParam === 'hacer') {
      this.modo = 'hacer';
      this.mostrarFormulario = true;
      this.cargarEncuestas();
    } else {
      this.modo = 'hacer';
      this.mostrarFormulario = true;
    }
  }

  async cargarUsuario() {
    try {
      const { data } = await this.supabase.supabase.auth.getUser();
      this.user = data?.user;
      
      if (!this.user) {
        await this.mostrarAlerta('Error', 'No se pudo obtener la información del usuario. Por favor, inicie sesión nuevamente.');
        this.router.navigate(['/login']);
        return;
      }

      const { data: clientData, error: clientError } = await this.supabase.supabase
        .from('clientes')
        .select('*')
        .eq('correo', this.user.email)
        .single();

      if (clientError) {
        await this.mostrarAlerta('Error', 'No se pudo obtener la información del cliente.');
        this.router.navigate(['/login']);
        return;
      }

      if (clientData) {
        this.clientInfo = clientData;
      } else {
        await this.mostrarAlerta('Error', 'No se encontró información del cliente.');
        this.router.navigate(['/login']);
        return;
      }
    } catch (error) {
      await this.mostrarAlerta('Error', 'Error al cargar la información del usuario.');
    }
  }

  async cargarEncuestas() {
    this.loadingService.show();
    try {
      const tablaCorrecta = await this.verificarTablas();
      if (!tablaCorrecta) {
        await this.mostrarAlerta('Error', 'No se encontró la tabla de encuestas. Contacte al administrador.');
        return;
      }
      const { data, error } = await this.supabase.supabase
        .from(tablaCorrecta)
        .select('*');
      if (error) {
        if (error.code === 'PGRST116') {
          await this.mostrarAlerta('Error', 'La tabla de encuestas no existe. Contacte al administrador.');
        } else if (error.code === '42501') {
          await this.mostrarAlerta('Error', 'No tiene permisos para acceder a las encuestas.');
        } else {
          await this.mostrarAlerta('Error', `No se pudieron cargar las encuestas: ${error.message}`);
        }
      } else {
        this.encuestas = data || [];
      }
    } catch (error) {
      await this.mostrarAlerta('Error', `Error inesperado al cargar las encuestas: ${error}`);
    } finally {
      this.loadingService.hide();
    }
  }

  async tomarFoto() {
    if (this.fotos.length >= this.maxFotos) {
      await this.mostrarAlerta('Límite alcanzado', 'Ya has agregado el máximo de 3 fotos permitidas.');
      return;
    }

    try {
      const imagen = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });

      if (imagen.base64String) {
        this.fotos.push(`data:image/jpeg;base64,${imagen.base64String}`);
      }
    } catch (error) {
      await this.mostrarAlerta('Error', 'No se pudo tomar la foto. Verifique los permisos de cámara.');
    }
  }

  eliminarFoto(index: number) {
    this.fotos.splice(index, 1);
  }

  async subirImagenesAStorage(): Promise<string[]> {
    const urls: string[] = [];
    
    for (let i = 0; i < this.fotos.length; i++) {
      try {
        if (!this.fotos[i].startsWith('data:image/')) {
          throw new Error('Formato de imagen inválido');
        }

        const base64String = this.fotos[i].split(',')[1];
        
        if (!base64String) {
          throw new Error('Datos Base64 inválidos');
        }

        const byteCharacters = atob(base64String);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });
        const archivo = new File([blob], `encuesta_${i}.jpg`, { type: 'image/jpeg' });
        
        const url = await this.supabase.subirImagenEncuesta(archivo, this.clientInfo.correo, i);
        urls.push(url);
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Error al subir la imagen ${i + 1}: ${error.message}`);
        } else {
          throw new Error(`Error al subir la imagen ${i + 1}: Error desconocido`);
        }
      }
    }
    
    return urls;
  }

  async enviarEncuesta() {
    if (this.encuestaForm.valid) {
      this.loadingService.show();
      try {
        const tablaCorrecta = await this.verificarTablas();
        if (!tablaCorrecta) {
          await this.mostrarAlerta('Error', 'No se encontró la tabla de encuestas. Contacte al administrador.');
          return;
        }

        const imagenesUrls = await this.subirImagenesAStorage();
        
        const encuestaData = {
          ...this.encuestaForm.value,
          nombre: this.clientInfo.nombre,
          apellido: this.clientInfo.apellido,
          correo: this.clientInfo.correo,
          imagenes: imagenesUrls,
        };

        const { error } = await this.supabase.supabase
          .from(tablaCorrecta)
          .insert([encuestaData]);

        if (error) {
          await this.mostrarAlerta('Error', `No se pudo enviar la encuesta: ${error.message}`);
        } else {
          this.encuestaEnviada = true;
          this.mostrarMensajeExito = true;
          this.mensajeExito = '¡Encuesta enviada exitosamente!';

          const { error: errorCliente } = await this.supabase.supabase
            .from('clientes')
            .update({ encuesta: true })
            .eq('correo', this.clientInfo.correo);
          
          if (errorCliente) {
          }
          
          await this.cargarEncuestas();
          this.mostrarGraficos = true;
          this.crearGraficos();
          
          setTimeout(() => {
            this.mostrarMensajeExito = false;
          }, 3000);
        }
      } catch (error) {
        await this.mostrarAlerta('Error', `Error inesperado al enviar la encuesta: ${error}`);
      } finally {
        this.loadingService.hide();
      }
    }
  }

  async mostrarAlerta(titulo: string, mensaje: string) {
    const alert = await this.alertController.create({
      header: titulo,
      message: mensaje,
      buttons: ['OK']
    });
    await alert.present();
  }

  async mostrarEstadisticas() {
    this.mostrarGraficos = true;
    this.loadingService.show();
    await this.cargarEncuestas();
    setTimeout(() => {
      this.crearGraficos();
      this.loadingService.hide();
    }, 500);
  }

  ocultarEstadisticas() {
    this.mostrarGraficos = false;
    this.encuestas = [];
    this.mostrarImagenes = false;
    this.encuestaSeleccionada = null;
  }

  crearGraficos() {
    if (this.encuestas.length === 0) {
      return;
    }

    setTimeout(() => {
      this.crearGraficoSatisfaccion();
      this.crearGraficoCalidadComida();
      this.crearGraficoCalidadServicio();
      this.crearGraficoAmbiente();
      this.crearGraficoRecomendacion();
      this.crearGraficoVolveria();
    }, 200);
  }

  crearGraficoSatisfaccion() {
    const ctx = document.getElementById('satisfaccionChart') as HTMLCanvasElement;
    if (!ctx) {
      return;
    }

    try {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
          datasets: [{
            label: 'Satisfacción General',
            data: this.calcularDistribucion('satisfaccion_general'),
            backgroundColor: 'rgba(76, 175, 80, 0.8)',
            borderColor: 'rgba(76, 175, 80, 1)',
            borderWidth: 1
          }]
        },
        options: {
                    plugins: {
                      legend: {
                        labels: {
                          color: '#fff'
                        }
                      },
                      title: {
                        color: '#fff'
                      }
                    },
                    scales: {
                      x: {
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                      },
                      y: {
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                      }
                    }
                  }
      });
    } catch (error) {
    }
  }

  crearGraficoCalidadComida() {
    const ctx = document.getElementById('calidadComidaChart') as HTMLCanvasElement;
    if (!ctx) {
      return;
    }

    try {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
          datasets: [{
            label: 'Calidad de la Comida',
            data: this.calcularDistribucion('calidad_comida'),
            backgroundColor: 'rgba(255, 152, 0, 0.8)',
            borderColor: 'rgba(255, 152, 0, 1)',
            borderWidth: 1
          }]
        },
options: {
            plugins: {
              legend: {
                labels: {
                  color: '#fff'
                }
              },
              title: {
                color: '#fff'
              }
            },
            scales: {
              x: {
                ticks: { color: '#fff' },
                grid: { color: 'rgba(255,255,255,0.1)' }
              },
              y: {
                ticks: { color: '#fff' },
                grid: { color: 'rgba(255,255,255,0.1)' }
              }
            }
          }
      });
    } catch (error) {
    }
  }

  crearGraficoCalidadServicio() {
    const ctx = document.getElementById('calidadServicioChart') as HTMLCanvasElement;
    if (!ctx) {
      console.error('No se encontró el elemento canvas calidadServicioChart');
      return;
    }

    try {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
          datasets: [{
            label: 'Calidad del Servicio',
            data: this.calcularDistribucion('calidad_servicio'),
            backgroundColor: 'rgba(33, 150, 243, 0.8)',
            borderColor: 'rgba(33, 150, 243, 1)',
            borderWidth: 1
          }]
        },
options: {
            plugins: {
              legend: {
                labels: {
                  color: '#fff'
                }
              },
              title: {
                color: '#fff'
              }
            },
            scales: {
              x: {
                ticks: { color: '#fff' },
                grid: { color: 'rgba(255,255,255,0.1)' }
              },
              y: {
                ticks: { color: '#fff' },
                grid: { color: 'rgba(255,255,255,0.1)' }
              }
            }
          }
      });
    } catch (error) {
    }
  }

  crearGraficoAmbiente() {
    const ctx = document.getElementById('ambienteChart') as HTMLCanvasElement;
    if (!ctx) {
      return;
    }

    try {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
          datasets: [{
            label: 'Ambiente',
            data: this.calcularDistribucion('ambiente'),
            backgroundColor: 'rgba(156, 39, 176, 0.8)',
            borderColor: 'rgba(156, 39, 176, 1)',
            borderWidth: 1
          }]
        },
options: {
            plugins: {
              legend: {
                labels: {
                  color: '#fff'
                }
              },
              title: {
                color: '#fff'
              }
            },
            scales: {
              x: {
                ticks: { color: '#fff' },
                grid: { color: 'rgba(255,255,255,0.1)' }
              },
              y: {
                ticks: { color: '#fff' },
                grid: { color: 'rgba(255,255,255,0.1)' }
              }
            }
          }
      });
    } catch (error) {
    }
  }

  crearGraficoRecomendacion() {
    const ctx2 = document.getElementById('recomendacionChart') as HTMLCanvasElement;
    if (!ctx2) {
      return;
    }

    try {
      const recomendaciones = this.encuestas.map(e => e.recomendacion);
      const distribucion = {
        'Definitivamente sí': recomendaciones.filter(r => r === 'Definitivamente sí').length,
        'Probablemente sí': recomendaciones.filter(r => r === 'Probablemente sí').length,
        'No estoy seguro': recomendaciones.filter(r => r === 'No estoy seguro').length,
        'Probablemente no': recomendaciones.filter(r => r === 'Probablemente no').length,
        'Definitivamente no': recomendaciones.filter(r => r === 'Definitivamente no').length
      };

      new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: Object.keys(distribucion),
          datasets: [{
            data: Object.values(distribucion),
            backgroundColor: [
              'rgba(76, 175, 80, 0.8)',
              'rgba(139, 195, 74, 0.8)',
              'rgba(255, 193, 7, 0.8)',
              'rgba(255, 152, 0, 0.8)',
              'rgba(244, 67, 54, 0.8)'
            ],
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
options: {
            plugins: {
              legend: {
                labels: {
                  color: '#fff'
                }
              },
              title: {
                color: '#fff'
              }
            },
            scales: {
              x: {
                ticks: { color: '#fff' },
                grid: { color: 'rgba(255,255,255,0.1)' }
              },
              y: {
                ticks: { color: '#fff' },
                grid: { color: 'rgba(255,255,255,0.1)' }
              }
            }
          }
      });
    } catch (error) {
    }
  }

  crearGraficoVolveria() {
    const ctx = document.getElementById('volveriaChart') as HTMLCanvasElement;
    if (!ctx) {
      console.error('No se encontró el elemento canvas volveriaChart');
      return;
    }

    try {
      const volveria = this.encuestas.map(e => e.volverias);
      const distribucion = {
        'Sí': volveria.filter(v => v === true).length,
        'No': volveria.filter(v => v === false).length
      };

      new Chart(ctx, {
        type: 'pie',
        data: {
          labels: Object.keys(distribucion),
          datasets: [{
            data: Object.values(distribucion),
            backgroundColor: [
              'rgba(76, 175, 80, 0.8)',
              'rgba(244, 67, 54, 0.8)'
            ],
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
            plugins: {
              legend: {
                labels: {
                  color: '#fff'
                }
              },
              title: {
                color: '#fff'
              }
            },
            scales: {
              x: {
                ticks: { color: '#fff' },
                grid: { color: 'rgba(255,255,255,0.1)' }
              },
              y: {
                ticks: { color: '#fff' },
                grid: { color: 'rgba(255,255,255,0.1)' }
              }
            }
          }
      });
    } catch (error) {
    }
  }

  calcularDistribucion(campo: string): number[] {
    const distribucion = new Array(10).fill(0);
    this.encuestas.forEach(encuesta => {
      const valor = encuesta[campo as keyof Encuesta] as number;
      if (valor >= 1 && valor <= 10) {
        distribucion[valor - 1]++;
      }
    });
    return distribucion;
  }

  volverAHome() {
    this.loadingService.show();
    this.router.navigate(['/home']);
    this.loadingService.hide();
  }

  nuevaEncuesta() {
    this.encuestaEnviada = false;
    this.mostrarGraficos = false;
    this.encuestaForm.reset({
      satisfaccion_general: 5,
      calidad_comida: 5,
      calidad_servicio: 5,
      ambiente: 5,
      volverias: true
    });
    this.fotos = [];
    this.mensajeExito = '';
    this.mostrarMensajeExito = false;
  }

  async verificarTablas() {
    try {
      const tablas = ['encuesta_satisfaccion', 'encuestas', 'survey', 'encuesta'];
      
      for (const tabla of tablas) {
        try {
          const { data, error } = await this.supabase.supabase
            .from(tabla)
            .select('count')
            .limit(1);
          
          if (!error) {
            return tabla;
          } else {
          }
        } catch (error) {
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  mostrarImagenesEncuesta(encuesta: Encuesta) {
    this.encuestaSeleccionada = encuesta;
    this.mostrarImagenes = true;
  }

  cerrarImagenes() {
    this.mostrarImagenes = false;
    this.encuestaSeleccionada = null;
  }

  abrirImagen(imagen: string) {
    this.imagenAmpliada = imagen;
  }

  cerrarImagenAmpliada() { 
    this.imagenAmpliada = null;
  }

}
