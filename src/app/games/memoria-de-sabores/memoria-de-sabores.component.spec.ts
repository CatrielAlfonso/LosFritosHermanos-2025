import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { MemoriaDeSaboresComponent } from './memoria-de-sabores.component';

describe('MemoriaDeSaboresComponent', () => {
  let component: MemoriaDeSaboresComponent;
  let fixture: ComponentFixture<MemoriaDeSaboresComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ MemoriaDeSaboresComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(MemoriaDeSaboresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
