import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
  IonIcon,
  IonBackButton,
  IonButtons,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonGrid,
  IonRow,
  IonCol,
  IonAlert,
  IonSegment,
  IonSegmentButton,
  IonRange,
  AlertController,
  LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  checkmarkOutline,
  arrowBackOutline,
  pinOutline,
  settingsOutline
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@app/core/services/auth.service';
import { BudgetService } from '@app/core/services/budget.service';
import { CategoryService } from '@app/core/services/category.service';
import { TransactionService } from '@app/core/services/transaction.service';
import { BudgetModel, BudgetPeriod, CategoryType, CategoryModel } from '@app/models';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-add-budget',
  templateUrl: './add-budget.page.html',
  styleUrls: ['./add-budget.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonText,
    IonSpinner,
    IonIcon,
    IonBackButton,
    IonButtons,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonGrid,
    IonRow,
    IonCol,
    IonAlert,
    IonSegment,
    IonSegmentButton,
    IonRange
  ]
})
export class AddBudgetPage implements OnInit, OnDestroy {
  budgetForm!: FormGroup;
  expenseCategories: CategoryModel[] = [];
  selectedCategory: CategoryModel | null = null;
  suggestedAmount = 0;
  alertThreshold = 80;
  isLoading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private budgetService: BudgetService,
    private categoryService: CategoryService,
    private transactionService: TransactionService,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    // Registrar iconos
    addIcons({
      closeOutline,
      checkmarkOutline,
      arrowBackOutline,
      pinOutline,
      settingsOutline
    });
  }

  ngOnInit() {
    this.initializeForm();
    this.loadCategories();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializa el formulario
   */
  private initializeForm(): void {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    this.budgetForm = this.formBuilder.group({
      amount: ['', [
        Validators.required,
        Validators.min(1),
        Validators.max(9999999.99)
      ]],
      period: [BudgetPeriod.MONTHLY, [Validators.required]],
      alertThreshold: [80, [
        Validators.required,
        Validators.min(1),
        Validators.max(100)
      ]],
      isActive: [true],
      month: [month, [Validators.required]],
      year: [year, [Validators.required]]
    });
  }

  /**
   * Carga las categorías de gasto
   */
  private loadCategories(): void {
    this.categoryService.getExpenseCategories$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(categories => {
        this.expenseCategories = categories;
        // Seleccionar la primera por defecto
        if (categories.length > 0 && !this.selectedCategory) {
          this.selectedCategory = categories[0];
        }
      });
  }

  /**
   * Selecciona una categoría
   */
  onCategoryChange(event: any): void {
    const categoryId = event.detail.value;
    this.selectedCategory = this.expenseCategories.find(c => c.id === categoryId) || null;
    this.updateSuggestedAmount();
  }

  /**
   * Actualiza el monto sugerido basado en gastos anteriores
   */
  private async updateSuggestedAmount(): Promise<void> {
    if (!this.selectedCategory) return;

    try {
      // Obtener transacciones de esta categoría del mes anterior
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const transactions = await this.transactionService.getTransactionsByCategory(
        this.selectedCategory.id
      );

      if (transactions && transactions.length > 0) {
        const monthTransactions = transactions.filter(t => {
          return t.date.getMonth() === lastMonth.getMonth() &&
                 t.date.getFullYear() === lastMonth.getFullYear();
        });

        if (monthTransactions.length > 0) {
          const total = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
          // Sugerir 10% más que el promedio
          this.suggestedAmount = Math.round(total * 1.1);
          this.budgetForm.patchValue({ amount: this.suggestedAmount });
        }
      }
    } catch (error) {
      console.error('Error al calcular monto sugerido:', error);
    }
  }

  /**
   * Cambia el threshold de alerta
   */
  onThresholdChange(event: any): void {
    this.alertThreshold = event.detail.value;
    this.budgetForm.patchValue({ alertThreshold: this.alertThreshold });
  }

  /**
   * Maneja el submit del formulario
   */
  async onSubmit(): Promise<void> {
    if (this.budgetForm.invalid || !this.selectedCategory) {
      this.markFormGroupTouched(this.budgetForm);
      await this.showToast('Por favor completa todos los campos requeridos', 'warning');
      return;
    }

    await this.saveBudget();
  }

  /**
   * Guarda el presupuesto
   */
  private async saveBudget(): Promise<void> {
    const loading = await this.loadingController.create({
      message: 'Guardando presupuesto...',
      spinner: 'crescent'
    });

    await loading.present();
    this.isLoading = true;

    try {
      const { amount, period, alertThreshold, isActive, month, year } = this.budgetForm.value;
      const userId = this.authService.getCurrentUserId();

      if (!userId) {
        throw new Error('Usuario no autenticado');
      }

      const budget = new BudgetModel({
        userId,
        categoryId: this.selectedCategory!.id,
        categoryName: this.selectedCategory!.name,
        categoryIcon: this.selectedCategory!.icon,
        categoryColor: this.selectedCategory!.color,
        amount: parseFloat(amount),
        currency: this.authService.getCurrentUser()?.preferences.currency || 'MXN',
        period,
        month,
        year,
        alertThreshold,
        isActive,
        spent: 0
      });

      await this.budgetService.createBudget(budget);

      await loading.dismiss();
      await this.showToast('¡Presupuesto guardado correctamente!', 'success');

      // Redirigir a presupuestos
      this.router.navigate(['/budgets']);

    } catch (error: any) {
      await loading.dismiss();
      console.error('Error al guardar presupuesto:', error);
      await this.showToast(
        error.message || 'Error al guardar el presupuesto',
        'danger'
      );
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Cancela y vuelve atrás
   */
  goBack(): void {
    if (this.budgetForm.dirty) {
      this.showCancelAlert();
    } else {
      this.router.navigate(['/budgets']);
    }
  }

  /**
   * Muestra alerta de cancelación
   */
  private async showCancelAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Descartar Cambios',
      message: '¿Descartas los cambios realizados?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Descartar',
          role: 'destructive',
          handler: () => {
            this.router.navigate(['/budgets']);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Muestra un toast
   */
  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color
    });
    await toast.present();
  }

  /**
   * Marca todos los campos como touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Obtiene mensaje de error para un campo
   */
  getErrorMessage(fieldName: string): string {
    const control = this.budgetForm.get(fieldName);

    if (!control || !control.touched || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'Este campo es requerido';
    }

    if (control.errors['min']) {
      return `El valor mínimo es ${control.errors['min'].min}`;
    }

    if (control.errors['max']) {
      return `El valor máximo es ${control.errors['max'].max}`;
    }

    return '';
  }

  /**
   * Verifica si un campo es inválido
   */
  isFieldInvalid(fieldName: string): boolean {
    const control = this.budgetForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  /**
   * Obtiene los meses disponibles
   */
  getMonths(): { value: number; label: string }[] {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months.map((label, index) => ({
      value: index + 1,
      label
    }));
  }

  /**
   * Obtiene los años disponibles
   */
  getYears(): number[] {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 1; i <= currentYear + 2; i++) {
      years.push(i);
    }
    return years;
  }

  /**
   * Obtiene el nombre del mes
   */
  getMonthName(month: number): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[month - 1];
  }

  /**
   * Formatea un monto
   */
  formatAmount(amount: number): string {
    const currency = this.authService.getCurrentUser()?.preferences.currency || 'MXN';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency
    }).format(amount);
  }

  compareById(item1: any, item2: any): boolean {
    return item1 && item2 && item1.id === item2.id;
  }
}