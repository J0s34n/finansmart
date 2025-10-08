/**
 * Modelo de Categoría
 * Representa categorías para clasificar transacciones
 */

/**
 * Tipo de categoría (ingreso o gasto)
 */
export enum CategoryType {
  INCOME = 'income',    // Ingreso
  EXPENSE = 'expense'   // Gasto
}

/**
 * Interface de Categoría
 */
export interface Category {
  id: string;                     // ID único
  name: string;                   // Nombre de la categoría
  type: CategoryType;             // Tipo: ingreso o gasto
  icon: string;                   // Nombre del ícono (Ionicons)
  color: string;                  // Color en hexadecimal
  userId?: string;                // ID del usuario (si es personalizada)
  isDefault: boolean;             // Si es categoría predeterminada del sistema
  createdAt: Date;                // Fecha de creación
}

/**
 * Clase Category con métodos útiles
 */
export class CategoryModel implements Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  userId?: string;
  isDefault: boolean;
  createdAt: Date;

  constructor(data: Partial<Category>) {
    this.id = data.id || this.generateId();
    this.name = data.name || '';
    this.type = data.type || CategoryType.EXPENSE;
    this.icon = data.icon || 'pricetag-outline';
    this.color = data.color || '#6366f1';
    this.userId = data.userId;
    this.isDefault = data.isDefault || false;
    this.createdAt = data.createdAt || new Date();
  }

  /**
   * Genera un ID único
   */
  private generateId(): string {
    return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convierte a formato JSON para Firebase
   */
  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      icon: this.icon,
      color: this.color,
      userId: this.userId,
      isDefault: this.isDefault,
      createdAt: this.createdAt.toISOString()
    };
  }

  /**
   * Crea una Category desde datos de Firebase
   */
  static fromFirebase(data: any): CategoryModel {
    return new CategoryModel({
      ...data,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date()
    });
  }

  /**
   * Obtiene las categorías predeterminadas del sistema
   */
  static getDefaultCategories(): CategoryModel[] {
    const expenseCategories = [
      { name: 'Alimentación', icon: 'restaurant-outline', color: '#ef4444' },
      { name: 'Transporte', icon: 'car-outline', color: '#f59e0b' },
      { name: 'Vivienda', icon: 'home-outline', color: '#8b5cf6' },
      { name: 'Servicios', icon: 'flash-outline', color: '#3b82f6' },
      { name: 'Entretenimiento', icon: 'game-controller-outline', color: '#ec4899' },
      { name: 'Salud', icon: 'medical-outline', color: '#10b981' },
      { name: 'Educación', icon: 'school-outline', color: '#6366f1' },
      { name: 'Compras', icon: 'cart-outline', color: '#f97316' },
      { name: 'Otros Gastos', icon: 'ellipsis-horizontal-outline', color: '#64748b' }
    ];

    const incomeCategories = [
      { name: 'Salario', icon: 'cash-outline', color: '#22c55e' },
      { name: 'Freelance', icon: 'laptop-outline', color: '#14b8a6' },
      { name: 'Inversiones', icon: 'trending-up-outline', color: '#06b6d4' },
      { name: 'Otros Ingresos', icon: 'add-circle-outline', color: '#10b981' }
    ];

    const expenses = expenseCategories.map(cat => 
      new CategoryModel({
        name: cat.name,
        type: CategoryType.EXPENSE,
        icon: cat.icon,
        color: cat.color,
        isDefault: true
      })
    );

    const incomes = incomeCategories.map(cat => 
      new CategoryModel({
        name: cat.name,
        type: CategoryType.INCOME,
        icon: cat.icon,
        color: cat.color,
        isDefault: true
      })
    );

    return [...expenses, ...incomes];
  }

  /**
   * Valida si la categoría es válida
   */
  isValid(): boolean {
    return !!(this.name && this.type && this.icon && this.color);
  }
}