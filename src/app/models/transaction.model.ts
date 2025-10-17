/**
 * Modelo de Transacción
 * Representa un ingreso o gasto del usuario
 */

import { CategoryType } from './category.model';

/**
 * Interface de Transacción
 */
export interface Transaction {
  id: string;                     // ID único
  userId: string;                 // ID del usuario propietario
  type: CategoryType;             // Tipo: ingreso o gasto
  amount: number;                 // Monto de la transacción
  currency: string;               // Moneda (ej: 'MXN', 'USD')
  categoryId: string;             // ID de la categoría
  categoryName?: string;          // Nombre de categoría (cache)
  categoryIcon?: string;          // Ícono de categoría (cache)
  categoryColor?: string;         // Color de categoría (cache)
  description: string;            // Descripción de la transacción
  date: Date;                     // Fecha de la transacción
  notes?: string;                 // Notas adicionales (opcional)
  receiptUrl?: string;            // URL del recibo/comprobante en ImgBB (opcional)
  receiptDeleteUrl?: string;      // URL para eliminar el recibo de ImgBB (opcional)
  tags?: string[];                // Etiquetas para búsqueda (opcional)
  createdAt: Date;                // Fecha de creación
  updatedAt: Date;                // Última actualización
  syncedAt?: Date;                // Última sincronización con servidor
}

/**
 * Filtros para buscar transacciones
 */
export interface TransactionFilters {
  type?: CategoryType;            // Filtrar por tipo
  categoryId?: string;            // Filtrar por categoría
  dateFrom?: Date;                // Fecha desde
  dateTo?: Date;                  // Fecha hasta
  minAmount?: number;             // Monto mínimo
  maxAmount?: number;             // Monto máximo
  searchText?: string;            // Buscar en descripción/notas
}

/**
 * Estadísticas de transacciones
 */
export interface TransactionStats {
  totalIncome: number;            // Total de ingresos
  totalExpense: number;           // Total de gastos
  balance: number;                // Balance (ingresos - gastos)
  transactionCount: number;       // Cantidad de transacciones
  averageExpense: number;         // Gasto promedio
  largestExpense: number;         // Gasto más grande
  expensesByCategory: { [categoryId: string]: number }; // Gastos por categoría
}

/**
 * Clase Transaction con métodos útiles
 */
export class TransactionModel implements Transaction {
  getRelativeTime(date: Date): string {
    throw new Error('Method not implemented.');
  }
  id: string;
  userId: string;
  type: CategoryType;
  amount: number;
  currency: string;
  categoryId: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  description: string;
  date: Date;
  notes?: string;
  receiptUrl?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date;

  constructor(data: Partial<Transaction>) {
    this.id = data.id || this.generateId();
    this.userId = data.userId || '';
    this.type = data.type || CategoryType.EXPENSE;
    this.amount = data.amount || 0;
    this.currency = data.currency || 'MXN';
    this.categoryId = data.categoryId || '';
    this.categoryName = data.categoryName;
    this.categoryIcon = data.categoryIcon;
    this.categoryColor = data.categoryColor;
    this.description = data.description || '';
    this.date = data.date || new Date();
    this.notes = data.notes;
    this.receiptUrl = data.receiptUrl;
    this.tags = data.tags || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.syncedAt = data.syncedAt;
  }

  /**
   * Genera un ID único
   */
  private generateId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convierte a formato JSON para Firebase
   */
  toJSON(): any {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      amount: this.amount,
      currency: this.currency,
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      categoryIcon: this.categoryIcon,
      categoryColor: this.categoryColor,
      description: this.description,
      date: this.date.toISOString(),
      notes: this.notes,
      receiptUrl: this.receiptUrl,
      tags: this.tags,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      syncedAt: this.syncedAt?.toISOString()
    };
  }

  /**
   * Crea una Transaction desde datos de Firebase
   */
  static fromFirebase(data: any): TransactionModel {
    return new TransactionModel({
      ...data,
      date: data.date ? new Date(data.date) : new Date(),
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      syncedAt: data.syncedAt ? new Date(data.syncedAt) : undefined
    });
  }

  /**
   * Valida si la transacción es válida
   */
  isValid(): boolean {
    return !!(
      this.userId &&
      this.amount > 0 &&
      this.categoryId &&
      this.description &&
      this.date
    );
  }

  /**
   * Obtiene el monto formateado con símbolo de moneda
   */
  getFormattedAmount(): string {
    const symbol = this.getCurrencySymbol();
    const formatted = this.amount.toLocaleString('es-MX', {
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
   * Obtiene el mes y año de la transacción
   */
  getMonthYear(): string {
    return this.date.toLocaleDateString('es-MX', { 
      year: 'numeric', 
      month: 'long' 
    });
  }

  /**
   * Obtiene la fecha formateada
   */
  getFormattedDate(): string {
    return this.date.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Verifica si la transacción es de hoy
   */
  isToday(): boolean {
    const today = new Date();
    return this.date.toDateString() === today.toDateString();
  }

  /**
   * Verifica si la transacción es de este mes
   */
  isThisMonth(): boolean {
    const today = new Date();
    return (
      this.date.getMonth() === today.getMonth() &&
      this.date.getFullYear() === today.getFullYear()
    );
  }

  /**
   * Calcula estadísticas de un array de transacciones
   */
  static calculateStats(transactions: TransactionModel[]): TransactionStats {
    const stats: TransactionStats = {
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      transactionCount: transactions.length,
      averageExpense: 0,
      largestExpense: 0,
      expensesByCategory: {}
    };

    const expenses = transactions.filter(t => t.type === CategoryType.EXPENSE);
    
    transactions.forEach(transaction => {
      if (transaction.type === CategoryType.INCOME) {
        stats.totalIncome += transaction.amount;
      } else {
        stats.totalExpense += transaction.amount;
        
        // Acumular por categoría
        if (stats.expensesByCategory[transaction.categoryId]) {
          stats.expensesByCategory[transaction.categoryId] += transaction.amount;
        } else {
          stats.expensesByCategory[transaction.categoryId] = transaction.amount;
        }

        // Encontrar el gasto más grande
        if (transaction.amount > stats.largestExpense) {
          stats.largestExpense = transaction.amount;
        }
      }
    });

    stats.balance = stats.totalIncome - stats.totalExpense;
    stats.averageExpense = expenses.length > 0 
      ? stats.totalExpense / expenses.length 
      : 0;

    return stats;
  }

  /**
   * Filtra transacciones según criterios
   */
  static filterTransactions(
    transactions: TransactionModel[], 
    filters: TransactionFilters
  ): TransactionModel[] {
    return transactions.filter(transaction => {
      // Filtrar por tipo
      if (filters.type && transaction.type !== filters.type) {
        return false;
      }

      // Filtrar por categoría
      if (filters.categoryId && transaction.categoryId !== filters.categoryId) {
        return false;
      }

      // Filtrar por rango de fechas
      if (filters.dateFrom && transaction.date < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && transaction.date > filters.dateTo) {
        return false;
      }

      // Filtrar por monto
      if (filters.minAmount && transaction.amount < filters.minAmount) {
        return false;
      }
      if (filters.maxAmount && transaction.amount > filters.maxAmount) {
        return false;
      }

      // Filtrar por texto de búsqueda
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const matchDescription = transaction.description.toLowerCase().includes(searchLower);
        const matchNotes = transaction.notes?.toLowerCase().includes(searchLower);
        const matchTags = transaction.tags?.some(tag => 
          tag.toLowerCase().includes(searchLower)
        );

        if (!matchDescription && !matchNotes && !matchTags) {
          return false;
        }
      }

      return true;
    });
  }
}