import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScreenSplashPage } from './screen-splash.page';

describe('ScreenSplashPage', () => {
  let component: ScreenSplashPage;
  let fixture: ComponentFixture<ScreenSplashPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ScreenSplashPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
