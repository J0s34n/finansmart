import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { where, orderBy, limit } from '@angular/fire/firestore';
import { FirestoreService } from './firestore.service';
import { AuthService } from './auth.service';
import { 
  TransactionModel, 
  Transaction, 
  TransactionFilters, 
  TransactionStats,
  CategoryType 
} from '@app/models';

/**
 * Servicio para gestionar transacciones (ingresos y gastos)
 * Maneja CRUD, filtros, estadísticas y sincronización
 */
@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private readonly COLLECTION_PATH = 'transactions';

  // Cache local de transacciones
  private transactionsSubject = new BehaviorSubject<TransactionModel[]>([]);
  public transactions$ = this.transactionsSubject.asObservable();

  // Estado de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    private firestoreService: FirestoreService,
    private authService: AuthService
  ) {
    this.initTransactionsListener();
  }

  // ========================================
  // INICIALIZACIÓN Y LISTENERS
  // ========================================

  /**
   * Inicializa el listener de transacciones del usuario actual
   */
  private initTransactionsListener(): void {
    this.authService.currentUser$.pipe(
      switchMap(user => {
        if (user) {
          // Usuario autenticado, escuchar sus transacciones
          return this.firestoreService.watchQuery<Transaction>(
            this.COLLECTION_PATH,
            where('userId', '==', user.uid),
            orderBy('date', 'desc')
          );
        } else {
          // No hay usuario, retornar array vacío
          return new Observable<Transaction[]>(observer => {
            observer.next([]);
          });
        }
      }),
      map(transactions => 
        transactions.map(t => TransactionModel.fromFirebase(t))
      )
    ).subscribe(transactions => {
      this.transactionsSubject.next(transactions);
      this.loadingSubject.next(false);
    });
  }

  // ========================================
  // MÉTODOS DE ESCRITURA (CRUD)
  // ========================================

  /**
   * Agrega una nueva transacción
   */
  async addTransaction(transaction: TransactionModel): Promise<string> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    // Asegurar que el userId esté correcto
    transaction.userId = userId;
    transaction.createdAt = new Date();
    transaction.updatedAt = new Date();

    // Validar transacción
    if (!transaction.isValid()) {
      throw new Error('Transacción inválida. Verifica los campos requeridos.');
    }

    try {
      const docId = await this.firestoreService.add(
        this.COLLECTION_PATH,
        transaction.toJSON()
      );

      console.log('Transacción agregada:', docId);
      return docId;
    } catch (error) {
      console.error('Error al agregar transacción:', error);
      throw error;
    }
  }

  /**
   * Actualiza una transacción existente
   */
  async updateTransaction(
    transactionId: string, 
    updates: Partial<TransactionModel>
  ): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      // Verificar que la transacción pertenece al usuario
      const existing = await this.getTransactionById(transactionId);
      if (!existing || existing.userId !== userId) {
        throw new Error('No tienes permiso para modificar esta transacción');
      }

      updates.updatedAt = new Date();

      await this.firestoreService.update(
        this.COLLECTION_PATH,
        transactionId,
        updates
      );

      console.log('Transacción actualizada:', transactionId);
    } catch (error) {
      console.error('Error al actualizar transacción:', error);
      throw error;
    }
  }

  /**
   * Elimina una transacción
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      // Verificar que la transacción pertenece al usuario
      const existing = await this.getTransactionById(transactionId);
      if (!existing || existing.userId !== userId) {
        throw new Error('No tienes permiso para eliminar esta transacción');
      }

      await this.firestoreService.delete(this.COLLECTION_PATH, transactionId);

      console.log('Transacción eliminada:', transactionId);
    } catch (error) {
      console.error('Error al eliminar transacción:', error);
      throw error;
    }
  }

  /**
   * Elimina múltiples transacciones en batch
   */
  async deleteMultipleTransactions(transactionIds: string[]): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      const operations = transactionIds.map(id => ({
        type: 'delete' as const,
        collectionPath: this.COLLECTION_PATH,
        documentId: id
      }));

      await this.firestoreService.executeBatch(operations);

      console.log(`${transactionIds.length} transacciones eliminadas`);
    } catch (error) {
      console.error('Error al eliminar transacciones:', error);
      throw error;
    }
  }

  // ========================================
  // MÉTODOS DE LECTURA
  // ========================================

  /**
   * Obtiene una transacción por ID
   */
  async getTransactionById(transactionId: string): Promise<TransactionModel | null> {
    try {
      const data = await this.firestoreService.getById<Transaction>(
        this.COLLECTION_PATH,
        transactionId
      );

      return data ? TransactionModel.fromFirebase(data) : null;
    } catch (error) {
      console.error('Error al obtener transacción:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las transacciones del usuario actual (snapshot)
   */
  getAllTransactions(): TransactionModel[] {
    return this.transactionsSubject.value;
  }

  /**
   * Obtiene transacciones del mes actual
   */
  getCurrentMonthTransactions(): TransactionModel[] {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    return this.transactionsSubject.value.filter(t => 
      t.date >= startOfMonth && t.date <= endOfMonth
    );
  }

  /**
   * Obtiene transacciones de un mes específico
   */
  async getTransactionsByMonth(month: number, year: number): Promise<TransactionModel[]> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    try {
      const data = await this.firestoreService.getWhere<Transaction>(
        this.COLLECTION_PATH,
        where('userId', '==', userId),
        where('date', '>=', startDate.toISOString()),
        where('date', '<=', endDate.toISOString()),
        orderBy('date', 'desc')
      );

      return data.map(t => TransactionModel.fromFirebase(t));
    } catch (error) {
      console.error('Error al obtener transacciones del mes:', error);
      throw error;
    }
  }

  /**
   * Obtiene transacciones por categoría
   */
  async getTransactionsByCategory(categoryId: string): Promise<TransactionModel[]> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      const data = await this.firestoreService.getWhere<Transaction>(
        this.COLLECTION_PATH,
        where('userId', '==', userId),
        where('categoryId', '==', categoryId),
        orderBy('date', 'desc')
      );

      return data.map(t => TransactionModel.fromFirebase(t));
    } catch (error) {
      console.error('Error al obtener transacciones por categoría:', error);
      throw error;
    }
  }

  /**
   * Obtiene las últimas N transacciones
   */
  async getRecentTransactions(limitCount: number = 10): Promise<TransactionModel[]> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('Usuario no autenticado');
    }

    try {
      const data = await this.firestoreService.getWhere<Transaction>(
        this.COLLECTION_PATH,
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(limitCount)
      );

      return data.map(t => TransactionModel.fromFirebase(t));
    } catch (error) {
      console.error('Error al obtener transacciones recientes:', error);
      throw error;
    }
  }

  /**
   * Obtiene transacciones por tipo (ingreso o gasto)
   */
  getTransactionsByType(type: CategoryType): TransactionModel[] {
    return this.transactionsSubject.value.filter(t => t.type === type);
  }

  /**
   * Obtiene transacciones de hoy
   */
  getTodayTransactions(): TransactionModel[] {
    return this.transactionsSubject.value.filter(t => t.isToday());
  }

  /**
   * Obtiene transacciones del mes actual
   */
  getThisMonthTransactions(): TransactionModel[] {
    return this.transactionsSubject.value.filter(t => t.isThisMonth());
  }

  // ========================================
  // FILTROS Y BÚSQUEDA
  // ========================================

  /**
   * Filtra transacciones según criterios
   */
  filterTransactions(filters: TransactionFilters): TransactionModel[] {
    const allTransactions = this.transactionsSubject.value;
    return TransactionModel.filterTransactions(allTransactions, filters);
  }

  /**
   * Busca transacciones por texto
   */
  searchTransactions(searchText: string): TransactionModel[] {
    return this.filterTransactions({ searchText });
  }

  /**
   * Obtiene transacciones en un rango de fechas
   */
  getTransactionsByDateRange(startDate: Date, endDate: Date): TransactionModel[] {
    return this.transactionsSubject.value.filter(t => 
      t.date >= startDate && t.date <= endDate
    );
  }

  // ========================================
  // ESTADÍSTICAS
  // ========================================

  /**
   * Calcula estadísticas de todas las transacciones
   */
  getStats(): TransactionStats {
    const transactions = this.transactionsSubject.value;
    return TransactionModel.calculateStats(transactions);
  }

  /**
   * Calcula estadísticas del mes actual
   */
  getCurrentMonthStats(): TransactionStats {
    const transactions = this.getCurrentMonthTransactions();
    return TransactionModel.calculateStats(transactions);
  }

  /**
   * Calcula estadísticas de un mes específico
   */
  async getMonthStats(month: number, year: number): Promise<TransactionStats> {
    const transactions = await this.getTransactionsByMonth(month, year);
    return TransactionModel.calculateStats(transactions);
  }

  /**
   * Obtiene el balance actual (ingresos - gastos del mes)
   */
  getCurrentBalance(): number {
    const stats = this.getCurrentMonthStats();
    return stats.balance;
  }

  /**
   * Obtiene total de ingresos del mes actual
   */
  getCurrentMonthIncome(): number {
    const stats = this.getCurrentMonthStats();
    return stats.totalIncome;
  }

  /**
   * Obtiene total de gastos del mes actual
   */
  getCurrentMonthExpenses(): number {
    const stats = this.getCurrentMonthStats();
    return stats.totalExpense;
  }

  /**
   * Obtiene gastos agrupados por categoría (mes actual)
   */
  getExpensesByCategory(): { [categoryId: string]: number } {
    const stats = this.getCurrentMonthStats();
    return stats.expensesByCategory;
  }

  // ========================================
  // OBSERVABLES PERSONALIZADOS
  // ========================================

  /**
   * Observable de transacciones del mes actual
   */
  getCurrentMonthTransactions$(): Observable<TransactionModel[]> {
    return this.transactions$.pipe(
      map(transactions => transactions.filter(t => t.isThisMonth()))
    );
  }

  /**
   * Observable de estadísticas del mes actual
   */
  getCurrentMonthStats$(): Observable<TransactionStats> {
    return this.getCurrentMonthTransactions$().pipe(
      map(transactions => TransactionModel.calculateStats(transactions))
    );
  }

  /**
   * Observable de balance actual
   */
  getCurrentBalance$(): Observable<number> {
    return this.getCurrentMonthStats$().pipe(
      map(stats => stats.balance)
    );
  }

  /**
   * Observable de transacciones por tipo
   */
  getTransactionsByType$(type: CategoryType): Observable<TransactionModel[]> {
    return this.transactions$.pipe(
      map(transactions => transactions.filter(t => t.type === type))
    );
  }

  // ========================================
  // MÉTODOS AUXILIARES
  // ========================================

  /**
   * Verifica si hay transacciones
   */
  hasTransactions(): boolean {
    return this.transactionsSubject.value.length > 0;
  }

  /**
   * Obtiene la cantidad total de transacciones
   */
  getTransactionCount(): number {
    return this.transactionsSubject.value.length;
  }

  /**
   * Obtiene la transacción más reciente
   */
  getLatestTransaction(): TransactionModel | null {
    const transactions = this.transactionsSubject.value;
    return transactions.length > 0 ? transactions[0] : null;
  }

  /**
   * Obtiene el gasto más grande del mes
   */
  getLargestExpenseThisMonth(): TransactionModel | null {
    const expenses = this.getCurrentMonthTransactions()
      .filter(t => t.type === CategoryType.EXPENSE)
      .sort((a, b) => b.amount - a.amount);

    return expenses.length > 0 ? expenses[0] : null;
  }

  /**
   * Recarga las transacciones (forzar actualización)
   */
  async reloadTransactions(): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) return;

    this.loadingSubject.next(true);

    try {
      const data = await this.firestoreService.getWhere<Transaction>(
        this.COLLECTION_PATH,
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );

      const transactions = data.map(t => TransactionModel.fromFirebase(t));
      this.transactionsSubject.next(transactions);
    } catch (error) {
      console.error('Error al recargar transacciones:', error);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Limpia el cache de transacciones
   */
  clearCache(): void {
    this.transactionsSubject.next([]);
  }
}