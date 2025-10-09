import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { AtrapaElPolloComponent } from './atrapa-el-pollo.component';

describe('AtrapaElPolloComponent', () => {
  let component: AtrapaElPolloComponent;
  let fixture: ComponentFixture<AtrapaElPolloComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ AtrapaElPolloComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(AtrapaElPolloComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
