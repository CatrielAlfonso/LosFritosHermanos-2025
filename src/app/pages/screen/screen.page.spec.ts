import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScreenPage } from './screen.page';

describe('ScreenPage', () => {
  let component: ScreenPage;
  let fixture: ComponentFixture<ScreenPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ScreenPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
