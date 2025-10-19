import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonIcon,
  IonBackButton,
  IonButtons,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonList,
  IonItem,
  IonLabel,
  IonText,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonProgressBar,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  AlertController,
  LoadingController,
  ToastController,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  trashOutline,
  warningOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  trendingUpOutline,
  statsChartOutline,
  pencilOutline
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { BudgetService } from '@app/core/services/budget.service';
import { CategoryService } from '@app/core/services/category.service';
import { AuthService } from '@app/core/services/auth.service';
import { BudgetModel, BudgetStatus, BudgetSummary } from '@app/models';

@Component({
  selector: 'app-budgets',
  templateUrl: './budgets.page.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styleUrls: ['./budgets.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonIcon,
    IonBackButton,
    IonButtons,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSegment,
    IonSegmentButton,
    IonList,
    IonItem,
    IonLabel,
    IonText,
    IonBadge,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    IonGrid,
    IonRow,
    IonCol,
    IonChip,
    IonProgressBar,
    IonItemSliding,
    IonItemOptions,
    IonItemOption
  ]
})
export class BudgetsPage implements OnInit, OnDestroy {
  budgets: BudgetModel[] = [];
  filteredBudgets: BudgetModel[] = [];
  budgetSummary: BudgetSummary | null = null;

  selectedFilter: 'all' | 'active' | 'exceeded' | 'danger' = 'all';
  loading = true;
  currentMonth = '';
  currentYear = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private budgetService: BudgetService,
    private categoryService: CategoryService,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {
    // Registrar iconos
    addIcons({
      addOutline,
      trashOutline,
      warningOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      trendingUpOutline,
      statsChartOutline,
      pencilOutline
    });
  }

  ngOnInit() {
    this.loadBudgets();
    this.setCurrentMonth();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga todos los presupuestos
   */
  private loadBudgets(): void {
    this.budgetService.budgets$
      .pipe(takeUntil(this.destroy$))
      .subscribe(budgets => {
        this.budgets = budgets;
        this.applyFilters();
        this.loading = false;
      });

    // Cargar resumen
    this.budgetService.getCurrentMonthBudgetSummary$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => {
        this.budgetSummary = summary;
      });
  }

  /**
   * Establece el mes y año actual
   */
  private setCurrentMonth(): void {
    const now = new Date();
    this.currentMonth = now.toLocaleDateString('es-MX', { month: 'long' });
    this.currentYear = now.getFullYear();
  }

  /**
   * Aplica los filtros
   */
  private applyFilters(): void {
    let filtered = this.budgets.filter(b => b.isCurrentPeriod());

    switch (this.selectedFilter) {
      case 'active':
        filtered = filtered.filter(b => b.isActive);
        break;
      case 'exceeded':
        filtered = filtered.filter(b => b.status === BudgetStatus.EXCEEDED);
        break;
      case 'danger':
        filtered = filtered.filter(b => 
          b.status === BudgetStatus.DANGER || b.status === BudgetStatus.EXCEEDED
        );
        break;
      case 'all':
      default:
        break;
    }

    this.filteredBudgets = filtered;
  }

  /**
   * Cambia el filtro
   */
  onFilterChange(event: any): void {
    this.selectedFilter = event.detail.value;
    this.applyFilters();
  }

  /**
   * Maneja el refresh
   */
  async handleRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.budgetService.reloadBudgets();
    } catch (error) {
      console.error('Error al refrescar:', error);
    } finally {
      event.target.complete();
    }
  }

  /**
   * Navega a agregar presupuesto
   */
  goToAddBudget(): void {
    this.router.navigate(['/add-budget']);
  }

  /**
   * Navega a editar presupuesto
   */
  goToEditBudget(budget: BudgetModel, event: any): void {
    event.target.closest('ion-item-sliding').closeOpened();
    // Implementar en próxima versión
    this.showToast('Edición próximamente disponible', 'warning');
  }

  /**
   * Elimina un presupuesto
   */
  async deleteBudget(budget: BudgetModel, event: any): Promise<void> {
    event.target.closest('ion-item-sliding').closeOpened();

    const alert = await this.alertController.create({
      header: 'Eliminar Presupuesto',
      message: `¿Estás seguro de que deseas eliminar el presupuesto de ${budget.categoryName}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            await this.performDelete(budget);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Realiza la eliminación
   */
  private async performDelete(budget: BudgetModel): Promise<void> {
    const loading = await this.loadingController.create({
      message: 'Eliminando...'
    });

    await loading.present();

    try {
      await this.budgetService.deleteBudget(budget.id);
      await this.showToast('Presupuesto eliminado correctamente', 'success');
    } catch (error: any) {
      console.error('Error al eliminar:', error);
      await this.showToast('Error al eliminar el presupuesto', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Obtiene el color del estado
   */
  getStatusColor(status: BudgetStatus): string {
    switch (status) {
      case BudgetStatus.SAFE:
        return 'success';
      case BudgetStatus.WARNING:
        return 'warning';
      case BudgetStatus.DANGER:
      case BudgetStatus.EXCEEDED:
        return 'danger';
      default:
        return 'medium';
    }
  }

  /**
   * Obtiene el ícono del estado
   */
  getStatusIcon(status: BudgetStatus): string {
    switch (status) {
      case BudgetStatus.SAFE:
        return 'checkmark-circle-outline';
      case BudgetStatus.WARNING:
        return 'alert-circle-outline';
      case BudgetStatus.DANGER:
      case BudgetStatus.EXCEEDED:
        return 'warning-outline';
      default:
        return 'stats-chart-outline';
    }
  }

  /**
   * Obtiene el texto del estado
   */
  getStatusLabel(status: BudgetStatus): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
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

  /**
   * Obtiene el color de la barra de progreso
   */
  getProgressColor(percentage: number): string {
    if (percentage > 100) {
      return 'danger';
    } else if (percentage >= 90) {
      return 'danger';
    } else if (percentage >= 70) {
      return 'warning';
    } else {
      return 'success';
    }
  }

  /**
   * Verifica si hay presupuestos
   */
  hasBudgets(): boolean {
    return this.filteredBudgets.length > 0;
  }

  /**
   * Obtiene la cantidad de presupuestos
   */
  getBudgetCount(): string {
    if (this.filteredBudgets.length === 0) {
      return 'Sin presupuestos';
    }
    return `${this.filteredBudgets.length} presupuesto${this.filteredBudgets.length > 1 ? 's' : ''}`;
  }

  /**
   * Obtiene el porcentaje formateado
   */
  getPercentageText(budget: BudgetModel): string {
    return `${budget.percentage.toFixed(0)}%`;
  }

  /**
   * Verifica si debe mostrar alerta
   */
  shouldShowAlert(budget: BudgetModel): boolean {
    return budget.shouldAlert();
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
}