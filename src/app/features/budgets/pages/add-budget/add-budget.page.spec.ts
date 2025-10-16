import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddBudgetPage } from './add-budget.page';

describe('AddBudgetPage', () => {
  let component: AddBudgetPage;
  let fixture: ComponentFixture<AddBudgetPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AddBudgetPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
