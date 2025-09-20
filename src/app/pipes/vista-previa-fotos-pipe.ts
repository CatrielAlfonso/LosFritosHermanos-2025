import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'vistaPreviaFotos'
})
export class VistaPreviaFotosPipe implements PipeTransform {

  transform(file: File | null | undefined): string | null {
    if (!file) return null;
    return URL.createObjectURL(file);
  }

}
