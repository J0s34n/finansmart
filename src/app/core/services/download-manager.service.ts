import { Injectable } from '@angular/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Servicio para gestionar descargas de archivos
 * Maneja permisos, almacenamiento y compartición en diferentes plataformas
 */
@Injectable({
  providedIn: 'root'
})
export class DownloadManagerService {

  constructor() { }

  /**
   * Verifica si la app tiene permisos de almacenamiento
   */
  async hasStoragePermission(): Promise<boolean> {
    try {
      if (!this.isNativeApp()) {
        return true; // En web siempre se puede descargar
      }

      // En plataformas nativas, verificar permisos
      if (Capacitor.getPlatform() === 'android') {
        return await this.checkAndroidStoragePermission();
      } else if (Capacitor.getPlatform() === 'ios') {
        return await this.checkIOSStoragePermission();
      }

      return true;
    } catch (error) {
      console.error('Error al verificar permisos:', error);
      return false;
    }
  }

  /**
   * Solicita permisos de almacenamiento en Android
   */
  private async checkAndroidStoragePermission(): Promise<boolean> {
    try {
      // Usar el plugin de permisos si está disponible
      if ((window as any).plugins?.permissions) {
        return new Promise((resolve) => {
          (window as any).plugins.permissions.hasPermission(
            (window as any).plugins.permissions.permissions.WRITE_EXTERNAL_STORAGE,
            (hasPermission: boolean) => {
              if (!hasPermission) {
                // Solicitar permiso
                (window as any).plugins.permissions.requestPermission(
                  (window as any).plugins.permissions.permissions.WRITE_EXTERNAL_STORAGE,
                  (status: any) => {
                    resolve(status.hasPermission);
                  }
                );
              } else {
                resolve(true);
              }
            }
          );
        });
      }
      return true;
    } catch (error) {
      console.error('Error al verificar permisos Android:', error);
      return false;
    }
  }

  /**
   * Verifica permisos de almacenamiento en iOS
   */
  private async checkIOSStoragePermission(): Promise<boolean> {
    // iOS maneja permisos de forma diferente
    // Si el usuario necesita acceder a documentos, iOS lo solicita automáticamente
    return true;
  }

  /**
   * Descarga un archivo en el dispositivo
   */
  async downloadFile(
    fileName: string,
    fileData: Blob | string,
    mimeType: string = 'application/octet-stream'
  ): Promise<string> {
    try {
      if (!this.isNativeApp()) {
        // En web, usar descarga estándar
        return this.downloadFileWeb(fileName, fileData, mimeType);
      }

      // En app nativa, usar Filesystem
      return await this.downloadFileNative(fileName, fileData, mimeType);

    } catch (error) {
      console.error('Error al descargar archivo:', error);
      throw error;
    }
  }

  /**
   * Descarga archivo en web (navegador)
   */
  private downloadFileWeb(
    fileName: string,
    fileData: Blob | string,
    mimeType: string
  ): string {
    try {
      // Convertir a Blob si es string
      const blob = typeof fileData === 'string'
        ? new Blob([fileData], { type: mimeType })
        : fileData;

      // Crear URL temporal
      const url = URL.createObjectURL(blob);

      // Crear elemento <a> y simular click
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Liberar URL
      URL.revokeObjectURL(url);

      console.log(`Archivo descargado: ${fileName}`);
      return url;

    } catch (error) {
      console.error('Error al descargar en web:', error);
      throw error;
    }
  }

  /**
   * Descarga archivo en app nativa
   */
  private async downloadFileNative(
    fileName: string,
    fileData: Blob | string,
    mimeType: string
  ): Promise<string> {
    try {
      // Verificar permisos
      const hasPermission = await this.hasStoragePermission();
      if (!hasPermission) {
        throw new Error('Permiso de almacenamiento denegado');
      }

      // Convertir Blob a base64
      let base64Data: string;

      if (fileData instanceof Blob) {
        base64Data = await this.blobToBase64(fileData);
      } else {
        const blob = new Blob([fileData], { type: mimeType });
        base64Data = await this.blobToBase64(blob);
      }

      // Determinar directorio según el tipo de archivo
      // Usar Directory.Documents por compatibilidad (Directory.Downloads no existe en algunas versiones)
      const directory = Directory.Documents;

      // Guardar archivo
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: directory,
        recursive: true
      });

      console.log(`Archivo guardado en: ${result.uri}`);
      return result.uri;

    } catch (error) {
      console.error('Error al descargar en nativo:', error);
      throw error;
    }
  }

  /**
   * Convierte Blob a Base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };

      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Comparte un archivo
   */
  async shareFile(
    fileName: string,
    title: string,
    message: string,
    filePath?: string
  ): Promise<void> {
    try {
      if (!this.isNativeApp()) {
        console.warn('Compartir no disponible en web');
        return;
      }

      const shareOptions: any = {
        title: title,
        text: message,
        dialogTitle: `Compartir ${fileName}`
      };

      // Si hay una ruta de archivo, incluirla
      if (filePath) {
        shareOptions.files = [filePath];
      }

      await Share.share(shareOptions);

    } catch (error) {
      console.error('Error al compartir archivo:', error);
      throw error;
    }
  }

  /**
   * Obtiene la lista de archivos descargados
   */
  async getDownloadedFiles(directory: Directory = Directory.Documents): Promise<any[]> {
    try {
      if (!this.isNativeApp()) {
        console.warn('No disponible en web');
        return [];
      }

      const result = await Filesystem.readdir({
        path: '',
        directory: directory
      });

      return result.files;

    } catch (error) {
      console.error('Error al listar archivos:', error);
      return [];
    }
  }

  /**
   * Elimina un archivo
   */
  async deleteFile(
    fileName: string,
    directory: Directory = Directory.Documents
  ): Promise<void> {
    try {
      if (!this.isNativeApp()) {
        console.warn('No disponible en web');
        return;
      }

      await Filesystem.deleteFile({
        path: fileName,
        directory: directory
      });

      console.log(`Archivo eliminado: ${fileName}`);

    } catch (error) {
      console.error('Error al eliminar archivo:', error);
      throw error;
    }
  }

  /**
   * Abre un archivo
   */
  async openFile(
    fileName: string,
    directory: Directory = Directory.Documents
  ): Promise<void> {
    try {
      if (!this.isNativeApp()) {
        console.warn('No disponible en web');
        return;
      }

      const file = await Filesystem.readFile({
        path: fileName,
        directory: directory
      });

      // Crear blob y abrir
      const blob = new Blob([file.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

    } catch (error) {
      console.error('Error al abrir archivo:', error);
      throw error;
    }
  }

  /**
   * Comprueba si es una app nativa
   */
  private isNativeApp(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Obtiene información del dispositivo
   */
  getPlatform(): string {
    return Capacitor.getPlatform();
  }

  /**
   * Obtiene la ruta de documentos
   */
  async getDocumentsPath(): Promise<string> {
    try {
      if (!this.isNativeApp()) {
        return '/documents';
      }

      const result = await Filesystem.getUri({
        directory: Directory.Documents,
        path: ''
      });

      return result.uri;

    } catch (error) {
      console.error('Error al obtener ruta:', error);
      return '';
    }
  }
}
