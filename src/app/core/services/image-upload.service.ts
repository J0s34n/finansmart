import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Respuesta de la API de ImgBB
 */
interface ImgBBResponse {
  data: {
    id: string;
    url: string;
    display_url: string;
    size: number;
    time: string;
    delete_url: string;
    thumb?: {
      url: string;
    };
  };
  success: boolean;
  status: number;
}

/**
 * Resultado simplificado de la subida
 */
export interface UploadResult {
  url: string;
  thumbnailUrl?: string;
  deleteUrl: string;
  size: number;
}

/**
 * Servicio para subir imágenes a ImgBB
 * Maneja la carga de recibos y comprobantes de transacciones
 */
@Injectable({
  providedIn: 'root'
})
export class ImageUploadService {
  private readonly API_URL = 'https://api.imgbb.com/1/upload';
  private readonly MAX_SIZE = 32 * 1024 * 1024; // 32MB en bytes
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  constructor(private http: HttpClient) {}

  /**
   * Sube una imagen a ImgBB
   * @param file Archivo de imagen a subir
   * @param name Nombre opcional para la imagen
   * @returns Observable con el resultado de la subida
   */
  uploadImage(file: File, name?: string): Observable<UploadResult> {
    // Validar archivo
    const validation = this.validateFile(file);
    if (!validation.valid) {
      return throwError(() => new Error(validation.error));
    }

    // Convertir archivo a base64
    return from(this.fileToBase64(file)).pipe(
      map(base64 => {
        // Crear FormData
        const formData = new FormData();
        formData.append('key', environment.imgbbApiKey);
        formData.append('image', base64.split(',')[1]); // Remover prefijo data:image
        
        if (name) {
          formData.append('name', name);
        }

        return formData;
      }),
      // Hacer request HTTP y aplanar el observable
      switchMap((formData: FormData) =>
        this.http.post<ImgBBResponse>(this.API_URL, formData).pipe(
          map(response => this.mapResponse(response)),
          catchError(error => this.handleError(error))
        )
      )
    );
  }

  /**
   * Versión alternativa usando async/await (más simple)
   * @param file Archivo de imagen
   * @param name Nombre opcional
   */
  async uploadImageAsync(file: File, name?: string): Promise<UploadResult> {
    // Validar archivo
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    try {
      // Convertir a base64
      const base64 = await this.fileToBase64(file);
      
      // Crear FormData
      const formData = new FormData();
      formData.append('key', environment.imgbbApiKey);
      formData.append('image', base64.split(',')[1]); // Remover prefijo
      
      if (name) {
        formData.append('name', name);
      }

      // Hacer request
      const response = await this.http.post<ImgBBResponse>(
        this.API_URL,
        formData
      ).toPromise();

      return this.mapResponse(response!);
    } catch (error) {
      throw this.handleErrorSync(error);
    }
  }

  /**
   * Sube una imagen desde base64
   * @param base64String String en base64 (con o sin prefijo data:image)
   * @param name Nombre opcional
   */
  async uploadBase64(base64String: string, name?: string): Promise<UploadResult> {
    try {
      // Limpiar base64 (remover prefijo si existe)
      const cleanBase64 = base64String.includes(',') 
        ? base64String.split(',')[1] 
        : base64String;

      // Crear FormData
      const formData = new FormData();
      formData.append('key', environment.imgbbApiKey);
      formData.append('image', cleanBase64);
      
      if (name) {
        formData.append('name', name);
      }

      // Hacer request
      const response = await this.http.post<ImgBBResponse>(
        this.API_URL,
        formData
      ).toPromise();

      return this.mapResponse(response!);
    } catch (error) {
      throw this.handleErrorSync(error);
    }
  }

  /**
   * Comprime una imagen antes de subirla
   * @param file Archivo original
   * @param quality Calidad de compresión (0-1)
   * @returns Promise con archivo comprimido
   */
  async compressImage(file: File, quality: number = 0.7): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e: any) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Redimensionar si es muy grande (máx 1920px)
          const maxDimension = 1920;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Error al comprimir imagen'));
              }
            },
            'image/jpeg',
            quality
          );
        };

        img.onerror = () => reject(new Error('Error al cargar imagen'));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error('Error al leer archivo'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Valida un archivo antes de subir
   */
  private validateFile(file: File): { valid: boolean; error?: string } {
    // Verificar que existe
    if (!file) {
      return { valid: false, error: 'No se proporcionó ningún archivo' };
    }

    // Verificar tipo de archivo
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return { 
        valid: false, 
        error: `Tipo de archivo no permitido. Use: ${this.ALLOWED_TYPES.join(', ')}` 
      };
    }

    // Verificar tamaño
    if (file.size > this.MAX_SIZE) {
      const maxSizeMB = this.MAX_SIZE / (1024 * 1024);
      return { 
        valid: false, 
        error: `El archivo es demasiado grande. Máximo: ${maxSizeMB}MB` 
      };
    }

    return { valid: true };
  }

  /**
   * Convierte un File a base64
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Mapea la respuesta de ImgBB a nuestro formato
   */
  private mapResponse(response: ImgBBResponse): UploadResult {
    if (!response.success) {
      throw new Error('Error al subir imagen a ImgBB');
    }

    return {
      url: response.data.display_url,
      thumbnailUrl: response.data.thumb?.url,
      deleteUrl: response.data.delete_url,
      size: response.data.size
    };
  }

  /**
   * Maneja errores de las peticiones HTTP
   */
  private handleError(error: any): Observable<never> {
    console.error('Error al subir imagen:', error);
    
    let errorMessage = 'Error al subir la imagen';
    
    if (error.error?.error?.message) {
      errorMessage = error.error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => new Error(errorMessage));
  }

  /**
   * Maneja errores de forma síncrona
   */
  private handleErrorSync(error: any): Error {
    console.error('Error al subir imagen:', error);
    
    let errorMessage = 'Error al subir la imagen';
    
    if (error.error?.error?.message) {
      errorMessage = error.error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return new Error(errorMessage);
  }

  /**
   * Obtiene el tamaño formateado de un archivo
   */
  getFormattedSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Verifica si ImgBB está configurado correctamente
   */
  isConfigured(): boolean {
    return !!environment.imgbbApiKey && environment.imgbbApiKey !== 'TU_IMGBB_API_KEY_AQUI';
  }
}