import { Injectable } from '@angular/core';
import { 
  Firestore, 
  doc, 
  docData, 
  collection, 
  collectionData, 
  query, 
  where, 
  QueryConstraint, 
  DocumentData,
  writeBatch,
  WriteBatch,
  getDoc
} from '@angular/fire/firestore';
import { Observable, firstValueFrom } from 'rxjs';

/**
 * Tipo para operaciones en batch
 */
export interface BatchOperation {
  type: 'set' | 'update' | 'delete';
  collectionPath: string;
  documentId: string;
  data?: any;
}

/**
 * Servicio centralizado para operaciones en Firestore.
 * - Usa exclusivamente helpers re-exportados por `@angular/fire/firestore`.
 * - Manejo consistente de errores y tipado.
 */
@Injectable({ providedIn: 'root' })
export class FirestoreService {
  constructor(private firestore: Firestore) {}

  /**
   * Obtiene un documento por ID como promesa (devuelve null si no existe)
   */
  async getById<T = any>(collectionPath: string, documentId: string): Promise<T | null> {
    try {
      const ref = doc(this.firestore, `${collectionPath}/${documentId}`);
      const data = await firstValueFrom(docData(ref, { idField: 'id' }));
      return (data ?? null) as T | null;
    } catch (error) {
      console.error(`[FirestoreService] getById failed: ${collectionPath}/${documentId}`, error);
      return null;
    }
  }

  /**
   * Obtiene todos los documentos de una colección (snapshot único como promesa)
   */
  async getAll<T = any>(collectionPath: string): Promise<T[]> {
    try {
      const colRef = collection(this.firestore, collectionPath);
      const data = await firstValueFrom(collectionData(colRef, { idField: 'id' }));
      return (data ?? []) as T[];
    } catch (error) {
      console.error(`[FirestoreService] getAll failed: ${collectionPath}`, error);
      return [];
    }
  }

  /**
   * Obtiene documentos con filtros (QueryConstraints). Devuelve snapshot único.
   */
  async getWhere<T = any>(collectionPath: string, ...queryConstraints: QueryConstraint[]): Promise<T[]> {
    try {
      const colRef = collection(this.firestore, collectionPath);
      const q = query(colRef, ...queryConstraints);
      const data = await firstValueFrom(collectionData(q as any, { idField: 'id' }));
      return (data ?? []) as T[];
    } catch (error) {
      console.error(`[FirestoreService] getWhere failed: ${collectionPath}`, error);
      return [];
    }
  }

  /**
   * Escucha cambios en tiempo real de documentos con filtros (Observable)
   * IMPORTANTE: Devuelve un Observable que continúa escuchando cambios
   */
  watchQuery<T extends { id?: string } = any>(collectionPath: string, ...queryConstraints: QueryConstraint[]): Observable<T[]> {
    try {
      const colRef = collection(this.firestore, collectionPath);
      const q = query(colRef, ...queryConstraints);
      return collectionData(q as any, { idField: 'id' }) as Observable<T[]>;
    } catch (error) {
      console.error(`[FirestoreService] watchQuery failed: ${collectionPath}`, error);
      throw error;
    }
  }

  /**
   * Verifica si un documento existe
   */
  async exists(collectionPath: string, documentId: string): Promise<boolean> {
    try {
      const ref = doc(this.firestore, `${collectionPath}/${documentId}`);
      const docSnapshot = await getDoc(ref as any);
      return docSnapshot.exists();
    } catch (error) {
      console.error(`[FirestoreService] exists failed: ${collectionPath}/${documentId}`, error);
      return false;
    }
  }

  /**
   * Agrega un documento a la colección y devuelve el id generado.
   * Si quieres usar un ID personalizado usa `setWithId`.
   */
  async add<T = any>(collectionPath: string, data: T): Promise<string> {
    try {
      const colRef = collection(this.firestore, collectionPath);
      const { addDoc } = await import('@angular/fire/firestore');
      const docRef = await addDoc(colRef as any, this._normalizeData(data));
      return docRef.id;
    } catch (error) {
      console.error(`[FirestoreService] add failed: ${collectionPath}`, error);
      throw error;
    }
  }

  /**
   * Crea/actualiza un documento con un ID específico (set)
   */
  async setWithId<T = any>(collectionPath: string, documentId: string, data: T, merge = false): Promise<void> {
    try {
      const docRef = doc(this.firestore, `${collectionPath}/${documentId}`);
      const { setDoc } = await import('@angular/fire/firestore');
      await setDoc(docRef as any, this._normalizeData(data), { merge });
    } catch (error) {
      console.error(`[FirestoreService] setWithId failed: ${collectionPath}/${documentId}`, error);
      throw error;
    }
  }

  /**
   * Actualiza campos de un documento (merge)
   */
  async update<T = any>(collectionPath: string, documentId: string, partial: Partial<T>): Promise<void> {
    try {
      const docRef = doc(this.firestore, `${collectionPath}/${documentId}`);
      const { updateDoc } = await import('@angular/fire/firestore');
      await updateDoc(docRef as any, this._normalizeData(partial));
    } catch (error) {
      console.error(`[FirestoreService] update failed: ${collectionPath}/${documentId}`, error);
      throw error;
    }
  }

  /**
   * Elimina un documento
   */
  async delete(collectionPath: string, documentId: string): Promise<void> {
    try {
      const docRef = doc(this.firestore, `${collectionPath}/${documentId}`);
      const { deleteDoc } = await import('@angular/fire/firestore');
      await deleteDoc(docRef as any);
    } catch (error) {
      console.error(`[FirestoreService] delete failed: ${collectionPath}/${documentId}`, error);
      throw error;
    }
  }

  /**
   * Ejecuta múltiples operaciones en batch (transacción atomizada)
   * Agrupa set, update y delete en una sola escritura
   */
  async executeBatch(operations: BatchOperation[]): Promise<void> {
    if (operations.length === 0) {
      return;
    }

    try {
      const batch = writeBatch(this.firestore);

      for (const op of operations) {
        const docRef = doc(this.firestore, `${op.collectionPath}/${op.documentId}`);

        if (op.type === 'set') {
          batch.set(docRef as any, this._normalizeData(op.data), { merge: false });
        } else if (op.type === 'update') {
          batch.update(docRef as any, this._normalizeData(op.data));
        } else if (op.type === 'delete') {
          batch.delete(docRef as any);
        }
      }

      await batch.commit();
      console.log(`[FirestoreService] executeBatch completed: ${operations.length} operations`);
    } catch (error) {
      console.error(`[FirestoreService] executeBatch failed:`, error);
      throw error;
    }
  }

  // -------------------------
  // Helpers
  // -------------------------

  /**
   * Normaliza datos para Firestore: elimina "undefined" y convierte Date a ISO
   */
  private _normalizeData<T = any>(obj: T): DocumentData {
    const copy: any = {};
    Object.keys(obj || {}).forEach(key => {
      const v = (obj as any)[key];
      if (v === undefined) return; // omit undefined
      if (v instanceof Date) {
        copy[key] = v; // Firestore SDK acepta Date
      } else {
        copy[key] = v;
      }
    });
    return copy;
  }
}