import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  IonButton,
  IonIcon,
  IonText,
  IonChip,
  IonLabel,
  IonList,
  IonItem,
  IonAvatar,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton,
  IonGrid,
  IonRow,
  IonCol,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  trendingUpOutline,
  trendingDownOutline,
  walletOutline,
  pieChartOutline,
  calendarOutline,
  arrowUpOutline,
  arrowDownOutline,
  timeOutline,
  personCircleOutline,
  settingsOutline
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@app/core/services/auth.service';
import { TransactionService } from '@app/core/services/transaction.service';
import { BudgetService } from '@app/core/services/budget.service';
import { UserModel, TransactionModel, TransactionStats, BudgetSummary } from '@app/models';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
    IonText,
    IonChip,
    IonLabel,
    IonList,
    IonItem,
    IonAvatar,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    IonGrid,
    IonRow,
    IonCol
  ]
})
export class DashboardPage implements OnInit, OnDestroy {
  currentUser: UserModel | null = null;
  stats: TransactionStats | null = null;
  budgetSummary: BudgetSummary | null = null;
  recentTransactions: TransactionModel[] = [];
  currentMonth = '';
  loading = true;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private transactionService: TransactionService,
    private budgetService: BudgetService,
    private router: Router
  ) {
    // Registrar iconos
    addIcons({
      addOutline,
      trendingUpOutline,
      trendingDownOutline,
      walletOutline,
      pieChartOutline,
      calendarOutline,
      arrowUpOutline,
      arrowDownOutline,
      timeOutline,
      personCircleOutline,
      settingsOutline
    });
  }

  ngOnInit() {
    this.initializeDashboard();
    this.setCurrentMonth();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializa el dashboard con datos
   */
  private initializeDashboard(): void {
    // Obtener usuario actual
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });

    // Obtener estadísticas del mes actual
    this.transactionService.getCurrentMonthStats$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(stats => {
        this.stats = stats;
        this.loading = false;
      });

    // Obtener resumen de presupuestos
    this.budgetService.getCurrentMonthBudgetSummary$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => {
        this.budgetSummary = summary;
      });

    // Obtener últimas transacciones
    this.transactionService.transactions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(transactions => {
        this.recentTransactions = transactions.slice(0, 5);
      });
  }

  /**
   * Establece el mes actual
   */
  private setCurrentMonth(): void {
    const now = new Date();
    this.currentMonth = now.toLocaleDateString('es-MX', { 
      month: 'long', 
      year: 'numeric' 
    });
  }

  /**
   * Maneja el refresh de la página
   */
  async handleRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await Promise.all([
        this.transactionService.reloadTransactions(),
        this.budgetService.reloadBudgets()
      ]);
    } catch (error) {
      console.error('Error al refrescar:', error);
    } finally {
      event.target.complete();
    }
  }

  /**
   * Navega a agregar transacción
   */
  goToAddTransaction(): void {
    this.router.navigate(['/add-transaction']);
  }

  /**
   * Navega a ver todas las transacciones
   */
  goToTransactions(): void {
    this.router.navigate(['/transactions']);
  }

  /**
   * Navega a ver presupuestos
   */
  goToBudgets(): void {
    this.router.navigate(['/budgets']);
  }

  /**
   * Navega a reportes
   */
  goToReports(): void {
    this.router.navigate(['/reports']);
  }

  /**
   * Navega al perfil
   */
  goToProfile(): void {
    this.router.navigate(['/profile']);
  }

  /**
   * Navega a configuración
   */
  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  /**
   * Navega al detalle de una transacción
   */
  goToTransactionDetail(transaction: TransactionModel): void {
    this.router.navigate(['/transaction-detail', transaction.id]);
  }

  /**
   * Formatea un monto con símbolo de moneda
   */
  formatAmount(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: this.currentUser?.preferences.currency || 'MXN'
    }).format(amount);
  }

  /**
   * Obtiene el saludo según la hora del día
   */
  getGreeting(): string {
    const hour = new Date().getHours();
    
    if (hour < 12) {
      return 'Buenos días';
    } else if (hour < 19) {
      return 'Buenas tardes';
    } else {
      return 'Buenas noches';
    }
  }

  /**
   * Obtiene el nombre del usuario o email
   */
  getUserDisplayName(): string {
    if (this.currentUser?.displayName) {
      return this.currentUser.displayName.split(' ')[0]; // Solo el primer nombre
    }
    return this.currentUser?.email.split('@')[0] || 'Usuario';
  }

  /**
   * Obtiene el color del balance
   */
  getBalanceColor(): string {
    if (!this.stats) return 'medium';
    
    if (this.stats.balance > 0) {
      return 'success';
    } else if (this.stats.balance < 0) {
      return 'danger';
    } else {
      return 'medium';
    }
  }

  /**
   * Verifica si hay transacciones
   */
  hasTransactions(): boolean {
    return this.recentTransactions.length > 0;
  }

  /**
   * Verifica si hay presupuestos
   */
  hasBudgets(): boolean {
    return this.budgetSummary !== null && this.budgetSummary.totalBudget > 0;
  }

  /**
   * Obtiene el porcentaje de uso de presupuestos
   */
  getBudgetUsagePercentage(): number {
    if (!this.budgetSummary || this.budgetSummary.totalBudget === 0) {
      return 0;
    }
    return Math.round(this.budgetSummary.averageUsage);
  }

  /**
   * Obtiene el color del estado de presupuestos
   */
  getBudgetStatusColor(): string {
    const percentage = this.getBudgetUsagePercentage();
    
    if (percentage < 70) {
      return 'success';
    } else if (percentage < 90) {
      return 'warning';
    } else {
      return 'danger';
    }
  }

  /**
   * Formatea una fecha relativa (ej: "Hace 2 horas")
   */
  getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `Hace ${days} día${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    } else {
      return 'Hace un momento';
    }
  }

  /**
   * Cierra sesión
   */
  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}