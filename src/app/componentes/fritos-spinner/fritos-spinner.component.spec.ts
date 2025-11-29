import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { FritosSpinnerComponent } from './fritos-spinner.component';

describe('FritosSpinnerComponent', () => {
  let component: FritosSpinnerComponent;
  let fixture: ComponentFixture<FritosSpinnerComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [FritosSpinnerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FritosSpinnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
