import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
  onSnapshot,
  Unsubscribe,
  writeBatch,
  CollectionReference,
  DocumentReference,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

/**
 * Servicio base para operaciones con Firestore
 * Proporciona métodos genéricos para CRUD
 */
@Injectable({
  providedIn: 'root'
})
export class FirestoreService {

  constructor(private firestore: Firestore) {}

  // ========================================
  // MÉTODOS DE ESCRITURA
  // ========================================

  /**
   * Agrega un nuevo documento con ID autogenerado
   */
  async add<T>(collectionPath: string, data: T): Promise<string> {
    try {
      const colRef = collection(this.firestore, collectionPath);
      const docRef = await addDoc(colRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error(`Error al agregar documento en ${collectionPath}:`, error);
      throw error;
    }
  }

  /**
   * Crea o actualiza un documento con ID específico
   */
  async set<T>(collectionPath: string, documentId: string, data: T): Promise<void> {
    try {
      const docRef = doc(this.firestore, collectionPath, documentId);
      await setDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(`Error al crear documento ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Actualiza campos específicos de un documento
   */
  async update<T>(collectionPath: string, documentId: string, data: Partial<T>): Promise<void> {
    try {
      const docRef = doc(this.firestore, collectionPath, documentId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error(`Error al actualizar documento ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Elimina un documento
   */
  async delete(collectionPath: string, documentId: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, collectionPath, documentId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error al eliminar documento ${documentId}:`, error);
      throw error;
    }
  }

  // ========================================
  // MÉTODOS DE LECTURA
  // ========================================

  /**
   * Obtiene un documento por ID
   */
  async getById<T>(collectionPath: string, documentId: string): Promise<T | null> {
    try {
      const docRef = doc(this.firestore, collectionPath, documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      console.error(`Error al obtener documento ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene todos los documentos de una colección
   */
  async getAll<T>(collectionPath: string): Promise<T[]> {
    try {
      const colRef = collection(this.firestore, collectionPath);
      const snapshot = await getDocs(colRef);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    } catch (error) {
      console.error(`Error al obtener documentos de ${collectionPath}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene documentos con filtros personalizados
   */
  async getWhere<T>(
    collectionPath: string,
    ...queryConstraints: QueryConstraint[]
  ): Promise<T[]> {
    try {
      const colRef = collection(this.firestore, collectionPath);
      const q = query(colRef, ...queryConstraints);
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    } catch (error) {
      console.error(`Error en query de ${collectionPath}:`, error);
      throw error;
    }
  }

  // ========================================
  // MÉTODOS EN TIEMPO REAL (OBSERVABLES)
  // ========================================

  /**
   * Observa cambios en un documento específico
   */
  watchDocument<T>(collectionPath: string, documentId: string): Observable<T | null> {
    return new Observable(observer => {
      const docRef = doc(this.firestore, collectionPath, documentId);
      
      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            observer.next({ id: snapshot.id, ...snapshot.data() } as T);
          } else {
            observer.next(null);
          }
        },
        (error) => {
          console.error(`Error en snapshot de ${documentId}:`, error);
          observer.error(error);
        }
      );

      // Cleanup
      return () => unsubscribe();
    });
  }

  /**
   * Observa cambios en una colección completa
   */
  watchCollection<T>(collectionPath: string): Observable<T[]> {
    return new Observable(observer => {
      const colRef = collection(this.firestore, collectionPath);
      
      const unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as T[];
          observer.next(data);
        },
        (error) => {
          console.error(`Error en snapshot de ${collectionPath}:`, error);
          observer.error(error);
        }
      );

      // Cleanup
      return () => unsubscribe();
    });
  }

  /**
   * Observa cambios en una colección con filtros
   */
  watchQuery<T>(
    collectionPath: string,
    ...queryConstraints: QueryConstraint[]
  ): Observable<T[]> {
    return new Observable(observer => {
      const colRef = collection(this.firestore, collectionPath);
      const q = query(colRef, ...queryConstraints);
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as T[];
          observer.next(data);
        },
        (error) => {
          console.error(`Error en query snapshot de ${collectionPath}:`, error);
          observer.error(error);
        }
      );

      // Cleanup
      return () => unsubscribe();
    });
  }

  // ========================================
  // OPERACIONES BATCH (TRANSACCIONALES)
  // ========================================

  /**
   * Ejecuta múltiples operaciones en una transacción
   * Máximo 500 operaciones por batch
   */
  async executeBatch(operations: Array<{
    type: 'set' | 'update' | 'delete';
    collectionPath: string;
    documentId: string;
    data?: any;
  }>): Promise<void> {
    try {
      const batch = writeBatch(this.firestore);

      operations.forEach(op => {
        const docRef = doc(this.firestore, op.collectionPath, op.documentId);

        switch (op.type) {
          case 'set':
            batch.set(docRef, {
              ...op.data,
              updatedAt: serverTimestamp()
            });
            break;
          case 'update':
            batch.update(docRef, {
              ...op.data,
              updatedAt: serverTimestamp()
            });
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      });

      await batch.commit();
    } catch (error) {
      console.error('Error en operación batch:', error);
      throw error;
    }
  }

  // ========================================
  // MÉTODOS AUXILIARES
  // ========================================

  /**
   * Verifica si un documento existe
   */
  async exists(collectionPath: string, documentId: string): Promise<boolean> {
    try {
      const docRef = doc(this.firestore, collectionPath, documentId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error(`Error al verificar existencia de ${documentId}:`, error);
      return false;
    }
  }

  /**
   * Cuenta documentos en una colección (aproximado)
   * Nota: Firestore no tiene count nativo eficiente
   */
  async count(collectionPath: string, ...queryConstraints: QueryConstraint[]): Promise<number> {
    try {
      const colRef = collection(this.firestore, collectionPath);
      const q = queryConstraints.length > 0 
        ? query(colRef, ...queryConstraints) 
        : colRef;
      
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error(`Error al contar documentos de ${collectionPath}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene referencia a una colección
   */
  getCollectionRef(collectionPath: string): CollectionReference {
    return collection(this.firestore, collectionPath);
  }

  /**
   * Obtiene referencia a un documento
   */
  getDocRef(collectionPath: string, documentId: string): DocumentReference {
    return doc(this.firestore, collectionPath, documentId);
  }

  /**
   * Genera un ID único para un documento
   */
  generateId(collectionPath: string): string {
    const colRef = collection(this.firestore, collectionPath);
    return doc(colRef).id;
  }

  // ========================================
  // AYUDANTES PARA QUERIES
  // ========================================

  /**
   * Crea un constraint WHERE
   */
  createWhereConstraint(field: string, operator: any, value: any): QueryConstraint {
    return where(field, operator, value);
  }

  /**
   * Crea un constraint ORDER BY
   */
  createOrderByConstraint(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
    return orderBy(field, direction);
  }

  /**
   * Crea un constraint LIMIT
   */
  createLimitConstraint(limitCount: number): QueryConstraint {
    return limit(limitCount);
  }
}