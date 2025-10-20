import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonBackButton,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
  IonProgressBar,
  ToastController,
  LoadingController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  downloadOutline,
  chevronBackOutline,
  chevronForwardOutline,
  pieChartOutline,
  trendingUpOutline,
  listOutline,
  statsChartOutline,
  walletOutline,
  flameOutline,
  checkmarkCircleOutline,
  barChartOutline,
  arrowUpOutline,
  arrowDownOutline
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { TransactionService } from '@app/core/services/transaction.service';
import { BudgetService } from '@app/core/services/budget.service';
import { AuthService } from '@app/core/services/auth.service';
import { PdfExportService, ReportSection, TableData, KPIData } from '@app/core/services/pdf-export.service';
import { TransactionModel, TransactionStats, BudgetModel, BudgetSummary, CategoryType } from '@app/models';

Chart.register(...registerables);

interface CategoryExpense {
  name: string;
  amount: number;
  percentage: number;
  icon: string;
  color: string;
  categoryId: string;
}

interface MonthlyTrendData {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonBackButton,
    IonButtons,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonSpinner,
    IonGrid,
    IonRow,
    IonCol,
    IonProgressBar
  ]
})
export class ReportsPage implements OnInit, OnDestroy {
  @ViewChild('categoryChart') categoryChartRef: any;
  @ViewChild('trendChart') trendChartRef: any;
  @ViewChild('budgetChart') budgetChartRef: any;

  loading = true;
  reportType: 'monthly' | 'budget' = 'monthly';
  selectedMonth = new Date();

  // Monthly Report Data
  monthlyStats: TransactionStats = {
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    transactionCount: 0,
    averageExpense: 0,
    largestExpense: 0,
    expensesByCategory: {}
  };

  topExpenses: CategoryExpense[] = [];
  monthlyTransactions: TransactionModel[] = [];

  // Budget Report Data
  budgetSummary: BudgetSummary = {
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    averageUsage: 0,
    categoriesOverBudget: 0,
    categoriesAtRisk: 0
  };

  monthBudgets: BudgetModel[] = [];

  // Trend Data
  trendData: MonthlyTrendData[] = [];

  // Charts
  categoryChart: Chart | null = null;
  trendChart: Chart | null = null;
  budgetChart: Chart | null = null;

  categoryChartData: any = null;
  trendChartData: any = null;
  budgetChartData: any = null;

  private destroy$ = new Subject<void>();

  constructor(
    private transactionService: TransactionService,
    private budgetService: BudgetService,
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private pdfExportService: PdfExportService
  ) {
    addIcons({
      arrowBackOutline,
      downloadOutline,
      chevronBackOutline,
      chevronForwardOutline,
      pieChartOutline,
      trendingUpOutline,
      listOutline,
      statsChartOutline,
      walletOutline,
      flameOutline,
      checkmarkCircleOutline,
      barChartOutline,
      arrowUpOutline,
      arrowDownOutline
    });
  }

  ngOnInit() {
    this.loadReportData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyCharts();
  }

  /**
   * Carga los datos del reporte
   */
  private async loadReportData(): Promise<void> {
    try {
      this.loading = true;

      const month = this.selectedMonth.getMonth() + 1;
      const year = this.selectedMonth.getFullYear();

      // Cargar datos mensuales
      const transactions = await this.transactionService.getTransactionsByMonth(month, year);
      this.monthlyTransactions = transactions;
      this.monthlyStats = TransactionModel.calculateStats(transactions);

      // Procesar gastos por categoría
      this.processExpensesByCategory(transactions);

      // Cargar datos de tendencia (últimos 6 meses)
      await this.loadTrendData();

      // Cargar presupuestos
      this.monthBudgets = await this.budgetService.getBudgetsByMonth(month, year);
      this.budgetSummary = BudgetModel.calculateSummary(this.monthBudgets);

      // Renderizar gráficos
      setTimeout(() => {
        this.renderCharts();
      }, 300);

    } catch (error) {
      console.error('Error al cargar reportes:', error);
      await this.showToast('Error al cargar reportes', 'danger');
    } finally {
      this.loading = false;
    }
  }

  /**
   * Procesa los gastos por categoría
   */
  private processExpensesByCategory(transactions: TransactionModel[]): void {
    const categoryMap = new Map<string, { name: string; amount: number; icon: string; color: string }>();

    const expenses = transactions.filter(t => t.type === CategoryType.EXPENSE);

    expenses.forEach(transaction => {
      const categoryId = transaction.categoryId;
      if (categoryMap.has(categoryId)) {
        const current = categoryMap.get(categoryId)!;
        current.amount += transaction.amount;
      } else {
        categoryMap.set(categoryId, {
          name: transaction.categoryName || 'Sin categoría',
          amount: transaction.amount,
          icon: transaction.categoryIcon || 'folder-outline',
          color: transaction.categoryColor || '#2196F3'
        });
      }
    });

    // Convertir a array y ordenar
    this.topExpenses = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        ...data,
        percentage: this.monthlyStats.totalExpense > 0 
          ? (data.amount / this.monthlyStats.totalExpense) * 100 
          : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Preparar datos para gráfico
    this.categoryChartData = {
      labels: this.topExpenses.map(e => e.name),
      data: this.topExpenses.map(e => e.amount),
      colors: this.topExpenses.map(e => e.color)
    };
  }

  /**
   * Carga datos de tendencia (últimos 6 meses)
   */
  private async loadTrendData(): Promise<void> {
    this.trendData = [];
    const now = new Date(this.selectedMonth);

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      const monthTransactions = await this.transactionService.getTransactionsByMonth(month, year);
      const stats = TransactionModel.calculateStats(monthTransactions);

      this.trendData.push({
        month: date.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
        income: stats.totalIncome,
        expense: stats.totalExpense,
        balance: stats.balance
      });
    }

    this.trendChartData = {
      labels: this.trendData.map(t => t.month),
      income: this.trendData.map(t => t.income),
      expense: this.trendData.map(t => t.expense),
      balance: this.trendData.map(t => t.balance)
    };
  }

  /**
   * Renderiza los gráficos
   */
  private renderCharts(): void {
    this.destroyCharts();

    if (this.reportType === 'monthly') {
      this.renderCategoryChart();
      this.renderTrendChart();
    } else if (this.reportType === 'budget') {
      this.renderBudgetChart();
    }
  }

  /**
   * Renderiza el gráfico de categorías
   */
  private renderCategoryChart(): void {
    if (!this.categoryChartRef || !this.categoryChartData) return;

    const ctx = this.categoryChartRef.nativeElement.getContext('2d');
    this.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: this.categoryChartData.labels,
        datasets: [{
          data: this.categoryChartData.data,
          backgroundColor: this.categoryChartData.colors,
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { size: 12, family: "'-apple-system', 'Segoe UI'" },
              padding: 15,
              color: '#212121'
            }
          }
        }
      }
    });
  }

  /**
   * Renderiza el gráfico de tendencia
   */
  private renderTrendChart(): void {
    if (!this.trendChartRef || !this.trendChartData) return;

    const ctx = this.trendChartRef.nativeElement.getContext('2d');
    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.trendChartData.labels,
        datasets: [
          {
            label: 'Ingresos',
            data: this.trendChartData.income,
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#4CAF50'
          },
          {
            label: 'Gastos',
            data: this.trendChartData.expense,
            borderColor: '#F44336',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#F44336'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 12, family: "'-apple-system', 'Segoe UI'" },
              padding: 15,
              color: '#212121',
              usePointStyle: true
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#757575',
              font: { size: 11 }
            },
            grid: {
              color: '#E0E0E0'
            }
          },
          x: {
            ticks: {
              color: '#757575',
              font: { size: 11 }
            },
            grid: {
              color: '#E0E0E0'
            }
          }
        }
      }
    });
  }

  /**
   * Renderiza el gráfico de presupuesto
   */
  private renderBudgetChart(): void {
    if (!this.budgetChartRef || this.monthBudgets.length === 0) return;

    const ctx = this.budgetChartRef.nativeElement.getContext('2d');
    const labels = this.monthBudgets.map(b => b.categoryName || 'Sin nombre');
    const budgets = this.monthBudgets.map(b => b.amount);
    const spent = this.monthBudgets.map(b => b.spent);

    this.budgetChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Presupuesto',
            data: budgets,
            backgroundColor: '#2196F3',
            borderRadius: 4
          },
          {
            label: 'Gastado',
            data: spent,
            backgroundColor: '#FFC107',
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 12, family: "'-apple-system', 'Segoe UI'" },
              padding: 15,
              color: '#212121',
              usePointStyle: true
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              color: '#757575',
              font: { size: 11 }
            },
            grid: {
              color: '#E0E0E0'
            }
          },
          y: {
            ticks: {
              color: '#757575',
              font: { size: 11 }
            },
            grid: {
              color: '#E0E0E0'
            }
          }
        }
      }
    });
  }

  /**
   * Destruye los gráficos
   */
  private destroyCharts(): void {
    if (this.categoryChart) {
      this.categoryChart.destroy();
      this.categoryChart = null;
    }
    if (this.trendChart) {
      this.trendChart.destroy();
      this.trendChart = null;
    }
    if (this.budgetChart) {
      this.budgetChart.destroy();
      this.budgetChart = null;
    }
  }

  /**
   * Cambia al mes anterior
   */
  previousMonth(): void {
    const newDate = new Date(this.selectedMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    this.selectedMonth = newDate;
    this.loadReportData();
  }

  /**
   * Cambia al mes siguiente
   */
  nextMonth(): void {
    const newDate = new Date(this.selectedMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    this.selectedMonth = newDate;
    this.loadReportData();
  }

  /**
   * Verifica si el siguiente mes está deshabilitado
   */
  isNextMonthDisabled(): boolean {
    const now = new Date();
    const nextMonth = new Date(this.selectedMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth > now;
  }

  /**
   * Obtiene la descripción del mes
   */
  getMonthDescription(): string {
    const now = new Date();
    const currentMonth = now.getMonth();
    const selectedMonth = this.selectedMonth.getMonth();
    const selectedYear = this.selectedMonth.getFullYear();
    const currentYear = now.getFullYear();

    if (selectedMonth === currentMonth && selectedYear === currentYear) {
      return 'Mes actual';
    } else if (selectedMonth === currentMonth - 1 || 
               (currentMonth === 0 && selectedMonth === 11 && selectedYear === currentYear - 1)) {
      return 'Mes anterior';
    }

    return '';
  }

  /**
   * Cambia el tipo de reporte
   */
  onReportTypeChange(event: any): void {
    this.reportType = event.detail.value;
    setTimeout(() => {
      this.renderCharts();
    }, 300);
  }

  /**
   * Obtiene el total de transacciones de ingresos
   */
  getIncomeCount(): number {
    return this.monthlyTransactions.filter(t => t.type === CategoryType.INCOME).length;
  }

  /**
   * Obtiene el total de transacciones de gastos
   */
  getExpenseCount(): number {
    return this.monthlyTransactions.filter(t => t.type === CategoryType.EXPENSE).length;
  }

  /**
   * Obtiene el color para la barra de progreso del presupuesto
   */
  getBudgetProgressColor(budget: BudgetModel): string {
    if (budget.status === 'exceeded') {
      return 'danger';
    } else if (budget.status === 'danger') {
      return 'warning';
    } else if (budget.status === 'warning') {
      return 'warning';
    }
    return 'success';
  }

  /**
   * Exporta el reporte a PDF
   */
  async exportToPDF(): Promise<void> {
    try {
      const loading = await this.loadingController.create({
        message: 'Generando PDF...',
        spinner: 'crescent'
      });
      await loading.present();

      const month = this.selectedMonth.getMonth() + 1;
      const year = this.selectedMonth.getFullYear();
      const monthName = this.selectedMonth.toLocaleDateString('es-MX', {
        month: 'long',
        year: 'numeric'
      });

      // Preparar datos del reporte
      const sections: ReportSection[] = [];

      if (this.reportType === 'monthly') {
        sections.push(...this.getMonthlyReportSections());
      } else {
        sections.push(...this.getBudgetReportSections());
      }

      // Generar PDF
      await this.pdfExportService.exportReportToPDF(
        {
          title: 'FinanSmart - Reporte Financiero',
          subtitle: this.reportType === 'monthly' ? 'Reporte Mensual' : 'Comparativa de Presupuestos',
          date: new Date(),
          sections: sections
        },
        `reporte_${this.reportType}_${monthName.replace(/\s+/g, '_')}`
      );

      await loading.dismiss();
      await this.showToast('PDF generado correctamente', 'success');

    } catch (error) {
      console.error('Error al exportar PDF:', error);
      await this.showToast('Error al generar el PDF', 'danger');
    }
  }
// ✅ DESPUÉS (funcional)
/**
 * Muestra un toast con un mensaje
 * @param message Mensaje a mostrar
 * @param color Color del toast ('success', 'danger', 'warning', 'primary')
 * @param duration Duración en milisegundos (default: 2000)
 */
async showToast(
  message: string, 
  color: 'success' | 'danger' | 'warning' | 'primary' = 'primary',
  duration: number = 2000
): Promise<void> {
  const toast = await this.toastController.create({
    message: message,
    duration: duration,
    color: color,
    position: 'bottom',
    buttons: [
      {
        text: 'OK',
        role: 'cancel'
      }
    ]
  });
  await toast.present();
}

  /**
   * Obtiene las secciones del reporte mensual
   */
  private getMonthlyReportSections(): ReportSection[] {
    const sections: ReportSection[] = [];

    // Sección 1: KPIs
    const kpis: KPIData[] = [
      {
        label: 'Ingresos',
        value: this.monthlyStats.totalIncome.toFixed(2)
      },
      {
        label: 'Gastos',
        value: this.monthlyStats.totalExpense.toFixed(2)
      },
      {
        label: 'Balance',
        value: this.monthlyStats.balance.toFixed(2)
      }
    ];

    sections.push({
      title: 'Resumen Financiero',
      type: 'kpis',
      data: kpis
    });

    // Sección 2: Top Gastos (Tabla)
    const tableData: TableData = {
      headers: ['Categoría', 'Monto', 'Porcentaje'],
      rows: this.topExpenses.map(e => [
        e.name,
        e.amount.toFixed(2),
        `${e.percentage.toFixed(1)}%`
      ])
    };

    sections.push({
      title: 'Top 5 Categorías con Mayor Gasto',
      type: 'table',
      data: tableData
    });

    // Sección 3: Estadísticas (Tabla)
    const statsTableData: TableData = {
      headers: ['Métrica', 'Valor'],
      rows: [
        ['Total de Transacciones', this.monthlyStats.transactionCount.toString()],
        ['Promedio de Gasto', this.monthlyStats.averageExpense.toFixed(2)],
        ['Gasto Más Grande', this.monthlyStats.largestExpense.toFixed(2)],
        ['Transacciones de Ingreso', this.getIncomeCount().toString()],
        ['Transacciones de Gasto', this.getExpenseCount().toString()]
      ]
    };

    sections.push({
      title: 'Estadísticas Detalladas',
      type: 'table',
      data: statsTableData
    });

    return sections;
  }

  /**
   * Obtiene las secciones del reporte de presupuestos
   */
  private getBudgetReportSections(): ReportSection[] {
    const sections: ReportSection[] = [];

    // Sección 1: KPIs del Presupuesto
    const kpis: KPIData[] = [
      {
        label: 'Presupuesto Total',
        value: this.budgetSummary.totalBudget.toFixed(2)
      },
      {
        label: 'Total Gastado',
        value: this.budgetSummary.totalSpent.toFixed(2)
      },
      {
        label: 'Sobrante',
        value: this.budgetSummary.totalRemaining.toFixed(2)
      }
    ];

    sections.push({
      title: 'Resumen de Presupuestos',
      type: 'kpis',
      data: kpis
    });

    // Sección 2: Detalles de Presupuestos (Tabla)
    const tableData: TableData = {
      headers: ['Categoría', 'Presupuesto', 'Gastado', 'Restante', 'Uso %', 'Estado'],
      rows: this.monthBudgets.map(b => [
        b.categoryName || 'Sin nombre',
        b.amount.toFixed(2),
        b.spent.toFixed(2),
        b.remaining.toFixed(2),
        `${b.percentage.toFixed(0)}%`,
        b.getStatusLabel()
      ])
    };

    sections.push({
      title: 'Detalles por Categoría',
      type: 'table',
      data: tableData
    });

    // Sección 3: Resumen de Alertas
    const alertsText = this.budgetSummary.categoriesOverBudget > 0
      ? `Se encontraron ${this.budgetSummary.categoriesOverBudget} categoría(s) con presupuesto excedido y ${this.budgetSummary.categoriesAtRisk} categoría(s) en riesgo (uso > 80%).`
      : 'Todos los presupuestos están bajo control.';

    sections.push({
      title: 'Estado de Alertas',
      type: 'text',
      content: alertsText
    });

    return sections;
  }

  /**
   * Vuelve atrás
   */
  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

}
