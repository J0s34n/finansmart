import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/**
 * Servicio para exportar reportes a PDF
 * Maneja generación, almacenamiento y compartición de PDFs
 * ✅ CORREGIDO: Detecta correctamente web vs mobile
 */
@Injectable({
  providedIn: 'root'
})
export class PdfExportService {

  constructor() { }

  /**
   * Exporta un elemento HTML a PDF y lo descarga
   * @param elementId ID del elemento HTML a exportar
   * @param fileName Nombre del archivo (sin extensión)
   */
  async exportElementToPDF(elementId: string, fileName: string): Promise<void> {
    try {
      const element = document.getElementById(elementId);
      
      if (!element) {
        throw new Error(`Elemento con ID "${elementId}" no encontrado`);
      }

      // Convertir HTML a canvas
      const canvas = await html2canvas(element, {
        allowTaint: true,
        useCORS: true,
        scale: 2,
        backgroundColor: '#FFFFFF'
      });

      // Obtener dimensiones
      const imgWidth = 210; // A4 ancho en mm
      const pageHeight = 297; // A4 alto en mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      // Crear PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;

      // Convertir canvas a imagen
      const imgData = canvas.toDataURL('image/png');

      // Agregar imágenes al PDF (en caso de que sea muy largo)
      while (heightLeft >= 0) {
        if (heightLeft > pageHeight) {
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
          position = heightLeft - imgHeight;
          pdf.addPage();
        } else {
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft = 0;
        }
      }

      // Descargar PDF
      await this.downloadPDF(pdf, fileName);

    } catch (error) {
      console.error('Error al exportar PDF:', error);
      throw error;
    }
  }

  /**
   * Exporta datos a PDF con formato profesional
   * @param data Datos del reporte (titulo, contenido, tablas, etc)
   * @param fileName Nombre del archivo
   */
  async exportReportToPDF(data: {
    title: string;
    subtitle?: string;
    date?: Date;
    sections: ReportSection[];
  }, fileName: string): Promise<void> {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      let yPosition = 20;
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const maxWidth = pageWidth - (2 * margin);

      // Encabezado
      pdf.setFontSize(20);
      pdf.setTextColor(33, 150, 243); // Azul primario
      pdf.text(data.title, margin, yPosition);
      yPosition += 10;

      // Subtítulo
      if (data.subtitle) {
        pdf.setFontSize(12);
        pdf.setTextColor(117, 117, 117); // Gris secundario
        pdf.text(data.subtitle, margin, yPosition);
        yPosition += 8;
      }

      // Fecha
      if (data.date) {
        pdf.setFontSize(10);
        pdf.setTextColor(189, 189, 189); // Gris hint
        const dateStr = data.date.toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        pdf.text(`Generado: ${dateStr}`, margin, yPosition);
        yPosition += 8;
      }

      // Línea divisoria
      pdf.setDrawColor(224, 224, 224);
      yPosition += 2;
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // Processar secciones
      for (const section of data.sections) {
        // Verificar si necesita nueva página
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = margin;
        }

        // Título de sección
        pdf.setFontSize(14);
        pdf.setTextColor(33, 33, 33); // Negro primario
        pdf.setFont('helvetica', 'bold');
        pdf.text(section.title, margin, yPosition);
        yPosition += 8;

        // Contenido según tipo
        if (section.type === 'table' && section.data) {
          yPosition = this.addTableToPDF(pdf, section.data, margin, yPosition, maxWidth);
        } else if (section.type === 'text' && section.content) {
          yPosition = this.addTextToPDF(pdf, section.content, margin, yPosition, maxWidth);
        } else if (section.type === 'kpis' && section.data) {
          yPosition = this.addKPIsToPDF(pdf, section.data, margin, yPosition, maxWidth);
        }

        yPosition += 6;
      }

      // Footer
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(189, 189, 189);
        pdf.text(
          `Página ${i} de ${totalPages}`,
          pageWidth - margin - 20,
          pageHeight - 10
        );
      }

      // Descargar
      await this.downloadPDF(pdf, fileName);

    } catch (error) {
      console.error('Error al exportar reporte:', error);
      throw error;
    }
  }

  /**
   * Agrega una tabla al PDF
   */
  private addTableToPDF(
    pdf: jsPDF,
    data: TableData,
    startX: number,
    startY: number,
    maxWidth: number
  ): number {
    const pageHeight = pdf.internal.pageSize.getHeight();
    const colWidth = maxWidth / data.headers.length;
    let yPosition = startY;

    // Header
    pdf.setFillColor(33, 150, 243);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);

    data.headers.forEach((header, i) => {
      pdf.rect(startX + (i * colWidth), yPosition, colWidth, 8, 'F');
      pdf.text(
        header,
        startX + (i * colWidth) + 2,
        yPosition + 6,
        { maxWidth: colWidth - 4 }
      );
    });

    yPosition += 8;

    // Body
    pdf.setTextColor(33, 33, 33);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);

    data.rows.forEach((row, rowIndex) => {
      // Verificar si necesita nueva página
      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }

      row.forEach((cell, colIndex) => {
        const cellText = String(cell);
        pdf.text(
          cellText,
          startX + (colIndex * colWidth) + 2,
          yPosition + 6,
          { maxWidth: colWidth - 4 }
        );
      });

      // Línea de separación
      pdf.setDrawColor(224, 224, 224);
      pdf.line(startX, yPosition + 8, startX + maxWidth, yPosition + 8);

      yPosition += 8;
    });

    return yPosition;
  }

  /**
   * Agrega KPIs al PDF
   */
  private addKPIsToPDF(
    pdf: jsPDF,
    data: KPIData[],
    startX: number,
    startY: number,
    maxWidth: number
  ): number {
    const pageHeight = pdf.internal.pageSize.getHeight();
    const kpis = Math.min(3, data.length); // Máximo 3 KPIs por fila
    const kpiWidth = maxWidth / kpis;
    let yPosition = startY;

    pdf.setFontSize(9);

    for (let i = 0; i < data.length; i += kpis) {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }

      // Dibuja KPIs en fila
      for (let j = 0; j < kpis && i + j < data.length; j++) {
        const kpi = data[i + j];
        const xPos = startX + (j * kpiWidth);

        // Border
        pdf.setDrawColor(33, 150, 243);
        pdf.rect(xPos, yPosition, kpiWidth - 2, 20);

        // Label
        pdf.setTextColor(117, 117, 117);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.text(kpi.label, xPos + 2, yPosition + 5);

        // Value
        pdf.setTextColor(33, 150, 243);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text(kpi.value, xPos + 2, yPosition + 14);
      }

      yPosition += 24;
    }

    return yPosition;
  }

  /**
   * Agrega texto al PDF
   */
  private addTextToPDF(
    pdf: jsPDF,
    text: string,
    startX: number,
    startY: number,
    maxWidth: number
  ): number {
    pdf.setTextColor(33, 33, 33);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, startX, startY);

    return startY + (lines.length * 6);
  }

  /**
   * Descarga el PDF
   * 🔹 CORREGIDO: Detecta correctamente la plataforma
   */
  private async downloadPDF(pdf: jsPDF, fileName: string): Promise<void> {
    const timestamp = new Date().toISOString().slice(0, 10);
    const fullFileName = `${fileName}_${timestamp}.pdf`;

    // 🔹 Detectar plataforma correctamente
    const isNative = Capacitor.isNativePlatform();

    console.log('🔍 Plataforma detectada:', isNative ? 'Nativa (iOS/Android)' : 'Web');

    // En web, usar descarga directa
    if (!isNative) {
      console.log('📥 Descargando PDF en navegador...');
      pdf.save(fullFileName);
      console.log('✅ PDF descargado:', fullFileName);
      return;
    }

    // En Capacitor (móvil), guardar en sistema de archivos
    try {
      console.log('💾 Guardando PDF en sistema de archivos nativo...');
      
      const pdfData = pdf.output('arraybuffer');
      const blob = new Blob([pdfData], { type: 'application/pdf' });
      const base64 = await this.blobToBase64(blob);

      const result = await Filesystem.writeFile({
        path: fullFileName,
        data: base64,
        directory: Directory.Documents,
        recursive: true
      });

      console.log('✅ PDF guardado en:', result.uri);

    } catch (error) {
      console.error('❌ Error al guardar PDF:', error);
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
   * 🔹 DEPRECADO: Usar Capacitor.isNativePlatform() en su lugar
   * Mantener por compatibilidad pero marcar como deprecado
   */
  private isPlatformCapacitor(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Comparte el PDF
   */
  async sharePDF(fileName: string, message: string): Promise<void> {
    try {
      if (Capacitor.isPluginAvailable('Share')) {
        await Share.share({
          title: 'Compartir Reporte',
          text: message,
          files: [`file:///storage/emulated/0/Documents/${fileName}`],
          dialogTitle: 'Compartir Reporte'
        });
      } else {
        console.warn('Función Share no disponible en esta plataforma');
      }
    } catch (error) {
      console.error('Error al compartir PDF:', error);
      throw error;
    }
  }
}

/**
 * Interfaces para datos del PDF
 */
export interface ReportSection {
  title: string;
  type: 'table' | 'text' | 'kpis';
  data?: any;
  content?: string;
}

export interface TableData {
  headers: string[];
  rows: (string | number)[][];
}

export interface KPIData {
  label: string;
  value: string;
}
