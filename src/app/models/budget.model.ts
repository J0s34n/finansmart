/**
 * Modelo de Presupuesto
 * Representa un presupuesto mensual por categoría
 */

/**
 * Estado del presupuesto
 */
export enum BudgetStatus {
  SAFE = 'safe',           // Gasto bajo control (< 70%)
  WARNING = 'warning',     // Acercándose al límite (70-90%)
  DANGER = 'danger',       // Cerca del límite (90-100%)
  EXCEEDED = 'exceeded'    // Límite excedido (> 100%)
}

/**
 * Período del presupuesto
 */
export enum BudgetPeriod {
  MONTHLY = 'monthly',     // Mensual
  WEEKLY = 'weekly',       // Semanal
  YEARLY = 'yearly'        // Anual
}

/**
 * Interface de Presupuesto
 */
export interface Budget {
  id: string;                     // ID único
  userId: string;                 // ID del usuario propietario
  categoryId: string;             // ID de la categoría
  categoryName?: string;          // Nombre de categoría (cache)
  categoryIcon?: string;          // Ícono de categoría (cache)
  categoryColor?: string;         // Color de categoría (cache)
  amount: number;                 // Monto límite del presupuesto
  currency: string;               // Moneda (ej: 'MXN', 'USD')
  period: BudgetPeriod;           // Período del presupuesto
  month: number;                  // Mes (1-12)
  year: number;                   // Año (ej: 2025)
  spent: number;                  // Monto gastado hasta ahora
  remaining: number;              // Monto restante
  percentage: number;             // Porcentaje usado (0-100+)
  status: BudgetStatus;           // Estado del presupuesto
  alertThreshold: number;         // % para activar alertas (ej: 80)
  isActive: boolean;              // Si está activo
  createdAt: Date;                // Fecha de creación
  updatedAt: Date;                // Última actualización
}

/**
 * Resumen de presupuestos
 */
export interface BudgetSummary {
  totalBudget: number;            // Presupuesto total
  totalSpent: number;             // Total gastado
  totalRemaining: number;         // Total restante
  averageUsage: number;           // Uso promedio (%)
  categoriesOverBudget: number;   // Categorías que excedieron
  categoriesAtRisk: number;       // Categorías en riesgo (>80%)
}

/**
 * Clase Budget con métodos útiles
 */
export class BudgetModel implements Budget {
  id: string;
  userId: string;
  categoryId: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  amount: number;
  currency: string;
  period: BudgetPeriod;
  month: number;
  year: number;
  spent: number;
  remaining!: number;
  percentage!: number;
  status: BudgetStatus = BudgetStatus.SAFE;
  alertThreshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<Budget>) {
    this.id = data.id || this.generateId();
    this.userId = data.userId || '';
    this.categoryId = data.categoryId || '';
    this.categoryName = data.categoryName;
    this.categoryIcon = data.categoryIcon;
    this.categoryColor = data.categoryColor;
    this.amount = data.amount || 0;
    this.currency = data.currency || 'MXN';
    this.period = data.period || BudgetPeriod.MONTHLY;
    
    // Si no se proporciona mes/año, usar el actual
    const now = new Date();
    this.month = data.month || now.getMonth() + 1;
    this.year = data.year || now.getFullYear();
    
    this.spent = data.spent || 0;
    this.alertThreshold = data.alertThreshold || 80;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();

    // Calcular valores derivados
    this.calculateDerivedValues();
  }

  /**
   * Genera un ID único
   */
  private generateId(): string {
    return `bdg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calcula valores derivados (remaining, percentage, status)
   */
  private calculateDerivedValues(): void {
    this.remaining = this.amount - this.spent;
    this.percentage = this.amount > 0 ? (this.spent / this.amount) * 100 : 0;
    this.status = this.calculateStatus();
  }

  /**
   * Calcula el estado del presupuesto según el porcentaje usado
   */
  private calculateStatus(): BudgetStatus {
    if (this.percentage > 100) {
      return BudgetStatus.EXCEEDED;
    } else if (this.percentage >= 90) {
      return BudgetStatus.DANGER;
    } else if (this.percentage >= 70) {
      return BudgetStatus.WARNING;
    } else {
      return BudgetStatus.SAFE;
    }
  }

  /**
   * Actualiza el monto gastado y recalcula valores
   */
  updateSpent(newSpent: number): void {
    this.spent = newSpent;
    this.updatedAt = new Date();
    this.calculateDerivedValues();
  }

  /**
   * Agrega un gasto al presupuesto
   */
  addExpense(amount: number): void {
    this.spent += amount;
    this.updatedAt = new Date();
    this.calculateDerivedValues();
  }

  /**
   * Resta un gasto del presupuesto (por ejemplo, al eliminar transacción)
   */
  removeExpense(amount: number): void {
    this.spent = Math.max(0, this.spent - amount);
    this.updatedAt = new Date();
    this.calculateDerivedValues();
  }

  /**
   * Verifica si se debe mostrar alerta
   */
  shouldAlert(): boolean {
    return this.percentage >= this.alertThreshold && this.isActive;
  }

  /**
   * Obtiene mensaje de alerta
   */
  getAlertMessage(): string {
    if (this.status === BudgetStatus.EXCEEDED) {
      const excess = this.spent - this.amount;
      return `Has excedido tu presupuesto de ${this.categoryName} por ${this.formatAmount(excess)}`;
    } else if (this.status === BudgetStatus.DANGER) {
      return `Estás muy cerca del límite en ${this.categoryName} (${this.percentage.toFixed(0)}%)`;
    } else if (this.status === BudgetStatus.WARNING) {
      return `Estás usando el ${this.percentage.toFixed(0)}% de tu presupuesto de ${this.categoryName}`;
    }
    return '';
  }

  /**
   * Obtiene el monto formateado
   */
  formatAmount(amount: number = this.amount): string {
    const symbol = this.getCurrencySymbol();
    const formatted = amount.toLocaleString('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return `${symbol}${formatted}`;
  }

  /**
   * Obtiene el símbolo de la moneda
   */
  private getCurrencySymbol(): string {
    const symbols: { [key: string]: string } = {
      'MXN': '$',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };
    return symbols[this.currency] || this.currency;
  }

  /**
   * Obtiene el color según el estado
   */
  getStatusColor(): string {
    const colors = {
      [BudgetStatus.SAFE]: '#10b981',      // verde
      [BudgetStatus.WARNING]: '#f59e0b',   // amarillo
      [BudgetStatus.DANGER]: '#f97316',    // naranja
      [BudgetStatus.EXCEEDED]: '#ef4444'   // rojo
    };
    return colors[this.status];
  }

  /**
   * Obtiene el nombre del estado en español
   */
  getStatusLabel(): string {
    const labels = {
      [BudgetStatus.SAFE]: 'Bajo control',
      [BudgetStatus.WARNING]: 'Atención',
      [BudgetStatus.DANGER]: 'Peligro',
      [BudgetStatus.EXCEEDED]: 'Excedido'
    };
    return labels[this.status];
  }

  /**
   * Verifica si el presupuesto es del mes/año actual
   */
  isCurrentPeriod(): boolean {
    const now = new Date();
    return (
      this.month === now.getMonth() + 1 &&
      this.year === now.getFullYear()
    );
  }

  /**
   * Convierte a formato JSON para Firebase
   */
  toJSON(): any {
    return {
      id: this.id,
      userId: this.userId,
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      categoryIcon: this.categoryIcon,
      categoryColor: this.categoryColor,
      amount: this.amount,
      currency: this.currency,
      period: this.period,
      month: this.month,
      year: this.year,
      spent: this.spent,
      remaining: this.remaining,
      percentage: this.percentage,
      status: this.status,
      alertThreshold: this.alertThreshold,
      isActive: this.isActive,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * Crea un Budget desde datos de Firebase
   */
  static fromFirebase(data: any): BudgetModel {
    return new BudgetModel({
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date()
    });
  }

  /**
   * Valida si el presupuesto es válido
   */
  isValid(): boolean {
    return !!(
      this.userId &&
      this.categoryId &&
      this.amount > 0 &&
      this.month >= 1 &&
      this.month <= 12 &&
      this.year > 2000
    );
  }

  /**
   * Calcula el resumen de múltiples presupuestos
   */
  static calculateSummary(budgets: BudgetModel[]): BudgetSummary {
    const summary: BudgetSummary = {
      totalBudget: 0,
      totalSpent: 0,
      totalRemaining: 0,
      averageUsage: 0,
      categoriesOverBudget: 0,
      categoriesAtRisk: 0
    };

    if (budgets.length === 0) {
      return summary;
    }

    budgets.forEach(budget => {
      summary.totalBudget += budget.amount;
      summary.totalSpent += budget.spent;
      summary.totalRemaining += budget.remaining;

      if (budget.status === BudgetStatus.EXCEEDED) {
        summary.categoriesOverBudget++;
      }

      if (budget.percentage >= 80) {
        summary.categoriesAtRisk++;
      }
    });

    summary.averageUsage = summary.totalBudget > 0
      ? (summary.totalSpent / summary.totalBudget) * 100
      : 0;

    return summary;
  }

  /**
   * Obtiene presupuestos que necesitan atención
   */
  static getBudgetsNeedingAttention(budgets: BudgetModel[]): BudgetModel[] {
    return budgets.filter(budget => 
      budget.isActive && 
      (budget.status === BudgetStatus.EXCEEDED || 
       budget.status === BudgetStatus.DANGER)
    ).sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Crea un presupuesto para el próximo mes basado en uno existente
   */
  cloneForNextMonth(): BudgetModel {
    const nextMonth = this.month === 12 ? 1 : this.month + 1;
    const nextYear = this.month === 12 ? this.year + 1 : this.year;

    return new BudgetModel({
      userId: this.userId,
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      categoryIcon: this.categoryIcon,
      categoryColor: this.categoryColor,
      amount: this.amount,
      currency: this.currency,
      period: this.period,
      month: nextMonth,
      year: nextYear,
      spent: 0,
      alertThreshold: this.alertThreshold,
      isActive: this.isActive
    });
  }

  /**
   * Obtiene el nombre del mes
   */
  getMonthName(): string {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[this.month - 1];
  }

  /**
   * Obtiene el período formateado
   */
  getFormattedPeriod(): string {
    return `${this.getMonthName()} ${this.year}`;
  }

  /**
   * Calcula cuántos días quedan en el período
   */
  getDaysRemaining(): number {
    const today = new Date();
    const lastDay = new Date(this.year, this.month, 0);
    const diff = lastDay.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Calcula el promedio de gasto diario permitido con el presupuesto restante
   */
  getDailyBudgetRemaining(): number {
    const daysRemaining = this.getDaysRemaining();
    if (daysRemaining === 0) return 0;
    return this.remaining / daysRemaining;
  }
}