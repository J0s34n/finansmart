import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { where, orderBy } from '@angular/fire/firestore';
import { FirestoreService } from './firestore.service';
import { AuthService } from './auth.service';
import { TransactionService } from './transaction.service';
import { 
  BudgetModel, 
  Budget, 
  BudgetStatus,
  BudgetPeriod,
  BudgetSummary,
  CategoryType 
} from '../../models';

/**
 * Servicio para gestionar presupuestos mensuales
 * Maneja CRUD, cálculos automáticos, alertas y sincronización con transacciones
 */
@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private readonly COLLECTION_PATH = 'budgets';

  // Cache de presupuestos
  private budgetsSubject = new BehaviorSubject<BudgetModel[]>([]);
  public budgets$ = this.budgetsSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    private firestoreService: FirestoreService,
    private authService: AuthService,
    private transactionService: TransactionService
  ) {
    this.initBudgetsListener();
  }

  // ========================================
  // INICIALIZACIÓN Y LISTENERS
  // ========================================

  /**
   * Inicializa el listener de presupuestos del usuario actual
   */
  private initBudgetsListener(): void {
    this.authService.currentUser$.pipe(
      switchMap(user => {
        if (user) {
          // Usuario autenticado, escuchar sus presupuestos
          return this.firestoreService.watchQuery<Budget>(
            this.COLLECTION_PATH,
            where('userId', '==', user.uid),
            orderBy('year', 'desc'),
            orderBy('month', 'desc')
          );
        } else {
          // No hay usuario, retornar array vacío
          return new Observable<Budget[]>(observer => {
            observer.next([]);
          });
        }
      }),
      map(budgets => 
        budgets.map((b: Budget) => BudgetModel.fromFirebase(b))
      )
    ).subscribe(budgets => {
      this.budgetsSubject.next(budgets);
      this.loadingSubject.next(false);
      
      // Actualizar gastos de presupuestos actuales automáticamente
      this.updateCurrentBudgetsSpent();
    });

    // Escuchar cambios en transacciones para actualizar presupuestos
    this.transactionService.transactions$.subscribe(() => {
      this.updateCurrentBudgetsSpent();
    });
  }

  /**
   * Actualiza los gastos de los presupuestos del mes actual
   */
  private async updateCurrentBudgetsSpent(): Promise<void> {
    const currentBudgets = this.getCurrentMonthBudgets();
    if (currentBudgets.length === 0) return;

    const transactions = this.transactionService.getCurrentMonthTransactions();
    const expensesByCategory = transactions
      .filter(t => t.type === CategoryType.EXPENSE)
      .reduce((acc, t) => {
        acc[t.categoryId] = (acc[t.categoryId] || 0) + t.amount;
        return acc;
      }, {} as { [categoryId: string]: number });

    // Actualizar presupuestos en memoria
    const updatedBudgets = currentBudgets.map(budget => {
      const spent = expensesByCategory[budget.categoryId] || 0;
      if (budget.spent !== spent) {
        budget.updateSpent(spent);
        // Actualizar en Firestore (sin await para no bloquear)
        this.updateBudgetSpent(budget.id, spent).catch(error => {
          console.error('Error al actualizar gasto del presupuesto:', error);
        });
      }
      return budget;
    });

    // Actualizar el cache con los presupuestos actualizados
    const allBudgets = this.budgetsSubject.value.map(b => {
      const updated = updatedBudgets.find(ub => ub.id === b.id);
      return updated || b;
    });
    
    this.budgetsSubject.next(allBudgets);
  }

  // ========================================
  // MÉTODOS DE ESCRITURA (CRUD)
  // ========================================

  /**
   * Crea un nuevo presupuesto
   */
  async createBudget(budget: BudgetModel): Promise<string> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    // Asegurar que el userId esté correcto
    budget.userId = userId;
    budget.createdAt = new Date();
    budget.updatedAt = new Date();

    // Validar presupuesto
    if (!budget.isValid()) {
      throw new Error('Presupuesto inválido. Verifica los campos requeridos.');
    }

    // Verificar que no exista ya un presupuesto para esa categoría/mes/año
    const existing = await this.getBudgetByCategory(
      budget.categoryId,
      budget.month,
      budget.year
    );

    if (existing) {
      throw new Error('Ya existe un presupuesto para esta categoría en este período');
    }

    try {
      // Calcular gasto actual si es el mes corriente
      if (budget.isCurrentPeriod()) {
        const transactions = this.transactionService.getCurrentMonthTransactions();
        const spent = transactions
          .filter(t => t.type === CategoryType.EXPENSE && t.categoryId === budget.categoryId)
          .reduce((sum, t) => sum + t.amount, 0);
        
        budget.updateSpent(spent);
      }

      const docId = await this.firestoreService.add(
        this.COLLECTION_PATH,
        budget.toJSON()
      );

      console.log('Presupuesto creado:', docId);
      return docId;
    } catch (error) {
      console.error('Error al crear presupuesto:', error);
      throw error;
    }
  }

  /**
   * Actualiza un presupuesto existente
   */
  async updateBudget(budgetId: string, updates: Partial<BudgetModel>): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      // Verificar que el presupuesto pertenece al usuario
      const existing = await this.getBudgetById(budgetId);
      if (!existing || existing.userId !== userId) {
        throw new Error('No tienes permiso para modificar este presupuesto');
      }

      updates.updatedAt = new Date();

      await this.firestoreService.update(
        this.COLLECTION_PATH,
        budgetId,
        updates
      );

      console.log('Presupuesto actualizado:', budgetId);
    } catch (error) {
      console.error('Error al actualizar presupuesto:', error);
      throw error;
    }
  }

  /**
   * Actualiza solo el monto gastado de un presupuesto
   */
  private async updateBudgetSpent(budgetId: string, spent: number): Promise<void> {
    try {
      await this.firestoreService.update(
        this.COLLECTION_PATH,
        budgetId,
        { spent }
      );
    } catch (error) {
      console.error('Error al actualizar gasto:', error);
      throw error;
    }
  }

  /**
   * Elimina un presupuesto
   */
  async deleteBudget(budgetId: string): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      // Verificar que el presupuesto pertenece al usuario
      const existing = await this.getBudgetById(budgetId);
      if (!existing || existing.userId !== userId) {
        throw new Error('No tienes permiso para eliminar este presupuesto');
      }

      await this.firestoreService.delete(this.COLLECTION_PATH, budgetId);

      console.log('Presupuesto eliminado:', budgetId);
    } catch (error) {
      console.error('Error al eliminar presupuesto:', error);
      throw error;
    }
  }

  /**
   * Elimina múltiples presupuestos en batch
   */
  async deleteMultipleBudgets(budgetIds: string[]): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      const operations = budgetIds.map(id => ({
        type: 'delete' as const,
        collectionPath: this.COLLECTION_PATH,
        documentId: id
      }));

      await this.firestoreService.executeBatch(operations);

      console.log(`${budgetIds.length} presupuestos eliminados`);
    } catch (error) {
      console.error('Error al eliminar presupuestos:', error);
      throw error;
    }
  }

  // ========================================
  // MÉTODOS DE LECTURA
  // ========================================

  /**
   * Obtiene un presupuesto por ID
   */
  async getBudgetById(budgetId: string): Promise<BudgetModel | null> {
    try {
      const data = await this.firestoreService.getById<Budget>(
        this.COLLECTION_PATH,
        budgetId
      );

      return data ? BudgetModel.fromFirebase(data) : null;
    } catch (error) {
      console.error('Error al obtener presupuesto:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los presupuestos del usuario (snapshot)
   */
  getAllBudgets(): BudgetModel[] {
    return this.budgetsSubject.value;
  }

  /**
   * Obtiene presupuestos del mes actual
   */
  getCurrentMonthBudgets(): BudgetModel[] {
    return this.budgetsSubject.value.filter(b => b.isCurrentPeriod());
  }

  /**
   * Obtiene presupuestos de un mes específico
   */
  async getBudgetsByMonth(month: number, year: number): Promise<BudgetModel[]> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      const data = await this.firestoreService.getWhere<Budget>(
        this.COLLECTION_PATH,
        where('userId', '==', userId),
        where('month', '==', month),
        where('year', '==', year)
      );

      return data.map(b => BudgetModel.fromFirebase(b));
    } catch (error) {
      console.error('Error al obtener presupuestos del mes:', error);
      throw error;
    }
  }

  /**
   * Obtiene presupuesto de una categoría específica en un mes
   */
  async getBudgetByCategory(
    categoryId: string, 
    month: number, 
    year: number
  ): Promise<BudgetModel | null> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      const data = await this.firestoreService.getWhere<Budget>(
        this.COLLECTION_PATH,
        where('userId', '==', userId),
        where('categoryId', '==', categoryId),
        where('month', '==', month),
        where('year', '==', year)
      );

      return data.length > 0 ? BudgetModel.fromFirebase(data[0]) : null;
    } catch (error) {
      console.error('Error al obtener presupuesto por categoría:', error);
      throw error;
    }
  }

  /**
   * Obtiene presupuestos activos
   */
  getActiveBudgets(): BudgetModel[] {
    return this.budgetsSubject.value.filter(b => b.isActive);
  }

  /**
   * Obtiene presupuestos por estado
   */
  getBudgetsByStatus(status: BudgetStatus): BudgetModel[] {
    return this.budgetsSubject.value.filter(b => b.status === status);
  }

  /**
   * Obtiene presupuestos excedidos
   */
  getExceededBudgets(): BudgetModel[] {
    return this.getBudgetsByStatus(BudgetStatus.EXCEEDED);
  }

  /**
   * Obtiene presupuestos en peligro
   */
  getDangerBudgets(): BudgetModel[] {
    return this.getBudgetsByStatus(BudgetStatus.DANGER);
  }

  /**
   * Obtiene presupuestos que necesitan atención
   */
  getBudgetsNeedingAttention(): BudgetModel[] {
    return BudgetModel.getBudgetsNeedingAttention(this.budgetsSubject.value);
  }

  // ========================================
  // ESTADÍSTICAS Y RESÚMENES
  // ========================================

  /**
   * Calcula el resumen de todos los presupuestos
   */
  getBudgetSummary(): BudgetSummary {
    const budgets = this.budgetsSubject.value;
    return BudgetModel.calculateSummary(budgets);
  }

  /**
   * Calcula el resumen de presupuestos del mes actual
   */
  getCurrentMonthBudgetSummary(): BudgetSummary {
    const budgets = this.getCurrentMonthBudgets();
    return BudgetModel.calculateSummary(budgets);
  }

  /**
   * Obtiene presupuestos con alertas activas
   */
  getBudgetsWithAlerts(): BudgetModel[] {
    return this.budgetsSubject.value.filter(b => b.shouldAlert());
  }

  /**
   * Obtiene mensajes de alerta de presupuestos
   */
  getAlertMessages(): string[] {
    return this.getBudgetsWithAlerts()
      .map(b => b.getAlertMessage())
      .filter(msg => msg !== '');
  }

  // ========================================
  // OPERACIONES ESPECIALES
  // ========================================

  /**
   * Crea presupuestos para el próximo mes basados en los actuales
   */
  async cloneBudgetsToNextMonth(): Promise<void> {
    const currentBudgets = this.getCurrentMonthBudgets();
    
    if (currentBudgets.length === 0) {
      throw new Error('No hay presupuestos en el mes actual para clonar');
    }

    try {
      const nextMonthBudgets = currentBudgets.map(budget => 
        budget.cloneForNextMonth()
      );

      const operations = nextMonthBudgets.map(budget => ({
        type: 'set' as const,
        collectionPath: this.COLLECTION_PATH,
        documentId: budget.id,
        data: budget.toJSON()
      }));

      await this.firestoreService.executeBatch(operations);

      console.log(`${nextMonthBudgets.length} presupuestos clonados al próximo mes`);
    } catch (error) {
      console.error('Error al clonar presupuestos:', error);
      throw error;
    }
  }

  /**
   * Crea presupuestos automáticos basados en gastos del mes anterior
   */
  async createAutoBudgets(multiplier: number = 1.0): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      // Obtener transacciones del mes anterior
      const now = new Date();
      const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      const lastMonthTransactions = await this.transactionService.getTransactionsByMonth(
        lastMonth,
        lastYear
      );

      // Calcular gastos por categoría
      const expensesByCategory = lastMonthTransactions
        .filter(t => t.type === CategoryType.EXPENSE)
        .reduce((acc, t) => {
          if (!acc[t.categoryId]) {
            acc[t.categoryId] = {
              total: 0,
              name: t.categoryName,
              icon: t.categoryIcon,
              color: t.categoryColor
            };
          }
          acc[t.categoryId].total += t.amount;
          return acc;
        }, {} as { [key: string]: { total: number; name?: string; icon?: string; color?: string } });

      // Crear presupuestos para el mes actual
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const budgets: BudgetModel[] = [];
      for (const [categoryId, data] of Object.entries(expensesByCategory)) {
        // Verificar si ya existe presupuesto para esta categoría
        const existing = await this.getBudgetByCategory(
          categoryId,
          currentMonth,
          currentYear
        );

        if (!existing) {
          const budget = new BudgetModel({
            userId,
            categoryId,
            categoryName: data.name,
            categoryIcon: data.icon,
            categoryColor: data.color,
            amount: Math.round(data.total * multiplier),
            currency: 'MXN',
            period: BudgetPeriod.MONTHLY,
            month: currentMonth,
            year: currentYear,
            spent: 0
          });

          budgets.push(budget);
        }
      }

      // Guardar presupuestos
      const operations = budgets.map(budget => ({
        type: 'set' as const,
        collectionPath: this.COLLECTION_PATH,
        documentId: budget.id,
        data: budget.toJSON()
      }));

      if (operations.length > 0) {
        await this.firestoreService.executeBatch(operations);
        console.log(`${budgets.length} presupuestos automáticos creados`);
      }

    } catch (error) {
      console.error('Error al crear presupuestos automáticos:', error);
      throw error;
    }
  }

  // ========================================
  // OBSERVABLES PERSONALIZADOS
  // ========================================

  /**
   * Observable de presupuestos del mes actual
   */
  getCurrentMonthBudgets$(): Observable<BudgetModel[]> {
    return this.budgets$.pipe(
      map(budgets => budgets.filter(b => b.isCurrentPeriod()))
    );
  }

  /**
   * Observable de resumen del mes actual
   */
  getCurrentMonthBudgetSummary$(): Observable<BudgetSummary> {
    return this.getCurrentMonthBudgets$().pipe(
      map(budgets => BudgetModel.calculateSummary(budgets))
    );
  }

  /**
   * Observable de presupuestos con alertas
   */
  getBudgetsWithAlerts$(): Observable<BudgetModel[]> {
    return this.budgets$.pipe(
      map(budgets => budgets.filter(b => b.shouldAlert()))
    );
  }

  /**
   * Observable de presupuestos por estado
   */
  getBudgetsByStatus$(status: BudgetStatus): Observable<BudgetModel[]> {
    return this.budgets$.pipe(
      map(budgets => budgets.filter(b => b.status === status))
    );
  }

  // ========================================
  // MÉTODOS AUXILIARES
  // ========================================

  /**
   * Verifica si hay presupuestos
   */
  hasBudgets(): boolean {
    return this.budgetsSubject.value.length > 0;
  }

  /**
   * Obtiene la cantidad total de presupuestos
   */
  getBudgetCount(): number {
    return this.budgetsSubject.value.length;
  }

  /**
   * Verifica si hay presupuestos para el mes actual
   */
  hasCurrentMonthBudgets(): boolean {
    return this.getCurrentMonthBudgets().length > 0;
  }

  /**
   * Recarga los presupuestos (forzar actualización)
   */
  async reloadBudgets(): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    this.loadingSubject.next(true);

    try {
      const data = await this.firestoreService.getWhere<Budget>(
        this.COLLECTION_PATH,
        where('userId', '==', userId),
        orderBy('year', 'desc'),
        orderBy('month', 'desc')
      );

      const budgets = data.map(b => BudgetModel.fromFirebase(b));
      this.budgetsSubject.next(budgets);
    } catch (error) {
      console.error('Error al recargar presupuestos:', error);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Limpia el cache de presupuestos
   */
  clearCache(): void {
    this.budgetsSubject.next([]);
  }
}